const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { JSDOM } = require('jsdom');
const { loader, renderToStaticMarkup } = require('./helpers/detail-presentation-loader.cjs');

const table = (columns, rows) => ({schemaVersion: 1, columns, rows});
const publication = {asOf:'2026-10-08', revision:'3', scopeKey:'krx-all'};
const security = {securityId:'security-one', routeCode:'KOSPI.000001', name:'Example', korName:'예시', ticker:'000001', exchange:'KOSPI', type:'보통주', state:'published', publication, pbr:'2', pbrState:'provided', pbrDate:'2026-10-08', price:'100', priceState:'provided', priceDate:'2026-10-08', prices:[], marketcaps:[], company:null};
const rows = [{date:'2026-09-29', pbr:'999', pbrState:'provided', bps:'9007199254740993'}, {date:'2026-10-01', pbr:'0', pbrState:'provided', bps:null}, {date:'2026-10-08', pbr:'2', pbrState:'provided', bps:'-1'}];
const props = {security, company:null, companySecs:[], ranking:{currentRank:1, rankDate:'2026-10-08'}, neighbors:[], history:rows.map(row=>({date:row.date,value:row.pbr,state:row.pbrState})), sourceHistory:rows, prices:[{date:'2026-10-08',close:'100',open:'90',rate:0,volume:'9007199254740993'}], metric:'pbr', basic:false, search:{}};

function presentationLoader(extra = {}) {
  const empty = () => null;
  const named = (...keys) => Object.fromEntries(keys.map(key=>[key,empty]));
  let downloaded;
  const load = loader({
    '@/components/sticky-company-header':{StickyCompanyHeader:({displayName,detail})=>React.createElement('h1',null,displayName,detail?.value)},
    '@/components/company-financial-tabs':named('CompanyFinancialTabs'),
    '@/components/detail-mobile-navigation':named('DetailMobileNavigation'),
    '@/components/recent-security-tracker':named('RecentSecurityTracker'),
    '@/components/recent-securities-sidebar':named('RecentSecuritiesSidebar'),
    '@/components/page-navigation':named('PageNavigation'),
    '@/components/detail-metric-facts':named('DetailMetricFacts'),
    '@/components/simple-interactive-securities':named('InteractiveSecuritiesSection'),
    '@/components/interactive-chart-section':named('InteractiveChartSection'),
    '@/components/detail-history-chart':named('DetailHistoryChart'),
    '@/components/restored-detail-charts':{
      ...named('DetailFinancialAnalysis','DetailPriceHistory'),
      DetailAnnualHistory:({rows})=>React.createElement('div',{'data-testid':'annual'},JSON.stringify(rows)),
    },
    '@/components/card-company-marketcap':{__esModule:true,default:empty},
    '@/components/CsvDownloadButton':{CsvDownloadButton:value=>{downloaded=value;return React.createElement('button',{disabled:!value.data?.length},value.label);}},
    '@/components/share-button':{__esModule:true,default:empty},
    '@/components/header-rank':{__esModule:true,default:empty},
    ...extra,
  });
  return {load, csv:()=>downloaded};
}

function replaceGlobals(values) {
  const prior = new Map(Object.keys(values).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for (const [key,value] of Object.entries(values)) Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  return () => {for(const [key,descriptor] of prior) if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];};
}

test('tuple assets retain exact decimal strings, nulls, real zero and coverage and reject malformed tables',()=>{
  const {decodeStaticTable}=loader()('lib/static-data.ts');
  const coverage={one:'9007199254740993',two:null};
  assert.deepEqual(decodeStaticTable(table(['date','value','coverage'],[['2026-10-08','9007199254740993',coverage],['2026-10-09','0',null]])),[
    {date:'2026-10-08',value:'9007199254740993',coverage},{date:'2026-10-09',value:'0',coverage:null},
  ]);
  for(const invalid of [null,{}, {...table([],[]),schemaVersion:2},table(['date','date'],[]),table(['date'],[[]]),table([1],[])])assert.throws(()=>decodeStaticTable(invalid));
});

test('immutable asset requests share one promise and a failed request can be retried',async()=>{
  let calls=0;
  const restore=replaceGlobals({fetch:async url=>{calls++;if(url==='/retry'&&calls===2)return {ok:false};return {ok:true,json:async()=>table(['value'],[['9007199254740993']])};}});
  try{
    const {loadStaticRows}=loader()('lib/static-data.ts');
    const first=loadStaticRows('/shared');
    assert.equal(loadStaticRows('/shared'),first);
    assert.equal((await first)[0].value,'9007199254740993');
    await loadStaticRows('/shared');assert.equal(calls,1);
    await assert.rejects(loadStaticRows('/retry'));
    assert.equal((await loadStaticRows('/retry'))[0].value,'9007199254740993');assert.equal(calls,3);
  }finally{restore();}
});

