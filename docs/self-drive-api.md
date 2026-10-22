# Self Drive Car Rental API

Base: `/api/self-drive`  
Bật/tắt: `SELF_DRIVE_ENABLED=false`  
Auth: Bearer JWT. Chủ xe = `ownerId` (renter hoặc driver). Khách = `renter`/`driver`.

Response chuẩn: `{ success, message, data }` / `{ success:false, message, code }`.

---

## Enums

**Vehicle status:** `DRAFT | PUBLISHED | UNPUBLISHED | SUSPENDED`

**Booking type:** `REQUEST_TO_BOOK | INSTANT_BOOK`

**Booking status:**  
`PENDING_OWNER_APPROVAL → AWAITING_PAYMENT → CONFIRMED → READY_FOR_PICKUP → IN_USE → RETURN_INSPECTION → COMPLETED`  
Nhánh: `REJECTED | CANCELLED | NO_SHOW | DISPUTED`

**Deposit:** `PENDING | HELD | COLLECTED | PARTIALLY_DEDUCTED | REFUNDED | FORFEITED`

**Payment:** `PENDING | PAID | FAILED | REFUNDED`

**Availability type:** `AVAILABLE | BLOCKED`

---

## Owner

| Method | Path |
|---|---|
| POST | `/vehicles` |
| GET | `/vehicles` |
| GET | `/vehicles/:id` |
| PATCH | `/vehicles/:id` |
| POST | `/vehicles/:id/publish` `{ publish }` |
| POST | `/vehicles/:id/photos` multipart `photos[]` |
| POST | `/vehicles/:id/photos/url` `{ url }` |
| DELETE | `/vehicles/:id/photos/:photoId` |
| GET/POST | `/vehicles/:id/availability` |
| DELETE | `/vehicles/:id/availability/:availabilityId` |
| GET | `/owner/bookings` |
| POST | `/owner/bookings/:id/respond` `{ accept, reason }` |
| POST | `/owner/bookings/:id/ready` |
| POST | `/owner/bookings/:id/return` inspection body |

Availability body:

```json
{ "type": "BLOCKED", "startAt": "...", "endAt": "..." }
```

```json
{ "type": "AVAILABLE", "recurring": { "enabled": true, "daysOfWeek": [1,2,3,4,5], "startHm": "08:00", "endHm": "20:00" } }
```

---

## Customer

| Method | Path |
|---|---|
| GET | `/search?startAt&endAt&lat&lng&seatCount&bodyType&transmission&fuelType&minPrice&maxPrice&delivery&instantBooking` |
| GET | `/vehicles/:id/public` |
| GET | `/vehicles/:id/availability/public` |
| POST | `/vehicles/:id/quote` |
| POST | `/bookings` |
| GET | `/bookings/me` |
| GET | `/bookings/:id` |
| POST | `/bookings/:id/cancel` |
| POST | `/bookings/:id/pay` `{ provider, purpose?: "deposit" }` |
| GET | `/bookings/:id/deposit` |
| POST/GET | `/bookings/:id/handover` |
| POST | `/bookings/:id/return/confirm` |

### Quote request

```json
{
  "startAt": "2026-10-22T08:00:00.000Z",
  "endAt": "2026-10-25T08:00:00.000Z",
  "deliveryLocation": { "address": "Q1", "lat": 10.77, "lng": 106.70 },
  "includeInsurance": true
}
```

`data.quote.total` = thuê xe. `data.depositAmount` **tách riêng**.

### Pay

Purpose cổng: `self_drive` hoặc `self_drive_deposit`, `referenceId` = `bookingCode` (SDR...).  
Webhook/IPN confirm; FE không được tự confirm.

---

## KYC (reuse)

Không tạo bảng KYC mới.

- `user.verified` → identity
- `user.phone` → phone
- `driverapplications` status `approved` + GPLX → license

`SELF_DRIVE_REQUIRE_LICENSE=false` để nới license. Owner **không** nhận URL giấy tờ.

---

## Errors

| code | message |
|---|---|
| 403 | Tài khoản chưa xác thực / thiếu GPLX |
| 400 | Địa điểm giao xe nằm ngoài bán kính |
| 409 | Xe không còn trống trong khoảng thời gian này |
| 400 | Không thể chuyển booking từ X sang Y |
| 403 | Bạn không được chỉnh xe/booking của người khác |

---

## Realtime

`selfDrive.booking.created`  
`selfDrive.booking.confirmed`
