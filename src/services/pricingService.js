import Pricing from "../models/Pricing.js";

export const getActivePricingByServiceType = async (
  serviceType,
  at = new Date()
) => {
  const active = await Pricing.findOne({
    serviceType,
    $or: [
      { effectiveTo: null },
      {
        $and: [
          { effectiveFrom: { $lte: at } },
          { effectiveTo: { $gte: at } },
        ],
      },
    ],
  }).sort({ effectiveFrom: -1 });

  if (active) return active;

  return Pricing.findOne({ serviceType }).sort({ effectiveFrom: -1 });
};

export const createPricingService = async (data) => {
  const pricing = new Pricing(data);
  return await pricing.save();
};

export const getAllPricingService = async () => {
  return await Pricing.find();
};


export const getPricingByIdService = async (id) => {
  return await Pricing.findById(id);
};


export const updatePricingService = async (id, data) => {
  return await Pricing.findByIdAndUpdate(id, data, { new: true });
};


export const deletePricingService = async (id) => {
  return await Pricing.findByIdAndDelete(id);
};
