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

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealNodes = [...document.querySelectorAll(".reveal")];
const motionSupported = !reducedMotion && "IntersectionObserver" in window;

if (!motionSupported) {
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

  const compassWindow = document.querySelector(".compass-window");
  const compassInput = compassWindow?.querySelector(".compass-input strong");
  const compassResults = [...(compassWindow?.querySelectorAll(".compass-result") ?? [])];

  if (compassWindow && compassInput && compassResults.length) {
    const defaultInput = compassInput.textContent;
    const demonstrations = [
      { query: "Compose a new message", result: 0 },
      { query: "from:Mara Voss", result: 1 },
      { query: "Inbox", result: 2 },
      { query: "MCP settings", result: 3 },
    ];
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
      if (compassRunning || !compassInView || document.hidden) return;
      compassRunning = true;
      const generation = ++compassGeneration;
      let demonstrationIndex = 0;
      compassWindow.classList.add("is-simulating");

      while (compassRunning && generation === compassGeneration) {
        const demonstration = demonstrations[demonstrationIndex];
        compassInput.textContent = "";
        compassResults.forEach((result) => result.classList.remove("active"));

        for (const character of demonstration.query) {
          if (!compassRunning || generation !== compassGeneration) return;
          compassInput.textContent += character;
          await delay(62);
        }

        compassResults[demonstration.result]?.classList.add("active");
        await delay(1250);

        while (compassInput.textContent.length) {
          if (!compassRunning || generation !== compassGeneration) return;
          compassInput.textContent = compassInput.textContent.slice(0, -1);
          await delay(28);
        }

        await delay(260);
        demonstrationIndex = (demonstrationIndex + 1) % demonstrations.length;
      }
    };

    const compassObserver = new IntersectionObserver(([entry]) => {
      compassInView = entry.isIntersecting;
      if (compassInView) startCompass();
      else stopCompass();
    }, { threshold: 0.45 });

    compassObserver.observe(compassWindow);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopCompass();
      else if (compassInView) startCompass();
    });
  }

  const progress = document.querySelector(".scroll-progress");
  let frameRequested = false;
  const updateProgress = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress?.style.setProperty("--progress", max > 0 ? scrollY / max : 0);
    frameRequested = false;
  };
  addEventListener("scroll", () => {
    if (!frameRequested) {
      requestAnimationFrame(updateProgress);
      frameRequested = true;
    }
  }, { passive: true });
  updateProgress();
}
