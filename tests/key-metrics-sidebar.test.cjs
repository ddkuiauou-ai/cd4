const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { pageLoader, renderToStaticMarkup } = require('./helpers/detail-presentation-loader.cjs');

const publication = { asOf:'2026-10-08' };
const security = {
  securityId:'preferred', routeCode:null, name:'Test preferred', korName:'테스트우', ticker:'000002', exchange:'KOSPI',
  type:'우선주', state:'published', marketcap:'100', marketcapState:'provided', marketcapDate:'2026-10-05',
  price:'36000', priceState:'provided', priceDate:'2026-10-08', publication, company:null,
};
const rows = values => values.map(([date, marketcap]) => ({
  date, marketcap, marketcapState:marketcap == null ? 'source_missing' : 'provided',
}));
const base = {
  security, company:null, companySecs:[], ranking:{ currentRank:3, rankDate:'2026-10-08' }, neighbors:[],
  priceHistory:[{ date:'2026-10-08', close:'36000', rate:2.13 }],
  history:rows([['2026-09-30','80'], ['2026-10-05','100'], ['2026-10-08','999']]),
};

async function render(snapshot = base, search = {}, { company = false, basic = false, metric = 'marketcap' } = {}) {
  const fixture = pageLoader(snapshot);
  const element = company ? await fixture.pages.RestoredCompanyDetail({ code:'company', search })
    : await fixture.pages.RestoredSecurityDetail({ code:'preferred', metric, search, basic });
  const html = renderToStaticMarkup(element);
  const { window } = new JSDOM(html);
  try {
    const overview = window.document.querySelector('#current-overview');
    const indicators = window.document.querySelector('#indicators');
    const periods = Object.fromEntries([...indicators?.querySelectorAll('dl > div') ?? []].map(row => [
      row.querySelector('dt').textContent, [...row.querySelectorAll('dd')].map(cell => cell.textContent),
    ]));
    return {
      html, fixture, periods,
      current:overview?.textContent,
      primary:overview?.querySelector('.investor-primary-value')?.textContent,
      statistics:indicators?.textContent,
      comparison:window.document.querySelector('.investor-overview > p')?.textContent ?? '',
      quote:[...overview?.querySelectorAll('dl > div') ?? []].find(row => row.querySelector('dt')?.textContent === '전일 대비')?.querySelector('dd').textContent,
    };
  } finally { window.close(); }
}

test('official value and its date stay together and later raw history never becomes the current value', async () => {
  const normal = await render();
  assert.equal(normal.primary,'100원');
  assert.match(normal.current,/2026-10-05/);
  assert.doesNotMatch(normal.current,/999원/);

  const missing = await render({...base,security:{...security,marketcap:null,marketcapState:'source_missing'}});
  assert.equal(missing.primary,'—');
  assert.match(missing.current,/현재값 미제공/);
  assert.doesNotMatch(missing.current,/999원|80원/);

  const zero = await render({...base,security:{...security,marketcap:'0'}});
  assert.equal(zero.primary,'0원');
  assert.match(zero.current,/2026-10-05/);
});

test('period statistics include real zero and negatives and absent records remain missing', async () => {
  const mixed = await render({...base,history:rows([['2026-10-01','0'],['2026-10-02','-20'],['2026-10-03',null],['2026-10-04','20']])});
  assert.equal(mixed.periods['12개월 평균'][0],'0원');
  assert.match(mixed.statistics,/최저\s*-20원/);
  assert.match(mixed.statistics,/2026-10-01 ~ 2026-10-04 · 실제 관측 3개/);

  const zeros = await render({...base,history:rows([['2026-10-01','0'],['2026-10-02','0']])});
  assert.deepEqual(zeros.periods['12개월 평균'],['0원','2026-10-01 ~ 2026-10-02 · 2개']);

  const empty = await render({...base,history:[]});
  assert.deepEqual(empty.periods['12개월 평균'],['—','제공 관측 없음']);
  assert.match(empty.statistics,/이 범위에 제공된 관측이 없습니다/);
  assert.doesNotMatch(empty.statistics,/최저\s*0원/);
});

test('period means use the public asOf cutoff and retain zero in comparisons', async () => {
  const { periods, html } = await render({
    ...base, security:{...security,publication:{asOf:'2024-10-08'}},
    history:rows([['2024-10-01','0'],['2024-10-08','100'],['2024-10-09','999']]),
  });
  assert.deepEqual(periods['12개월 평균'],['50원','2024-10-01 ~ 2024-10-08 · 2개']);
  assert.match(html,/공개 기준일 2024-10-08/);
});

test('a selected valid range changes raw statistics and count while the full export stays complete', async () => {
  const { statistics, periods, fixture } = await render(base,{start:'2026-10-05',end:'2026-10-05'});
  assert.equal(periods['12개월 평균'][0],'100원');
  assert.match(statistics,/분석 범위 2026-10-05 ~ 2026-10-05 · 실제 관측 1개/);
  assert.equal(fixture.csv().data.length,3);
});

