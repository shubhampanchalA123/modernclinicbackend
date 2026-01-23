import nodemailer from 'nodemailer';

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // or your email service
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Function to send payment success email
export const sendPaymentSuccessEmail = async (email, name, plans, amount, currency) => {
  try {
    const planDetails = plans.map(plan => `${plan.title} (${plan.durationTime})`).join(', ');

    const mailOptions = {
      from: process.env.SMTP_EMAIL,
      to: email,
      subject: 'Payment Successful - Modern Clinic',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Payment Successful!</h2>
          <p>Dear ${name},</p>
          <p>Your order has been successfully completed.</p>
          <p><strong>Plan(s) Purchased:</strong> ${planDetails}</p>
          <p><strong>Total Amount:</strong> ${currency} ${amount}</p>
          <p>Thank you for choosing Modern Clinic. Your plan is now active.</p>
          <p>If you have any questions, please contact our support team.</p>
          <br>
          <p>Best regards,<br>Modern Clinic Team</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('Payment success email sent to:', email);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

// Function to send expiry reminder email
export const sendExpiryReminderEmail = async (email, name, planTitle, expiryDate) => {
  try {
    const mailOptions = {
      from: process.env.SMTP_EMAIL,
      to: email,
      subject: 'Plan Expiry Reminder - Modern Clinic',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Plan Expiry Reminder</h2>
          <p>Dear ${name},</p>
          <p>This is a reminder that your plan <strong>${planTitle}</strong> is expiring soon.</p>
          <p><strong>Expiry Date:</strong> ${expiryDate.toDateString()}</p>
          <p>Please renew your plan to continue enjoying our services.</p>
          <p>If you have any questions, please contact our support team.</p>
          <br>
          <p>Best regards,<br>Modern Clinic Team</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('Expiry reminder email sent to:', email);
  } catch (error) {
    console.error('Error sending expiry reminder email:', error);
  }
};