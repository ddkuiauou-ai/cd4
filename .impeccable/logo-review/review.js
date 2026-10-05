const labels = {
  nanum: '나눔명조 ExtraBold',
  noto: 'Noto Serif KR',
  black: 'Black Han Sans',
};

const requestedFont = new URLSearchParams(window.location.search).get('font');
if (Object.hasOwn(labels, requestedFont)) {
  document.body.dataset.font = requestedFont;
  document.querySelector(`input[value="${requestedFont}"]`).checked = true;
  document.getElementById('font-status').textContent = `현재 적용: ${labels[requestedFont]}`;
}

document.querySelector('.font-picker').addEventListener('change', (event) => {
  const selectedFont = event.target.value;
  if (!Object.hasOwn(labels, selectedFont)) return;
  document.body.dataset.font = selectedFont;
  document.getElementById('font-status').textContent = `현재 적용: ${labels[selectedFont]}`;
  const url = new URL(window.location.href);
  url.searchParams.set('font', selectedFont);
  window.history.replaceState(null, '', url);
});