test('each period mean reports its own actual supplied dates and count including zero but excluding null', async () => {
  const snapshot = {
    ...base, history:rows([['2020-01-01','9000'],['2024-10-01','-20'],['2025-10-08','0'],['2026-10-07',null],['2026-10-08','20']]),
  };
  const normal = await render(snapshot);
  assert.deepEqual(normal.periods['12개월 평균'],['10원','2025-10-08 ~ 2026-10-08 · 2개']);
  assert.deepEqual(normal.periods['3년 평균'],['0원','2024-10-01 ~ 2026-10-08 · 3개']);
  assert.equal(normal.periods['10년 평균'][1],'2020-01-01 ~ 2026-10-08 · 4개');

  const custom = await render(snapshot,{start:'2026-10-07',end:'2026-10-08'});
  for (const label of ['12개월 평균','3년 평균','10년 평균']) {
    assert.deepEqual(custom.periods[label],['20원','2026-10-08 ~ 2026-10-08 · 1개']);
  }
  const empty = await render({...base,history:rows([['2020-01-01','0']])});
  assert.deepEqual(empty.periods['12개월 평균'],['—','제공 관측 없음']);
  assert.deepEqual(empty.periods['10년 평균'],['0원','2020-01-01 ~ 2020-01-01 · 1개']);
});

test('company period means disclose partial sums and share the custom window with the aggregate chart', async () => {
  const company = { companyId:'company', companyName:'Test', companyKorName:'테스트', state:'published', publication,
    totalMarketcap:'500', totalMarketcapDate:'2026-10-08', securities:[] };
  const history = [
    {date:'2024-10-01',totalMarketcap:'200',securitiesBreakdown:{a:'200',b:null},observedSecurityIds:['a'],observedCount:1,targetCount:2,partial:true},
    {date:'2026-10-08',totalMarketcap:'500',securitiesBreakdown:{a:'200',b:'300'},observedSecurityIds:['a','b'],observedCount:2,targetCount:2,partial:false},
  ];
  const normal = await render({...base,company,history},{},{company:true});
  assert.deepEqual(normal.periods['12개월 평균'],['500원','2026-10-08 ~ 2026-10-08 · 1개']);
  assert.deepEqual(normal.periods['3년 평균'],['350원','2024-10-01 ~ 2026-10-08 · 2개']);
  assert.match(normal.html,/등록 종목.*합계/);
  assert.match(normal.html,/관측.*종목 구성.*다른|관측 종목 구성이 달라/);

  const custom = await render({...base,company,history},{start:'2024-10-01',end:'2024-10-01'},{company:true});
  assert.deepEqual(custom.periods['12개월 평균'],['200원','2024-10-01 ~ 2024-10-01 · 1개']);
  assert.equal(custom.fixture.charts.length,1);
  const [chart] = custom.fixture.charts;
  assert.equal(chart.type,'summary');
  assert.equal(chart.start,'2024-10-01');
  assert.equal(chart.end,'2024-10-01');
});

test('an end-only custom range gives the standalone marketcap chart the same raw observations as the statistics', async () => {
  const snapshot = {...base,history:rows([['2024-10-01','100'],['2026-10-08','200']])};
  const normal = await render(snapshot);
  assert.equal(normal.fixture.historyCharts[0].selectedStart,'2026-07-08');
  const custom = await render(snapshot,{end:'2026-10-08'});
  assert.equal(custom.fixture.historyCharts[0].selectedStart,undefined);
  assert.equal(custom.fixture.historyCharts[0].selectedEnd,'2026-10-08');
  assert.deepEqual(custom.fixture.historyCharts[0].rows.map(row => row.date),['2024-10-01','2026-10-08']);
  assert.equal(custom.periods['3년 평균'][1],'2024-10-01 ~ 2026-10-08 · 2개');
});

test('the security quote uses a stored rate only from the matching published price record, including zero and missing rate', async () => {
  for (const [price, rate, expected] of [['36000',2.13,'+2.13%'],['0',0,'0%'],['36000',-1.23,'-1.23%'],['36000',null,'—'],['36000',Infinity,'—']]) {
    const result = await render({
      ...base, security:{...security,price,publication:{asOf:'2026-10-09'}},
      priceHistory:[{date:'2026-10-08',close:price,rate},{date:'2025-01-01',close:'39300',rate:7}],
    },{},{basic:true});
    assert.equal(result.quote,expected);
    assert.match(result.current,/2026-10-08/);
    assert.doesNotMatch(result.html,/NaN|Infinity|-8\.3|-8\.4/);
  }
  const mismatch = await render({...base,priceHistory:[{date:'2026-10-08',close:'999',rate:8}]},{},{basic:true});
  assert.equal(mismatch.primary,'36,000원');
  assert.equal(mismatch.quote,'—');
});