test('long browsing sessions release old tables while hot data and all pending requests remain shared',async()=>{
  const calls=new Map();let finishSlow;
  const slow=new Promise(resolve=>{finishSlow=resolve;});
  const response=url=>({ok:true,json:async()=>table(['value'],[[url]])});
  const restore=replaceGlobals({fetch:url=>{
    calls.set(url,(calls.get(url)||0)+1);
    if(url==='/slow')return slow;
    if(url==='/malformed'&&calls.get(url)===1)return Promise.resolve({ok:true,json:async()=>({schemaVersion:99})});
    return Promise.resolve(response(url));
  }});
  try{
    const {loadStaticRows}=loader()('lib/static-data.ts');
    const pending=loadStaticRows('/slow');
    await loadStaticRows('/hot');
    for(let index=0;index<100;index++){
      await loadStaticRows(`/entry/${index}`);
      if(index%5===0)await loadStaticRows('/hot');
    }
    assert.equal(loadStaticRows('/slow'),pending,'cache pressure must not duplicate an unresolved request');
    await loadStaticRows('/hot');await loadStaticRows('/entry/99');
    assert.equal(calls.get('/hot'),1);assert.equal(calls.get('/entry/99'),1);
    assert.equal((await loadStaticRows('/entry/0'))[0].value,'/entry/0');assert.equal(calls.get('/entry/0'),2,'an old decoded history is released and may be loaded again');
    finishSlow(response('/slow'));assert.equal((await pending)[0].value,'/slow');assert.equal(calls.get('/slow'),1);
    await assert.rejects(loadStaticRows('/malformed'));
    assert.equal((await loadStaticRows('/malformed'))[0].value,'/malformed');assert.equal(calls.get('/malformed'),2,'invalid asset data must not remain cached');
  }finally{restore();}
});

test('an oversized history remains usable without retaining it or flushing smaller shared histories',async()=>{
  const calls=new Map();
  const restore=replaceGlobals({fetch:async url=>{
    calls.set(url,(calls.get(url)||0)+1);
    return {ok:true,json:async()=>table(['value'],url==='/large'?Array(100_001).fill(['9007199254740993']):[['small']])};
  }});
  try{
    const {loadStaticRows}=loader()('lib/static-data.ts');
    await loadStaticRows('/small');
    const large=await loadStaticRows('/large');assert.equal(large.length,100_001);assert.equal(large.at(-1).value,'9007199254740993');
    await loadStaticRows('/small');assert.equal(calls.get('/small'),1,'an oversized table must not flush reusable small data');
    await loadStaticRows('/large');assert.equal(calls.get('/large'),2,'oversized decoded data is released after its consumer finishes');
  }finally{restore();}
});

test('PBR source membership and states survive missing BPS dependencies and parallel asset loading',async()=>{
  const sources={
    '/pbr':table(['date','pbr','pbrState'],rows.map(row=>[row.date,row.pbr,row.pbrState])),
    '/bps':table(['date','bps'],[['2026-09-29','9007199254740993'],['2026-10-08','-1']]),
    '/prices':table(['date','close'],[['2026-10-08','100']]),
  };
  const calls=[];
  const restore=replaceGlobals({fetch:async url=>{calls.push(url);return {ok:true,json:async()=>sources[url]};}});
  try{
    const {loadStaticDetailData}=loader()('lib/static-data.ts');
    const data=await loadStaticDetailData({metrics:{pbr:'/pbr',bps:'/bps'},prices:'/prices'},'pbr');
    assert.deepEqual(data.sourceHistory,rows);assert.deepEqual(new Set(calls),new Set(['/pbr','/bps','/prices']));
  }finally{restore();}
});

