import UserBooking from '../model/userBookingModel.js';
import Appointment from '../model/appointmentModel.js';

export const getAdminDashboardStats = async (req, res) => {
  try {
    // Bookings + appointments counts
    const [totalBookings, totalAppointments] = await Promise.all([
      UserBooking.countDocuments(),
      Appointment.countDocuments(),
    ]);

    // Completed payments and total amounts
    const [completedBookings, completedAppointments] = await Promise.all([
      UserBooking.find({ paymentStatus: 'completed' }),
      Appointment.find({ paymentStatus: 'completed' }),
    ]);

    const completedBookingsCount = completedBookings.length;
    const completedAppointmentsCount = completedAppointments.length;

    const totalCompletedOrders = completedBookingsCount + completedAppointmentsCount;
    const totalCollectedAmount = completedBookings.reduce((sum, b) => sum + (b.amount || 0), 0)
      + completedAppointments.reduce((sum, a) => sum + (a.amount || 0), 0);

    const totalUsers = totalBookings + totalAppointments;

    // Prepare a simple recent payment list (latest 12)
    const recentPayments = [...completedBookings, ...completedAppointments]
      .map((item) => ({
        name: item.name,
        email: item.email,
        amount: item.amount || 0,
        type: item.__t ? item.__t : item.plans ? 'booking' : 'appointment',
        paymentStatus: item.paymentStatus,
        createdAt: item.createdAt || item.createdAt,
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 12);

    return res.status(200).json({
      success: true,
      data: {
        totalBookings,
        totalAppointments,
        totalUsers,
        totalCompletedOrders,
        totalCollectedAmount,
        recentPayments,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminUserList = async (req, res) => {
  try {
    const rawFilter = String(req.query.key || req.query.type || req.query.source || "").toLowerCase().trim();
    const filter =
      rawFilter === "consultant" || rawFilter === "consultation"
        ? "consultant"
        : rawFilter === "appointment"
          ? "appointment"
          : null;

    if (!filter) {
      return res.status(400).json({
        success: false,
        message: "Valid key is required: consultant or appointment",
      });
    }

    let formatted = [];

    if (filter === "consultant") {
      const bookings = await UserBooking.find().sort({ createdAt: -1 });
      formatted = bookings.map((item) => ({
        id: item._id,
        name: item.name,
        email: item.email,
        phone: item.mobile || "",
        source: "consultant",
        amount: item.amount || 0,
        paymentStatus: item.paymentStatus || "pending",
        paymentMethod: item.paymentMethod || "unknown",
        createdAt: item.createdAt,
      }));
    } else {
      const appointments = await Appointment.find().sort({ createdAt: -1 });
      formatted = appointments.map((item) => ({
        id: item._id,
        name: item.name,
        email: item.email,
        phone: item.phone || "",
        source: "appointment",
        amount: item.amount || 0,
        paymentStatus: item.paymentStatus || "pending",
        paymentMethod: item.paymentMethod || "unknown",
        createdAt: item.createdAt,
      }));
    }

    const totalFilledForms = formatted.length;
    const totalPaid = formatted.filter((u) => u.paymentStatus === "completed").length;

    return res.status(200).json({
      success: true,
      data: {
        filter,
        totalFilledForms,
        totalPaid,
        users: formatted,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
