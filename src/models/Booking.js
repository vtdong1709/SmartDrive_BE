import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  pickupLocation: { type: String, required: true },
  dropoffLocation: { type: String },
  distance: { type: Number },
  duration: { type: Number },
  status: {
    type: String,
    enum: [
      "Pending",
      "Confirmed",
      "Arriving",
      "Ongoing",
      "Completed",
      "Cancelled",
    ],
    default: "Pending",
  },
  price: { type: Number, required: true },
  serviceType: {
    type: String,
    enum: ["per_km", "hourly", "daily", "intercity"],
    required: true,
  },
  createdAt: { type: Date, default: Date.now },

  bookingCode: {
    type: String,
    unique: true,
    index: true,
  },

  paymentStatus: {
    type: String,
    enum: ["Pending", "Paid", "Failed"],
    default: "Pending",
  },

  paymentMethod: {
    type: String,
    enum: ["system", "toDriver"],
    required: true,
  },

  payment: {
    orderCode: Number,
    amount: Number,
    bank: {
      bankName: String,
      accountNumber: String,
      accountName: String,
    },
    qrCode: String,
    checkoutUrl: String,
    description: String,
    createdAt: { type: Date, default: Date.now },
  },
});

/**
 * Format: BK<YYMMDD><increment>
 * VD: BK2510040005 => booking thứ 5 ngày 2025-10-04
 */
bookingSchema.pre("save", async function (next) {
  if (this.bookingCode) return next();

  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  const datePrefix = `${yy}${mm}${dd}`;

  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const endOfDay = new Date(now.setHours(23, 59, 59, 999));

  const countToday = await mongoose.model("Booking").countDocuments({
    createdAt: { $gte: startOfDay, $lt: endOfDay },
  });

  const increment = String(countToday + 1).padStart(4, "0");
  this.bookingCode = `BK${datePrefix}${increment}`;

  next();
});

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
