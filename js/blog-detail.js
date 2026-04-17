const titleNode = document.getElementById("blogTitle");
const kickerNode = document.getElementById("blogKicker");
const metaNode = document.getElementById("blogMeta");
const contentNode = document.getElementById("blogContent");
const relatedNode = document.getElementById("relatedPosts");

const metaDescriptionTag = document.querySelector('meta[name="description"]');
const metaKeywordsTag = document.querySelector('meta[name="keywords"]');
const heroMedia = document.getElementById("blogHeroMedia");
const heroImage = document.getElementById("blogHeroImage");
const LOCAL_BLOGS_KEY = "taxinvoo_local_blogs_v1";

function formatDate(dateValue) {
  if (!dateValue) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(dateValue);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getSlugFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("slug") || "";
}

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeLocalEntry(raw = {}) {
  return {
    ...raw,
    contentType: String(raw.contentType || "blog").toLowerCase() === "article" ? "article" : "blog",
    createdAtDate: toDate(raw.createdAtDate),
    updatedAtDate: toDate(raw.updatedAtDate),
    publishedAtDate: toDate(raw.publishedAtDate)
  };
}

function getLocalBlogBySlug(slug) {
  const cleanSlug = slugify(slug);
  if (!cleanSlug) return null;

  try {
    const raw = localStorage.getItem(LOCAL_BLOGS_KEY) || "[]";
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return null;
    const found = list.find((item) => slugify(item?.slug || "") === cleanSlug);
    return found ? normalizeLocalEntry(found) : null;
  } catch {
    return null;
  }
}

function getLocalFeatured(maxItems = 4) {
  try {
    const raw = localStorage.getItem(LOCAL_BLOGS_KEY) || "[]";
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .map(normalizeLocalEntry)
      .filter((item) => item.status === "Published" && item.featured)
      .slice(0, maxItems);
  } catch {
    return [];
  }
}

function updateSeo(blog) {
  const seoTitle = blog.metaTitle || `${blog.title} | TaxInvoo`;
  const seoDescription = blog.metaDescription || blog.excerpt || "Learn more on the TaxInvoo blog.";

  document.title = seoTitle;
  if (metaDescriptionTag) metaDescriptionTag.setAttribute("content", seoDescription);

  const keywords = Array.isArray(blog.keywords) ? blog.keywords.join(", ") : "";
  if (metaKeywordsTag) {
    metaKeywordsTag.setAttribute("content", keywords);
  } else if (keywords) {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "keywords");
    meta.setAttribute("content", keywords);
    document.head.appendChild(meta);
  }

  if (blog.canonicalUrl) {
    let canonicalTag = document.querySelector('link[rel="canonical"]');
    if (!canonicalTag) {
      canonicalTag = document.createElement("link");
      canonicalTag.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalTag);
    }
    canonicalTag.setAttribute("href", blog.canonicalUrl);
  }
}

function renderContent(content) {
  if (!content) {
    return "<p>No content has been added yet.</p>";
  }

  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(content);
  if (hasHtml) {
    return content;
  }

  return content
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function renderNotFound() {
  titleNode.textContent = "Post not found";
  kickerNode.textContent = "TaxInvoo";
  metaNode.textContent = "The post you requested is unavailable.";
  contentNode.innerHTML = "<p>Please go back to the blog listing and choose another article.</p>";
  if (heroMedia) heroMedia.style.display = "none";
}

function renderLoadingError() {
  titleNode.textContent = "Could not load this post";
  kickerNode.textContent = "TaxInvoo";
  metaNode.textContent = "Please refresh or open this post again from the blog page.";
  contentNode.innerHTML = "<p>We hit a temporary loading issue. Try again in a few seconds.</p>";
  if (heroMedia) heroMedia.style.display = "none";
}

async function loadBlogService() {
  try {
    return await import("./blogService.js");
  } catch (error) {
    console.error("Failed loading blog service module", error);
    return null;
  }
}

async function renderRelatedPosts(currentSlug, blogService) {
  let popularBlogs = [];

  if (blogService?.getPopularBlogs) {
    try {
      popularBlogs = await blogService.getPopularBlogs(4, "all");
    } catch {
      popularBlogs = [];
    }
  }

  if (!popularBlogs.length) {
    popularBlogs = getLocalFeatured(4);
  }

  const relatedBlogs = popularBlogs
    .filter((blog) => blog.slug !== currentSlug && blog.status === "Published")
    .slice(0, 3);

  if (relatedBlogs.length === 0) {
    relatedNode.innerHTML = "<p>No related posts yet.</p>";
    return;
  }

  relatedNode.innerHTML = relatedBlogs
    .map(
      (blog) => `
        <a class="related-card" href="blog-detail.html?slug=${encodeURIComponent(blog.slug)}">
          <h4>${escapeHtml(blog.title)}</h4>
          <p>${escapeHtml(blog.category || "General")} • ${escapeHtml(blog.readTime || "5 min read")}</p>
        </a>
      `
    )
    .join("");
}

async function init() {
  const slug = getSlugFromQuery();
  if (!slug) {
    renderNotFound();
    return;
  }

  try {
    const blogService = await loadBlogService();
    let blog = null;

    if (blogService?.getBlogBySlug) {
      blog = await blogService.getBlogBySlug(slug, "all");
    }

    if (!blog) {
      blog = getLocalBlogBySlug(slug);
    }

    if (!blog || blog.status !== "Published") {
      renderNotFound();
      return;
    }

    const postType = String(blog.contentType || "blog").toLowerCase() === "article" ? "Article" : "Blog";
    kickerNode.textContent = `${postType} • ${blog.category || "General"} • ${blog.readTime || "5 min read"}`;
    titleNode.textContent = blog.title;
    metaNode.textContent = `By ${blog.authorName || "TaxInvoo Team"} • Last updated: ${formatDate(blog.updatedAtDate || blog.publishedAtDate || blog.createdAtDate)}`;
    contentNode.innerHTML = renderContent(blog.content);

    if (blog.thumbnailUrl) {
      heroImage.src = blog.thumbnailUrl;
      heroImage.alt = blog.thumbnailAlt || blog.title;
      if (heroMedia) heroMedia.style.display = "block";
    } else {
      if (heroMedia) heroMedia.style.display = "none";
    }

    updateSeo(blog);
    await renderRelatedPosts(blog.slug, blogService);
  } catch (error) {
    console.error("Failed to load blog", error);
    renderLoadingError();
  }
}

init();
