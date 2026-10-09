const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
function loader(stubs = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const mod = new Module(file); cache.set(file, mod); mod.paths = Module._nodeModulePaths(path.dirname(file));
    mod.require = name => {
      const resolvedName = name.startsWith('.') ? '@/' + path.relative(root,path.resolve(path.dirname(file),name)) : name;
      if (resolvedName in stubs) return stubs[resolvedName];
      if (name === 'next/link') return ({children,prefetch,...props}) => { void prefetch; return React.createElement('a',props,children); };
      if (name === 'next/navigation') return {notFound:()=>{throw Error('not-found')},usePathname:()=>'/security/security-id/per'};
      const local = resolvedName.startsWith('@/') ? path.join(root,resolvedName.slice(2)) : null;
      if (!local) return require(name);
      const found = [local,local+'.ts',local+'.tsx'].find(file=>fs.existsSync(file)&&fs.statSync(file).isFile());
      assert.ok(found,resolvedName);return load(found);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
    return mod.exports;
  }
  return file=>load(path.join(root,file));
}
const load = loader();
const helpers = load('lib/detail-presentation.ts');
const analysis = load('lib/business-analysis.ts');

test('provided financial observations retain real zero and negatives and missing stays null',()=>{
  const rows=helpers.detailObservations([
    {date:'2026-01-01',eps:'0',epsState:'provided'},
    {date:'2026-01-02',eps:'-100',epsState:'provided'},
    {date:'2026-01-03',eps:null,epsState:'source_missing'},
    {date:'invalid',eps:'200'},
  ],'eps');
  assert.deepEqual(rows.map(row=>row.value),['0','-100',null]);
  assert.equal(analysis.summarizeBusinessWindow(rows).mean,'-50');
  const per=load('lib/per-utils.ts').processPERData([{date:'2026-01-01',per:10,eps:null},{date:'2026-01-02',per:0,eps:0}]);
  assert.deepEqual(per.map(row=>[row.value,row.eps]),[[10,null],[0,0]]);
});

test('monthly means carry raw observation counts and exact large strings',()=>{
  const raw=[{date:'2026-01-01',value:'9007199254740993'},{date:'2026-01-02',value:'9007199254740995'},{date:'2026-02-01',value:null}];
  const result=helpers.aggregateDetailRows(raw,'month');
  assert.equal(result[0].value,'9007199254740994');assert.equal(result[0].providedCount,2);
  assert.equal(result[1].value,null);assert.equal(result[1].providedCount,0);
  assert.equal(analysis.summarizeBusinessWindow(raw).count,2);
});

test('annual change requires adjacent years, positive prior value and identical observed cohort',()=>{
  const annual=helpers.detailAnnualRows([
    {date:'2020-12-30',value:'100',observedSecurityIds:['a']},
    {date:'2021-12-30',value:'200',observedSecurityIds:['a']},
    {date:'2022-12-30',value:'300',observedSecurityIds:['a','b']},
    {date:'2024-12-30',value:'400',observedSecurityIds:['a','b']},
    {date:'2025-11-30',value:'999'},
  ],'bps');
  assert.deepEqual(annual.map(row=>row.date.slice(0,4)),['2024','2022','2021','2020']);
  assert.equal(annual[2].changeRate,100);assert.equal(annual[0].changeRate,undefined);assert.equal(annual[1].changeRate,undefined);
  assert.equal(helpers.detailAnnualRows([{date:'2024-12-31',value:'0'},{date:'2025-12-31',value:'10'}])[0].changeRate,undefined);
  assert.equal(helpers.earlierDate('2024-03-31',1),'2024-02-29');
});

