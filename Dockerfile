# ─────────────────────────────────────────────────────────────────────────────
# Asistente de IA para Publicar Repositorios — Multi-stage Dockerfile
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build the React frontend ────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install client dependencies first (layer cache optimization)
COPY client/package*.json client/
RUN cd client && npm ci

# Copy client source and build
COPY client/ client/
RUN cd client && npm run build

# ── Stage 2: Production Express server ───────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install only production dependencies (--omit=dev replaces deprecated --production)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy Express server
COPY server/ server/

# Copy built frontend from Stage 1
COPY --from=builder /app/client/dist client/dist

# Cloud Run expects the container to listen on $PORT (defaults to 8080)
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "server/index.js"]