test('optimized static props omit full histories while preserving official quote, default statistics and annual SSR',async()=>{
  const context=presentationLoader({'@/lib/data/detail-snapshot':{getSecurityDetailSnapshot:async()=>({...props,priceHistory:props.prices,history:rows})},'@/lib/static-build/server':{getStaticDetailAssets:()=>({metrics:{pbr:'/pbr',bps:'/bps'},prices:'/prices'})}});
  const surface=context.load('components/detail-surface.tsx');
  const {compactDetailProps}=context.load('components/restored-detail-page.tsx');
  const initial={...compactDetailProps({...props,security:{...security,prices:props.prices,marketcaps:[{date:'2026-01-01',marketcap:'9876543210123456789'}]}}),initialAnalysis:surface.prepareDetailAnalysis(props)};
  assert.deepEqual(initial.history,[]);assert.deepEqual(initial.sourceHistory,[]);assert.equal('prices' in initial.security,false);assert.equal('marketcaps' in initial.security,false);
  assert.equal(initial.prices[0].volume,'9007199254740993');assert.equal(initial.initialAnalysis.summary.count,3);assert.equal(initial.initialAnalysis.annualRows[0].value,'2');
  assert.doesNotMatch(JSON.stringify(initial),/9876543210123456789/);
  const html=renderToStaticMarkup(React.createElement(surface.DetailSurface,{...initial,historyPending:true}));
  assert.match(html,/12개월 평균/);assert.match(html,/실제 제공 3개/);assert.match(html,/data-testid="annual"/);assert.match(html,/2026-10-08/);assert.match(html,/전체 이력 CSV/);
});

test('static wrapper offers an inline benchmark and compact assets while standalone retains server rendering',async()=>{
  let assetReads=0;
  const assets={metrics:{pbr:'/pbr',bps:'/bps'},prices:'/prices'};
  const context=presentationLoader({
    '@/lib/data/detail-snapshot':{getSecurityDetailSnapshot:async()=>({...props,priceHistory:props.prices,history:rows})},
    '@/lib/static-build/server':{getStaticDetailAssets:(kind,id)=>{assetReads++;assert.equal(kind,'security');assert.equal(id,security.securityId);return assets;}},
    '@/components/static-detail-client':{StaticDetailClient:()=>null},
  });
  const {RestoredSecurityDetail}=context.load('components/restored-detail-page.tsx');
  const priorMode=process.env.NEXT_OUTPUT_MODE, priorInline=process.env.STATIC_DETAIL_INLINE;
  try{
    process.env.NEXT_OUTPUT_MODE='export';process.env.STATIC_DETAIL_INLINE='1';
    const baseline=await RestoredSecurityDetail({code:security.securityId,metric:'pbr'});
    assert.equal(baseline.props.initial.sourceHistory.length,3);assert.equal(assetReads,0);
    delete process.env.STATIC_DETAIL_INLINE;
    const optimized=await RestoredSecurityDetail({code:security.securityId,metric:'pbr'});
    assert.deepEqual(optimized.props.initial.sourceHistory,[]);assert.equal(optimized.props.initial.initialAnalysis.summary.count,3);assert.deepEqual(optimized.props.assets,assets);assert.equal(assetReads,1);
    const basic=await RestoredSecurityDetail({code:security.securityId,basic:true});
    assert.equal(basic.type.name,'DetailSurface');assert.deepEqual(basic.props.prices,props.prices);assert.equal(assetReads,1);
    delete process.env.NEXT_OUTPUT_MODE;
    const standalone=await RestoredSecurityDetail({code:security.securityId,metric:'pbr'});
    assert.equal(standalone.type.name,'DetailSurface');assert.equal(standalone.props.sourceHistory.length,3);assert.equal(assetReads,1);
  }finally{
    if(priorMode===undefined)delete process.env.NEXT_OUTPUT_MODE;else process.env.NEXT_OUTPUT_MODE=priorMode;
    if(priorInline===undefined)delete process.env.STATIC_DETAIL_INLINE;else process.env.STATIC_DETAIL_INLINE=priorInline;
  }
});

