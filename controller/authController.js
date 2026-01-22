import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import Admin from "../model/Admin.js";

// Admin login
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find admin by email
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        role: admin.role
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Seed admin user (call this once to create default admin)
export const seedAdmin = async () => {
  try {
    // Delete existing admin to recreate with correct password
    await Admin.deleteMany({ email: 'modernclinic@hmail.com' });

    // Hash password manually
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('modern@123', salt);

    const admin = new Admin({
      email: 'modernclinic@hmail.com',
      password: hashedPassword
    });

    await admin.save();
    console.log('Default admin created: modernclinic@hmail.com');
  } catch (error) {
    console.error('Error seeding admin:', error);
  }
};