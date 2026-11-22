const test = require('node:test');
const assert = require('node:assert/strict');
const { loadFor, documentFor, primaryDetailProps, assertOrder } = require('./helpers/detail-surface.cjs');

test('financial and dividend headlines keep zero values and link dated official ranks beside the metric',()=>{
  const {DetailSurface}=loadFor('/security/KOSPI.005930')('components/detail-surface.tsx');
  for (const [metric,label,unit] of [['per','PER','배'],['pbr','PBR','배'],['eps','EPS','원'],['bps','BPS','원'],['dps','주당배당금','원'],['div','배당수익률','%']]) {
    const props=primaryDetailProps({metric,ranking:{currentRank:1234,rankDate:'2026-10-07'}});
    const security={...props.security,[metric]:'0',[`${metric}State`]:'provided',[`${metric}Date`]:'2026-10-08'};
    const view=documentFor(DetailSurface,{...props,security});
    try {
      const overview=view.document.querySelector('#current-overview');
      const rank=overview.querySelector('.headlineRow a');
      assert.equal(overview.querySelector('.headlineRow .investor-primary-value').textContent,'0'+unit);
      assert.equal(rank.getAttribute('href'),'/'+metric);
      assert.equal(rank.querySelector('strong').textContent,'1,234');
      assert.equal(rank.textContent,'1,234위');
      assert.equal(rank.dataset.rank,'1234');
      assert.ok(overview.querySelector('.headlineRow').hasAttribute('data-compact-summary'));
      assert.deepEqual([...overview.querySelectorAll('.headlineRow dt')].map(node=>node.textContent), ['현재 '+label,label+' 순위']);
      assert.match(rank.getAttribute('aria-label'),new RegExp(label+' 순위'));
      assert.equal(rank.closest('.headlineColumn').querySelector('time').dateTime,'2026-10-07');
    } finally {view.close();}
    const historical=documentFor(DetailSurface,{...props,security:{...security,historicalPeriod:true,[metric]:null},ranking:null});
    try {
      const overview=historical.document.querySelector('#current-overview');
      assert.equal(overview.querySelector('.headlineRow a'),null);
      assert.equal(overview.querySelectorAll('.headlineColumn').length,1);
      assert.equal(overview.querySelector('.headlineMissing').textContent,'미제공');
      assert.match(overview.textContent,/선택한 상장기의 공개 현재값이 없습니다/);
    } finally {historical.close();}
  }
});

test('EPS, BPS and DPS explain the published amount per share',()=>{
  const {DetailSurface}=loadFor('/security/KOSPI.005930')('components/detail-surface.tsx');
  for (const [metric,definition] of [['eps','순이익'],['bps','순자산'],['dps','배당금']]) {
    const props=primaryDetailProps({metric});
    const view=documentFor(DetailSurface,{...props,security:{...props.security,pbr:'4.09',pbrDate:'2026-10-08'}});
    try {
      const overview=view.document.querySelector('#current-overview');
      const label=metric==='dps'?'주당배당금':`주당${definition}(${metric.toUpperCase()})`;
      const info=overview.querySelector(`.valuationHeading button[aria-label="${label} 뜻"]`);
      const explanation=view.document.getElementById(info.getAttribute('aria-describedby'));
      assert.match(explanation.textContent,/주식 한 주/);
      assert.ok(explanation.textContent.includes(definition));
      assert.ok(explanation.hidden);
      assert.equal(info.getAttribute('aria-expanded'),'false');
      assert.equal(overview.querySelector('[data-calculation]'),null);
    } finally {view.close();}
  }
});

