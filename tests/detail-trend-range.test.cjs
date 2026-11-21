const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { JSDOM } = require('jsdom');
const { loader, renderToStaticMarkup } = require('./helpers/detail-presentation-loader.cjs');

function chartLoader() {
  const rendered = [];
  const empty = () => null;
  const recharts = Object.fromEntries(['Area','Bar','CartesianGrid','Line','ReferenceLine','Tooltip','XAxis','YAxis'].map(name => [name,empty]));
  recharts.getNiceTickValues = require('recharts').getNiceTickValues;
  recharts.ResponsiveContainer = ({children}) => children;
  recharts.ComposedChart = ({data,children}) => {
    rendered.push(data);
    return React.createElement('div',{'data-testid':'rendered-chart'},children);
  };
  const { DetailHistoryChart } = loader({recharts})('components/detail-history-chart.tsx');
  return { Chart:DetailHistoryChart, rendered };
}

function stats(document) {
  return Object.fromEntries([...document.querySelectorAll('dl[aria-label="표시 관측 통계"] > div')].map(row => [row.querySelector('dt').textContent,row.querySelector('dd').textContent]));
}

const annualRows = [
  {date:'2022-12-30',value:'10'},
  {date:'2023-12-28',value:'20'},
  {date:'2024-12-30',value:'30'},
  {date:'2025-12-30',value:'40'},
  {date:'2026-10-08',value:'50'},
];

async function withMountedChart(run) {
  const dom = new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
  const saved = new Map();
  for (const [key,value] of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})) {
    saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  }
  const { createRoot } = require('react-dom/client');
  const root = createRoot(dom.window.document.getElementById('root'));
  const { Chart, rendered } = chartLoader();
  const container = dom.window.document.getElementById('root');
  const render = async props => React.act(async () => root.render(React.createElement(Chart,{withStatistics:true,...props})));
  const click = async label => {
    const button = [...container.querySelectorAll('button')].find(node => node.textContent === label);
    assert.ok(button,label);
    await React.act(async () => button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
  };
  try { await run({container,document:dom.window.document,rendered,render,click}); }
  finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    for (const [key,descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis,key,descriptor);
      else delete globalThis[key];
    }
  }
}

test('an explicit BPS window keeps every actual December year end inside the query instead of clipping to the latest year',async()=>{
  await withMountedChart(async({document,container,rendered,render})=>{
    await render({rows:annualRows,label:'BPS',unit:'원',metric:'bps',annual:true,customRange:true,selectedStart:'2023-01-01',selectedEnd:'2026-10-08'});
    assert.deepEqual(rendered.at(-1).map(row=>row.date),['2023-12-28','2024-12-30','2025-12-30']);
    assert.equal(container.querySelectorAll('button').length,0);
    assert.match(container.textContent,/직접 지정 기간 2023-01-01 ~ 2026-10-08/);
    assert.deepEqual(stats(document),{'평균':'30원','최저':'20원','최고':'40원'});
    assert.match(container.querySelector('[aria-live="polite"]').textContent,/2025년 연말 40원.*2025-12-30/);
    assert.match(container.querySelector('figcaption').textContent,/각 연도의 12월 마지막 관측 · 3개 연말 중 3개 제공/);
    assert.equal(container.querySelectorAll('dl[aria-label="표시 관측 통계"]').length,1);
  });
});

test('an explicit DPS window retains provided amounts throughout the requested dates instead of applying the 12 month preset',async()=>{
  await withMountedChart(async({document,container,rendered,render})=>{
    await render({rows:annualRows,label:'DPS',unit:'원',metric:'dps',customRange:true,selectedStart:'2023-01-01',selectedEnd:'2026-10-08'});
    assert.deepEqual(rendered.at(-1).map(row=>[row.date,row.value]),annualRows.slice(1).map(row=>[row.date,row.value]));
    assert.equal(container.querySelectorAll('button').length,0);
    assert.deepEqual(stats(document),{'평균':'35원','최저':'20원','최고':'50원'});
    assert.match(container.querySelector('figcaption').textContent,/4개 기록/);
  });
});

