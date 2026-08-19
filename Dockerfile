FROM node:20-bookworm-slim AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm install

COPY shared ./shared
COPY server ./server
COPY client ./client

RUN npm run build -w shared && npm run build -w client && npm run build -w server

FROM node:20-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
ENV DATABASE_PATH=/app/data/localchat.db

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/client/dist ./client/dist

RUN mkdir -p /app/data

EXPOSE 3001
CMD ["node", "server/dist/index.js"]
