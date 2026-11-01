const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const {JSDOM} = require('jsdom');
const {loader, renderToStaticMarkup} = require('./helpers/detail-presentation-loader.cjs');

const company = {companyId:'samsung',routeCode:'KOSPI.005930',companyName:'Samsung',companyKorName:'삼성전자',
  state:'published',totalMarketcap:'549000000000000',totalMarketcapDate:'2026-10-08',company:{name:'Samsung'},
  securities:[],aggregatedHistory:[],registeredHistory:[]};
const initial = {company,security:null,companySecs:[],ranking:{currentRank:1},neighbors:[],companyPage:true,
  metric:'marketcap',basic:true,search:{start:'2026-01-01',end:'2026-10-08'},
  history:[{date:'2026-10-08',value:'549000000000000'}],sourceHistory:[],prices:[]};

function replaceGlobals(values) {
  const prior = new Map(Object.keys(values).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for (const [key,value] of Object.entries(values)) Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  return () => {for(const [key,descriptor] of prior) if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];};
}

function browserHarness(url, extra = {}) {
  const dom = new JSDOM('<!doctype html><head><link rel="canonical" href="https://www.chundan.xyz/company/KOSPI.005930/"></head><body><div id="root"></div></body>',{url});
  const restore = replaceGlobals({window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
  const nativePush = window.history.pushState.bind(window.history);
  // The installed Next router patches native history to notify its pathname/query hooks.
  window.history.pushState = (...args) => {nativePush(...args);window.dispatchEvent(new window.Event('next-history'));};
  const subscribe = listener => {
    window.addEventListener('popstate',listener);window.addEventListener('next-history',listener);
    return () => {window.removeEventListener('popstate',listener);window.removeEventListener('next-history',listener);};
  };
  let Tabs, latest;
  const load = loader({
    'next/navigation':{
      usePathname:()=>React.useSyncExternalStore(subscribe,()=>window.location.pathname,()=>new URL(url).pathname),
      useSearchParams:()=>new URLSearchParams(React.useSyncExternalStore(subscribe,()=>window.location.search,()=>new URL(url).search)),
    },
    'next/link':({children,prefetch,onNavigate,...props})=>{
      void prefetch;
      return React.createElement('a',{...props,onClick:event=>{
        if (event.button===0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
          onNavigate?.({preventDefault:()=>event.preventDefault()});
        }
      }},children);
    },
    '@/components/detail-surface':{DetailSurface:props=>{
      latest=props;
      return React.createElement('main',null,
        React.createElement('header',{'data-testid':'shared-header'},props.company.companyKorName),
        React.createElement(Tabs,{company:props.company,start:props.search.start,end:props.search.end}),
        React.createElement('section',{'data-testid':'view'},props.basic?'기업 정보 표':'기업 합산 시총 추이'),
        React.createElement('output',{'data-testid':'search'},JSON.stringify(props.search)));
    }},
    ...extra,
  });
  Tabs = load('components/company-financial-tabs.tsx').CompanyFinancialTabs;
  const {createRoot} = require('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  return {load,root,latest:()=>latest,close:async()=>{await React.act(async()=>root.unmount());restore();dom.window.close();}};
}

test('company tabs keep the header and snapshot while URLs, ranges, title and back/forward stay in sync',async()=>{
  const harness = browserHarness('http://localhost/company/KOSPI.005930/?start=2026-01-01&end=2026-10-08');
  try {
    const {CompanyDetailClient} = harness.load('components/company-detail-client.tsx');
    await React.act(async()=>harness.root.render(React.createElement(CompanyDetailClient,initial)));
    const header = document.querySelector('[data-testid="shared-header"]');
    const links = [...document.querySelectorAll('nav a')];
    assert.equal(links.length,2);
    assert.equal(links[1].getAttribute('href'),'/company/KOSPI.005930/marketcap?start=2026-01-01&end=2026-10-08');
    await React.act(async()=>links[1].click());
    assert.equal(window.location.pathname,'/company/KOSPI.005930/marketcap');
    assert.equal(document.querySelector('[data-testid="shared-header"]'),header);
    assert.equal(document.querySelector('[data-testid="view"]').textContent,'기업 합산 시총 추이');
    assert.equal(harness.latest().history,initial.history);
    assert.equal(document.querySelector('nav').dataset.activeTab,'marketcap');
    assert.match(document.title,/삼성전자 기업 합산 시총/);
    assert.equal(document.querySelector('link[rel="canonical"]').href,'https://www.chundan.xyz/company/KOSPI.005930/marketcap/');
    const historyLength=window.history.length;
    await React.act(async()=>document.querySelector('nav a[aria-current="page"]').click());
    assert.equal(window.history.length,historyLength,'clicking the current tab does not duplicate history');
    await React.act(async()=>new Promise(resolve=>{window.addEventListener('popstate',resolve,{once:true});window.history.back();}));
    assert.equal(document.querySelector('[data-testid="view"]').textContent,'기업 정보 표');
    assert.equal(document.querySelector('[data-testid="shared-header"]'),header);
    await React.act(async()=>new Promise(resolve=>{window.addEventListener('popstate',resolve,{once:true});window.history.forward();}));
    assert.equal(document.querySelector('[data-testid="view"]').textContent,'기업 합산 시총 추이');
    await React.act(async()=>window.history.pushState(null,'','?start=2026-09-01&end=2026-10-01'));
    assert.deepEqual(harness.latest().search,{start:'2026-09-01',end:'2026-10-01'});
    await React.act(async()=>document.querySelector('nav a').click());
    assert.equal(window.location.search,'?start=2026-09-01&end=2026-10-01');
    assert.equal(document.querySelector('nav').dataset.activeTab,'info');
    assert.match(document.title,/삼성전자 기업 정보/);
  } finally {await harness.close();}
});

test('company tab links remain native link destinations for modified clicks',async()=>{
  const harness=browserHarness('http://localhost/company/KOSPI.005930/');
  try {
    const {CompanyDetailClient}=harness.load('components/company-detail-client.tsx');
    await React.act(async()=>harness.root.render(React.createElement(CompanyDetailClient,{...initial,search:{}})));
    const target=document.querySelectorAll('nav a')[1];
    let intercepted;
    target.addEventListener('click',event=>{intercepted=event.defaultPrevented;event.preventDefault();});
    await React.act(async()=>target.dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true,metaKey:true})));
    assert.equal(intercepted,false);
    assert.equal(window.location.pathname,'/company/KOSPI.005930/');
    assert.equal(target.getAttribute('href'),'/company/KOSPI.005930/marketcap');
  } finally {await harness.close();}
});

