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

Then apply migrations and seed sample data:

```bash
cd backend
copy .env.example .env
npx prisma migrate deploy
npx prisma db seed
```

To run locally:

```bash
cd backend
copy .env.example .env
npm run dev
```

Health check:

```bash
curl http://localhost:3000/health
```
