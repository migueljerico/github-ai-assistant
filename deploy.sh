#!/usr/bin/env bash
# deploy.sh — Despliegue manual validado a Cloud Run (#25-parte3, v3.41.0).
#
# Alternativa al deploy manual "gcloud run deploy ..." (ver MANUAL_TECNICO.md:483):
# valida que las 3 variables críticas estén presentes ANTES de desplegar, para no
# subir una revisión rota (OAuth caído / sesión sin firmar). NO sustituye al CD
# automático (Cloud Build trigger en cada push a main): es para deploys puntuales,
# rollbacks o cuando quieras desplegar sin pasar por main.
#
# Uso:  ./deploy.sh        (o:  npm run deploy)
# Las vars se leen de .env si existe (las ya exportadas en el shell tienen prioridad).
# Requiere: gcloud autenticado + proyecto activo con permisos de Cloud Run.

set -euo pipefail

SERVICE="github-ai-assistant"
REGION="us-central1"
REQUIRED_VARS=("GITHUB_CLIENT_ID" "GITHUB_CLIENT_SECRET" "SESSION_SECRET")

# ── Cargar .env si existe (vars del shell ya exportadas tienen prioridad) ──────
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
else
  echo "⚠️  No se encontró .env." >&2
  echo "   Crea uno a partir de .env.example:  cp .env.example .env" >&2
  echo "   (O exporta las variables en el shell antes de ejecutar este script.)" >&2
fi

# ── Validación previa: las 3 variables críticas deben estar presentes ─────────
echo "▶ Validando variables críticas..."
missing=()
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    missing+=("$var")
  fi
done

if (( ${#missing[@]} > 0 )); then
  echo "" >&2
  echo "❌ Faltan variables críticas: ${missing[*]}" >&2
  echo "   El servicio arrancaría en estado roto (OAuth caído o sesión sin firmar)." >&2
  echo "   Abortando deploy. Define las variables en .env o expórtalas en el shell." >&2
  exit 1
fi
echo "✅ Las 3 variables críticas están presentes."

# ── Confirmación (default NO: un deploy es acción de producción) ───────────────
echo ""
echo "Esto desplegará a Cloud Run:"
echo "   Servicio:  $SERVICE"
echo "   Región:    $REGION"
echo "   Origen:    --source . (directorio actual)"
read -r -p "¿Continuar? [s/N] " reply
if [[ ! "$reply" =~ ^[sS]$ ]]; then
  echo "Deploy cancelado por el usuario."
  exit 0
fi

# ── Deploy (mismo comando documentado en MANUAL_TECNICO.md) ───────────────────
# --timeout 600: la documentación completa de repos permite llamadas IA de hasta
# 600s (gemini.ts); con el default de Cloud Run (300s) la plataforma corta la
# petición con 504 antes de que los modelos lentos terminen.
echo ""
echo "▶ Desplegando a Cloud Run..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --timeout 600 \
  --allow-unauthenticated

echo ""
echo "✅ Deploy completado. Verifica con:"
echo "   gcloud run services describe $SERVICE --region $REGION --format='value(status.url)'"
