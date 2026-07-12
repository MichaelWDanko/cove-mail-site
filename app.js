const menuButton = document.querySelector(".menu-button");
const siteNav = document.querySelector(".site-nav");
document.body.classList.add("motion-ready");

if (menuButton && siteNav) {
  menuButton.addEventListener("click", () => {
    const open = siteNav.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(open));
  });
}

const year = new Date().getFullYear();
document.querySelectorAll("[data-current-year]").forEach((node) => {
  node.textContent = String(year);
});

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!reduceMotion) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -7%" },
  );

  document.querySelectorAll(".reveal").forEach((node) => revealObserver.observe(node));

  const parallaxLayers = [...document.querySelectorAll("[data-parallax]")];
  const progress = document.querySelector(".scroll-progress");
  let frameRequested = false;

  const updateScrollEffects = () => {
    const scrollY = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

    parallaxLayers.forEach((layer) => {
      const speed = Number(layer.dataset.parallax || 0);
      layer.style.setProperty("--parallax-y", `${scrollY * speed}px`);
    });

    if (progress) {
      progress.style.transform = `scaleX(${maxScroll > 0 ? scrollY / maxScroll : 0})`;
    }
    frameRequested = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (!frameRequested) {
        requestAnimationFrame(updateScrollEffects);
        frameRequested = true;
      }
    },
    { passive: true },
  );
  updateScrollEffects();

} else {
  document.querySelectorAll(".reveal").forEach((node) => node.classList.add("is-visible"));
}
