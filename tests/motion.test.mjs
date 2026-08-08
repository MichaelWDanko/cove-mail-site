import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const root = new URL("../", import.meta.url);
const [app, html, styles] = await Promise.all([
  readFile(new URL("app.js", root), "utf8"),
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("styles.css", root), "utf8"),
]);

test("ambient motion runs only in visible motion scenes", () => {
  assert.equal(html.match(/data-motion-scene/g)?.length, 5);
  assert.match(app, /querySelectorAll\("\[data-motion-scene\]"\)/);
  assert.match(app, /classList\.toggle\("is-motion-active"/);
  assert.match(app, /!document\.hidden && !motionPreference\.matches/);
  assert.match(app, /if \(event\.matches\) disableMotion\(\);\s*else enableMotion\(\);/);

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

test("scroll progress caches its range and clamps elastic overscroll", () => {
  const updateStart = app.indexOf("const updateProgress");
  const measureStart = app.indexOf("const measureScrollRange");
  assert.ok(updateStart >= 0 && measureStart > updateStart);

  const updateProgress = app.slice(updateStart, measureStart);
  assert.doesNotMatch(updateProgress, /scrollHeight/);
  assert.match(updateProgress, /Math\.min\(1, Math\.max\(0,/);
  assert.match(updateProgress, /style\.transform = `scaleX/);
});

test("first-party motion setup does not wait for Paddle", () => {
  const appScript = html.search(/<script defer src="\.\/app\.js\?v=\d+"><\/script>/);
  const paddleScript = html.indexOf("cdn.paddle.com");
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
  const motionPreference = {
    matches: false,
    addEventListener: (_event, listener) => { preferenceListener = listener; },
  };
  const context = {
    ResizeObserver: class { observe() {} },
    IntersectionObserver: Observer,
    addEventListener: () => {},
    document: {
      body,
      documentElement: { scrollHeight: 2000 },
      hidden: false,
      addEventListener: () => {},
      querySelector: (selector) => selector === ".scroll-progress" ? progress : null,
      querySelectorAll: (selector) => {
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
});
