import express from "express";
import { createPlan, getPlans } from "../controller/planController.js";
import { verifyAdmin } from "../middlewares/auth.js";

const router = express.Router();

// Admin route to create a new plan (protected)
router.post("/admin/plans", verifyAdmin, createPlan);

// Public route to get plans with optional filters
router.get("/plans", getPlans);

export default router;