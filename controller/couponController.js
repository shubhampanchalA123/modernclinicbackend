import Coupon from '../model/Coupon.js';

// Create Coupon (Admin only)
const createCoupon = async (req, res) => {
  try {
    const { code, discountType, discountValue, expiryDate, usageLimit, description } = req.body;

    // Validation
    if (!code || !discountType || !discountValue || !expiryDate) {
      return res.status(400).json({
        success: false,
        message: 'code, discountType, discountValue, and expiryDate are required'
      });
    }

    if (!['percentage', 'fixed'].includes(discountType)) {
      return res.status(400).json({
        success: false,
        message: 'discountType must be percentage or fixed'
      });
    }

    if (discountType === 'percentage' && (discountValue < 0 || discountValue > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Percentage discount must be between 0 and 100'
      });
    }

    if (discountType === 'fixed' && discountValue < 0) {
      return res.status(400).json({
        success: false,
        message: 'Fixed discount must be positive'
      });
    }

    // Check if code already exists
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists'
      });
    }

    const coupon = new Coupon({
      code: code.toUpperCase(),
      discountType,
      discountValue,
      expiryDate: new Date(expiryDate),
      usageLimit: usageLimit || null,
      description,
      createdBy: req.admin._id
    });

    await coupon.save();

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      coupon
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get All Coupons (Admin only)
const getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      coupons
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update Coupon (Admin only)
const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow updating code
    delete updates.code;

    if (updates.discountType && !['percentage', 'fixed'].includes(updates.discountType)) {
      return res.status(400).json({
        success: false,
        message: 'discountType must be percentage or fixed'
      });
    }

    const coupon = await Coupon.findByIdAndUpdate(id, updates, { new: true });
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    res.json({
      success: true,
      message: 'Coupon updated successfully',
      coupon
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete Coupon (Admin only)
const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    res.json({
      success: true,
      message: 'Coupon deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

import Plan from '../model/Plan.js';

// Apply Coupon (For users)
const applyCoupon = async (req, res) => {
  try {
    const { couponCode, selectedPlans, userType } = req.body;

    if (!couponCode || !selectedPlans || !Array.isArray(selectedPlans) || selectedPlans.length === 0 || !userType) {
      return res.status(400).json({
        success: false,
        message: 'couponCode, selectedPlans (array), and userType are required'
      });
    }

    if (!["india", "foreign"].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid userType. Allowed: india | foreign'
      });
    }

    // Calculate total amount securely on backend
    let totalAmount = 0;
    const plansData = [];

    for (const selected of selectedPlans) {
      const plan = await Plan.findById(selected.planId);

      if (!plan) {
        return res.status(404).json({
          success: false,
          message: `Plan not found: ${selected.planId}`
        });
      }

      let planAmount;
      if (userType === "india") {
        planAmount = plan.prices.india;
      } else {
        if (!plan.prices.foreign) {
          return res.status(400).json({
            success: false,
            message: `Foreign price not available for plan: ${plan.title}`
          });
        }
        planAmount = plan.prices.foreign;
      }

      totalAmount += planAmount;

      plansData.push({
        planId: plan._id,
        title: plan.title,
        amount: planAmount,
      });
    }

    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      isActive: true
    });

    if (!coupon) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coupon code'
      });
    }

    // Check expiry
    if (coupon.expiryDate < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Coupon has expired'
      });
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({
        success: false,
        message: 'Coupon usage limit exceeded'
      });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = Math.round((totalAmount * coupon.discountValue) / 100);
    } else {
      discount = Math.min(coupon.discountValue, totalAmount); // Don't exceed total
    }

    const finalAmount = totalAmount - discount;

    res.json({
      success: true,
      totalAmount,
      discount,
      finalAmount,
      couponCode: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      plansData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export { createCoupon, getCoupons, updateCoupon, deleteCoupon, applyCoupon };