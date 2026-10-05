const variants = {
  'ranking-light': {src:'assets/desktop-shell/ranking-light-v2.png',width:1491,height:1055,label:'라이트 순위'},
  'ranking-dark': {src:'assets/desktop-shell/ranking-dark.png',width:1491,height:1055,label:'다크 순위'},
  'detail-light': {src:'assets/desktop-shell/detail-light-v2.png',width:1448,height:1086,label:'라이트 삼성전자 상세'},
  'detail-dark': {src:'assets/desktop-shell/detail-dark.png',width:1448,height:1086,label:'다크 삼성전자 상세'},
};
const query = new URLSearchParams(location.search);
let theme = query.get('theme') === 'dark' ? 'dark' : 'light';

function fillStage(stage,page,currentTheme) {
  const variant=variants[`${page}-${currentTheme}`];
  stage.className=`stage ${currentTheme}`;
  stage.dataset.theme=currentTheme;
  stage.dataset.page=page;
  stage.replaceChildren();
  const image=document.createElement('img');
  image.className='comp';
  image.src=variant.src;
  image.width=variant.width;
  image.height=variant.height;
  image.alt=`천하제일 단타대회 · ${variant.label} 데스크톱 시안. 숫자와 차트는 예시입니다.`;
  const mask=document.createElement('div');
  mask.className='logo-mask';
  mask.setAttribute('aria-hidden','true');
  const zone=document.createElement('div');
  zone.className='logo-zone';
  zone.innerHTML='<span class="wordmark" aria-label="천하제일 단타대회"><span class="first">천하제일</span><img src="assets/icon.svg" alt="" width="36" height="36"><span class="last">단타대회</span></span>';
  stage.append(image,mask,zone);
}

function setTheme(nextTheme) {
  theme=nextTheme;
  document.querySelectorAll('.stage[data-page]').forEach(stage=>fillStage(stage,stage.dataset.page,theme));
  document.querySelectorAll('button[data-theme]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.theme===theme)));
  document.querySelectorAll('a[data-preview]').forEach(link=>link.href=`desktop-shell-preview.html?page=${link.dataset.preview}&theme=${theme}`);
  const url=new URL(location.href);
  url.searchParams.set('theme',theme);
  history.replaceState(null,'',url);
}

document.querySelectorAll('button[data-theme]').forEach(button=>button.addEventListener('click',()=>setTheme(button.dataset.theme)));
if(document.querySelector('.comparisons')) setTheme(theme);

const single=document.querySelector('.single-stage');
if(single) {
  const page=query.get('page')==='detail'?'detail':'ranking';
  document.body.dataset.theme=theme;
  document.title=`황금 전광판 · ${variants[`${page}-${theme}`].label}`;
  const stage=document.createElement('div');
  fillStage(stage,page,theme);
  single.append(stage);
}