test('annual comparisons keep real zero rates and exact differences only for a non-positive provided prior',()=>{
  const comparison=(prior,current)=>helpers.detailAnnualRows([
    {date:'2024-12-30',value:'100',...prior},
    {date:'2025-12-30',value:'100',...current},
  ])[0];
  const unchanged=comparison({},{});
  assert.equal(unchanged.changeRate,0);assert.equal(unchanged.comparisonReason,undefined);assert.equal(unchanged.difference,undefined);
  const zeroPrior=comparison({value:'0'},{value:'10'});
  assert.equal(zeroPrior.changeRate,undefined);assert.equal(zeroPrior.difference,'10');assert.equal(zeroPrior.comparisonReason,'non_positive_previous');
  const negativePrior=comparison({value:'-9007199254740993'},{value:'2'});
  assert.equal(negativePrior.difference,'9007199254740995');assert.equal(negativePrior.changeRate,undefined);
  const unchangedZero=comparison({value:'0'},{value:'0'});
  assert.equal(unchangedZero.difference,'0');assert.equal(unchangedZero.changeRate,undefined);
  const cases=[
    [{date:'2023-12-30'}, {}, 'non_adjacent_year'],
    [{value:null}, {}, 'missing_previous'],
    [{value:'100',state:'source_missing'}, {}, 'missing_previous'],
    [{}, {value:null}, 'missing_current'],
    [{}, {value:'100',state:'source_missing'}, 'missing_current'],
    [{observedSecurityIds:['a']}, {observedSecurityIds:['a','b']}, 'cohort_changed'],
  ];
  for(const [prior,current,reason] of cases){
    const row=comparison(prior,current);
    assert.equal(row.comparisonReason,reason);assert.equal(row.changeRate,undefined);assert.equal(row.difference,undefined);
  }
  const first=helpers.detailAnnualRows([{date:'2025-12-30',value:'100'}])[0];
  assert.equal(first.comparisonReason,'no_previous_year');assert.equal(first.changeRate,undefined);assert.equal(first.difference,undefined);
  const reordered=comparison({observedSecurityIds:['a','b']},{observedSecurityIds:['b','a']});
  assert.equal(reordered.changeRate,0,'the same observed cohort remains comparable regardless of ID order');
});

test('annual table renders exact non-positive-prior differences and individual comparison reasons on desktop and mobile expansion',async()=>{
  const {JSDOM}=require('jsdom');
  const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost'});
  const previous=new Map();
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true})){
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  }
  let mounted;
  try{
    const {createRoot}=require('react-dom/client');
    const {DetailAnnualTable}=load('components/detail-annual-table.tsx');
    const rows=helpers.detailAnnualRows([
      {date:'2020-12-30',value:'100'},
      {date:'2021-12-30',value:'100'},
      {date:'2023-12-30',value:'-9007199254740993'},
      {date:'2024-12-30',value:'2'},
    ]);
    mounted=createRoot(document.getElementById('root'));
    await React.act(async()=>mounted.render(React.createElement(DetailAnnualTable,{rows,label:'등록 종목 합계',formatValue:value=>analysis.formatCompactBusinessValue(value)+'원',formatDetailValue:value=>analysis.formatBusinessValue(value)+'원'})));
    const desktopRows=[...document.querySelectorAll('tbody tr')];
    assert.match(desktopRows[0].children[2].textContent,/차이 \+9,007,199,254,740,995원/);
    assert.match(desktopRows[0].children[2].textContent,/이전 값이 0\/음수라 증감률 계산 불가/);
    assert.match(desktopRows[1].children[2].textContent,/인접한 전년 관측값/);
    assert.equal(desktopRows[2].children[2].textContent,'0.0%');
    assert.match(desktopRows[3].children[2].textContent,/전년 관측값이 없습니다/);
    const firstMobile=document.querySelector('ul li');
    assert.doesNotMatch(firstMobile.textContent,/9,007,199,254,740,995/);
    await React.act(async()=>firstMobile.querySelector('button').click());
    assert.equal(firstMobile.querySelector('button').getAttribute('aria-expanded'),'true');
    assert.match(firstMobile.textContent,/전년 대비 차이 \+9,007,199,254,740,995원/);
    assert.match(firstMobile.textContent,/이전 값이 0\/음수라 증감률 계산 불가/);
    await React.act(async()=>firstMobile.querySelector('button').click());
    assert.equal(firstMobile.querySelector('button').getAttribute('aria-expanded'),'false');
    assert.doesNotMatch(firstMobile.textContent,/9,007,199,254,740,995/);
  }finally{
    if(mounted)await React.act(async()=>mounted.unmount());
    dom.window.close();
    for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
  }
});

test('actual OHLC excludes close-only records and keeps nine preceding observations for complete moving averages',()=>{
  const rows=Array.from({length:20},(_,i)=>({date:`2026-01-${String(i+1).padStart(2,'0')}`,open:String(100+i),high:String(102+i),low:String(99+i),close:String(101+i),volume:'9007199254740993'}));
  rows.push({date:'2026-02-01',close:'200'});
  const candles=helpers.actualCandlesticks(rows,'2026-01-15','2026-01-20');
  assert.equal(candles.length,15);assert.equal(candles.filter(row=>row.warmupOnly).length,9);
  assert.equal(candles.find(row=>!row.warmupOnly).time,'2026-01-15');
  assert.equal(candles[0].source.volume,'9007199254740993');
  assert.equal(helpers.actualCandlesticks([{date:'2026-01-01',close:'100'}]).length,0);
  assert.equal(helpers.actualCandlesticks([{date:'2026-01-01',open:'100',high:'90',low:'80',close:'95'}]).length,0);
});

