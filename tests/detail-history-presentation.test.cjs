const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { JSDOM } = require('jsdom');
const { loader, renderToStaticMarkup } = require('./helpers/detail-presentation-loader.cjs');

function loadPresentation() {
  const renderedCharts = [];
  const chartStub = chart => ({ __esModule: true, default: props => {
    renderedCharts.push({ chart, data: props.data, registered: props.registeredHistory });
    return React.createElement('div', { 'data-chart': chart });
  } });
  const load = loader({
    '@/components/chart-company-marketcap': chartStub('summary'),
    '@/components/chart-marketcap': chartStub('detailed'),
    '@/components/chart-a11y-description': { __esModule: true, default: () => null },
  });
  return {
    Chart: load('components/interactive-chart-section.tsx').InteractiveChartSection,
    Header: load('components/header-rank.tsx').default,
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

test('one real history date renders exact observation values in SSR as a table', () => {
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
  assert.equal(renderedCharts.length,0);
  assert.equal(JSON.stringify(data), original);
});

test('an explicit three-month window can leave one date and still renders the compact observation state', () => {
  const { Chart, renderedCharts } = loadPresentation();
  const data = companyHistory();
  data.aggregatedHistory.unshift({ date: '2025-09-22', totalMarketcap: 549_000_000_000_000, securitiesBreakdown: {} });
  const html = renderToStaticMarkup(React.createElement(Chart, { companyMarketcapData: data, companySecs: [], type: 'summary', start:'2026-07-02' }));
  assert.match(html, /기록 1개/);
  assert.doesNotMatch(html, /2025-09-22/);
  assert.equal(renderedCharts.length,0);
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
  assert.equal(renderedCharts.length,0,'the exact observation is available during SSR before chart mount');
});

test('multiple recorded dates report the range in SSR and keep exact sources when the chart approaches the viewport', async () => {
  const { Chart, renderedCharts } = loadPresentation();
  const data = companyHistory();
  data.aggregatedHistory.unshift({ date: '2026-09-30', totalMarketcap: 1_700_000_000_000_000,
    securitiesBreakdown: { common: 1_670_000_000_000_000, preferred: 30_000_000_000_000 } });
  const element = React.createElement(Chart, { companyMarketcapData: data, companySecs: [], type: 'summary' });
  const html = renderToStaticMarkup(element);
  assert.match(html, /2026-09-30 ~ 2026-10-02 · 2일 관측/);
  assert.match(html, /등록 종목 합계는 날짜별 관측값의 합계/);
  assert.match(html, /차트 준비 중/);
  assert.equal(renderedCharts.length, 0);
  await withMountedChart(async ({ dom, chartRoot }) => {
    let intersect;
    dom.window.IntersectionObserver = class {
      constructor(callback) { intersect = callback; }
      observe() {}
      disconnect() {}
    };
    await React.act(async()=>chartRoot.render(element));
    assert.equal(renderedCharts.length, 0);
    await React.act(async()=>intersect([{isIntersecting:true}]));
    assert.equal(renderedCharts.length, 1);
    const [rendered] = renderedCharts;
    const tooltip=renderToStaticMarkup(rendered.registered.renderObservation('2026-09-30'));
    assert.match(tooltip,/1,700,000,000,000,000원/);
    assert.doesNotMatch(tooltip,/undefined|개 종목 관측/);
    assert.ok(rendered.data.every(point => point['총합계'] >= 0 && point['총합계'] <= 1));
    assert.ok(rendered.data[0]['총합계'] < rendered.data[1]['총합계']);
  });
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

async function withMountedChart(run) {
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
  const saved=new Map();for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});}
  const {createRoot}=require('react-dom/client');const chartRoot=createRoot(dom.window.document.getElementById('root'));
  try { await run({ dom, chartRoot }); } finally { await React.act(async()=>chartRoot.unmount());dom.window.close();for(const [key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];} }
}

test('summary range buttons switch monthly, recent and complete company history while preserving exact coverage',async()=>{
  await withMountedChart(async({ dom, chartRoot })=>{
  const {Chart,renderedCharts}=loadPresentation();const data=companyHistory();
  data.aggregatedHistory=[
    {date:'2024-03-01',totalMarketcap:'9007199254740993',securitiesBreakdown:{common:'9007199254740993',preferred:null},observedCount:1,targetCount:2,observedSecurityIds:['common'],partial:true},
    {date:'2026-10-02',totalMarketcap:'9007199254740995',securitiesBreakdown:{common:'9007199254740995',preferred:null},observedCount:1,targetCount:2,observedSecurityIds:['common'],partial:true},
  ];
  data.securities=data.securities.slice(0,2);data.securities[0].marketcapHistory=data.aggregatedHistory.map(row=>({date:row.date,marketcap:row.totalMarketcap}));data.securities[1].marketcapHistory=[];
  const original=JSON.stringify(data);const container=dom.window.document.getElementById('root');
    await React.act(async()=>chartRoot.render(React.createElement(Chart,{companyMarketcapData:data,companySecs:[],type:'summary'})));
    const button=label=>[...container.querySelectorAll('button')].find(node=>node.textContent===label);
    assert.ok(button('최근 3개월'));assert.ok(button('전체'));assert.equal(button('5년').getAttribute('aria-pressed'),'true');
    assert.match(container.textContent,/월별 마지막 관측.*2024-03-01 ~ 2026-10-02/);
    assert.ok(container.querySelector('[aria-label="시가총액 차트 범위"]'));
    await React.act(async()=>button('1년').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
    assert.equal(button('1년').getAttribute('aria-pressed'),'true');assert.match(container.textContent,/기록 1개/);
    await React.act(async()=>button('전체').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
    assert.equal(button('전체').getAttribute('aria-pressed'),'true');assert.match(container.textContent,/2024-03-01 ~ 2026-10-02 · 2일 관측/);
    const whole=renderedCharts.at(-1);assert.equal(whole.data.length,2);
    assert.ok(whole.data.every(row=>Object.keys(row).join(',')==='date,총합계'));
    assert.match(renderToStaticMarkup(whole.registered.renderObservation('2024-03-01')),/1\/2개 종목 관측 · 부분 관측.*9,007,199,254,740,993원.*미관측/);
    assert.match(renderToStaticMarkup(whole.registered.renderObservation('2026-10-02')),/9,007,199,254,740,995원/);
    assert.ok(whole.data[0]['총합계'] < whole.data[1]['총합계']);
    await React.act(async()=>button('최근 3개월').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
    assert.equal(container.querySelector('[data-chart]'),null);assert.match(container.textContent,/기록 1개/);
    await React.act(async()=>chartRoot.render(React.createElement(Chart,{companyMarketcapData:data,companySecs:[],type:'summary',start:'2024-03-01',end:'2024-03-31'})));
    assert.equal(container.querySelector('[aria-label="시가총액 차트 범위"]'),null);assert.match(container.textContent,/이력 기준 2024-03-01/);assert.equal(container.querySelector('[data-chart]'),null);
    assert.equal(JSON.stringify(data),original);
  });
});

test('period averages retain sparse observation counts, exact zero and signed PER differences', () => {
  const load = require('./helpers/detail-presentation-loader.cjs').loader();
  const { PeriodStats } = load('components/detail-period-stats.tsx');
  const { DETAIL_METRICS, periodMeans } = load('lib/detail-presentation.ts');
  const { summarizeBusinessWindow } = load('lib/business-analysis.ts');
  const analysisEnd = '2026-11-20';
  const rows = [
    { date: '2023-12-29', value: '9007199254740993' },
    { date: '2024-10-10', value: '0', state: 'provided' },
    { date: '2026-11-20', value: '900', state: 'missing' },
  ];
  function render(metric, history, currentValue) {
    const analysis = { analysisEnd, means: periodMeans(history, analysisEnd), summary: summarizeBusinessWindow(history) };
    return JSDOM.fragment(renderToStaticMarkup(React.createElement(PeriodStats, {
      metric, info: DETAIL_METRICS[metric], companyPage: false, basis: analysisEnd, analysis, currentValue,
    })));
  }
  const cells = row => [...row.cells].map(cell => cell.textContent);
  for (const [metric, unit] of [['div', '%'], ['dps', '원']]) {
    const fragment = render(metric, rows);
    assert.deepEqual(cells(fragment.querySelector('thead tr')), ['기간', '평균값', '관측 수']);
    const records = [...fragment.querySelectorAll('tbody tr')];
    assert.deepEqual(cells(records[0]), ['12개월제공 관측 없음', '—', '0개']);
    assert.deepEqual(cells(records[1]), ['3년', metric === 'dps' ? '4,503,599,627,370,497원5년 평균 대비 0%' : '4,503,599,627,370,496.5%', '2개']);
    assert.equal(fragment.textContent.match(/2024-10-10/g).length, 1);
    assert.doesNotMatch(fragment.textContent, /2026-11-20/);
    assert.deepEqual(cells(render(metric, rows.slice(1)).querySelectorAll('tbody tr')[1]), ['3년', `0${unit}`, '1개']);
  }

  const payouts = [
    { date: '2024-10-10', value: '30' },
    { date: '2026-10-30', value: '120' },
    { date: analysisEnd, value: '0', state: 'provided' },
  ];
  const dps = render('dps', payouts, '90');
  assert.match(dps.querySelector('p').textContent, /현재 주당배당금 90원 · 12개월 평균 대비 \+50%/);
  assert.deepEqual(cells(dps.querySelector('tbody tr')), ['12개월', '60원3년 평균 대비 +20%', '2개']);
  assert.equal(render('dps', payouts, '0').querySelector('p .market-down').textContent, '−100%');
  assert.doesNotMatch(render('dps', payouts.slice(-1), '90').textContent, /평균 대비/);

  const per = render('per', [{ date: '2024-10-10', value: '10' }], '5');
  assert.deepEqual(cells(per.querySelector('thead tr')), ['기간', '평균 PER', '현재 − 평균']);
  const observed = per.querySelectorAll('tbody tr')[1];
  assert.deepEqual(cells(observed), ['3년관측 1개', '10배', '−5배']);
  assert.equal(observed.querySelector('.market-down').textContent, '−5배');
  const differentEnding = render('div', [...rows, { date: '2026-11-25', value: '12' }]);
  const lastObservation = differentEnding.querySelectorAll('tbody tr')[1].querySelector('time');
  assert.equal(lastObservation.dateTime, '2024-10-10');
  assert.match(differentEnding.textContent, /분석 범위 2023-12-29 ~ 2026-11-25/);

  const publishedObservation = { date: analysisEnd, value: '12' };
  for (const metric of ['per', 'div', 'dps']) {
    const sharedEnding = render(metric, [...rows.slice(0, 2), publishedObservation], '10');
    assert.match(sharedEnding.textContent, /2023-12-29부터 · 실제 관측 3개/);
    assert.doesNotMatch(sharedEnding.textContent, /2026-11-20/);
    const sameDay = render(metric, [publishedObservation], '10');
    assert.match(sameDay.textContent, /실제 관측 1개/);
    assert.doesNotMatch(sameDay.textContent, /2026-11-20/);
  }

  const pbr = render('pbr', [{ date: '2024-10-10', value: '0' }], '2.1234');
  assert.deepEqual(cells(pbr.querySelector('thead tr')), ['기간', '평균 PBR', '현재 − 평균']);
  const pbrRecord = pbr.querySelectorAll('tbody tr')[1];
  assert.equal(pbrRecord.cells[0].querySelector('time').dateTime, '2024-10-10');
  assert.deepEqual(cells(pbrRecord).slice(1), ['0배', '+2.12배']);
  const bookMultiples = [
    { date: '2008-10-10', value: '2' }, { date: '2018-10-10', value: '6' }, { date: '2022-10-10', value: '4' },
    { date: '2024-10-10', value: '3' }, { date: analysisEnd, value: '2' },
  ];
  const comparisons = [...render('pbr', bookMultiples, '3').querySelectorAll('tbody tr')];
  assert.deepEqual(comparisons.map(row => row.cells[1].querySelector('small')?.textContent), [
    '3년 평균 대비 −20%', '5년 평균 대비 −16.67%', '10년 평균 대비 −20%', '20년 평균 대비 +10.29%', undefined,
  ]);
  assert.equal(comparisons[0].cells[2].textContent, '+1배');
  assert.equal(render('per', bookMultiples, '3').querySelector('tbody td small'), null);
  const zeroShorterMean = render('pbr', [bookMultiples[3], { date: analysisEnd, value: '0' }], '3');
  assert.equal(zeroShorterMean.querySelector('tbody tr').cells[1].querySelector('small').textContent, '3년 평균 대비 −100%');
  for (const metric of ['eps', 'bps']) {
    const fragment = render(metric, [{ date: '2024-10-10', value: '-157' }, { date: '2024-12-20', value: '0' }]);
    assert.deepEqual(cells(fragment.querySelector('thead tr')), ['기간', '평균값', '관측 수']);
    assert.deepEqual(cells(fragment.querySelectorAll('tbody tr')[1]).slice(1), ['−79원', '2개']);
  }
});
