import UserBooking from '../model/userBookingModel.js';
import { v4 as uuidv4 } from 'uuid';

// Register Booking
export const registerBooking = async (req, res) => {
  try {
    const { name, email, mobile, age, gender, healthIssue, region } = req.body;

    if (!name || !email || !mobile || !age || !gender || !healthIssue || !region) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Create new booking
    const consultantId = uuidv4();

    const newBooking = new UserBooking({
      name,
      email,
      mobile,
      age,
      gender,
      healthIssue,
      region,
      verified: true,
      consultantId,
    });

    await newBooking.save();

    res.status(201).json({
      success: true,
      message: "Booking registered successfully.",
      consultantId
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



// Submit Data
export const submitData = async (req, res) => {
  try {
    const { consultantId, consultationData } = req.body;

    if (!consultantId) {
      return res.status(400).json({ success: false, message: 'Appointment ID is required' });
    }

    const user = await UserBooking.findOne({ consultantId });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Invalid appointment ID' });
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