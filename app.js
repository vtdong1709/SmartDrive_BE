import express from "express";
import cors from "cors";
import authRoutes from "./src/routes/authRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import driverRoutes from "./src/routes/driverRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";

const app = express();
app.use(express.json());

// CORS configuration (allowlist via CORS_ORIGIN env, comma-separated)
const allowedOrigins = (process.env.CORS_ORIGIN || "").split(",").map((o) => o.trim()).filter(Boolean);
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow non-browser or same-origin
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));

//Init Routers
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/pricing", pricingRoutes);

export default app;
