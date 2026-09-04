const menuButton = document.querySelector(".menu-button");
const siteNav = document.querySelector(".site-nav");

if (menuButton && siteNav) {
  menuButton.addEventListener("click", () => {
    const open = siteNav.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(open));
  });
  siteNav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      siteNav.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
    }
  });
}

document.querySelectorAll("[data-current-year]").forEach((node) => {
  node.textContent = String(new Date().getFullYear());
});

const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const revealNodes = [...document.querySelectorAll(".reveal")];
const motionSupported = "IntersectionObserver" in window;
let disableMotion = () => {};
let enableMotion = () => {};

if (!motionSupported) {
  revealNodes.forEach((node) => node.classList.add("is-visible"));
} else {
  if (motionPreference.matches) {
    revealNodes.forEach((node) => node.classList.add("is-visible"));
  } else {
    const initialRevealBoundary = innerHeight * 0.92;
    revealNodes.forEach((node) => {
      const bounds = node.getBoundingClientRect();
      if (bounds.top < initialRevealBoundary && bounds.bottom > 0) {
        node.classList.add("is-visible");
      }
    });

    document.body.classList.add("motion-ready");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => document.body.classList.add("page-loaded"));
    });
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8%" },
  );
  revealNodes.filter((node) => !node.classList.contains("is-visible")).forEach((node) => observer.observe(node));

  const motionScenes = [...document.querySelectorAll("[data-motion-scene]")];
  const visibleMotionScenes = new Set();
  const updateMotionScenes = () => {
    const canAnimate = !document.hidden && !motionPreference.matches;
    motionScenes.forEach((scene) => {
      scene.classList.toggle("is-motion-active", canAnimate && visibleMotionScenes.has(scene));
    });
  };
  const sceneObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) visibleMotionScenes.add(entry.target);
      else visibleMotionScenes.delete(entry.target);
    });
    updateMotionScenes();
  }, { threshold: 0.08 });
  motionScenes.forEach((scene) => sceneObserver.observe(scene));

  const compassWindow = document.querySelector(".compass-window");
  const compassInput = compassWindow?.querySelector(".compass-input strong");
  const compassResults = [...(compassWindow?.querySelectorAll(".compass-result") ?? [])];
  let compassObserver;
  let startCompassMotion = () => {};
  let stopCompassMotion = () => {};

  if (compassWindow && compassInput && compassResults.length) {
    const defaultInput = compassInput.textContent;
    const demonstration = { query: "from:Maya Lin", result: 1 };
    let compassInView = false;
    let compassRunning = false;
    let compassGeneration = 0;

    const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    const restoreCompass = () => {
      compassInput.textContent = defaultInput;
      compassWindow.classList.remove("is-simulating");
      compassResults.forEach((result, index) => result.classList.toggle("active", index === 0));
    };
    const stopCompass = () => {
      compassRunning = false;
      compassGeneration += 1;
      restoreCompass();
    };
    const startCompass = async () => {
      if (compassRunning || !compassInView || document.hidden || motionPreference.matches) return;
      compassRunning = true;
      const generation = ++compassGeneration;
      compassWindow.classList.add("is-simulating");

      compassInput.textContent = "";
      compassResults.forEach((result) => result.classList.remove("active"));
      for (const character of demonstration.query) {
        if (!compassRunning || generation !== compassGeneration) return;
        compassInput.textContent += character;
        await delay(62);
      }

      compassResults[demonstration.result]?.classList.add("active");
      await delay(1650);
      if (!compassRunning || generation !== compassGeneration) return;
      compassWindow.classList.remove("is-simulating");
      compassRunning = false;
    };

    compassObserver = new IntersectionObserver(([entry]) => {
      compassInView = entry.isIntersecting;
      if (compassInView) startCompass();
      else stopCompass();
    }, { threshold: 0.45 });

    compassObserver.observe(compassWindow);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopCompass();
      else if (compassInView) startCompass();
    });
    startCompassMotion = startCompass;
    stopCompassMotion = stopCompass;
  }

  const progress = document.querySelector(".scroll-progress");
  const supportsScrollDrivenProgress = typeof CSS !== "undefined"
    && typeof CSS.supports === "function"
    && CSS.supports("animation-timeline: scroll()");
  if (progress && !supportsScrollDrivenProgress) {
    let scrollRange = 1;
    let frameRequested = false;
    const updateProgress = () => {
      const ratio = Math.min(1, Math.max(0, scrollY / scrollRange));
      progress.style.transform = `scaleX(${ratio})`;
      frameRequested = false;
    };
    const measureScrollRange = () => {
      scrollRange = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      updateProgress();
    };
    addEventListener("scroll", () => {
      if (!frameRequested) {
        requestAnimationFrame(updateProgress);
        frameRequested = true;
      }
    }, { passive: true });
    addEventListener("resize", measureScrollRange, { passive: true });
    if ("ResizeObserver" in window) {
      const sizeObserver = new ResizeObserver(measureScrollRange);
      sizeObserver.observe(document.body);
    }
    measureScrollRange();
  }

  const handleVisibilityChange = () => updateMotionScenes();
  document.addEventListener("visibilitychange", handleVisibilityChange);
  disableMotion = () => {
    stopCompassMotion();
    motionScenes.forEach((scene) => scene.classList.remove("is-motion-active"));
    revealNodes.forEach((node) => node.classList.add("is-visible"));
    document.body.classList.remove("motion-ready");
  };
  enableMotion = () => {
    document.body.classList.add("motion-ready", "page-loaded");
    updateMotionScenes();
    startCompassMotion();
  };
}

const handleMotionPreferenceChange = (event) => {
  if (event.matches) disableMotion();
  else enableMotion();
};
if (typeof motionPreference.addEventListener === "function") {
  motionPreference.addEventListener("change", handleMotionPreferenceChange);
} else {
  motionPreference.addListener(handleMotionPreferenceChange);
}
