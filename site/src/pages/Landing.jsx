// Landing.jsx — the home page: componentized nav + extracted body +
// mega footer, with the original site behaviors (reveals, counters,
// copy buttons, hero phone demo) re-attached after render.
import { onMount } from 'solid-js';
import { TopNav } from '../components/Chrome.jsx';
import { setHead } from '../head.js';
import { initSiteBehaviors } from '../behaviors.js';
import * as landing from '../content/landing.js';
import * as footer from '../content/landing-footer.js';

export function Landing() {
  setHead({
    title: landing.title,
    description: landing.description,
    ogImage: '/assets/skal-hero.png',
  });
  onMount(initSiteBehaviors);
  return (
    <>
      <TopNav />
      <div innerHTML={landing.default} />
      <div innerHTML={footer.default} />
    </>
  );
}
