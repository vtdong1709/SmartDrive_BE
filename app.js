import express from "express";
import authRoutes from "./src/routes/authRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";

const app = express();
app.use(express.json());

//Init Routers
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

export default app;
