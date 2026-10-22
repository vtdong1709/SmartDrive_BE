import SelfDriveBooking from "../models/SelfDriveBooking.js";
import { BOOKING_STATUS } from "../constants.js";
import { notifyUsers } from "../services/notify.js";

let timer = null;
const reminded = new Set();

export const startSelfDriveJobs = () => {
  if (timer) return;
  timer = setInterval(async () => {
    try {
      const now = Date.now();
      const soon = new Date(now + 2 * 60 * 60 * 1000);
      const pickups = await SelfDriveBooking.find({
        status: { $in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.READY_FOR_PICKUP] },
        startAt: { $gte: new Date(), $lte: soon },
      }).limit(50);
      for (const b of pickups) {
        const key = `pickup:${b._id}`;
        if (reminded.has(key)) continue;
        reminded.add(key);
        await notifyUsers({
          userIds: [b.customerId, b.ownerId],
          title: "Nhắc nhận xe",
          message: `Booking ${b.bookingCode} sắp đến giờ nhận.`,
          meta: { bookingId: b._id },
        });
      }
      const returns = await SelfDriveBooking.find({
        status: BOOKING_STATUS.IN_USE,
        endAt: { $gte: new Date(), $lte: soon },
      }).limit(50);
      for (const b of returns) {
        const key = `return:${b._id}`;
        if (reminded.has(key)) continue;
        reminded.add(key);
        await notifyUsers({
          userIds: [b.customerId, b.ownerId],
          title: "Nhắc trả xe",
          message: `Booking ${b.bookingCode} sắp đến hạn trả.`,
          meta: { bookingId: b._id },
        });
      }
    } catch (error) {
      console.error("[selfDrive] reminder job", error.message);
    }
  }, 15 * 60 * 1000);
  if (typeof timer.unref === "function") timer.unref();
};
