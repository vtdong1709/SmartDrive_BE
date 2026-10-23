# Ride Hailing API (Đặt xe di chuyển)

Base: `/api/rides`  
Bật/tắt: `RIDE_HAILING_ENABLED=false`  
Auth: Bearer JWT. Khách = `renter`/`driver`. Tài xế = `driver`. Admin = `admin`/`staff`.

Response: `{ success, message, data }` / `{ success:false, message, code, errorCode }`.

Module độc lập với thuê tài xế, xe ghép, xe tự lái, giao hàng, cứu hộ.

---

## Enums

**Booking type:** `IMMEDIATE | SCHEDULED`

**Ride status:**

```
DRAFT → QUOTE_READY → SEARCHING_DRIVER → DRIVER_ASSIGNED → DRIVER_EN_ROUTE
→ DRIVER_ARRIVED → WAITING_FOR_PASSENGER → IN_PROGRESS → COMPLETED
```

Nhánh: `CANCELLED_BY_CUSTOMER | CANCELLED_BY_DRIVER | NO_DRIVER_FOUND | NO_SHOW`

Không cho `DRIVER_ASSIGNED → IN_PROGRESS`. Phải arrived + OTP.

**Offer status:** `PENDING | ACCEPTED | REJECTED | EXPIRED | CANCELLED`

**Stop type:** `PICKUP | STOP | DESTINATION`

**Payment method:** `vnpay | payos | cash`

**Payment status:** `PENDING | PAID | FAILED | CASH_PENDING`

**Vehicle category (seed, không hard-code trong logic):**

| code | kind | minSeats | energy |
|---|---|---|---|
| MOTORBIKE | MOTORBIKE | 1 | gasoline |
| CAR_4 | CAR | 4 | gasoline |
| CAR_6 | CAR | 6 | gasoline |
| EV_2 | EV | 2 | electric |
| EV_4 | EV | 4 | electric |
| EV_6 | EV | 6 | electric |

---

## Customer

| Method | Path |
|---|---|
| GET | `/categories` |
| POST | `/quote` |
| POST | `/` |
| GET | `/history` |
| GET | `/:id` |
| GET | `/:id/status` |
| GET | `/:id/driver-location` |
| GET | `/:id/otp` |
| POST | `/:id/cancel` |
| POST | `/:id/rate` |
| POST | `/:id/pay` |

### Quote

```json
{
  "categoryCode": "CAR_4",
  "bookingType": "IMMEDIATE",
  "pickup": { "lat": 10.77, "lng": 106.70, "address": "A" },
  "destination": { "lat": 10.80, "lng": 106.72, "address": "B" },
  "stops": [{ "lat": 10.78, "lng": 106.71, "address": "Stop" }],
  "promoCode": "optional"
}
```

Response gồm `quoteId`, `expiresAt`, `distance`, `duration`, `baseFare`, `distanceFare`, `timeFare`, `bookingFee`, `surgeMultiplier`, `discount`, `estimatedFare`, `minFare`, `priceRange`.

Tạo ride bắt buộc gửi `quoteId` còn hạn (`RIDE_QUOTE_TTL_SECONDS`, mặc định 120s). Backend không tin giá FE.

### Create ride

```json
{ "quoteId": "...", "bookingType": "IMMEDIATE", "paymentMethod": "vnpay" }
```

Scheduled: `scheduledAt` không quá khứ, tối thiểu `RIDE_MIN_LEAD_MINUTES` (10), tối đa `RIDE_MAX_SCHEDULE_DAYS` (7). Search driver bắt đầu trước giờ đón `RIDE_SCHEDULE_LEAD_MINUTES` (20).

Trước assign: không trả PII tài xế. Sau assign: displayName, avatar, phoneMasked, biển số.

OTP: khách gọi `GET /:id/otp` (hash lưu server, không log plaintext).

---

## Driver

| Method | Path |
|---|---|
| POST/GET | `/driver/vehicle` |
| POST | `/driver/location` |
| GET | `/driver/offers` |
| POST | `/driver/offers/:offerId/accept` |
| POST | `/driver/offers/:offerId/reject` |
| GET | `/driver/active` |
| GET | `/driver/history` |
| GET | `/driver/earnings` |
| POST | `/:id/arrived` |
| POST | `/:id/verify-otp` `{ otp }` |
| POST | `/:id/start` `{ otp }` |
| POST | `/:id/complete` |
| POST | `/:id/cancel` |

