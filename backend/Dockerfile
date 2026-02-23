# ---- Build stage ----
# Use slim (Debian-based) for glibc compatibility with onnxruntime-node native bindings
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ---- Runtime stage ----
# Must stay on Debian/glibc — alpine (musl) lacks ld-linux-x86-64.so.2
# which is required by the onnxruntime-node native .so files.
FROM node:20-slim

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
