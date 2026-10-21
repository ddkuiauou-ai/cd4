const assert=require('node:assert/strict');
const test=require('node:test');
const {fixture,day}=require('./helpers/business-data.cjs');
const period=(id,start,end=null)=>({periodId:id,securityId:'security-1',listingDate:start,delistingDate:end,lastPresentOn:end?'2016-05-08':'2026-10-02',listingSourceRef:'proof:listing',delistingSourceRef:end?'proof:absence':null,relistingReviewRef:id==='new'?'proof:review':null,mappingRef:'mapping:1'});
const nameEvent={eventId:'rename',securityId:'security-1',companyId:'company-1',eventType:'security_name_change',effectiveOn:'2017-03-31',datePrecision:'day',eventYear:2017,oldName:'인포피아',newName:'오상헬스케어',sourceRef:'proof:disclosure',basis:'disclosure',reviewRef:null,mappingRef:'mapping:1'};
function lifecycleFixture(){const f=fixture();Object.assign(f.state.securities[0],{korName:'오상헬스케어',delistingDate:null,listingDate:day('2024-03-13')});f.state.listingPeriods=[period('old','2008-07-06','2016-05-09'),period('new','2024-03-13')];f.state.lifecycleEvents=[nameEvent];return f;}
test('half-open episodes isolate rows, quotes and last-provided even if old data is recent in storage',()=>{
 const {load}=fixture(),f=load('lib/security-lifecycle.ts');const p=period('new','2024-03-13');
 assert.deepEqual(f.filterListingRows([{date:'2016-05-08'},{date:'2024-03-13'},{date:'2026-10-02'}],p).map(r=>r.date),['2024-03-13','2026-10-02']);
 assert.equal(f.listingContains(period('old','2008-07-06','2016-05-09'),'2016-05-09'),false);
 const value=f.isolateListingValues({per:'4',perDate:'2016-05-08',perState:'provided',perLastProvided:'4',perLastProvidedDate:'2016-05-08'},p,false);
 assert.equal(value.per,null);assert.equal(value.perLastProvided,null);assert.equal(value.perState,'no_observation');
});
test('delisted-gap name changes stay in the timeline without opening another listing episode',()=>{
 const {load}=fixture(),f=load('lib/security-lifecycle.ts');const periods=[period('old','2008-07-06','2016-05-09'),period('new','2024-03-13')];
 const events=[nameEvent,{...nameEvent,eventId:'year-only',effectiveOn:null,datePrecision:'year',eventYear:2018}];
 const timeline=f.lifecycleTimeline(periods,events);
 assert.deepEqual(timeline.map(r=>r.label),['상장','상장폐지','종목명 변경','종목명 변경','재상장']);
 assert.equal(timeline[3].dateLabel,'2018년 (일자 미확정)');assert.equal(timeline[2].date,'2017-03-31');
 assert.equal(f.nameForListingPeriod('오상헬스케어',events,periods[0]),'인포피아');
 assert.equal(f.nameForListingPeriod('오상헬스케어',events,periods[1]),'오상헬스케어');
});
test('live selection uses the same identity and preserves gap events; historical selection cannot inherit latest publication',async()=>{
 const {state,load}=lifecycleFixture();state.prices=[{securityId:'security-1',date:day('2016-05-08'),close:1},{securityId:'security-1',date:day('2024-03-13'),close:2}];
 state.marketcaps=[{securityId:'security-1',date:day('2016-05-08'),marketcap:10n},{securityId:'security-1',date:day('2024-03-13'),marketcap:20n}];
 const data=load('lib/data/security.ts');const latest=await data.getSecurityByCode('security-1');const old=await data.getSecurityByCode('security-1','old');
 assert.equal(latest.securityId,old.securityId);assert.equal(latest.selectedPeriod.periodId,'new');assert.equal(latest.korName,'오상헬스케어');
 assert.deepEqual(latest.prices.map(r=>r.date),['2024-03-13']);assert.deepEqual(old.prices.map(r=>r.date),['2016-05-08']);
 assert.equal(old.korName,'인포피아');assert.equal(old.price,null);assert.equal(old.perLastProvided,null);assert.equal(old.publication,null);assert.equal(old.historicalPeriod,true);
 assert.equal(old.lifecycleEvents[0].effectiveOn,'2017-03-31');assert.equal(await data.getSecurityByCode('security-1','wrong'),null);
});
test('historical detail omits current company/ranking/neighbors and restricts all six source metrics',async()=>{
 const {state,load}=lifecycleFixture();state.metrics=[{securityId:'security-1',date:day('2016-05-08'),per:5},{securityId:'security-1',date:day('2024-03-13'),per:10}];
 const snapshot=await load('lib/data/detail-snapshot.ts').getSecurityDetailSnapshot('security-1','per',undefined,undefined,'old');
 assert.equal(snapshot.company,null);assert.deepEqual(snapshot.companySecs,[]);assert.equal(snapshot.ranking,null);assert.deepEqual(snapshot.neighbors,[]);
 assert.deepEqual(snapshot.history.map(r=>r.date),['2016-05-08']);
 assert.equal(await load('lib/data/detail-snapshot.ts').getSecurityDetailSnapshot('security-1','per',undefined,undefined,'wrong'),null);
});
test('history SQL applies newest-episode bounds to raw/recent prices with Asia/Seoul business days',async()=>{
 const {state,load}=fixture();await load('lib/data/history.ts').readRecentPrices({execute:async q=>{const {PgDialect}=require('drizzle-orm/pg-core');state.queries.push(new PgDialect().sqlToQuery(q));return[];}},['security-1'],30,'2026-10-02');
 const sql=state.queries.at(-1).sql;assert.match(sql,/security_listing_period/);assert.match(sql,/max\(latest.listing_date\)/);assert.match(sql,/date < \(lp.delisting_date/);assert.match(sql,/Asia\/Seoul/);
});

test('batched static archives retain previous episodes while current DTO and company histories stay isolated',async()=>{
 const {state,db,load}=lifecycleFixture();state.prices=[{securityId:'security-1',date:day('2016-05-08'),close:1},{securityId:'security-1',date:day('2024-03-13'),close:2}];
 state.marketcaps=[{securityId:'security-1',date:day('2016-05-08'),marketcap:10n},{securityId:'security-1',date:day('2024-03-13'),marketcap:20n}];
 state.metrics=[{securityId:'security-1',date:day('2016-05-08'),per:5},{securityId:'security-1',date:day('2024-03-13'),per:10}];
 const result=await load('lib/static-build/read-security-batch.ts').readSecurityBatch(db,state.securities,new Map(state.companies.map(r=>[r.companyId,r])),state.publications[0],state.publications[1],new Map());
 const item=result.items[0];assert.equal(item.archive.prices.length,2);assert.equal(item.archive.metrics.length,2);
 assert.deepEqual(item.security.prices.map(r=>r.date),['2024-03-13']);assert.deepEqual(item.allMarketcaps.map(r=>r.date),['2024-03-13']);
 assert.equal(item.security.listingPeriods.length,2);assert.equal(item.security.lifecycleEvents[0].effectiveOn,'2017-03-31');
});

test('static file detail picks prior episodes from archive and rejects invalid period IDs',async t=>{
 const {mkdtempSync,mkdirSync,writeFileSync,rmSync}=require('node:fs'),path=require('node:path'),os=require('node:os');
 const directory=mkdtempSync(path.join(os.tmpdir(),'cd-lifecycle-'));
 const previous=process.env.STATIC_SNAPSHOT_DIR;process.env.STATIC_SNAPSHOT_DIR=directory;
 t.after(()=>{if(previous===undefined)delete process.env.STATIC_SNAPSHOT_DIR;else process.env.STATIC_SNAPSHOT_DIR=previous;rmSync(directory,{recursive:true,force:true});});
 const {load}=lifecycleFixture(),server=load('lib/static-build/server.ts');
 const write=(name,value)=>{const file=path.join(directory,name);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,JSON.stringify(value));};
 write('manifest.json',{version:1,securityAliases:{'000001':'security-1'}});write('identities.json',[{securityId:'security-1',companyId:null}]);
 const security={securityId:'security-1',korName:'오상헬스케어',name:'OSANG',companyId:null,price:'2',priceDate:'2024-03-13',state:'published',publication:{asOf:'2026-10-02'},prices:[{date:'2024-03-13',close:'2'}],marketcaps:[],exchange:'KOSDAQ',listingPeriods:[{...period('old','2008-07-06','2016-05-09'),displayExchange:'KONEX'},period('new','2024-03-13')],lifecycleEvents:[nameEvent]};
 write('data/security/security-1.json',{security,metrics:[],rankings:{per:{ranking:{currentRank:1,rankDate:'2016-05-08',valueObservedAt:'2016-05-08'},neighbors:[{}]}},archive:{prices:[{date:'2016-05-08',close:'1'},{date:'2024-03-13',close:'2'}],marketcaps:[],metrics:[{date:'2016-05-08',per:'3'},{date:'2024-03-13',per:'6'}]}});
 const old=server.getStaticSecurityDetail('000001','per',undefined,undefined,'old');
 assert.equal(old.security.securityId,'security-1');assert.equal(old.security.korName,'인포피아');assert.equal(old.security.price,null);assert.equal(old.security.publication,null);assert.equal(old.security.exchange,'KONEX');
 assert.deepEqual(old.security.prices,[{date:'2016-05-08',close:'1'}]);assert.deepEqual(old.history,[{date:'2016-05-08',per:'3'}]);assert.deepEqual(old.priceHistory,[{date:'2016-05-08',close:'1'}]);assert.equal(old.ranking,null);assert.deepEqual(old.neighbors,[]);
 assert.equal(server.getStaticSecurityDetail('000001','per',undefined,undefined,'invalid'),null);
 assert.deepEqual(server.getStaticSecurityDetail('000001','per').history,[{date:'2024-03-13',per:'6'}]);
 assert.equal(server.getStaticSecurityDetail('000001','per').ranking,null);assert.deepEqual(server.getStaticSecurityDetail('000001','per').neighbors,[]);
});

