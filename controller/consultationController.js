import UserBooking from '../model/userBookingModel.js';
import { v4 as uuidv4 } from 'uuid';
import { uploadToS3 } from '../utils/uploadToS3.js';

/**
 * ===============================
 * Register Booking
 * ===============================
 */
export const registerBooking = async (req, res) => {
  try {
    const { name, email, mobile, age, gender, healthIssue, region } = req.body;

    if (!name || !email || !mobile || !age || !gender || !healthIssue || !region) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

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
      consultantId
    });

    await newBooking.save();

    return res.status(201).json({
      success: true,
      message: 'Booking registered successfully',
      consultantId
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


/**
 * ===============================
 * Submit Consultation Data + Image
 * ===============================
 */
export const submitData = async (req, res) => {
  try {
    const { consultantId, consultationData } = req.body;

    if (!consultantId) {
      return res.status(400).json({
        success: false,
        message: 'Appointment ID is required'
      });
    }

    const user = await UserBooking.findOne({ consultantId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Invalid appointment ID'
      });
    }

    // Parse consultationData safely
    let data = {};
    if (consultationData) {
      try {
        data = typeof consultationData === 'string'
          ? JSON.parse(consultationData)
          : consultationData;
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Invalid consultation data format'
        });
      }
    }

    /**
     * ✅ Upload scalp image to S3 (if provided)
     */
    if (req.file) {
      const imageUrl = await uploadToS3(req.file, 'scalp-images');

      data.scalpAssessment = data.scalpAssessment || {};
      data.scalpAssessment.scalpPhoto = imageUrl;
    }

    user.consultationData = data;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Consultation data submitted successfully'
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
