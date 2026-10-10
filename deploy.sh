#!/bin/sh
# Actualiza el servidor con lo último de GitHub y reconstruye los contenedores.
# Uso (en la VM, dentro de la carpeta del proyecto):  ./deploy.sh [rama]
set -e
BRANCH="${1:-main}"

echo "→ Descargando cambios de origin/$BRANCH"
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "→ Ejecutando pruebas del backend"
docker compose --profile test build backend-test
docker compose --profile test run --rm backend-test

echo "→ Reconstruyendo y reiniciando la app"
docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null

docker compose ps
echo "✔ Despliegue completado"
