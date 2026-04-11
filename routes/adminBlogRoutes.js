import express from "express";
import upload from "../utils/multerConfig.js";
import { verifyAdmin } from "../middlewares/auth.js";
import {
  createAdminBlog,
  getAdminBlogById,
  getAdminBlogs,
  updateAdminBlog,
} from "../controller/blogController.js";

const router = express.Router();

router.get("/", verifyAdmin, getAdminBlogs);
router.get("/:id", verifyAdmin, getAdminBlogById);
router.post("/", verifyAdmin, upload.single("image"), createAdminBlog);
router.put("/:id", verifyAdmin, upload.single("image"), updateAdminBlog);

export default router;
