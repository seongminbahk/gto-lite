/** A full page load: moving between /… and /ko/… crosses root layouts, which Next loads afresh anyway. */
export function loadPage(href: string) {
  window.location.assign(href);
}