test('an end-only explicit window does not impose an unstated BPS or DPS preset',async()=>{
  await withMountedChart(async({render,rendered})=>{
    for (const metric of ['bps','dps']) {
      await render({rows:annualRows,label:metric.toUpperCase(),unit:'원',metric,annual:metric==='bps',customRange:true,selectedEnd:'2024-12-30'});
      assert.deepEqual(rendered.at(-1).map(row=>row.date),['2022-12-30','2023-12-28','2024-12-30']);
    }
  });
});

test('statistics follow the last monthly values and yearly means while retaining zero and negative records',async()=>{
  await withMountedChart(async({container,document,render,rendered,click})=>{
    const rows = [
      {date:'2026-07-01',value:'10'}, {date:'2026-07-29',value:'20'},
      {date:'2026-07-30',value:null,state:'source_missing'}, {date:'2026-08-15',value:'0'},
      {date:'2026-09-10',value:'-6'}, {date:'2026-10-01',value:null},
    ];
    await render({rows,label:'PER',unit:'배',metric:'per'});
    assert.deepEqual(rendered.at(-1).map(row=>row.value),['20','0','-6',null]);
    assert.equal(rendered.at(-1)[0].date,'2026-07-29');
    assert.match(document.querySelector('figcaption').textContent, /각 월의 마지막 제공값 · 3개 \/ 원천 관측 4개/);
    assert.deepEqual(stats(document),{'평균':'4.67배','최저':'−6배','최고':'20배'});
    await click('연간');
    assert.deepEqual(rendered.at(-1).map(row=>row.value),['6']);
    assert.deepEqual(stats(document),{'평균':'6배','최저':'6배','최고':'6배'});
    assert.match(container.querySelector('figcaption').textContent,/각 연도 제공 관측의 산술평균 · 1개/);
  });
});

test('metric changes keep a valid active control and statistics for the resulting plot rather than a foreign preset',async()=>{
  await withMountedChart(async({container,document,render,rendered,click})=>{
    await render({rows:annualRows,label:'PER',unit:'배',metric:'per'});
    await click('연간');
    assert.deepEqual([...container.querySelectorAll('button[aria-pressed="true"]')].map(button => button.textContent),['5년','연간']);
    await render({rows:annualRows,label:'DPS',unit:'원',metric:'dps'});
    assert.equal(container.querySelector('button[aria-pressed="true"]').textContent,'12개월');
    assert.deepEqual(rendered.at(-1).map(row=>row.date),['2025-12-30','2026-10-08']);
    assert.equal(stats(document)['평균'],'45원');
    await click('20년');
    assert.match(container.querySelector('figcaption').textContent,/5개 기록/);
    await render({rows:annualRows,label:'BPS',unit:'원',metric:'bps',annual:true});
    assert.equal(container.querySelector('button[aria-pressed="true"]').textContent,'최근 5개 연말');
    assert.deepEqual(rendered.at(-1).map(row=>row.date),annualRows.slice(0,4).map(row=>row.date));
    assert.match(container.querySelector('figcaption').textContent,/4개/);
    await render({rows:annualRows,label:'PER',unit:'배',metric:'per'});
    assert.deepEqual([...container.querySelectorAll('button[aria-pressed="true"]')].map(button => button.textContent),['5년','월간']);
    assert.match(container.querySelector('figcaption').textContent,/5개/);
  });
});

