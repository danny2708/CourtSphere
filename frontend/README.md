# CourtSphere Frontend

React + TypeScript frontend foundation for CourtSphere.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

The API base URL is read from `VITE_API_BASE_URL`. For local backend development, copy `.env.example` to `.env`.

The court, availability, booking, manager, admin, and reports screens expect the backend API and database seed to be running. Frontend mock court/booking/manager fallback data has been removed for real operations testing. Payment still uses the backend sandbox/mock payment callback flow.

The Vite dev server is configured for `127.0.0.1:5173` with `strictPort: true`. If port `5173` is already in use, stop the existing dev server instead of letting Vite move to another port.
