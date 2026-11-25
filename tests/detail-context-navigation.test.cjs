const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const {createRoot} = require('react-dom/client');
const {JSDOM} = require('jsdom');
const {loader,renderToStaticMarkup} = require('./helpers/detail-presentation-loader.cjs');

const { publication, common, preferred, company, empty, chartBoundary, loadFor, documentFor, selectorProps, primaryDetailProps, assertOrder } = require('./helpers/detail-surface.cjs');

function verifyOutline(doc) {
  const links = [...doc.querySelectorAll('aside nav[aria-label="본문 목차"] a')];
  assert.ok(links.length);
  for (const link of links) assert.equal(doc.querySelectorAll(link.hash).length, 1, link.hash);
  assertOrder(doc, links.map(link => link.hash));
  return links.map(link => link.hash);
}
test('a sibling uses its own security identity and only the selected stock keeps the listing episode', () => {
  const {detailSwitchCandidates} = loadFor('/security/KOSPI.005930/per')('components/detail-investor-records.tsx');
  const candidates = detailSwitchCandidates({members: [common, preferred], current: common,
    companyPage: false, basic: false, metric: 'per', scope: {periodId: 'common-episode'}});
  assert.equal(candidates[0].href, '/security/KOSPI.005930/per?period=common-episode');
  assert.equal(candidates[0].selected, true);
  assert.equal(candidates[1].href, undefined);
  assert.equal(candidates[1].selected, false);
});

test('all same-name constituents with distinct IDs have distinct stock destinations', () => {
  const {detailSwitchCandidates} = loadFor('/company/common/marketcap')('components/detail-investor-records.tsx');
  const members = Array.from({length: 9}, (_, index) => ({...preferred, securityId: 'preferred-' + index,
    routeCode: null, korName: '같은 이름', ticker: 'DUP', marketcap: index === 0 ? '0' : null}));
  const candidates = detailSwitchCandidates({members, current: null, companyPage: true, basic: false, metric: 'marketcap', scope: {}});
  assert.equal(candidates.length, members.length);
  assert.equal(new Set(candidates.map(row => row.href)).size, members.length);
  assert.ok(candidates.every(row => row.href && !row.selected));
  assert.equal(candidates[0].value, '0원');
  assert.equal(candidates[1].value, '—');
});

test('comparison rows enrich only the official membership and preserve its capitalization and date', () => {
  const {detailEntityMembers} = loadFor('/company/common/marketcap')('components/detail-investor-records.tsx');
  const closed = {...common, securityId: 'closed', marketcap: null};
  const listed = {...company, securities: [common, {...preferred, marketcap: null}]};
  const comparison = [{...preferred, per: '8', marketcap: '999', marketcapDate: '2026-01-02'}, closed];
  const members = detailEntityMembers(listed, comparison, closed);
  assert.deepEqual(members.map(row => [row.securityId, row.marketcap]), [['common', common.marketcap], ['preferred', null]]);
  assert.equal(members[1].per, '8');
  assert.equal(members[1].marketcapDate, preferred.marketcapDate);
  assert.deepEqual(detailEntityMembers({...listed, securities: []}, comparison, closed), []);
  assert.deepEqual(detailEntityMembers(null, comparison, closed), [closed]);
  assert.deepEqual(detailEntityMembers(null, comparison, null), []);
});

