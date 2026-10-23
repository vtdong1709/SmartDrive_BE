export const stackMultipliers = (flags = {}, multipliers = {}) => {
  let value = 1;
  const applied = [];
  if (flags.after21h && multipliers.after21h) {
    value *= Number(multipliers.after21h);
    applied.push({ code: "AFTER_21H", value: Number(multipliers.after21h) });
  }
  if (flags.after23h && multipliers.after23h) {
    value *= Number(multipliers.after23h);
    applied.push({ code: "AFTER_23H", value: Number(multipliers.after23h) });
  }
  if (flags.weekend && multipliers.weekend) {
    value *= Number(multipliers.weekend);
    applied.push({ code: "WEEKEND", value: Number(multipliers.weekend) });
  }
  if (flags.holiday && multipliers.holiday) {
    value *= Number(multipliers.holiday);
    applied.push({ code: "HOLIDAY", value: Number(multipliers.holiday) });
  }
  if (flags.night && multipliers.night) {
    value *= Number(multipliers.night);
    applied.push({ code: "NIGHT", value: Number(multipliers.night) });
  }
  if (flags.urgent && multipliers.urgent) {
    value *= Number(multipliers.urgent);
    applied.push({ code: "URGENT", value: Number(multipliers.urgent) });
  }
  if (flags.surge && multipliers.surge) {
    value *= Number(multipliers.surge);
    applied.push({ code: "SURGE", value: Number(multipliers.surge) });
  }
  if (flags.speed && multipliers.speed) {
    value *= Number(multipliers.speed);
    applied.push({ code: "SPEED", value: Number(multipliers.speed) });
  }
  if (flags.vehicle && multipliers.vehicle) {
    value *= Number(multipliers.vehicle);
    applied.push({ code: "VEHICLE", value: Number(multipliers.vehicle) });
  }
  return { value, applied };
};

export const timeFlagsFromDate = (at, holidays = []) => {
  const d = new Date(at);
  const hour = d.getHours();
  const dayOfWeek = d.getDay();
  const ymd = d.toISOString().slice(0, 10);
  return {
    after21h: hour >= 21 && hour < 23,
    after23h: hour >= 23 || hour < 6,
    weekend: dayOfWeek === 0 || dayOfWeek === 6,
    holiday: holidays.includes(ymd),
    night: hour >= 22 || hour < 6,
  };
};
