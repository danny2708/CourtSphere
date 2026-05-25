# API Contract

## Backend Foundation

### `GET /health`

Returns the backend health status.

Response `200`:

```json
{
  "status": "ok",
  "service": "courtsphere-backend",
  "environment": "development",
  "timestamp": "2026-05-16T00:00:00.000Z"
}
```

### Error Shape

All backend errors should use this response shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

`details` is optional and should only contain validation-safe data.

## Auth APIs

### `POST /api/auth/register`

Creates a user, assigns a priority group, and assigns the default `USER` role through `user_roles`.

Request:

```json
{
  "fullName": "Nguyen Van A",
  "email": "user@example.com",
  "phoneNumber": "0900000000",
  "password": "password123",
  "confirmPassword": "password123",
  "priorityGroupCode": "STUDENT",
  "identityCode": "STUDENT001"
}
```

`priorityGroupCode` must be one of `STAFF`, `STUDENT`, or `EXTERNAL`.

Response `201`:

```json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "user": {
    "id": "uuid",
    "fullName": "Nguyen Van A",
    "email": "user@example.com",
    "phoneNumber": "0900000000",
    "identityCode": "STUDENT001",
    "accountStatus": "ACTIVE",
    "bookingPermissionStatus": "ALLOWED",
    "roles": ["USER"],
    "priorityGroup": {
      "id": "uuid",
      "code": "STUDENT",
      "name": "Student",
      "priorityLevel": 2,
      "advanceBookingDays": 7
    }
  }
}
```

Conflict errors:

- `EMAIL_ALREADY_EXISTS`
- `PHONE_ALREADY_EXISTS`
- `IDENTITY_CODE_ALREADY_EXISTS`

### `POST /api/auth/login`

Authenticates by email and password. `LOCKED` or `DISABLED` accounts cannot log in.

Request:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Response `200`: same response shape as register.

Auth errors:

- `INVALID_CREDENTIALS`
- `ACCOUNT_LOCKED`
- `ACCOUNT_DISABLED`

### `GET /api/auth/me`

Requires `Authorization: Bearer <accessToken>`.

Response `200`:

```json
{
  "user": {
    "id": "uuid",
    "fullName": "Nguyen Van A",
    "email": "user@example.com",
    "phoneNumber": "0900000000",
    "identityCode": "STUDENT001",
    "accountStatus": "ACTIVE",
    "bookingPermissionStatus": "ALLOWED",
    "roles": ["USER"],
    "priorityGroup": {
      "id": "uuid",
      "code": "STUDENT",
      "name": "Student",
      "priorityLevel": 2,
      "advanceBookingDays": 7
    }
  }
}
```

### `POST /api/auth/logout`

Requires `Authorization: Bearer <accessToken>`.

Response `200`:

```json
{
  "success": true,
  "message": "Logged out. JWT blacklist is not enabled in the MVP."
}
```

Logout is stateless in the MVP. Token blacklist/revocation is not implemented yet.

## Admin User & RBAC APIs

All endpoints below require `Authorization: Bearer <accessToken>` and `ADMIN`.

### `GET /api/admin/users`

Lists users for administration. Supports optional filters: `keyword`, `accountStatus`, `bookingPermissionStatus`, `roleName`, `priorityGroupId`.

Response `200`:

```json
{
  "users": [
    {
      "id": "uuid",
      "fullName": "Nguyen Van A",
      "email": "user@example.com",
      "phoneNumber": "0900000000",
      "identityCode": "STUDENT001",
      "accountStatus": "ACTIVE",
      "bookingPermissionStatus": "ALLOWED",
      "bookingLockedUntil": null,
      "violationPoints": 0,
      "reputationPoints": 100,
      "roles": ["USER", "FIELD_MANAGER"],
      "priorityGroup": {
        "id": "uuid",
        "code": "STUDENT",
        "name": "Student",
        "priorityLevel": 2,
        "advanceBookingDays": 7
      }
    }
  ]
}
```

### `PUT /api/admin/users/:id`

Updates profile fields. Accepts at least one field.

Request:

```json
{
  "fullName": "Nguyen Van B",
  "email": "user2@example.com",
  "phoneNumber": "0911111111",
  "identityCode": "STUDENT002"
}
```

`phoneNumber` and `identityCode` can be `null` to clear them. Email, phone number, and identity code remain unique.

### `POST /api/admin/users/:id/roles`

Assigns a role through `user_roles`. Existing roles are preserved, so a user can have multiple roles.

Request:

```json
{
  "roleName": "FIELD_MANAGER"
}
```

