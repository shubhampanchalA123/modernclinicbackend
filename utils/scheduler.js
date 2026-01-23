import cron from 'node-cron';
import UserBooking from '../model/userBookingModel.js';
import Appointment from '../model/appointmentModel.js';
import { sendExpiryReminderEmail } from './emailService.js';

// Function to check for expiring plans
const checkExpiringPlans = async () => {
  try {
    const now = new Date();
    const reminderDate = new Date();
    reminderDate.setDate(now.getDate() + 7); // 7 days before expiry

    // Check UserBooking plans
    const expiringBookings = await UserBooking.find({
      'plans.expiryDate': {
        $gte: now,
        $lte: reminderDate
      },
      paymentStatus: 'completed'
    });

    for (const booking of expiringBookings) {
      for (const plan of booking.plans) {
        if (plan.expiryDate && plan.expiryDate >= now && plan.expiryDate <= reminderDate) {
          await sendExpiryReminderEmail(booking.email, booking.name, plan.title, plan.expiryDate);
        }
      }
    }

    // Check Appointment plans
    const expiringAppointments = await Appointment.find({
      'plans.expiryDate': {
        $gte: now,
        $lte: reminderDate
      },
      paymentStatus: 'completed'
    });

    for (const appointment of expiringAppointments) {
      for (const plan of appointment.plans) {
        if (plan.expiryDate && plan.expiryDate >= now && plan.expiryDate <= reminderDate) {
          await sendExpiryReminderEmail(appointment.email, appointment.name, plan.title, plan.expiryDate);
        }
      }
    }

    console.log('Expiry check completed');
  } catch (error) {
    console.error('Error checking expiring plans:', error);
  }
};

// Schedule the job to run daily at 9 AM
cron.schedule('0 9 * * *', () => {
  console.log('Running daily expiry check...');
  checkExpiringPlans();
});

export { checkExpiringPlans };