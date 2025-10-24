import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true }, // tài xế cũng là user
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    pickupLocation: { type: String, required: true },
    dropoffLocation: { type: String },
    distance: { type: Number },
    duration: { type: Number},
    status: { type: String, enum: ["Pending", "Confirmed", "Arriving", "Ongoing", "Completed", "Cancelled"], default: "Pending" },
    price: { type: Number, required: true },
    serviceType: { type: String, enum: ["per_km", "hourly", "daily", "intercity"], required: true },
    paymentMethod: { type: String, enum: ["momo", "vnpay", "paypal", "cash"], required: true },
    paymentStatus: { type: String, enum: ["Pending", "Paid", "Failed"], default: "Pending" },
    createdAt: { type: Date, default: Date.now }
});

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;