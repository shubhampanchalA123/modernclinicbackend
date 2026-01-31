import mongoose from "mongoose";

const userBookingSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  mobile: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, required: true, enum: ["male", "female", "other"] },
  region: { type: String, required: true, enum: ["India", "Asia", "Europe, Australia", "USA, Canada", "South America, Africa"] },
  healthIssue: { type: String, required: true },
  verified: { type: Boolean, default: true },
  consultantId: { type: String, unique: true, sparse: true },
  plans: [{
    planId: { type: String, required: true },
    title: { type: String },
    type: { type: String },
    durationTime: { type: String },
    amount: { type: Number },
    startDate: { type: Date },
    expiryDate: { type: Date }
  }],
  consultationData: {
    hairHealth: {
      stage: String,
      familyHistory: String,
      dandruff: String,
      selectedStage: String
    },
    internalHealth: {
      sleep: String,
      stress: String,
      constipation: String,
      gasAcidity: String,
      energy: String,
      supplements: String
    },
    scalpAssessment: {
      scalpPhoto: String
    }
  },
  amount: { type: Number },
  originalAmount: { type: Number }, // Amount before discount
  couponApplied: {
    code: { type: String },
    discount: { type: Number },
    discountType: { type: String },
    discountValue: { type: Number }
  },
  orderId: { type: String },
  paymentStatus: { type: String, default: 'pending' },
  paymentMethod: { type: String },
  paymentId: { type: String },
  planStartDate: { type: Date },
  planExpiryDate: { type: Date },
  createdAt: {
    type: Date,
    default: Date.now
  }
});
const UserBooking = mongoose.model("UserBooking", userBookingSchema);

export default UserBooking;