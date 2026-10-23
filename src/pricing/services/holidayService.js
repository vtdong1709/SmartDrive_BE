import axios from "axios";

const cache = {};

export const getVietnamHolidays = async (year, { timeoutMs = 2500 } = {}) => {
  if (cache[year]) return cache[year];
  try {
    const { data } = await axios.get(`https://date.nager.at/api/v3/PublicHolidays/${year}/VN`, {
      timeout: timeoutMs,
    });
    const dates = (data || []).map((h) => h.date);
    cache[year] = dates;
    return dates;
  } catch (error) {
    console.warn("[pricing] holiday API fallback", error.message);
    return cache[year] || [];
  }
};
