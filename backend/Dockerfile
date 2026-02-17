FROM node:20-bookworm-slim

WORKDIR /app

ENV PRISMA_CLIENT_ENGINE_TYPE=binary

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci --include=dev

COPY tsconfig.json ./
COPY src ./src

RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production

EXPOSE 4000

CMD ["node", "dist/index.js"]
