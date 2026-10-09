const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { readFileSync, existsSync } = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');

function loadPresentation() {
  const loaded = new Map();
  const renderedCharts = [];
  function load(filename) {
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const mod = new Module(filename);
    loaded.set(filename, mod);
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = name => {
      if (name.startsWith('.')) name = `@/${path.relative(root, path.resolve(path.dirname(filename), name))}`;
      const chart = {
        '@/components/chart-company-marketcap': 'summary',
        '@/components/chart-marketcap': 'detailed',
      }[name];
      if (chart) return { __esModule: true, default: props => {
        renderedCharts.push({ chart, data: props.data, sourceValues: props.sourceValues, coverage: props.coverage, axisFormat: props.axisFormat });
        return React.createElement('div', { 'data-chart': chart });
      } };
      if (name === '@/components/chart-a11y-description') return { __esModule: true, default: () => null };
      if (!name.startsWith('@/')) return require(name);
      const local = path.join(root, name.slice(2));
      const resolved = [`${local}.ts`, `${local}.tsx`].find(existsSync);
      assert.ok(resolved, `Local module not found: ${name}`);
      return load(resolved);
    };
    const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    });
    mod._compile(outputText, filename);
    return mod.exports;
  }
  return {
    Chart: load(path.join(root, 'components/interactive-chart-section.tsx')).InteractiveChartSection,
    Header: load(path.join(root, 'components/header-rank.tsx')).default,
    renderedCharts,
  };
}

function companyHistory() {
  const latestDate = '2026-10-02';
  const observation = { date: latestDate, totalMarketcap: 1_775_000_000_000_000,
    securitiesBreakdown: { common: 1_740_000_000_000_000, preferred: 35_000_000_000_000, missing: 0, zero: 0 } };
  const security = (id, name, type, value) => ({ securityId: id, name, korName: name, type, ticker: id,
    marketcap: 549_000_000_000_000, marketcapDate: '2025-09-22', percentage: 0,
    marketcapHistory: value === null ? [] : [{ date: latestDate, marketcap: value }] });
  return { companyId: 'company', companyName: '테스트기업', companyKorName: '테스트기업',
    totalMarketcap: 549_000_000_000_000, totalMarketcapDate: '2025-09-22',
    securities: [security('common', '테스트기업', '보통주', observation.securitiesBreakdown.common),
      security('preferred', '테스트기업우', '우선주', observation.securitiesBreakdown.preferred),
      security('missing', '미등록종목', '우선주', null), security('zero', '영값종목', '우선주', 0)],
    aggregatedHistory: [observation] };
}

test('one real history date renders exact observation values and a single point', () => {
  const { Chart, renderedCharts } = loadPresentation();
  const data = companyHistory();
  const original = JSON.stringify(data);
  const html = renderToStaticMarkup(React.createElement(Chart, { companyMarketcapData: data, companySecs: [], type: 'summary' }));
  assert.match(html, /이력 기준 2026-10-02 · 기록 1개/);
  assert.match(html, /추이를 그릴 이력이 부족합니다/);
  assert.match(html, /1,775,000,000,000,000원/);
  assert.match(html, /1,740,000,000,000,000원/);
  assert.doesNotMatch(html, /549조/);
  const rows = [...new JSDOM(html).window.document.querySelectorAll('dl > div')];
  assert.match(rows.find(row => row.textContent.includes('미등록종목')).textContent, /미등록$/);
  assert.match(rows.find(row => row.textContent.includes('영값종목')).textContent, /0원/);
  assert.ok(renderedCharts.length > 0);
  assert.equal(JSON.stringify(data), original);
});

test('the three-month filter can leave one date and still renders the compact observation state', () => {
  const { Chart, renderedCharts } = loadPresentation();
  const data = companyHistory();
  data.aggregatedHistory.unshift({ date: '2025-09-22', totalMarketcap: 549_000_000_000_000, securitiesBreakdown: {} });
  const html = renderToStaticMarkup(React.createElement(Chart, { companyMarketcapData: data, companySecs: [], type: 'summary' }));
  assert.match(html, /기록 1개/);
  assert.doesNotMatch(html, /2025-09-22/);
  assert.ok(renderedCharts.length > 0);
});

