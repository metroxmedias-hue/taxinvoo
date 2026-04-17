import { db, storage } from "./firebase.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js";

const BLOG_COLLECTION = "blogs";
const LOCAL_BLOGS_KEY = "taxinvoo_local_blogs_v1";
const LOCAL_SYNC_KEY = "taxinvoo_local_blogs_ping";
const CATEGORY_STORAGE_KEY = "taxinvoo_blog_categories_v1";
const IDB_NAME = "taxinvoo_blog_cms";
const IDB_VERSION = 1;
const IDB_STORE = "blogs";
const CONTENT_TYPE_BLOG = "blog";
const CONTENT_TYPE_ARTICLE = "article";

let blogDataMode = "firebase";
let memoryBlogs = [];
let dbPromise = null;

export const BLOG_CATEGORIES = [
  "GST Guides",
  "Business Tips",
  "Workflows",
  "Reports"
];

function normalizeContentType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === CONTENT_TYPE_ARTICLE ? CONTENT_TYPE_ARTICLE : CONTENT_TYPE_BLOG;
}

export function getBlogDataMode() {
  return blogDataMode;
}

function normalizeCategoryName(name) {
  return String(name || "").replace(/\s+/g, " ").trim();
}

export function getStoredCategories() {
  try {
    const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeCategoryName)
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function setStoredCategories(categories = []) {
  const normalized = Array.from(new Set(categories.map(normalizeCategoryName).filter(Boolean)));
  localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(normalized));
  notifyLocalChange();
  return normalized;
}

export function getAvailableCategories(_blogs = []) {
  return Array.from(
    new Set([
      ...BLOG_CATEGORIES,
      ...getStoredCategories()
    ])
  );
}

function notifyLocalChange() {
  try {
    localStorage.setItem(LOCAL_SYNC_KEY, String(Date.now()));
  } catch {
    // no-op
  }
}

export function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function toCategorySlug(category = "") {
  return slugify(category);
}

function isPermissionError(error) {
  const code = error?.code || "";
  return code === "permission-denied" || code === "storage/unauthorized";
}

function isQuotaExceeded(error) {
  return (
    error?.name === "QuotaExceededError" ||
    error?.code === 22 ||
    error?.code === 1014
  );
}

