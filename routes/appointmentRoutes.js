import express from "express";
import upload from "../utils/multerConfig.js";
import {
  registerAppointment,
  verifyAppointmentOtp
} from "../controller/appointmentController.js";

const router = express.Router();

// Appointment Routes
router.post("/register", registerAppointment);
router.post("/verify", verifyAppointmentOtp);

export default router;