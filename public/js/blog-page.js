import { getAllBlogs, getAvailableCategories, getPublishedBlogs, slugify } from "./blogService.js";

const blogGrid = document.getElementById("blogGrid");
const popularList = document.getElementById("popularPostsList");
const categoryContainer = document.getElementById("blogCategories");
const searchInput = document.getElementById("blogSearch");
const emptyState = document.getElementById("blogEmptyState");
const helpSearchInput = document.getElementById("helpSearch");
const helpArticlesGrid = document.getElementById("helpArticles");

const BLOG_ROUTE = "blog";
let activeCategory = "all";
let allBlogs = [];
let visibleBlogs = [];
let allHelpArticles = [];
let visibleHelpArticles = [];

function formatDate(dateValue) {
  if (!dateValue) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(dateValue);
  } catch {
    return "";
  }
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createBlogCard(blog) {
  const keywordsText = Array.isArray(blog.keywords) ? blog.keywords.join(" ") : "";
  const searchText = normalizeText([blog.title, blog.metaDescription, blog.excerpt, keywordsText, blog.category].join(" "));
  const publishedDate = formatDate(blog.publishedAtDate || blog.createdAtDate);
  const cardSummary = blog.excerpt || blog.metaDescription || "";
  const thumb = blog.thumbnailUrl
    ? `<img src="${escapeHtml(blog.thumbnailUrl)}" alt="${escapeHtml(blog.thumbnailAlt || blog.title)}" loading="lazy" />`
    : "";

  return `
    <article class="blog-card" data-category="${escapeHtml(blog.categorySlug)}" data-search="${escapeHtml(searchText)}">
      <div class="blog-card-thumb">${thumb}</div>
      <div class="blog-card-body">
        <div class="blog-card-top">
          <span class="blog-kicker">${escapeHtml(blog.category)}</span>
          <span class="blog-card-time">${escapeHtml(blog.readTime || "5 min read")}</span>
        </div>
        <h3>${escapeHtml(blog.title)}</h3>
        <p>${escapeHtml(cardSummary)}</p>
        <a class="blog-read-link" href="pages/blog-detail.html?slug=${encodeURIComponent(blog.slug)}">Read guide →</a>
        ${publishedDate ? `<p class="blog-meta">${publishedDate}</p>` : ""}
      </div>
    </article>
  `;
}

function createSupportArticleCard(article) {
  const summary = article.excerpt || article.metaDescription || "Open article to read full details.";
  const keywordsText = Array.isArray(article.keywords) ? article.keywords.join(" ") : "";
  const tags = normalizeText([article.category, keywordsText, article.title].join(" "));
  const readTime = article.readTime || "5 min read";

  return `
    <article class="card support-article-card" data-tags="${escapeHtml(tags)}">
      <div class="support-article-head">
        <span class="support-article-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3 4 7v6c0 5 3.4 7.8 8 9 4.6-1.2 8-4 8-9V7z"/><path d="m9 12 2 2 4-4"/></svg>
        </span>
        <h3>${escapeHtml(article.title)}</h3>
      </div>
      <p class="text-secondary">${escapeHtml(summary)}</p>
      <p class="text-secondary" style="margin-top:10px;">${escapeHtml(article.category || "General")} • ${escapeHtml(readTime)}</p>
    </article>
  `;
}

function updateEmptyState(show) {
  if (!emptyState) return;
  emptyState.style.display = show ? "block" : "none";
}

function renderSupportArticles() {
  if (!helpArticlesGrid) return;

  if (visibleHelpArticles.length === 0) {
    helpArticlesGrid.innerHTML = "<p class='text-secondary'>No published help articles found. Add articles from Content CMS.</p>";
    return;
  }

  helpArticlesGrid.innerHTML = visibleHelpArticles.map(createSupportArticleCard).join("");
}

function applySupportFilters() {
  const query = normalizeText(helpSearchInput?.value || "");

  visibleHelpArticles = allHelpArticles.filter((article) => {
    const haystack = normalizeText([
      article.title,
      article.category,
      article.excerpt,
      article.metaDescription,
      Array.isArray(article.keywords) ? article.keywords.join(" ") : ""
    ].join(" "));
    return !query || haystack.includes(query);
  });

  renderSupportArticles();
}

