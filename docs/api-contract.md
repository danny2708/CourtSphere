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
