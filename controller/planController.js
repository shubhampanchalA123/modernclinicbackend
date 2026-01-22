import Plan from '../model/Plan.js';

// Create a new plan (Admin only)
// Create a new plan (Admin only)
export const createPlan = async (req, res) => {
  try {
    let {
      type,              // GENERAL | HAIR_TREATMENT | ADDON | APPOINTMENT
      stage,
      durationTime,      // ONE_TIME | 1_MONTH | 3_MONTH | 6_MONTH
      title,
      description,
      prices,
      features
    } = req.body;

    // 🔴 Basic validation
    if (!type || !title || !prices || !Array.isArray(features)) {
      return res.status(400).json({
        success: false,
        message: "type, title, prices and features are required"
      });
    }

    // 💆‍♂️ Stage mandatory for HAIR_TREATMENT
    if (type === "HAIR_TREATMENT") {
      if (!stage || typeof stage !== 'number') {
        return res.status(400).json({
          success: false,
          message: "Stage is required and must be a number for HAIR_TREATMENT plans"
        });
      }
    }

    // 🔒 Only ONE GENERAL plan allowed
    if (type === "GENERAL") {
      const exists = await Plan.findOne({ type: "GENERAL", isActive: true });
      if (exists) {
        return res.status(400).json({
          success: false,
          message: "General plan already exists"
        });
      }

      // 🧠 AUTO duration for GENERAL
      durationTime = "ONE_TIME";
    }

    // ⏱ durationTime mandatory for ALL
    const ALLOWED_DURATIONS = [
      "ONE_TIME",
      "1_MONTH",
      "3_MONTH",
      "6_MONTH",
      "12_MONTH"
    ];

    if (!ALLOWED_DURATIONS.includes(durationTime)) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing durationTime"
      });
    }

    // ❌ ONE_TIME sirf GENERAL ke liye
    if (durationTime === "ONE_TIME" && type !== "GENERAL") {
      return res.status(400).json({
        success: false,
        message: "ONE_TIME duration allowed only for GENERAL plan"
      });
    }

    // 💰 Price validation
    if (!prices.india || typeof prices.india !== "number") {
      return res.status(400).json({
        success: false,
        message: "India price is required and must be a number"
      });
    }

    if (prices.foreign !== undefined && typeof prices.foreign !== "number") {
      return res.status(400).json({
        success: false,
        message: "Foreign price must be a number"
      });
    }

    // ✅ Create plan
    const plan = await Plan.create({
      type,
      stage: type === "HAIR_TREATMENT" ? stage : undefined,
      title,
      description,
      durationTime,
      prices,
      features,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: "Plan created successfully",
      plan
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



// Get plans with optional filters
export const getPlans = async (req, res) => {
  try {
    const { type, stage, region } = req.query;

    const filter = { isActive: true };

    // 🔹 Type filter
    if (type) {
      filter.type = type;
    }

    // 🔹 Stage filter (HAIR_TREATMENT only)
    if (stage && type === "HAIR_TREATMENT") {
      filter.stage = stage;
    }

    // 🌍 Region filter
    if (region && region !== "India") {
      filter["prices.foreign"] = { $exists: true, $ne: null };
    }

    const userType = region === "India" ? "india" : "foreign";

    const plans = await Plan.find(filter).sort({
      durationTime: 1
    });

    res.status(200).json({
      success: true,
      userType,
      count: plans.length,
      plans
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};







// Get payable amount for a plan (Backend as single source of truth)
export const getPlanAmount = async (planId, userType) => {
  try {
    // Validate userType
    if (!['india', 'foreign'].includes(userType.toLowerCase())) {
      throw new Error('Invalid user type. Must be "india" or "foreign"');
    }

    // Fetch plan from database
    const plan = await Plan.findById(planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    if (!plan.isActive) {
      throw new Error('Plan is not active');
    }

    const userTypeLower = userType.toLowerCase();

    // Determine amount based on userType (backend is single source of truth)
    let amount;
    let currency;

    if (userTypeLower === 'india') {
      amount = plan.prices.india;
      currency = 'INR';
    } else {
      // For foreign users, check if foreign price is available
      if (plan.prices.foreign === undefined || plan.prices.foreign === null) {
        throw new Error('This plan is not available for foreign users');
      }
      amount = plan.prices.foreign;
      currency = 'USD';
    }

    return {
      plan,
      amount,
      currency
    };

  } catch (error) {
    throw error;
  }
};