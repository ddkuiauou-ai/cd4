const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const {JSDOM} = require('jsdom');
const {loader,renderToStaticMarkup} = require('./helpers/detail-presentation-loader.cjs');

const publication = {asOf:'2026-10-08',revision:'7',scopeKey:'krx-all'};
const common = {securityId:'common',routeCode:'KOSPI.005930',name:'Samsung',korName:'삼성전자',ticker:'005930',exchange:'KOSPI',type:'보통주',marketcap:'495000000000000',marketcapDate:'2026-10-08',per:'18.5',prices:[{close:'74000',rate:0,date:'2026-10-08'}]};
const preferred = {...common,securityId:'preferred',routeCode:'KOSPI.005935',korName:'삼성전자우',ticker:'005935',type:'우선주',marketcap:'54000000000000',per:'13.5'};
const company = {companyId:'samsung',routeCode:'KOSPI.005930',companyName:'Samsung',companyKorName:'삼성전자',state:'published',totalMarketcap:'549000000000000',totalMarketcapDate:'2026-10-08',publication,company:{name:'Samsung',korName:'삼성전자'},securities:[common,preferred],aggregatedHistory:[],registeredHistory:[]};
const empty = () => null;
function loadFor(pathname, extra = {}) {
  return loader({
    'next/navigation':{usePathname:()=>pathname},
    '@/components/sticky-company-header':{StickyCompanyHeader:props=>React.createElement('h1',null,props.displayName)},
    '@/components/recent-security-tracker':{RecentSecurityTracker:empty},
    '@/components/recent-securities-sidebar':{RecentSecuritiesSidebar:empty},
    '@/components/page-navigation':{PageNavigation:({sections})=>React.createElement('nav',{'aria-label':'본문 목차'},sections.map(row=>React.createElement('a',{key:row.id,href:'#'+row.id},row.label)))},
    '@/components/interactive-chart-section':{InteractiveChartSection:empty},
    '@/components/detail-history-chart':{DetailHistoryChart:empty},
    '@/components/restored-detail-charts':{DetailFinancialAnalysis:empty,DetailPriceHistory:empty,DetailAnnualHistory:empty},
    '@/components/card-company-marketcap':{__esModule:true,default:empty},
    '@/components/share-button':{__esModule:true,default:empty},
    '@/components/CsvDownloadButton':{CsvDownloadButton:({label})=>React.createElement('button',null,label)},
    ...extra,
  });
}
function documentFor(Component,props) {
  const dom = new JSDOM(renderToStaticMarkup(React.createElement(Component,props)));
  return {document:dom.window.document,close:()=>dom.window.close()};
}
const selectorProps = {company,companySecs:[common,preferred],security:common,companyPage:false,basic:false,metric:'marketcap'};

test('company marketcap constituent controls lead to the corresponding stock marketcap, with one selected aggregate',()=>{
  const {DetailEntitySelector} = loadFor('/company/KOSPI.005930/marketcap')('components/detail-entity-selector.tsx');
  const view = documentFor(DetailEntitySelector,{...selectorProps,companyPage:true});
  try {
    assert.equal(view.document.querySelectorAll('.detail-entity-grid a').length,3);
    assert.equal(view.document.querySelector('[data-security-id="common"]').getAttribute('href'),'/security/KOSPI.005930/marketcap');
    assert.equal(view.document.querySelector('[data-security-id="preferred"]').getAttribute('href'),'/security/KOSPI.005935/marketcap');
    const selected = view.document.querySelectorAll('.detail-entity-grid [aria-current="page"]');
    assert.equal(selected.length,1);assert.match(selected[0].textContent,/기업 전체\(합산\).*549조원/);
  } finally {view.close();}
});

test('sibling navigation keeps the financial metric and date window without leaking another security’s listing episode',()=>{
  const {DetailEntitySelector} = loadFor('/security/KOSPI.005930/per')('components/detail-entity-selector.tsx');
  const view = documentFor(DetailEntitySelector,{...selectorProps,metric:'per',periodId:'common-episode',start:'2026-07-08',end:'2026-10-08'});
  try {
    const preferredLink = view.document.querySelector('[data-security-id="preferred"]');
    assert.equal(preferredLink.getAttribute('href'),'/security/KOSPI.005935/per?start=2026-07-08&end=2026-10-08');
    assert.match(preferredLink.textContent,/PER 보기/);assert.match(preferredLink.textContent,/54조원/);
    assert.match(view.document.querySelector('[data-security-id="common"]').getAttribute('href'),/period=common-episode/);
    assert.equal(view.document.querySelectorAll('.detail-entity-grid [aria-current="page"]').length,1);
    assert.match(view.document.querySelector('.detail-entity-aggregate').getAttribute('href'),/^\/company\/KOSPI\.005930\/marketcap\?start=/);
  } finally {view.close();}
});

