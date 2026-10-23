# Pricing Engine

Base: `/api/pricing`  
Auth: Bearer JWT. Quote: mọi user đăng nhập. Plans/commission: `admin`/`staff`.

**Xe ghép không dùng Pricing Engine.** Giá lấy từ trip/seat tài xế đăng. FE gửi giá khác → backend ignore.

---

## Services

`DRIVER_BOOKING` · `RIDE_HAILING` · `SELF_DRIVE` · `DELIVERY` · `ROADSIDE_ASSISTANCE` · `PARKING`

Không có `SHARED_RIDE`.

---

## Quote lifecycle

```
POST /api/pricing/quote  →  FE hiển thị items  →  create booking với quoteId
backend validate user / service / expiry / consumed  →  snapshot  →  mark consumed
```

Quote immutable. Admin đổi bảng giá = **tạo version mới**, không sửa version đang active.

### Request

```json
{ "service": "RIDE_HAILING", "context": { "vehicleCategory": "CAR_4", "pickup": {}, "destination": {} } }
```

### Response

`quoteId`, `items[]`, `subtotal`, `multiplier`, `platformFee`, `discount`, `finalFare`, `deposit`, `expiresAt`.

FE chỉ render `items`. Không tự tính multiplier / commission.

---

## Driver booking

`POST /api/bookings/calculateFare` gọi engine, giữ field cũ (`finalFare`, `baseFare`, …) + `quoteId`.

`POST /api/bookings` **không tin `price` từ FE**. Có `quoteId` thì consume quote; không có thì backend tính lại.

SubType: `PER_KM` `MOTORCYCLE` `INTERCITY` `HOURLY` `DAILY`.

Công thức giữ production:

`(baseFare + serviceFare) × multiplier + platformFee` → `Math.round`

Intercity: cumulative brackets từ config (không hard-code 70/100).

Hourly chỉ `DRIVER_BOOKING_HOURLY_ALLOWED` (mặc định 4,8) — cùng rule cho quote và create.

`waitingFee` / extra mileage **tắt** trừ khi `rules.waitingRule.enabled` / `extraMileageRule.enabled`.

Legacy `Pricing` collection được adaptor thành plan — admin không cần nhập lại.

---

## Ride hailing

Distance **cumulative**. Time fare từ route backend. Waiting chỉ khi finalize. Surge default 1.0.

Quote TTL mặc định 5 phút (`PRICING_QUOTE_TTL_RIDE_HAILING_SECONDS`).

---

## Self drive

`dailyRate + leftoverHours × hourlyOverage` + delivery + insurance + long discount.  
`deposit` tách `finalFare`. `amountPayableNow = finalFare + deposit`.

Post-rental: `finalizePricing` (extra mileage, late, fuel, damage…).

---

## Delivery / Roadside / Parking

Config trên `PricingPlan.rules`. Chưa có module booking riêng — quote sẵn sàng.

Roadside types: TOWING, BATTERY_JUMP, TIRE_CHANGE, FUEL_DELIVERY, LOCKOUT, OTHER.

Parking: HOURLY progressive + `dailyMax` + reservation + overstay finalize.

---

## Commission

Tách khỏi customer pricing. `commissionService` đọc `CommissionPlan` hoặc `BOOKING_COMMISSION_RATE`.  
Đặt tài xế `toDriver` không còn hard-code `15%`.

---

## Error codes

`PRICING_NOT_FOUND` `PRICING_CONFIG_INVALID` `QUOTE_NOT_FOUND` `QUOTE_EXPIRED` `QUOTE_ALREADY_CONSUMED` `QUOTE_USER_MISMATCH` `QUOTE_SERVICE_MISMATCH` `ROUTE_CALCULATION_FAILED` `INVALID_PRICING_INPUT`

---

## Admin

`GET /api/pricing/plans`  
`POST /api/pricing/plans` — luôn tạo version mới  
`POST /api/pricing/commissions`  
CRUD cũ `/api/pricing/create|getAll|update|delete` vẫn dùng cho bảng Đặt tài xế legacy.