test('historical name comes from the episode final roster even with no precise delisted-gap event',async()=>{
 const {state,load}=lifecycleFixture();state.lifecycleEvents=[];
 state.rosters=[{securityId:'security-1',date:day('2016-05-08'),name:'인포피아'},{securityId:'security-1',date:day('2026-10-02'),name:'오상헬스케어'}];
 const old=await load('lib/data/security.ts').getSecurityByCode('security-1','old');
 assert.equal(old.korName,'인포피아');assert.equal(old.selectedPeriod.displayName,'인포피아');
});

test('lifecycle UI exposes both periods and the independently dated gap name event with valid navigation',()=>{
 const React=require('react'),{loader,renderToStaticMarkup}=require('./helpers/detail-presentation-loader.cjs');
 const periods=[period('old','2008-07-06','2016-05-09'),period('new','2024-03-13')];
 const {SecurityLifecycle}=loader()('components/security-lifecycle.tsx');
 const html=renderToStaticMarkup(React.createElement(SecurityLifecycle,{periods,events:[nameEvent],selected:periods[0],route:'/security/000001/per',search:{start:'2016-01-01',period:'old'}}));
 assert.match(html,/2017-03-31/);assert.match(html,/인포피아 → 오상헬스케어/);assert.match(html,/재상장/);assert.match(html,/aria-current="page"/);
 assert.match(html,/period=new/);assert.match(html,/start=2016-01-01/);assert.doesNotMatch(html,/2017-01-01/);
});