test('company basic preserves basic destinations while a stock basic aggregate explicitly opens company marketcap',()=>{
  const {DetailEntitySelector} = loadFor('/company/KOSPI.005930')('components/detail-entity-selector.tsx');
  for (const companyPage of [true,false]) {
    const view = documentFor(DetailEntitySelector,{...selectorProps,basic:true,companyPage});
    try {
      assert.equal(view.document.querySelector('[data-security-id="preferred"]').getAttribute('href'),'/security/KOSPI.005935');
      assert.equal(view.document.querySelector('.detail-entity-aggregate').getAttribute('href'),companyPage?'/company/KOSPI.005930':'/company/KOSPI.005930/marketcap');
    } finally {view.close();}
  }
});

test('all actual constituents remain visible and independently linked even when names and tickers repeat',()=>{
  const {DetailEntitySelector} = loadFor('/security/common/per')('components/detail-entity-selector.tsx');
  const members = Array.from({length:9},(_,index)=>({...preferred,securityId:'preferred-'+index,routeCode:null,korName:'같은 이름',ticker:'DUP',marketcap:index===0?'0':null}));
  const view = documentFor(DetailEntitySelector,{...selectorProps,company:{...company,securities:members},companySecs:members,security:null,metric:'per'});
  try {
    const links = [...view.document.querySelectorAll('[data-security-id]')];
    assert.equal(links.length,9);assert.equal(new Set(links.map(link=>link.getAttribute('href'))).size,9);
    assert.equal(view.document.querySelectorAll('button, [hidden], details').length,0);
    assert.match(links[0].textContent,/0원/);assert.match(links[1].textContent,/—/);
    assert.equal(view.document.querySelectorAll('[aria-current="page"]').length,0);
  } finally {view.close();}
});

test('financial static projection retains cap labels through company membership and never invents a missing aggregate',()=>{
  const {DetailEntitySelector} = loadFor('/security/KOSPI.005930/per')('components/detail-entity-selector.tsx');
  const projected = [common,preferred].map(({securityId,routeCode,name,korName,ticker,type,exchange,per})=>({securityId,routeCode,name,korName,ticker,type,exchange,per}));
  const view = documentFor(DetailEntitySelector,{...selectorProps,companySecs:projected,metric:'per'});
  const historical = documentFor(DetailEntitySelector,{...selectorProps,company:null,companySecs:[],security:{...common,marketcap:null},metric:'per',periodId:'old'});
  try {
    assert.match(view.document.querySelector('[data-security-id="common"]').textContent,/495조원/);
    assert.match(view.document.querySelector('[data-security-id="preferred"]').textContent,/54조원/);
    assert.equal(historical.document.querySelector('.detail-entity-aggregate'),null);
    assert.equal(historical.document.querySelectorAll('[data-security-id]').length,1);
    assert.match(historical.document.querySelector('[data-security-id]').textContent,/—/);
  } finally {view.close();historical.close();}
});

test('stock detail keeps eight fixed tabs including an active basic page and preserves range and episode query',()=>{
  const expected = ['기본 정보','시가총액','PER','PBR','EPS','BPS','배당수익률','주당배당금'];
  for (const suffix of ['', '/per', '/bps']) {
    const pathname = '/security/KOSPI.005930'+suffix;
    const {CompanyFinancialTabs} = loadFor(pathname)('components/company-financial-tabs.tsx');
    const view = documentFor(CompanyFinancialTabs,{security:common,company,periodId:'episode',start:'2026-01-01',end:'2026-10-08'});
    try {
      const links = [...view.document.querySelectorAll('a')];assert.deepEqual(links.map(link=>link.textContent),expected);
      assert.equal(view.document.querySelectorAll('[aria-current="page"]').length,1);
      assert.equal(view.document.querySelector('[aria-current="page"]').getAttribute('href').split('?')[0],pathname);
      for(const link of links) assert.match(link.getAttribute('href'),/start=2026-01-01&end=2026-10-08&period=episode$/);
    } finally {view.close();}
  }
});

test('company pages expose only two company tabs and never imply aggregate financial ratios',()=>{
  const {CompanyFinancialTabs} = loadFor('/company/KOSPI.005930/marketcap')('components/company-financial-tabs.tsx');
  const view = documentFor(CompanyFinancialTabs,{company,security:common,periodId:'stock-only'});
  try {
    const links = [...view.document.querySelectorAll('a')];assert.deepEqual(links.map(link=>link.textContent),['기업 정보','기업 합산 시총']);
    assert.equal(links[1].getAttribute('aria-current'),'page');assert.doesNotMatch(view.document.body.innerHTML,/period=|\/per|\/pbr/);
  } finally {view.close();}
});

