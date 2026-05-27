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

The Vite dev server is configured for `127.0.0.1:5173` with `strictPort: true`. If port `5173` is already in use, stop the existing dev server instead of letting Vite move to another port.
