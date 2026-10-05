const variants = {
  'desktop-dark': { src: 'assets/scoreboard/desktop-dark.png', width: 1505, height: 1045, label: '다크 데스크톱' },
  'desktop-light': { src: 'assets/scoreboard/desktop-light-v2.png', width: 1505, height: 1045, label: '라이트 데스크톱' },
  'mobile-dark': { src: 'assets/a-base.png', width: 853, height: 1844, label: '다크 모바일' },
  'mobile-light': { src: 'assets/scoreboard/mobile-light-v2.png', width: 853, height: 1844, label: '라이트 모바일' },
};

function fillStage(stage, device, theme) {
  const variant = variants[`${device}-${theme}`];
  if (!variant) return;
  stage.className = `stage ${device} ${theme}`;
  stage.dataset.device = device;
  stage.dataset.theme = theme;
  const image = document.createElement('img');
  image.className = 'comp';
  image.src = variant.src;
  image.width = variant.width;
  image.height = variant.height;
  image.alt = `천하제일 단타대회 황금 전광판 · ${variant.label} 시안. 표의 데이터는 예시입니다.`;
  stage.append(image);
  if (device === 'mobile' && theme === 'dark') {
    const mask = document.createElement('div');
    mask.className = 'logo-mask';
    stage.append(mask);
    const recent = document.createElement('span');
    recent.className = 'recent';
    recent.textContent = '최근 본';
    stage.append(recent);
  }
  const zone = document.createElement('div');
  zone.className = 'logo-zone';
  zone.innerHTML = '<span class="wordmark" aria-label="천하제일 단타대회"><span class="first">천하제일</span><img src="assets/icon.svg" alt="" width="36" height="36"><span class="last">단타대회</span></span>';
  stage.append(zone);
}

document.querySelectorAll('.stage[data-device]').forEach(stage => fillStage(stage, stage.dataset.device, stage.dataset.theme));

const single = document.querySelector('.single-stage');
if (single) {
  const query = new URLSearchParams(location.search);
  const device = query.get('device') === 'mobile' ? 'mobile' : 'desktop';
  const theme = query.get('theme') === 'light' ? 'light' : 'dark';
  document.body.dataset.device = device;
  document.body.dataset.theme = theme;
  document.title = `황금 전광판 · ${variants[`${device}-${theme}`].label} 시안`;
  const stage = document.createElement('div');
  fillStage(stage, device, theme);
  single.append(stage);
}
