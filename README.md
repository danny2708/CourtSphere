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