test('detail hierarchy and actual section table of contents stay coherent without repeated target controls',()=>{
  const {DetailSurface} = loadFor('/security/KOSPI.005930/per')('components/detail-surface.tsx');
  const view = documentFor(DetailSurface,{...selectorProps,security:{...common,state:'published',price:'74000',priceState:'provided',priceDate:'2026-10-08',perState:'provided',perDate:'2026-10-08',publication,company:company.company},companyPage:false,metric:'per',search:{},ranking:{currentRank:620,rankDate:'2026-10-08'},neighbors:[{...preferred,currentRank:621}],history:[{date:'2026-10-08',value:'18.5'}],sourceHistory:[{date:'2026-10-08',per:'18.5'}],prices:common.prices});
  try {
    const doc = view.document;
    const order = ['h1','#entity-selection','.detail-metric-nav','#current-overview','#chart-analysis','#indicators','#annual-data','#history-download','#metric-formula','#publication-basis','#securities-summary','#nearby-ranks'].map(selector=>{const node=doc.querySelector(selector);assert.ok(node,selector);return node;});
    for(let i=1;i<order.length;i++) assert.ok(order[i-1].compareDocumentPosition(order[i]) & 4,`order ${i}`);
    assert.equal(doc.querySelectorAll('nav[aria-label="기업 전체와 구성 종목 선택"]').length,1);
    assert.equal(doc.querySelectorAll('aside .detail-metric-nav, aside .security-comparison').length,0);
    const toc = [...doc.querySelectorAll('aside nav[aria-label="본문 목차"] a')];
    for(const link of toc) assert.ok(doc.querySelector(link.getAttribute('href')),link.textContent);
    for(let i=1;i<toc.length;i++) assert.ok(doc.querySelector(toc[i-1].getAttribute('href')).compareDocumentPosition(doc.querySelector(toc[i].getAttribute('href'))) & 4);
  } finally {view.close();}
});

test('listing episodes remain usable in the body after shared selection and summary, with a matching actual TOC anchor',()=>{
  const {DetailSurface} = loadFor('/security/KOSPI.005930/per')('components/detail-surface.tsx');
  const periods = [{periodId:'old',securityId:'common',listingDate:'2000-01-01',delistingDate:'2010-01-01'}, {periodId:'new',securityId:'common',listingDate:'2020-01-01',delistingDate:null}];
  const view = documentFor(DetailSurface,{...selectorProps,company:null,companySecs:[],security:{...common,state:'published',price:null,priceState:'no_observation',publication:null,company:null,listingPeriods:periods,selectedPeriod:periods[0],historicalPeriod:true},metric:'per',search:{period:'old',start:'2009-01-01'},ranking:null,neighbors:[],history:[],sourceHistory:[],prices:[]});
  try {
    const doc = view.document;
    const order = ['h1','#entity-selection','.detail-metric-nav','#current-overview','.detail-mobile-context','#chart-analysis','#metric-formula','#listing-history'].map(selector=>doc.querySelector(selector));
    for(const node of order) assert.ok(node);
    for(let i=1;i<order.length;i++) assert.ok(order[i-1].compareDocumentPosition(order[i]) & 4);
    const episodeLinks = [...doc.querySelectorAll('#listing-history nav a')];
    assert.equal(episodeLinks.length,2);assert.match(episodeLinks[1].getAttribute('href'),/start=2009-01-01&period=new/);
    assert.equal(episodeLinks[0].getAttribute('aria-current'),'page');
    assert.match(doc.querySelector('#listing-history').textContent,/이전 상장기의 자료/);
    assert.ok(doc.querySelector('aside a[href="#listing-history"]'));
    assert.equal(doc.querySelectorAll('#listing-history').length,1);
  } finally {view.close();}
});

test('compact rail metric labels retain exact source values in the body export contract',async()=>{
  const {pageLoader} = require('./helpers/detail-presentation-loader.cjs');
  const exact = '1687385493086466';
  const fixture = pageLoader({security:{...common,state:'published',marketcap:exact,marketcapState:'provided',marketcapDate:'2026-10-08',price:'74000',priceState:'provided',priceDate:'2026-10-08',publication,company:null},company:null,companySecs:[],ranking:{currentRank:1,rankDate:'2026-10-08'},neighbors:[],priceHistory:[],history:[{date:'2026-10-08',marketcap:exact}]});
  renderToStaticMarkup(await fixture.pages.RestoredSecurityDetail({code:'common',metric:'marketcap'}));
  assert.equal(fixture.facts().rows.find(([label])=>label==='현재 시가총액')[1],'1687조원');
  assert.equal(fixture.csv().data[0].marketcap,exact);
});

