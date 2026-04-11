import mongoose from "mongoose";

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    excerpt: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    category: { type: String, default: "General", trim: true },
    image: { type: String, required: true, trim: true },
    imageKey: { type: String, trim: true },
    tags: [{ type: String, trim: true }],
    isPublished: { type: Boolean, default: true },
    publishedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  {
    timestamps: true,
  }
);

blogSchema.index({ createdAt: -1 });
blogSchema.index({ category: 1 });
blogSchema.index({ title: "text", excerpt: "text", content: "text" });

const Blog = mongoose.model("Blog", blogSchema);

export default Blog;
