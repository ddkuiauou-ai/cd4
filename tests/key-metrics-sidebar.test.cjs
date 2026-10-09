const test = require('node:test');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const {pageLoader,renderToStaticMarkup} = require('./helpers/detail-presentation-loader.cjs');
const publication={asOf:'2026-10-08'};
const security={securityId:'preferred',routeCode:null,name:'Test preferred',korName:'테스트우',ticker:'000002',exchange:'KOSPI',type:'우선주',state:'published',marketcap:'100',marketcapState:'provided',marketcapDate:'2026-10-05',price:'36000',priceState:'provided',priceDate:'2026-10-08',publication,company:null};
const rows = values => values.map(([date,marketcap])=>({date,marketcap,marketcapState:marketcap == null?'source_missing':'provided'}));
const base={security,company:null,companySecs:[],ranking:{currentRank:3,rankDate:'2026-10-08'},neighbors:[],priceHistory:[{date:'2026-10-08',close:'36000',rate:2.13}],history:rows([['2026-09-30','80'],['2026-10-05','100'],['2026-10-08','999']])};
async function render(snapshot=base,search={},company=false){const fixture=pageLoader(snapshot);const html=renderToStaticMarkup(company?await fixture.pages.RestoredCompanyDetail({code:'company',search}):await fixture.pages.RestoredSecurityDetail({code:'preferred',metric:'marketcap',search}));return {html,fixture,facts:fixture.facts()};}
function stat(html,label){const dom=new JSDOM(html);const heading=[...dom.window.document.querySelectorAll('#indicators p')].find(node=>node.textContent===label);assert.ok(heading,label);const result=heading.parentElement.textContent;dom.window.close();return result;}

test('detail current metric and rail keep the official value/date together and never promote later raw history',async()=>{
  const {html,facts}=await render();assert.equal(facts.rows.find(([label])=>label==='현재 시가총액')[1],'100원');assert.match(facts.note,/2026-10-05/);assert.match(stat(html,'현재 시가총액'),/100원지표 기준 2026-10-05/);assert.doesNotMatch(stat(html,'현재 시가총액'),/999원/);
  const missing=await render({...base,security:{...security,marketcap:null,marketcapState:'source_missing'}});assert.equal(missing.facts.rows.find(([label])=>label==='현재 시가총액')[1],'—');assert.doesNotMatch(stat(missing.html,'현재 시가총액'),/999원|80원/);
  const zero=await render({...base,security:{...security,marketcap:'0'}});assert.equal(zero.facts.rows.find(([label])=>label==='현재 시가총액')[1],'0원');assert.match(stat(zero.html,'현재 시가총액'),/0원지표 기준 2026-10-05/);
});

test('period statistics include real zero and negatives and absent records remain missing',async()=>{
  const mixed=await render({...base,history:rows([['2026-10-01','0'],['2026-10-02','-20'],['2026-10-03',null],['2026-10-04','20']])});assert.match(stat(mixed.html,'12개월 평균'),/0원/);assert.match(stat(mixed.html,'최저값'),/-20원/);assert.match(mixed.html,/실제 제공 3개/);
  const zeros=await render({...base,history:rows([['2026-10-01','0'],['2026-10-02','0']])});assert.match(stat(zeros.html,'12개월 평균'),/0원/);
  const empty=await render({...base,history:[]});assert.match(stat(empty.html,'12개월 평균'),/—/);assert.match(stat(empty.html,'최저값'),/—/);assert.match(empty.html,/실제 제공 0개/);
});

test('period means use the public asOf cutoff and retain zero in comparisons',async()=>{
  const {html}=await render({...base,security:{...security,publication:{asOf:'2024-10-08'}},history:rows([['2024-10-01','0'],['2024-10-08','100']])});assert.match(stat(html,'12개월 평균'),/50원분석 기준 2024-10-08/);assert.match(html,/실제 제공 2개/);
});

test('a selected valid range changes raw statistics and count while the full export stays complete',async()=>{
  const {html,fixture}=await render(base,{start:'2026-10-05',end:'2026-10-05'});assert.match(stat(html,'12개월 평균'),/100원/);assert.match(html,/분석 범위 2026-10-05 ~ 2026-10-05 · 실제 제공 1개/);assert.equal(fixture.csv().data.length,3);
});

