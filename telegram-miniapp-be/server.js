require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// API test
app.get("/", (req, res) => {
  res.send("Backend is running!");
});

// API nhận dữ liệu từ Mini App
app.post("/api/telegram-data", (req, res) => {
  console.log("Received from Mini App:", req.body);
  res.json({ status: "ok" });
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
