import { getIO } from "../../socket.js";

const safeIo = () => {
  try {
    return getIO();
  } catch {
    return null;
  }
};

export const emitSharedRideEvent = (event, payload) => {
  const io = safeIo();
  const body = { ...payload, at: new Date().toISOString() };
  if (!io) {
    console.log(`[sharedRide] ${event}`, {
      tripId: payload.tripId,
      bookingId: payload.bookingId,
      holdId: payload.holdId,
    });
    return;
  }
  io.emit(event, body);
  if (payload.tripId) {
    io.to(`sharedRide:trip:${payload.tripId}`).emit(event, body);
  }
  if (payload.userId) {
    io.to(`user:${payload.userId}`).emit(event, body);
  }
  if (payload.driverId) {
    io.to(`user:${payload.driverId}`).emit(event, body);
  }
};

export const SHARED_RIDE_EVENTS = {
  TRIP_UPDATED: "sharedRide.trip.updated",
  SEAT_HELD: "sharedRide.seat.held",
  SEAT_RELEASED: "sharedRide.seat.released",
  BOOKING_CREATED: "sharedRide.booking.created",
  BOOKING_CONFIRMED: "sharedRide.booking.confirmed",
  BOOKING_CANCELLED: "sharedRide.booking.cancelled",
  TRIP_STARTED: "sharedRide.trip.started",
  TRIP_COMPLETED: "sharedRide.trip.completed",
  CHARTER_CREATED: "sharedRide.charter.created",
  CHARTER_UPDATED: "sharedRide.charter.updated",
};