test('EPS divides the closing price by PER for each verified comparison period',()=>{
  const {DetailSurface}=loadFor('/security/KOSPI.005930/eps')('components/detail-surface.tsx');
  const day='2026-10-08';
  const reference='2025-10-02';
  const props=primaryDetailProps({metric:'eps',ranking:{currentRank:24,rankDate:day},
    sourceHistory:[{date:reference,eps:'15221',per:'66.29'}],prices:[{date:reference,close:'1009000'}]});
  const security={...props.security,selectedPeriod:{periodId:'active-episode'},availableMetrics:['eps','per'],
    eps:'26423',epsDate:day,per:'46.13',perDate:day,price:'1219000',priceDate:day};
  for (const [overrides,expected,estimate] of [
    [{},'26,423원','26,425원'],
    [{priceDate:'2026-10-07'},'26,423원'],
    [{perDate:'2026-10-07'},'26,423원'],
    [{per:'46.14'},'26,423원'],
    [{eps:'0'},'0원'],
    [{eps:'-26423',per:'-46.13'},'−26,423원'],
    [{per:'0'},'26,423원'],
    [{per:null},'26,423원'],
    [{availableMetrics:['eps']},'26,423원'],
    [{historicalPeriod:true},'26,423원'],
  ]) {
    const view=documentFor(DetailSurface,{...props,security:{...security,...overrides}});
    try {
      const overview=view.document.querySelector('#current-overview');
      const [current, previous]=overview.querySelectorAll('.valuationPeriod');
      const calculation=current.querySelector('[data-calculation]');
      assert.equal(overview.querySelector('.valuationHeading h2').textContent,'현재와 1년 전 EPS');
      assert.equal(current.querySelector('h3').textContent,'현재 2026-10-08');
      assert.equal(previous.querySelector('h3').textContent,overrides.historicalPeriod?'1년 전':'1년 전 2025-10-02');
      assert.equal(overview.querySelector('[data-valuation-reference] strong')?.textContent,overrides.historicalPeriod?undefined:'15,221원');
      assert.equal(Boolean(calculation),Boolean(estimate));
      assert.equal(overview.querySelector('.headlineAmount').textContent,expected);
      if (calculation) {
        assert.equal(overview.querySelector('.headlineRank').textContent,'24위');
        assert.deepEqual([...calculation.querySelectorAll('.calculationInputs dt')].map(node=>node.textContent),['종가','PER']);
        assert.deepEqual([...calculation.querySelectorAll('.calculationInputs dd')].map(node=>node.textContent),['1,219,000원','46.13배']);
        assert.equal(calculation.querySelector('.calculationResult').textContent,`계산 EPS${estimate}`);
        assert.equal(current.querySelector('.calculationEstimate').textContent,`공개 EPS ${expected}`);
        assert.equal(previous.querySelector('[data-calculation] .calculationResult').textContent,'공개 EPS15,221원');
        assert.equal(previous.querySelector('.calculationEstimate'),null);
        const perLink=calculation.querySelector('.calculationInputs > :last-child a');
        assert.equal(perLink.textContent,'46.13배');
        assert.equal(perLink.getAttribute('href'),'/security/KOSPI.005930/per?period=active-episode');
      } else {
        assert.equal(current.querySelector('.calculationResult dt').textContent,'공개 EPS');
        assert.equal(current.querySelector('.calculationResult dd').textContent,expected);
      }
    } finally {view.close();}
  }
  const epsOnly=documentFor(DetailSurface,{...props,security,
    sourceHistory:[...props.sourceHistory,{date:'2025-10-08',eps:'0'}]});
  try {
    const previous=epsOnly.document.querySelector('[aria-label="1년 전 EPS 구성"]');
    assert.equal(previous.querySelector('h3 time').dateTime,'2025-10-08');
    assert.equal(previous.querySelector('[data-calculation]'),null);
    assert.equal(previous.querySelector('.calculationResult dd').textContent,'0원');
    assert.equal(epsOnly.document.querySelector('[data-valuation-reference] strong').textContent,'0원');
  } finally {epsOnly.close();}
});

