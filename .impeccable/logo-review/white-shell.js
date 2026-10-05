const query = new URLSearchParams(location.search);
let theme = query.get('theme') === 'dark' ? 'dark' : 'light';
const variants = {
  'desktop-light': {src:'assets/white-shell/ranking-light.png',width:1491,height:1055,label:'라이트 데스크톱'},
  'desktop-dark': {src:'assets/navigation/ranking-dark.png',width:1491,height:1055,label:'다크 데스크톱'},
  'mobile-light': {src:'assets/white-shell/mobile-light-rank-base.png',width:853,height:1844,label:'라이트 모바일'},
  'mobile-dark': {src:'assets/white-shell/mobile-dark-rank-base.png',width:853,height:1844,label:'다크 모바일'},
  'detail-light': {src:'assets/white-shell/detail-light.png',width:1447,height:1087,label:'라이트 삼성전자 상세'},
  'detail-dark': {src:'assets/navigation/detail-dark.png',width:1449,height:1086,label:'다크 삼성전자 상세'},
};
const companies = ['삼성전자','SK하이닉스','LG에너지솔루션','삼성바이오로직스','현대차','한화에어로스페이스'];
const previousRanks = [1,4,2,5,3,6];
const desktopCenters = [421,515,609,704,800,898];
const mobileCenters = [717.5,863,1009.5,1155.5,1302,1449];
function arrow(direction) {
  const paths = {up:'M7 12V2M3 6l4-4 4 4',down:'M7 2v10M3 8l4 4 4-4',right:'M2 7h10M8 3l4 4-4 4'};
  return `<svg class="direction" viewBox="0 0 14 14" aria-hidden="true"><path d="${paths[direction]}"/></svg>`;
}
document.querySelectorAll('[data-arrow]').forEach(node=>node.insertAdjacentHTML('afterbegin',arrow(node.dataset.arrow)));
function fillStage(stage,device,currentTheme) {
  const variant=variants[`${device}-${currentTheme}`];
  stage.className=`stage ${device==='mobile'?'mobile ':''}${currentTheme}`;
  stage.dataset.device=device;
  stage.dataset.theme=currentTheme;
  stage.dataset.page=device==='detail'?'detail':device==='desktop'?'ranking':'mobile';
  stage.replaceChildren();
  const image=document.createElement('img');
  image.className='comp';image.src=variant.src;image.width=variant.width;image.height=variant.height;
  image.alt=`천하제일 단타대회 · ${variant.label} 화이트 톤과 순위 정렬 개선 시안. 숫자와 차트는 예시입니다.`;
  stage.append(image);
  if(device==='mobile'&&currentTheme==='dark') {
    const mask=document.createElement('div');mask.className='logo-mask';stage.append(mask);
    const recent=document.createElement('span');recent.className='recent';recent.textContent='최근 본';stage.append(recent);
  }
  const zone=document.createElement('div');zone.className='logo-zone';
  zone.innerHTML='<span class="wordmark" aria-label="천하제일 단타대회"><span class="first">천하제일</span><img src="assets/icon.svg" alt="" width="36" height="36"><span class="last">단타대회</span></span>';
  stage.append(zone);
  if(device==='detail') return;
  const note=document.createElement('div');note.className='rank-note';note.hidden=true;note.role='tooltip';
  note.id=`rank-note-${device}-${currentTheme}`;stage.append(note);
  let pinned=null;
  const hide=()=>{note.hidden=true;};
  previousRanks.forEach((prior,index)=>{
    const current=index+1;const change=prior-current;
    const button=document.createElement('button');button.type='button';button.className=device==='mobile'?'rank-group':'rank-indicator';
    button.dataset.state=change===0?'same':change>0?'up':'down';
    button.dataset.current=String(current);button.dataset.previous=String(prior);
    button.dataset.digits=String(Math.min(String(current).length,4));
    button.style.top=`${(device==='mobile'?mobileCenters[index]:desktopCenters[index])/variant.width*100}cqi`;
    const description=change===0?`${companies[index]}: 이전 ${prior}위, 현재 ${current}위, 순위 유지`:`${companies[index]}: 이전 ${prior}위에서 현재 ${current}위, ${Math.abs(change)}계단 ${change>0?'상승':'하락'}`;
    button.setAttribute('aria-label',description);button.setAttribute('aria-describedby',note.id);
    const movement=change===0?'유지':`${arrow(change>0?'up':'down')}<span>${Math.abs(change)}</span>`;
    button.innerHTML=device==='mobile'?`<span class="rank-value" aria-hidden="true">${current}</span><span class="rank-movement-value" aria-hidden="true">${movement}</span>`:movement;
    const show=()=>{
      note.replaceChildren();const heading=document.createElement('strong');heading.textContent=change===0?'순위 유지':`${Math.abs(change)}계단 ${change>0?'상승':'하락'}`;
      const detail=document.createElement('span');detail.textContent=`이전 ${prior}위 → 현재 ${current}위 · 예시`;
      note.append(heading,detail);note.hidden=false;
      const left=button.offsetLeft;const desiredTop=button.offsetTop+button.offsetHeight/2+4;
      note.style.left=`${Math.min(left,Math.max(12,stage.clientWidth-note.offsetWidth-12))}px`;
      note.style.top=`${Math.min(desiredTop,stage.clientHeight-note.offsetHeight-8)}px`;
    };
    button.addEventListener('mouseenter',show);button.addEventListener('mouseleave',()=>{if(pinned!==button)hide();});
    button.addEventListener('focus',show);button.addEventListener('blur',()=>{if(pinned!==button)hide();});
    button.addEventListener('click',()=>{if(pinned===button){pinned=null;hide();}else{pinned=button;show();}});
    button.addEventListener('keydown',event=>{if(event.key==='Escape'){pinned=null;hide();}});
    stage.append(button);
  });
  const key=document.createElement('p');key.className='rank-key';key.innerHTML='<strong>순위 변화</strong>화살표와 숫자 = 이동한 계단 수<br>이전 순위 대비 · 주가 등락과 별개';stage.append(key);
  stage.onclick=event=>{if(!event.target.closest('.rank-indicator,.rank-group')){pinned=null;hide();}};
}
function setTheme(next) {
  theme=next;
  document.querySelectorAll('.stage[data-device]').forEach(stage=>fillStage(stage,stage.dataset.device,theme));
  document.querySelectorAll('button[data-theme]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.theme===theme)));
  document.querySelectorAll('a[data-preview]').forEach(link=>link.href=`white-shell-preview.html?device=${link.dataset.preview}&theme=${theme}`);
  const url=new URL(location.href);url.searchParams.set('theme',theme);history.replaceState(null,'',url);
}
document.querySelectorAll('button[data-theme]').forEach(button=>button.addEventListener('click',()=>setTheme(button.dataset.theme)));
if(document.querySelector('.ranking-comparisons'))setTheme(theme);
const single=document.querySelector('.single-stage');
if(single) {
  const device=['mobile','detail'].includes(query.get('device'))?query.get('device'):'desktop';
  document.body.dataset.device=device;document.body.dataset.theme=theme;
  document.title=`황금 전광판 · ${variants[`${device}-${theme}`].label} 화이트 톤과 순위 정렬`;
  const stage=document.createElement('div');fillStage(stage,device,theme);single.append(stage);
}
