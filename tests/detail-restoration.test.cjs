const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { JSDOM } = require('jsdom');
const { loader, pageLoader, renderToStaticMarkup } = require('./helpers/detail-presentation-loader.cjs');
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

test('the PER distribution median preserves decimal values and averages the middle pair', () => {
  assert.equal(analysis.medianBusinessValues(['12.5', null, '-3', '0']), '0');
  assert.equal(analysis.medianBusinessValues(['9007199254740994', '9007199254740993']), '9007199254740993.5');
  assert.equal(analysis.medianBusinessValues(['1.005', '1.004']), '1.0045');
  assert.equal(analysis.medianBusinessValues([null, 'invalid']), null);
});

test('dividend yield distributes provided observation days into exact half-point intervals', () => {
  const { DetailFinancialAnalysis } = load('components/restored-detail-charts.tsx');
  const rows = [
    { date: '2026-10-02', value: '-0.500000000000000001' },
    { date: '2026-10-03', value: '-0.5' },
    { date: '2026-10-04', value: '0' },
    { date: '2026-10-05', value: '0.499999999999999999' },
    { date: '2026-10-06', value: '0.25' },
    { date: '2026-10-06', value: '0.5' },
    { date: '2026-10-07', value: '1' },
    { date: '2026-10-08', value: '3', state: 'source_missing' },
    { date: '2026-10-09', value: null },
    { date: 'invalid', value: '4' },
  ];
  const render = records => JSDOM.fragment(renderToStaticMarkup(React.createElement(DetailFinancialAnalysis, {
    rows: records, metric: 'div', name: '종목', kind: 'distribution',
  })));
  const distribution = render(rows);
  assert.deepEqual([...distribution.querySelectorAll('tbody tr')].map(row => [...row.cells].map(cell => cell.textContent)), [
    ['−1% ~ −0.5%', '1일'], ['−0.5% ~ 0%', '1일'], ['0% ~ 0.5%', '2일'], ['0.5% ~ 1%', '1일'], ['1% ~ 1.5%', '1일'],
  ]);
  assert.deepEqual([...distribution.querySelectorAll('[aria-hidden="true"] > span')].map(bar => bar.style.inlineSize), ['50%', '50%', '100%', '50%', '50%']);
  assert.match(distribution.querySelector('figcaption').textContent, /2026-10-02 ~ 2026-10-07 · 실제 관측 6일/);
  const zeroOnly = render(rows.slice(2, 3));
  assert.equal(zeroOnly.querySelector('tbody tr').textContent, '0% ~ 0.5%1일');
  assert.match(render(rows.slice(-3)).querySelector('[role="status"]').textContent, /배당수익률 관측값이 없습니다/);
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

const publication={asOf:'2026-10-08'};
const security={securityId:'security-id',routeCode:null,name:'Test',korName:'테스트',ticker:'000001',exchange:'KOSPI',type:'보통주',state:'published',per:'10',perState:'provided',perDate:'2026-10-08',price:'100',priceState:'provided',priceDate:'2026-10-08',marketcap:'9007199254740993',publication,company:null};
const common={security,company:null,companySecs:[],ranking:{currentRank:1,rankDate:'2026-10-08'},neighbors:[],priceHistory:[],history:[{date:'2026-10-01',per:'0'},{date:'2026-10-08',per:'10'}]};
test('detail uses one snapshot, preserves rich sections and exports the full exact history despite selected range',async()=>{
  const page=pageLoader(common);
  const html=renderToStaticMarkup(await page.pages.RestoredSecurityDetail({code:'security-id',metric:'per',search:{start:'2026-10-08',end:'2026-10-08'}}));
  assert.equal(page.calls(),1);
  for(const text of ['PER 추이','과거 분포','기간별 평균','월별 기록','연도별 기록','전체 이력 CSV'])assert.ok(html.includes(text),text);
  assert.doesNotMatch(html, /input type="date"|순위 CSV/);
  assert.equal(page.csv().data.length,2);assert.equal(page.csv().data[0].per,'0');assert.equal(page.csv().data[1].per,'10');
  assert.equal(page.csv().label,'테스트 PER 전체 이력 CSV');assert.equal(page.csv().buttonText,'CSV');
});

test('metric change calls the prior observation the previous trading day only when its quote date matches',async()=>{
  const history=[{date:'2026-10-06',per:'8'},{date:'2026-10-08',per:'10'}];
  const quotes=[{date:'2026-10-06',close:'80'},{date:'2026-10-08',close:'100'}];
  const render=async priceHistory=>renderToStaticMarkup(await pageLoader({...common,history,priceHistory})
    .pages.RestoredSecurityDetail({code:'security-id',metric:'per'}));
  const previousTrade=JSDOM.fragment(await render(quotes)).querySelector('[data-prior-observation]');
  assert.match(previousTrade.textContent,/PER 전일 대비\+25%/);
  assert.equal(previousTrade.dataset.priorObservation,'2026-10-06');
  const previousValue=JSDOM.fragment(await render([quotes[0],{date:'2026-10-07',close:'85'},quotes[1]]))
    .querySelector('[data-prior-observation]');
  assert.match(previousValue.textContent,/PER 직전 제공값 대비\+25%/);
  assert.equal(previousValue.querySelector('time').dateTime,'2026-10-06');
});

test('unpublished detail never exposes a stale current metric or last provided result',async()=>{
  const page=pageLoader({...common,security:{...security,state:'unpublished',perLastProvided:'123'}});
  const html=renderToStaticMarkup(await page.pages.RestoredSecurityDetail({code:'security-id',metric:'per'}));
  assert.doesNotMatch(html,/현재 PER<[^>]*>10|마지막 제공값 123/);
  assert.match(html,/아직 공개된 종목 지표가 없습니다/);
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

test('annual change summaries use valid rates and compact records mark extremes across all rows', () => {
  const { DetailAnnualHistory } = load('components/restored-detail-charts.tsx');
  const render = (records, metric) => {
    const rows = helpers.detailAnnualRows(records.map(([date, value]) => ({ date, value })), metric);
    const page = JSDOM.fragment(renderToStaticMarkup(React.createElement(DetailAnnualHistory, {
      rows, label: metric.toUpperCase(), unit: helpers.DETAIL_METRICS[metric].unit, metric, yearEndOnly: metric === 'bps',
    })));
    const summary = page.querySelector('[aria-label="전년 대비 변화율 요약"]');
    if (summary) {
      const position = page.querySelector('table').compareDocumentPosition(summary);
      assert.ok(position & (metric === 'pbr' ? 2 : 4));
    }
    return summary;
  };
  const history = [
    ['2017-12-28', '10'], ['2018-12-28', '10'], ['2019-12-30', '15'], ['2020-12-30', '12'],
    ['2021-12-30', '0'], ['2022-12-29', '1'], ['2023-12-28', null], ['2025-12-30', '2'], ['2026-10-08', '6'],
  ];
  for (const metric of ['per', 'pbr', 'eps']) {
    const summary = render(history, metric);
    assert.deepEqual([...summary.querySelectorAll('dd')].map(node => node.textContent), ['+200% (2026년 연중)', '−100% (2021년)', '+26%']);
    const unchanged = render(history.slice(0, 2), metric);
    assert.deepEqual([...unchanged.querySelectorAll('dd')].map(node => node.textContent), ['없음', '없음', '0%']);
    assert.equal(render(history.slice(0, 1), metric), null);
  }
  for (const metric of ['bps', 'dps', 'div']) {
    const isBps = metric === 'bps';
    const markedMetric = metric === 'div' ? '수익률' : metric.toUpperCase();
    const summary = render(history, metric);
    assert.deepEqual([...summary.querySelectorAll('dd')].map(node => node.textContent), isBps
      ? ['+50% (2019년)', '−100% (2021년)', '−17.5%'] : ['+200% (2026년 연중)', '−100% (2021년)', '+26%']);
    const table = summary.parentElement.querySelector('table');
    const toggle = summary.parentElement.querySelector('button.annualRecordsToggle');
    assert.equal(table.tBodies[0].rows.length, 5);
    assert.equal(table.tBodies[1].rows.length, isBps ? 3 : 4);
    assert.equal(table.tBodies[1].id, toggle.getAttribute('aria-controls'));
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(toggle.textContent, `${isBps ? 3 : 4}개 연도 더 보기`);
    const highlights = [...table.querySelectorAll('.annualHighlight')].map(node => [node.closest('tr').querySelector('time').dateTime, node.textContent]);
    assert.deepEqual(highlights, isBps ? [
      ['2021-12-30', '최저 BPS'], ['2021-12-30', '최대 하락'], ['2019-12-30', '최고 BPS'], ['2019-12-30', '최대 상승'],
    ] : [
      ['2026-10-08', '최대 상승'], ['2021-12-30', `최저 ${markedMetric}`], ['2021-12-30', '최대 하락'], ['2019-12-30', `최고 ${markedMetric}`],
    ]);
  }
});

test('PER and PBR annual tables keep the source multiple and separate rates from unavailable comparisons',()=>{
  const {JSDOM}=require('jsdom');
  const {DetailAnnualHistory}=load('components/restored-detail-charts.tsx');
  for (const metric of ['per', 'pbr']) {
    const rows=helpers.detailAnnualRows([
      {date:'2019-12-30',value:null},
      {date:'2020-12-30',value:'5'},
      {date:'2021-12-30',value:'0'},
      {date:'2022-12-29',value:'1250.05'},
      {date:'2023-12-28',value:'1250.05'},
      {date:'2025-12-30',value:'10'},
      {date:'2026-10-08',value:'12.34'},
    ],metric);
    const label=metric.toUpperCase();
    const summaryBelow=metric==='per';
    const dom=new JSDOM(renderToStaticMarkup(React.createElement(DetailAnnualHistory,{rows,label,unit:'배',metric})));
    try {
      const document=dom.window.document;
      const table=document.querySelector('table');
      const statistics=document.querySelector('dl');
      assert.ok(statistics.compareDocumentPosition(table) & (summaryBelow?dom.window.Node.DOCUMENT_POSITION_PRECEDING:dom.window.Node.DOCUMENT_POSITION_FOLLOWING));
      assert.deepEqual([...statistics.querySelectorAll('dt')].map(el=>el.textContent),['평균','최저','최고','상승 · 하락 연도']);
      assert.deepEqual([...table.tHead.rows[0].cells].map(cell=>cell.textContent),['연도 / 관측일',label,'전년 대비','관측일']);
      const records=[...table.tBodies[0].rows];
      assert.equal(records.length, 7);
      assert.match(records[0].cells[0].textContent,/2026연중/);
      assert.equal(records[0].cells[1].textContent,'12.34배');
      assert.equal(records[0].cells[2].textContent,'+23.4%');
      assert.equal(records[0].querySelector('time').dateTime,'2026-10-08');
      assert.equal(table.tHead.rows[0].cells[3].scope,'col');
      assert.deepEqual(records.map(row=>Array.from(row.querySelectorAll('time'),time=>time.dateTime)),
        rows.map(row=>[row.date,row.date]));
      const gap=records[1].cells[2];
      assert.match(cellDescription(gap),/인접한 전년 관측값이 없어/);
      assert.equal(records[2].cells[2].textContent,'0%');
      assert.equal(records[3].cells[1].textContent,'1,250.05배');
      assert.equal(visibleValue(records[3].cells[2]),'+1,250.05배');
      assert.equal(records[4].cells[1].textContent,'0배');
      assert.equal(visibleValue(records[6].cells[1]),'—');
    } finally {dom.window.close();}
  }
});

test('financial annual records show a single table with local notes and the actual year count',()=>{
  const {DetailAnnualHistory}=load('components/restored-detail-charts.tsx');
  const {FinancialAnnualMetadata}=load('components/detail-annual-table.tsx');
  const observations=[
    {date:'2019-12-30',value:'2'},
    {date:'2021-12-30',value:'0'},
    {date:'2022-12-29',value:'0'},
    {date:'2023-12-28',value:'-3'},
    {date:'2024-12-30',value:'2'},
    {date:'2025-12-30',value:null},
    {date:'2026-10-08',value:'10'},
  ];
  for (const [metric,label,unit,differenceUnit] of [['per','PER','배','배'],['dps','주당배당금','원','원'],['div','배당수익률','%','%p']]) {
    const rows=helpers.detailAnnualRows(observations,metric);
    const document=JSDOM.fragment(renderToStaticMarkup(React.createElement(React.Fragment,null,
      React.createElement(FinancialAnnualMetadata,{count:rows.length}),
      React.createElement(DetailAnnualHistory,{rows,label,unit,metric}))));
    const table=document.querySelector('table');
    const records=[...table.querySelectorAll('tbody tr')];
    assert.equal(document.querySelectorAll('table').length,1);
    assert.equal(table.tHead.rows[0].cells.length,4);
    assert.equal(records[0].cells[0].querySelector('time').dateTime,'2026-10-08');
    assert.match(records[0].cells[0].textContent,/2026.*연중/);
    assert.equal(document.querySelectorAll('ul,ol').length,0);
    assert.match(document.textContent,/7개 연도/);
    const lookupNote=button=>document.getElementById(button.getAttribute('aria-describedby'));
    assert.match(lookupNote(document.querySelector('button')).textContent,/각 연도의 마지막 관측값/);
    const exceptions=records.slice(2,5).map(row=>row.cells[2].querySelector('button'));
    assert.deepEqual(exceptions.map(button=>button.textContent),['+5'+differenceUnit,'−3'+differenceUnit,'0'+differenceUnit]);
    exceptions.forEach(button=>assert.match(lookupNote(button).textContent,/전년 값이 0 이하라 변화율을 계산할 수 없어/));
    for (const [index,reason] of [[0,/전년 값이 미제공/],[1,/현재 값이 미제공/],[5,/인접한 전년 관측값이 없어/],[6,/전년 관측값이 없습니다/]]) {
      const button=records[index].cells[2].querySelector('button');
      assert.equal(button.textContent,'—');
      assert.match(lookupNote(button).textContent,reason);
    }
  }
});

test('EPS and BPS annual records show one exact won amount and preserve the source observation date',()=>{
  const {JSDOM}=require('jsdom');
  const {DetailAnnualHistory}=load('components/restored-detail-charts.tsx');
  const {FinancialAnnualMetadata}=load('components/detail-annual-table.tsx');
  const observations=[
    {date:'2022-12-29',value:'-9007199254740993'},
    {date:'2023-12-28',value:'0'},
    {date:'2024-12-12',value:'40123'},
    {date:'2024-12-30',value:null,state:'source_missing'},
    {date:'2025-12-30',value:'57951',observedCount:1,targetCount:2},
    {date:'2026-10-08',value:'6605'},
  ];
  for (const metric of ['eps','bps']) {
    const rows=helpers.detailAnnualRows(observations,metric);
    const label=metric.toUpperCase();
    const yearEndOnly=metric==='bps';
    const html=renderToStaticMarkup(React.createElement(React.Fragment,null,
      React.createElement(FinancialAnnualMetadata,{count:rows.length,yearEndOnly}),
      React.createElement(DetailAnnualHistory,{rows,label,unit:'원',metric,yearEndOnly})));
    const dom=new JSDOM(html);
    try {
      const document=dom.window.document;
      const table=document.querySelector('table');
      const records=[...table.tBodies[0].rows];
      assert.equal(document.querySelectorAll('table').length,1);
      assert.ok(table.compareDocumentPosition(document.querySelector('dl')) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
      assert.deepEqual([...table.tHead.rows[0].cells].map(cell=>cell.textContent),['연도 / 관측일',label,'전년 대비','관측일']);
      assert.deepEqual(records.map(row=>row.cells[3].querySelector('time').dateTime), rows.map(row=>row.date));
      assert.equal(records.length,yearEndOnly?4:5);
      assert.match(records[0].cells[0].textContent,yearEndOnly?/^20252025-12-30$/:/2026.*연중/);
      assert.equal(records[0].cells[1].firstChild.textContent,yearEndOnly?'57,951원':'6,605원');
      assert.equal(records[0].cells[0].querySelector('time').dateTime,yearEndOnly?'2025-12-30':'2026-10-08');
      if(yearEndOnly) assert.match(cellDescription(document.querySelector('[class*="headerMetadata"]')),/12월 마지막 관측값/);
      const missing=records.find(row=>row.querySelector('time').dateTime.startsWith('2024'));
      assert.equal(visibleValue(missing.cells[1]),'—');
      assert.match(cellDescription(missing.cells[1]),yearEndOnly?/마지막 12월 관측일.*미제공/:/관측값 미제공/);
      assert.equal(missing.querySelector('time').dateTime,'2024-12-30');
      const covered=records.find(row=>row.querySelector('time').dateTime.startsWith('2025'));
      assert.match(covered.cells[1].textContent,/1\/2개 관측/);
      assert.match(cellDescription(covered.cells[2]),/전년 값이 미제공/);
      const zero=records.find(row=>row.querySelector('time').dateTime.startsWith('2023'));
      assert.equal(visibleValue(zero.cells[1]),'0원');
      assert.equal(visibleValue(zero.cells[2]),'+9,007,199,254,740,993원');
      assert.equal(records.at(-1).cells[1].firstChild.textContent,'−9,007,199,254,740,993원');
    } finally {dom.window.close();}
  }
});

function visibleValue(cell) {
  return (cell.querySelector('button') ?? cell).textContent;
}

function cellDescription(cell) {
  return cell.ownerDocument.getElementById(cell.querySelector('button').getAttribute('aria-describedby')).textContent;
}

test('PBR differences and EPS and BPS averages use the provided source observations', () => {
  const { PeriodStats } = load('components/detail-period-stats.tsx');
  const basis = '2026-11-20';
  const source = [
    { date: '2026-01-02', value: '0', state: 'provided' },
    { date: '2026-10-08', value: '-6' },
    { date: basis, value: null, state: 'source_missing' },
  ];
  for (const metric of ['pbr', 'eps', 'bps']) {
    const fragment = JSDOM.fragment(renderToStaticMarkup(React.createElement(PeriodStats, {
      analysis: { means: helpers.periodMeans(source, basis), summary: analysis.summarizeBusinessWindow(source), analysisEnd: basis },
      metric, info: helpers.DETAIL_METRICS[metric], companyPage: false, basis, currentValue: '0',
    })));
    const headers = [...fragment.querySelector('thead tr').cells].map(cell => cell.textContent);
    assert.deepEqual(headers, metric === 'pbr' ? ['기간', '평균 PBR', '현재 − 평균'] : ['기간', '평균값', '관측 수']);
    const record = fragment.querySelector('tbody tr');
    assert.deepEqual([...record.cells].slice(1).map(cell => cell.textContent), metric === 'pbr' ? ['−3배', '+3배'] : ['−3원', '2개']);
    assert.equal(record.querySelector('time').dateTime, '2026-10-08');
    assert.match(fragment.textContent, /실제 관측 2개/);
    assert.doesNotMatch(fragment.textContent, /2026-11-20/);
  }
});

test('annual dividend comparisons identify each preferred stock by the annual observation date and keep the separate prior-year rate',()=>{
  const {JSDOM}=require('jsdom');
  const {DetailAnnualHistory}=load('components/restored-detail-charts.tsx');
  const {FinancialAnnualMetadata}=load('components/detail-annual-table.tsx');
  const pairs=[{securityId:'preferred',label:'우선주 000002'},{securityId:'special',label:'우선주 000003'}];
  const rows=helpers.detailAnnualRows([
    {date:'2000-12-30',value:'0'}, {date:'2024-12-30',value:'-1'}, {date:'2025-12-30',value:'1'}, {date:'2026-10-08',value:'1.5'},
  ],'div');
  const byDate={
    '2026-10-08':{preferred:'0.22',special:'0'},
    '2025-12-30':{preferred:'-0.25',special:null},
    '2024-12-27':{preferred:'1',special:'2'},
  };
  const props={rows,dividendComparison:{commonName:'보통주',pairs,byDate}};
  for (const [metric,label,unit,differenceUnit] of [['div','배당수익률','%','%p'],['dps','주당배당금','원','원']]) {
    const dom=new JSDOM(renderToStaticMarkup(React.createElement(React.Fragment,null,
      React.createElement(FinancialAnnualMetadata,{count:rows.length,dividendComparison:props.dividendComparison}),
      React.createElement(DetailAnnualHistory,{...props,label,unit,metric}))));
    try {
      const {document}=dom.window;
      const table=document.querySelector('table');
      assert.match(document.getElementById(document.querySelector('button').getAttribute('aria-describedby')).textContent,/최근 5년 중 같은 날의 관측값/);
      assert.deepEqual([...table.tHead.rows[0].cells].map(cell=>cell.textContent),
        ['연도 / 관측일',label,'전년 대비','우선주 − 보통주 '+differenceUnit,'관측일']);
      const records=[...table.tBodies[0].rows];
      assert.deepEqual(records.map(row=>row.cells[4].querySelector('time').dateTime), rows.map(row=>row.date));
      assert.match(records[0].cells[0].textContent,/2026.*연중/);
      assert.equal(records[0].cells[1].firstChild.textContent,metric==='dps'?'2원':'1.5%');
      assert.match(records[0].cells[1].textContent,/1\.5/);
      assert.equal(records[0].cells[2].firstChild.textContent,'+50%');
      assert.equal(records[0].querySelector('time').dateTime,'2026-10-08');
      assert.deepEqual([...records[0].cells[3].querySelectorAll('dt')].map(node=>node.textContent),pairs.map(pair=>pair.label));
      assert.equal(visibleValue(records[0].cells[3].querySelector('[data-security-id="preferred"] dd')),(metric==='dps'?'+0.2':'+0.22')+differenceUnit);
      assert.equal(records[0].cells[3].querySelector('[data-security-id="special"] dd').textContent,'0'+differenceUnit);
      assert.equal(visibleValue(records[1].cells[3].querySelector('[data-security-id="preferred"] dd')),(metric==='dps'?'−0.3':'−0.25')+differenceUnit);
      assert.equal(records[1].cells[3].querySelector('[data-security-id="special"] dd').textContent,'—같은 날 비교값 없음');
      assert.match(records[2].cells[1].textContent,new RegExp('^[−-]1'+unit));
      for (const unavailable of records.slice(2)) {
        assert.deepEqual([...unavailable.cells[3].querySelectorAll('dd')].map(node=>node.textContent),['—같은 날 비교값 없음','—같은 날 비교값 없음']);
      }
    } finally {dom.window.close();}
  }
});

test('annual dividend rows show named comparisons inline and disclose precise values by touch',async()=>{
  const {JSDOM}=require('jsdom');
  const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost'});
  const previous=new Map();
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true})){
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  }
  let mounted;
  try {
    const {createRoot}=require('react-dom/client');
    const {DetailAnnualHistory}=load('components/restored-detail-charts.tsx');
    const pairs=[{securityId:'preferred',label:'우선주 000002'},{securityId:'special',label:'우선주 000003'}];
    const rows=helpers.detailAnnualRows([
      {date:'2024-12-30',value:'0'}, {date:'2025-12-30',value:'1'}, {date:'2026-10-08',value:'2.00001'},
    ],'dps');
    const byDate={'2026-10-08':{preferred:'1',special:'-1'}};
    mounted=createRoot(document.getElementById('root'));
    const render=chosen=>React.act(async()=>mounted.render(React.createElement(DetailAnnualHistory,{
      rows,label:'주당배당금',metric:'dps',unit:'원',dividendComparison:{commonName:'보통주',pairs:chosen,byDate},
    })));

    await render(pairs);
    const table=document.querySelector('table');
    const first=table.tBodies[0].rows[0];
    assert.equal(first.cells[0].querySelector('time').dateTime,'2026-10-08');
    assert.equal(first.cells[1].querySelector('button').textContent,'2원');
    assert.equal(first.cells[2].firstChild.textContent,'+100%');
    assert.match(first.cells[3].textContent,/우선주 000002\+1원.*우선주 000003−1원/);
    assert.equal(document.querySelectorAll('ul').length,0);
    const control=first.cells[1].querySelector('button');
    const exact=document.getElementById(control.getAttribute('aria-describedby'));
    assert.equal(exact.textContent,'원값 2.00001원');
    await React.act(async()=>control.click());
    assert.equal(control.getAttribute('aria-expanded'),'true');
    await React.act(async()=>control.click());
    assert.equal(control.getAttribute('aria-expanded'),'false');

    await render(pairs.slice(0,1));
    assert.equal(first.cells[3].querySelector('dt').className,'sr-only');
    assert.equal(first.cells[3].querySelector('dd').textContent,'+1원');
    const exception=table.tBodies[0].rows[1].cells[2].querySelector('button');
    assert.equal(exception.textContent,'+1원');
    assert.match(document.getElementById(exception.getAttribute('aria-describedby')).textContent,/전년 값이 0 이하/);
  } finally {
    if(mounted)await React.act(async()=>mounted.unmount());
    for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
    dom.window.close();
  }
});

test('marketcap annual records group dates, preserve legitimate coverage and disclose exact amounts at any width',async()=>{
  const {JSDOM}=require('jsdom');
  const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost'});
  const previous=new Map();
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true})){
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  }
  let mounted;
  try {
    const {createRoot}=require('react-dom/client');
    const {DetailAnnualHistory}=load('components/restored-detail-charts.tsx');
    const rows=helpers.detailAnnualRows([
      {date:'2022-12-30',value:'150000000000',targetCount:2},
      {date:'2023-12-28',value:null,observedCount:0,targetCount:2,observedSecurityIds:[]},
      {date:'2024-12-30',value:'0',observedCount:1,targetCount:2,observedSecurityIds:['common']},
      {date:'2025-12-30',value:'1687385008678000',observedCount:2,targetCount:2,observedSecurityIds:['common','preferred']},
      {date:'2026-10-08',value:'9007199254740993',observedCount:1,targetCount:2,observedSecurityIds:['preferred']},
    ],'marketcap');
    mounted=createRoot(document.getElementById('root'));
    await React.act(async()=>mounted.render(React.createElement(DetailAnnualHistory,{rows,label:'등록 종목 합계',metric:'marketcap',unit:'원'})));
    const table=document.querySelector('table');
    assert.match(table.caption.textContent,/연도별 등록 종목 합계 및 전년 대비 변화율.*등록 종목을 합산합니다/);
    assert.deepEqual([...table.tHead.rows[0].cells].map(cell=>cell.textContent),['연도 / 관측일','등록 종목 합계','전년 대비','관측일']);
    const records=[...table.tBodies[0].rows];
    assert.match(records[0].cells[0].textContent,/2026.*연중/);
    assert.equal(records[0].querySelector('summary > span').textContent,'9,007조 1,993억 원');
    assert.match(records[0].cells[1].textContent,/1\/2개 관측 · 일부/);
    assert.match(records[0].cells[2].textContent,/^—관측 종목이 달라/);
    assert.equal(records[0].querySelector('.inlineObservationDate').dateTime,'2026-10-08');
    assert.equal(records[0].querySelector('.observationDateColumn time').dateTime,'2026-10-08');
    assert.match(records[1].cells[1].textContent,/1,687조 3,850억 원.*2\/2개 관측/);
    assert.match(records[2].cells[1].textContent,/0원1\/2개 관측/);
    assert.match(records[3].cells[1].textContent,/^—0\/2개 관측/);
    assert.equal(records[4].querySelector('summary > span').textContent,'1,500억 원');
    assert.equal(records[4].querySelector('.annualCoverage'),null);

    assert.equal(document.querySelectorAll('table').length,1);
    const details=records[0].querySelector('details');
    assert.equal(details.open,false);
    await React.act(async()=>details.querySelector('summary').click());
    assert.equal(details.open,true);
    assert.equal(details.querySelector('strong').textContent,'9,007,199,254,740,993원');
    assert.equal((records[0].textContent.match(/1\/2개 관측/g)??[]).length,1);

    const stockRows=helpers.detailAnnualRows([{date:'2026-10-08',value:'155660013382000'}],'marketcap');
    await React.act(async()=>mounted.render(React.createElement(DetailAnnualHistory,{rows:stockRows,label:'시가총액',metric:'marketcap',unit:'원'})));
    assert.equal(document.querySelector('thead tr').cells[1].textContent,'종목 시총');
    assert.doesNotMatch(document.querySelector('table').textContent,/개 관측/);
    assert.equal(document.querySelector('tbody summary').textContent,'155조 6,600억 원');
    assert.equal(document.querySelector('tbody details strong').textContent,'155,660,013,382,000원');
  } finally {
    if(mounted)await React.act(async()=>mounted.unmount());
    for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
    dom.window.close();
  }
});