Xe ride-hailing riêng (`ride_hailing_vehicles`), không dùng SharedRideVehicle / SelfDriveVehicle.

Online/GPS reuse `DriverProfile.availability` + Redis `driver:{id}` + Socket.IO.

Matching: online, approved, location tươi, xe tương thích category, không busy. Bán kính mở rộng `RIDE_SEARCH_RADII_KM=2,4,7,10`. Offer exclusive, TTL `RIDE_OFFER_SECONDS=20`.

Accept race-safe:

```
findOneAndUpdate({ driverId: null, status: SEARCHING_DRIVER }, { driverId })
```

Driver thứ hai: `RIDE_ALREADY_ASSIGNED`.

Complete tính lại cước: actual distance/duration + waiting fee (sau `RIDE_FREE_WAIT_MINUTES`, `RIDE_WAIT_FEE_PER_MIN`) + surge. Earnings = gross − `BOOKING_COMMISSION_RATE`.

---

## Admin

| Method | Path |
|---|---|
| GET | `/admin/rides` |
| GET | `/admin/rides/:id` |
| POST | `/admin/rides/:id/cancel` |
| PATCH | `/admin/categories/:code` |

---

## Realtime events (Socket.IO)

`ride.created`  
`ride.searching_driver`  
`ride.driver_assigned`  
`ride.driver_location_updated`  
`ride.driver_arrived`  
`ride.trip_started`  
`ride.trip_completed`  
`ride.cancelled`  
`driver.ride_offer`  
`driver.offer_expired`

Rooms: `ride:{rideId}`, `user:{userId}`.

---

## Payment

Purpose: `ride_hailing` (VNPay + PayOS, reuse webhook hiện có).

- Webhook idempotent: `paymentStatus === PAID` → `duplicate: true`.
- Cash: `CASH_PENDING` khi complete.
- Không confirm payment từ FE callback.

---

## Error codes

| errorCode | Ý nghĩa |
|---|---|
| NO_DRIVER_AVAILABLE | Hết vòng bán kính, không tài xế |
| RIDE_ALREADY_ASSIGNED | Driver khác đã nhận |
| INVALID_RIDE_STATE | Transition sai |
| VEHICLE_CATEGORY_UNAVAILABLE | Loại xe tắt / không tồn tại |
| INVALID_OTP | OTP sai |
| OTP_EXPIRED | OTP hết hạn |
| DRIVER_TOO_FAR | Ngoài bán kính |
| PAYMENT_FAILED | Thanh toán thất bại |
| RIDE_CANCELLED | Chuyến đã hủy |
| LOCATION_INVALID | Toạ độ/địa chỉ thiếu |
| QUOTE_EXPIRED | Quote hết hạn / không thuộc user |
| SCHEDULE_TIME_INVALID | Giờ đặt trước không hợp lệ |
| OFFER_EXPIRED | Offer hết hạn |
| FORBIDDEN | Không có quyền |

---

## Config (env)

```
RIDE_HAILING_ENABLED=true
RIDE_SEARCH_RADII_KM=2,4,7,10
RIDE_OFFER_SECONDS=20
RIDE_QUOTE_TTL_SECONDS=120
RIDE_SCHEDULE_LEAD_MINUTES=20
RIDE_MIN_LEAD_MINUTES=10
RIDE_MAX_SCHEDULE_DAYS=7
RIDE_MAX_STOPS=3
RIDE_OTP_TTL_MINUTES=15
RIDE_FREE_WAIT_MINUTES=5
RIDE_WAIT_FEE_PER_MIN=3000
RIDE_LOCATION_MAX_AGE_MS=120000
BOOKING_COMMISSION_RATE=15
```

---

## Acceptance

1. Customer quote CAR_4 A→B.  
2. Create ride → SEARCHING_DRIVER → offer driver A.  
3. Driver A accept → DRIVER_EN_ROUTE. Driver B accept → `RIDE_ALREADY_ASSIGNED`.  
4. Arrived → OTP customer → verify → IN_PROGRESS.  
5. Complete → final fare + earnings. Pay webhook → PAID (idempotent).  
PASS.