test('BPS divides the closing price by PBR and preserves each published amount',()=>{
  const {DetailSurface}=loadFor('/security/KOSPI.005930/bps')('components/detail-surface.tsx');
  const day='2026-10-08';
  const previousDay='2025-10-02';
  const props=primaryDetailProps({metric:'bps',ranking:{currentRank:75,rankDate:day},
    sourceHistory:[{date:previousDay,bps:'153212',pbr:'6.59'}],prices:[{date:previousDay,close:'1009000'}]});
  const security={...props.security,selectedPeriod:{periodId:'active-episode'},availableMetrics:['bps','pbr'],
    bps:'159902',bpsDate:day,pbr:'7.62',pbrDate:day,price:'1219000',priceDate:day};
  for (const [input,matched] of [
    [{...props,security},true],
    [{...props,security:{...security,pbrDate:'2026-10-07'},
      sourceHistory:[...props.sourceHistory,{date:'2025-10-08',bps:'0'}]},false],
  ]) {
    const view=documentFor(DetailSurface,input);
    try {
      const overview=view.document.querySelector('#current-overview');
      assert.equal(overview.querySelector('.valuationHeading h2').textContent,'현재와 1년 전 BPS');
      assert.equal(overview.querySelector('.headlineAmount').textContent,'159,902원');
      assert.equal(overview.querySelector('[data-valuation-reference] strong').textContent,matched?'153,212원':'0원');
      const [current,previous]=overview.querySelectorAll('.valuationPeriod');
      assert.equal(Boolean(current.querySelector('[data-calculation]')),matched);
      assert.equal(Boolean(previous.querySelector('[data-calculation]')),matched);
      assert.equal(previous.querySelector('h3 time').dateTime,matched?previousDay:'2025-10-08');
      if (matched) {
        assert.deepEqual([...current.querySelectorAll('.calculationInputs dt')].map(node=>node.textContent),['종가','PBR']);
        assert.deepEqual([...current.querySelectorAll('.calculationInputs dd')].map(node=>node.textContent),['1,219,000원','7.62배']);
        assert.equal(current.querySelector('.calculationResult').textContent,'계산 BPS159,974원');
        assert.equal(current.querySelector('.calculationEstimate').textContent,'공개 BPS 159,902원');
        assert.deepEqual([...previous.querySelectorAll('.calculationInputs dd')].map(node=>node.textContent),['1,009,000원','6.59배']);
        assert.equal(previous.querySelector('.calculationResult').textContent,'계산 BPS153,111원');
        assert.equal(previous.querySelector('.calculationEstimate').textContent,'공개 BPS 153,212원');
        const pbr=current.querySelector('.calculationInputs > :last-child a');
        assert.equal(pbr.textContent,'7.62배');
        assert.equal(pbr.getAttribute('href'),'/security/KOSPI.005930/pbr?period=active-episode');
      } else {
        assert.equal(current.querySelector('.calculationResult dt').textContent,'공개 BPS');
        assert.equal(current.querySelector('.calculationResult dd').textContent,'159,902원');
        assert.equal(previous.querySelector('.calculationResult dd').textContent,'0원');
      }
    } finally {view.close();}
  }
});

