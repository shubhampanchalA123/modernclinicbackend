import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import compression from "compression";
import connectDB from "./config/db.js";
import { errorHandler } from "./middlewares/errorHandler.js";


dotenv.config();

// Connect Database
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));

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

// Routes
import consultationRoutes from "./routes/consultationRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
app.use("/api/bookingconsultancy", consultationRoutes);
app.use("/api/appointments", appointmentRoutes);

// 404 Route
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found - ${req.originalUrl}`,
  });
});

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Accessible at: http://localhost:${PORT}`);
  console.log(`Network access: http://192.168.29.137:${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is busy, trying ${PORT + 1}...`);
    app.listen(PORT + 1, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT + 1}`);
      console.log(`Accessible at: http://localhost:${PORT + 1}`);
      console.log(`Network access: http://192.168.29.137:${PORT + 1}`);
    });
  }
});
