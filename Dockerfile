# ─────────────────────────────────────────────────────────────────────────────
# Asistente de IA para Publicar Repositorios — Multi-stage Dockerfile
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build the React frontend ────────────────────────────────────────
# Node 22 (≥22.13) es obligatorio: pdfjs-dist@6 declara engines ">=22.13.0 || >=24".
# Con node:20 npm OMITE pdfjs-dist (es optionalDependency) y luego `tsc` falla con
# "Cannot find module 'pdfjs-dist'". Mantener alineado con CI (Node 24) y local.
FROM node:22-alpine AS builder

WORKDIR /app

# Install client dependencies first (layer cache optimization)
COPY client/package*.json client/
RUN cd client && npm ci

# Copy client source and build
COPY client/ client/
RUN cd client && npm run build

# ── Stage 2: Production Express server ───────────────────────────────────────
# Misma versión de Node que el builder (coherencia; el server solo necesita ≥20).
FROM node:22-alpine AS production

WORKDIR /app

# 🔥 FIX: Usar npm install en lugar de npm ci para tolerar desincronizaciones
# del package-lock.json (faltaba express-rate-limit@7.5.1)
COPY package*.json ./
RUN npm install --omit=dev

# Copy Express server
COPY server/ server/

# Copy built frontend from Stage 1
COPY --from=builder /app/client/dist client/dist

# Cloud Run asignates a dynamic $PORT at runtime; do NOT hardcode it here.
ENV NODE_ENV=production

EXPOSE 8080

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "server/index.js"]
