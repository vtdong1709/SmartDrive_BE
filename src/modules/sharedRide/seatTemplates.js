const makeSeat = ({
  code,
  row,
  column,
  seatType = "standard",
  isDriverSeat = false,
  defaultPriceModifier = 0,
  sortOrder,
}) => ({
  code,
  row,
  column,
  seatType: isDriverSeat ? "driver" : seatType,
  isDriverSeat,
  isBookable: !isDriverSeat,
  defaultPriceModifier: isDriverSeat ? 0 : defaultPriceModifier,
  sortOrder: sortOrder ?? row * 10 + column,
});

const LAYOUTS = {
  4: [
    makeSeat({ code: "D", row: 0, column: 0, isDriverSeat: true }),
    makeSeat({ code: "A1", row: 0, column: 1, seatType: "front", defaultPriceModifier: 20000 }),
    makeSeat({ code: "B1", row: 1, column: 0 }),
    makeSeat({ code: "B2", row: 1, column: 1 }),
  ],
  5: [
    makeSeat({ code: "D", row: 0, column: 0, isDriverSeat: true }),
    makeSeat({ code: "A1", row: 0, column: 1, seatType: "front", defaultPriceModifier: 20000 }),
    makeSeat({ code: "B1", row: 1, column: 0 }),
    makeSeat({ code: "B2", row: 1, column: 1 }),
    makeSeat({ code: "B3", row: 1, column: 2 }),
  ],
  7: [
    makeSeat({ code: "D", row: 0, column: 0, isDriverSeat: true }),
    makeSeat({ code: "A1", row: 0, column: 1, seatType: "front", defaultPriceModifier: 20000 }),
    makeSeat({ code: "B1", row: 1, column: 0 }),
    makeSeat({ code: "B2", row: 1, column: 1 }),
    makeSeat({ code: "B3", row: 1, column: 2 }),
    makeSeat({ code: "C1", row: 2, column: 0, seatType: "rear", defaultPriceModifier: -10000 }),
    makeSeat({ code: "C2", row: 2, column: 1, seatType: "rear", defaultPriceModifier: -10000 }),
  ],
  9: [
    makeSeat({ code: "D", row: 0, column: 0, isDriverSeat: true }),
    makeSeat({ code: "A1", row: 0, column: 1, seatType: "front", defaultPriceModifier: 20000 }),
    makeSeat({ code: "B1", row: 1, column: 0 }),
    makeSeat({ code: "B2", row: 1, column: 1 }),
    makeSeat({ code: "B3", row: 1, column: 2 }),
    makeSeat({ code: "C1", row: 2, column: 0 }),
    makeSeat({ code: "C2", row: 2, column: 1 }),
    makeSeat({ code: "C3", row: 2, column: 2, seatType: "rear", defaultPriceModifier: -10000 }),
  ],
  16: [
    makeSeat({ code: "D", row: 0, column: 0, isDriverSeat: true }),
    makeSeat({ code: "A1", row: 0, column: 1, seatType: "front", defaultPriceModifier: 20000 }),
    makeSeat({ code: "B1", row: 1, column: 0 }),
    makeSeat({ code: "B2", row: 1, column: 1 }),
    makeSeat({ code: "B3", row: 1, column: 2 }),
    makeSeat({ code: "C1", row: 2, column: 0 }),
    makeSeat({ code: "C2", row: 2, column: 1 }),
    makeSeat({ code: "C3", row: 2, column: 2 }),
    makeSeat({ code: "D1", row: 3, column: 0 }),
    makeSeat({ code: "D2", row: 3, column: 1 }),
    makeSeat({ code: "D3", row: 3, column: 2 }),
    makeSeat({ code: "E1", row: 4, column: 0, seatType: "rear", defaultPriceModifier: -10000 }),
    makeSeat({ code: "E2", row: 4, column: 1, seatType: "rear", defaultPriceModifier: -10000 }),
    makeSeat({ code: "E3", row: 4, column: 2, seatType: "rear", defaultPriceModifier: -10000 }),
    makeSeat({ code: "F1", row: 5, column: 0, seatType: "rear", defaultPriceModifier: -10000 }),
    makeSeat({ code: "F2", row: 5, column: 1, seatType: "rear", defaultPriceModifier: -10000 }),
  ],
};

export const getSeatTemplate = (vehicleType) => {
  const seats = LAYOUTS[String(vehicleType)];
  if (!seats) {
    throw Object.assign(
      new Error(`Loại xe ${vehicleType} chưa có seat layout. Hãy thêm template.`),
      { statusCode: 400 }
    );
  }
  return seats.map((seat) => ({ ...seat }));
};

export const listVehicleTypes = () =>
  Object.entries(LAYOUTS).map(([type, seats]) => ({
    vehicleType: type,
    seatCount: seats.filter((s) => s.isBookable).length,
    seats: seats.map((s) => ({ ...s })),
  }));
