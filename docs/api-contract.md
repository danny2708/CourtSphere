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
