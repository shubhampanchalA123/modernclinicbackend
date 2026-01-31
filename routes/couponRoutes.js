import express from 'express';
import { createCoupon, getCoupons, updateCoupon, deleteCoupon, applyCoupon } from '../controller/couponController.js';
import { verifyAdmin } from '../middlewares/auth.js';

const router = express.Router();

// Admin routes
router.post('/create', verifyAdmin, createCoupon);
router.get('/all', verifyAdmin, getCoupons);
router.put('/:id', verifyAdmin, updateCoupon);
router.delete('/:id', verifyAdmin, deleteCoupon);

// User route
router.post('/apply', applyCoupon);

export default router;