test('sparse history keeps exact security selection, including same-name preferred stock, recorded zero and missing values', () => {
  const { Chart, renderedCharts } = loadPresentation();
  const data = companyHistory();
  data.securities[1].korName = data.securities[3].korName = '같은우선주';
  for (const selectedSecurityId of ['preferred', 'zero', 'missing']) {
    const html = renderToStaticMarkup(React.createElement(Chart, {
      companyMarketcapData: data, companySecs: [], type: 'summary', selectedType: '우선주', selectedSecurityId,
    }));
    const document = new JSDOM(html).window.document;
    const rows = [...document.querySelectorAll('dl > div')];
    const selected = rows.filter(row => row.dataset.selected === 'true');
    assert.equal(selected.length, 1);
    assert.equal(selected[0].dataset.historySecurity, selectedSecurityId);
    assert.equal(rows[0], selected[0], 'selected observation must lead the fallback, ahead of the company total');
    assert.match(selected[0].querySelector('dt').textContent, /선택 종목/);
    assert.match(selected[0].querySelector('dt').textContent, new RegExp(selectedSecurityId));
    const expectedValue = selectedSecurityId === 'zero' ? /0원/ : selectedSecurityId === 'missing' ? /미등록/ : /35,000,000,000,000원/;
    assert.match(selected[0].querySelector('dd').textContent, expectedValue);
    assert.equal(rows.find(row => row.dataset.historySecurity === 'aggregate').dataset.selected, 'false');
    assert.match(rows.find(row => row.dataset.historySecurity === 'aggregate').textContent, /기업 합산 비교/);
    if (selectedSecurityId === 'missing') assert.match(html, /선택한 종목의 이력이 이 날짜에 등록되어 있지 않습니다/);
  }
  const absentHtml = renderToStaticMarkup(React.createElement(Chart, {
    companyMarketcapData: data, companySecs: [], type: 'summary', selectedSecurityId: 'absent-security',
  }));
  assert.match(absentHtml, /선택한 종목의 이력이 이 날짜에 등록되어 있지 않습니다/);
  assert.equal(new JSDOM(absentHtml).window.document.querySelectorAll('[data-selected="true"]').length, 0);
  assert.ok(renderedCharts.every(chart => chart.data.length === 1), 'a single point must not fabricate extra dates');
});

test('multiple recorded dates retain exact sources alongside normalized chart coordinates', () => {
  const { Chart, renderedCharts } = loadPresentation();
  const data = companyHistory();
  data.aggregatedHistory.unshift({ date: '2026-09-30', totalMarketcap: 1_700_000_000_000_000,
    securitiesBreakdown: { common: 1_670_000_000_000_000, preferred: 30_000_000_000_000 } });
  const html = renderToStaticMarkup(React.createElement(Chart, { companyMarketcapData: data, companySecs: [], type: 'summary' }));
  assert.match(html, /이력 범위 2026-09-30 ~ 2026-10-02 · 기록 2개/);
  assert.match(html, /마지막 이력일 기준 3개월 범위/);
  assert.match(html, /미등록 종목 값은 포함되지 않습니다/);
  assert.equal(renderedCharts.length, 1);
  assert.deepEqual(renderedCharts[0].data.map(point => renderedCharts[0].sourceValues[point.date].value), data.aggregatedHistory.map(point => point.totalMarketcap));
  assert.ok(renderedCharts[0].data.every(point => point.value >= 0 && point.value <= 1));
  assert.ok(renderedCharts[0].data[0].value < renderedCharts[0].data[1].value);
});

