import express from "express";
import upload from "../utils/multerConfig.js";
import {
  registerAppointment
} from "../controller/appointmentController.js";

const router = express.Router();

// Appointment Routes
router.post("/register", registerAppointment);

export default router;