import nodemailer from 'nodemailer';

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // or your email service
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

const getAdminNotifyEmail = () => process.env.ADMIN_NOTIFY_EMAIL || 'modernhomeo@gmail.com';

const formatAmount = (amount, currency = 'INR') => {
  const numericAmount = Number(amount || 0);
  return `${currency} ${numericAmount.toFixed(2)}`;
};

const eventTitleMap = {
  consultant_created: 'New Consultant User Registered',
  appointment_created: 'New Appointment User Registered',
  payment_success: 'Payment Completed Successfully',
};

export const sendAdminEventEmail = async ({ eventType, payload = {} }) => {
  try {
    const adminEmail = getAdminNotifyEmail();
    const title = eventTitleMap[eventType] || 'System Event Notification';
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const rows = [
      ['Event', title],
      ['Event Key', eventType || 'unknown'],
      ['Name', payload.name || 'N/A'],
      ['Email', payload.email || 'N/A'],
      ['Phone', payload.phone || payload.mobile || 'N/A'],
      ['Reference ID', payload.referenceId || 'N/A'],
      ['Source', payload.source || 'N/A'],
      ['Payment Status', payload.paymentStatus || 'N/A'],
      ['Payment Method', payload.paymentMethod || 'N/A'],
      ['Amount', payload.amount != null ? formatAmount(payload.amount, payload.currency || 'INR') : 'N/A'],
      ['Created At', payload.createdAt ? new Date(payload.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'],
      ['Notified At', now],
    ];

    const htmlRows = rows
      .map(([label, value]) => `<tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>${label}</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${value}</td></tr>`)
      .join('');

    const mailOptions = {
      from: process.env.SMTP_EMAIL,
      to: adminEmail,
      subject: `[Modern Clinic] ${title}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;color:#111827;">
          <h2 style="margin-bottom:12px;">${title}</h2>
          <p style="margin:0 0 16px;">An event was captured in Modern Clinic backend.</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            ${htmlRows}
          </table>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Admin event email sent: ${eventType} -> ${adminEmail}`);
  } catch (error) {
    // Notification should not break the main application flow
    console.error('Error sending admin event email:', error);
  }
};

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
