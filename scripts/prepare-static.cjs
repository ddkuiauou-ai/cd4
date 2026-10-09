const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createStaticAliases } = require('./static-aliases.cjs');
const { createStaticAssetWriter } = require('./static-asset-writer.cjs');
process.env.STATIC_PREPARING = '1';
process.env.NODE_ENV = 'production';
const root = path.resolve(__dirname, '..');
const nextRequire = require('node:module').createRequire(require.resolve('next/package.json'));
nextRequire('@next/env').loadEnvConfig(root, false, { info() {}, error() {} });
require('./register-typescript.cjs');
const work = path.resolve(process.env.STATIC_SNAPSHOT_DIR || path.join(root, '.static-build'));
const metrics = ['marketcap', 'per', 'pbr', 'bps', 'eps', 'div', 'dps'];
const { db, closeDatabase } = require('../db/index.ts');
const { installQueryCounter } = require('./static-query-counter.cjs');
const queryCounter = installQueryCounter(db.$client);
const schema = require('../db/schema-postgres.ts');
const { asc, sql } = require('drizzle-orm');
const { toDataDTO, businessDate } = require('../lib/data/dto.ts');
const { readSnapshot, isCurrentResult, publicationState } = require('../lib/data/publication.ts');
const { currentSecurity } = require('../lib/data/security.ts');
const { currentCompany } = require('../lib/data/company.ts');
const { readSecurityBatch } = require('../lib/static-build/read-security-batch.ts');
const { aggregateRegisteredCompanyHistory, exactPercentage } = require('../lib/data/registered-company-history.ts');
const { securityRouteCodes, companyRouteCodes } = require('../lib/entity-paths.ts');
const { getWholeRankingExport } = require('../lib/data/ranking-export.ts');
const { serializeRankingCsv, readRankingCsvMetadata } = require('../lib/csv/ranking.ts');
const { createPreparedRankings } = require('../lib/static-build/ranking-snapshots.ts');

