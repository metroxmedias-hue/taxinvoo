import {
  addBlog,
  BLOG_CATEGORIES,
  deleteBlog,
  getBlogDataMode,
  getAllBlogs,
  getAvailableCategories,
  getStoredCategories,
  setStoredCategories,
  slugify,
  updateBlog
} from "./blogService.js";
import { app, auth } from "./firebase.js";
import {
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

const form = document.getElementById("blogUploadForm");
const contentTypeInput = document.getElementById("contentType");
const composeHeading = document.getElementById("composeHeading");
const composeSubheading = document.getElementById("composeSubheading");
const manageHeading = document.getElementById("manageHeading");
const manageSubheading = document.getElementById("manageSubheading");
const titleInput = document.getElementById("title");
const slugInput = document.getElementById("slug");
const categoryInput = document.getElementById("category");
const readTimeInput = document.getElementById("readTime");
const publishedAtInput = document.getElementById("publishedAt");
const contentInput = document.getElementById("content");
const statusMessage = document.getElementById("formStatus");
const submitButton = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

const thumbnailInput = document.getElementById("thumbnailFile");
const thumbnailPreview = document.getElementById("thumbnailPreview");
const thumbHint = document.getElementById("thumbHint");
const removeThumbBtn = document.getElementById("removeThumbBtn");

const previewTitle = document.getElementById("previewTitle");
const previewExcerpt = document.getElementById("previewExcerpt");
const previewMeta = document.getElementById("previewMeta");
const previewCategory = document.getElementById("previewCategory");
const previewReadTime = document.getElementById("previewReadTime");
const previewMediaImage = document.getElementById("previewMediaImage");

const manageSearch = document.getElementById("manageSearch");
const manageTypeFilter = document.getElementById("manageTypeFilter");
const manageStatusFilter = document.getElementById("manageStatusFilter");
const refreshBlogsBtn = document.getElementById("refreshBlogsBtn");
const manageBlogsBody = document.getElementById("manageBlogsBody");
const newCategoryNameInput = document.getElementById("newCategoryName");
const addCategoryBtn = document.getElementById("addCategoryBtn");
const defaultCategoryList = document.getElementById("defaultCategoryList");
const customCategoryList = document.getElementById("customCategoryList");
const titleFieldLabel = document.querySelector('label[for="title"]');
const contentFieldLabel = document.querySelector('label[for="content"]');
const featuredLabelTextNode = document.querySelector('label[for="featured"]');
const featuredHintNode = document.querySelector(".toggle-row .hint");
const canonicalUrlInput = document.getElementById("canonicalUrl");

let thumbnailObjectUrl = "";
let allBlogs = [];
let editingBlogId = null;
let editingCurrentBlog = null;
let removeThumbnailRequested = false;
let authBootstrapped = false;
let categoryList = [...BLOG_CATEGORIES];

function typeLabel(type) {
  return String(type || "").toLowerCase() === "article" ? "Article" : "Blog";
}

function getCurrentTypeLabel() {
  return typeLabel(contentTypeInput?.value || "blog");
}

function currentTypeValue() {
  return String(contentTypeInput?.value || "blog").toLowerCase() === "article" ? "article" : "blog";
}

function refreshSubmitButtonLabel() {
  if (editingBlogId) {
    submitButton.textContent = `Update ${getCurrentTypeLabel()}`;
    return;
  }
  submitButton.textContent = `Publish ${getCurrentTypeLabel()}`;
}

function applyTypeContextUI() {
  const type = currentTypeValue();
  const isArticle = type === "article";

  if (composeHeading) composeHeading.textContent = isArticle ? "Compose Article" : "Compose Blog";
  if (composeSubheading) composeSubheading.textContent = isArticle
    ? "Primary article content and publishing controls."
    : "Primary blog content and publishing controls.";

  if (manageHeading) manageHeading.textContent = isArticle ? "Manage Articles" : "Manage Blogs";
  if (manageSubheading) manageSubheading.textContent = isArticle
    ? "Edit or delete previously published/draft articles."
    : "Edit or delete previously published/draft blogs.";

  if (titleFieldLabel) titleFieldLabel.textContent = isArticle ? "Article Title" : "Blog Title";
  titleInput.placeholder = isArticle ? "Enter article title" : "Enter blog title";

  if (contentFieldLabel) contentFieldLabel.textContent = "Content (HTML or plain text)";
  contentInput.placeholder = isArticle
    ? "Write your article HTML or plain text here..."
    : "Write your blog HTML or plain text here...";

  if (featuredLabelTextNode) {
    featuredLabelTextNode.lastChild.textContent = isArticle
      ? " Mark as Featured (Popular Articles)"
      : " Mark as Featured (Popular Posts)";
  }
  if (featuredHintNode) {
    featuredHintNode.textContent = isArticle
      ? "Featured articles appear in article lists and related blocks"
      : "Featured posts appear in blog sidebar and related blocks";
  }

  if (canonicalUrlInput) {
    canonicalUrlInput.placeholder = isArticle
      ? "https://taxinvoo.com/articles/your-slug"
      : "https://taxinvoo.com/blog/your-slug";
  }

  if (manageSearch) {
    manageSearch.placeholder = isArticle
      ? "Search articles by title, slug, author..."
      : "Search blogs by title, slug, author...";
  }
}

function syncManageFilterWithType() {
  if (!manageTypeFilter) return;
  manageTypeFilter.value = currentTypeValue();
}

function buildPermissionHelp(error) {
  const projectId = app?.options?.projectId || "unknown-project";
  const bucket = app?.options?.storageBucket || "unknown-bucket";
  const uid = auth?.currentUser?.uid || "not-signed-in";
  const code = error?.code || "unknown";
  const raw = error?.message ? ` Raw: ${error.message}` : "";
  return `Permission blocked (${code}). Project: ${projectId}, Bucket: ${bucket}, User: ${uid}. Check Firestore + Storage rules, auth mode, and App Check.${raw}`;
}

function humanizeError(error) {
  const code = error?.code || "";
  if (code === "permission-denied" || code === "storage/unauthorized") {
    return buildPermissionHelp(error);
  }
  if (code === "storage/canceled") {
    return "Thumbnail upload was canceled.";
  }
  if (code === "storage/invalid-format") {
    return "Invalid thumbnail format. Use PNG, JPG, or WebP.";
  }
  if (code === "storage/quota-exceeded") {
    return "Storage quota exceeded in Firebase project.";
  }
  return error?.message || "Something went wrong.";
}

function statusModeSuffix() {
  const mode = getBlogDataMode();
  if (mode === "indexeddb") return " (saved in local IndexedDB mode, available across tabs)";
  if (mode === "local") return " (saved in local fallback mode, available across tabs)";
  if (mode === "memory") return " (saved only in this tab due browser storage limit)";
  return "";
}

async function bootstrapAuth() {
  if (authBootstrapped) return;
  authBootstrapped = true;

  if (auth.currentUser) return;
  try {
    await signInAnonymously(auth);
  } catch (error) {
    setStatus(`Auth bootstrap failed: ${humanizeError(error)}`, "error");
  }
}

function setStatus(message, type = "info") {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`;
}

function fillCategoryOptions() {
  categoryInput.innerHTML = "";
  categoryList.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryInput.appendChild(option);
  });
}

function getSafeReassignCategory(excludeCategory) {
  return categoryList.find((item) => item !== excludeCategory) || BLOG_CATEGORIES[0] || "General";
}

function blogToUpdatePayload(blog, overrides = {}) {
  return {
    title: blog.title,
    slug: blog.slug,
    category: blog.category,
    excerpt: blog.excerpt || blog.metaDescription || "",
    authorName: blog.authorName || "TaxInvoo Team",
    readTime: blog.readTime || "5 min read",
    metaTitle: blog.metaTitle || blog.title || "",
    metaDescription: blog.metaDescription || "",
    canonicalUrl: blog.canonicalUrl || "",
    keywords: Array.isArray(blog.keywords) ? blog.keywords.join(", ") : "",
    content: blog.content || "",
    thumbnailAlt: blog.thumbnailAlt || blog.title || "",
    thumbnailFile: null,
    removeThumbnail: false,
    featured: Boolean(blog.featured),
    status: blog.status || "Draft",
    publishedAt: toDatetimeLocalValue(blog.publishedAtDate || blog.createdAtDate || new Date()),
    ...overrides
  };
}

function refreshCategoryState() {
  categoryList = getAvailableCategories(allBlogs);
  fillCategoryOptions();
  renderCategoryManager();
}

function renderCategoryManager() {
  defaultCategoryList.innerHTML = BLOG_CATEGORIES
    .map((category) => `<span class="category-default-badge">${escapeHtml(category)}</span>`)
    .join("");

  const defaultSet = new Set(BLOG_CATEGORIES.map((name) => name.toLowerCase()));
  const customCategories = categoryList.filter((category) => !defaultSet.has(category.toLowerCase()));

  if (customCategories.length === 0) {
    customCategoryList.innerHTML = "<span class='hint'>No custom categories yet.</span>";
    return;
  }

  customCategoryList.innerHTML = customCategories
    .map(
      (category) => `
        <div class="category-custom-item">
          <span class="category-custom-name">${escapeHtml(category)}</span>
          <div class="category-custom-actions">
            <button type="button" class="btn-mini" data-action="rename-cat" data-name="${escapeHtml(category)}">Edit</button>
            <button type="button" class="btn-mini danger" data-action="delete-cat" data-name="${escapeHtml(category)}">Delete</button>
          </div>
        </div>
      `
    )
    .join("");
}

async function handleRenameCategory(oldName) {
  if (BLOG_CATEGORIES.some((name) => name.toLowerCase() === oldName.toLowerCase())) {
    setStatus("Default categories cannot be renamed.", "error");
    return;
  }

  const proposed = window.prompt("Rename category", oldName);
  if (!proposed) return;
  const newName = proposed.replace(/\s+/g, " ").trim();
  if (!newName || newName === oldName) return;

  const exists = categoryList.some((item) => item.toLowerCase() === newName.toLowerCase());
  if (exists) {
    setStatus("Category already exists.", "error");
    return;
  }

  const targetBlogs = allBlogs.filter((blog) => (blog.category || "") === oldName);

  try {
    for (const blog of targetBlogs) {
      const payload = blogToUpdatePayload(blog, { category: newName });
      await updateBlog(blog.id, payload, blog);
    }

    const stored = getStoredCategories();
    const updatedStored = stored.map((item) => (item === oldName ? newName : item));
    if (!updatedStored.includes(newName)) {
      updatedStored.push(newName);
    }
    setStoredCategories(updatedStored);

    await refreshManageTable(false);
    setStatus(`Category renamed: ${oldName} → ${newName}`, "success");
  } catch (error) {
    setStatus(humanizeError(error), "error");
  }
}

async function handleDeleteCategory(name) {
  if (BLOG_CATEGORIES.some((item) => item.toLowerCase() === name.toLowerCase())) {
    setStatus("Default categories cannot be deleted.", "error");
    return;
  }

  const inUse = allBlogs.filter((blog) => (blog.category || "") === name);
  const defaultFallback = getSafeReassignCategory(name);
  let reassignTo = defaultFallback;

  if (inUse.length > 0) {
    const input = window.prompt(
      `Category "${name}" is used by ${inUse.length} content item(s). Reassign those items to:`,
      defaultFallback
    );
    if (input === null) return;
    reassignTo = input.replace(/\s+/g, " ").trim() || defaultFallback;

    if (reassignTo.toLowerCase() === name.toLowerCase()) {
      setStatus("Reassignment category must be different.", "error");
      return;
    }
  }

  try {
    if (!categoryList.includes(reassignTo)) {
      setStoredCategories([...getStoredCategories(), reassignTo]);
    }

    for (const blog of inUse) {
      const payload = blogToUpdatePayload(blog, { category: reassignTo });
      await updateBlog(blog.id, payload, blog);
    }

    const stored = getStoredCategories().filter((item) => item !== name);
    setStoredCategories(stored);

    await refreshManageTable(false);
    setStatus(`Category deleted: ${name}`, "success");
  } catch (error) {
    setStatus(humanizeError(error), "error");
  }
}

function syncSlugFromTitle() {
  slugInput.value = slugify(titleInput.value);
}

function formatDate(dateValue) {
  if (!dateValue) return "-";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(dateValue);
  } catch {
    return "-";
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toDatetimeLocalValue(dateValue) {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "";
  const tzOffsetMs = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

function nowDatetimeLocalValue() {
  return toDatetimeLocalValue(new Date());
}

function plainTextFromContent(rawContent) {
  const htmlFree = String(rawContent || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");

  return htmlFree.replace(/\s+/g, " ").trim();
}

function calculateReadTime(content) {
  const text = plainTextFromContent(content);
  if (!text) return "1 min read";
  const words = text.split(" ").filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

function ensureAutoFields({ forcePublishDate = false } = {}) {
  readTimeInput.value = calculateReadTime(contentInput.value);
  if (forcePublishDate || !publishedAtInput.value) {
    publishedAtInput.value = nowDatetimeLocalValue();
  }
}

function updatePreview() {
  const title = titleInput.value.trim() || "Your content title preview";
  const excerpt = document.getElementById("excerpt").value.trim() || document.getElementById("metaDescription").value.trim() || "Short summary appears here for card preview.";
  const author = document.getElementById("authorName").value.trim() || "TaxInvoo Team";
  const category = categoryInput.value || "Category";
  const readTime = readTimeInput.value.trim() || "5 min read";

  previewTitle.textContent = title;
  previewExcerpt.textContent = excerpt;
  previewCategory.textContent = category;
  previewReadTime.textContent = readTime;
  previewMeta.textContent = `By ${author}`;
}

function clearObjectUrl() {
  if (thumbnailObjectUrl) {
    URL.revokeObjectURL(thumbnailObjectUrl);
    thumbnailObjectUrl = "";
  }
}

function setPreviewImages(url = "", hintText = "PNG/JPG/WebP, recommended 1200x630") {
  if (!url) {
    thumbnailPreview.src = "";
    thumbnailPreview.style.display = "none";
    previewMediaImage.removeAttribute("src");
    previewMediaImage.style.display = "none";
    thumbHint.textContent = hintText;
    return;
  }

  thumbnailPreview.src = url;
  thumbnailPreview.style.display = "block";
  previewMediaImage.src = url;
  previewMediaImage.style.display = "block";
  thumbHint.textContent = hintText;
}

function updateThumbPreview() {
  const file = thumbnailInput.files?.[0];
  if (!file) {
    clearObjectUrl();
    if (editingCurrentBlog?.thumbnailUrl && !removeThumbnailRequested) {
      setPreviewImages(editingCurrentBlog.thumbnailUrl, "Using current thumbnail from saved post.");
    } else {
      setPreviewImages("", "PNG/JPG/WebP, recommended 1200x630");
    }
    return;
  }

  removeThumbnailRequested = false;
  clearObjectUrl();
  thumbnailObjectUrl = URL.createObjectURL(file);
  setPreviewImages(thumbnailObjectUrl, `${file.name} (${Math.round(file.size / 1024)} KB)`);
}

function readFormData() {
  ensureAutoFields();
  return {
    contentType: contentTypeInput.value,
    title: titleInput.value,
    slug: slugInput.value,
    category: categoryInput.value,
    excerpt: document.getElementById("excerpt").value,
    authorName: document.getElementById("authorName").value,
    readTime: readTimeInput.value,
    metaTitle: document.getElementById("metaTitle").value,
    metaDescription: document.getElementById("metaDescription").value,
    canonicalUrl: document.getElementById("canonicalUrl").value,
    keywords: document.getElementById("keywords").value,
    content: contentInput.value,
    thumbnailAlt: document.getElementById("thumbnailAlt").value,
    thumbnailFile: thumbnailInput.files?.[0] || null,
    removeThumbnail: removeThumbnailRequested,
    featured: document.getElementById("featured").checked,
    status: document.getElementById("status").value,
    publishedAt: publishedAtInput.value
  };
}

function resetEditorState(nextType = null) {
  editingBlogId = null;
  editingCurrentBlog = null;
  removeThumbnailRequested = false;
  const preservedType = nextType || currentTypeValue();
  form.reset();
  slugInput.value = "";
  if (contentTypeInput) contentTypeInput.value = preservedType;
  applyTypeContextUI();
  syncManageFilterWithType();
  refreshSubmitButtonLabel();
  cancelEditBtn.style.display = "none";
  clearObjectUrl();
  setPreviewImages("", "PNG/JPG/WebP, recommended 1200x630");
  ensureAutoFields({ forcePublishDate: true });
  updatePreview();
}

function setEditorMode(blog) {
  editingBlogId = blog.id;
  editingCurrentBlog = blog;
  removeThumbnailRequested = false;

  if (contentTypeInput) contentTypeInput.value = blog.contentType === "article" ? "article" : "blog";
  applyTypeContextUI();
  syncManageFilterWithType();
  titleInput.value = blog.title || "";
  slugInput.value = blog.slug || "";
  categoryInput.value = blog.category || BLOG_CATEGORIES[0];
  document.getElementById("excerpt").value = blog.excerpt || "";
  document.getElementById("authorName").value = blog.authorName || "TaxInvoo Team";
  readTimeInput.value = blog.readTime || calculateReadTime(blog.content || "");
  document.getElementById("status").value = blog.status || "Draft";
  publishedAtInput.value = toDatetimeLocalValue(blog.publishedAtDate || blog.createdAtDate || new Date());

  document.getElementById("metaTitle").value = blog.metaTitle || "";
  document.getElementById("metaDescription").value = blog.metaDescription || "";
  document.getElementById("keywords").value = Array.isArray(blog.keywords) ? blog.keywords.join(", ") : "";
  document.getElementById("canonicalUrl").value = blog.canonicalUrl || "";

  contentInput.value = blog.content || "";
  document.getElementById("featured").checked = Boolean(blog.featured);
  document.getElementById("thumbnailAlt").value = blog.thumbnailAlt || "";

  thumbnailInput.value = "";
  clearObjectUrl();
  if (blog.thumbnailUrl) {
    setPreviewImages(blog.thumbnailUrl, "Using current thumbnail from saved post.");
  } else {
    setPreviewImages("", "No thumbnail currently attached.");
  }

  refreshSubmitButtonLabel();
  cancelEditBtn.style.display = "inline-flex";
  setStatus(`Editing: ${blog.title}`, "info");
  ensureAutoFields();
  updatePreview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function buildStatusPill(status) {
  const normalized = status === "Published" ? "published" : "draft";
  return `<span class="status-pill ${normalized}">${status || "Draft"}</span>`;
}

function buildTypePill(contentType) {
  const type = String(contentType || "").toLowerCase() === "article" ? "article" : "blog";
  const label = type === "article" ? "Article" : "Blog";
  return `<span class="status-pill ${type}">${label}</span>`;
}

function renderManageTable() {
  const query = (manageSearch.value || "").trim().toLowerCase();
  const typeFilter = manageTypeFilter.value;
  const statusFilter = manageStatusFilter.value;

  const filtered = allBlogs.filter((blog) => {
    const blogType = blog.contentType === "article" ? "article" : "blog";
    const typeMatch = typeFilter === "all" || blogType === typeFilter;
    const statusMatch = statusFilter === "all" || blog.status === statusFilter;
    const haystack = [blog.title, blog.slug, blog.authorName, blog.category, typeLabel(blogType)].join(" ").toLowerCase();
    const searchMatch = !query || haystack.includes(query);
    return typeMatch && statusMatch && searchMatch;
  });

  if (filtered.length === 0) {
    const label = currentTypeValue() === "article" && manageTypeFilter.value === "article" ? "articles" : "blogs";
    manageBlogsBody.innerHTML = `<tr><td colspan='6'>No ${label} found.</td></tr>`;
    return;
  }

  manageBlogsBody.innerHTML = filtered
    .map((blog) => {
      const updated = formatDate(blog.updatedAtDate || blog.createdAtDate);
      return `
        <tr>
          <td>
            <strong>${escapeHtml(blog.title)}</strong><br>
            <span class="hint">/${escapeHtml(blog.slug)}</span>
          </td>
          <td>${escapeHtml(blog.category || "-")}</td>
          <td>${buildTypePill(blog.contentType)}</td>
          <td>${buildStatusPill(blog.status || "Draft")}</td>
          <td>${updated}</td>
          <td>
            <div class="row-actions">
              <button class="btn-mini" type="button" data-action="edit" data-id="${blog.id}">Edit</button>
              <button class="btn-mini danger" type="button" data-action="delete" data-id="${blog.id}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function refreshManageTable(showStatus = true) {
  try {
    await bootstrapAuth();
    if (showStatus) setStatus(`Loading ${currentTypeValue() === "article" ? "article" : "blog"} list...`, "info");
    allBlogs = await getAllBlogs("all");
    refreshCategoryState();
    renderManageTable();
    if (showStatus) setStatus(`${getCurrentTypeLabel()} list refreshed${statusModeSuffix()}.`, "success");
  } catch (error) {
    manageBlogsBody.innerHTML = "<tr><td colspan='6'>Failed to load content.</td></tr>";
    setStatus(humanizeError(error), "error");
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  try {
    await bootstrapAuth();
    submitButton.disabled = true;
    setStatus(`Saving ${getCurrentTypeLabel().toLowerCase()}...`, "info");

    syncSlugFromTitle();
    ensureAutoFields({ forcePublishDate: true });
    const blogData = readFormData();

    let saved;
    if (editingBlogId) {
      saved = await updateBlog(editingBlogId, blogData, editingCurrentBlog);
      setStatus(`${typeLabel(saved.contentType)} updated successfully: ${saved.slug}${statusModeSuffix()}`, "success");
    } else {
      saved = await addBlog(blogData);
      setStatus(`${typeLabel(saved.contentType)} published successfully: ${saved.slug}${statusModeSuffix()}`, "success");
    }

    const savedType = saved?.contentType === "article" ? "article" : "blog";
    resetEditorState(savedType);
    await refreshManageTable(false);
  } catch (error) {
    setStatus(humanizeError(error), "error");
  } finally {
    submitButton.disabled = false;
  }
}

async function handleTableAction(event) {
  const target = event.target.closest("button[data-action]");
  if (!target) return;

  const action = target.dataset.action;
  const id = target.dataset.id;
  const blog = allBlogs.find((item) => item.id === id);
  if (!blog) return;

  if (action === "edit") {
    setEditorMode(blog);
    return;
  }

  if (action === "delete") {
    const ok = window.confirm(`Delete ${typeLabel(blog.contentType).toLowerCase()}: \"${blog.title}\"? This cannot be undone.`);
    if (!ok) return;

    try {
      setStatus(`Deleting ${blog.title}...`, "info");
      await deleteBlog(blog);
      if (editingBlogId === blog.id) {
        resetEditorState();
      }
      await refreshManageTable(false);
      setStatus(`${typeLabel(blog.contentType)} deleted successfully.`, "success");
    } catch (error) {
      setStatus(humanizeError(error), "error");
    }
  }
}

fillCategoryOptions();
syncSlugFromTitle();
ensureAutoFields({ forcePublishDate: true });
applyTypeContextUI();
syncManageFilterWithType();
refreshSubmitButtonLabel();
updatePreview();
setPreviewImages("", "PNG/JPG/WebP, recommended 1200x630");
refreshManageTable();
onAuthStateChanged(auth, (user) => {
  if (user) {
    setStatus("Firebase admin session ready.", "info");
  }
});

[
  contentTypeInput,
  titleInput,
  document.getElementById("excerpt"),
  document.getElementById("authorName"),
  document.getElementById("metaDescription")
].forEach((node) =>
  node.addEventListener("input", () => {
    if (node === titleInput) syncSlugFromTitle();
    if (node === contentTypeInput) refreshSubmitButtonLabel();
    updatePreview();
  })
);

contentTypeInput.addEventListener("change", () => {
  applyTypeContextUI();
  syncManageFilterWithType();
  refreshSubmitButtonLabel();
  updatePreview();
  renderManageTable();
  setStatus(`${getCurrentTypeLabel()} mode active. Manage list filtered to this type.`, "info");
});

categoryInput.addEventListener("change", updatePreview);
contentInput.addEventListener("input", () => {
  ensureAutoFields();
  updatePreview();
});
thumbnailInput.addEventListener("change", updateThumbPreview);
form.addEventListener("submit", handleSubmit);
cancelEditBtn.addEventListener("click", () => {
  resetEditorState();
  setStatus("Edit cancelled.", "info");
});
removeThumbBtn.addEventListener("click", () => {
  thumbnailInput.value = "";
  removeThumbnailRequested = true;
  clearObjectUrl();
  setPreviewImages("", "Thumbnail will be removed on save.");
});

function addCustomCategory() {
  const value = newCategoryNameInput.value.replace(/\s+/g, " ").trim();
  if (!value) return;

  const exists = categoryList.some((item) => item.toLowerCase() === value.toLowerCase());
  if (exists) {
    setStatus("Category already exists.", "error");
    return;
  }

  setStoredCategories([...getStoredCategories(), value]);
  newCategoryNameInput.value = "";
  refreshCategoryState();
  setStatus(`Category added: ${value}`, "success");
}

addCategoryBtn.addEventListener("click", addCustomCategory);
newCategoryNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addCustomCategory();
  }
});

customCategoryList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  const name = button.dataset.name || "";
  if (!name) return;

  if (action === "rename-cat") {
    await handleRenameCategory(name);
  } else if (action === "delete-cat") {
    await handleDeleteCategory(name);
  }
});
manageSearch.addEventListener("input", renderManageTable);
manageTypeFilter.addEventListener("change", renderManageTable);
manageStatusFilter.addEventListener("change", renderManageTable);
refreshBlogsBtn.addEventListener("click", () => refreshManageTable());
manageBlogsBody.addEventListener("click", handleTableAction);