test('dividend yield compares current and prior published percentages and explains verified fractions',()=>{
  const {DetailSurface}=loadFor('/security/KOSPI.005930/div')('components/detail-surface.tsx');
  const day='2026-10-08';
  const reference='2025-10-02';
  const props=primaryDetailProps({metric:'div',sourceHistory:[{date:reference,div:'0',dps:'0'},
    {date:'2025-10-09',div:'1',dps:'250'}],prices:[{date:reference,close:'10000'}]});
  const security={...props.security,state:'published',price:'20000',priceDate:day,selectedPeriod:{periodId:'active-episode'},
    dps:'250',dpsDate:day,dpsState:'provided',div:'1.25',divDate:day,divState:'provided'};
  for (const [overrides,matched] of [
    [{},true],
    [{dpsDate:'2026-10-07'},false],
    [{div:'2'},false],
    [{price:'0',div:'0'},false],
    [{dps:'0',div:'0'},true],
    [{dps:'-250',div:'-1.25'},false],
    [{dpsState:'source_missing'},false],
    [{dps:'250.6'},false],
  ]) {
    const view=documentFor(DetailSurface,{...props,security:{...security,...overrides}});
    try {
      const overview=view.document.querySelector('#current-overview');
      const [current,previous]=overview.querySelectorAll('.valuationPeriod');
      const calculation=current.querySelector('[data-calculation]');
      assert.equal(overview.querySelector('.valuationHeading h2').textContent,'현재와 1년 전 배당수익률');
      const help=overview.querySelector('.valuationHeading button[aria-label="배당수익률 뜻"]');
      assert.match(view.document.getElementById(help.getAttribute('aria-describedby')).textContent,/주당배당금을 종가로 나누고 100을 곱해/);
      assert.equal(current.querySelector('h3 time').dateTime,day);
      assert.equal(previous.querySelector('h3 time').dateTime,reference);
      assert.equal(overview.querySelector('[data-valuation-reference] strong').textContent,'0%');
      assert.equal(previous.querySelector('[data-calculation] .calculationResult dd').textContent,'0%');
      assert.deepEqual([...previous.querySelectorAll('.calculationInputs dd')].map(node=>node.textContent),['0원','10,000원']);
      assert.equal(Boolean(calculation),matched);
      assert.ok(overview.querySelector('#dividend-summary'));
      assert.equal(current.querySelector('.calculationResult dd').textContent,(overrides.div??'1.25').replace('-','−')+'%');
      if (matched) {
        assert.deepEqual([...calculation.querySelectorAll('.calculationInputs dt')].map(node=>node.textContent),['주당배당금','종가']);
        assert.match(calculation.querySelector('.calculationOperator').textContent,/× 100 ≈/);
        assert.equal(calculation.querySelector('.calculationInputs a').getAttribute('href'),'/security/KOSPI.005930/dps?period=active-episode');
      }
    } finally {view.close();}
  }
  for (const divState of ['provided','source_missing']) {
    const view=documentFor(DetailSurface,{...props,security,sourceHistory:[{date:reference,div:'0',divState}]});
    try {
      const previous=view.document.querySelector('[aria-label="1년 전 배당수익률 구성"]');
      assert.equal(previous.querySelector('[data-calculation]'),null);
      if (divState==='provided') assert.equal(previous.querySelector('.calculationResult dd').textContent,'0%');
      else assert.match(previous.textContent,/비교할 관측값이 없습니다/);
    } finally {view.close();}
  }
});

test('DPS compares dated published amounts using closing price times dividend yield',()=>{
  const {DetailSurface}=loadFor('/security/KOSPI.005930/dps')('components/detail-surface.tsx');
  const day='2026-10-08';
  const reference='2025-10-02';
  const props=primaryDetailProps({metric:'dps',sourceHistory:[{date:reference,dps:'0',div:'0'},
    {date:'2025-10-10',dps:'150',div:'1.5'}],prices:[{date:reference,close:'15000'}]});
  const security={...props.security,price:'20000',priceDate:day,
    dps:'250',dpsDate:day,dpsState:'provided',div:'1.25',divDate:day,divState:'provided'};
  for (const [overrides,matched,estimate] of [
    [{},true],
    [{dps:'0',div:'0'},true],
    [{divDate:'2026-10-07'},false],
    [{divState:'source_missing'},false],
    [{price:'0',div:'0',dps:'0'},false],
    [{div:'-1.25',dps:'-250'},false],
    [{dps:'251'},false],
    [{price:'262000',div:'0.64',dps:'1668'},true,'1,677원'],
    [{price:'100000',div:'0.1234',dps:'123'},true,'120원'],
    [{price:'100000',div:'0.1234',dps:'120'},false],
  ]) {
    const view=documentFor(DetailSurface,{...props,security:{...security,...overrides}});
    try {
      const overview=view.document.querySelector('#current-overview');
      assert.match(overview.querySelector('.valuationHeading h2').textContent,/현재와 1년 전 주당배당금/);
      assert.equal(overview.querySelector('[data-valuation-reference]').dataset.valuationReference,reference);
      const [current,previous]=overview.querySelectorAll('.valuationPeriod');
      assert.equal(current.querySelector('h3 time').dateTime,day);
      assert.equal(previous.querySelector('h3 time').dateTime,reference);
      assert.equal(previous.querySelector('[data-product] .calculationResult dd').textContent,'0원');
      assert.equal(Boolean(current.querySelector('[data-product]')),matched);
      assert.deepEqual([...current.querySelectorAll('.calculationInputs dt')].map(node=>node.textContent),['종가','배당수익률']);
      assert.equal(current.querySelector('.calculationResult dt').textContent,`${estimate?'계산':'공개'} 주당배당금`);
      const published=(overrides.dps??'250').replace('-','−')+'원';
      assert.equal(current.querySelector('.calculationResult dd').textContent.replaceAll(',',''),estimate?.replaceAll(',','')??published);
      if (matched) {
        assert.equal(current.querySelector('.multiplicationSign').textContent.trim(),'×');
        assert.equal(current.querySelector('.calculationInputs > :last-child dd').textContent.trim(),'× '+(overrides.div==='0.1234'?'0.12':overrides.div??'1.25')+'%');
        assert.match(current.querySelector('.calculationOperator').textContent,/^≈/);
      }
      assert.equal(current.querySelector('.calculationEstimate')?.textContent.replaceAll(',',''),estimate && `공개 주당배당금 ${published}`);
      assert.ok(overview.querySelector('#dividend-summary'));
    } finally {view.close();}
  }
});