test('summary keeps zero metric, price and stored daily rate distinct from missing values',()=>{
  const RankHeader = loadFor('/security/common/per')('components/header-rank.tsx').default;
  const view = documentFor(RankHeader,{marketcap:'0',marketcapUnit:'배',price:'0',priceRate:0,rank:7});
  try {
    const doc = view.document;
    assert.equal(doc.querySelector('[data-role="metric"] .detail-summary-value').textContent,'0배');
    assert.equal(doc.querySelector('[data-role="price"] .detail-summary-value').textContent,'0원');
    assert.equal(doc.querySelector('[data-role="change"] .detail-summary-value').textContent,'0.00%');
    assert.equal(doc.querySelector('[data-role="change"]').dataset.direction,'flat');
    assert.equal(doc.querySelector('[data-role="price"]').dataset.direction,undefined);
  } finally {view.close();}
});

test('summary signs only a supplied rate while basic stock information leads with a neutral absolute price',()=>{
  const RankHeader = loadFor('/security/common')('components/header-rank.tsx').default;
  for(const [price,priceRate,expected,direction] of [['74000',-1.23,'-1.23%','down'],['74000',2.13,'+2.13%','up'],['74000',null,'—','flat'],[null,-1.23,'—','flat']]) {
    const view = documentFor(RankHeader,{basic:true,marketcap:'495000000000000',price,priceRate,rank:1});
    try {
      const doc = view.document;
      assert.deepEqual([...doc.querySelectorAll('.detail-summary-item')].map(node=>node.dataset.role),['price','rank','metric','change']);
      assert.equal(doc.querySelector('[data-role="price"]').dataset.primary,'true');
      assert.equal(doc.querySelector('[data-role="price"]').dataset.direction,undefined);
      assert.equal(doc.querySelector('[data-role="change"] .detail-summary-value').textContent,expected);
      assert.equal(doc.querySelector('[data-role="change"]').dataset.direction,direction);
      assert.equal(doc.querySelector('[data-role="price"] .detail-summary-value').textContent,price==null?'—':'74,000원');
    } finally {view.close();}
  }
});

test('known exclusion states are translated once and unknown internal codes are not exposed to visitors',()=>{
  const {DetailSurface} = loadFor('/security/common/per')('components/detail-surface.tsx');
  const initial = {...selectorProps,security:{...common,per:null,perState:'source_missing',state:'published',price:null,priceState:'source_missing',publication,company:null},metric:'per',search:{},ranking:{currentRank:null,exclusionReason:'source_missing'},neighbors:[],history:[],sourceHistory:[],prices:[]};
  for(const [reason,expected] of [['source_missing','원천 미제공'],['unexplained_missing','자료 확인 필요'],['internal_missing_rule','순위 산정 기준을 충족하지 않습니다.']]) {
    const view = documentFor(DetailSurface,{...initial,ranking:{currentRank:null,exclusionReason:reason}});
    try {
      const text = view.document.querySelector('#current-overview').textContent;
      assert.doesNotMatch(text,/(source_missing|unexplained_missing|internal_missing_rule)/);
      assert.ok(text.includes(expected));
      if(reason==='source_missing') {assert.equal(text.split('원천 미제공').length-1,1);assert.doesNotMatch(text,/순위 제외 사유/);}
    } finally {view.close();}
  }
});

test('basic stock summary requests its marketcap ranking while retaining the quote and forwarding the selected listing episode',async()=>{
  const previousMode = process.env.NEXT_OUTPUT_MODE;
  delete process.env.NEXT_OUTPUT_MODE;
  try {
    const calls = [];
    const snapshot = {security:{...common,state:'published',price:'74000',priceState:'provided',priceDate:'2026-10-08',publication,company:null},company:null,companySecs:[],ranking:{currentRank:1,rankDate:'2026-10-08'},neighbors:[],history:[],priceHistory:common.prices};
    const {RestoredSecurityDetail} = loader({'@/lib/data/detail-snapshot':{
      getSecurityDetailSnapshot:async(...args)=>{calls.push(args);return snapshot;},getCompanyDetailSnapshot:async()=>null,
    }})('components/restored-detail-page.tsx');
    const latest = await RestoredSecurityDetail({code:'KOSPI.005930',basic:true});
    const selected = await RestoredSecurityDetail({code:'KOSPI.005930',basic:true,search:{period:['old-episode','ignored']}});
    assert.deepEqual(calls,[['KOSPI.005930','marketcap'],['KOSPI.005930','marketcap',undefined,undefined,'old-episode']]);
    assert.equal(latest.props.ranking.currentRank,1);assert.equal(latest.props.basic,true);
    assert.deepEqual(latest.props.prices,snapshot.priceHistory);
    assert.deepEqual(selected.props.search.period,['old-episode','ignored']);
    assert.deepEqual(selected.props.prices,snapshot.priceHistory);
  } finally {
    if(previousMode===undefined) delete process.env.NEXT_OUTPUT_MODE;else process.env.NEXT_OUTPUT_MODE=previousMode;
  }
});

