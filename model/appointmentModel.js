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