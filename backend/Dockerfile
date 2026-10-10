# ---------- Dependencias completas (incluye las de pruebas) ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- Imagen para ejecutar las pruebas (docker compose --profile test) ----------
FROM deps AS test
COPY . .
CMD ["npm", "test"]

# ---------- Imagen de producción ----------
FROM node:22-alpine AS prod
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY . .
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node
EXPOSE 4000
# Aplica migraciones pendientes y sincroniza roles/permisos antes de arrancar.
CMD ["sh", "-c", "node database/migrate.js && node database/seed.js && node server.js"]
