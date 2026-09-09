import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const root = new URL("../", import.meta.url);
const [app, html, pricingHtml, styles] = await Promise.all([
  readFile(new URL("app.js", root), "utf8"),
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("pricing.html", root), "utf8"),
  readFile(new URL("styles.css", root), "utf8"),
]);

test("ambient motion runs only in visible motion scenes", () => {
  assert.equal(html.match(/data-motion-scene/g)?.length, 4);
  assert.match(app, /querySelectorAll\("\[data-motion-scene\]"\)/);
  assert.match(app, /classList\.toggle\("is-motion-active"/);
  assert.match(app, /!document\.hidden && !shouldReduceMotion\(\)/);
  assert.match(app, /if \(shouldReduceMotion\(\)\) disableMotion\(\);\s*else enableMotion\(\);/);

  const infiniteAnimations = [...styles.matchAll(/animation:[^;}]*\binfinite\b/g)].map(
    ([declaration]) => declaration,
  );
  assert.deepEqual(infiniteAnimations, ["animation: caretBlink 900ms steps(1) infinite"]);
});

test("scroll-time effects avoid layout and blur animation", () => {
  assert.doesNotMatch(styles, /backdrop-filter/);
  assert.doesNotMatch(styles, /filter:\s*blur/);

  const flowKeyframes = styles
    .split("\n")
    .filter((line) => line.includes("@keyframes dataFlow"));
  assert.equal(flowKeyframes.length, 2);
  flowKeyframes.forEach((keyframes) => {
    assert.doesNotMatch(keyframes, /\b(?:left|top)\s*:/);
    assert.match(keyframes, /transform:\s*translate3d/);
  });
});

test("offscreen sections skip rendering while preserving their intrinsic layout", () => {
  assert.match(styles, /main > section, \.footer \{ contain: layout paint; \}/);
  assert.match(styles, /@supports \(content-visibility: auto\)/);
  assert.match(styles, /main > \.story, main > \.privacy-band, \.footer \{ content-visibility: auto; contain-intrinsic-size: auto 900px; \}/);
});

test("large animated surfaces receive compositor hints only while their scene is active", () => {
  assert.match(styles, /\[data-motion-scene\]\.is-motion-active :is\([^}]+\) \{ backface-visibility: hidden; will-change: transform; \}/);
  assert.doesNotMatch(styles, /\.hero-window \{[^}]*will-change/);
  assert.doesNotMatch(styles, /\.compass-window \{[^}]*will-change/);
});

test("scroll progress is native-only and hidden without timeline support", () => {
  assert.match(styles, /\.scroll-progress \{ display: none;/);
  assert.match(styles, /@supports \(animation-timeline: scroll\(\)\)/);
  assert.match(styles, /display: block; animation: scrollProgress linear both; animation-timeline: scroll\(root block\)/);
  assert.doesNotMatch(app, /addEventListener\("scroll"/);
  assert.doesNotMatch(app, /ResizeObserver|scrollHeight|scrollY/);
});

test("first-party motion setup does not wait for Paddle", () => {
  const appScript = pricingHtml.search(/<script defer src="\.\/app\.js\?v=\d+"><\/script>/);
  const paddleScript = pricingHtml.indexOf("cdn.paddle.com");
  assert.ok(appScript >= 0);
  assert.ok(paddleScript >= 0);
  assert.ok(appScript < paddleScript);
});

test("changing Reduce Motion pauses and resumes a visible scene", () => {
  const classList = () => {
    const values = new Set();
    return {
      add: (...names) => names.forEach((name) => values.add(name)),
      contains: (name) => values.has(name),
      remove: (...names) => names.forEach((name) => values.delete(name)),
      toggle: (name, force) => {
        const shouldAdd = force ?? !values.has(name);
        if (shouldAdd) values.add(name);
        else values.delete(name);
        return shouldAdd;
      },
    };
  };

  const body = { classList: classList() };
  const reveal = {
    classList: classList(),
    getBoundingClientRect: () => ({ top: 0, bottom: 100 }),
  };
  const scene = { classList: classList() };
  const progress = { style: {} };
  const observers = [];
  class Observer {
    constructor(callback) {
      this.callback = callback;
      this.observed = [];
      observers.push(this);
    }

    observe(node) {
      this.observed.push(node);
    }

    unobserve() {}
  }

  let preferenceListener;
  let effectsListener;
  const effectsLabel = { hidden: true };
  const effectsControl = {
    checked: false,
    closest: () => effectsLabel,
    addEventListener: (_event, listener) => { effectsListener = listener; },
  };
  const saved = new Map();
  const motionPreference = {
    matches: false,
    addEventListener: (_event, listener) => { preferenceListener = listener; },
  };
  const context = {
    localStorage: { getItem: (key) => saved.get(key), setItem: (key, value) => saved.set(key, value) },
    IntersectionObserver: Observer,
    addEventListener: () => {},
    document: {
      body,
      documentElement: { scrollHeight: 2000 },
      hidden: false,
      addEventListener: () => {},
      querySelector: (selector) => selector === ".scroll-progress" ? progress : null,
      querySelectorAll: (selector) => {
        if (selector === "[data-reduce-effects]") return [effectsControl];
        if (selector === ".reveal") return [reveal];
        if (selector === "[data-motion-scene]") return [scene];
        return [];
      },
    },
    innerHeight: 1000,
    requestAnimationFrame: (callback) => callback(),
    scrollY: 0,
    setTimeout,
  };
  context.window = context;
  context.matchMedia = () => motionPreference;

  runInNewContext(app, context);
  const sceneObserver = observers.find((candidate) => candidate.observed.includes(scene));
  assert.ok(sceneObserver);
  sceneObserver.callback([{ isIntersecting: true, target: scene }]);
  assert.equal(scene.classList.contains("is-motion-active"), true);

  motionPreference.matches = true;
  preferenceListener({ matches: true });
  assert.equal(scene.classList.contains("is-motion-active"), false);
  assert.equal(body.classList.contains("motion-ready"), false);

  motionPreference.matches = false;
  preferenceListener({ matches: false });
  assert.equal(scene.classList.contains("is-motion-active"), true);
  assert.equal(body.classList.contains("motion-ready"), true);
  assert.equal(effectsLabel.hidden, false);
  effectsControl.checked = true;
  effectsListener();
  assert.equal(body.classList.contains("reduced-effects"), true);
  assert.equal(scene.classList.contains("is-motion-active"), false);
  assert.equal(saved.get("cove-reduce-effects"), "true");
  motionPreference.matches = true;
  effectsControl.checked = false;
  effectsListener();
  assert.equal(scene.classList.contains("is-motion-active"), false);
  motionPreference.matches = false;
  preferenceListener();
  assert.equal(scene.classList.contains("is-motion-active"), true);
  effectsControl.checked = true;
  effectsListener();
  const reloaded = { ...context };
  reloaded.window = reloaded;
  runInNewContext(app, reloaded);
  assert.equal(effectsControl.checked, true);
  assert.equal(body.classList.contains("reduced-effects"), true);
});