test('composition requires backend completeness, positive total and same-date supplied members',()=>{
  const company={totalMarketcap:'100',totalMarketcapDate:'2026-10-08',marketcapCompleteness:'complete',compositionComplete:true,securities:[{marketcap:'100',marketcapDate:'2026-10-08'}]};
  assert.equal(helpers.validComposition(company),true);
  assert.equal(helpers.validComposition({...company,compositionComplete:false}),false);
  assert.equal(helpers.validComposition({...company,securities:[{marketcap:'100',marketcapDate:'2026-10-07'}]}),false);
});

function pageLoader(snapshot){
  let calls=0;let downloaded;const charts=[];
  const empty=()=>null;
  const named=keys=>Object.fromEntries(keys.map(key=>[key,empty]));
  const stubs={
    '@/lib/data/detail-snapshot':{getSecurityDetailSnapshot:async()=>{calls++;return snapshot},getCompanyDetailSnapshot:async()=>{calls++;return snapshot}},
    '@/components/sticky-company-header':{StickyCompanyHeader:props=>React.createElement('h1',null,props.displayName,props.titleSuffix,props.detail?.value)},
    '@/components/company-financial-tabs':named(['CompanyFinancialTabs']),
    '@/components/detail-mobile-navigation':named(['DetailMobileNavigation']),
    '@/components/recent-security-tracker':named(['RecentSecurityTracker']),
    '@/components/recent-securities-sidebar':named(['RecentSecuritiesSidebar']),
    '@/components/page-navigation':named(['PageNavigation']),
    '@/components/detail-metric-facts':named(['DetailMetricFacts']),
    '@/components/simple-interactive-securities':named(['InteractiveSecuritiesSection']),
    '@/components/interactive-chart-section':{InteractiveChartSection:props=>{charts.push(props);return null}},
    '@/components/detail-history-chart':named(['DetailHistoryChart']),
    '@/components/restored-detail-charts':named(['DetailFinancialAnalysis','DetailPriceHistory','DetailAnnualHistory']),
    '@/components/card-company-marketcap':{__esModule:true,default:empty},
    '@/components/CsvDownloadButton':{CsvDownloadButton:props=>{downloaded=props;return React.createElement('button',null,props.label)}},
    '@/components/share-button':{__esModule:true,default:empty},
    '@/components/header-rank':{__esModule:true,default:props=>React.createElement('p',null,'current ',props.marketcap)},
  };
  return {pages:loader(stubs)('components/restored-detail-page.tsx'),calls:()=>calls,csv:()=>downloaded,charts};
}
const publication={asOf:'2026-10-08'};
const security={securityId:'security-id',routeCode:null,name:'Test',korName:'테스트',ticker:'000001',exchange:'KOSPI',type:'보통주',state:'published',per:'10',perState:'provided',perDate:'2026-10-08',price:'100',priceState:'provided',priceDate:'2026-10-08',marketcap:'9007199254740993',publication,company:null};
const common={security,company:null,companySecs:[],ranking:{currentRank:1,rankDate:'2026-10-08'},neighbors:[],priceHistory:[],history:[{date:'2026-10-01',per:'0'},{date:'2026-10-08',per:'10'}]};
test('detail uses one snapshot, preserves rich sections and exports the full exact history despite selected range',async()=>{
  const page=pageLoader(common);
  const html=renderToStaticMarkup(await page.pages.RestoredSecurityDetail({code:'security-id',metric:'per',search:{start:'2026-10-08',end:'2026-10-08'}}));
  assert.equal(page.calls(),1);
  for(const text of ['차트 분석','핵심 지표','연도별 데이터','기간 직접 지정','전체 이력 CSV','전체 제공 이력'])assert.ok(html.includes(text),text);
  assert.equal(page.csv().data.length,2);assert.equal(page.csv().data[0].per,'0');assert.equal(page.csv().data[1].per,'10');
});

test('unpublished detail never exposes a stale current metric or last provided result',async()=>{
  const page=pageLoader({...common,security:{...security,state:'unpublished',perLastProvided:'123'}});
  const html=renderToStaticMarkup(await page.pages.RestoredSecurityDetail({code:'security-id',metric:'per'}));
  assert.doesNotMatch(html,/현재 PER<[^>]*>10|마지막 제공값 123/);
  assert.ok(html.includes('current </p>'));
});