test('PER puts composition below dated comparisons and keeps quote changes distinct',()=>{
  const {DetailSurface}=loadFor('/security/KOSPI.005930/per')('components/detail-surface.tsx');
  const props=primaryDetailProps({metric:'per'});
  const view=documentFor(DetailSurface,{...props,
    security:{...props.security,per:'18.567',perState:'provided',perDate:'2026-10-08',
      eps:'61',epsState:'provided',epsDate:'2026-10-06',priceDate:'2026-10-07'},
    history:[{date:'2026-10-06',value:'10'},{date:'2026-10-08',value:'18.567'}],
    sourceHistory:[{date:'2025-10-07',per:'13.452',eps:'50'}],
    prices:[{date:'2025-10-07',close:'100'},{date:'2026-10-07',close:'74000',rate:'3.567'}]});
  try {
    const doc=view.document;
    assertOrder(doc,['.headlineRow','.comparisonStrip','.valuationSupport']);
    assert.equal(doc.querySelector('.headlineAmount').textContent,'18.57배');
    const reference=doc.querySelector('[data-valuation-reference]');
    assert.equal(reference.dataset.valuationReference,'2025-10-07');
    assert.equal(doc.querySelector('#current-overview time[datetime="2025-10-07"]').closest('h3').textContent,'1년 전 2025-10-07');
    assert.match(reference.textContent,/13.45배/);
    assert.equal(doc.querySelector('.comparisonStrip .quoteChange'),null);
    const [current,previous]=doc.querySelectorAll('.valuationSupport .valuationPeriod');
    assert.match(current.querySelector('.quoteChange').textContent,/주가 전일 대비 \+3.57%/);
    assert.deepEqual([...current.querySelectorAll('.calculationInputs time')].map(date=>date.dateTime),['2026-10-07','2026-10-06']);
    assert.equal(previous.querySelector('.quoteChange'),null);
    assert.equal(doc.querySelectorAll('.metricCalculation[data-calculation]').length,0);
    assert.equal(previous.querySelector('.calculationResult dd').textContent,'13.45배');
    assert.equal(doc.querySelector('.valuationSupport h2').textContent,'현재와 1년 전 PER');
    const help=doc.querySelector('.valuationHeading button[aria-label="주가수익비율(PER) 뜻"]');
    assert.equal(help.getAttribute('aria-expanded'),'false');
    const description=doc.getElementById(help.getAttribute('aria-describedby'));
    assert.ok(description.hidden);
    assert.match(description.textContent,/종가를 주당순이익\(EPS\)으로 나눈 배수/);
  } finally {view.close();}
});

test('PER displays the fraction only when dated source and visible inputs explain the published value',()=>{
  const {ValuationSummary}=loadFor('/security/KOSPI.005930/per')('components/detail-investor-records.tsx');
  const day='2026-10-08';
  const security={routeCode:'KOSPI.005930',state:'published',price:'262000',priceDate:day,eps:'6605',epsDate:day,per:'39.67',perDate:day};
  for (const [overrides, matched] of [
    [{},true],
    [{epsDate:'2026-10-07'},false],
    [{per:'40'},false],
    [{eps:'0',per:'0'},false],
    [{eps:'-6605',per:'-39.67'},false],
    [{eps:null},false],
    [{eps:'6605.49',price:'262060',per:'39.67'},false],
    [{price:'0',per:'0'},true],
  ]) {
    const view=documentFor(ValuationSummary,{metric:'per',security:{...security,...overrides},scope:{},previous:{
      date:'2025-10-02',price:'89000',related:'4950',metric:'17.98',
    }});
    try {
      const [current,previous]=view.document.querySelectorAll('.metricCalculation');
      assert.equal(current.hasAttribute('data-calculation'),matched);
      assert.equal(Boolean(current.querySelector('.calculationOperator')),matched);
      assert.equal(previous.hasAttribute('data-calculation'),true);
      assert.equal(previous.querySelector('.calculationResult dd').textContent,'17.98배');
      assert.ok(current.querySelector('a[href$="/KOSPI.005930"]'));
    } finally {view.close();}
  }
});

