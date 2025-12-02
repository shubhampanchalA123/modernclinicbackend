import UserBooking from '../model/userBookingModel.js';
import { v4 as uuidv4 } from 'uuid';
import { verifyFirebaseToken } from '../config/firebase.js';

// Register Booking
export const registerBooking = async (req, res) => {
  try {
    const { name, mobile, age, gender, healthIssue, region } = req.body;

    if (!name || !mobile || !age || !gender || !healthIssue || !region) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // STEP 1: Check if unverified booking exists for same mobile
    let existingUnverified = await UserBooking.findOne({ mobile, verified: false });

    if (existingUnverified) {
      // Update old unverified booking instead of creating new
      existingUnverified.name = name;
      existingUnverified.age = age;
      existingUnverified.gender = gender;
      existingUnverified.healthIssue = healthIssue;
      existingUnverified.region = region;

      await existingUnverified.save();

      return res.status(200).json({
        success: true,
        message: "Unverified booking updated. Proceed to OTP verification.",
        appointmentId: existingUnverified.appointmentId
      });
    }

    // STEP 2: Create new booking if no unverified exists
    const appointmentId = uuidv4();

    const newBooking = new UserBooking({
      name,
      mobile,
      age,
      gender,
      healthIssue,
      region,
      verified: false,
      appointmentId,
    });

    await newBooking.save();

    res.status(201).json({
      success: true,
      message: "Booking registered successfully. Proceed to verify OTP.",
      appointmentId
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// Verify OTP
export const verifyOtp = async (req, res) => {
  try {
    const { mobile, idToken, appointmentId } = req.body;

    if (!mobile || !idToken || !appointmentId) {
      return res.status(400).json({ success: false, message: 'Mobile, ID token, and appointment ID are required' });
    }

    // Verify ID token with Firebase
    const decodedToken = await verifyFirebaseToken(idToken);
    const phoneNumber = decodedToken.phone_number;

    // Assuming mobile is 10 digits, add +91
    const expectedPhone = `+91${mobile}`;
    if (phoneNumber !== expectedPhone) {
      return res.status(400).json({ success: false, message: 'Phone number mismatch' });
    }

    // Find the booking by appointmentId and mobile
    const user = await UserBooking.findOne({ appointmentId, mobile });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (user.verified) {
      return res.status(400).json({ success: false, message: 'Booking already verified' });
    }

    user.verified = true;
    await user.save();

    res.status(200).json({ success: true, message: 'OTP verified successfully', appointmentId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Submit Data
export const submitData = async (req, res) => {
  try {
    const { appointmentId, consultationData } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ success: false, message: 'Appointment ID is required' });
    }

    const user = await UserBooking.findOne({ appointmentId });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Invalid appointment ID' });
    }

    if (!user.verified) {
      return res.status(400).json({ success: false, message: 'User not verified' });
    }

    let data = {};
    if (consultationData) {
      try {
        data = typeof consultationData === 'string' ? JSON.parse(consultationData) : consultationData;
      } catch (e) {
        return res.status(400).json({ success: false, message: 'Invalid consultation data format' });
      }
    }

    // Handle uploaded image
    if (req.file) {
      data.scalpAssessment = data.scalpAssessment || {};
      data.scalpAssessment.scalpPhoto = `/upload/images/${req.file.filename}`;
    }

    user.consultationData = data;
    await user.save();

    res.status(200).json({ success: true, message: 'Consultation data submitted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};