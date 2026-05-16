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
