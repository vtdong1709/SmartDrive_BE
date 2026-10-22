import { expireHolds } from "../services/holdService.js";

let timer = null;

export const startSharedRideJobs = () => {
  if (timer) return;
  const minutes = Number(process.env.SHARED_RIDE_HOLD_SWEEP_MINUTES) || 1;
  timer = setInterval(async () => {
    try {
      const n = await expireHolds();
      if (n) console.log(`[sharedRide] expired ${n} seat holds`);
    } catch (error) {
      console.error("[sharedRide] expire holds job", error.message);
    }
  }, minutes * 60 * 1000);
  if (typeof timer.unref === "function") timer.unref();
};
