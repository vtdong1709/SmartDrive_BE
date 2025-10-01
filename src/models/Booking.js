import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // tài xế cũng là user
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    pickupLocation: { type: String, required: true },
    dropoffLocation: { type: String, required: true },
    distance: { type: Number, required: true },
    duration: { type: Number, required: true },
    status: { type: String, enum: ["Pending", "Confirmed", "Ongoing", "Completed", "Cancelled"], default: "Pending" },
    price: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
});

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;