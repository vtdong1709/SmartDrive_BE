import { expireOffersAndContinue } from "../services/matchingService.js";
import { startScheduledSearches } from "../services/bookingService.js";
import { ensureCategories } from "../services/categoryService.js";

let timer = null;

export const startRideHailingJobs = () => {
  if (timer) return;
  ensureCategories().catch((error) => console.error("[rideHailing] seed categories", error.message));
  timer = setInterval(async () => {
    try {
      const expired = await expireOffersAndContinue();
      if (expired) console.log("[rideHailing] expired offers", expired);
      const scheduled = await startScheduledSearches();
      if (scheduled) console.log("[rideHailing] started scheduled searches", scheduled);
    } catch (error) {
      console.error("[rideHailing] jobs", error.message);
    }
  }, 10 * 1000);
  if (typeof timer.unref === "function") timer.unref();
};
