import express from 'express';
import { getAdminDashboardStats, getAdminUserList } from '../controller/dashboardController.js';
import { verifyAdmin } from '../middlewares/auth.js';

const router = express.Router();

// Admin dashboard stats
router.get('/stats', verifyAdmin, getAdminDashboardStats);
// Admin dashboard user list (consultation + appointment)
router.get('/users', verifyAdmin, getAdminUserList);

export default router;
