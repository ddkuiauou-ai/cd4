const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../..');
function loader(stubs = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const mod = new Module(file); cache.set(file, mod); mod.paths = Module._nodeModulePaths(path.dirname(file));
    mod.require = name => {
      const resolvedName = name.startsWith('.') ? '@/' + path.relative(root,path.resolve(path.dirname(file),name)) : name;
      if (resolvedName in stubs) return stubs[resolvedName];
      if (name.endsWith('.module.css')) return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
      if (name === 'next/link') return ({children,prefetch,onNavigate,...props}) => { void prefetch; void onNavigate; return React.createElement('a',props,children); };
      if (name === 'next/navigation') return {notFound:()=>{throw Error('not-found')},usePathname:()=>'/security/security-id/per'};
      const local = resolvedName.startsWith('@/') ? path.join(root,resolvedName.slice(2)) : null;
      if (!local) return require(name);
      const found = [local,local+'.ts',local+'.tsx'].find(file=>fs.existsSync(file)&&fs.statSync(file).isFile());
      assert.ok(found,resolvedName);return load(found);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
    return mod.exports;
  }
  return file=>load(path.join(root,file));
}
function pageLoader(snapshot){
  let calls=0;let downloaded;const charts=[];const historyCharts=[];
  const empty=()=>null;
  const named=keys=>Object.fromEntries(keys.map(key=>[key,empty]));
  const stubs={
    '@/lib/data/detail-snapshot':{getSecurityDetailSnapshot:async()=>{calls++;return snapshot},getCompanyDetailSnapshot:async()=>{calls++;return snapshot}},
    '@/components/sticky-company-header':{StickyCompanyHeader:props=>React.createElement('div',{'data-detail-header':true},
      React.createElement('h1',null,props.displayName,props.titleSuffix,props.detail?.value),props.actions,props.historyAction)},
    '@/components/recent-security-tracker':named(['RecentSecurityTracker']),
    '@/components/recent-securities-sidebar':named(['RecentSecuritiesSidebar']),
    '@/components/page-navigation':named(['PageNavigation']),
    '@/components/interactive-chart-section':{InteractiveChartSection:props=>{charts.push(props);return null}},
    '@/components/detail-history-chart':{DetailHistoryChart:props=>{historyCharts.push(props);return null}},
    '@/components/restored-detail-charts':{...named(['DetailFinancialAnalysis','DetailPriceHistory','DetailAnnualHistory','DividendComparisonChart']),ChartWhenVisible:({children})=>children},
    '@/components/CsvDownloadButton':{CsvDownloadButton:props=>{downloaded=props;return React.createElement('button',null,props.label)}},
    '@/components/share-button':{__esModule:true,default:empty},
  };
  return {pages:loader(stubs)('components/restored-detail-page.tsx'),calls:()=>calls,csv:()=>downloaded,charts,historyCharts};
}
module.exports={loader,pageLoader,renderToStaticMarkup};
