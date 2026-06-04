FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY src ./src
COPY eslint.config.js prisma.config.ts tsconfig.json vitest.config.ts ./

RUN mkdir -p uploads/images \
  && npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "dev"]
