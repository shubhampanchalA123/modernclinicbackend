import Razorpay from 'razorpay';
import crypto from 'crypto';
import UserBooking from '../model/userBookingModel.js';
import Appointment from '../model/appointmentModel.js';
import { getPlanAmount } from './planController.js';
import Plan from "../model/Plan.js";

// Utility function to calculate plan expiry date
const calculatePlanExpiry = (startDate, durationTime) => {
  const date = new Date(startDate);
  switch (durationTime) {
    case 'ONE_TIME':
      return null; // No expiry for one-time
    case '1_MONTH':
      date.setMonth(date.getMonth() + 1);
      break;
    case '3_MONTH':
      date.setMonth(date.getMonth() + 3);
      break;
    case '6_MONTH':
      date.setMonth(date.getMonth() + 6);
      break;
    case '12_MONTH':
      date.setMonth(date.getMonth() + 12);
      break;
    default:
      return null;
  }
  return date;
};

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Payment Order
const createPaymentOrder = async (req, res) => {
  try {
    const { consultantId, selectedPlans, userType } = req.body;

    // 1️⃣ Basic validation
    if (
      !consultantId ||
      !selectedPlans ||
      !Array.isArray(selectedPlans) ||
      selectedPlans.length === 0 ||
      !userType
    ) {
      return res.status(400).json({
        success: false,
        message: "consultantId, selectedPlans (array) and userType are required",
      });
    }

    // 2️⃣ Validate userType
    if (!["india", "foreign"].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userType. Allowed: india | foreign",
      });
    }

    // 3️⃣ Find booking
    const booking = await UserBooking.findOne({ consultantId });
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // 4️⃣ Calculate total amount securely
    let totalAmount = 0;
    const plansData = [];

    for (const selected of selectedPlans) {
      const plan = await Plan.findById(selected.planId);

      if (!plan) {
        return res.status(404).json({
          success: false,
          message: `Plan not found: ${selected.planId}`,
        });
      }

      let planAmount;

      if (userType === "india") {
        planAmount = plan.prices.india;
      } else {
        if (!plan.prices.foreign) {
          return res.status(400).json({
            success: false,
            message: `Foreign price not available for plan: ${plan.title}`,
          });
        }
        planAmount = plan.prices.foreign;
      }

      totalAmount += planAmount;

      plansData.push({
        planId: plan._id,
        title: plan.title,
        type: plan.type,
        durationTime: plan.durationTime || null,
        amount: planAmount,
      });
    }

    // 5️⃣ Save booking data
    booking.plans = plansData;
    booking.userType = userType;
    booking.amount = totalAmount;
    await booking.save();

    // 6️⃣ Create Razorpay order ✅ FIXED
    const order = await razorpay.orders.create({
      amount: totalAmount * 100, // ✅ FIX HERE
      currency: userType === "india" ? "INR" : "USD",
      receipt: booking._id.toString(),
    });

    // 7️⃣ Save orderId
    booking.orderId = order.id;
    await booking.save();

    return res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });

  } catch (error) {
    console.error("Payment Order Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



// Verify Payment
const verifyPayment = async (req, res) => {
  try {
    const { consultantId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    if (!consultantId || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'All payment details are required' });
    }

    const booking = await UserBooking.findOne({ consultantId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Verify signature
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest('hex');

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    // Update booking
    booking.paymentStatus = 'completed';
    booking.paymentMethod = 'online';
    booking.paymentId = razorpay_payment_id;

    // Set plan start and expiry dates for each plan
    const startDate = new Date();
    for (const planItem of booking.plans) {
      const plan = await Plan.findById(planItem.planId);
      if (plan) {
        planItem.startDate = startDate;
        planItem.expiryDate = calculatePlanExpiry(startDate, plan.durationTime);
      }
    }

    await booking.save();

    res.status(200).json({ success: true, message: 'Payment verified successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Payment Method (for at_clinic or emi)
const updatePaymentMethod = async (req, res) => {
  try {
    const { consultantId, paymentMethod } = req.body;

    if (!consultantId || !['at_clinic', 'emi'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Invalid data' });
    }

    const booking = await UserBooking.findOne({ consultantId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    booking.paymentMethod = paymentMethod;
    booking.paymentStatus = paymentMethod === 'at_clinic' ? 'at_clinic' : 'emi';
    await booking.save();

    res.status(200).json({ success: true, message: 'Payment method updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create Appointment Payment Order
const createAppointmentPaymentOrder = async (req, res) => {
  try {
    const { appointmentId, selectedPlans, userType } = req.body;

    // 1️⃣ Basic validation
    if (
      !appointmentId ||
      !selectedPlans ||
      !Array.isArray(selectedPlans) ||
      selectedPlans.length === 0 ||
      !userType
    ) {
      return res.status(400).json({
        success: false,
        message: "appointmentId, selectedPlans (array) and userType are required",
      });
    }

    // 2️⃣ Validate userType
    if (!["india", "foreign"].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userType. Allowed: india | foreign",
      });
    }

    // 3️⃣ Find appointment
    const appointment = await Appointment.findOne({ appointmentId });
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // 4️⃣ Calculate total amount securely
    let totalAmount = 0;
    const plansData = [];

    for (const selected of selectedPlans) {
      const plan = await Plan.findById(selected.planId);

      if (!plan) {
        return res.status(404).json({
          success: false,
          message: `Plan not found: ${selected.planId}`,
        });
      }

      let planAmount;

      if (userType === "india") {
        planAmount = plan.prices.india;
      } else {
        if (!plan.prices.foreign) {
          return res.status(400).json({
            success: false,
            message: `Foreign price not available for plan: ${plan.title}`,
          });
        }
        planAmount = plan.prices.foreign;
      }

      totalAmount += planAmount;

      plansData.push({
        planId: plan._id,
        title: plan.title,
        type: plan.type,
        durationTime: plan.durationTime || null,
        amount: planAmount,
      });
    }

    // 5️⃣ Save appointment data
    appointment.plans = plansData;
    appointment.userType = userType;
    appointment.amount = totalAmount;
    await appointment.save();

    // 6️⃣ Create Razorpay order
    const order = await razorpay.orders.create({
      amount: totalAmount * 100, // amount in paisa/cents
      currency: userType === "india" ? "INR" : "USD",
      receipt: appointmentId,
    });

    // 7️⃣ Save orderId
    appointment.orderId = order.id;
    await appointment.save();

    return res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });

  } catch (error) {
    console.error("Appointment Payment Order Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Verify Appointment Payment
const verifyAppointmentPayment = async (req, res) => {
  try {
    const { appointmentId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    if (!appointmentId || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'All payment details are required' });
    }

    const appointment = await Appointment.findOne({ appointmentId });
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // Verify signature
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest('hex');

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    // Update appointment
    appointment.paymentStatus = 'completed';
    appointment.paymentMethod = 'online';
    appointment.paymentId = razorpay_payment_id;

    // Set plan start and expiry dates for each plan
    const startDate = new Date();
    for (const planItem of appointment.plans) {
      const plan = await Plan.findById(planItem.planId);
      if (plan) {
        planItem.startDate = startDate;
        planItem.expiryDate = calculatePlanExpiry(startDate, plan.durationTime);
      }
    }

    await appointment.save();

    res.status(200).json({ success: true, message: 'Payment verified successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Appointment Payment Method (for at_clinic or emi)
const updateAppointmentPaymentMethod = async (req, res) => {
  try {
    const { appointmentId, paymentMethod } = req.body;

    if (!appointmentId || !['at_clinic', 'emi'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Invalid data' });
    }

    const appointment = await Appointment.findOne({ appointmentId });
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    appointment.paymentMethod = paymentMethod;
    appointment.paymentStatus = paymentMethod === 'at_clinic' ? 'at_clinic' : 'emi';
    await appointment.save();

    res.status(200).json({ success: true, message: 'Payment method updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


export {
  createPaymentOrder,
  verifyPayment,
  updatePaymentMethod,

  createAppointmentPaymentOrder,
  verifyAppointmentPayment,
  updateAppointmentPaymentMethod,
};