test('static browser queries update filters and navigation without changing full-history CSV',async()=>{
  const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/security/KOSPI.000001/pbr?start=2026-10-01&end=2026-10-08'});
  const sources={
    '/pbr':table(['date','pbr','pbrState'],rows.map(row=>[row.date,row.pbr,row.pbrState])),
    '/bps':table(['date','bps'],rows.map(row=>[row.date,row.bps])),
    '/prices':table(['date','close','open','rate','volume'],[['2026-10-08','100','90',0,'9007199254740993']]),
  };
  const calls=[];
  const restore=replaceGlobals({window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true,fetch:async url=>{calls.push(url);return {ok:true,json:async()=>sources[url]};}});
  let mounted;
  try{
    const context=presentationLoader({'next/navigation':{
      useSearchParams:()=>new URLSearchParams(React.useSyncExternalStore(listener=>{window.addEventListener('popstate',listener);return()=>window.removeEventListener('popstate',listener);},()=>window.location.search,()=>'')),
    }});
    const surface=context.load('components/detail-surface.tsx');
    const {StaticDetailClient}=context.load('components/static-detail-client.tsx');
    const initial={...props,history:[],sourceHistory:[],initialAnalysis:surface.prepareDetailAnalysis(props)};
    const {createRoot}=require('react-dom/client');
    mounted=createRoot(document.getElementById('root'));
    await React.act(async()=>mounted.render(React.createElement(StaticDetailClient,{initial,assets:{metrics:{pbr:'/pbr',bps:'/bps'},prices:'/prices'}})));
    assert.equal(document.querySelector('input[name="start"]').value,'2026-10-01');
    assert.match(document.querySelector('#indicators').textContent,/실제 제공 2개/);
    assert.doesNotMatch(document.querySelector('#indicators').textContent,/999/);
    assert.deepEqual(context.csv().data.map(row=>[row.date,row.pbr,row.bps]),rows.map(row=>[row.date,row.pbr,row.bps]));
    const serialized=context.load('lib/csv/ranking.ts').serializeCsvRows(context.csv().data);
    assert.match(serialized,/9007199254740993/);assert.match(serialized,/2026-10-01,0,,provided/);
    await React.act(async()=>{window.history.pushState({},'', '?start=2026-02-30&end=2026-10-08');window.dispatchEvent(new window.PopStateEvent('popstate'));});
    assert.match(document.querySelector('[role="alert"]').textContent,/시작일과 종료일/);
    assert.equal(context.csv().data.length,3);
    await React.act(async()=>{window.history.pushState({},'',window.location.pathname);window.dispatchEvent(new window.PopStateEvent('popstate'));});
    assert.equal(document.querySelector('input[name="start"]').value,'');
    assert.equal(document.querySelector('[role="alert"]'),null);assert.match(document.querySelector('#indicators').textContent,/실제 제공 3개/);
    await React.act(async()=>new Promise(resolve=>{window.addEventListener('popstate',resolve,{once:true});window.history.back();}));
    assert.match(document.querySelector('[role="alert"]').textContent,/시작일과 종료일/);
    await React.act(async()=>new Promise(resolve=>{window.addEventListener('popstate',resolve,{once:true});window.history.back();}));
    assert.equal(document.querySelector('input[name="start"]').value,'2026-10-01');assert.match(document.querySelector('#indicators').textContent,/실제 제공 2개/);
    await React.act(async()=>new Promise(resolve=>{window.addEventListener('popstate',resolve,{once:true});window.history.forward();}));
    assert.match(document.querySelector('[role="alert"]').textContent,/시작일과 종료일/);
    assert.equal(calls.length,3,'date navigation reuses the same immutable assets');
  }finally{if(mounted)await React.act(async()=>mounted.unmount());restore();dom.window.close();}
});

test('one-observation company comparisons restore exact member values and missing coverage from shared aggregate history',()=>{
  const context=presentationLoader();
  const {restoreStaticCompanyHistory}=context.load('components/static-detail-client.tsx');
  const company={companyId:'company-one',securities:[{securityId:'one',name:'One',ticker:'ONE',marketcapHistory:[]},{securityId:'two',name:'Two',ticker:'TWO',marketcapHistory:[]}],aggregatedHistory:[],registeredHistory:[]};
  const observation={date:'2026-10-08',totalMarketcap:'9007199254740993',securitiesBreakdown:{one:'9007199254740993',two:null},observedCount:1,targetCount:2,observedSecurityIds:['one'],partial:true};
  const restored=restoreStaticCompanyHistory(company,[observation]);
  assert.equal(restored.securities[0].marketcapHistory[0].marketcap,'9007199254740993');assert.deepEqual(restored.securities[1].marketcapHistory,[]);
  const {DetailCompanyHistoryObservation}=context.load('components/detail-company-history-observation.tsx');
  const html=renderToStaticMarkup(React.createElement(DetailCompanyHistoryObservation,{data:restored,observation,count:1,selectedSecurityId:'two'}));
  assert.match(html,/9,007,199,254,740,993원/);assert.match(html,/선택한 종목의 이력이 이 날짜에 등록되어 있지 않습니다/);assert.match(html,/1\/2개 종목 관측/);
});

