import Blog from "../model/Blog.js";
import { uploadToS3 } from "../utils/uploadToS3.js";

const slugify = (text = "") =>
  String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const toBoolean = (value, fallback = true) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true") return true;
    if (v === "false") return false;
  }
  return fallback;
};

const parseTags = (tags) => {
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  if (typeof tags === "string") return tags.split(",").map((t) => t.trim()).filter(Boolean);
  return [];
};

const buildImageUrl = (req, imageValue) => {
  if (!imageValue) return "";
  const isAbsolute = /^https?:\/\//i.test(imageValue);
  if (isAbsolute) return imageValue;

  const bucket = process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET_NAME;
  const region = process.env.AWS_REGION;

  if (bucket && region) {
    return `https://${bucket}.s3.${region}.amazonaws.com/${imageValue}`;
  }

  const base = `${req.protocol}://${req.get("host")}`;
  if (String(imageValue).startsWith("/")) return `${base}${imageValue}`;
  return `${base}/${imageValue}`;
};

const buildBlogSummary = (req, blog) => ({
  id: blog._id,
  title: blog.title,
  slug: blog.slug,
  excerpt: blog.excerpt,
  category: blog.category,
  image: buildImageUrl(req, blog.image),
  tags: blog.tags || [],
  isPublished: Boolean(blog.isPublished),
  date: blog.publishedAt || blog.createdAt,
  createdAt: blog.createdAt,
  updatedAt: blog.updatedAt,
});

const buildBlogDetails = (req, blog) => ({
  ...buildBlogSummary(req, blog),
  content: blog.content,
});

const buildPublicBlogQuery = (req) => {
  const search = String(req.query.search || "").trim();
  const category = String(req.query.category || "").trim();

  const query = { isPublished: true };
  if (category) query.category = category;
  if (search) query.$text = { $search: search };

  return query;
};

const createUniqueSlug = async (baseTitle, ignoreId = null) => {
  const baseSlug = slugify(baseTitle);
  if (!baseSlug) return null;

  let finalSlug = baseSlug;
  let counter = 1;
  while (true) {
    const existing = await Blog.findOne({ slug: finalSlug });
    if (!existing || String(existing._id) === String(ignoreId)) break;
    counter += 1;
    finalSlug = `${baseSlug}-${counter}`;
  }

  return finalSlug;
};

export const getPublicBlogs = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 12), 1), 50);
    const skip = (page - 1) * limit;
    const query = buildPublicBlogQuery(req);

    const [items, total] = await Promise.all([
      Blog.find(query).sort({ publishedAt: -1, createdAt: -1 }).skip(skip).limit(limit),
      Blog.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        blogs: items.map((blog) => buildBlogSummary(req, blog)),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPublicBlogsViewMore = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
    const query = buildPublicBlogQuery(req);

    const items = await Blog.find(query).sort({ publishedAt: -1, createdAt: -1 }).limit(limit);

    return res.status(200).json({
      success: true,
      data: {
        total: items.length,
        blogs: items.map((blog) => buildBlogDetails(req, blog)),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPublicBlogBySlug = async (req, res) => {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    if (!slug) {
      return res.status(400).json({ success: false, message: "slug is required" });
    }

    const blog = await Blog.findOne({ slug, isPublished: true });
    if (!blog) {
      return res.status(404).json({ success: false, message: "Blog not found" });
    }

    return res.status(200).json({ success: true, data: buildBlogDetails(req, blog) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminBlogs = async (req, res) => {
  try {
    const items = await Blog.find().sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      data: items.map((blog) => buildBlogSummary(req, blog)),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminBlogById = async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ success: false, message: "Blog not found" });
    }
    return res.status(200).json({ success: true, data: buildBlogDetails(req, blog) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createAdminBlog = async (req, res) => {
  try {
    const { title, slug, excerpt, content, category, image, tags, isPublished } = req.body;

    if (!title || !excerpt || !content) {
      return res.status(400).json({
        success: false,
        message: "title, excerpt and content are required",
      });
    }

    let imageValue = image || "";
    if (req.file) {
      if (!String(req.file.mimetype || "").startsWith("image/")) {
        return res.status(400).json({ success: false, message: "Only image files are allowed for blog image" });
      }
      imageValue = await uploadToS3(req.file, "blogs");
    }

    if (!imageValue) {
      return res.status(400).json({ success: false, message: "image is required (file upload or image URL)" });
    }

    const finalSlug = await createUniqueSlug(slug || title);
    if (!finalSlug) {
      return res.status(400).json({ success: false, message: "Could not generate slug from title/slug" });
    }

    const publishFlag = toBoolean(isPublished, true);
    const now = new Date();

    const blog = await Blog.create({
      title: String(title).trim(),
      slug: finalSlug,
      excerpt: String(excerpt).trim(),
      content: String(content),
      category: String(category || "General").trim(),
      image: imageValue,
      imageKey: req.file ? imageValue : undefined,
      tags: parseTags(tags),
      isPublished: publishFlag,
      publishedAt: publishFlag ? now : null,
      createdBy: req.admin?._id,
      updatedBy: req.admin?._id,
    });

    return res.status(201).json({
      success: true,
      message: "Blog created successfully",
      data: buildBlogDetails(req, blog),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAdminBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ success: false, message: "Blog not found" });
    }

    const { title, slug, excerpt, content, category, image, tags, isPublished } = req.body;

    if (title != null) blog.title = String(title).trim();
    if (excerpt != null) blog.excerpt = String(excerpt).trim();
    if (content != null) blog.content = String(content);
    if (category != null) blog.category = String(category).trim();
    if (tags != null) blog.tags = parseTags(tags);

    if (req.file) {
      if (!String(req.file.mimetype || "").startsWith("image/")) {
        return res.status(400).json({ success: false, message: "Only image files are allowed for blog image" });
      }
      const uploadedKey = await uploadToS3(req.file, "blogs");
      blog.image = uploadedKey;
      blog.imageKey = uploadedKey;
    } else if (image != null && String(image).trim()) {
      blog.image = String(image).trim();
    }

    if (title != null || slug != null) {
      const finalSlug = await createUniqueSlug(slug || blog.title, blog._id);
      if (!finalSlug) {
        return res.status(400).json({ success: false, message: "Could not generate slug from title/slug" });
      }
      blog.slug = finalSlug;
    }

    if (isPublished != null) {
      const publishFlag = toBoolean(isPublished, blog.isPublished);
      if (!blog.isPublished && publishFlag && !blog.publishedAt) {
        blog.publishedAt = new Date();
      }
      blog.isPublished = publishFlag;
    }

    blog.updatedBy = req.admin?._id;
    await blog.save();

    return res.status(200).json({
      success: true,
      message: "Blog updated successfully",
      data: buildBlogDetails(req, blog),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
