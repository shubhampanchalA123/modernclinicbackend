import Razorpay from 'razorpay';
import crypto from 'crypto';
import UserBooking from '../model/userBookingModel.js';
import Appointment from '../model/appointmentModel.js';
import Plan from '../model/Plan.js';
import Coupon from '../model/Coupon.js';
import { sendPaymentSuccessEmail } from '../utils/emailService.js';

const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || '2023-08-01';
const CASHFREE_BASE_URL = (process.env.CASHFREE_BASE_URL || 'https://sandbox.cashfree.com/pg').replace(/\/+$/, '');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const calculatePlanExpiry = (startDate, durationTime) => {
  const date = new Date(startDate);
  switch (durationTime) {
    case 'ONE_TIME':
      return null;
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

const getCashfreeHeaders = () => ({
  'x-api-version': CASHFREE_API_VERSION,
  'x-client-id': process.env.CASHFREE_APP_ID,
  'x-client-secret': process.env.CASHFREE_SECRET_KEY,
});

const sanitizePhone = (phone) => {
  if (!phone) return '9999999999';
  const digits = String(phone).replace(/\D/g, '');
  return digits.slice(-10) || '9999999999';
};

const buildCashfreeCustomer = ({ id, name, email, phone }) => ({
  customer_id: String(id),
  customer_name: name || 'Modern Clinic User',
  customer_email: email || 'support@modernclinic.local',
  customer_phone: sanitizePhone(phone),
});

const cashfreeRequest = async (path, options = {}) => {
  if (!process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY) {
    throw new Error('Cashfree credentials are missing in environment variables');
  }

  const headers = {
    ...getCashfreeHeaders(),
    ...(options.headers || {}),
  };

  const response = await fetch(`${CASHFREE_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error_description || 'Cashfree API request failed');
  }

  return data;
};

const createCashfreeOrder = async ({ orderId, amount, customer, orderNote, returnUrl }) =>
  cashfreeRequest('/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      order_id: orderId,
      order_amount: amount,
      order_currency: 'INR',
      customer_details: customer,
      order_meta: returnUrl ? { return_url: returnUrl } : undefined,
      order_note: orderNote,
    }),
  });

const getCashfreeOrder = async (orderId) =>
  cashfreeRequest(`/orders/${encodeURIComponent(orderId)}`, {
    method: 'GET',
  });

const markPlansActive = async (entity) => {
  const startDate = new Date();
  for (const planItem of entity.plans) {
    const plan = await Plan.findById(planItem.planId);
    if (plan) {
      planItem.startDate = startDate;
      planItem.expiryDate = calculatePlanExpiry(startDate, plan.durationTime);
    }
  }
};

const finalizeSuccessfulPayment = async ({ entity, paymentId }) => {
  entity.paymentStatus = 'completed';
  entity.paymentMethod = 'online';
  entity.paymentId = paymentId;

  await markPlansActive(entity);
  await entity.save();

  const currency = entity.userType === 'india' ? 'INR' : 'USD';
  await sendPaymentSuccessEmail(entity.email, entity.name, entity.plans, entity.amount, currency);
};

const verifyCashfreeWebhookSignature = (req) => {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';

  if (!signature || !timestamp || !rawBody || !process.env.CASHFREE_SECRET_KEY) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.CASHFREE_SECRET_KEY)
    .update(`${timestamp}${rawBody}`)
    .digest('base64');

  return signature === expectedSignature;
};

const applyCouponAndPlans = async ({ entity, selectedPlans, userType, couponCode }) => {
  let totalAmount = 0;
  const plansData = [];

  for (const selected of selectedPlans) {
    const plan = await Plan.findById(selected.planId);
    if (!plan) {
      throw new Error(`Plan not found: ${selected.planId}`);
    }

    let planAmount;
    if (userType === 'india') {
      planAmount = plan.prices.india;
    } else {
      if (!plan.prices.foreign) {
        throw new Error(`Foreign price not available for plan: ${plan.title}`);
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

  let discount = 0;
  let appliedCoupon = null;
  if (couponCode) {
    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      isActive: true,
    });

    if (!coupon) {
      const error = new Error('Invalid coupon code');
      error.statusCode = 400;
      throw error;
    }

    if (coupon.expiryDate < new Date()) {
      const error = new Error('Coupon has expired');
      error.statusCode = 400;
      throw error;
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      const error = new Error('Coupon usage limit exceeded');
      error.statusCode = 400;
      throw error;
    }

    discount = coupon.discountType === 'percentage'
      ? Math.round((totalAmount * coupon.discountValue) / 100)
      : Math.min(coupon.discountValue, totalAmount);

    appliedCoupon = coupon;
  }

  entity.plans = plansData;
  entity.userType = userType;
  entity.originalAmount = totalAmount;
  entity.amount = totalAmount - discount;
  entity.couponApplied = appliedCoupon
    ? {
        code: appliedCoupon.code,
        discount,
        discountType: appliedCoupon.discountType,
        discountValue: appliedCoupon.discountValue,
      }
    : null;

  await entity.save();

  if (appliedCoupon) {
    appliedCoupon.usedCount += 1;
    await appliedCoupon.save();
  }
};

const createPaymentOrder = async (req, res) => {
  try {
    const { consultantId, selectedPlans, userType, couponCode, returnUrl } = req.body;

    if (!consultantId || !Array.isArray(selectedPlans) || selectedPlans.length === 0 || !userType) {
      return res.status(400).json({
        success: false,
        message: 'consultantId, selectedPlans (array) and userType are required',
      });
    }

    if (!['india', 'foreign'].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid userType. Allowed: india | foreign',
      });
    }

    const booking = await UserBooking.findOne({ consultantId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    await applyCouponAndPlans({ entity: booking, selectedPlans, userType, couponCode });

    if (userType === 'india') {
      const cashfreeOrderId = `booking_${booking._id}_${Date.now()}`;
      const order = await createCashfreeOrder({
        orderId: cashfreeOrderId,
        amount: Number(booking.amount.toFixed(2)),
        customer: buildCashfreeCustomer({
          id: booking.consultantId || booking._id,
          name: booking.name,
          email: booking.email,
          phone: booking.mobile,
        }),
        orderNote: `Consultation booking for ${booking.name}`,
        returnUrl,
      });

      booking.orderId = order.order_id;
      await booking.save();

      return res.status(200).json({
        success: true,
        gateway: 'cashfree',
        orderId: order.order_id,
        cfOrderId: order.cf_order_id,
        paymentSessionId: order.payment_session_id,
        amount: order.order_amount,
        currency: order.order_currency,
      });
    }

    const order = await razorpay.orders.create({
      amount: booking.amount * 100,
      currency: 'USD',
      receipt: booking._id.toString(),
    });

    booking.orderId = order.id;
    await booking.save();

    return res.status(200).json({
      success: true,
      gateway: 'razorpay',
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Payment Order Error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const {
      consultantId,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      orderId,
      cfOrderId,
      cfPaymentId,
    } = req.body;

    if (!consultantId) {
      return res.status(400).json({ success: false, message: 'consultantId is required' });
    }

    const booking = await UserBooking.findOne({ consultantId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.userType === 'india') {
      const cashfreeOrderId = orderId || booking.orderId;
      if (!cashfreeOrderId) {
        return res.status(400).json({ success: false, message: 'Cashfree orderId is required' });
      }

      const order = await getCashfreeOrder(cashfreeOrderId);
      if (order.order_status !== 'PAID') {
        return res.status(400).json({ success: false, message: 'Cashfree payment not completed yet' });
      }

      await finalizeSuccessfulPayment({
        entity: booking,
        paymentId: cfPaymentId || cfOrderId || order.cf_order_id || cashfreeOrderId,
      });

      return res.status(200).json({ success: true, message: 'Cashfree payment verified successfully' });
    }

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'All Razorpay payment details are required' });
    }

    const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest('hex');

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    await finalizeSuccessfulPayment({ entity: booking, paymentId: razorpay_payment_id });
    return res.status(200).json({ success: true, message: 'Payment verified successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

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

    return res.status(200).json({ success: true, message: 'Payment method updated' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createAppointmentPaymentOrder = async (req, res) => {
  try {
    const { appointmentId, selectedPlans, userType, couponCode, returnUrl } = req.body;

    if (!appointmentId || !Array.isArray(selectedPlans) || selectedPlans.length === 0 || !userType) {
      return res.status(400).json({
        success: false,
        message: 'appointmentId, selectedPlans (array) and userType are required',
      });
    }

    if (!['india', 'foreign'].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid userType. Allowed: india | foreign',
      });
    }

    const appointment = await Appointment.findOne({ appointmentId });
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    await applyCouponAndPlans({ entity: appointment, selectedPlans, userType, couponCode });

    if (userType === 'india') {
      const cashfreeOrderId = `appointment_${appointment._id}_${Date.now()}`;
      const order = await createCashfreeOrder({
        orderId: cashfreeOrderId,
        amount: Number(appointment.amount.toFixed(2)),
        customer: buildCashfreeCustomer({
          id: appointment.appointmentId || appointment._id,
          name: appointment.name,
          email: appointment.email,
          phone: appointment.phone,
        }),
        orderNote: `Appointment booking for ${appointment.name}`,
        returnUrl,
      });

      appointment.orderId = order.order_id;
      await appointment.save();

      return res.status(200).json({
        success: true,
        gateway: 'cashfree',
        orderId: order.order_id,
        cfOrderId: order.cf_order_id,
        paymentSessionId: order.payment_session_id,
        amount: order.order_amount,
        currency: order.order_currency,
      });
    }

    const order = await razorpay.orders.create({
      amount: appointment.amount * 100,
      currency: 'USD',
      receipt: appointmentId,
    });

    appointment.orderId = order.id;
    await appointment.save();

    return res.status(200).json({
      success: true,
      gateway: 'razorpay',
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Appointment Payment Order Error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

const verifyAppointmentPayment = async (req, res) => {
  try {
    const {
      appointmentId,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      orderId,
      cfOrderId,
      cfPaymentId,
    } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ success: false, message: 'appointmentId is required' });
    }

    const appointment = await Appointment.findOne({ appointmentId });
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (appointment.userType === 'india') {
      const cashfreeOrderId = orderId || appointment.orderId;
      if (!cashfreeOrderId) {
        return res.status(400).json({ success: false, message: 'Cashfree orderId is required' });
      }

      const order = await getCashfreeOrder(cashfreeOrderId);
      if (order.order_status !== 'PAID') {
        return res.status(400).json({ success: false, message: 'Cashfree payment not completed yet' });
      }

      await finalizeSuccessfulPayment({
        entity: appointment,
        paymentId: cfPaymentId || cfOrderId || order.cf_order_id || cashfreeOrderId,
      });

      return res.status(200).json({ success: true, message: 'Cashfree payment verified successfully' });
    }

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'All Razorpay payment details are required' });
    }

    const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest('hex');

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    await finalizeSuccessfulPayment({ entity: appointment, paymentId: razorpay_payment_id });
    return res.status(200).json({ success: true, message: 'Payment verified successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

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

    return res.status(200).json({ success: true, message: 'Payment method updated' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const handleCashfreeWebhook = async (req, res) => {
  try {
    if (!verifyCashfreeWebhookSignature(req)) {
      return res.status(400).json({ success: false, message: 'Invalid Cashfree webhook signature' });
    }

    const payload = JSON.parse(req.body.toString('utf8'));
    const orderId = payload?.data?.order?.order_id;
    const orderStatus = payload?.data?.order?.order_status;
    const cfPaymentId = payload?.data?.payment?.cf_payment_id;
    const cfOrderId = payload?.data?.order?.cf_order_id;

    if (!orderId || orderStatus !== 'PAID') {
      return res.status(200).json({ success: true, message: 'Webhook acknowledged' });
    }

    const booking = await UserBooking.findOne({ orderId });
    if (booking && booking.paymentStatus !== 'completed') {
      await finalizeSuccessfulPayment({
        entity: booking,
        paymentId: cfPaymentId || cfOrderId || orderId,
      });
    }

    const appointment = await Appointment.findOne({ orderId });
    if (appointment && appointment.paymentStatus !== 'completed') {
      await finalizeSuccessfulPayment({
        entity: appointment,
        paymentId: cfPaymentId || cfOrderId || orderId,
      });
    }

    return res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export {
  createPaymentOrder,
  verifyPayment,
  updatePaymentMethod,
  createAppointmentPaymentOrder,
  verifyAppointmentPayment,
  updateAppointmentPaymentMethod,
  handleCashfreeWebhook,
};