test('company snapshot and representative price keep their independent dates beside their values in SSR', () => {
  const { Header } = loadPresentation();
  const html = renderToStaticMarkup(React.createElement(Header, { rank: 1, isCompanyLevel: true,
    marketcap: 549_000_000_000_000, marketcapLabel: '기업 전체 시가총액', marketcapDate: '2025-09-22',
    marketcapDateLabel: '시총 스냅샷 기준', price: 72_000, priceDate: '2026-09-30', priceLabel: '대표 보통주 주가' }));
  const rows = [...new JSDOM(html).window.document.querySelectorAll('dl > div')];
  const marketcap = rows.find(row => row.querySelector('dt').textContent === '기업 전체 시가총액');
  const price = rows.find(row => row.querySelector('dt').textContent === '대표 보통주 주가');
  assert.match(marketcap.textContent, /549조원시총 스냅샷 기준 2025-09-22/);
  assert.match(price.textContent, /72,000원거래 기준 2026-09-30/);
  assert.doesNotMatch(marketcap.textContent, /2026-09-30/);
  assert.doesNotMatch(price.textContent, /2025-09-22/);
});

test('summary range buttons actually switch recent and complete exact company history and preserve coverage',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
  const saved=new Map();for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});}
  const {createRoot}=require('react-dom/client');const chartRoot=createRoot(dom.window.document.getElementById('root'));
  const {Chart,renderedCharts}=loadPresentation();const data=companyHistory();
  data.aggregatedHistory=[
    {date:'2024-03-01',totalMarketcap:'9007199254740993',securitiesBreakdown:{common:'9007199254740993',preferred:null},observedCount:1,targetCount:2,observedSecurityIds:['common'],partial:true},
    {date:'2026-10-02',totalMarketcap:'9007199254740995',securitiesBreakdown:{common:'9007199254740995',preferred:null},observedCount:1,targetCount:2,observedSecurityIds:['common'],partial:true},
  ];
  data.securities=data.securities.slice(0,2);data.securities[0].marketcapHistory=data.aggregatedHistory.map(row=>({date:row.date,marketcap:row.totalMarketcap}));data.securities[1].marketcapHistory=[];
  const original=JSON.stringify(data);const container=dom.window.document.getElementById('root');
  try{
    await React.act(async()=>chartRoot.render(React.createElement(Chart,{companyMarketcapData:data,companySecs:[],type:'summary'})));
    const button=label=>[...container.querySelectorAll('button')].find(node=>node.textContent===label);
    assert.ok(button('최근 3개월'));assert.ok(button('전체'));assert.equal(button('최근 3개월').getAttribute('aria-pressed'),'true');assert.match(container.textContent,/기록 1개/);
    assert.match(container.textContent,/차트 표시 범위/);assert.match(container.textContent,/최근 3개월\/전체는 이 차트의 표시 범위/);assert.match(container.textContent,/핵심 지표는 이름에 표시된 기간/);
    assert.equal(renderedCharts.at(-1).data.length,1);
    await React.act(async()=>button('전체').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
    assert.equal(button('전체').getAttribute('aria-pressed'),'true');assert.match(container.textContent,/전체 이력 범위 2024-03-01 ~ 2026-10-02 · 기록 2개/);
    const whole=renderedCharts.at(-1);assert.equal(whole.data.length,2);assert.equal(whole.sourceValues['2024-03-01'].value,'9007199254740993');assert.equal(whole.sourceValues['2026-10-02'].value,'9007199254740995');assert.deepEqual(whole.coverage['2024-03-01'],{observedCount:1,targetCount:2});
    assert.ok(whole.data[0].value < whole.data[1].value);assert.ok(Object.values(whole.sourceValues['2024-03-01']).includes(null));
    await React.act(async()=>button('최근 3개월').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
    assert.equal(renderedCharts.at(-1).data.length,1);assert.match(container.textContent,/기록 1개/);
    await React.act(async()=>chartRoot.render(React.createElement(Chart,{companyMarketcapData:data,companySecs:[],type:'summary',start:'2024-03-01',end:'2024-03-31'})));
    assert.equal(container.querySelector('[aria-label="시가총액 차트 범위"]'),null);assert.match(container.textContent,/직접 지정한 기간/);assert.equal(renderedCharts.at(-1).data.length,1);assert.equal(renderedCharts.at(-1).data[0].date,'2024-03-01');
    assert.match(container.textContent,/직접 지정한 범위는 차트와 핵심 지표에 공통 적용/);
    assert.equal(JSON.stringify(data),original);
  }finally{await React.act(async()=>chartRoot.unmount());dom.window.close();for(const [key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
