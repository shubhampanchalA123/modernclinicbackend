import express from 'express';
import {
  getAdminDashboardStats,
  getAdminUserList,
  getConsultantUserDetails,
  getAppointmentUserDetails,
} from '../controller/dashboardController.js';
import { verifyAdmin } from '../middlewares/auth.js';

const router = express.Router();

// Admin dashboard stats
router.get('/stats', verifyAdmin, getAdminDashboardStats);
// Admin dashboard user list (consultation + appointment)
router.get('/users', verifyAdmin, getAdminUserList);
router.get('/users/consultant/:consultantId', verifyAdmin, getConsultantUserDetails);
router.get('/users/appointment/:appointmentId', verifyAdmin, getAppointmentUserDetails);

export default router;