test('fallback stock navigation keeps seven fixed metrics and preserves range and episode query',()=>{
  const expected = ['시가총액','PER','PBR','EPS','BPS','배당수익률','주당배당금'];
  for (const suffix of ['/marketcap', '/per', '/bps']) {
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

test('fallback company navigation exposes only company destinations and never imply aggregate financial ratios',()=>{
  const {CompanyFinancialTabs} = loadFor('/company/KOSPI.005930/marketcap')('components/company-financial-tabs.tsx');
  const view = documentFor(CompanyFinancialTabs,{company,security:common,periodId:'stock-only'});
  try {
    const links = [...view.document.querySelectorAll('a')];assert.deepEqual(links.map(link=>link.textContent),['기업 개요','시가총액']);
    assert.equal(links[1].getAttribute('aria-current'),'page');assert.doesNotMatch(view.document.body.innerHTML,/period=|\/per|\/pbr/);
  } finally {view.close();}
});

test('PER opens its investor records in order and all outlines target the same content',()=>{
  const {DetailSurface} = loadFor('/security/KOSPI.005930/per')('components/detail-surface.tsx');
  const view = documentFor(DetailSurface,primaryDetailProps({metric:'per',neighbors:[{securityId:'ranked-peer',name:'인접 종목',per:'13.5',currentRank:2}],history:[{date:'2026-10-08',value:'18.5'}],sourceHistory:[{date:'2026-10-08',per:'18.5'}]}));
  try {
    const doc=view.document;
    const order=['#chart-analysis','#metric-analysis','#indicators','#monthly-records','#annual-data','#price-history','#nearby-ranks'];
    assertOrder(doc,['h1','#current-overview',...order]);
    assert.deepEqual(verifyOutline(doc),order);
    assert.deepEqual([...doc.querySelectorAll('#detail-metric-navigation [data-detail-side-outline="left"] nav a')].map(link=>link.hash),order);
    assert.deepEqual([...doc.querySelectorAll('.investor-outline-inline nav a')].map(link=>link.hash),order);
    const inline = doc.querySelector('[data-detail-inline-outline]');
    assert.equal(inline.tagName, 'DETAILS');
    assert.equal(inline.open, false);
    assert.equal(inline.querySelector('summary').textContent.trim(), '이 페이지에서');
    const headerOutline = doc.querySelector('[data-detail-header-actions] [data-detail-header-outline]');
    assert.equal(headerOutline.querySelector('summary').textContent.trim(), '목차');
    assert.equal(headerOutline.open, false);
    assert.equal(headerOutline.closest('[data-detail-header]').hasAttribute('data-outline-promoted'), false);
    const metricButton = doc.querySelector('[data-detail-header] [data-detail-title-group] button[data-detail-metric-disclosure]');
    assert.equal(metricButton.textContent.trim(), 'PER');
    assert.equal(metricButton.getAttribute('aria-label'), '지표 변경, 현재 PER');
    assert.equal(metricButton.getAttribute('aria-expanded'), 'false');
    assert.equal(doc.querySelector('#detail-metric-navigation button'), null);
    assert.equal(doc.querySelector('h1').textContent, '삼성전자 PER');
    for (const id of order) assert.equal(doc.querySelector(id).closest('details:not([open])'),null);
    assert.equal(doc.querySelectorAll('nav[aria-label="기업·종목 지표 이동"]').length,1);
    assert.equal(doc.querySelector('aside #detail-metric-navigation'),null);
  } finally {view.close();}
});

test('PBR, EPS and BPS outlines follow the approved record order and link only provided related metrics', () => {
  const orders = {
    pbr: ['chart-analysis', 'book-value', 'indicators', 'annual-data', 'price-history', 'nearby-ranks'],
    eps: ['chart-analysis', 'annual-data', 'indicators', 'price-history', 'nearby-ranks'],
    bps: ['chart-analysis', 'annual-data', 'indicators', 'metric-analysis', 'monthly-records', 'price-history', 'nearby-ranks'],
  };
  for (const [metric, order] of Object.entries(orders)) {
    const { DetailSurface } = loadFor('/security/KOSPI.005930/' + metric)('components/detail-surface.tsx');
    const props = primaryDetailProps({ metric, search: { start: '2024-01-01' },
      neighbors: [{ ...preferred, currentRank: 2, value: '0' }] });
    const view = documentFor(DetailSurface, { ...props, security: { ...props.security,
      [metric]: '4', [metric + 'Date']: '2026-10-08', pbr: '2.12345', pbrDate: '2026-10-05', bps: '1000',
      availableMetrics: metric === 'eps' ? ['eps'] : [metric, metric === 'pbr' ? 'bps' : 'pbr'],
    } });
    try {
      const doc = view.document;
      const hashes = order.map(id => '#' + id);
      assertOrder(doc, ['#current-overview', ...hashes]);
      assert.deepEqual(verifyOutline(doc), hashes);
      if (metric === 'pbr') {
        assert.equal(doc.querySelector('#book-value header a').getAttribute('href'), '/security/KOSPI.005930/bps?start=2024-01-01');
      } else {
        const summary = doc.querySelector(`[aria-label="현재 ${metric.toUpperCase()} 구성"] .calculationInputs`);
        assert.deepEqual([...summary.querySelectorAll('dt')].map(dt => dt.textContent), metric === 'eps' ? ['종가'] : ['종가', 'PBR']);
        assert.match(summary.querySelector('a[href="/security/KOSPI.005930/marketcap/#price-history"]').textContent, /74,000원/);
        if (metric === 'bps') assert.equal(summary.querySelector('a[href*="/pbr?"]').textContent, '2.12배');
      }
    } finally { view.close(); }
  }
});

test('financial peer destinations in the body and rail share selected IDs, dates, and provided values',()=>{
  const {DetailSurface} = loadFor('/security/KOSPI.005930/per')('components/detail-surface.tsx');
  const zero = {...preferred, securityId:'zero-per', routeCode:null, ticker:null, korName:'영배수 표본', per:'0'};
  const missing = {...preferred, securityId:'no-per', routeCode:'KOSPI.005937', ticker:'005937', per:null};
  const members = [common, zero, missing];
  const view = documentFor(DetailSurface, primaryDetailProps({metric:'per',company:{...company,securities:members},companySecs:members,
    search:{start:'2026-08-01',end:'2026-10-08'}}));
  try {
    const doc = view.document;
    const body = doc.querySelector('.investor-content nav[aria-label="종목 전환"]');
    const rail = doc.querySelector('[data-detail-peer-navigation]');
    const read = nav => [...nav.querySelectorAll('a[data-security-id]')].map(a => [a.dataset.securityId, a.getAttribute('href'), a.getAttribute('aria-current')]);
    assert.deepEqual(read(body), read(rail));
    assert.deepEqual(read(rail), [
      ['common', '/security/KOSPI.005930/per?start=2026-08-01&end=2026-10-08', 'page'],
      ['zero-per', '/security/zero-per/per?start=2026-08-01&end=2026-10-08', null],
    ]);
    assert.match(rail.querySelector('[data-security-id="zero-per"]').textContent, /0배/);
    assertOrder(doc, ['[data-detail-peer-navigation]', 'aside dl', 'aside nav[aria-label="본문 목차"]']);
  } finally {view.close();}
});

test('peer navigation needs two actionable same-metric destinations',()=>{
  const {DetailInvestorRail} = loadFor('/security/KOSPI.005930/per')('components/detail-investor-navigation.tsx');
  const candidates = [
    {securityId:'common',name:'삼성전자',href:'/security/KOSPI.005930/per',selected:true},
    {securityId:'preferred',name:'삼성전자우',selected:false},
  ];
  const view = documentFor(DetailInvestorRail,{candidates,facts:[],sections:[],secCode:'common'});
  try {
    assert.equal(view.document.querySelector('[data-detail-peer-navigation]'), null);
    assert.ok(view.document.querySelector('aside[aria-label="상세 요약과 탐색"]'));
  } finally {view.close();}
});

test('stock marketcap shows prior listing episodes with a matching actual TOC anchor',()=>{
  const {DetailSurface} = loadFor('/security/KOSPI.005930/marketcap')('components/detail-surface.tsx');
  const periods = [{periodId:'old',securityId:'common',listingDate:'2000-01-01',delistingDate:'2010-01-01'}, {periodId:'new',securityId:'common',listingDate:'2020-01-01',delistingDate:null}];
  const view = documentFor(DetailSurface,{...selectorProps,company:null,companySecs:[],security:{...common,state:'published',price:null,priceState:'no_observation',publication:null,company:null,listingPeriods:periods,selectedPeriod:periods[0],historicalPeriod:true},metric:'marketcap',search:{period:'old',start:'2009-01-01'},ranking:null,neighbors:[],history:[],sourceHistory:[],prices:[]});
  try {
    const doc = view.document;
    assertOrder(doc,['h1','#current-overview','.investor-outline-inline','#listing-history']);
    verifyOutline(doc);
    const episodeLinks = [...doc.querySelectorAll('#listing-history nav a')];
    assert.equal(episodeLinks.length,2);assert.match(episodeLinks[1].getAttribute('href'),/start=2009-01-01&period=new/);
    assert.equal(episodeLinks[0].getAttribute('aria-current'),'page');
    assert.match(doc.querySelector('.investor-content').textContent,/이전 상장기의 자료/);
    assert.ok(doc.querySelector('aside a[href="#listing-history"]'));
    assert.equal(doc.querySelectorAll('#listing-history').length,1);
  } finally {view.close();}
});

test('compact rail metric labels retain exact source values in the body export contract',async()=>{
  const {pageLoader} = require('./helpers/detail-presentation-loader.cjs');
  const exact = '1687385493086466';
  const fixture = pageLoader({security:{...common,state:'published',marketcap:exact,marketcapState:'provided',marketcapDate:'2026-10-08',price:'74000',priceState:'provided',priceDate:'2026-10-08',publication,company:null},company:null,companySecs:[],ranking:{currentRank:1,rankDate:'2026-10-08'},neighbors:[],priceHistory:[],history:[{date:'2026-10-08',marketcap:exact}]});
  const dom = new JSDOM(renderToStaticMarkup(await fixture.pages.RestoredSecurityDetail({code:'common',metric:'marketcap'})));
  const amount = dom.window.document.querySelector('#current-overview .headlineAmount [title]');
  assert.equal(amount.textContent,'1,687조 3,855억원');
  assert.equal(amount.title,'1,687,385,493,086,466원');
  dom.window.close();
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

test('the price-first rank header keeps the close neutral and signs only a supplied daily rate',()=>{
  const RankHeader = loader()('components/header-rank.tsx').default;
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
      const text = view.document.querySelector('.investor-overview').textContent;
      assert.doesNotMatch(text,/(source_missing|unexplained_missing|internal_missing_rule)/);
      assert.ok(text.includes(expected));
      if(reason==='source_missing') {assert.equal(text.split('원천 미제공').length-1,1);assert.doesNotMatch(text,/순위 제외 사유/);}
    } finally {view.close();}
  }
});

test('stock marketcap requests its official ranking while retaining the quote and forwarding the selected listing episode',async()=>{
  const previousMode = process.env.NEXT_OUTPUT_MODE;
  delete process.env.NEXT_OUTPUT_MODE;
  try {
    const calls = [];
    const snapshot = {security:{...common,state:'published',price:'74000',priceState:'provided',priceDate:'2026-10-08',publication,company:null},company:null,companySecs:[],ranking:{currentRank:1,rankDate:'2026-10-08'},neighbors:[],history:[],priceHistory:common.prices};
    const {RestoredSecurityDetail} = loader({'@/lib/data/detail-snapshot':{
      getSecurityDetailSnapshot:async(...args)=>{calls.push(args);return snapshot;},getCompanyDetailSnapshot:async()=>null,
    }})('components/restored-detail-page.tsx');
    const latest = await RestoredSecurityDetail({code:'KOSPI.005930',metric:'marketcap'});
    const selected = await RestoredSecurityDetail({code:'KOSPI.005930',metric:'marketcap',search:{period:['old-episode','ignored']}});
    assert.deepEqual(calls,[['KOSPI.005930','marketcap'],['KOSPI.005930','marketcap',undefined,undefined,'old-episode']]);
    assert.equal(latest.props.ranking.currentRank,1);assert.equal(latest.props.metric,'marketcap');
    assert.deepEqual(latest.props.prices,snapshot.priceHistory);
    assert.deepEqual(selected.props.search.period,['old-episode','ignored']);
    assert.deepEqual(selected.props.prices,snapshot.priceHistory);
  } finally {
    if(previousMode===undefined) delete process.env.NEXT_OUTPUT_MODE;else process.env.NEXT_OUTPUT_MODE=previousMode;
  }
});

test('the title marketcap switch keeps its place and identifies the highlighted scope', async () => {
  const dom = new JSDOM('<div id="header"></div><button id="outside">닫기</button>');
  const win = dom.window;
  const doc = win.document;
  const desktop = Object.assign(new win.EventTarget(), { matches: false });
  win.matchMedia = () => desktop;
  const globals = { window: win, document: doc, Node: win.Node, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  const { DetailMarketcapTitleSwitch } = loadFor('/security/KOSPI.005930/marketcap', {
    '@/components/detail-marketcap-composition': { MarketcapComposition: empty },
  })('components/detail-investor-navigation.tsx');
  const root = createRoot(doc.getElementById('header'));
  try {
    for (const [selected, seriesType, label, color] of [
      ['aggregate', null, '합산', 'var(--brand-ink)'],
      ['common', '보통주', '005930· 보통주', 'var(--market-up)'],
      ['preferred', '우선주', '005935· 우선주', 'var(--market-down)'],
    ]) {
      const members = [common, preferred].map(row => ({ candidate: { ...row, name: row.korName,
        href: `/security/${row.routeCode}/marketcap`, selected: row.securityId === selected } }));
      const aggregate = { candidate: { securityId: 'aggregate', name: '기업 합산', selected: selected === 'aggregate' } };
      await React.act(async () => root.render(React.createElement(DetailMarketcapTitleSwitch, {
        model: { members, aggregate }, sections: [], seriesType,
      })));
      const picker = doc.querySelector('[data-detail-cap-title]');
      const summary = picker.querySelector('summary');
      assert.equal(summary.textContent, label);
      assert.equal(summary.firstElementChild.style.backgroundColor, color);
      const status = doc.querySelector('[data-detail-cap-status]');
      assert.equal(status.querySelector('strong').textContent, summary.querySelector('strong').textContent);
      assert.equal(status.querySelector('[aria-hidden]').style.backgroundColor, color);
      assert.equal(status.querySelector('button, summary, a, svg'), null);
      assert.equal(picker.hidden, false);
      summary.click();
      win.dispatchEvent(new win.Event('scroll'));
      assert.equal(picker.open, true);
      summary.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      assert.equal(picker.open, false);
      assert.equal(doc.activeElement, summary);
      summary.click();
      doc.getElementById('outside').dispatchEvent(new win.Event('pointerdown', { bubbles: true }));
      assert.equal(picker.open, false);
      summary.click();
      desktop.matches = true;
      desktop.dispatchEvent(new win.Event('change'));
      assert.equal(picker.open, false);
      desktop.matches = false;
    }
  } finally {
    await React.act(async () => root.unmount());
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    win.close();
  }
});

test('the one full-history CSV sits by copy and share while the dividend comparison download stays in its record',()=>{
  const {DetailSurface}=loadFor('/security/KOSPI.005930',{'@/components/share-button':{__esModule:true,default:()=>React.createElement('div',
    {'data-share-actions':true},React.createElement('button',null,'링크 복사'),React.createElement('button',null,'공유하기'))},
    '@/components/CsvDownloadButton':{CsvDownloadButton:({label,buttonText,historyFeedback})=>React.createElement('button',
      {'aria-label':label,'data-history-feedback':historyFeedback},buttonText || label)},
  })('components/detail-surface.tsx');
  for (const metric of ['marketcap','per','pbr','eps','bps','dps','div']) {
    const view=documentFor(DetailSurface,primaryDetailProps({metric,history:[{date:'2026-10-08',value:'0'}],sourceHistory:[{date:'2026-10-08',[metric]:'0'}]}));
    try {
      const doc=view.document;
      const actions=doc.querySelector('[data-detail-header] [data-detail-header-actions]');
      assert.equal(doc.querySelectorAll('#history-download').length,1);
      assert.equal(doc.querySelector('.investor-overview #history-download'),null);
      assert.deepEqual([...actions.querySelectorAll('button')].slice(0,2).map(button=>button.textContent),['링크 복사','공유하기']);
      const historyButton=actions.querySelector('#history-download button');
      assert.match(historyButton.getAttribute('aria-label'),/^삼성전자 .+ 전체 이력 CSV$/);
      assert.equal(historyButton.textContent,'CSV');
      assert.ok(doc.querySelector('[data-detail-header]').classList.contains('compactMetricHeader'));
      assert.equal(historyButton.dataset.historyFeedback,'toast');
      if (metric==='marketcap') {
        const switcher=doc.querySelector('[data-detail-header] [data-detail-title-group] > [data-detail-cap-title]');
        assert.equal(switcher.hidden, false);
        assert.equal(switcher.querySelector('summary').getAttribute('aria-label'), '시가총액 대상, 현재 005930 보통주');
        assert.ok(switcher.querySelector('a[href*="KOSPI.005935/marketcap"]'));
      }
      if (metric==='dps' || metric==='div') {
        assert.match(doc.querySelector('#dividend-summary button').textContent,/배당 비교표 CSV/);
        assert.doesNotMatch(actions.textContent,/배당 비교표 CSV/);
      }
    } finally {view.close();}
  }
});

test('financial neighbor links choose the closest official ranks and omit invalid, tied or missing observations',()=>{
  const {DetailSurface}=loadFor('/security/KOSPI.005930/div')('components/detail-surface.tsx');
  const props=primaryDetailProps({metric:'div',ranking:{currentRank:12},search:{start:'2026-01-01',period:'period-a'}});
  const peer=(position,value)=>({...preferred,securityId:'sid-'+position,korName:'종목 '+position,currentRank:position,value});
  const higher=peer(9,'0'); const lower=peer(17,'0.014');
  const invalid=[peer(12,'1'),{...peer(13,null),div:'1'},peer('invalid','1'),{...common,currentRank:11,value:'1'}];
  for (const [valid,expected] of [[[peer(3,'1'),lower,higher,peer(19,'1')],['higher','lower']],[[lower],['lower']],[[],[]]]) {
    const view=documentFor(DetailSurface,{...props,security:{...props.security,div:'0.33',divState:'provided',divDate:'2026-10-08'},
      neighbors:[...invalid,...valid]});
    try {
      const nav=view.document.querySelector('#nearby-ranks nav');
      const links=nav ? [...nav.querySelectorAll('a')] : [];
      assert.deepEqual(links.map(link=>link.dataset.direction),expected);
      for (const link of links) {
        assert.equal(link.getAttribute('href'),'/security/KOSPI.005935/div?start=2026-01-01');
        if(link.dataset.direction==='higher') assert.match(link.textContent,/높은 순위9위종목 90%/);
        else assert.match(link.textContent,/낮은 순위17위종목 170.01%/);
      }
      if (!links.length) assert.equal(view.document.querySelector('#nearby-ranks'),null);
    } finally {view.close();}
  }
});

test('marketcap period tables compare exact observations to the current value in the selected ranking scope', () => {
  const {DetailSurface} = loadFor('/security/KOSPI.005930/marketcap')('components/detail-surface.tsx');
  const history = [
    {date:'2024-10-10', value:'100000000000000'},
    {date:'2026-10-07', value:'90000000000000'},
    {date:'2026-10-08', value:'94000000000000'},
  ];
  for (const companyPage of [false, true]) {
    const props = primaryDetailProps({companyPage, history,
      company:{...company,totalMarketcap:'96000000000000'},
      security:{...primaryDetailProps().security,marketcap:'93500000000000'}});
    const view = documentFor(DetailSurface, props);
    try {
      const section = view.document.querySelector('#indicators');
      const [period, mean, difference] = section.querySelector('tbody tr').cells;
      assert.equal(period.querySelector('time').dateTime, '2026-10-07');
      assert.match(period.textContent, /2개 관측/);
      assert.equal(mean.querySelector('[title]').title, '92,000,000,000,000원');
      assert.equal(mean.textContent, '92조원3년 평균 대비 −2.82%');
      assert.equal(difference.querySelector('.market-up').textContent, companyPage ? '+4조원' : '+1조 5,000억원');
      assert.equal(difference.querySelector('small').textContent, companyPage ? '평균 대비 +4.35%' : '평균 대비 +1.63%');
    } finally {view.close();}

    const earlier = documentFor(DetailSurface, {...props, search:{end:'2026-10-07'}});
    try {
      const section = earlier.document.querySelector('#indicators');
      assert.equal(section.querySelector('thead tr').cells.length, 2);
      assert.match(section.querySelector('tbody tr').textContent, /90조원/);
    } finally {earlier.close();}
  }
});

test('marketcap neighbor cards keep each ranking scope and show only the nearest published ranks', () => {
  const {DetailSurface} = loadFor('/security/KOSPI.005930/marketcap')('components/detail-surface.tsx');
  for (const companyPage of [false, true]) {
    const peer = (id, rank, value) => companyPage
      ? {companyId:id, korName:id, marketcapRank:rank, totalMarketcap:value}
      : {securityId:id, korName:id, currentRank:rank, value};
    const higher = peer('높은 종목', 5, '115000000000000');
    const lower = peer('낮은 종목', 7, '66000000000000');
    const distant = peer('먼 종목', 4, '130000000000000');
    const view = documentFor(DetailSurface, primaryDetailProps({companyPage, ranking:{currentRank:6},
      search:{start:'2026-01-01',period:'current-listing'}, neighbors:[lower,distant,higher]}));
    try {
      const {document:doc} = view;
      const section = doc.querySelector('#nearby-ranks');
      assert.equal(doc.querySelector('#securities-summary, a[href="#securities-summary"]'), null);
      const outline = verifyOutline(doc);
      assert.equal(outline[outline.indexOf('#indicators') + 1], '#nearby-ranks');
      const links = [...section.querySelectorAll('nav a')];
      assert.deepEqual(links.map(link=>link.dataset.direction), ['higher','lower']);
      assert.equal(section.querySelector('table'), null);
      assert.equal(section.querySelector('header a').getAttribute('href'), companyPage ? '/marketcaps' : '/marketcap');
      for (const [index, row] of [higher, lower].entries()) {
        const scope = companyPage ? 'company' : 'security';
        assert.equal(links[index].getAttribute('href'), `/${scope}/${encodeURIComponent(row.korName)}/marketcap?start=2026-01-01`);
      }
      assert.deepEqual(links.map(link=>link.querySelector('.nearbyRankValue').textContent), ['115조원','66조원']);
    } finally {view.close();}
  }
});

test('both dividend routes keep selected records and same-date preferred-minus-common annual comparisons distinct',()=>{
  const observations = [
    {...common,availableMetrics:['div','dps'],dps:'1668',dpsDate:'2026-10-08',dpsRanking:{rank:151,date:'2026-10-08'},dividendHistory:[
      {date:'2024-12-30',div:'0',dps:'0'},{date:'2025-12-29',div:'0.2',dps:'1'},{date:'2026-10-08',div:'0.64',dps:'1668'},
    ]},
    {...preferred,availableMetrics:['div','dps'],dps:'1669',dpsDate:'2026-10-08',dpsRanking:{rank:150,date:'2026-10-07'},dividendHistory:[
      {date:'2024-12-30',div:'0',dps:'0'},{date:'2025-12-30',div:'0.3',dps:'2'},{date:'2026-10-08',div:'0.86',dps:'1669'},
    ]},
  ];
  const scope = {start:'2024-01-01',end:'2026-10-08'};
  for (const [metric, difference] of [['div','0.22'],['dps','1']]) for (const member of observations) {
    let trend, annual, chart;
    const {DetailSurface}=loadFor(`/security/${member.routeCode}/${metric}`,{
      '@/components/detail-history-chart':{DetailHistoryChart:props=>{trend=props;return null;}},
      '@/components/restored-detail-charts':{ChartWhenVisible:chartBoundary,DetailFinancialAnalysis:empty,DetailPriceHistory:empty,
        DetailAnnualHistory:props=>{annual=props;return null;},DividendComparisonChart:props=>{chart=props;return null;}},
    })('components/detail-surface.tsx');
    const other = observations.find(stock=>stock!==member);
    const view=documentFor(DetailSurface,primaryDetailProps({metric,companySecs:observations,search:scope,
      security:{...primaryDetailProps().security,...member,selectedPeriod:{periodId:member.securityId+'-period'}},
      history:member.dividendHistory.map(row=>({date:row.date,value:row[metric]})),sourceHistory:member.dividendHistory}));
    try {
      const doc=view.document;
      assert.ok(doc.querySelector('#chart-analysis h2').textContent.startsWith(member.korName+' '));
      assert.equal(doc.querySelector('#annual-data h2').textContent,'연도별 기록');
      if (metric === 'div') assertOrder(doc, ['#annual-data', '#metric-analysis', '#price-history']);
      assert.equal(trend.rows.at(-1).value,member.dividendHistory.at(-1)[metric]);
      assert.equal(annual.rows[0].value,member.dividendHistory.at(-1)[metric]);
      assert.deepEqual(annual.dividendComparison.byDate,{
        '2026-10-08':{preferred:difference},[member.dividendHistory[1].date]:{preferred:null},'2024-12-30':{preferred:'0'},
      });
      assert.equal(chart.selectedSecurityId,member.securityId);
      assert.deepEqual(chart.members.map(stock=>stock.securityId),['common','preferred']);
      assert.deepEqual([chart.start,chart.end],[scope.start,scope.end]);
      assert.equal(doc.querySelector('#dividend-summary').tabIndex,-1);
      assert.equal(doc.querySelector('#dividend-summary').hasAttribute('data-divider'),metric === 'dps');
      assert.ok(verifyOutline(doc).includes('#dividend-summary'));
      assert.equal(doc.querySelector('aside a[href="#dividend-summary"]').textContent,doc.querySelector('#dividend-summary h2').textContent);
      const railRanks = [...doc.querySelectorAll('[data-detail-peer-navigation] .switchRank')];
      assert.equal(railRanks.length, metric === 'dps' ? 1 : 0);
      if (metric === 'dps') {
        assert.equal(railRanks[0].closest('a').dataset.securityId, other.securityId);
        assert.match(railRanks[0].textContent, new RegExp(`${other.dpsRanking.rank}위`));
        assert.equal(railRanks[0].querySelector('time')?.dateTime, other === observations[1] ? other.dpsRanking.date : undefined);
        assert.equal(railRanks[0].nextSibling?.textContent, `${Number(other.dps).toLocaleString('ko-KR')}원`);
      }
      for (const prefix of ['#dividend-summary','[data-detail-peer-navigation]']) {
        const link=doc.querySelector(`${prefix} a[data-security-id="${other.securityId}"]`);
        const target=new URL(link.href,'https://example.test');
        assert.equal(target.pathname,`/security/${other.routeCode}/${metric}`);
        assert.equal(target.searchParams.get('start'),scope.start);
        assert.equal(target.searchParams.get('end'),scope.end);
        assert.equal(target.searchParams.get('period'),null);
      }
    } finally {view.close();}
  }
});

test('dividend cards compare both dates from the selected stock and link to the same section on the sibling page', () => {
  const currentDate = '2026-10-08';
  const referenceDay = '2025-10-02';
  const members = [
    { ...common, dps: '1668', div: '0.64', price: '262000', dpsRanking: { rank: 151, date: currentDate },
      dpsDate: currentDate, divDate: currentDate, priceDate: currentDate, priceState: 'provided',
      dividendReference: { date: referenceDay, dps: '1446', div: '1.62', price: '89000' } },
    { ...preferred, dps: '1669', div: '0.86', price: '194000', dpsRanking: { rank: 150, date: '2026-10-07' },
      dpsDate: currentDate, divDate: currentDate, priceDate: currentDate, priceState: 'provided',
      dividendReference: { date: referenceDay, dps: '1446', div: '2.07', price: '70000' } },
  ];
  let csv;
  const { DividendTable, detailSwitchCandidates } = loadFor('/security/KOSPI.005930/dps', {
    '@/components/CsvDownloadButton': { CsvDownloadButton: ({ data }) => { csv = data; return null; } },
  })('components/detail-investor-records.tsx');
  for (const metric of ['dps', 'div']) for (const [index, current] of members.entries()) {
    const scope = { start: '2025-01-01', periodId: 'selected-period' };
    const candidates = detailSwitchCandidates({ members, current, companyPage: false, basic: false, metric, scope });
    const view = documentFor(DividendTable, { members, candidates, metric, scope, securityId: current.securityId,
      csvStem: 'samsung', basis: currentDate, referenceDay });
    try {
      const gap = view.document.querySelector('.dividendGap');
      const peer = members[1 - index];
      const ranks = [...view.document.querySelectorAll('.dividendCardRank')];
      assert.equal(ranks.length, metric === 'dps' ? 1 : 0);
      if (metric === 'dps') {
        assert.equal(ranks[0].closest('.securityCard').dataset.securityId, peer.securityId);
        assert.equal(ranks[0].closest('.cardSelect').dataset.securityId, peer.securityId);
        assert.match(ranks[0].textContent, new RegExp(`${peer.dpsRanking.rank}위`));
        assert.equal(ranks[0].querySelector('time')?.dateTime, index === 0 ? peer.dpsRanking.date : undefined);
      }
      assert.equal(gap.querySelector('h3').textContent, `${current.korName} ${peer.korName} 대비`);
      assert.deepEqual([...gap.querySelectorAll('time')].map(date => date.dateTime), [currentDate, referenceDay]);
      assert.deepEqual([...gap.querySelectorAll('dd')].map(cell => cell.textContent), index === 0
        ? ['1원 낮음', '0.22%p 낮음', '68,000원 높음', '0원 같음', '0.45%p 낮음', '19,000원 높음']
        : ['1원 높음', '0.22%p 높음', '68,000원 낮음', '0원 같음', '0.45%p 높음', '19,000원 낮음']);
      assert.deepEqual([...gap.querySelectorAll('.dividendGapChange > span')].map(cell => cell.textContent),
        ['1년간 격차 변화', '주당배당금 1원 벌어짐',
          '배당수익률 격차 0.45%p → 0.22%p, 0.23%p 좁아짐', '종가 격차 19,000원 → 68,000원, 49,000원 벌어짐']);
      const link = view.document.querySelector(`a[data-security-id="${peer.securityId}"]`);
      assert.equal(link.getAttribute('href'), `/security/${peer.routeCode}/${metric}?start=2025-01-01#dividend-summary`);
      assert.equal(csv[2].종목, `${current.korName} − ${peer.korName}`);
      assert.equal(csv[2]['종가 차이(원)'], index === 0 ? '68000' : '-68000');
      assert.equal(csv[2]['배당수익률 차이(%p)'], index === 0 ? '-0.22' : '0.22');
      assert.equal(csv[2]['배당수익률(%)'], null);
      assert.equal(csv[3].관측일, referenceDay);
      assert.equal(csv[3]['배당수익률 차이(%p)'], index === 0 ? '-0.45' : '0.45');
      assert.equal(csv[4].시점, '1년간 격차 변화');
      assert.equal(csv[4]['종가 차이(원)'], '49000');
      assert.equal(csv[4]['배당수익률 차이(%p)'], '-0.23');
    } finally { view.close(); }
  }
});

test('a single dividend security keeps its information card without adding a comparison record to the outline',()=>{
  const {DetailSurface}=loadFor('/security/KOSPI.005930/dps')('components/detail-surface.tsx');
  const input=primaryDetailProps({company:null,companySecs:[],metric:'dps',history:[{date:'2026-10-08',value:'0'}]});
  const view=documentFor(DetailSurface,input);
  try {
    assert.equal(view.document.querySelector('#dividend-summary h2').textContent,'종목 배당 정보');
    assert.equal(view.document.querySelector('#dividend-comparison'),null);
    assert.equal(view.document.querySelector('aside a[href="#dividend-summary"]'),null);
  } finally {view.close();}
});

test('financial secondary analysis separates loading, invalid ranges and missing source records',()=>{
  const scenarios=[
    {overrides:{historyPending:true},expected:'pending'},
    {overrides:{search:{start:'2026-10-08',end:'2026-01-01'}},expected:'invalid'},
    {overrides:{history:[]},expected:'empty'},
  ];
  for (const {overrides,expected} of scenarios) {
    let calls=0;
    const {DetailSurface}=loadFor('/security/KOSPI.005930/per',{
      '@/components/restored-detail-charts':{ChartWhenVisible:chartBoundary,DividendComparisonChart:empty,DetailPriceHistory:empty,DetailAnnualHistory:empty,DetailFinancialAnalysis:()=>{calls++;return React.createElement('p',{role:'status'},'원천 데이터 없음');}},
    })('components/detail-surface.tsx');
    const view=documentFor(DetailSurface,primaryDetailProps({metric:'per',...overrides}));
    try {
      const page=view.document;
      const distribution=page.querySelector('#metric-analysis');
      const monthly=page.querySelector('#monthly-records');
      const loadAnnouncements=[...page.querySelectorAll('[role="status"]')].filter(node=>node.textContent.includes('이력 자료를 불러오는 중'));
      assert.equal(loadAnnouncements.length,expected==='pending'?1:0);
      assert.equal(calls,expected==='empty'?2:0);
      if (expected==='pending') {
        assert.ok(distribution.querySelector('[aria-hidden="true"] [data-variant="distribution"]'));
        assert.ok(monthly.querySelector('[aria-hidden="true"] [data-variant="monthly"]'));
        assert.doesNotMatch(distribution.textContent,/원천 데이터 없음|불러오는 중/);
      } else if (expected==='invalid') {
        assert.match(distribution.querySelector('[role="alert"]').textContent,/시작일과 종료일을 확인/);
        assert.doesNotMatch(distribution.textContent,/원천 데이터 없음/);
      } else {
        assert.match(distribution.querySelector('[role="status"]').textContent,/원천 데이터 없음/);
        assert.equal(distribution.querySelector('[data-variant]'),null);
      }
    } finally {view.close();}
  }
});

test('recent tracking receives the resolved listing episode and displayed date window on stock metric pages',()=>{
  for (const metric of ['per', 'marketcap']) {
    const tracked=[];
    const {DetailSurface}=loadFor('/security/KOSPI.005930/'+metric,{
      '@/components/recent-security-tracker':{RecentSecurityTracker:props=>{tracked.push(props);return null;}},
    })('components/detail-surface.tsx');
    const input=primaryDetailProps({metric,search:{start:'2026-09-01',end:['2026-10-01','ignored'],period:'unresolved'},security:{...primaryDetailProps().security,selectedPeriod:{periodId:'resolved-episode'}}});
    const view=documentFor(DetailSurface,input);
    try {
      assert.equal(tracked.length,1);
      const saved=new URL(tracked[0].lastPath,'https://example.test');
      assert.equal(saved.pathname,'/security/KOSPI.005930/'+metric);
      assert.equal(saved.searchParams.get('period'),'resolved-episode');
      assert.equal(saved.searchParams.get('start'),'2026-09-01');
      assert.equal(saved.searchParams.get('end'),'2026-10-01');
    } finally {view.close();}
  }
});

test('company cap keeps the aggregate above its linked constituents and open history',()=>{
  const tracked=[];
  const {DetailSurface} = loadFor('/company/KOSPI.005930/marketcap',{
    '@/components/recent-security-tracker':{RecentSecurityTracker:props=>{tracked.push(props);return null;}},
  })('components/detail-surface.tsx');
  const input=primaryDetailProps({companyPage:true});
  const view = documentFor(DetailSurface,input);
  try {
    const doc=view.document;
    assertOrder(doc,['#current-overview .compositionAggregate','#current-overview .compositionBranches','#chart-analysis','#annual-data']);
    assert.equal(doc.querySelectorAll('#current-overview').length,1);
    assert.ok(doc.querySelector('#current-overview a[href="/security/KOSPI.005935/marketcap"]'));
    assert.equal(tracked[0].lastCompanyMarketcap,input.company.totalMarketcap);
    verifyOutline(doc);
  } finally {view.close();}
});

test('stock marketcap includes exact trading records and only shows listing history for material events',()=>{
  const observed=[];
  const {DetailSurface}=loadFor('/security/KOSPI.005930/marketcap',{'@/components/restored-detail-charts':{
    ChartWhenVisible:chartBoundary,DividendComparisonChart:empty,DetailFinancialAnalysis:empty,DetailAnnualHistory:empty,DetailPriceHistory:props=>{observed.push(props);return React.createElement('div',{'data-testid':'actual-price-history'});},
  }})('components/detail-surface.tsx');
  const prices=[{date:'2026-10-01',close:'0',volume:'9007199254740993'},{date:'2026-10-07',close:'73000'},{date:'2026-10-08',close:'74000',rate:0,open:'73000',volume:'9007199254740994'}];
  const before=JSON.stringify(prices);
  const period={periodId:'current',securityId:'common',listingDate:'2000-01-01',delistingDate:null};
  const input=primaryDetailProps({prices,search:{start:'2026-10-01',end:'2026-10-08'},security:{...primaryDetailProps().security,listingPeriods:[period],selectedPeriod:period,shares:'9007199254740995',sharesDate:'2026-10-08'}});
  const view=documentFor(DetailSurface,input);
  try {
    const doc=view.document;
    assertOrder(doc,['#current-overview','.investor-outline-inline','#price-history','#price-information','#annual-data','#annual-prices']);
    assert.equal(doc.querySelector('#company-information, #listing-history'),null);
    assert.equal(doc.querySelector('a[href="#company-information"], a[href="#listing-history"]'),null);
    assert.equal(observed.length,1);assert.strictEqual(observed[0].rows,prices);assert.equal(observed[0].start,'2026-10-01');assert.equal(observed[0].end,'2026-10-08');
    assert.equal(observed[0].rows[0].close,'0');assert.equal(observed[0].rows[0].volume,'9007199254740993');assert.equal(JSON.stringify(prices),before);
    assert.match(doc.querySelector('#price-information').textContent,/9,007,199,254,740,995/);
    assert.ok(verifyOutline(doc).includes('#annual-prices'));
  } finally {view.close();}
});

test('company overview and marketcap preserve route identity and offer their scoped constituent destinations',()=>{
  const corporation={name:'Samsung Electronics',korName:'삼성전자',industry:'전자 제조업',establishedDate:'1969-01-13',homepage:'https://example.com/company'};
  const detailCompany={...company,company:corporation,companyName:corporation.name};
  const range={start:'2026-09-01',end:'2026-10-08'};
  for(const basic of [true,false]) {
    const headerProps=[];
    const pathname='/company/KOSPI.005930'+(basic?'':'/marketcap');
    const {DetailSurface}=loadFor(pathname,{
      '@/components/sticky-company-header':{StickyCompanyHeader:props=>{headerProps.push(props);return React.createElement('h1',null,props.displayName,props.titleSuffix);}},
    })('components/detail-surface.tsx');
    const view=documentFor(DetailSurface,primaryDetailProps({company:detailCompany,companyPage:true,basic,search:range}));
    try {
      const doc=view.document;
      const nav=doc.querySelector('nav[aria-label="기업·종목 지표 이동"]');
      const tabs=[...nav.querySelectorAll('a[href^="/company/"]')];
      assert.deepEqual(tabs.map(link=>link.textContent),['기업 개요','시가총액']);
      const active=tabs.filter(link=>link.getAttribute('aria-current')==='page');
      assert.equal(active.length,1);
      assert.equal(new URL(active[0].href,'https://example.test').pathname,pathname);
      for(const link of tabs) {
        const destination=new URL(link.href,'https://example.test');
        assert.equal(destination.searchParams.get('start'),range.start);
        assert.equal(destination.searchParams.get('end'),range.end);
        assert.equal(destination.searchParams.get('period'),null);
      }
      const summary=doc.querySelector('#current-overview');
      assert.match(summary.textContent,/549조\s*원/);
      assert.match(summary.textContent,/1위/);
      const order=verifyOutline(doc);
      if(basic) {
        const comparison=doc.querySelector('#securities-summary');
        const table=comparison.querySelector('table');
        assert.equal(table.closest('details'),null);
        assert.deepEqual([...table.tHead.rows[0].cells].map(cell=>cell.textContent),['종목','종목코드','시가총액(원)','종가(원)']);
        const profile=doc.querySelector('#company-information');
        assertOrder(doc,['#current-overview','#securities-summary','#company-information']);
        assert.equal(order[0],'#securities-summary');
        assert.match(profile.textContent,/전자 제조업/);
        assert.match(profile.textContent,/1969-01-13/);
        assert.equal(profile.querySelector('a').href,corporation.homepage);
        assert.equal(doc.querySelector('#chart-analysis'),null);
        assert.equal(comparison.querySelector('button').textContent,'구성 종목 비교 CSV');
        for(const member of [common,preferred]) {
          const paths=[...table.querySelectorAll('tbody a')].map(link=>new URL(link.href,'https://example.test'));
          assert.ok(paths.some(link=>link.pathname==='/security/'+member.routeCode+'/marketcap' && link.hash==='#price-history'));
          assert.ok(paths.some(link=>link.pathname==='/security/'+member.routeCode+'/marketcap' && !link.hash));
        }
      } else {
        assertOrder(doc,['#current-overview .compositionAggregate','#current-overview .compositionBranches','#chart-analysis','#annual-data']);
        const hero = summary.querySelector('.compositionAggregate');
        assert.ok(hero.classList.contains('summaryHero'));
        assert.equal(hero.querySelector('.compositionChoice span').textContent, '현재 기업 합산 시가총액');
        assert.equal(hero.querySelector('.headlineAmount').textContent, '549조원');
        assert.equal(hero.querySelector('.headlineRank').getAttribute('aria-label'), '기업 합산 시가총액 순위 1위');
        assert.equal(summary.querySelector('.marketcapHero'), null);
        assert.equal(order[0],'#current-overview');
        assert.equal(doc.querySelector('#company-information'),null);
        for(const member of [common,preferred]) {
          assert.ok(summary.querySelector('a[href^="/security/'+member.routeCode+'/marketcap?"]'));
        }
      }
      assert.equal(headerProps.length,1);
      assert.equal(headerProps[0].displayName,'삼성전자');
      assert.equal(doc.querySelector('h1').textContent,basic?'삼성전자 기업 개요':'삼성전자 시가총액');
    } finally {view.close();}
  }
});

test('company marketcap presents one combined chart and puts representative trading before annual records',()=>{
  const charts=[],priceCharts=[];
  const {DetailSurface}=loadFor('/company/KOSPI.005930/marketcap',{
    '@/components/interactive-chart-section':{InteractiveChartSection:props=>{charts.push(props);return React.createElement('div',{'data-testid':'company-history'});}},
    '@/components/restored-detail-charts':{ChartWhenVisible:chartBoundary,DividendComparisonChart:empty,DetailFinancialAnalysis:empty,DetailAnnualHistory:empty,DetailPriceHistory:props=>{priceCharts.push(props);return React.createElement('div',{'data-testid':'representative-history'});}},
    '@/components/card-company-marketcap':{__esModule:true,default:()=>React.createElement('div',{'data-testid':'duplicate-composition'})},
  })('components/detail-surface.tsx');
  const prices=[{date:'2026-09-01',close:'0'},{date:'2026-10-08',close:'74000',rate:0}];
  const history=[{date:'2026-09-01',value:'540000000000000'},{date:'2026-10-08',value:'549000000000000'}];
  const input=primaryDetailProps({companyPage:true,basic:false,prices,history,sourceHistory:history.map(row=>({date:row.date,totalMarketcap:row.value})),search:{start:'2026-09-01',end:'2026-10-08'}});
  const before=JSON.stringify(input);
  const view=documentFor(DetailSurface,input);
  try {
    const doc=view.document;
    assert.equal(charts.length,1);assert.equal(charts[0].type,'summary');assert.strictEqual(charts[0].companyMarketcapData,company);
    assert.equal(charts[0].start,input.search.start);assert.equal(charts[0].end,input.search.end);
    assert.ok(doc.querySelector('#chart-analysis [data-testid="company-history"]'));
    assert.equal(doc.querySelector('[data-testid="duplicate-composition"]'),null);
    const priceHistory=doc.querySelector('#price-history');
    assert.equal(doc.querySelectorAll('#price-history').length,1);assert.equal(priceHistory.closest('details:not([open])'),null);
    assert.match(priceHistory.querySelector('h2').textContent,/대표 보통주 주가/);
    assert.ok(priceHistory.querySelector('[data-testid="representative-history"]'));
    assertOrder(doc,['#chart-analysis','#price-history','#price-information','#annual-data','#annual-prices']);
    assert.match(priceHistory.querySelector('button').textContent, /삼성전자 주가 전체 이력 CSV|주가 CSV/);
    assert.equal(priceCharts.length,1);assert.strictEqual(priceCharts[0].rows,prices);
    assert.equal(priceCharts[0].start,input.search.start);assert.equal(priceCharts[0].end,input.search.end);
    assert.equal(JSON.stringify(input),before,'presentational regrouping must not mutate the real histories');
    const targets=[...doc.querySelectorAll('aside nav[aria-label="본문 목차"] a')].map(link=>{
      const matches=doc.querySelectorAll(link.getAttribute('href'));assert.equal(matches.length,1,link.textContent);return matches[0];
    });
    assert.ok(doc.querySelector('[data-detail-header-actions] #history-download'));assert.ok(targets.includes(priceHistory));
    for(let i=1;i<targets.length;i++) assert.ok(targets[i-1].compareDocumentPosition(targets[i])&4);
  } finally {view.close();}
});

test('a single listed security and its company total do not create a header or rail switch', () => {
  const {DetailSurface} = loadFor('/company/KOSPI.005930/marketcap')('components/detail-surface.tsx');
  for (const companyPage of [true, false]) {
    const view = documentFor(DetailSurface, primaryDetailProps({companyPage,
      company: {...company, securities: [common], totalMarketcap: common.marketcap}}));
    try {
      const doc = view.document;
      assert.equal(doc.querySelector('[data-detail-cap-title]'), null);
      assert.equal(doc.querySelector('aside [data-detail-peer-navigation]'), null);
      assert.ok(doc.querySelector('#current-overview .securityCard'));
      assert.ok(doc.querySelector('#current-overview .aggregateCard'));
    } finally {view.close();}
  }
});

test('marketcap branches keep verified composition together with scoped links and exact won values',()=>{
  const {DetailSurface}=loadFor('/company/KOSPI.005930/marketcap')('components/detail-surface.tsx');
  const published={...company,marketcapCompleteness:'complete',compositionComplete:true,compositionObservedCount:2,compositionTargetCount:2};
  const scope={start:'2026-09-01',end:'2026-10-08',period:'foreign'};
  const companySecs = [
    {...common,price:'262000',priceDate:'2026-10-08',marketcapRanking:{rank:1,date:'2026-10-08'}},
    {...preferred,price:'194000',priceDate:'2026-10-07',marketcapRanking:{rank:3,date:'2026-10-07'}},
  ];
  for (const [detailCompany, complete] of [[published,true],[{...published,securities:[common,{...preferred,marketcapDate:'2026-10-07'}]},false]]) {
    const view=documentFor(DetailSurface,primaryDetailProps({companyPage:true,company:detailCompany,companySecs,search:scope}));
    try {
      const section=view.document.querySelector('#current-overview');
      const branches=[...section.querySelectorAll('.compositionBranch')];
      for (const selector of ['[data-detail-cap-title]', 'aside [data-detail-peer-navigation]']) {
        assert.equal(view.document.querySelectorAll(`${selector} a[data-security-id]`).length, 3);
      }
      const rail = view.document.querySelector('aside [data-detail-peer-navigation]');
      assert.equal(rail.style.getPropertyValue('--marketcap-selection-color'), 'var(--brand-ink)');
      assert.equal(rail.previousElementSibling.tagName, 'H2');
      assert.equal(rail.closest('details'), null);
      assert.deepEqual([...rail.querySelectorAll('li')].map(row => row.textContent), ['기업 합산','보통주','우선주']);
      assert.ok(rail.querySelector('a[aria-current="page"] svg.lucide-check'));
      assert.equal(rail.querySelectorAll('svg.lucide-check').length, 1);
      assert.equal(rail.querySelector('a[aria-current="page"] strong').textContent, '기업 합산');
      const track=section.querySelector('.compositionAggregate > .portionTrack');
      assert.equal(track.querySelectorAll('[data-series]').length,complete ? 2 : 0);
      assert.deepEqual(branches.map(branch=>branch.querySelector('.compositionAmounts small').textContent),complete ? ['90.16%','9.84%'] : ['—','—']);
      assert.equal(branches[1].querySelector('.compositionAmounts [title]').title,'54,000,000,000,000원');
      if (!complete) assert.equal(branches[1].querySelector('.compositionAmounts time').dateTime,'2026-10-07');
      assert.equal(section.querySelector('.compositionAggregate .comparisonStrip').textContent.trim(),
        complete ? '보통주·우선주 2개 종목의 합계' : '구성 종목 2개');
      const link=branches[1].querySelector('a');
      assert.match(link.textContent,/우선주.*삼성전자우.*005935/);
      assert.equal(link.getAttribute('href'),'/security/KOSPI.005935/marketcap?start=2026-09-01&end=2026-10-08');
      assert.equal(section.querySelectorAll('a[aria-current="page"]').length,1);
      assert.equal(section.querySelector('.compositionAggregateLink[aria-current="page"]').getAttribute('href'),'/company/KOSPI.005930/marketcap?start=2026-09-01&end=2026-10-08');
      for (const [index, rank, amount] of [[0, '1위', '262,000원'], [1, '3위', '194,000원']]) {
        const member = branches[index].querySelector('.compositionMember');
        assert.equal(member.querySelector('.compositionRankLink').textContent, rank);
        const price = member.querySelector('.marketcapQuote a');
        assert.equal(price.textContent, amount);
        assert.match(price.getAttribute('href'), /#price-history$/);
        assert.equal(price.closest('.compositionMemberLink'), null);
      }
      assert.deepEqual([...branches[1].querySelectorAll('.compositionSelection time')].map(time => time.dateTime), ['2026-10-07','2026-10-07']);
      if (complete) {
        assertOrder(view.document, ['#current-overview .compositionAggregate', '#current-overview .compositionBranches',
          '#current-overview #marketcap-breakdown', '#chart-analysis']);
        assert.equal(view.document.querySelectorAll('#marketcap-breakdown').length, 1);
        assert.ok(section.querySelector('.compositionHierarchy #marketcap-breakdown'));
        verifyOutline(view.document);
      }
    } finally {view.close();}
  }
});

test('stock marketcap keeps the official company composition and separately displays a differing stock snapshot',()=>{
  const {DetailSurface}=loadFor('/security/KOSPI.005935/marketcap')('components/detail-surface.tsx');
  const published={...company,marketcapCompleteness:'complete',compositionComplete:true,compositionObservedCount:2,compositionTargetCount:2};
  const member={...primaryDetailProps().security,...preferred,selectedPeriod:{periodId:'preferred-listing'}};
  for (const [security,detailCompany,currentValue] of [
    [member,published,'54조원'],
    [{...member,marketcap:'65000000000000'},published,'65조원'],
    [{...member,marketcapDate:'2026-10-07'},published,'54조원'],
    [member,{...published,state:'unpublished',publication:null,totalMarketcap:null,marketcapRank:null},'54조원'],
    [{...member,historicalPeriod:true,marketcap:null},published,null],
  ]) {
    const view=documentFor(DetailSurface,primaryDetailProps({company:detailCompany,security,
      ranking:security.historicalPeriod?null:{currentRank:15,rankDate:publication.asOf},search:{start:'2026-09-01'}}));
    try {
      const section=view.document.querySelector('#current-overview');
      const selectedLink=section.querySelector('a[aria-current="page"]');
      assert.match(selectedLink.textContent,/삼성전자우/);
      assert.equal(selectedLink.getAttribute('href'),'/security/KOSPI.005935/marketcap?start=2026-09-01&period=preferred-listing');
      const returnLink=section.querySelector('.compositionAggregateLink');
      if (security.historicalPeriod) {
        const hero=section.querySelector('.marketcapHero');
        assert.equal(hero.querySelector('dt').textContent,'현재 종목 시가총액');
        assert.equal(hero.querySelector('.headlineColumn dd').textContent,'미제공');
        assert.equal(hero.querySelector('.headlineRank'),null);
        assert.equal(returnLink,null);
        assert.equal(section.querySelectorAll('.securityCard').length,1);
      } else {
        const selection=selectedLink.parentElement.querySelector('.compositionSelection');
        const movedSnapshot=security.marketcap!==preferred.marketcap || security.marketcapDate!==publication.asOf || detailCompany.state!=='published';
        if (movedSnapshot) {
          assert.match(selection.textContent,/현재 종목 시가총액/);
          assert.equal(selection.querySelector('strong').textContent,currentValue);
          if (security.marketcapDate !== publication.asOf) assert.equal(selection.querySelector('time').dateTime,security.marketcapDate);
        } else {
          assert.doesNotMatch(selection.textContent,/현재 종목 시가총액/);
          assert.equal(selectedLink.querySelector('.compositionAmounts strong').textContent,currentValue);
        }
        assert.equal(selectedLink.querySelector('.compositionCurrent').textContent,'조회 중');
        assert.equal(returnLink.getAttribute('href'),'/company/KOSPI.005930/marketcap?start=2026-09-01');
        const rail = view.document.querySelector('aside [data-detail-peer-navigation]');
        assert.equal(rail.style.getPropertyValue('--marketcap-selection-color'), 'var(--market-down)');
        assert.equal(rail.querySelector('a[aria-current="page"]').textContent, '우선주');
        assert.equal(rail.querySelector('a[aria-current="page"]').dataset.securityId, 'preferred');
        assert.equal(selection.querySelector('.compositionRankLink').getAttribute('aria-label'),'종목 시가총액 순위 15위');
        assert.equal(selection.querySelector('.compositionRankLink').getAttribute('href'),'/marketcap');
        assert.equal(selection.querySelector('.marketcapQuote a').textContent,'74,000원');
        assert.equal(returnLink.parentElement.querySelector('.headlineRank')?.textContent ?? null,detailCompany.state==='published' ? '1위' : null);
        if (detailCompany === published) assertOrder(view.document, ['#current-overview .compositionAggregate',
          '#current-overview .compositionBranches', '#current-overview #marketcap-breakdown', '#chart-analysis']);
      }
    } finally {view.close();}
  }
});

test('shares and strip cover every official constituent, including zero and a single-share company',()=>{
  const {DetailSurface}=loadFor('/company/KOSPI.005930/marketcap')('components/detail-surface.tsx');
  const third={...preferred,securityId:'third',korName:'삼성전자2우',routeCode:'KOSPI.005936',ticker:'005936',marketcap:'0'};
  const fourth={...third,securityId:'fourth',korName:'삼성전자3우',routeCode:'KOSPI.005937',ticker:'005937'};
  const fifth={...third,securityId:'fifth',korName:'삼성전자4우',routeCode:'KOSPI.005938',ticker:'005938'};
  for(const securities of [[common],[common,preferred,third],[common,preferred,third,fourth,fifth]]) {
    const amount=securities.length===1?common.marketcap:company.totalMarketcap;
    const detailCompany={...company,securities,totalMarketcap:amount,marketcapCompleteness:'complete',compositionComplete:true,
      compositionObservedCount:securities.length,compositionTargetCount:securities.length};
    const view=documentFor(DetailSurface,primaryDetailProps({companyPage:true,company:detailCompany}));
    try {
      const section=view.document.querySelector('#current-overview');
      assert.equal(section.querySelectorAll('.portionTrack [data-series]').length,securities.length);
      assert.deepEqual([...section.querySelectorAll('.securityCard .marketcapValues > div:last-child dd, .compositionAmounts > small:first-of-type')].map(el=>el.textContent),
        securities.length===1?['100.00%']:['90.16%','9.84%',...Array(securities.length-2).fill('0.00%')]);
      if (securities.length > 1) {
        assert.equal(section.querySelectorAll('.compositionBranch a').length,securities.length);
        const colors=[...section.querySelectorAll('.portionTrack > span')].map(el=>el.style.backgroundColor);
        assert.equal(new Set(colors).size,securities.length);
      }
    } finally {view.close();}
  }
});

test('financial current quotes open the same listing in marketcap price history', () => {
  for (const metric of ['per', 'pbr', 'eps', 'bps', 'div', 'dps']) {
    const { DetailSurface } = loadFor('/security/KOSPI.005935/' + metric)('components/detail-surface.tsx');
    const defaults = primaryDetailProps();
    const security = {
      ...defaults.security, securityId: preferred.securityId, routeCode: preferred.routeCode, ticker: preferred.ticker,
      selectedPeriod: { periodId: 'preferred-episode', listingDate: '1997-01-01' },
      availableMetrics: [metric, 'marketcap', 'per', 'pbr', 'eps', 'bps', 'div', 'dps'],
      [metric]: '5', [metric + 'State']: 'provided', [metric + 'Date']: publication.asOf,
    };
    const view = documentFor(DetailSurface, {...defaults, metric, security, search: {start: '2026-01-01'}});
    try {
      const quoteLinks = [...view.document.querySelectorAll('#current-overview a[href*="/security/KOSPI.005935/"]')].filter(link => link.textContent === '74,000원');
      assert.ok(quoteLinks.length, metric);
      for (const link of quoteLinks) assert.equal(link.getAttribute('href'), '/security/KOSPI.005935/marketcap/?period=preferred-episode#price-history', metric);
    } finally { view.close(); }
  }
});
