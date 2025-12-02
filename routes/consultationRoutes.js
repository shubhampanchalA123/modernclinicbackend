import express from "express";
import upload from "../utils/multerConfig.js";
import {
  registerBooking,
  verifyOtp,
  submitData
} from "../controller/consultationController.js";

const router = express.Router();

// Booking Consultancy Routes
router.post("/register", registerBooking);
router.post("/verify", verifyOtp);
router.post("/submit", upload.single('scalpPhoto'), submitData);

export default router;