test('the selected security quote remains independent from company constituent prices and the company aggregate', async () => {
  const selected = await render(base,{},{basic:true});
  assert.equal(selected.quote,'+2.13%');
  const company = { companyId:'company', companyName:'Test', companyKorName:'테스트', state:'published', publication,
    totalMarketcap:'500', totalMarketcapDate:'2026-10-07', securities:[] };
  const priceHistory = [{date:'2026-10-07',close:'72000',rate:-1}];
  const representative = {...security,securityId:'common',korName:'테스트',type:'보통주',marketcap:'500',marketcapDate:'2026-10-07',
    price:'72000',priceDate:'2026-10-07',prices:priceHistory};
  const aggregated = {...base,company:{...company,securities:[representative]},security:representative,companySecs:[representative],
    history:[{date:'2026-10-07',totalMarketcap:'500',securitiesBreakdown:{common:'500'},observedSecurityIds:['common']}],priceHistory};
  const { html } = await render(aggregated,{},{company:true});
  const dom = new JSDOM(html);
  try {
    const doc = dom.window.document;
    const quote = doc.querySelector('#securities-summary tbody tr td:last-child');
    assert.match(quote.textContent,/72,000원.*2026-10-07/);
    assert.match(doc.querySelector('.detail-identity-meta').textContent,/기업 전체.*2026-10-08/);
    assert.doesNotMatch(doc.querySelector('#current-overview').textContent,/72,000원/);
    assert.equal(doc.querySelector('#price-history').tagName,'SECTION');
    assert.match(doc.querySelector('#price-history h2').textContent,/대표 보통주 주가/);
  } finally { dom.window.close(); }
});

test('metric comparison uses a matching raw observation at the displayed snapshot date and value', async () => {
  const normal = await render();
  assert.match(normal.comparison,/2026-09-30 이력 대비 \+25%/);
  const mismatch = await render({...base,security:{...security,marketcap:'90'}});
  assert.doesNotMatch(mismatch.comparison,/이력 대비/);
  assert.match(mismatch.comparison,/같은 날짜·값의 이력이 없어 비교할 수 없습니다/);
  const zero = await render({...base,security:{...security,marketcap:'0'},history:rows([['2026-09-30','80'],['2026-10-05','0']])});
  assert.match(zero.comparison,/이력 대비 -100%/);
  const single = await render({...base,history:rows([['2026-10-05','100']])});
  assert.match(single.comparison,/이전 제공 이력이 없어 비교할 수 없습니다/);
});

test('nonpositive prior metrics show an exact difference and the reason percentage change is unavailable', async () => {
  for (const [previous,current,reason] of [['0','9007199254740994','0'],['-9007199254740993','1','음수']]) {
    const { comparison } = await render({
      ...base,security:{...security,eps:current,epsState:'provided',epsDate:'2026-10-08'},
      history:[{date:'2026-10-01',eps:previous,epsState:'provided'},{date:'2026-10-08',eps:current,epsState:'provided'}],
    },{},{metric:'eps'});
    assert.match(comparison,/2026-10-01 이력 대비 차이 9,007,199,254,740,994원/);
    assert.ok(comparison.includes(`이전 값이 ${reason}라 증감률 계산 불가`));
    assert.doesNotMatch(comparison,/%|Infinity|NaN/);
  }
});

test('the company snapshot stays separate from registered history and cohort changes suppress comparisons', async () => {
  const company = { companyId:'company', companyName:'Test', companyKorName:'테스트', state:'published', publication,
    totalMarketcap:'500', totalMarketcapDate:'2026-10-05', securities:[] };
  const history = [
    {date:'2026-09-30',totalMarketcap:'400',securitiesBreakdown:{a:'400'},observedSecurityIds:['a'],observedCount:1,targetCount:2,partial:true},
    {date:'2026-10-05',totalMarketcap:'500',securitiesBreakdown:{a:'500'},observedSecurityIds:['a'],observedCount:1,targetCount:2,partial:true},
    {date:'2026-10-08',totalMarketcap:'999',securitiesBreakdown:{a:'999'},observedSecurityIds:['a'],observedCount:1,targetCount:2,partial:true},
  ];
  const same = await render({...base,company,history},{},{company:true});
  assert.match(same.current,/500원.*2026-10-05/);
  assert.doesNotMatch(same.current,/999원/);
  assert.match(same.comparison,/2026-09-30 이력 대비 \+25%/);
  const different = await render({...base,company,history:history.map((row,index) => index === 0 ? {...row,observedSecurityIds:['a','b']} : row)},{},{company:true});
  assert.doesNotMatch(different.comparison,/이력 대비|차이|%/);
  assert.match(different.comparison,/관측 종목 구성이 달라 이전 이력과의 비교를 표시하지 않습니다/);
  assert.match(different.html,/등록 종목 합계/);
});
