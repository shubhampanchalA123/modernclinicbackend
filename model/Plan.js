import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["GENERAL", "HAIR_TREATMENT", "ADDON", "APPOINTMENT"],
      required: true
    },

    stage: {
      type: Number
    },

    title: {
      type: String,
      required: true
    },

    description: {
      type: String,
      required: true
    },

    // 🔑 FINAL DURATION FIELD
    durationTime: {
      type: String,
      enum: ["ONE_TIME", "1_MONTH", "3_MONTH", "6_MONTH", "12_MONTH"],
      required: true
    },

    prices: {
      india: {
        type: Number,
        required: true
      },
      foreign: {
        type: Number,
        default: null
      }
    },

    features: [
      {
        type: String,
        required: true
      }
    ],

    // 🔹 Admin level enable / disable
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

const Plan = mongoose.model("Plan", planSchema);
export default Plan;