test('statistics preserve exact large source values and render unavailable values without turning missing into zero',()=>{
  const { Chart }=chartLoader();
  for (const [rows,expected] of [
    [[{date:'2026-10-01',value:'9007199254740993'}],'9,007,199,254,740,993원'],
    [[{date:'2026-10-01',value:null}],'—'],
    [[],'—'],
  ]) {
    const dom=new JSDOM(renderToStaticMarkup(React.createElement(Chart,{rows,label:'EPS',unit:'원',metric:'eps',withStatistics:true})));
    try {
      if (expected === '—') {
        assert.deepEqual(stats(dom.window.document),{});
        assert.match(dom.window.document.querySelector('[role="status"]').textContent,/제공된 관측값이 없습니다/);
      } else {
        assert.deepEqual(stats(dom.window.document),{'평균':expected,'최저':expected,'최고':expected});
        assert.match(dom.window.document.querySelector('figcaption').textContent,/9,007,199,254,740,993원/);
      }
    } finally {dom.window.close();}
  }
});

test('optional statistics stay out of existing price and marketcap charts',()=>{
  const { Chart }=chartLoader();
  const html=renderToStaticMarkup(React.createElement(Chart,{rows:annualRows,label:'종가',unit:'원',metric:'marketcap'}));
  assert.doesNotMatch(html,/표시 관측 통계/);
});

test('a security marketcap chart starts with five monthly years and can switch to the latest three months or all observations',async()=>{
  await withMountedChart(async({container,render,rendered,click})=>{
    const rows=[{date:'2024-10-08',value:'9007199254740993'},{date:'2026-07-07',value:'23'},
      {date:'2026-07-08',value:null},{date:'2026-10-08',value:'0'}];
    const props={rows,label:'시가총액',unit:'원',metric:'marketcap'};
    await render(props);
    assert.equal(container.querySelector('[aria-pressed="true"]').textContent,'5년');
    assert.deepEqual(rendered.at(-1).map(row=>[row.date,row.value]),[rows[0],rows[1],rows[3]].map(row=>[row.date,row.value]));
    await click('최근 3개월');
    assert.deepEqual(rendered.at(-1).map(row=>[row.date,row.value]),rows.slice(2).map(row=>[row.date,row.value]));
    await click('전체');
    assert.deepEqual(rendered.at(-1).map(row=>[row.date,row.value]),rows.map(row=>[row.date,row.value]));
    await render({...props,selectedStart:'2026-07-07',selectedEnd:'2026-10-08',customRange:true});
    assert.equal(container.querySelectorAll('button').length,0);
    assert.deepEqual(rendered.at(-1).map(row=>row.date),rows.slice(1).map(row=>row.date));
    await render({...props,rows:[{date:'2026-10-08',value:'151112380466932.2581'}]});
    assert.match(stats(container)['평균'],/151조 1,124억 원.*정확한 원값 151,112,380,466,932\.2581원/s);
  });
});

test('a missing final December BPS observation remains unavailable instead of backfilling an earlier December or October value',async()=>{
  await withMountedChart(async({container,document,rendered,render})=>{
    const rows=[
      {date:'2025-10-08',value:'50000'},
      {date:'2025-12-01',value:'51000'},
      {date:'2025-12-30',value:null,state:'source_missing'},
    ];
    await render({rows,label:'BPS',unit:'원',metric:'bps',annual:true});
    assert.equal(rendered.length,0,'no invented observation should reach the chart');
    assert.match(container.querySelector('[role="status"]').textContent,/이 기간에 표시할 연말 BPS 제공값이 없습니다\./);
    assert.match(container.querySelector('[aria-live="polite"]').textContent,/2025년 연말 미제공.*2025-12-30/);
    assert.match(container.textContent,/각 연도의 12월 마지막 관측 · 1개 연말 중 0개 제공/);
    assert.deepEqual(stats(document),{});
  });
});

