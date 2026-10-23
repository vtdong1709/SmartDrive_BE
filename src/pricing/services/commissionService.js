import CommissionPlan from "../models/CommissionPlan.js";

export const getCommissionRate = (percentEnv = process.env.BOOKING_COMMISSION_RATE) => {
  const percent = percentEnv != null ? Number(percentEnv) : 15;
  if (Number.isNaN(percent)) return 0.15;
  return Math.min(Math.max(percent, 0), 100) / 100;
};

export const calculateCommission = async ({ service, partnerType = "driver", subType, amount, at = new Date() }) => {
  let plan = null;
  try {
    plan = await CommissionPlan.findOne({
      service,
      partnerType,
      $or: [{ subType }, { subType: null }],
      $and: [
        { $or: [{ effectiveTo: null }, { effectiveTo: { $gte: at } }] },
        { effectiveFrom: { $lte: at } },
      ],
    }).sort({ effectiveFrom: -1 });
  } catch {
    plan = null;
  }
  const rate = plan?.commissionType === "FIXED" ? 0 : getCommissionRate(plan?.rate != null ? plan.rate : undefined);
  const fixed = plan?.commissionType === "FIXED" ? Number(plan.fixedAmount || 0) : 0;
  const commission = plan?.commissionType === "FIXED" ? fixed : Math.round(Number(amount || 0) * rate);
  console.log("[pricing] commission_calculated", { service, partnerType, subType, commission });
  return { commission, rate, fixed, net: Math.round(Number(amount || 0) - commission), planId: plan?._id || null };
};