test('static company tab changes keep pending or loaded shared assets and never restart the request',async()=>{
  const calls=[];
  let resolveData;
  const pending=new Promise(resolve=>{resolveData=resolve;});
  const harness=browserHarness('http://localhost/company/KOSPI.005930/',{
    '@/lib/static-data':{loadStaticDetailData:(...args)=>{calls.push(args);return pending;}},
  });
  try {
    const {StaticDetailClient}=harness.load('components/static-detail-client.tsx');
    const assets={company:'/company-history',prices:'/prices'};
    await React.act(async()=>harness.root.render(React.createElement(StaticDetailClient,{initial:{...initial,search:{}},assets})));
    const header=document.querySelector('[data-testid="shared-header"]');
    assert.equal(calls.length,1);assert.equal(harness.latest().historyPending,true);
    await React.act(async()=>document.querySelectorAll('nav a')[1].click());
    assert.equal(harness.latest().basic,false);assert.equal(calls.length,1);
    assert.equal(document.querySelector('[data-testid="shared-header"]'),header);
    const rows=[{date:'2026-10-08',totalMarketcap:'549000000000000',securitiesBreakdown:{}}];
    await React.act(async()=>resolveData({companyHistory:rows,sourceHistory:rows,prices:[]}));
    assert.equal(harness.latest().historyPending,false);
    assert.equal(harness.latest().history[0].value,'549000000000000');
    await React.act(async()=>document.querySelector('nav a').click());
    await React.act(async()=>document.querySelectorAll('nav a')[1].click());
    assert.equal(calls.length,1);
    assert.equal(document.querySelector('[data-testid="shared-header"]'),header);
  } finally {await harness.close();}
});

test('first-entry company loading represents two company tabs',()=>{
  const {CompanyDetailLoading}=loader()('components/company-detail-loading.tsx');
  const dom=new JSDOM(renderToStaticMarkup(React.createElement(CompanyDetailLoading)));
  try {
    assert.equal(dom.window.document.querySelectorAll('.detail-company-nav > span').length,2);
    assert.match(dom.window.document.querySelector('[role="status"]').textContent,/기업 정보를/);
  } finally {dom.window.close();}
});
