# Shared Rides API Contract

Base path: `/api/shared-rides`

Auth: Bearer JWT (`Authorization: Bearer <token>`). Role `renter` = hành khách, `driver` = tài xế.

Bật/tắt module: `SHARED_RIDE_ENABLED=false` để unmount toàn bộ route.

Hold ghế: `SHARED_RIDE_HOLD_MINUTES` (mặc định 10).

Response chuẩn backend:

```json
{ "success": true, "message": "...", "data": {} }
```

```json
{ "success": false, "message": "...", "code": 400 }
```

---

## Enums

### Trip status
`DRAFT | PUBLISHED | OPEN | FULL | BOARDING | IN_PROGRESS | COMPLETED | CANCELLED`

### Booking type
`SHARED_SEAT | CHARTER`

### Booking status
`PENDING | SEAT_HELD | AWAITING_PAYMENT | PAID | CONFIRMED | CANCELLED | EXPIRED | NO_SHOW | IN_PROGRESS | COMPLETED | REFUNDED`

### Payment status
`PENDING | PAID | FAILED | REFUNDED`

### Seat availability (theo segment đang chọn)
`AVAILABLE | HELD | BOOKED | BLOCKED`

`BOOKED` chỉ khi ghế đã được giữ/xác nhận **overlap** đoạn pickup→dropoff của khách. Ghế booked A→C vẫn `AVAILABLE` cho C→B.

### Pricing mode
`FIXED_TRIP | DISTANCE_BASED | SEGMENT_BASED`

### Charter status
`PENDING_DRIVER_ACCEPTANCE | ACCEPTED | REJECTED | AWAITING_PAYMENT | PAID | CONFIRMED | CANCELLED | EXPIRED | COMPLETED | REFUNDED`

### Vehicle type
`4 | 5 | 7 | 9 | 16`

---

## Driver APIs

| Method | Path | Mô tả |
|---|---|---|
| GET | `/seat-templates` | Layout ghế theo loại xe |
| POST | `/vehicles` | Tạo xe + snapshot seats |
| GET | `/vehicles` | Xe của tôi |
| GET | `/vehicles/:vehicleId` | Chi tiết xe |
| PATCH | `/vehicles/:vehicleId` | Sửa xe / charter windows |
| PATCH | `/vehicles/:vehicleId/seats` | Bật/tắt ghế, price modifier |
| POST | `/trips` | Tạo chuyến nháp |
| GET | `/trips` | List chuyến tài xế |
| PATCH | `/trips/:tripId` | Sửa chuyến / route / pricing |
| PATCH | `/trips/:tripId/seats` | Ghế chuyến |
| POST | `/trips/:tripId/publish` | Đăng chuyến → `OPEN` |
| GET | `/trips/:tripId/dashboard` | Dashboard + bookings |
| GET | `/trips/:tripId/passengers` | Booking trên chuyến |
| GET | `/trips/:tripId/manifest` | Itinerary theo thứ tự đón |
| POST | `/trips/:tripId/start` | Bắt đầu chuyến |
| POST | `/trips/:tripId/complete` | Hoàn thành |
| POST | `/trips/:tripId/cancel` | Hủy chuyến |
| POST | `/driver/bookings/:bookingId/cancel` | Hủy booking khách |
| GET | `/driver/revenue` | Tổng doanh thu |
| GET | `/driver/charters` | Yêu cầu bao xe |
| POST | `/driver/charters/:charterId/respond` | `{ accept, reason }` |

### Create trip example

```http
POST /api/shared-rides/trips
Authorization: Bearer <driver>
```

```json
{
  "vehicleId": "66f...",
  "departureAt": "2026-10-22T20:00:00.000Z",
  "origin": { "address": "Bến xe miền Đông", "lat": 10.814, "lng": 106.707 },
  "destination": { "address": "Vũng Tàu", "lat": 10.346, "lng": 107.084 },
  "waypoints": [{ "address": "Long Thành", "lat": 10.789, "lng": 106.951 }],
  "allowSeatBooking": true,
  "allowCharter": true,
  "charterWindowStart": "18:00",
  "charterWindowEnd": "23:00",
  "pricingMode": "FIXED_TRIP",
  "baseSeatPrice": 150000,
  "charterPrice": 1200000,
  "maxPickupDeviationKm": 2,
  "maxDropoffDeviationKm": 2,
  "segmentPrices": [
    { "fromDistance": 0, "toDistance": 40000, "price": 80000 },
    { "fromDistance": 40000, "toDistance": 90000, "price": 150000 }
  ]
}
```

---