function readLocalBlogsRaw() {
  if (blogDataMode === "memory") {
    return Array.isArray(memoryBlogs) ? memoryBlogs : [];
  }

  try {
    const raw = localStorage.getItem(LOCAL_BLOGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const safe = Array.isArray(parsed) ? parsed : [];
    memoryBlogs = safe;
    return safe;
  } catch {
    return Array.isArray(memoryBlogs) ? memoryBlogs : [];
  }
}

function writeLocalBlogsRaw(blogs) {
  memoryBlogs = blogs;

  const tryPersist = (payload) => {
    localStorage.setItem(LOCAL_BLOGS_KEY, JSON.stringify(payload));
    blogDataMode = "local";
  };

  const trimContent = (source, maxChars) =>
    source.map((item) => {
      const next = { ...item };
      if (typeof next.content === "string" && next.content.length > maxChars) {
        next.content = next.content.slice(0, maxChars);
      }
      return next;
    });

  const keepLatest = (source, maxItems) => source.slice(0, maxItems);

  const stripThumbnails = (source) =>
    source.map((item) => {
      const next = { ...item };
      if (typeof next.thumbnailUrl === "string" && next.thumbnailUrl.startsWith("data:image/")) {
        next.thumbnailUrl = "";
      }
      return next;
    });

  try {
    tryPersist(blogs);
    return;
  } catch (error) {
    if (!isQuotaExceeded(error)) throw error;
  }

  try {
    tryPersist(trimContent(blogs, 3000));
    return;
  } catch (error) {
    if (!isQuotaExceeded(error)) throw error;
  }

  try {
    tryPersist(keepLatest(trimContent(blogs, 1200), 12));
    return;
  } catch (error) {
    if (!isQuotaExceeded(error)) throw error;
  }

  try {
    tryPersist(stripThumbnails(keepLatest(trimContent(blogs, 1200), 6)));
    return;
  } catch (error) {
    if (!isQuotaExceeded(error)) throw error;
  }

  blogDataMode = "memory";
}

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function serializeLocalBlog(blog) {
  return {
    ...blog,
    createdAtDate: blog.createdAtDate ? new Date(blog.createdAtDate).toISOString() : null,
    updatedAtDate: blog.updatedAtDate ? new Date(blog.updatedAtDate).toISOString() : null,
    publishedAtDate: blog.publishedAtDate ? new Date(blog.publishedAtDate).toISOString() : null
  };
}

function mapLocalToBlog(raw) {
  return {
    ...raw,
    contentType: normalizeContentType(raw.contentType),
    categorySlug: raw.categorySlug || toCategorySlug(raw.category || ""),
    readTime: raw.readTime || "5 min read",
    authorName: raw.authorName || "TaxInvoo Team",
    metaTitle: raw.metaTitle || raw.title || "TaxInvoo Blog",
    excerpt: raw.excerpt || raw.metaDescription || "",
    thumbnailUrl: raw.thumbnailUrl || "",
    thumbnailPath: raw.thumbnailPath || "",
    thumbnailAlt: raw.thumbnailAlt || raw.title || "Blog thumbnail",
    createdAtDate: toDate(raw.createdAtDate),
    updatedAtDate: toDate(raw.updatedAtDate),
    publishedAtDate: toDate(raw.publishedAtDate)
  };
}

function ensureUniqueSlugLocal(baseSlug, blogs, excludeId = null) {
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const found = blogs.find((item) => item.slug === candidate && item.id !== excludeId);
    if (!found) return candidate;
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read thumbnail file."));
    reader.readAsDataURL(file);
  });
}

async function fileToCompressedDataUrl(file) {
  const dataUrl = await fileToDataUrl(file);
  if (!file.type.startsWith("image/")) return dataUrl;

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not process thumbnail image."));
    img.src = dataUrl;
  });

  const maxWidth = 520;
  const ratio = image.width > maxWidth ? maxWidth / image.width : 1;
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.5);
}

function openLocalDb() {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);

    request.onupgradeneeded = () => {
      const dbRef = request.result;
      if (!dbRef.objectStoreNames.contains(IDB_STORE)) {
        dbRef.createObjectStore(IDB_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed opening IndexedDB"));
  });

  return dbPromise;
}

async function idbGetAllBlogsRaw() {
  const dbRef = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = dbRef.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
    req.onerror = () => reject(req.error || new Error("Failed reading IndexedDB blogs"));
  });
}

async function idbPutBlogRaw(rawBlog) {
  const dbRef = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = dbRef.transaction(IDB_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed writing IndexedDB blog"));
    tx.objectStore(IDB_STORE).put(rawBlog);
  });
}

async function idbDeleteBlogRaw(id) {
  const dbRef = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = dbRef.transaction(IDB_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed deleting IndexedDB blog"));
    tx.objectStore(IDB_STORE).delete(id);
  });
}

async function loadFallbackBlogsRaw() {
  const localBlogs = readLocalBlogsRaw();

  try {
    const idbBlogs = await idbGetAllBlogsRaw();

    if (idbBlogs.length > 0) {
      blogDataMode = "indexeddb";
      return idbBlogs;
    }

    if (localBlogs.length > 0) {
      // One-time migration from previous localStorage fallback.
      await Promise.all(localBlogs.map((item) => idbPutBlogRaw(item)));
      blogDataMode = "indexeddb";
      return localBlogs;
    }

    blogDataMode = "indexeddb";
    return [];
  } catch {
    if (localBlogs.length > 0) {
      blogDataMode = blogDataMode === "memory" ? "memory" : "local";
      return localBlogs;
    }

    blogDataMode = blogDataMode === "memory" ? "memory" : "local";
    return [];
  }
}

