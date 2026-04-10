import Appointment from '../model/appointmentModel.js';
import { v4 as uuidv4 } from 'uuid';
import { sendAdminEventEmail } from '../utils/emailService.js';

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

    // Create new appointment
    const appointmentId = uuidv4();

    const newAppointment = new Appointment({
      name,
      email,
      phone,
      region,
      condition,
      verified: true,
      appointmentId
    });

    await newAppointment.save();
    await sendAdminEventEmail({
      eventType: 'appointment_created',
      payload: {
        name,
        email,
        phone,
        source: 'appointment',
        referenceId: appointmentId,
        createdAt: newAppointment.createdAt,
      },
    });

    res.status(201).json({
      success: true,
      message: "Appointment registered successfully.",
      appointmentId
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