function primaryDetailProps(overrides={}) {
  return {...selectorProps,security:{...common,state:'published',marketcapState:'provided',price:'74000',priceState:'provided',priceDate:'2026-10-08',publication,company:company.company},search:{},ranking:{currentRank:1,rankDate:'2026-10-08'},neighbors:[],history:[],sourceHistory:[],prices:common.prices,...overrides};
}

test('company cap groups the official summary with its comparison before the full-width history',()=>{
  const {DetailSurface} = loadFor('/company/KOSPI.005930/marketcap')('components/detail-surface.tsx');
  const view = documentFor(DetailSurface,primaryDetailProps({companyPage:true}));
  try {
    const doc=view.document, primary=doc.querySelector('.detail-cap-record-grid');
    assert.ok(primary);assert.equal(primary.children[0].id,'current-overview');assert.equal(primary.children[1].id,'securities-summary');
    assert.ok(primary.compareDocumentPosition(doc.querySelector('#chart-analysis')) & 4);
    assert.equal(doc.querySelectorAll('#current-overview').length,1);assert.equal(doc.querySelectorAll('#securities-summary').length,1);
    assert.equal(doc.querySelector('[data-security-id="preferred"]').getAttribute('href'),'/security/KOSPI.005935/marketcap');
  } finally {view.close();}
});

test('basic stock pairs real current/history with comparison/company facts and keeps mobile source order and lifecycle access',()=>{
  const observed=[];
  const {DetailSurface}=loadFor('/security/KOSPI.005930',{'@/components/restored-detail-charts':{
    DetailFinancialAnalysis:empty,DetailAnnualHistory:empty,DetailPriceHistory:props=>{observed.push(props);return React.createElement('div',{'data-testid':'actual-price-history'});},
  }})('components/detail-surface.tsx');
  const prices=[{date:'2026-10-01',close:'0',volume:'9007199254740993'},{date:'2026-10-07',close:'73000'},{date:'2026-10-08',close:'74000',rate:0,open:'73000',volume:'9007199254740994'}];
  const before=JSON.stringify(prices);
  const period={periodId:'current',securityId:'common',listingDate:'2000-01-01',delistingDate:null};
  const input=primaryDetailProps({basic:true,prices,search:{start:'2026-10-01',end:'2026-10-08'},security:{...primaryDetailProps().security,listingPeriods:[period],selectedPeriod:period,shares:'9007199254740995',sharesDate:'2026-10-08'}});
  const view=documentFor(DetailSurface,input);
  try {
    const doc=view.document, primary=doc.querySelector('.detail-basic-record-grid');
    assert.ok(primary.classList.contains('detail-basic-has-comparison'));
    assert.deepEqual([...primary.children].map(node=>node.id),['current-overview','securities-summary','price-history','company-information','basic-information']);
    assert.equal(observed.length,1);assert.strictEqual(observed[0].rows,prices);assert.equal(observed[0].start,'2026-10-01');assert.equal(observed[0].end,'2026-10-08');
    assert.equal(observed[0].rows[0].close,'0');assert.equal(observed[0].rows[0].volume,'9007199254740993');assert.equal(JSON.stringify(prices),before);
    assert.equal(doc.querySelectorAll('#price-information').length,1);assert.equal(doc.querySelectorAll('#price-history').length,1);
    assert.ok(primary.compareDocumentPosition(doc.querySelector('#listing-history')) & 4);
    const toc=[...doc.querySelectorAll('aside nav[aria-label="본문 목차"] a')];
    for(let i=1;i<toc.length;i++) assert.ok(doc.querySelector(toc[i-1].getAttribute('href')).compareDocumentPosition(doc.querySelector(toc[i].getAttribute('href'))) & 4);
  } finally {view.close();}
});
