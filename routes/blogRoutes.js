import express from "express";
import { getPublicBlogBySlug, getPublicBlogs, getPublicBlogsViewMore } from "../controller/blogController.js";

const router = express.Router();

router.get("/", getPublicBlogs);
router.get("/view-more", getPublicBlogsViewMore);
router.get("/:slug", getPublicBlogBySlug);

export default router;
