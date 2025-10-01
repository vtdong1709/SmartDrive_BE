import express from "express";
import authRoutes from "./src/routes/authRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import bookingRoutes from "./src/routes/bookingRoutes.js";
import pricingRoutes from "./src/routes/pricingRoutes.js";
const app = express();
app.use(express.json());

//Init Routers
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/pricing", pricingRoutes);

export default app;