async function persistFallbackBlog(localBlog) {
  const serialized = serializeLocalBlog(localBlog);

  try {
    await idbPutBlogRaw(serialized);
    blogDataMode = "indexeddb";
    notifyLocalChange();
    return;
  } catch {
    const current = readLocalBlogsRaw();
    const next = [serialized, ...current.filter((item) => item.id !== serialized.id)];
    writeLocalBlogsRaw(next);
    notifyLocalChange();
  }
}

async function persistFallbackBlogUpdate(blogId, updatedSerialized) {
  try {
    await idbPutBlogRaw(updatedSerialized);
    blogDataMode = "indexeddb";
    notifyLocalChange();
    return;
  } catch {
    const current = readLocalBlogsRaw();
    const next = current.map((item) => (item.id === blogId ? updatedSerialized : item));
    writeLocalBlogsRaw(next);
    notifyLocalChange();
  }
}

async function removeFallbackBlog(blogId) {
  try {
    await idbDeleteBlogRaw(blogId);
    blogDataMode = "indexeddb";
    notifyLocalChange();
    return;
  } catch {
    const current = readLocalBlogsRaw();
    writeLocalBlogsRaw(current.filter((item) => item.id !== blogId));
    notifyLocalChange();
  }
}

function normalizeKeywords(keywords) {
  if (Array.isArray(keywords)) {
    return keywords
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  return String(keywords || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeBlogInput(blogData = {}) {
  const title = String(blogData.title || "").trim();
  const category = String(blogData.category || "").trim();

  if (!title) throw new Error("Title is required.");
  if (!category) throw new Error("Category is required.");

  const slug = slugify(blogData.slug || title) || `post-${Date.now()}`;

  return {
    contentType: normalizeContentType(blogData.contentType),
    title,
    slug,
    category,
    categorySlug: toCategorySlug(category),
    excerpt: String(blogData.excerpt || "").trim(),
    authorName: String(blogData.authorName || "TaxInvoo Team").trim(),
    metaTitle: String(blogData.metaTitle || title).trim(),
    readTime: String(blogData.readTime || "").trim() || "5 min read",
    metaDescription: String(blogData.metaDescription || "").trim(),
    keywords: normalizeKeywords(blogData.keywords),
    content: String(blogData.content || "").trim(),
    canonicalUrl: String(blogData.canonicalUrl || "").trim(),
    thumbnailUrl: String(blogData.thumbnailUrl || "").trim(),
    thumbnailAlt: String(blogData.thumbnailAlt || title).trim(),
    featured: Boolean(blogData.featured),
    status: blogData.status === "Draft" ? "Draft" : "Published",
    publishedAt: blogData.publishedAt || null
  };
}

function sanitizeFileName(value = "") {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");
}

async function uploadThumbnail(file, slug) {
  if (!file) return { url: "", path: "" };
  const safeName = sanitizeFileName(file.name || "thumbnail.jpg");
  const storagePath = `blogs/${slug}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, { contentType: file.type || "image/jpeg" });
  const url = await getDownloadURL(storageRef);
  return { url, path: storagePath };
}

async function ensureUniqueSlug(baseSlug, excludeId = null) {
  const blogsRef = collection(db, BLOG_COLLECTION);
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const slugQuery = query(blogsRef, where("slug", "==", candidate), limit(1));
    const result = await getDocs(slugQuery);
    if (result.empty) return candidate;
    const sameDoc = result.docs[0]?.id === excludeId;
    if (sameDoc) return candidate;
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function mapDocToBlog(docSnapshot) {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    ...data,
    contentType: normalizeContentType(data.contentType),
    categorySlug: data.categorySlug || toCategorySlug(data.category || ""),
    readTime: data.readTime || "5 min read",
    authorName: data.authorName || "TaxInvoo Team",
    metaTitle: data.metaTitle || data.title || "TaxInvoo Blog",
    excerpt: data.excerpt || data.metaDescription || "",
    thumbnailUrl: data.thumbnailUrl || "",
    thumbnailPath: data.thumbnailPath || "",
    thumbnailAlt: data.thumbnailAlt || data.title || "Blog thumbnail",
    createdAtDate: data.createdAt?.toDate ? data.createdAt.toDate() : null,
    updatedAtDate: data.updatedAt?.toDate ? data.updatedAt.toDate() : null,
    publishedAtDate: data.publishedAt?.toDate ? data.publishedAt.toDate() : null
  };
}

export async function addBlog(blogData) {
  const normalized = normalizeBlogInput(blogData);
  try {
    normalized.slug = await ensureUniqueSlug(normalized.slug);
    normalized.publishedAt = normalized.publishedAt ? new Date(normalized.publishedAt) : null;
    normalized.thumbnailPath = "";

    if (blogData.thumbnailFile) {
      const uploaded = await uploadThumbnail(blogData.thumbnailFile, normalized.slug);
      normalized.thumbnailUrl = uploaded.url;
      normalized.thumbnailPath = uploaded.path;
    }

    const payload = {
      ...normalized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const blogsRef = collection(db, BLOG_COLLECTION);
    const docRef = await addDoc(blogsRef, payload);
    blogDataMode = "firebase";

    return {
      id: docRef.id,
      ...normalized
    };
  } catch (error) {
    if (!isPermissionError(error)) throw error;

    const fallbackBlogs = (await loadFallbackBlogsRaw()).map(mapLocalToBlog);
    const now = new Date();
    normalized.slug = ensureUniqueSlugLocal(normalized.slug, fallbackBlogs);
    normalized.publishedAt = normalized.publishedAt ? new Date(normalized.publishedAt) : null;
    normalized.thumbnailPath = "";

    if (blogData.thumbnailFile) {
      normalized.thumbnailUrl = await fileToCompressedDataUrl(blogData.thumbnailFile);
    }

    const localBlog = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...normalized,
      createdAtDate: now,
      updatedAtDate: now,
      publishedAtDate: normalized.publishedAt || null
    };

    await persistFallbackBlog(localBlog);
    return { ...localBlog };
  }
}

export async function updateBlog(blogId, blogData, currentBlog = null) {
  if (!blogId) throw new Error("Blog id is required for update.");

  const normalized = normalizeBlogInput(blogData);
  try {
    normalized.slug = await ensureUniqueSlug(normalized.slug, blogId);
    normalized.publishedAt = normalized.publishedAt ? new Date(normalized.publishedAt) : null;
    normalized.thumbnailPath = currentBlog?.thumbnailPath || "";

    if (blogData.thumbnailFile) {
      const uploaded = await uploadThumbnail(blogData.thumbnailFile, normalized.slug);
      normalized.thumbnailUrl = uploaded.url;
      normalized.thumbnailPath = uploaded.path;
      if (currentBlog?.thumbnailPath) {
        try {
          await deleteObject(ref(storage, currentBlog.thumbnailPath));
        } catch {
          // no-op
        }
      }
    } else if (blogData.removeThumbnail) {
      normalized.thumbnailUrl = "";
      normalized.thumbnailPath = "";
      if (currentBlog?.thumbnailPath) {
        try {
          await deleteObject(ref(storage, currentBlog.thumbnailPath));
        } catch {
          // no-op
        }
      }
    } else {
      normalized.thumbnailUrl = currentBlog?.thumbnailUrl || normalized.thumbnailUrl;
    }

    const docRef = doc(db, BLOG_COLLECTION, blogId);
    await updateDoc(docRef, {
      ...normalized,
      updatedAt: serverTimestamp()
    });
    blogDataMode = "firebase";

    return {
      id: blogId,
      ...normalized
    };
  } catch (error) {
    if (!isPermissionError(error)) throw error;

    const localRaw = await loadFallbackBlogsRaw();
    const localBlogs = localRaw.map(mapLocalToBlog);
    const existing = localBlogs.find((item) => item.id === blogId);
    if (!existing) throw error;

    normalized.slug = ensureUniqueSlugLocal(normalized.slug, localBlogs, blogId);
    normalized.publishedAt = normalized.publishedAt ? new Date(normalized.publishedAt) : null;
    normalized.thumbnailPath = "";

    if (blogData.thumbnailFile) {
      normalized.thumbnailUrl = await fileToCompressedDataUrl(blogData.thumbnailFile);
    } else if (blogData.removeThumbnail) {
      normalized.thumbnailUrl = "";
    } else {
      normalized.thumbnailUrl = existing.thumbnailUrl || normalized.thumbnailUrl;
    }

    const updated = {
      ...existing,
      ...normalized,
      updatedAtDate: new Date(),
      publishedAtDate: normalized.publishedAt || null
    };

    await persistFallbackBlogUpdate(blogId, serializeLocalBlog(updated));
    return mapLocalToBlog(serializeLocalBlog(updated));
  }
}

export async function deleteBlog(blog) {
  if (!blog?.id) throw new Error("Blog id is required for delete.");

  try {
    const docRef = doc(db, BLOG_COLLECTION, blog.id);
    await deleteDoc(docRef);

    if (blog.thumbnailPath) {
      try {
        await deleteObject(ref(storage, blog.thumbnailPath));
      } catch {
        // no-op
      }
    }
    blogDataMode = "firebase";
  } catch (error) {
    if (!isPermissionError(error)) throw error;
    await removeFallbackBlog(blog.id);
  }
}

export async function getAllBlogs(contentType = CONTENT_TYPE_BLOG) {
  const normalizedType = String(contentType || "").trim().toLowerCase();
  const includeAll = normalizedType === "all";
  const wantedType = normalizeContentType(contentType);

  try {
    const blogsRef = collection(db, BLOG_COLLECTION);
    const blogQuery = query(blogsRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(blogQuery);
    blogDataMode = "firebase";
    const allBlogs = snapshot.docs.map(mapDocToBlog);
    if (includeAll) return allBlogs;
    return allBlogs.filter((blog) => normalizeContentType(blog.contentType) === wantedType);
  } catch (error) {
    if (!isPermissionError(error)) throw error;

    const local = (await loadFallbackBlogsRaw())
      .map(mapLocalToBlog)
      .sort((a, b) => (b.createdAtDate?.getTime() || 0) - (a.createdAtDate?.getTime() || 0));

    if (includeAll) return local;
    return local.filter((blog) => normalizeContentType(blog.contentType) === wantedType);
  }
}

export async function getPublishedBlogs(contentType = CONTENT_TYPE_BLOG) {
  const allBlogs = await getAllBlogs(contentType);
  return allBlogs.filter((blog) => blog.status === "Published");
}

export async function getBlogBySlug(slug, contentType = CONTENT_TYPE_BLOG) {
  const cleanSlug = slugify(slug);
  if (!cleanSlug) return null;
  const normalizedType = String(contentType || "").trim().toLowerCase();
  const includeAll = normalizedType === "all";
  const wantedType = normalizeContentType(contentType);

  try {
    const blogsRef = collection(db, BLOG_COLLECTION);
    const slugQuery = query(blogsRef, where("slug", "==", cleanSlug), limit(1));
    const snapshot = await getDocs(slugQuery);
    blogDataMode = "firebase";

    if (snapshot.empty) return null;
    const blog = mapDocToBlog(snapshot.docs[0]);
    if (includeAll) return blog;
    return normalizeContentType(blog.contentType) === wantedType ? blog : null;
  } catch (error) {
    if (!isPermissionError(error)) throw error;
    const local = (await loadFallbackBlogsRaw()).map(mapLocalToBlog);
    const found = local.find((item) => item.slug === cleanSlug) || null;
    if (!found) return null;
    if (includeAll) return found;
    return normalizeContentType(found.contentType) === wantedType ? found : null;
  }
}

export async function getPopularBlogs(maxItems = 5, contentType = CONTENT_TYPE_BLOG) {
  const publishedBlogs = await getPublishedBlogs(contentType);
  return publishedBlogs.filter((blog) => blog.featured).slice(0, maxItems);
}
