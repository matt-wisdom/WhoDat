# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine

WORKDIR /app

# Runtime deps only
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Directory for the SQLite database (mount a volume here)
RUN mkdir -p /app/data

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/app/data/game.db

CMD ["node", "dist/index.js"]