test('BPS presets count consecutive December slots without calling an earlier provided value the latest year end',async()=>{
  await withMountedChart(async({container,render,rendered,click})=>{
    const rows = [
      {date:'2010-12-30',value:'8'}, {date:'2020-12-30',value:'20'}, {date:'2021-12-30',value:null}, {date:'2022-12-29',value:'0'},
      {date:'2024-12-27',value:'50'}, {date:'2025-12-02',value:'60'}, {date:'2025-12-30',value:null}, {date:'2026-10-08',value:'70'},
    ];
    await render({rows,label:'BPS',unit:'원',metric:'bps',annual:true,selectedEnd:'2026-10-08'});
    assert.deepEqual(rendered.at(-1).map(row=>row.date), ['2021-12-30','2022-12-29','2023-01-01','2024-12-27','2025-12-30']);
    assert.match(container.querySelector('[aria-live="polite"]').textContent,/2025년 연말 미제공.*2025-12-30/);
    assert.match(container.querySelector('figcaption').textContent,/5개 연말 중 2개 제공/);
    await click('최근 연말');
    assert.match(container.querySelector('[aria-live="polite"]').textContent,/2025년 연말 미제공.*2025-12-30/);
    assert.match(container.textContent,/1개 연말 중 0개 제공/);
    await click('20년');
    assert.equal(rendered.at(-1)[0].date, '2010-12-30');
    assert.equal(rendered.at(-1).at(-1).date, '2025-12-30');
  });
});

test('PER, PBR, EPS and DIV default to the recent five years and can show all observations',async()=>{
  await withMountedChart(async({container,render,rendered,click})=>{
    const rows = [
      {date:'2014-12-31',value:'2'}, {date:'2021-10-01',value:'3'}, {date:'2021-10-08',value:'4'},
      {date:'2026-10-08',value:'7'},
    ];
    for (const metric of ['per','pbr','eps','div']) {
      await render({rows,label:metric.toUpperCase(),unit:'원',metric,selectedEnd:'2026-10-08'});
      const dates = () => rendered.at(-1).filter(row => row.value != null).map(row => row.date);
      assert.deepEqual(dates(), ['2021-10-08','2026-10-08']);
      await click('전체');
      assert.deepEqual(dates(), ['2014-12-31','2021-10-08','2026-10-08']);
      await click('연간');
      assert.deepEqual(dates(), ['2014-12-31','2021-10-08','2026-10-08']);
      await render({rows,label:metric.toUpperCase(),unit:'원',metric,selectedEnd:'2021-10-08',customRange:true});
      assert.deepEqual(dates(), ['2014-12-31','2021-10-08']);
      assert.equal(container.querySelector(`[aria-label="${metric.toUpperCase()} 표시 기간"]`),null);
    }
  });
});

test('yearly ratio histories preserve an out-of-range year as a visual gap without creating an observation',async()=>{
  await withMountedChart(async({container,render,rendered,click})=>{
    const rows=[{date:'2023-12-29',value:'-2.21'},{date:'2025-12-30',value:'0'}];
    await render({rows,label:'PBR',unit:'배',metric:'pbr'});
    await click('연간');
    assert.deepEqual(rendered.at(-1).map(({ date, value, plot }) => ({ date, value, plot })), [
      {date:'2023-12-29',value:'-2.21',plot:0},
      {date:'2024-01-01',value:null,plot:null},
      {date:'2025-12-30',value:'0',plot:1},
    ]);
    assert.match(container.querySelector('figcaption').textContent,/각 연도 제공 관측의 산술평균 · 2개/);
  });
});