Allowed roles: `USER`, `FIELD_MANAGER`, `ADMIN`.

### `DELETE /api/admin/users/:id/roles/:roleName`

Removes one role assignment from `user_roles`.

### `PATCH /api/admin/users/:id/account-status`

Locks, unlocks, or disables an account.

Request:

```json
{
  "accountStatus": "LOCKED",
  "reason": "Policy violation"
}
```

Allowed statuses: `ACTIVE`, `LOCKED`, `DISABLED`.

### `PATCH /api/admin/users/:id/booking-permission`

Restricts or restores booking permission.

Request:

```json
{
  "bookingPermissionStatus": "RESTRICTED",
  "bookingLockedUntil": "2026-05-24T00:00:00.000Z",
  "reason": "Too many violations"
}
```

Allowed statuses: `ALLOWED`, `RESTRICTED`. Setting status to `ALLOWED` clears `bookingLockedUntil`.

### `PATCH /api/admin/users/:id/priority-group`

Updates the user's priority group.

Request:

```json
{
  "priorityGroupId": "uuid",
  "reason": "Verified staff"
}
```

Admin changes to profile, roles, account status, booking permission, and priority group create `audit_logs` records.

## Admin Config APIs

All endpoints below require `Authorization: Bearer <accessToken>` and `ADMIN`. `USER` and `FIELD_MANAGER` are forbidden.

### `GET /api/admin/booking-rules`

Returns the active booking-rule configuration. If no active row exists yet, the service returns the documented fallback defaults and later writes concrete DB rows when updated.

Response `200`:

```json
{
  "bookingRules": {
    "id": "uuid",
    "ruleName": "DEFAULT",
    "maxBookingsPerDay": 2,
    "maxDurationMinutes": 120,
    "holdMinutes": 10,
    "cancelBeforeHours": 2,
    "lateCheckinMinutes": 15,
    "violationThreshold": 3,
    "bookingBanDays": 7,
    "refundRateUserOnTime": 100,
    "refundRateManagerFault": 100,
    "status": "ACTIVE",
    "updatedByUserId": "uuid",
    "createdAt": "2026-05-18T00:00:00.000Z",
    "updatedAt": "2026-05-18T00:00:00.000Z"
  }
}
```

### `PUT /api/admin/booking-rules`

Updates the active booking-rule configuration and writes an `audit_logs` record with `entityType = BOOKING_RULE` and `action = ADMIN_UPDATE_BOOKING_RULES`.

Request accepts at least one field:

```json
{
  "maxBookingsPerDay": 2,
  "maxDurationMinutes": 120,
  "holdMinutes": 10,
  "cancelBeforeHours": 2,
  "lateCheckinMinutes": 15,
  "violationThreshold": 3,
  "bookingBanDays": 7,
  "refundRateUserOnTime": 100,
  "refundRateManagerFault": 100
}
```

Validation:

- Count/duration/hold/threshold fields that must be positive reject `0` and negative values.
- Window fields that can be disabled use `>= 0`.
- Refund rates must be between `0` and `100`.

### `GET /api/admin/priority-groups`

Lists priority groups and their current user counts.

Response `200`:

```json
{
  "priorityGroups": [
    {
      "id": "uuid",
      "groupCode": "STUDENT",
      "groupName": "Student",
      "priorityLevel": 2,
      "advanceBookingDays": 7,
      "description": "Student users",
      "status": "ACTIVE",
      "userCount": 12,
      "createdAt": "2026-05-18T00:00:00.000Z",
      "updatedAt": "2026-05-18T00:00:00.000Z"
    }
  ]
}
```

### `PUT /api/admin/priority-groups/:id`

Updates a priority group and writes an `audit_logs` record with `entityType = PRIORITY_GROUP` and `action = ADMIN_UPDATE_PRIORITY_GROUP`.

Request accepts at least one field:

```json
{
  "groupName": "Student",
  "groupCode": "STUDENT",
  "priorityLevel": 2,
  "advanceBookingDays": 7,
  "description": "Student users",
  "status": "ACTIVE"
}
```

`groupCode` must be unique. No hard-delete endpoint is exposed for priority groups.

### `GET /api/admin/priority-policies`

Lists priority policies with their linked priority group.

Response `200`:

```json
{
  "priorityPolicies": [
    {
      "id": "uuid",
      "priorityGroupId": "uuid",
      "priorityGroup": {
        "id": "uuid",
        "groupCode": "STUDENT",
        "groupName": "Student"
      },
      "policyName": "Student Policy",
      "priorityRank": 2,
      "advanceBookingDays": 7,
      "maxBookingsPerDay": 2,
      "maxDurationMinutes": 120,
      "canJoinWaitlist": true,
      "canBookPrioritySlots": true,
      "status": "ACTIVE"
    }
  ]
}
```

### `PUT /api/admin/priority-policies/:id`

Updates a priority policy and writes an `audit_logs` record with `entityType = PRIORITY_POLICY` and `action = ADMIN_UPDATE_PRIORITY_POLICY`.

Request accepts at least one field:

```json
{
  "priorityGroupId": "uuid",
  "priorityRank": 2,
  "advanceBookingDays": 7,
  "maxBookingsPerDay": 2,
  "canJoinWaitlist": true,
  "status": "ACTIVE"
}
```

Validation:

- `priorityRank > 0`.
- `advanceBookingDays >= 0`.
- `maxBookingsPerDay > 0` when provided.

## Court APIs

All endpoints below require `Authorization: Bearer <accessToken>`.

### `GET /api/court-types`

Lists court types.

Response `200`:

```json
{
  "courtTypes": [
    {
      "id": "uuid",
      "typeName": "Football",
      "description": "Outdoor football fields",
      "status": "ACTIVE",
      "createdAt": "2026-05-17T00:00:00.000Z",
      "updatedAt": "2026-05-17T00:00:00.000Z"
    }
  ]
}
```

### `POST /api/admin/court-types`

Requires `ADMIN`.

Request:

```json
{
  "typeName": "Football",
  "description": "Outdoor football fields"
}
```

Response `201`:

```json
{
  "courtType": {
    "id": "uuid",
    "typeName": "Football",
    "description": "Outdoor football fields",
    "status": "ACTIVE"
  }
}
```

### `PUT /api/admin/court-types/:id`

Requires `ADMIN`. Accepts at least one of `typeName` or `description`.

### `PATCH /api/admin/court-types/:id/status`

Requires `ADMIN`. This is the soft-disable path for court types; no hard-delete endpoint is exposed.

Request:

```json
{
  "status": "INACTIVE"
}
```

### `GET /api/courts`

Lists courts. Supports optional filters: `keyword`, `courtTypeId`, `status`.

Response `200`:

```json
{
  "courts": [
    {
      "id": "uuid",
      "courtName": "Main Field",
      "description": "Full-size outdoor field",
      "imageUrl": "https://example.com/court.jpg",
      "status": "ACTIVE",
      "courtType": {
        "id": "uuid",
        "typeName": "Football",
        "description": "Outdoor football fields",
        "status": "ACTIVE"
      }
    }
  ]
}
```

### `GET /api/courts/:id`

Returns one court with operating hours and pricing rules.

Response `200`:

```json
{
  "court": {
    "id": "uuid",
    "courtName": "Main Field",
    "status": "ACTIVE",
    "courtType": {
      "id": "uuid",
      "typeName": "Football"
    },
    "operatingHours": [],
    "pricingRules": []
  }
}
```

### `GET /api/courts/:id/availability`

Requires `Authorization: Bearer <accessToken>`.

Calculates generated slots for one court on one calendar date. The backend interprets `date` as a `YYYY-MM-DD` UTC calendar date and returns ISO timestamps.
Availability and overlap checks are based on `booking_items`, not `booking_orders`.

Query params:

- `date` required, format `YYYY-MM-DD`.
- `durationMinutes` optional. Defaults to the court operating-hour `slotDurationMinutes`.
- `includePricing` optional boolean. Defaults to `true`.

Example:

```text
GET /api/courts/:id/availability?date=2026-05-20&durationMinutes=60&includePricing=true
```

Response `200`:

```json
{
  "court": {
    "id": "uuid",
    "courtName": "Main Field",
    "status": "ACTIVE",
    "courtType": {
      "id": "uuid",
      "typeName": "Football"
    }
  },
  "date": "2026-05-20",
  "weekday": 3,
  "durationMinutes": 60,
  "policy": {
    "holdMinutes": 10,
    "cancelBeforeHours": 2,
    "lateCheckinMinutes": 15,
    "maxDurationMinutes": 120,
    "maxBookingsPerDay": 2,
    "advanceBookingDays": 7,
    "canJoinWaitlist": true,
    "refundRateUserOnTime": 100,
    "refundRateManagerFault": 100
  },
  "slots": [
    {
      "startDatetime": "2026-05-20T08:00:00.000Z",
      "endDatetime": "2026-05-20T09:00:00.000Z",
      "status": "AVAILABLE",
      "priceAmount": 50000
    },
    {
      "startDatetime": "2026-05-20T09:00:00.000Z",
      "endDatetime": "2026-05-20T10:00:00.000Z",
      "status": "HOLD",
      "priceAmount": 50000,
      "bookingOrderId": "uuid",
      "bookingItemId": "uuid",
      "unavailableReason": "Slot is temporarily held pending payment"
    }
  ]
}
```

