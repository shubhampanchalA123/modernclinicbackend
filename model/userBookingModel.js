import mongoose from "mongoose";

const userBookingSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, required: true, enum: ["male", "female", "other"] },
  region: { type: String, required: true, enum: ["India", "Asia", "Europe, Australia", "USA, Canada", "South America, Africa"] },
  healthIssue: { type: String, required: true },
  verified: { type: Boolean, default: false },
  consultantId: { type: String, unique: true, sparse: true },
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
  }
  ,
  createdAt: {
    type: Date,
    default: Date.now
  }
});
const UserBooking = mongoose.model("UserBooking", userBookingSchema);

export default UserBooking;