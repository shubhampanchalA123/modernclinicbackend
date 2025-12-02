import Appointment from '../model/appointmentModel.js';
import { v4 as uuidv4 } from 'uuid';
import { verifyFirebaseToken } from '../config/firebase.js';

// Register Appointment
export const registerAppointment = async (req, res) => {
  try {
    const { name, email, phone, region, condition } = req.body;

    if (!name || !email || !phone || !region || !condition) {
      return res.status(400).json({ 
        success: false, 
        message: 'name, email, phone, region, condition fields are required' 
      });
    }

    // STEP 1: Check if unverified appointment exists for same phone
    let existingUnverified = await Appointment.findOne({ phone, verified: false });

    if (existingUnverified) {
      // Update existing unverified appointment
      existingUnverified.name = name;
      existingUnverified.email = email;
      existingUnverified.region = region;
      existingUnverified.condition = condition;

      await existingUnverified.save();

      return res.status(200).json({
        success: true,
        message: "Existing unverified appointment updated. Proceed to OTP verification.",
        consultantId: existingUnverified.consultantId
      });
    }

    // STEP 2: Create new appointment if no unverified one exists
    const consultantId = uuidv4();

    const newAppointment = new Appointment({
      name,
      email,
      phone,
      region,
      condition,
      verified: false,
      consultantId
    });

    await newAppointment.save();

    res.status(201).json({
      success: true,
      message: "Appointment registered successfully. Proceed to verify OTP.",
      consultantId
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// Verify Appointment OTP
export const verifyAppointmentOtp = async (req, res) => {
  try {
    const { phone, idToken, consultantId } = req.body;

    if (!phone || !idToken || !consultantId) {
      return res.status(400).json({ success: false, message: 'Phone, ID token, and consultant ID are required' });
    }

    // Verify ID token with Firebase
    const decodedToken = await verifyFirebaseToken(idToken);
    const phoneNumber = decodedToken.phone_number;

    // Assuming phone is 10 digits, add +91
    const expectedPhone = `+91${phone}`;
    if (phoneNumber !== expectedPhone) {
      return res.status(400).json({ success: false, message: 'Phone number mismatch' });
    }

    // Find the appointment by consultantId and phone
    const appointment = await Appointment.findOne({ consultantId, phone });
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (appointment.verified) {
      return res.status(400).json({ success: false, message: 'Appointment already verified' });
    }

    appointment.verified = true;
    await appointment.save();

    res.status(200).json({ success: true, message: 'OTP verified successfully', consultantId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