## Passenger APIs

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/search` | no | Tìm chuyến theo lat/lng pickup-dropoff + date |
| GET | `/popular-routes` | no | Tuyến phổ biến |
| GET | `/trips/:tripId` | no | Chi tiết chuyến |
| GET | `/trips/:tripId/seats` | no | Seat map theo segment |
| GET | `/trips/:tripId/track` | yes | Vị trí tài xế nếu trip IN_PROGRESS |
| POST | `/trips/:tripId/quote` | yes | Báo giá |
| POST | `/trips/:tripId/holds` | yes | Giữ ghế 10 phút |
| DELETE | `/holds/:holdId` | yes | Hủy hold |
| POST | `/bookings` | yes | `{ holdId }` → AWAITING_PAYMENT |
| POST | `/bookings/:id/pay` | yes | `{ provider: "vnpay" \| "payos" }` |
| GET | `/bookings/:id` | yes | Chi tiết |
| GET | `/bookings/me` | yes | Lịch sử |
| POST | `/bookings/:id/cancel` | yes | Hủy |
| GET | `/tickets/:ticketId` | yes | Vé + qrToken (HMAC, không chứa PII) |
| POST | `/charters/quote` | yes | Báo giá bao xe |
| POST | `/charters` | yes | Tạo request |
| GET | `/charters/me` | yes | Lịch sử bao xe |
| GET | `/charters/:id` | yes | Chi tiết |
| POST | `/charters/:id/pay` | yes | Thanh toán sau khi tài xế accept |

### Search

```http
GET /api/shared-rides/search?pickupLat=10.80&pickupLng=106.70&dropoffLat=10.85&dropoffLng=106.75&date=2026-10-22&passengerCount=1
```

`data[]` item:

- `id`, `origin`, `destination`, `departureAt`, `estimatedArrivalAt`
- `vehicle`, `driver`, `availableSeats`, `priceFrom`, `allowCharter`
- `routeMatch.routeMatchPercent`, `pickupDeviationMeters`, `dropoffDeviationMeters`
- `estimatedPickupAt`, `estimatedDropoffAt`, `seatsAvailableForSegment`, `startingPrice`

Trip chỉ hiện khi: pickup/dropoff trong deviation, pickup **trước** dropoff theo route, còn ghế trên segment, còn nhận booking.

### Quote

```json
{
  "pickup": { "address": "Long Thành", "lat": 10.789, "lng": 106.951 },
  "dropoff": { "address": "Vũng Tàu", "lat": 10.346, "lng": 107.084 },
  "passengerCount": 1,
  "seatIds": ["seatObjectId"]
}
```

Response: `passengerDistance`, `seatPrices[]`, `fees.platformFee`, `discount`, `total`.

### Hold

Cùng body quote + `seatIds` bắt buộc. Response gồm `holdCode`, `expiresAt`, `pricing`.

### Pay

Tái sử dụng VNPay/PayOS. Purpose:

- `shared_ride` + `referenceId` = `bookingCode` (SRB...)
- `shared_ride_charter` + `referenceId` = `charterCode` (SRC...)

Webhook/IPN hiện tại tự settle. FE **không** được confirm booking từ return URL.

---

## Admin

| GET | `/admin/trips` | admin/staff |
| GET | `/admin/bookings` | admin/staff |

---

## Realtime events (Socket.IO)

`sharedRide.trip.updated`
`sharedRide.seat.held`
`sharedRide.seat.released`
`sharedRide.booking.created`
`sharedRide.booking.confirmed`
`sharedRide.booking.cancelled`
`sharedRide.trip.started`
`sharedRide.trip.completed`
`sharedRide.charter.created`
`sharedRide.charter.updated`

Room gợi ý: `sharedRide:trip:{tripId}`, `user:{userId}`.

---

## Seat occupancy rule

Ghế **không** có `status=BOOKED` toàn chuyến.

Hai booking overlap khi:

`booking1.start < booking2.end AND booking2.start < booking1.end`

`start/end` = `distanceFromOrigin` (mét) trên polyline.

A→C rồi C→B: **hợp lệ**. A→C rồi A→B: **xung đột**.

---

## Errors thường gặp

| code | message |
|---|---|
| 400 | Điểm đón/trả quá xa lộ trình chuyến |
| 400 | Điểm đón phải nằm trước điểm trả theo hướng chuyến |
| 400 | Giờ bao xe nằm ngoài khung nhận của tài xế |
| 400 | Chuyến đã có khách ghế, không thể bao toàn bộ chuyến này |
| 403 | Bạn không được chỉnh chuyến của tài xế khác |
| 409 | Ghế đã được đặt trên đoạn này |
| 409 | Tài xế đã có lịch trùng giờ này |