test('annual closing prices show exact won amounts and retain the previous summary statistics', () => {
  const { JSDOM } = require('jsdom');
  const { DetailAnnualHistory } = load('components/restored-detail-charts.tsx');
  const rows = helpers.detailAnnualRows([
    {date:'2023-12-28',value:'130000'},
    {date:'2024-12-30',value:'0'},
    {date:'2025-12-30',value:'200000'},
    {date:'2026-10-08',value:'262000'},
  ]);
  const render = (metric) => JSDOM.fragment(renderToStaticMarkup(React.createElement(DetailAnnualHistory, {rows,label:'종가',unit:'원',metric})));
  const view = render('price');
  const table = view.querySelector('table');
  assert.equal(view.querySelectorAll('table').length,1);
  assert.deepEqual([...table.tHead.rows[0].cells].map(cell=>cell.textContent),['연도 / 관측일','종가','전년 대비','관측일']);
  const [current, previous, zero] = table.tBodies[0].rows;
  assert.match(current.cells[0].textContent,/2026.*연중/);
  assert.equal(current.cells[1].textContent,'262,000원');
  assert.equal(current.cells[2].textContent,'+31.0%');
  assert.equal(current.querySelector('.inlineObservationDate').dateTime,'2026-10-08');
  assert.equal(current.querySelector('.observationDateColumn time').dateTime,'2026-10-08');
  assert.equal(zero.cells[1].textContent,'0원');
  assert.match(previous.cells[2].textContent,/이전 값이 0\/음수라 증감률 계산 불가.*\+200,000원/);
  assert.equal(view.querySelector('dl').textContent,render(undefined).querySelector('dl').textContent);
  assert.ok(table.compareDocumentPosition(view.querySelector('dl')) & 4);
});

