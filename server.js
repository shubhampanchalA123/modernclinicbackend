import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import compression from "compression";
import connectDB from "./config/db.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { seedAdmin } from "./controller/authController.js";

// Routes
import consultationRoutes from "./routes/consultationRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import planRoutes from "./routes/planRoutes.js";
import authRoutes from "./routes/authRoutes.js";

dotenv.config();

// Connect Database
connectDB();

// Seed admin user
seedAdmin();

const app = express();

/* =======================
   CORS CONFIG (ADDED)
======================= */
const allowedOrigins = [
  "https://www.moderndoctor.in",
  "https://moderndoctor.in",
  "moderndoctor.in",
  "http://localhost:3000"
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow server-to-server / Postman
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* ======================= */

// Body parsers
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static("public"));

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(compression());
app.use(morgan("dev"));

// Rate Limiter
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: "Too many requests, try again later.",
  })
);

// Health Route
app.get("/", (req, res) => {
  res.json({ success: true, message: "API Running 🚀" });
});

// API Routes
app.use("/api/bookingconsultancy", consultationRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api", planRoutes);
app.use("/api/auth", authRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found - ${req.originalUrl}`,
  });
});

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5006;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on port ${PORT}`);
});
