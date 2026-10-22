import crypto from "crypto";
import SharedRideTicket from "../models/SharedRideTicket.js";
import User from "../../../models/User.js";
import SharedRideTrip from "../models/SharedRideTrip.js";
import SharedRideVehicle from "../models/SharedRideVehicle.js";

const ticketSecret = () => process.env.JWT_SECRET || "smartDrive";

export const createQrToken = (seed) =>
  crypto.createHmac("sha256", ticketSecret()).update(String(seed)).digest("hex");

export const issueTicket = async ({ type, booking, charter }) => {
  const passengerId = booking?.passengerId || charter?.passengerId;
  const driverId = booking?.driverId || charter?.driverId;
  const trip = booking?.tripId
    ? await SharedRideTrip.findById(booking.tripId)
    : charter?.tripId
      ? await SharedRideTrip.findById(charter.tripId)
      : null;
  const vehicle = trip
    ? trip.vehicleSnapshot
    : (await SharedRideVehicle.findById(charter?.vehicleId)) || {};
  const passenger = await User.findById(passengerId).select("fullName phone");
  const driver = await User.findById(driverId).select("fullName phone");

  const seed = `${type}:${booking?._id || charter?._id}:${Date.now()}`;
  const ticket = await SharedRideTicket.create({
    qrToken: createQrToken(seed),
    type,
    bookingId: booking?._id || null,
    charterId: charter?._id || null,
    tripId: trip?._id || null,
    passengerId,
    driverId,
    snapshot: {
      tripCode: trip?.tripCode || null,
      driver: driver ? { fullName: driver.fullName, phone: driver.phone } : null,
      passenger: passenger ? { fullName: passenger.fullName, phone: passenger.phone } : null,
      vehicle: {
        name: vehicle.name,
        plate: vehicle.plate,
        color: vehicle.color,
        vehicleType: vehicle.vehicleType,
      },
      seats: booking?.seats || [],
      pickup: booking?.pickup || charter?.pickup,
      dropoff: booking?.dropoff || charter?.destination,
      departureAt: trip?.departureAt || charter?.requestedDepartureAt,
      estimatedPickupAt: booking?.pickup?.estimatedAt || charter?.requestedDepartureAt,
      total: booking?.totalAmount || charter?.quotedPrice,
      paymentStatus: booking?.paymentStatus || charter?.paymentStatus,
    },
  });
  return ticket;
};

export const getTicketForUser = async (ticketId, user) => {
  const ticket = await SharedRideTicket.findById(ticketId);
  if (!ticket) {
    throw Object.assign(new Error("Không tìm thấy vé"), { statusCode: 404 });
  }
  const allowed =
    ["admin", "staff"].includes(user.role) ||
    String(ticket.passengerId) === String(user._id) ||
    String(ticket.driverId) === String(user._id);
  if (!allowed) {
    throw Object.assign(new Error("Không được xem vé này"), { statusCode: 403 });
  }
  return ticket;
};
