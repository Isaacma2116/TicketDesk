# Despliegue con Docker en la VM

Arquitectura (3 contenedores, un solo puerto expuesto):

```
navegador ──► :8080 frontend (nginx + React compilado)
                      └── /api/* ──► backend (Node :4000) ──► db (MySQL 8.4)
```

- Las migraciones y el seed de roles/permisos se aplican solos cada vez que arranca el backend.
- Los datos viven en volúmenes Docker (`db_data`, `uploads`): sobreviven a reconstrucciones y actualizaciones.

## 1. Primera instalación en la VM

```bash
# Requisitos: git, docker y el plugin docker compose
git clone https://github.com/Isaacma2116/TicketDesk.git
cd TicketDesk
cp .env.example .env
nano .env        # rellena contraseñas, SESSION_SECRET (openssl rand -base64 48) y CORS_ORIGINS
chmod +x deploy.sh

docker compose up -d --build
docker compose ps                      # los 3 servicios deben estar "healthy"/"running"
docker compose logs -f backend         # ver migraciones y arranque (Ctrl+C para salir)

# Crear el primer superadministrador (usa SUPERADMIN_* del .env)
docker compose exec backend npm run create-superadmin
```

Abre `http://IP_DE_LA_VM:8080`. **`CORS_ORIGINS` debe ser exactamente esa URL**, o el login fallará con
"Origen de la petición no permitido". Si cambias `.env`: `docker compose up -d`.

Si el repositorio es privado, en la VM usa un *Personal Access Token* de GitHub como contraseña al clonar,
o configura una *deploy key* SSH (Settings → Deploy keys) y clona con `git@github.com:Isaacma2116/TicketDesk.git`.

## 2. Flujo de trabajo para actualizar

En tu PC:

```bash
git add .
git commit -m "Describe el cambio"
git push
```

En la VM:

```bash
cd TicketDesk
./deploy.sh            # git pull + pruebas + reconstruir y reiniciar
```

`deploy.sh` se detiene si las pruebas fallan, dejando la versión anterior funcionando.

Para probar una rama sin tocar `main`: `./deploy.sh nombre-de-rama`.

## 3. Pruebas

```bash
docker compose --profile test run --rm backend-test   # usa la BD tickets_per_test, no toca la real
```

## 4. Comandos útiles

| Acción | Comando |
|---|---|
| Ver estado | `docker compose ps` |
| Logs | `docker compose logs -f backend` (o `frontend`, `db`) |
| Reiniciar | `docker compose restart backend` |
| Apagar todo (conserva datos) | `docker compose down` |
| Consola MySQL | `docker compose exec db mysql -u tickets -p tickets_per` |
| Respaldo BD | `docker compose exec db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" tickets_per' > respaldo_$(date +%F).sql` |
| Restaurar BD | `docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" tickets_per' < respaldo.sql` |

> ⚠ `docker compose down -v` **borra la base de datos** y los archivos subidos.

## 5. Importar datos existentes (opcional)

Si quieres llevar la BD de tu PC a la VM: exporta con `mysqldump tickets_per > datos.sql`, cópialo a la VM
(`scp datos.sql usuario@IP:~/TicketDesk/`) y usa el comando "Restaurar BD" de la tabla.

## 6. HTTPS (más adelante)

Cuando tengas dominio y certificado (p. ej. con un proxy Nginx/Caddy delante), cambia en `.env`
`COOKIE_SECURE=true` y `CORS_ORIGINS=https://tu-dominio`, y ejecuta `docker compose up -d`.