test('chart SVG waits for proximity while statistics and controls are available on the initial HTML',async()=>{
  await withMountedChart(async({container,render,rendered})=>{
    let onIntersect;
    let disconnects = 0;
    window.IntersectionObserver = class {
      constructor(callback, options) { onIntersect = callback; assert.equal(options.rootMargin, '320px 0px'); }
      observe() {}
      disconnect() { disconnects++; }
    };
    const props = { rows:annualRows, label:'PER', unit:'배', metric:'per' };
    const { Chart } = chartLoader();
    const html = renderToStaticMarkup(React.createElement(Chart, {...props, withStatistics:true}));
    assert.match(html,/5년/);
    assert.match(html,/표시 관측 통계/);
    assert.doesNotMatch(html,/rendered-chart/);
    const initial = new JSDOM(html);
    try {
      const page = initial.window.document;
      const periods = page.querySelector('[aria-label="PER 표시 기간"]');
      const units = page.querySelector('[aria-label="PER 집계 단위"]');
      assert.equal(periods.parentElement, units.parentElement);
      assert.equal(periods.firstElementChild.textContent, '기간');
      assert.equal(units.firstElementChild.textContent, '집계');
      assert.equal(page.querySelector('figure').nextElementSibling, page.querySelector('dl[aria-label="표시 관측 통계"]'));
      assert.match(page.querySelector('figure').textContent,/단위 배/);
    } finally { initial.window.close(); }
    await render(props);
    assert.match(container.textContent,/차트 준비 중/);
    assert.equal(rendered.length, 0);
    await React.act(async()=>onIntersect([{isIntersecting:false}]));
    assert.equal(rendered.length, 0);
    await React.act(async()=>onIntersect([{isIntersecting:true}]));
    assert.equal(rendered.length, 1);
    assert.ok(disconnects > 0);
  });
});

test('PER distribution publishes exact threshold counts and annual history lists all years in initial HTML',()=>{
  const { DetailAnnualHistory, DetailFinancialAnalysis } = loader()('components/restored-detail-charts.tsx');
  const rows = [
    {date:'2024-01-01',value:'-3'}, {date:'2024-02-01',value:'0'},
    {date:'2024-02-02',value:'9007199254740992'}, {date:'2024-02-03',value:'9007199254740993'},
    {date:'2024-02-04',value:'wrong'}, {date:'2024-02-05',value:'1',state:'source_missing'},
  ];
  const html = renderToStaticMarkup(React.createElement(DetailFinancialAnalysis,{rows,metric:'per',name:'회사',kind:'distribution',currentValue:'9007199254740992'}));
  const dom = new JSDOM(html);
  try {
    const content = dom.window.document.body.textContent;
    assert.match(content,/2024-01-01 ~ 2024-02-03 · 실제 제공 4개/);
    assert.match(content,/현재 PER 9,007,199,254,740,992배 이하 75% \(3\/4 관측일\)/);
    assert.doesNotMatch(html,/<details/);
  } finally { dom.window.close(); }
  const years = Array.from({length:8},(_,i)=>({date:`${2011+i}-12-30`,value:String(i)}));
  const table = new JSDOM(renderToStaticMarkup(React.createElement(DetailAnnualHistory,{rows:years,label:'PER',unit:'배'})));
  try {
    assert.equal(table.window.document.querySelectorAll('tbody tr').length, 8);
    assert.match(table.window.document.querySelector('tbody').textContent,/2011-12-30/);
    assert.doesNotMatch(table.window.document.body.textContent,/연도 모두 보기/);
  } finally { table.window.close(); }
});

test('BPS distribution and monthly records reserve plot space and describe only provided observations', () => {
  const { DetailFinancialAnalysis } = loader()('components/restored-detail-charts.tsx');
  const rows = [
    { date: '2024-01-01', value: '9007199254740993' },
    { date: '2024-01-31', value: '0' },
    { date: '2024-02-28', value: '-5' },
    { date: '2024-02-29', value: null, state: 'source_missing' },
  ];
  const fragment = JSDOM.fragment(renderToStaticMarkup(React.createElement(DetailFinancialAnalysis, { rows, metric: 'bps', name: '회사' })));
  for (const variant of ['monthly', 'distribution']) {
    assert.ok(fragment.querySelector('[data-chart="' + variant + '"] [data-variant="' + variant + '"]'));
  }
  assert.match(fragment.textContent, /2024-01-31 ~ 2024-02-28 · 2개월/);
  assert.match(fragment.textContent, /2024-01-01 ~ 2024-02-28 · 실제 제공 3개/);
});
