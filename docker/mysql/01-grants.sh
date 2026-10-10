#!/bin/sh
# Solo se ejecuta la primera vez que se crea el volumen de MySQL.
# Permite al usuario de la app crear/usar tickets_per y tickets_per_test (pruebas).
mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}%\`.* TO '${MYSQL_USER}'@'%'; FLUSH PRIVILEGES;"
