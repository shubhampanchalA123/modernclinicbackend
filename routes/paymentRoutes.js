import express from "express";
import {
  createPaymentOrder,
  verifyPayment,
  updatePaymentMethod,
  createAppointmentPaymentOrder,
  verifyAppointmentPayment,
  updateAppointmentPaymentMethod,
} from "../controller/paymentController.js";

const router = express.Router();

// Payment Routes
router.post("/create-order", createPaymentOrder);
router.post("/verify", verifyPayment);
router.post("/update-method", updatePaymentMethod);

// Appointment Payment Routes
router.post("/appointment/create-order", createAppointmentPaymentOrder);
router.post("/appointment/verify", verifyAppointmentPayment);
router.post("/appointment/update-method", updateAppointmentPaymentMethod);



export default router;