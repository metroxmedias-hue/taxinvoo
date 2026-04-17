(function initSharedLandingPages() {
  var root = document.documentElement;
  var toggle = document.getElementById("themeToggle");
  var saved = localStorage.getItem("metrox-theme");
  var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  var theme = saved || (prefersDark ? "dark" : "light");

  root.setAttribute("data-theme", theme);

  if (toggle) {
    toggle.textContent = theme === "dark" ? "☀" : "☾";
    toggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("metrox-theme", next);
      toggle.textContent = next === "dark" ? "☀" : "☾";
    });
  }

  var yearOut = document.getElementById("yearOut");
  if (yearOut) yearOut.textContent = String(new Date().getFullYear());

  var path = (location.pathname.split("/").pop() || "index-landing.html").toLowerCase();
  var navItems = document.querySelectorAll(".nav-links a, .nav a");
  navItems.forEach(function (link) {
    var href = (link.getAttribute("href") || "").toLowerCase();
    if (href === path || (path === "" && href === "index-landing.html")) {
      link.classList.add("active");
    }
  });
})();
