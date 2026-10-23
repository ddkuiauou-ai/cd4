const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { JSDOM } = require('jsdom');
const { loader, renderToStaticMarkup } = require('./helpers/detail-presentation-loader.cjs');

function chartLoader() {
  const rendered = [];
  const empty = () => null;
  const recharts = Object.fromEntries(['Area','Bar','CartesianGrid','Line','Tooltip','XAxis','YAxis'].map(name => [name,empty]));
  recharts.ResponsiveContainer = ({children}) => children;
  recharts.ComposedChart = ({data,children}) => {
    rendered.push(data);
    return React.createElement('div',{'data-testid':'rendered-chart'},children);
  };
  const { DetailHistoryChart } = loader({recharts})('components/detail-history-chart.tsx');
  return { Chart:DetailHistoryChart, rendered };
}

function stats(document) {
  return Object.fromEntries([...document.querySelectorAll('.detail-trend-statistics dl > div')].map(row => [row.querySelector('dt').textContent,row.querySelector('dd').textContent]));
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
    assert.equal(container.querySelectorAll('.detail-trend-controls button').length,0);
    assert.match(container.textContent,/직접 지정 기간 2023-01-01 ~ 2026-10-08/);
    assert.deepEqual(stats(document),{'마지막 표시값':'40원','평균':'30원','최저':'20원','최고':'40원','관측 수':'3개'});
    assert.match(container.querySelector('.detail-trend-statistics-basis').textContent,/마지막 12월 제공값/);
    assert.equal(container.querySelectorAll('#trend-statistics').length,1);
  });
});

test('an explicit DPS window retains provided amounts throughout the requested dates instead of applying the 12 month preset',async()=>{
  await withMountedChart(async({document,container,rendered,render})=>{
    await render({rows:annualRows,label:'DPS',unit:'원',metric:'dps',customRange:true,selectedStart:'2023-01-01',selectedEnd:'2026-10-08'});
    assert.deepEqual(rendered.at(-1).map(row=>[row.date,row.value]),annualRows.slice(1).map(row=>[row.date,row.value]));
    assert.equal(container.querySelectorAll('.detail-trend-controls button').length,0);
    assert.deepEqual(stats(document),{'마지막 표시값':'50원','평균':'35원','최저':'20원','최고':'50원','관측 수':'4개'});
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

test('statistics follow the plotted monthly and yearly means while retaining real zero and negative records',async()=>{
  await withMountedChart(async({document,render,rendered,click})=>{
    const rows=[{date:'2026-07-01',value:'10'},{date:'2026-07-30',value:'20'},{date:'2026-08-15',value:'0'},{date:'2026-09-10',value:'-6'},{date:'2026-10-01',value:null}];
    await render({rows,label:'PER',unit:'배',metric:'per'});
    assert.deepEqual(rendered.at(-1).map(row=>row.value),['15','0','-6',null]);
    assert.deepEqual(stats(document),{'마지막 표시값':'-6배','평균':'3배','최저':'-6배','최고':'15배','관측 수':'3개'});
    await click('연간');
    assert.deepEqual(rendered.at(-1).map(row=>row.value),['6']);
    assert.deepEqual(stats(document),{'마지막 표시값':'6배','평균':'6배','최저':'6배','최고':'6배','관측 수':'1개'});
  });
});

test('metric changes keep a valid active control and statistics for the resulting plot rather than a foreign preset',async()=>{
  await withMountedChart(async({container,document,render,rendered,click})=>{
    await render({rows:annualRows,label:'PER',unit:'배',metric:'per'});
    await click('연간');
    assert.equal(container.querySelector('button[aria-pressed="true"]').textContent,'연간');
    await render({rows:annualRows,label:'DPS',unit:'원',metric:'dps'});
    assert.equal(container.querySelector('button[aria-pressed="true"]').textContent,'12개월');
    assert.deepEqual(rendered.at(-1).map(row=>row.date),['2025-12-30','2026-10-08']);
    assert.equal(stats(document)['평균'],'45원');
    await click('20년');
    assert.equal(stats(document)['관측 수'],'5개');
    await render({rows:annualRows,label:'BPS',unit:'원',metric:'bps',annual:true});
    assert.equal(container.querySelector('button[aria-pressed="true"]').textContent,'20년');
    assert.deepEqual(rendered.at(-1).map(row=>row.date),annualRows.slice(0,4).map(row=>row.date));
    assert.equal(stats(document)['관측 수'],'4개');
    await render({rows:annualRows,label:'PER',unit:'배',metric:'per'});
    assert.equal(container.querySelector('button[aria-pressed="true"]').textContent,'월간');
    assert.equal(stats(document)['관측 수'],'5개');
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
      assert.equal(stats(dom.window.document)['마지막 표시값'],expected);
      assert.equal(stats(dom.window.document)['평균'],expected);
      assert.equal(stats(dom.window.document)['관측 수'],expected==='—'?'0개':'1개');
    } finally {dom.window.close();}
  }
});

test('optional statistics do not add a duplicate anchor to existing price or marketcap charts',()=>{
  const { Chart }=chartLoader();
  const html=renderToStaticMarkup(React.createElement(Chart,{rows:annualRows,label:'종가',unit:'원',metric:'marketcap'}));
  assert.doesNotMatch(html,/id="trend-statistics"|표시 관측 통계/);
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
    assert.match(container.textContent,/선택 원천 관측 2025-10-08 ~ 2025-12-01 · 2개 기록/);
    assert.deepEqual(stats(document),{'마지막 표시값':'—','평균':'—','최저':'—','최고':'—','관측 수':'0개'});
  });
});
