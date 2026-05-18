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

Lists courts. Supports optional filters: `keyword`, `courtTypeId`, `status`, `location`.

Response `200`:

```json
{
  "courts": [
    {
      "id": "uuid",
      "courtName": "Main Field",
      "location": "North Campus",
      "capacity": 22,
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
    "location": "North Campus",
    "capacity": 22,
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
    "location": "North Campus",
    "capacity": 22,
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
      "bookingId": "uuid",
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
  "location": "North Campus",
  "capacity": 22,
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
bookings
payments
refunds
booking_status_histories
court_status_histories
violations
notifications
waitlist_entries
system_settings
audit_logs
```

Booking invariants:

- `bookings` uses `start_datetime` and `end_datetime`; there is no separate `booking_date`.
- `refunds.payment_id` is required.
- `violations.booking_id` and `notifications.booking_id` are optional but relational.
- Booking action user FKs are present for cancellation, check-in, completion, and no-show marking.
- PostgreSQL migration includes `no_overlapping_active_bookings` for active booking statuses: `PENDING_PAYMENT`, `PAYMENT_PROCESSING`, `CONFIRMED`, `IN_USE`.

Config tables:

- `booking_rules` stores configurable hold/cancel/check-in/refund/violation defaults.
- `priority_policies` stores priority-level policy per priority group.
- `system_settings` remains available for key-value settings needed by later modules.