test('current comparison cards and both basic pages preserve exact rendered output after master projection for all seven metrics',()=>{
  const context=presentationLoader({'@/lib/data/detail-snapshot':{}});
  const {compactDetailProps}=context.load('components/restored-detail-page.tsx');
  const {DetailSurface}=context.load('components/detail-surface.tsx');
  const {InteractiveSecuritiesSection}=loader()('components/simple-interactive-securities.tsx');
  const corporation={companyId:'company-one',name:'Example Corporation',korName:'예시기업',logo:null,industry:'제조업',establishedDate:'2000-01-01',homepage:'https://example.com',resultSourceRef:'unused-source-reference'};
  const values={marketcap:'9007199254740993',per:'10',pbr:'2',bps:'0',eps:'-5',div:'1',dps:'100'};
  const member={...security,...values,company:corporation,prices:props.prices,marketcaps:[{date:'2026-10-08',marketcap:values.marketcap}]};
  const company={company:corporation,companyId:'company-one',routeCode:'KOSPI.000001',companyName:corporation.name,companyKorName:corporation.korName,state:'published',publication,totalMarketcap:values.marketcap,totalMarketcapDate:'2026-10-08',marketcapCompleteness:'complete',compositionComplete:true,compositionReason:null,compositionObservedCount:1,compositionTargetCount:1,securities:[{...member,marketcapDate:'2026-10-08',percentage:100,marketcapHistory:member.marketcaps}],aggregatedHistory:[],registeredHistory:[],resultSourceRef:'unused-company-source'};
  for(const metric of Object.keys(values)){
    const input={...props,metric,security:member,company,companySecs:[member]};
    const compact=compactDetailProps(input);
    const sectionProps={currentTicker:member.ticker,currentSecurityId:member.securityId,market:member.exchange,currentMetric:metric};
    const fullMarkup=renderToStaticMarkup(React.createElement(InteractiveSecuritiesSection,{...sectionProps,companyMarketcapData:company,companySecs:[member]}));
    const compactMarkup=renderToStaticMarkup(React.createElement(InteractiveSecuritiesSection,{...sectionProps,companyMarketcapData:compact.company,companySecs:compact.companySecs}));
    assert.equal(compactMarkup,fullMarkup,metric);
    assert.doesNotMatch(JSON.stringify(compact),/unused-source-reference|unused-company-source/);
  }
  for(const companyPage of [false,true]){
    const input={...props,basic:true,metric:'marketcap',companyPage,security:member,company,companySecs:[member]};
    assert.equal(renderToStaticMarkup(React.createElement(DetailSurface,compactDetailProps(input))),renderToStaticMarkup(React.createElement(DetailSurface,input)),companyPage?'company basic':'security basic');
  }
});

test('metric navigation remounts page state and reuses shared prices and previously visited immutable assets',async()=>{
  const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/security/KOSPI.000001/pbr'});
  const sources={
    '/pbr':table(['date','pbr','pbrState'],rows.map(row=>[row.date,row.pbr,row.pbrState])),
    '/bps':table(['date','bps'],rows.map(row=>[row.date,row.bps])),
    '/per':table(['date','per','perState'],[['2026-10-01','10','provided'],['2026-10-08','20','provided']]),
    '/eps':table(['date','eps'],[['2026-10-01','0'],['2026-10-08','-9007199254740993']]),
    '/prices':table(['date','close'],[['2026-10-08','100']]),
  };
  const calls=[];
  const restore=replaceGlobals({window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true,fetch:async url=>{calls.push(url);return {ok:true,json:async()=>sources[url]};}});
  let mounted;
  try{
    const context=presentationLoader({'next/navigation':{useSearchParams:()=>new URLSearchParams('')}});
    const {prepareDetailAnalysis}=context.load('components/detail-surface.tsx');
    const {StaticDetailClient}=context.load('components/static-detail-client.tsx');
    const initial={...props,history:[],sourceHistory:[],initialAnalysis:prepareDetailAnalysis(props)};
    const assets={metrics:{pbr:'/pbr',bps:'/bps',per:'/per',eps:'/eps'},prices:'/prices'};
    const {createRoot}=require('react-dom/client');mounted=createRoot(document.getElementById('root'));
    await React.act(async()=>mounted.render(React.createElement(StaticDetailClient,{key:'pbr',initial,assets})));
    assert.equal(context.csv().data.length,3);
    const perInitial={...initial,metric:'per',security:{...security,per:'20',perDate:'2026-10-08',perState:'provided'},initialAnalysis:undefined};
    await React.act(async()=>mounted.render(React.createElement(StaticDetailClient,{key:'per',initial:perInitial,assets})));
    assert.deepEqual(context.csv().data.map(row=>[row.per,row.eps]),[['10','0'],['20','-9007199254740993']]);
    assert.match(document.querySelector('#indicators').textContent,/실제 제공 2개/);
    await React.act(async()=>mounted.render(React.createElement(StaticDetailClient,{key:'pbr',initial,assets})));
    assert.deepEqual(context.csv().data.map(row=>row.pbr),['999','0','2']);
    assert.deepEqual(calls,['/pbr','/prices','/bps','/per','/eps']);
  }finally{if(mounted)await React.act(async()=>mounted.unmount());restore();dom.window.close();}
});
