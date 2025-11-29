import express from "express";
import cors from "cors";
import authRoutes from "./src/routes/authRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import driverRoutes from "./src/routes/driverRoutes.js";
import driverApplicationRoutes from "./src/routes/driverApplicationRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";
import notificationRoutes from "./src/routes/notificationRoutes.js";
import bookingRoutes from "./src/routes/bookingRoutes.js";
import pricingRoutes from "./src/routes/pricingRoutes.js";
import uploadRoutes from "./src/routes/uploadRoutes.js";
import payOSRoutes from "./src/routes/payOSRoutes.js";
import driverWalletRoutes from "./src/routes/driverWalletRoutes.js";
import chatbotRoutes from "./src/routes/chatbotRoutes.js";
import chatRoutes from "./src/routes/chatRoutes.js";
import deleteAccountRoutes from "./src/routes/deleteAccountRoutes.js";
const app = express();
app.use(express.json());

// CORS configuration (allowlist via CORS_ORIGIN env, comma-separated)
// const allowedOrigins = (process.env.CORS_ORIGIN || "")
//   .split(",")
//   .map((o) => o.trim())
//   .filter(Boolean);
// const corsOptions = {
//   origin: (origin, callback) => {
//     if (!origin) return callback(null, true); // allow non-browser or same-origin
//     if (allowedOrigins.length === 0 || allowedOrigins.includes(origin))
//       return callback(null, true);
//     return callback(new Error("Not allowed by CORS"));
//   },
//   credentials: true,
//   methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
// };

app.use(cors({
  origin: (origin, callback) => {
    // allow any origin dynamically
    callback(null, origin);
  },
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
}));


//Init Routers
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/driver", driverApplicationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/payos", payOSRoutes);
app.use("/api/driver/wallet", driverWalletRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/delete-account", deleteAccountRoutes);

export default app;
