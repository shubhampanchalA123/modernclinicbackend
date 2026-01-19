import Razorpay from 'razorpay';
import crypto from 'crypto';
import UserBooking from '../model/userBookingModel.js';
import Appointment from '../model/appointmentModel.js';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Payment Order
export const createPaymentOrder = async (req, res) => {
  try {
    console.log('Create Payment Order - Request Body:', req.body);
    const { consultantId, amount } = req.body;

    if (!consultantId || !amount) {
      console.log('Validation failed: Missing consultantId or amount');
      return res.status(400).json({ success: false, message: 'Consultant ID and amount are required' });
    }

    console.log('Finding booking for consultantId:', consultantId);
    const booking = await UserBooking.findOne({ consultantId });
    console.log('Booking found:', booking ? 'Yes' : 'No');
    if (!booking) {
      console.log('Booking not found for consultantId:', consultantId);
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }


    // Update booking with amount
    booking.amount = amount;
    console.log('Saving booking with amount:', amount);
    await booking.save();
    console.log('Booking saved successfully');

    const options = {
      amount: amount * 100, // Razorpay expects amount in paisa
      currency: 'INR',
      receipt: consultantId,
    };
    console.log('Razorpay options:', options);

    console.log('Creating Razorpay order...');
    const order = await razorpay.orders.create(options);
    console.log('Razorpay order created:', order.id);

    // Update booking with orderId
    booking.orderId = order.id;
    console.log('Saving booking with orderId:', order.id);
    await booking.save();
    console.log('Final booking saved');

    res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.log('Error in createPaymentOrder:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify Payment
export const verifyPayment = async (req, res) => {
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
    await booking.save();

    res.status(200).json({ success: true, message: 'Payment verified successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Payment Method (for at_clinic or emi)
export const updatePaymentMethod = async (req, res) => {
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
export const createAppointmentPaymentOrder = async (req, res) => {
  try {
    console.log('Create Appointment Payment Order - Request Body:', req.body);
    const { appointmentId, amount } = req.body;

    if (!appointmentId || !amount) {
      console.log('Validation failed: Missing appointmentId or amount');
      return res.status(400).json({ success: false, message: 'Appointment ID and amount are required' });
    }

    console.log('Finding appointment for appointmentId:', appointmentId);
    const appointment = await Appointment.findOne({ appointmentId });
    console.log('Appointment found:', appointment ? 'Yes' : 'No');
    if (!appointment) {
      console.log('Appointment not found for appointmentId:', appointmentId);
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }


    // Update appointment with amount
    appointment.amount = amount;
    console.log('Saving appointment with amount:', amount);
    await appointment.save();
    console.log('Appointment saved successfully');

    const options = {
      amount: amount * 100, // Razorpay expects amount in paisa
      currency: 'INR',
      receipt: appointmentId,
    };
    console.log('Razorpay options:', options);

    console.log('Creating Razorpay order...');
    const order = await razorpay.orders.create(options);
    console.log('Razorpay order created:', order.id);

    // Update appointment with orderId
    appointment.orderId = order.id;
    console.log('Saving appointment with orderId:', order.id);
    await appointment.save();
    console.log('Final appointment saved');

    res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.log('Error in createAppointmentPaymentOrder:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify Appointment Payment
export const verifyAppointmentPayment = async (req, res) => {
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
    await appointment.save();

    res.status(200).json({ success: true, message: 'Payment verified successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Appointment Payment Method (for at_clinic or emi)
export const updateAppointmentPaymentMethod = async (req, res) => {
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