// head.js — per-route <head> management. Runs identically at Shape E
// prerender time (happy-dom captures document.head into the emitted
// HTML) and in the browser after remount.
export function setHead({ title, description, ogImage }) {
  if (title) document.title = title;
  const upsert = (attr, key, content) => {
    if (!content) return;
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };
  upsert('name', 'description', description);
  upsert('property', 'og:title', title);
  upsert('property', 'og:description', description);
  upsert('property', 'og:image', ogImage);
}