test('each period mean reports its own actual supplied dates and count including zero but excluding null',async()=>{
  const snapshot={...base,history:rows([['2020-01-01','9000'],['2024-10-01','-20'],['2025-10-08','0'],['2026-10-07',null],['2026-10-08','20']])};
  const {html}=await render(snapshot);
  assert.match(stat(html,'12개월 평균'),/10원/);assert.match(stat(html,'12개월 평균'),/실제 관측 2025-10-08 ~ 2026-10-08 · 2개/);
  assert.match(stat(html,'3년 평균'),/0원/);assert.match(stat(html,'3년 평균'),/실제 관측 2024-10-01 ~ 2026-10-08 · 3개/);
  assert.match(stat(html,'10년 평균'),/실제 관측 2020-01-01 ~ 2026-10-08 · 4개/);
  const custom=await render(snapshot,{start:'2026-10-07',end:'2026-10-08'});
  for(const label of ['12개월 평균','3년 평균','10년 평균']){assert.match(stat(custom.html,label),/20원/);assert.match(stat(custom.html,label),/실제 관측 2026-10-08 ~ 2026-10-08 · 1개/);}
  const empty=await render({...base,history:rows([['2020-01-01','0']])});
  assert.match(stat(empty.html,'12개월 평균'),/실제 관측 — ~ — · 0개/);assert.match(stat(empty.html,'10년 평균'),/실제 관측 2020-01-01 ~ 2020-01-01 · 1개/);
});

test('company period means disclose partial sums with changing observed cohorts and share the custom window with both charts',async()=>{
  const company={companyId:'company',companyName:'Test',companyKorName:'테스트',state:'published',publication,totalMarketcap:'500',totalMarketcapDate:'2026-10-08',securities:[]};
  const history=[{date:'2024-10-01',totalMarketcap:'200',securitiesBreakdown:{a:'200',b:null},observedSecurityIds:['a'],observedCount:1,targetCount:2,partial:true},{date:'2026-10-08',totalMarketcap:'500',securitiesBreakdown:{a:'200',b:'300'},observedSecurityIds:['a','b'],observedCount:2,targetCount:2,partial:false}];
  const {html}=await render({...base,company,history},{},true);
  assert.match(stat(html,'12개월 평균'),/500원/);assert.match(stat(html,'12개월 평균'),/실제 관측 2026-10-08 ~ 2026-10-08 · 1개/);
  assert.match(stat(html,'3년 평균'),/350원/);assert.match(stat(html,'3년 평균'),/실제 관측 2024-10-01 ~ 2026-10-08 · 2개/);
  assert.match(html,/날짜별 등록 종목 부분 합계의 평균/);assert.match(html,/관측된 종목 구성이 다른 날짜도 포함/);
  assert.match(html,/직접 지정한 범위는 차트와 핵심 지표에 공통 적용/);
  const custom=await render({...base,company,history},{start:'2024-10-01',end:'2024-10-01'},true);
  assert.match(stat(custom.html,'12개월 평균'),/200원/);assert.match(stat(custom.html,'12개월 평균'),/실제 관측 2024-10-01 ~ 2024-10-01 · 1개/);
  assert.equal(custom.fixture.charts.length,2);assert.ok(custom.fixture.charts.every(chart=>chart.start==='2024-10-01'&&chart.end==='2024-10-01'));
});

test('an end-only custom range gives the standalone marketcap chart the same raw observations as the statistics',async()=>{
  const snapshot={...base,history:rows([['2024-10-01','100'],['2026-10-08','200']])};
  const normal=await render(snapshot);assert.equal(normal.fixture.historyCharts[0].rows.length,1);
  const custom=await render(snapshot,{end:'2026-10-08'});
  assert.deepEqual(custom.fixture.historyCharts[0].rows.map(row=>row.date),['2024-10-01','2026-10-08']);
  assert.match(stat(custom.html,'3년 평균'),/실제 관측 2024-10-01 ~ 2026-10-08 · 2개/);
});

test('current price uses stored rate only from the matching published price record, including zero and missing rate',async()=>{
  for(const [price,rate,expected] of [['36000',2.13,'+2.13%'],['0',0,'0.00%'],['36000',-1.23,'-1.23%'],['36000',null,'—'],['36000',Infinity,'—']]){
    const {html,facts}=await render({...base,security:{...security,price},priceHistory:[{date:'2026-10-08',close:price,rate},{date:'2025-01-01',close:'39300',rate:7}]});assert.equal(facts.rows.find(([label])=>label==='전일 대비')[1],expected);assert.match(html,/주가 기준 2026-10-08/);assert.doesNotMatch(html,/NaN|Infinity|-8\.3|-8\.4/);
  }
  const mismatch=await render({...base,priceHistory:[{date:'2026-10-08',close:'999',rate:8}]});assert.equal(mismatch.facts.rows.find(([label])=>label==='현재 주가')[1],'36,000원');assert.equal(mismatch.facts.rows.find(([label])=>label==='전일 대비')[1],'—');
});