test('company without a common stock retains master metadata and exact registered CSV with coverage',async()=>{
  const company={companyId:'company-id',routeCode:null,companyName:'Test Corporation',companyKorName:'테스트기업',state:'published',publication,totalMarketcap:'9007199254740993',totalMarketcapDate:'2026-10-08',company:{industry:'제조업',homepage:'https://example.com',establishedDate:'2000-01-01'},securities:[{securityId:'one',ticker:'DUP',korName:'우선주'}]};
  const history=[{date:'2026-10-08',totalMarketcap:'9007199254740993',securitiesBreakdown:{one:'9007199254740993'},observedCount:1,targetCount:2,observedSecurityIds:['one'],partial:true}];
  const page=pageLoader({...common,security:null,company,history});
  const html=renderToStaticMarkup(await page.pages.RestoredCompanyDetail({code:'company-id',basic:true}));
  assert.match(html,/제조업/);assert.match(html,/example.com/);assert.match(html,/2000-01-01/);
  renderToStaticMarkup(await page.pages.RestoredCompanyDetail({code:'company-id'}));
  const csv=page.csv().data[0];assert.equal(csv['등록 종목 합계'],'9007199254740993');assert.equal('totalMarketcap' in csv,false);
  const serialized=load('lib/csv/ranking.ts').serializeCsvRows(page.csv().data);assert.match(serialized.split('\n')[0],/등록 종목 합계/);assert.match(serialized,/9007199254740993/);assert.equal(csv.observedCount,1);assert.equal(csv.targetCount,2);
  assert.ok(Object.keys(csv).some(header=>header.includes('one')));
});


test('closing-price moving averages use all raw closes despite missing OHLC and require complete windows',()=>{
  const rows=Array.from({length:11},(_,index)=>({date:`2026-10-${String(index+1).padStart(2,'0')}`,close:String(index+1),open:index===7?null:String(index+1)}));
  const result=helpers.priceMovingAverages(rows,'2026-10-11','2026-10-11');
  assert.equal(result[0].average5,'9');assert.equal(result[0].average10,'6.5');
  assert.equal(helpers.priceMovingAverages(rows.slice(0,4))[3].average5,null);
  rows[9].close=null;assert.equal(helpers.priceMovingAverages(rows).at(-1).average5,null);
});

test('non-BPS annual rows keep the last real observation and mark a partial latest year as YTD',()=>{
  const rows=[{date:'2024-12-30',value:'100'},{date:'2025-10-08',value:'120'}];
  const year=helpers.detailAnnualRows(rows,'per');assert.equal(year[0].date,'2025-10-08');assert.equal(year[0].yearToDate,true);assert.equal(year[0].changeRate,20);
  assert.deepEqual(helpers.detailAnnualRows(rows,'bps').map(row=>row.date),['2024-12-30']);
  assert.equal(helpers.aggregateDetailRows([rows[1]],'year')[0].date,'2025-10-08','annual averaging cannot invent a future December date');
});

test('invalid ranges suppress all analysis charts while official snapshots stay visible',async()=>{
  const company={companyId:'company-id',companyName:'Test',companyKorName:'테스트',state:'published',publication,totalMarketcap:'100',totalMarketcapDate:'2026-10-08',securities:[]};
  const page=pageLoader({...common,company});
  const html=renderToStaticMarkup(await page.pages.RestoredSecurityDetail({code:'security-id',metric:'marketcap',search:{start:'2026-02-30',end:'2026-10-08'}}));
  assert.equal(page.charts.length,0);assert.match(html,/role="alert"/);assert.match(html,/current 9007199254740993/);
});


test('detail exposes its public asOf, revision and scope in a compact source explanation',async()=>{
  const page=pageLoader({...common,security:{...security,publication:{asOf:'2026-10-08',revision:'9007199254740993',scopeKey:'krx-all'}}});
  const html=renderToStaticMarkup(await page.pages.RestoredSecurityDetail({code:'security-id',metric:'per'}));
  assert.match(html,/조회 기준 · 자료 공개 정보/);assert.match(html,/공개 기준일/);assert.match(html,/2026-10-08/);assert.match(html,/자료 갱신번호/);assert.match(html,/9007199254740993/);assert.match(html,/한국거래소 전체 \(krx-all\)/);assert.match(html,/원천의 실제 관측 이력/);
});
