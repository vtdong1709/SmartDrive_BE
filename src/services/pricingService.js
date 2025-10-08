import Pricing from "../models/Pricing.js";


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