test('198940 historical KONEX episode retains its market and roster name after the current KOSDAQ master replaces it',async()=>{
 const {state,db,load}=lifecycleFixture();Object.assign(state.securities[0],{ticker:'198940',exchange:'KOSDAQ',korName:'한주라이트메탈'});
 state.lifecycleEvents=[];state.rosters=[{securityId:'security-1',date:day('2016-05-08'),name:'한주금속',exchange:'KONEX'},
  {securityId:'security-1',date:day('2026-10-02'),name:'한주라이트메탈',exchange:'KOSDAQ'}];
 const live=await load('lib/data/security.ts').getSecurityByCode('198940','old');
 assert.equal(live.exchange,'KONEX');assert.equal(live.korName,'한주금속');assert.equal(live.selectedPeriod.displayExchange,'KONEX');
 const current=await load('lib/data/security.ts').getSecurityByCode('198940');assert.equal(current.exchange,'KOSDAQ');
 const batch=await load('lib/static-build/read-security-batch.ts').readSecurityBatch(db,state.securities,new Map(state.companies.map(r=>[r.companyId,r])),state.publications[0],state.publications[1],new Map());
 assert.equal(batch.items[0].security.listingPeriods[0].displayExchange,'KONEX');
 assert.equal(batch.items[0].security.exchange,'KOSDAQ');
});

