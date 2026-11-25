const targets = new Map<HTMLElement, boolean>();
let observer: IntersectionObserver | null = null;

function updateMotion(element: HTMLElement, inView: boolean) {
  element.dataset.animate = String(inView && document.visibilityState === 'visible');
}

function updateDocumentVisibility() {
  for (const [element, inView] of targets) updateMotion(element, inView);
}

/** Play decorative loops only while both the element and the document are visible. */
export function observeVisibleMotion(element: HTMLElement | null) {
  if (!element || typeof IntersectionObserver === 'undefined') return;
  if (!observer) {
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const element = entry.target as HTMLElement;
        if (!targets.has(element)) continue;
        const inView = entry.isIntersecting && entry.intersectionRatio > 0;
        targets.set(element, inView);
        updateMotion(element, inView);
      }
    }, { threshold: 0.01 });
    document.addEventListener('visibilitychange', updateDocumentVisibility);
  }
  targets.set(element, false);
  updateMotion(element, false);
  observer.observe(element);
  return () => {
    observer?.unobserve(element);
    targets.delete(element);
    element.removeAttribute('data-animate');
    if (!targets.size) {
      observer?.disconnect();
      observer = null;
      document.removeEventListener('visibilitychange', updateDocumentVisibility);
    }
  };
}