Slot statuses:

- `AVAILABLE`: slot can be selected.
- `BOOKED`: slot overlaps an active booking.
- `HOLD`: slot overlaps a non-expired `PENDING_PAYMENT` hold.
- `MAINTENANCE`: court status is `MAINTENANCE`.
- `CLOSED`: court is closed, retired, in the past, or outside the user's advance booking window.

Booking statuses that occupy availability:

- `PENDING_PAYMENT` only while `holdExpiresAt` is not expired.
- `PAYMENT_PROCESSING`
- `CONFIRMED`
- `IN_USE`

Non-active statuses such as `PAYMENT_EXPIRED`, cancelled statuses, `COMPLETED`, and `NO_SHOW` do not occupy a slot.

### `POST /api/admin/courts`

Requires `ADMIN`.

Request:

```json
{
  "courtTypeId": "uuid",
  "courtName": "Main Field",
  "description": "Full-size outdoor field",
  "imageUrl": "https://example.com/court.jpg"
}
```

### `PUT /api/admin/courts/:id`

Requires `ADMIN`. Accepts any subset of create fields.

### `PATCH /api/admin/courts/:id/status`

Requires `ADMIN` or `FIELD_MANAGER`. This is the soft-retire/maintenance path for courts; no hard-delete endpoint is exposed. Status changes create `court_status_histories` when the status value changes.

Request:

```json
{
  "status": "MAINTENANCE",
  "reason": "Scheduled maintenance"
}
```

Allowed statuses: `ACTIVE`, `MAINTENANCE`, `TEMP_CLOSED`, `RETIRED`.

### `GET /api/admin/courts/:courtId/operating-hours`

Requires `ADMIN`.

### `POST /api/admin/courts/:courtId/operating-hours`

Requires `ADMIN`.

Request:

```json
{
  "weekday": 1,
  "openTime": "08:00",
  "closeTime": "20:00",
  "slotDurationMinutes": 60
}
```

Validation:

- `weekday` must be `1..7`.
- `openTime` must be earlier than `closeTime`.
- `slotDurationMinutes` must be greater than `0`.

### `PUT /api/admin/operating-hours/:id`

Requires `ADMIN`. Accepts any subset of operating-hour fields.

### `PATCH /api/admin/operating-hours/:id/status`

Requires `ADMIN`.

Request:

```json
{
  "status": "INACTIVE"
}
```

### `GET /api/admin/courts/:courtId/pricing-rules`

Requires `ADMIN`.

### `POST /api/admin/courts/:courtId/pricing-rules`

Requires `ADMIN`.

Request:

```json
{
  "startTime": "08:00",
  "endTime": "10:00",
  "applicableDay": 1,
  "priceAmount": 50000,
  "priorityGroupId": "uuid",
  "effectiveFrom": "2026-05-17T00:00:00.000Z",
  "effectiveTo": "2026-12-31T23:59:59.999Z"
}
```

Validation:

- `startTime` must be earlier than `endTime`.
- `priceAmount` must be greater than or equal to `0`.
- `effectiveFrom` must be earlier than or equal to `effectiveTo` when both are provided.

### `PUT /api/admin/pricing-rules/:id`

Requires `ADMIN`. Accepts any subset of pricing-rule fields.

### `PATCH /api/admin/pricing-rules/:id/status`

Requires `ADMIN`.

Request:

```json
{
  "status": "INACTIVE"
}
```

## Booking APIs

All endpoints below require `Authorization: Bearer <accessToken>` and role `USER`.

Booking remains auto-approval:

```text
create hold -> PENDING_PAYMENT -> full payment success in payment module -> CONFIRMED
```

User booking APIs do not expose check-in. Check-in is reserved for Field Manager/Admin APIs in a later module.

### `POST /api/bookings`

Creates a temporary booking order hold in `PENDING_PAYMENT`. A booking order can contain one or more booking items. Each item is one court plus one time window. The hold expires at `holdExpiresAt = now + holdMinutes` from active booking rules.

Request:

```json
{
  "items": [
    {
      "courtId": "uuid",
      "startDatetime": "2026-05-21T08:00:00.000Z",
      "endDatetime": "2026-05-21T09:00:00.000Z"
    }
  ],
  "note": "Class training"
}
```

Validation:

- User account must be `ACTIVE`.
- User `bookingPermissionStatus` must be `ALLOWED`.
- Court must be `ACTIVE`.
- Every item must be in the future, inside `operating_hours`, and aligned to `slotDurationMinutes`.
- Every item must not exceed `maxDurationMinutes`, `maxBookingsPerDay`, or the priority advance window.
- Overlap is checked on `booking_items`.
- Active item statuses that occupy a slot: `PENDING_PAYMENT`, `PAYMENT_PROCESSING`, `CONFIRMED`, `IN_USE`.
- Create is all-or-nothing: if one item is invalid or conflicts, no order or item is created.

Response `201`:

```json
{
  "booking": {
    "id": "uuid",
    "bookingOrderId": "uuid",
    "bookingCode": "BK-20260520-ABC123",
    "bookingStatus": "PENDING_PAYMENT",
    "paymentStatus": "INITIATED",
    "totalAmount": 50000,
    "holdExpiresAt": "2026-05-20T00:10:00.000Z",
    "refundable": true,
    "items": [
      {
        "id": "uuid",
        "bookingItemId": "uuid",
        "startDatetime": "2026-05-21T08:00:00.000Z",
        "endDatetime": "2026-05-21T09:00:00.000Z",
        "unitPrice": 50000,
        "amount": 50000,
        "bookingStatus": "PENDING_PAYMENT",
        "court": {
          "id": "uuid",
          "courtName": "Main Field",
          "status": "ACTIVE"
        }
      }
    ],
    "statusHistories": [
      {
        "oldStatus": null,
        "newStatus": "PENDING_PAYMENT",
        "actionType": "USER_CREATE_BOOKING_ORDER_HOLD"
      }
    ]
  }
}
```

Common errors:

- `ACCOUNT_NOT_ACTIVE`
- `BOOKING_PERMISSION_RESTRICTED`
- `COURT_NOT_AVAILABLE`
- `OUTSIDE_OPERATING_HOURS`
- `BOOKING_DURATION_EXCEEDS_LIMIT`
- `ADVANCE_BOOKING_LIMIT_EXCEEDED`
- `MAX_BOOKINGS_PER_DAY_REACHED`
- `BOOKING_SLOT_UNAVAILABLE`
- `PRICING_RULE_NOT_FOUND`

### `GET /api/bookings/my`

Lists booking orders owned by the authenticated user.

Optional query params:

- `status`: any `BookingStatus`.
- `fromDate`: ISO datetime filter on item `startDatetime`.
- `toDate`: ISO datetime filter on item `startDatetime`.

Response `200`:

```json
{
  "bookings": [
    {
      "id": "uuid",
      "bookingOrderId": "uuid",
      "bookingCode": "BK-20260520-ABC123",
      "bookingStatus": "PENDING_PAYMENT",
      "paymentStatus": "INITIATED",
      "totalAmount": 50000,
      "holdExpiresAt": "2026-05-20T00:10:00.000Z",
      "items": []
    }
  ]
}
```

### `GET /api/bookings/:id`

Returns one owned booking order with items, order status history, item status history, payments, and refunds.

Response `200`:

```json
{
  "booking": {
    "id": "uuid",
    "bookingOrderId": "uuid",
    "bookingCode": "BK-20260520-ABC123",
    "bookingStatus": "PENDING_PAYMENT",
    "paymentStatus": "INITIATED",
    "items": [],
    "statusHistories": [],
    "payments": [],
    "refunds": []
  }
}
```

Users cannot view another user's booking order through this endpoint.

### `POST /api/bookings/:id/cancel`

Cancels an owned booking order when its status allows user cancellation.

Request:

```json
{
  "reason": "Schedule changed"
}
```

Rules:

- `PENDING_PAYMENT` can be cancelled without refund.
- `CONFIRMED` can be cancelled only before `cancelBeforeHours`, calculated from the earliest item start time.
- If a `CONFIRMED` order has a successful payment, the backend creates a whole-order `refunds` row with status `REQUESTED` using `refundRateUserOnTime`.
- `CHECKIN_EXPIRED` and `NO_SHOW` are not cancellable by user and do not create refunds.
- Every cancellation writes `booking_order_status_histories` and item histories for changed items.

Response `200`:

```json
{
  "booking": {
    "id": "uuid",
    "bookingOrderId": "uuid",
    "bookingStatus": "CANCELLED_BY_USER",
    "cancelReason": "Schedule changed",
    "cancelledAt": "2026-05-20T00:00:00.000Z",
    "statusHistories": [
      {
        "oldStatus": "PENDING_PAYMENT",
        "newStatus": "CANCELLED_BY_USER",
        "actionType": "USER_CANCEL_BOOKING_ORDER"
      }
    ]
  }
}
```

Common errors:

- `BOOKING_NOT_FOUND`
- `BOOKING_CANNOT_BE_CANCELLED`
- `BOOKING_CANCEL_WINDOW_CLOSED`

## Payment APIs

These APIs implement a mock/sandbox payment flow for MVP. They do not integrate a real payment gateway yet.

### `POST /api/bookings/:id/payments`

Requires `Authorization: Bearer <accessToken>` and role `USER`. `:id` is the `bookingOrderId`; only the booking order owner can create a payment.

Creates or returns a mock payment for a booking order that is still payable. Creating payment moves the order and pending items from `PENDING_PAYMENT` to `PAYMENT_PROCESSING`; the order/items are confirmed only after a successful callback.

Request:

```json
{
  "amount": 50000
}
```

Rules:

- Booking order must belong to the authenticated user.
- Booking order status must be `PENDING_PAYMENT` or `PAYMENT_PROCESSING`.
- Booking order hold must not be expired.
- `amount` must equal `bookingOrder.totalAmount`.
- No deposit flow exists; payment is always for 100% of the order total.

Response `201`:

```json
{
  "payment": {
    "id": "uuid",
    "amount": 50000,
    "paymentMethod": "MOCK",
    "gatewayTransactionId": "mock_uuid",
    "paymentStatus": "PROCESSING",
    "paymentUrl": "/mock-payment/mock_uuid",
    "bookingOrder": {
      "id": "uuid",
      "bookingOrderId": "uuid",
      "bookingCode": "BK-20260520-ABC123",
      "bookingStatus": "PAYMENT_PROCESSING",
      "paymentStatus": "PROCESSING",
      "totalAmount": 50000,
      "items": []
    }
  }
}
```

Common errors:

- `BOOKING_NOT_FOUND`
- `BOOKING_NOT_PAYABLE`
- `BOOKING_HOLD_EXPIRED`
- `PAYMENT_AMOUNT_MISMATCH`

### `POST /api/payments/callback/mock`

Public mock callback endpoint. The request must include a valid mock signature generated from `MOCK_PAYMENT_SECRET`.

Signature payload:

```text
HMAC_SHA256(secret, "<gatewayTransactionId>:<status>")
```

Request:

```json
{
  "gatewayTransactionId": "mock_uuid",
  "status": "SUCCESS",
  "signature": "<hex-signature>"
}
```

Allowed callback statuses: `SUCCESS`, `FAILED`, `CANCELLED`, `EXPIRED`.

Success behavior:

- Payment changes to `SUCCESS`.
- `paidAt` is set.
- Booking order changes from `PENDING_PAYMENT` or `PAYMENT_PROCESSING` to `CONFIRMED`.
- All pending/payment-processing booking items on the order change to `CONFIRMED`.
- Booking order `paymentStatus` changes to `SUCCESS`.
- `booking_order_status_histories` and `booking_item_status_histories` records are created with:
  - `actionType = PAYMENT_SUCCESS_CONFIRM_BOOKING`
  - `note = Thanh toan thanh cong, booking order duoc xac nhan`

Idempotency:

- Repeating a `SUCCESS` callback for an already successful payment returns the current payment and does not create duplicate order/item history rows.
- Terminal payments `FAILED`, `CANCELLED`, or `EXPIRED` cannot be switched to a different terminal status by a later callback.
- If a success callback arrives after `holdExpiresAt`, the backend does not confirm the order; it marks the payment/order/items as expired.

Failed/cancelled behavior:

- Payment status changes to the callback status.
- Booking order is not confirmed.
- If callback status is `EXPIRED` or the hold is already expired, order/items change to `PAYMENT_EXPIRED` and history is written.
- Notifications are not emitted yet; this is deferred to the Notifications module.

Common errors:

- `INVALID_PAYMENT_SIGNATURE`
- `PAYMENT_NOT_FOUND`
- `PAYMENT_ALREADY_TERMINAL`

### `GET /api/payments/:id`

Requires `Authorization: Bearer <accessToken>`. Payment owner or `ADMIN` can view the payment.

Response `200`:

```json
{
  "payment": {
    "id": "uuid",
    "amount": 50000,
    "paymentMethod": "MOCK",
    "gatewayTransactionId": "mock_uuid",
    "paymentStatus": "SUCCESS",
    "paidAt": "2026-05-20T00:00:00.000Z",
    "bookingOrder": {
      "id": "uuid",
      "bookingOrderId": "uuid",
      "bookingCode": "BK-20260520-ABC123",
      "bookingStatus": "CONFIRMED",
      "paymentStatus": "SUCCESS"
    }
  }
}
```

### `GET /api/admin/payments`

Requires `Authorization: Bearer <accessToken>` and `ADMIN`.

Optional query params:

- `status`: any `PaymentStatus`.
- `fromDate`: ISO datetime filter on `createdAt`.
- `toDate`: ISO datetime filter on `createdAt`.
- `bookingCode`: partial booking code search.
- `userId`: exact user ID.

Response `200`:

```json
{
  "payments": [
    {
      "id": "uuid",
      "amount": 50000,
      "paymentMethod": "MOCK",
      "paymentStatus": "SUCCESS",
      "bookingOrder": {
        "id": "uuid",
        "bookingOrderId": "uuid",
        "bookingCode": "BK-20260520-ABC123"
      },
      "user": {
        "id": "uuid",
        "fullName": "Nguyen Van A",
        "email": "user@example.com"
      }
    }
  ]
}
```

## Refund & Cancellation APIs

These APIs implement mock/sandbox refund processing for MVP. They do not integrate a real refund gateway yet.

Refund invariants:

- Refunds are only created from `PaymentStatus.SUCCESS`.
- `CHECKIN_EXPIRED` and `NO_SHOW` never create refunds.
- User on-time cancellation uses `refundRateUserOnTime`.
- Manager/Admin cancellation due to court issue uses `refundRateManagerFault`, defaulting to `100`.
- Duplicate active/success refunds for the same booking order/payment/item scope are not created.
- Refunds store `bookingOrderId` and optional `bookingItemId` to support whole-order or partial-item refunds.
- Manager/Admin cancellation writes `booking_order_status_histories`, `booking_item_status_histories`, and `audit_logs`.
- Admin retry/manual refund handling writes `audit_logs`.

### `GET /api/admin/refunds`

Requires `Authorization: Bearer <accessToken>` and `ADMIN`.

Optional query params:

- `refundStatus`: any `RefundStatus`.
- `fromDate`: ISO datetime filter on `requestedAt`.
- `toDate`: ISO datetime filter on `requestedAt`.
- `bookingCode`: partial booking code search.
- `userId`: exact booking owner user ID.
- `paymentId`: exact payment ID.

Response `200`:

```json
{
  "refunds": [
    {
      "id": "uuid",
      "paymentId": "uuid",
      "bookingOrderId": "uuid",
      "bookingItemId": null,
      "refundAmount": 50000,
      "refundReason": "Court maintenance",
      "refundStatus": "REQUESTED",
      "gatewayRefundId": null,
      "requestedAt": "2026-05-20T00:00:00.000Z",
      "processedAt": null,
      "payment": {
        "id": "uuid",
        "amount": 50000,
        "paymentStatus": "SUCCESS",
        "paidAt": "2026-05-20T00:00:00.000Z"
      },
      "bookingOrder": {
        "id": "uuid",
        "bookingOrderId": "uuid",
        "bookingCode": "BK-20260520-ABC123",
        "bookingStatus": "CANCELLED_BY_MANAGER",
        "paymentStatus": "SUCCESS",
        "items": []
      },
      "bookingItem": null
    }
  ]
}
```

### `GET /api/admin/refunds/:id`

Requires `Authorization: Bearer <accessToken>` and `ADMIN`.

Returns one refund with payment, booking order, optional booking item, requester, and processor summary.

Common errors:

- `REFUND_NOT_FOUND`

### `POST /api/admin/refunds/:id/retry`

Requires `Authorization: Bearer <accessToken>` and `ADMIN`.

Retries or processes a mock refund. Only `REQUESTED`, `FAILED`, and `MANUAL_REVIEW` refunds are retryable.

Request:

```json
{
  "mockResult": "SUCCESS",
  "reason": "Manual retry after gateway timeout"
}
```

`mockResult` is optional and defaults to `SUCCESS`. Allowed values are `SUCCESS`, `FAILED`, and `MANUAL_REVIEW`.

Success behavior:

- `refundStatus` becomes `SUCCESS`.
- `processedAt` is set.
- `processedByUserId` is set to the admin actor.
- `gatewayRefundId` is set by the mock gateway.
- `audit_logs` receives `ADMIN_RETRY_REFUND` and final refund status action.

Failed/manual-review behavior:

- `refundStatus` becomes `FAILED` or `MANUAL_REVIEW`.
- `processedByUserId` is set to the admin actor.
- `audit_logs` receives `ADMIN_RETRY_REFUND` and final refund status action.

Common errors:

- `REFUND_NOT_FOUND`
- `REFUND_NOT_RETRYABLE`

### `POST /api/manager/bookings/:id/cancel`

Requires `Authorization: Bearer <accessToken>` and role `FIELD_MANAGER` or `ADMIN`.

Cancels a `CONFIRMED` or `IN_USE` booking order due to court issue, maintenance, incident, or system/operator fault. This endpoint is not a generic manual approval flow.

Request:

```json
{
  "reason": "Court maintenance"
}
```

Rules:

- `FIELD_MANAGER` changes the order and cancellable items to `CANCELLED_BY_MANAGER`.
- `ADMIN` changes the order and cancellable items to `CANCELLED_BY_ADMIN`.
- `COMPLETED`, `NO_SHOW`, `CHECKIN_EXPIRED`, `PAYMENT_EXPIRED`, and already-cancelled orders cannot be cancelled here.
- If a successful payment exists, the backend creates a `refunds` row with `REQUESTED` status using `refundRateManagerFault`.
- If there is no successful payment, cancellation still succeeds but no refund is created.
- Every status change writes order and item status history.
- The cancellation writes `audit_logs`.

Response `200`:

```json
{
  "bookingOrder": {
    "id": "uuid",
    "bookingOrderId": "uuid",
    "bookingCode": "BK-20260520-ABC123",
    "bookingStatus": "CANCELLED_BY_MANAGER",
    "paymentStatus": "SUCCESS",
    "cancelReason": "Court maintenance",
    "cancelledByUserId": "uuid",
    "cancelledAt": "2026-05-20T00:00:00.000Z",
    "refundable": true,
    "items": []
  },
  "refund": {
    "id": "uuid",
    "paymentId": "uuid",
    "bookingOrderId": "uuid",
    "bookingItemId": null,
    "refundAmount": 50000,
    "refundStatus": "REQUESTED"
  }
}
```

Common errors:

- `BOOKING_NOT_FOUND`
- `BOOKING_CANNOT_BE_CANCELLED_BY_MANAGER`

## Database Contract Baseline

The MVP database uses PostgreSQL through Prisma.

Conventions:

- Database tables and columns use `snake_case`.
- Prisma models use `PascalCase`.
- Prisma fields use `camelCase`.
- RBAC uses `roles` and `user_roles`; `users` must not contain a role enum/source-of-truth field.

Baseline tables:

```text
users
priority_groups
roles
user_roles
court_types
courts
operating_hours
pricing_rules
booking_rules
priority_policies
booking_orders
booking_items
payments
refunds
booking_order_status_histories
booking_item_status_histories
court_status_histories
violations
notifications
waitlist_entries
system_settings
audit_logs
```

Booking invariants:

- `booking_orders` represents the overall order and stores total amount, payment status, hold expiry, cancellation fields, and order-level status.
- `booking_items` represents one court plus one time window and stores `start_datetime`, `end_datetime`, price, amount, item status, check-in/completion/no-show actor fields, and item histories.
- `booking_items` uses `start_datetime` and `end_datetime`; there is no separate `booking_date`.
- `courts` no longer stores `location` or `capacity`.
- `refunds.payment_id` is required.
- `refunds.booking_order_id` is required and `refunds.booking_item_id` is optional for partial refunds.
- `violations.booking_item_id` is optional but relational.
- `notifications.booking_order_id` and `notifications.booking_item_id` are optional but relational.
- Booking order cancellation actor FK and booking item check-in/completion/no-show actor FKs are present.
- PostgreSQL migration includes `no_overlapping_active_booking_items` on `booking_items` for active statuses: `PENDING_PAYMENT`, `PAYMENT_PROCESSING`, `CONFIRMED`, `IN_USE`.
- `waitlist_entries.expires_at` exists for waitlist expiration.

Config tables:

- `booking_rules` stores configurable hold/cancel/check-in/refund/violation defaults.
- `priority_groups` stores unique `group_code`, rank, and advance-booking defaults.
- `priority_policies` stores priority-level policy per priority group, including waitlist eligibility.
- `system_settings` remains available for key-value settings needed by later modules.