test('static client applies historical roster market and name and preserves episode selection when rendering details',()=>{
 const React=require('react'),{loader,renderToStaticMarkup}=require('./helpers/detail-presentation-loader.cjs');
 let surface;const periods=[{...period('old','2008-07-06','2016-05-09'),displayExchange:'KONEX',displayName:'한주금속'},
  {...period('new','2024-03-13'),displayExchange:'KOSDAQ',displayName:'한주라이트메탈'}];
 const load=loader({'@/components/detail-surface':{DetailSurface:props=>{surface=props;return null;}},
  'next/navigation':{useSearchParams:()=>new URLSearchParams('period=old')}});
 renderToStaticMarkup(React.createElement(load('components/static-detail-client.tsx').StaticDetailClient,{initial:{search:{period:'old'},metric:'per',companyPage:false,
  security:{securityId:'security-1',ticker:'198940',korName:'한주라이트메탈',exchange:'KOSDAQ',listingPeriods:periods,lifecycleEvents:[]},
  company:null,history:[],prices:[],sourceHistory:[],companySecs:[],neighbors:[],ranking:null}}));
 assert.equal(surface.security.exchange,'KONEX');assert.equal(surface.security.korName,'한주금속');assert.equal(surface.security.selectedPeriod.periodId,'old');
});


test('date range form, reset and metric navigation retain the selected episode',async()=>{
 const {state,load}=lifecycleFixture();state.metrics=[{securityId:'security-1',date:day('2016-05-08'),per:5}];
 const snapshot=await load('lib/data/detail-snapshot.ts').getSecurityDetailSnapshot('security-1','per',undefined,undefined,'old');
 const React=require('react'),{pageLoader,loader,renderToStaticMarkup}=require('./helpers/detail-presentation-loader.cjs');
 const page=await pageLoader(snapshot).pages.RestoredSecurityDetail({code:'security-1',metric:'per',search:{period:'old',start:'2016-01-01'}});
 const html=renderToStaticMarkup(page);
 assert.match(html,/type="hidden" name="period" value="old"/);assert.match(html,/href="[^"?]+\?period=old"/);
 assert.match(html,/선택한 상장 기간의 전체 제공 이력/);
 const {CompanyFinancialTabs}=loader()('components/company-financial-tabs.tsx');
 const tabs=renderToStaticMarkup(React.createElement(CompanyFinancialTabs,{periodId:'old',security:{securityId:'security-1',ticker:'000001',exchange:'KOSPI'}}));
 assert.match(tabs,/per\?period=old/);assert.match(tabs,/bps\?period=old/);
});


test('batched latest-episode DTO cannot call a publication before its listing current',async()=>{
 const {state,db,load}=lifecycleFixture();state.listingPeriods=[period('future','2027-01-01')];
 const result=await load('lib/static-build/read-security-batch.ts').readSecurityBatch(db,state.securities,new Map(state.companies.map(r=>[r.companyId,r])),state.publications[0],state.publications[1],new Map());
 assert.equal(result.items[0].security.publication,null);assert.equal(result.items[0].security.state,'unpublished');assert.equal(result.items[0].security.price,null);
});