test('PBR compares two dated observations and only shows a fraction for verified inputs',()=>{
  const {ValuationSummary}=loadFor('/security/KOSPI.005930/pbr')('components/detail-investor-records.tsx');
  const day='2026-10-08';
  const security={routeCode:'KOSPI.005930',state:'published',price:'262000',priceDate:day,bps:'63997',bpsDate:day,pbr:'4.09',pbrDate:day};
  const previous={date:'2025-10-02',price:'89000',related:'57951',metric:'1.54'};
  for (const [overrides,match] of [
    [{},true], [{bpsDate:'2026-10-07'},false], [{bps:'0'},false], [{bpsState:'source_missing'},false], [{pbr:'4.1'},false],
  ]) {
    const view=documentFor(ValuationSummary,{metric:'pbr',security:{...security,...overrides},scope:{periodId:'period-a'},previous});
    try {
      const help=view.document.querySelector('.valuationHeading button[aria-label="주가순자산비율(PBR) 뜻"]');
      assert.equal(help.getAttribute('aria-expanded'),'false');
      const description=view.document.getElementById(help.getAttribute('aria-describedby'));
      assert.ok(description.hidden);
      assert.match(description.textContent,/종가를 주당순자산\(BPS\)으로 나눈 배수/);
      const [current,prior]=view.document.querySelectorAll('.valuationPeriod');
      assert.equal(current.querySelector('h3 time').dateTime,day);
      assert.equal(current.querySelector('.metricCalculation').hasAttribute('data-calculation'),match);
      assert.equal(current.querySelector('.calculationResult dd').textContent,(overrides.pbr??'4.09')+'배');
      assert.equal(prior.querySelector('h3 time').dateTime,previous.date);
      assert.equal(prior.querySelector('.calculationResult dd').textContent,'1.54배');
      assert.ok(prior.querySelector('.metricCalculation[data-calculation]'));
      if (overrides.bpsDate) assert.equal(current.querySelector('.calculationInputs time').dateTime,overrides.bpsDate);
      if (match) {
        assert.deepEqual([...current.querySelectorAll('.calculationInputs dt')].map(node=>node.textContent),['종가','주당순자산 BPS']);
        assert.ok(current.querySelector('a[href$="/bps?period=period-a"]'));
      }
    } finally {view.close();}
  }
});

test('PER never borrows the rate from a different date, close, or historical quote',()=>{
  const {DetailSurface}=loadFor('/security/KOSPI.005930/per')('components/detail-surface.tsx');
  const props=primaryDetailProps({metric:'per'});
  const security={...props.security,per:'18',perState:'provided',perDate:'2026-10-08',priceDate:'2026-10-08',
    eps:'61',epsState:'provided',epsDate:'2026-10-08'};
  for (const [overrides,prices] of [
    [{},[{date:'2026-10-07',close:'74000',rate:'-0.5'}]],
    [{},[{date:'2026-10-08',close:'73999',rate:'-0.5'}]],
    [{},[{date:'2026-10-08',close:'74000',rate:''}]],
    [{priceState:'source_missing',price:null},[{date:'2026-10-08',close:'74000',rate:'-0.5'}]],
    [{historicalPeriod:true,price:null,priceDate:null},[{date:'2026-10-08',close:'74000',rate:'-0.5'}]],
  ]) {
    const view=documentFor(DetailSurface,{...props,security:{...security,...overrides},prices});
    try {assert.equal(view.document.querySelector('.valuationSupport .quoteChange'),null);}
    finally {view.close();}
  }
});