test('invalid ranges suppress all analysis charts while official snapshots stay visible',async()=>{
  const company={companyId:'company-id',companyName:'Test',companyKorName:'테스트',state:'published',publication,totalMarketcap:'100',totalMarketcapDate:'2026-10-08',securities:[]};
  const page=pageLoader({...common,company});
  const html=renderToStaticMarkup(await page.pages.RestoredSecurityDetail({code:'security-id',metric:'marketcap',search:{start:'2026-02-30',end:'2026-10-08'}}));
  assert.equal(page.charts.length,0);assert.match(html,/role="alert"/);assert.match(html,/9,007,199,254,740,993원/);
});


test('detail presents its public asOf once and omits repeated publication metadata at the bottom',async()=>{
  const page=pageLoader({...common,security:{...security,publication:{asOf:'2026-10-08',revision:'9007199254740993',scopeKey:'krx-all'}}});
  const html=renderToStaticMarkup(await page.pages.RestoredSecurityDetail({code:'security-id',metric:'per'}));
  assert.equal((html.match(/공개 기준일/g) ?? []).length,1);assert.match(html,/공개 기준일 2026-10-08/);
  assert.doesNotMatch(html,/조회 기준 · 자료 공개 정보|자료 갱신번호|9007199254740993|지표 설명 · 계산식/);
});
