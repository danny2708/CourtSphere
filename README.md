# CourtSphere

School sports court booking system.

## Backend Foundation

The backend lives in `backend/` and currently contains the Express + TypeScript foundation for later modules.

Runtime choices:

- Node.js: `>=20`
- Express: `5.x`
- Prisma: `6.x` (`6.19.3` resolved in `package-lock.json`)
- TypeScript: `6.x`
- Tests: Vitest + Supertest
- Validation: Zod

Prisma is intentionally pinned to major `6` for stable compatibility with the current `schema.prisma` workflow in the project spec. Prisma `7.x` is not used in this foundation module.

## Run With Docker

The repository includes Docker setup for PostgreSQL, backend, and frontend.

Requirements:

- Docker Desktop or Docker Engine with Compose support

Start the full stack:

```bash
docker compose up --build
```

Services:

| Service | URL |
| --- | --- |
| Frontend | `http://localhost:5173` |
| Backend API | `http://localhost:3000` |
| Swagger UI | `http://localhost:3000/api-docs` |
| OpenAPI JSON | `http://localhost:3000/openapi.json` |
| PostgreSQL | `localhost:5432` |

On startup, the backend container waits for PostgreSQL, then runs:

```bash
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

This means teammates can run the project with seed data without manually creating the database. The seed is idempotent, so restarting the stack is safe.

Useful Docker commands:

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose down
docker compose down -v
```

Use `docker compose down -v` only when you want to delete the Docker PostgreSQL data volume and start from a fresh seeded database.

Docker environment defaults:

- Backend container uses `DATABASE_URL=postgresql://postgres:123456@postgres:5432/courtsphere?schema=public`.
- Frontend container uses `VITE_API_BASE_URL=http://localhost:3000`.
- Uploaded court images are stored in the `courtsphere_uploads` Docker volume and served from `http://localhost:3000/uploads/...`.

### Commands

```bash
cd backend
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

Prisma checks:

```bash
cd backend
npx prisma format
npx prisma generate
```

### Local PostgreSQL

If PostgreSQL is not already running locally, start one with Docker:

```bash
docker run --name courtsphere-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=courtsphere \
  -p 5432:5432 \
  -d postgres:16-alpine
```

On Windows PowerShell:

```powershell
docker run --name courtsphere-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=courtsphere `
  -p 5432:5432 `
  -d postgres:16-alpine
```

Then apply migrations and seed operational test data:

```bash
cd backend
copy .env.example .env
npx prisma migrate deploy
npx prisma db seed
```

The seed is idempotent and creates a realistic local operations dataset for frontend/manual testing:

- users/roles/priority groups
- court types, courts, operating hours, pricing rules
- booking orders/items across pending payment, processing, confirmed, in-use, completed, cancelled, expired, check-in expired, and no-show states
- payments, refunds, status histories, court status histories, waitlist entries, notifications, violations, system settings, and audit logs

Seed login accounts all use password `Password123!`:

| Role | Email |
| --- | --- |
| ADMIN | `admin@courtsphere.local` |
| FIELD_MANAGER | `manager@courtsphere.local` |
| USER | `user@courtsphere.local` |
| USER / STAFF priority | `staff@courtsphere.local` |
| USER / EXTERNAL priority | `external@courtsphere.local` |
| USER with late-cancel violation | `late.user@courtsphere.local` |
| USER with restricted booking permission | `restricted@courtsphere.local` |

Frontend court/availability/booking/manager screens are real API only. Payment remains a sandbox/mock gateway flow through the backend callback endpoint.

To run locally:

```bash
cd backend
copy .env.example .env
npm run dev
```

Auth uses stateless JWT access tokens. Set `JWT_ACCESS_SECRET` to a strong secret in `.env`; the `.env.example` value is only for local development.

Health check:

```bash
curl http://localhost:3000/health
```

### Swagger / OpenAPI

After starting the backend, open the interactive Swagger UI:

```text
http://localhost:3000/api-docs
```

The raw OpenAPI JSON contract is available at:

```text
http://localhost:3000/openapi.json
```

Swagger supports Bearer JWT authentication. Use the `Authorize` button and enter:

```text
Bearer <accessToken>
```