function applyFilters() {
  const query = normalizeText(searchInput?.value || "");

  visibleBlogs = allBlogs.filter((blog) => {
    const isPublished = blog.status === "Published";
    const categoryMatch = activeCategory === "all" || blog.categorySlug === activeCategory;
    const haystack = normalizeText([
      blog.title,
      blog.metaDescription,
      blog.excerpt,
      Array.isArray(blog.keywords) ? blog.keywords.join(" ") : "",
      blog.category
    ].join(" "));
    const searchMatch = !query || haystack.includes(query);

    return isPublished && categoryMatch && searchMatch;
  });

  blogGrid.innerHTML = visibleBlogs.map(createBlogCard).join("");
  updateEmptyState(visibleBlogs.length === 0);
}

function renderPopularPosts() {
  if (!popularList) return;

  const popularBlogs = allBlogs
    .filter((blog) => blog.status === "Published" && blog.featured)
    .slice(0, 5);

  if (popularBlogs.length === 0) {
    popularList.innerHTML = "<li><span>No featured posts yet.</span></li>";
    return;
  }

  popularList.innerHTML = popularBlogs
    .map(
      (blog) =>
        `<li><a href="pages/blog-detail.html?slug=${encodeURIComponent(blog.slug)}">${escapeHtml(blog.title)}</a></li>`
    )
    .join("");
}

function renderCategoryFilters() {
  if (!categoryContainer) return;

  const publishedBlogs = allBlogs.filter((blog) => blog.status === "Published");
  const available = getAvailableCategories(publishedBlogs);
  const categoryItems = available.map((name) => ({
    label: name,
    value: slugify(name)
  }));

  categoryContainer.innerHTML = [
    `<button type="button" class="${activeCategory === "all" ? "is-active" : ""}" data-category="all">All</button>`,
    ...categoryItems.map(
      (item) =>
        `<button type="button" data-category="${item.value}" class="${activeCategory === item.value ? "is-active" : ""}">${item.label}</button>`
    )
  ].join("");

  if (activeCategory !== "all" && !categoryItems.some((item) => item.value === activeCategory)) {
    activeCategory = "all";
  }

  const categoryButtons = Array.from(categoryContainer.querySelectorAll("button[data-category]"));
  categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.category || "all";
      categoryButtons.forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      applyFilters();
    });
  });
}

function setupSearch() {
  if (!searchInput) return;
  searchInput.addEventListener("input", applyFilters);
}

function isBlogRouteActive() {
  const hash = window.location.hash.replace("#", "").toLowerCase();
  return hash === BLOG_ROUTE;
}

async function initBlogPage() {
  if (!blogGrid) return;

  try {
    blogGrid.innerHTML = "<p class='text-secondary'>Loading blog posts...</p>";

    allBlogs = await getAllBlogs();
    renderCategoryFilters();
    renderPopularPosts();
    applyFilters();

    if (isBlogRouteActive()) {
      window.dispatchEvent(new Event("blog:loaded"));
    }
  } catch (error) {
    console.error("Failed to load blogs", error);
    blogGrid.innerHTML = "<p class='text-secondary'>Could not load posts right now.</p>";
    updateEmptyState(false);
  }
}

async function initSupportArticles() {
  if (!helpArticlesGrid) return;

  try {
    helpArticlesGrid.innerHTML = "<p class='text-secondary'>Loading help articles...</p>";
    allHelpArticles = await getPublishedBlogs("article");
    applySupportFilters();
  } catch (error) {
    console.error("Failed to load help articles", error);
    helpArticlesGrid.innerHTML = "<p class='text-secondary'>Could not load help articles right now.</p>";
  }
}

function setupSupportSearch() {
  if (!helpSearchInput) return;
  helpSearchInput.addEventListener("input", applySupportFilters);
}

setupSearch();
setupSupportSearch();
initBlogPage();
initSupportArticles();

window.addEventListener("storage", (event) => {
  if (event.key === "taxinvoo_local_blogs_v1" || event.key === "taxinvoo_local_blogs_ping") {
    initBlogPage();
    initSupportArticles();
  }
});