test('selected security quote is independent of the company representative quote',async()=>{
  const selected=await render();assert.equal(selected.facts.rows.find(([label])=>label==='전일 대비')[1],'+2.13%');
  const company={companyId:'company',companyName:'Test',companyKorName:'테스트',state:'published',publication,totalMarketcap:'500',totalMarketcapDate:'2026-10-07',securities:[]};
  const representative={...security,securityId:'common',type:'보통주',price:'72000',priceDate:'2026-10-07'};
  const aggregated={...base,company,security:representative,history:[{date:'2026-10-07',totalMarketcap:'500',securitiesBreakdown:{},observedSecurityIds:[]}],priceHistory:[{date:'2026-10-07',close:'72000',rate:-1}]};
  const rendered=await render(aggregated,{},true);assert.equal(rendered.facts.rows.find(([label])=>label==='현재 주가')[1],'72,000원');assert.equal(rendered.facts.rows.find(([label])=>label==='전일 대비')[1],'-1.00%');assert.match(rendered.facts.note,/2026-10-07/);
});

test('metric comparison uses a matching raw observation at the displayed snapshot date and value',async()=>{
  const {html}=await render();assert.match(stat(html,'현재 시가총액'),/2026-09-30 이력 대비 \+25%/);
  const mismatch=await render({...base,security:{...security,marketcap:'90'}});assert.doesNotMatch(stat(mismatch.html,'현재 시가총액'),/이력 대비/);assert.match(stat(mismatch.html,'현재 시가총액'),/같은 날짜·값의 이력이 없어 비교할 수 없습니다/);
  const zero=await render({...base,security:{...security,marketcap:'0'},history:rows([['2026-09-30','80'],['2026-10-05','0']])});assert.match(stat(zero.html,'현재 시가총액'),/이력 대비 -100%/);
  const single=await render({...base,history:rows([['2026-10-05','100']])});assert.match(stat(single.html,'현재 시가총액'),/이전 제공 이력이 없어 비교할 수 없습니다/);
});

test('nonpositive prior metrics show an exact difference and the reason percentage change is unavailable',async()=>{
  for(const [previous,current,reason]of [['0','9007199254740994','0'],['-9007199254740993','1','음수']]){
    const fixture=pageLoader({...base,security:{...security,eps:current,epsState:'provided',epsDate:'2026-10-08'},history:[{date:'2026-10-01',eps:previous,epsState:'provided'},{date:'2026-10-08',eps:current,epsState:'provided'}]});
    const html=renderToStaticMarkup(await fixture.pages.RestoredSecurityDetail({code:'preferred',metric:'eps'}));const currentCard=stat(html,'현재 EPS');
    assert.match(currentCard,/2026-10-01 이력 대비 차이 9,007,199,254,740,994원/);assert.ok(currentCard.includes(`이전 값이 ${reason}라 증감률 계산 불가`));assert.doesNotMatch(currentCard,/%|Infinity|NaN/);
  }
});

test('company snapshot stays separate from registered history and cohort changes suppress comparisons',async()=>{
  const company={companyId:'company',companyName:'Test',companyKorName:'테스트',state:'published',publication,totalMarketcap:'500',totalMarketcapDate:'2026-10-05',securities:[]};
  const history=[{date:'2026-09-30',totalMarketcap:'400',securitiesBreakdown:{a:'400'},observedSecurityIds:['a'],observedCount:1,targetCount:2,partial:true},{date:'2026-10-05',totalMarketcap:'500',securitiesBreakdown:{a:'500'},observedSecurityIds:['a'],observedCount:1,targetCount:2,partial:true},{date:'2026-10-08',totalMarketcap:'999',securitiesBreakdown:{a:'999'},observedSecurityIds:['a'],observedCount:1,targetCount:2,partial:true}];
  const same=await render({...base,company,history},{},true);assert.equal(same.facts.rows.find(([label])=>label==='현재 시가총액')[1],'500원');assert.match(stat(same.html,'현재 시가총액'),/2026-09-30 이력 대비 \+25%/);
  const different=await render({...base,company,history:history.map((row,index)=>index===0?{...row,observedSecurityIds:['a','b']}:row)},{},true);assert.doesNotMatch(stat(different.html,'현재 시가총액'),/이력 대비|차이|%/);assert.match(stat(different.html,'현재 시가총액'),/관측 종목 구성이 달라 이전 이력과의 비교를 표시하지 않습니다/);assert.match(different.html,/등록 종목 합계/);
});
