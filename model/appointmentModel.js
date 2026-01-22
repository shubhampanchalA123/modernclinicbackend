import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  condition: { type: String, required: true },
  region: { type: String, required: true,   enum: ["India", "Asia", "Europe, Australia", "USA, Canada", "South America, Africa"]
},
  verified: { type: Boolean, default: true },
  appointmentId: { type: String, unique: true, sparse: true },
  plans: [{
    planId: { type: String, required: true },
    title: { type: String },
    type: { type: String },
    durationTime: { type: String },
    amount: { type: Number },
    startDate: { type: Date },
    expiryDate: { type: Date }
  }],
  userType: { type: String, enum: ["india", "foreign"] },
  amount: { type: Number },
  orderId: { type: String },
  paymentStatus: { type: String, default: 'pending' },
  paymentMethod: { type: String },
  paymentId: { type: String },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Appointment = mongoose.model("Appointment", appointmentSchema);

export default Appointment;