function writeJson(relative, value) {
  const file = path.join(work, relative); fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const assetWriter = createStaticAssetWriter(path.join(work, 'assets'));
const assets = assetWriter.assets;
// Entity labels describe call sites only; identical payload bytes always share one URL.
const asset = (_label, value, extension = 'json') => assetWriter.write(value, extension);
function table(rows, columns) {
  return { schemaVersion: 1, columns, rows: rows.map(row => columns.map(key => row[key] ?? null)) };
}
const listedOrder = (a, b) => Number(b.delistingDate == null) - Number(a.delistingDate == null)
  || a.exchange.localeCompare(b.exchange) || a.ticker.localeCompare(b.ticker) || a.securityId.localeCompare(b.securityId);
const readSecurity = id => JSON.parse(fs.readFileSync(path.join(work, `data/security/${id}.json`), 'utf8'));

async function prepare() {
  if ((process.argv.includes('--reuse') || process.env.STATIC_BUILD_REUSE === '1') && fs.existsSync(path.join(work, 'manifest.json'))) {
    console.log('Reusing immutable static input'); return;
  }
  const started = Date.now(), generatedAt = new Date().toISOString();
  fs.mkdirSync(work, { recursive: true });
  for (const directory of ['assets', 'data', 'rankings']) fs.rmSync(path.join(work, directory), { recursive: true, force: true });
  // A failed extraction must never leave an old input marked complete.
  fs.rmSync(path.join(work, 'manifest.json'), { force: true });
  queryCounter.phase('inventory');
  const raw = await readSnapshot(async tx => ({
    securities: await tx.query.security.findMany({ orderBy: [asc(schema.security.securityId)] }),
    companies: await tx.query.company.findMany({ orderBy: [asc(schema.company.companyId)] }),
    publications: await tx.query.resultPublication.findMany(),
    ranks: await tx.query.securityRank.findMany(),
  }));
  const publications = new Map(raw.publications.map(row => [row.publicationKey, row]));
  const secPub = publications.get('security_latest/krx-all') ?? null, coPub = publications.get('company_marketcap/krx-all') ?? null;
  const secRoutes = securityRouteCodes(raw.securities), coRoutes = companyRouteCodes(raw.securities);
  const secById = new Map(raw.securities.map(row => [row.securityId, row]));
  const coById = new Map(raw.companies.map(row => [row.companyId, row]));
  const members = new Map();
  for (const row of raw.securities) if (row.companyId) {
    if (!members.has(row.companyId)) members.set(row.companyId, []);
    members.get(row.companyId).push(row);
  }
  for (const rows of members.values()) rows.sort(listedOrder);
  const rankingRows = new Map();
  for (const pub of raw.publications) if (pub.metricType && pub.publicationKey.startsWith('security_rank/')) {
    rankingRows.set(pub.publicationKey, raw.ranks.filter(row => isCurrentResult(row, pub)
      && row.scopeKey === pub.scopeKey && row.metricType === pub.metricType
      && businessDate(row.rankDate) === businessDate(pub.asOf)));
  }
  const sampleSize = process.env.STATIC_BUILD_SAMPLE ? Math.max(40, Number(process.env.STATIC_BUILD_SAMPLE) || 40) : 0;
  const selected = new Set();
  queryCounter.phase('sample-selection');
  if (sampleSize) {
    const longest = await db.execute(sql`SELECT security_id AS id, count(*)::int AS count FROM price WHERE security_id IS NOT NULL GROUP BY security_id ORDER BY count(*) DESC, security_id LIMIT 16`);
    longest.forEach(row => selected.add(row.id));
    for (const rows of rankingRows.values()) {
      const sorted = rows.filter(row => row.rankingState === 'included').sort((a,b) => a.currentRank-b.currentRank);
      [sorted[0], sorted[Math.floor(sorted.length/2)], sorted.at(-1)].filter(Boolean).forEach(row => selected.add(row.securityId));
    }
    for (const predicate of [row => row.type !== '보통주', row => row.delistingDate != null,
      row => !isCurrentResult(row, secPub), row => metrics.some(metric => row[`${metric}State`] !== 'provided')]) {
      raw.securities.filter(predicate).slice(0, 4).forEach(row => selected.add(row.securityId));
    }
    for (const row of raw.securities) { if (selected.size >= sampleSize) break; selected.add(row.securityId); }
  } else raw.securities.forEach(row => selected.add(row.securityId));
  const selectedCompanies = new Set(sampleSize ? [...selected].map(id => secById.get(id)?.companyId).filter(Boolean).slice(0, 12) : raw.companies.map(row => row.companyId));
  const neededCompanies = new Set([...selectedCompanies, ...[...selected].map(id => secById.get(id)?.companyId).filter(Boolean)]);
  const neededSecurities = new Set(selected);
  for (const id of neededCompanies) (members.get(id) || []).forEach(row => neededSecurities.add(row.securityId));
  const includedByMetric = new Map();
  for (const metric of metrics) includedByMetric.set(metric, (rankingRows.get(`security_rank/krx-all/${metric}`) || [])
    .filter(row => row.rankingState === 'included').sort((a,b) => a.currentRank-b.currentRank || a.securityId.localeCompare(b.securityId)));
  const neighbor = row => {
    const security = secById.get(row.securityId);
    return { securityId: security.securityId, name: security.name, korName: security.korName,
      exchange: security.exchange, ticker: security.ticker, type: security.type, companyId: security.companyId,
      currentRank: row.currentRank, routeCode: secRoutes.get(row.securityId) ?? null };
  };
  queryCounter.phase('security-histories');
  const batchMemory = { batchSize: 50, batches: 0, maxHistoryRows: 0, peakRssBytes: 0, peakHeapUsedBytes: 0, seconds: 0,
    note: 'Process memory sampled after each bounded batch load/write; includes runtime overhead and unreclaimed prior allocations.' };
  const recordBatchMemory = () => {
    const memory = process.memoryUsage();
    batchMemory.peakRssBytes = Math.max(batchMemory.peakRssBytes, memory.rss);
    batchMemory.peakHeapUsedBytes = Math.max(batchMemory.peakHeapUsedBytes, memory.heapUsed);
  };
  const batchStarted = performance.now();
  await readSnapshot(async tx => {
    let completed = 0;
    const ids = [...neededSecurities];
    for (let offset = 0; offset < ids.length; offset += batchMemory.batchSize) {
      const batch = await readSecurityBatch(tx, ids.slice(offset, offset + batchMemory.batchSize).map(id => secById.get(id)),
        coById, secPub, coPub, secRoutes);
      batchMemory.batches++; batchMemory.maxHistoryRows = Math.max(batchMemory.maxHistoryRows, batch.historyRows);
      recordBatchMemory();
      for (const { securityId: id, security, metrics: history, allMarketcaps } of batch.items) {
      const refs = {
        prices: asset(`security/${id}/prices`, table(security.prices.toReversed(), ['date','open','high','low','close','volume','fvolume','transaction','rate'])),
        marketcap: asset(`security/${id}/marketcap`, table(security.marketcaps, ['date','marketcap','shares'])), metrics: {},
      };
      for (const metric of metrics.filter(metric => metric !== 'marketcap')) refs.metrics[metric] = asset(`security/${id}/${metric}`,
        table(history, ['date', metric, `${metric}State`]));
      const rankings = {};
      for (const metric of metrics) {
        const publication = publications.get(`security_rank/krx-all/${metric}`);
        const row = (rankingRows.get(`security_rank/krx-all/${metric}`) || []).find(item => item.securityId === id);
        const ranked = includedByMetric.get(metric), rank = row?.currentRank;
        const previous = rank != null ? ranked.filter(item => item.currentRank < rank) : [];
        const priorRank = previous.at(-1)?.currentRank;
        const previousRow = previous.find(item => item.currentRank === priorRank);
        const next = rank != null ? ranked.find(item => item.currentRank > rank) : null;
        rankings[metric] = { ranking: { ...publicationState(publication ?? null), currentRank: row?.currentRank ?? null,
          priorRank: row?.priorRank ?? null, rankingState: row?.rankingState ?? null, exclusionReason: row?.exclusionReason ?? null,
          value: row?.value == null ? null : String(row.value), valueObservedAt: row?.valueObservedAt ? businessDate(row.valueObservedAt) : null,
          rankDate: publication ? businessDate(publication.asOf) : null }, neighbors: [previousRow,next].filter(Boolean).map(neighbor) };
      }
      writeJson(`data/security/${id}.json`, { security, metrics: history, allMarketcaps, assets: refs, rankings });
      completed++; if (completed % 50 === 0) console.log(`Prepared securities ${completed}/${neededSecurities.size}`);
      }
      recordBatchMemory();
    }
  });
  batchMemory.seconds = (performance.now() - batchStarted) / 1000;
  queryCounter.phase('company-assembly');
  const rankedCompanies = raw.companies.filter(row => isCurrentResult(row, coPub) && row.rankingState === 'included')
    .sort((a,b) => a.marketcapRank-b.marketcapRank || a.companyId.localeCompare(b.companyId));
  for (const id of neededCompanies) {
    const row = coById.get(id), allMembers = members.get(id) || [], active = allMembers.filter(member => member.delistingDate == null);
    const sources = new Map(allMembers.map(member => [member.securityId, readSecurity(member.securityId)]));
    const histories = active.flatMap(member => sources.get(member.securityId).allMarketcaps)
      .filter(item => !coPub || item.date <= businessDate(coPub.asOf));
    const current = isCurrentResult(row, coPub), dto = toDataDTO(row), asOf = current ? dto.marketcapDate : null;
    const registeredHistory = aggregateRegisteredCompanyHistory(active.map(member => member.securityId), histories, asOf ? [asOf] : []);
    const composition = registeredHistory.find(item => item.date === asOf);
    const complete = Boolean(current && dto.marketcap != null && row.marketcapCompleteness === 'complete' && composition && !composition.partial && composition.totalMarketcap === dto.marketcap);
    const securities = active.map(member => ({ securityId:member.securityId,name:member.name,korName:member.korName,ticker:member.ticker,
      exchange:member.exchange,type:member.type,routeCode:secRoutes.get(member.securityId)??null,
      marketcap:composition?.securitiesBreakdown[member.securityId]??null,
      marketcapDate:composition?.securitiesBreakdown[member.securityId]!=null?asOf:null,
      percentage:complete&&composition?.securitiesBreakdown[member.securityId]!=null?exactPercentage(composition.securitiesBreakdown[member.securityId],dto.marketcap):null,
      marketcapHistory:histories.filter(item=>item.securityId===member.securityId) }));
    const representative = allMembers.find(member=>member.type==='보통주');
    const company = { company:toDataDTO(currentCompany(row,coPub??null)),companyId:id,companyName:row.name,companyKorName:row.korName,
      totalMarketcap:current?dto.marketcap:null,totalMarketcapDate:current?dto.marketcapDate:null,
      marketcapCompleteness:current?row.marketcapCompleteness:null,marketcapRank:current?row.marketcapRank:null,
      marketcapPriorRank:current?row.marketcapPriorRank:null,rankingState:current?row.rankingState:null,
      exclusionReason:current?row.exclusionReason:null,resultSourceRef:current?row.resultSourceRef:null,
      state:current?'published':'unpublished',publication:current?toDataDTO(coPub):null,routeCode:representative?secRoutes.get(representative.securityId)??null:null,
      compositionComplete:complete,compositionReason:!current?'unpublished':!composition||composition.observedCount===0||composition.partial||row.marketcapCompleteness!=='complete'?'missing_input':!complete?'different_total':null,
      compositionObservedCount:composition?.observedCount??0,compositionTargetCount:active.length,securities,registeredHistory,aggregatedHistory:registeredHistory };
    const companySecs = [...allMembers].sort((a,b)=>Number(a.type==null)-Number(b.type==null)
      ||(a.type??'').localeCompare(b.type??'')||listedOrder(a,b)).map(member=>{
      const source=sources.get(member.securityId).security;
      return { ...toDataDTO(currentSecurity(member,secPub??null)),company:toDataDTO(currentCompany(row,coPub??null)),
        prices:source.prices.slice(0,1),marketcaps:source.marketcaps,routeCode:secRoutes.get(member.securityId)??null };
    });
    const rank=current?row.marketcapRank:null, previous=rank!=null?rankedCompanies.filter(item=>item.marketcapRank<rank):[];
    const priorRank=previous.at(-1)?.marketcapRank;
    const neighbors=[previous.find(item=>item.marketcapRank===priorRank),rank!=null?rankedCompanies.find(item=>item.marketcapRank>rank):null].filter(Boolean).map(item=>{
      const rep=(members.get(item.companyId)||[]).find(member=>member.type==='보통주');
      return {...toDataDTO(item),securities:rep?[{securityId:rep.securityId}]:[],routeCode:rep?secRoutes.get(rep.securityId)??null:null};
    });
    const refs={companyHistory:asset(`company/${id}/history`,table(registeredHistory,['date','totalMarketcap','securitiesBreakdown','observedCount','targetCount','observedSecurityIds','partial'])),
      prices:representative?sources.get(representative.securityId).assets.prices:undefined,memberMarketcaps:{},memberPrices:{}};
    for (const member of allMembers) { refs.memberMarketcaps[member.securityId]=sources.get(member.securityId).assets.marketcap;refs.memberPrices[member.securityId]=sources.get(member.securityId).assets.prices; }
    writeJson(`data/company/${id}.json`,{company,companySecs,assets:refs,neighbors});
    for(const member of allMembers){ const source=sources.get(member.securityId);source.assets.companyHistory=refs.companyHistory;
      source.assets.memberMarketcaps=refs.memberMarketcaps;source.assets.memberPrices=refs.memberPrices;
      writeJson(`data/security/${member.securityId}.json`,source); }
  }
  const rankingManifests={};
  queryCounter.phase('ranking-prices');
  const preparedRankings=createPreparedRankings(raw,secRoutes,members);
  await readSnapshot(tx=>preparedRankings.loadPrices(tx));
  queryCounter.phase('ranking-pages-and-csv');
  for (const scope of ['security','company']) for (const metric of scope==='company'?['marketcap']:metrics) {
    const manifest={version:1,scope,metric,scopes:{}};
    const scopeKeys=scope==='company'?['krx-all']:[...new Set(['krx-all',...raw.publications.filter(pub=>pub.metricType===metric&&pub.publicationKey.startsWith('security_rank/')).map(pub=>pub.scopeKey)])];
    for (const scopeKey of scopeKeys) {
      const first=preparedRankings.getPage(scope,metric,1,scopeKey);
      const entry={state:first.state,publication:first.publication,totalCount:first.totalCount,totalPages:Math.max(1,first.totalPages),pages:{},csv:null};
      for(let page=1;page<=entry.totalPages;page++){
        const snapshot=page===1?first:preparedRankings.getPage(scope,metric,page,scopeKey);
        entry.pages[String(page)]=asset(`ranking/${scope}/${scopeKey}/${metric}-${page}`,snapshot);
      }
      if(first.state==='published'){
        const exported=await getWholeRankingExport(scope,metric,undefined,scopeKey);exported.generatedAt=generatedAt;
        const body=serializeRankingCsv(exported);
        const basis={scope,metric,scopeKey,referenceDate:exported.referenceDate,rankDate:exported.rankDate,generatedAt,totalCount:exported.totalCount,
          revision:exported.revision,calculationId:exported.calculationId};
        const metadata=readRankingCsvMetadata(body,basis);
        entry.csv={url:asset(`ranking/${scope}/${scopeKey}/${metric}`,body,'csv'),metadata};
        if(scopeKey==='krx-all')writeJson(`rankings/${scope}-${metric}-headers.json`,{
          'Content-Type':'text/csv; charset=utf-8','Cache-Control':'no-store',
          'Content-Disposition':`attachment; filename="${metadata.filename}"`,
          'X-Ranking-Scope':scope,'X-Ranking-Metric':metric,'X-Ranking-Scope-Key':scopeKey,
          'X-Ranking-Reference-Date':metadata.referenceDate??'','X-Ranking-Generated-At':generatedAt,
          'X-Ranking-Row-Count':String(metadata.totalCount),'X-Ranking-Revision':metadata.revision,
          'X-Ranking-Calculation-Id':metadata.calculationId,'X-Ranking-Publication-Key':exported.publicationKey });
      }
      manifest.scopes[scopeKey]=entry;
    }
    writeJson(`rankings/${scope}-${metric}.json`,manifest);rankingManifests[`${scope}-${metric}`]=manifest;
  }
  const identities=toDataDTO(raw.securities).map(row=>({securityId:row.securityId,companyId:row.companyId,name:row.name,korName:row.korName,
    ticker:row.ticker,exchange:row.exchange,type:row.type,delistingDate:row.delistingDate,routeCode:secRoutes.get(row.securityId)??null,
    companyRouteCode:row.companyId?coRoutes.get(row.companyId)??null:null}));
  writeJson('identities.json',identities);writeJson('companies.json',toDataDTO(raw.companies));
  const { securityAliases, companyAliases } = createStaticAliases(raw.securities, raw.companies);
  const securityCodes=[...selected].map(id=>secRoutes.get(id)||id),companyCodes=[...selectedCompanies].map(id=>coRoutes.get(id)||id);
  const routes=[{path:'/',kind:'page'},{path:'/dashboard/',kind:'page'}];
  for(const [key,manifest]of Object.entries(rankingManifests)){
    const base=key==='company-marketcap'?'marketcaps':manifest.metric;
    const pages=Math.max(...Object.values(manifest.scopes).map(entry=>entry.totalPages));
    routes.push({path:`/${base}/1/`,kind:'page'});
    for(let page=1;page<=pages;page++)routes.push({path:`/${base}/${page===1?'':`${page}/`}`,kind:'page'});
  }
  for(const code of securityCodes)for(const segment of ['',...metrics])routes.push({path:`/security/${encodeURIComponent(code)}/${segment?`${segment}/`:''}`,kind:'page'});
  for(const code of companyCodes)for(const segment of ['','marketcap'])routes.push({path:`/company/${encodeURIComponent(code)}/${segment?`${segment}/`:''}`,kind:'page'});
  const canonical=new Set(routes.map(row=>row.path)),aliases=[];
  for(const [kind,map,chosen]of [['security',securityAliases,selected],['company',companyAliases,selectedCompanies]])for(const [alias,id]of Object.entries(map)){
    if(!chosen.has(id)||alias.includes('/')||alias.includes('\\')||alias==='.'||alias==='..')continue;
    const code=(kind==='security'?secRoutes:coRoutes).get(id)||id;if(alias===code)continue;
    for(const segment of kind==='security'?['',...metrics]:['','marketcap']){
      const suffix=segment?`${segment}/`:'';const from=`/${kind}/${encodeURIComponent(alias)}/${suffix}`;
      if(!canonical.has(from))aliases.push({path:from,target:`/${kind}/${encodeURIComponent(code)}/${suffix}`});
    }
  }
  const sourceRevisions=Object.fromEntries(raw.publications.map(pub=>[pub.publicationKey,String(pub.revision)]));
  const sourcePublications=Object.fromEntries(raw.publications.map(pub=>[pub.publicationKey,{asOf:businessDate(pub.asOf),revision:String(pub.revision)}]));
  queryCounter.phase('publication-validation');
  const finalPublications=await readSnapshot(async tx=>Object.fromEntries((await tx.query.resultPublication.findMany())
    .map(pub=>[pub.publicationKey,{asOf:businessDate(pub.asOf),revision:String(pub.revision)}])));
  const orderedRevisions=values=>JSON.stringify(Object.entries(values).sort(([a],[b])=>a.localeCompare(b)));
  if(orderedRevisions(sourcePublications)!==orderedRevisions(finalPublications))throw new Error('Publications changed during static extraction; prepare fresh input again');
  const snapshotId=digest(JSON.stringify({generatedAt,sourceRevisions,securityCodes,companyCodes})).slice(0,20);
  const requiredFiles=['search-data.json','sitemap.xml',...['companies-marketcap',...metrics.map(metric=>`securities-${metric}`)].map(name=>`ranking-data/${name}.csv`)];
  const manifest={version:1,snapshotId,generatedAt,sample:{enabled:Boolean(sampleSize),selection:sampleSize?`stratified-${sampleSize}`:'full',securities:selected.size,companies:selectedCompanies.size},
    routes,aliases,securityCodes,companyCodes,assets,requiredFiles,securityAliases,companyAliases,companyRoutes:Object.fromEntries(coRoutes),sourceRevisions,
    sourcePublications,referenceDate:secPub?businessDate(secPub.asOf):null,
    extraction:{seconds:(Date.now()-started)/1000,sourceSecurities:raw.securities.length,sourceCompanies:raw.companies.length,
      preparedSecurities:neededSecurities.size,batchMemory,rankingPrices:preparedRankings.stats,databaseQueries:queryCounter.snapshot()}};
  writeJson('manifest.json',manifest);
  console.log(JSON.stringify({snapshotId,sample:manifest.sample,routes:routes.length,assets:assets.length,extraction:manifest.extraction}));
}
prepare().catch(error=>{console.error('Static extraction failed:',error.code||error.name,error.message?.replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]'));process.exitCode=1;})
  .finally(()=>closeDatabase());
