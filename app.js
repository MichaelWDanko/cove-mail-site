const menuButton = document.querySelector(".menu-button");
const siteNav = document.querySelector(".site-nav");

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
