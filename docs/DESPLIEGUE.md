# Despliegue en el VPS

Esta guía asume un VPS limpio con Ubuntu/Debian, acceso `sudo` y un dominio
que ya apunta por DNS a la IP del servidor. Cada bloque de comandos se puede
copiar y pegar tal cual, remplazando solo lo que esté escrito en MAYÚSCULAS.

## Primera vez

1. Instalar Docker, Docker Compose, Node.js 22.x, npm, nginx y certbot en el
   servidor. `npm run db:migrate`, `npm run db:seed` y el cron de
   mantenimiento corren con el Node.js del servidor, no dentro de Docker, así
   que hace falta instalarlo aunque la aplicación viva en un contenedor.

   Confirmar que el firewall del servidor deja pasar los puertos 80 y 443
   (por ejemplo, con `sudo ufw allow 80,443/tcp` si usa `ufw`); si no, nginx
   nunca va a recibir tráfico externo y certbot va a fallar más adelante.

2. Clonar el repositorio y crear el archivo de entorno:

```bash
cp .env.example .env
```

Generar los tres secretos:

```bash
openssl rand -base64 32   # copiar como IP_HASH_SECRET
openssl rand -base64 32   # copiar como ADMIN_TOKEN
openssl rand -base64 32   # copiar como ADMIN_COOKIE_SECRET
```

Abrir `.env` y completar, con la salida de cada comando anterior:

```
IP_HASH_SECRET=<salida del primer comando>
ADMIN_TOKEN=<salida del segundo comando>
ADMIN_COOKIE_SECRET=<salida del tercer comando>
```

Completar también en `.env`:

- `NEXT_PUBLIC_SITE_URL`: la URL pública final, por ejemplo
  `https://TU_DOMINIO` (con `https`, sin barra al final). Los enlaces de
  gestión que reciben las personas por WhatsApp se arman con este valor.
- `DATABASE_URL`: la cadena de conexión al Postgres de producción ya
  existente, con el formato
  `postgres://USUARIO:CLAVE@HOST:5432/NOMBRE_BASE`.

  **Si la clave del Postgres tiene caracteres especiales (`+`, `/`, `@`, `:`,
  `#`, `%`, `?`, `=`), hay que codificarlos en formato URL antes de pegarlos
  en `DATABASE_URL`, o el driver corta la clave en el carácter especial y la
  conexión falla.** Para codificar la clave, ejecutar:

  ```bash
  node -e "console.log(encodeURIComponent('LA_CLAVE_REAL'))"
  ```

  y usar esa salida (por ejemplo, una clave `Ab+c/d` se convierte en
  `Ab%2Bc%2Fd`) dentro de `DATABASE_URL`, no la clave sin codificar.

  Si el Postgres corre en el mismo host que Docker, usar
  `host.docker.internal` o la IP del puente de Docker como `HOST`, nunca
  `localhost` (dentro del contenedor `localhost` apunta al propio
  contenedor, no al servidor).

3. Crear la base y aplicar el esquema (esto corre con el Node.js del
   servidor, fuera de Docker):

```bash
npm ci
npm run db:migrate
npm run db:seed
```

Si `db:migrate` falla con un error de conexión, revisar primero que
`DATABASE_URL` en `.env` tenga la clave codificada como se explicó arriba y
que el Postgres acepte conexiones desde este servidor.

4. Levantar la aplicación:

```bash
docker compose up -d --build
```

Confirmar que quedó arriba:

```bash
docker compose ps
```

Debe mostrar el servicio `app` como `running`. Si no, ver los registros:

```bash
docker compose logs -f app
```

5. Configurar nginx y el certificado. Primero, remplazar `DOMINIO` por el
   dominio real dentro del archivo de configuración:

```bash
sed -i "s/DOMINIO/TU_DOMINIO/" nginx/reporta-cali.conf
```

Luego instalarlo:

```bash
sudo cp nginx/reporta-cali.conf /etc/nginx/sites-available/reporta-cali
sudo ln -s /etc/nginx/sites-available/reporta-cali /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d TU_DOMINIO
```

Si `certbot` falla, lo más común es que el DNS de `TU_DOMINIO` todavía no
apunte a la IP de este servidor; comprobarlo con `dig TU_DOMINIO` antes de
reintentar.

### Comprobación de seguridad obligatoria

No continuar al siguiente paso sin correr estos tres comandos. Verifican las
protecciones de las que depende el límite de tasa que protege los números de
teléfono de las personas que pidieron ayuda.

Si alguna falla, cualquiera podría recolectar esos teléfonos enviando una
cabecera distinta en cada petición. Es exactamente el material con el que
operan las campañas de estafa tras cada desastre, así que estas
comprobaciones no son opcionales:

```bash
sudo ss -tlnp | grep 3000
```

La salida debe mostrar únicamente `127.0.0.1:3000`. Si en cambio aparece
`0.0.0.0:3000` o `:::3000`, la aplicación quedó expuesta directamente a
internet sin pasar por nginx: revisar que `docker-compose.yml` no haya sido
modificado y que el mapeo de puertos siga siendo
`"127.0.0.1:3000:3000"`, y volver a hacer `docker compose up -d --build`.

```bash
sudo nginx -T 2>/dev/null | grep -n "X-Real-IP"
```

La salida debe incluir la línea
`proxy_set_header X-Real-IP $remote_addr;` — si aparece en blanco, la
configuración de nginx que se instaló no es `nginx/reporta-cali.conf` o fue
editada sin esa línea: volver a copiarla desde el repositorio y repetir
`sudo nginx -t && sudo systemctl reload nginx`.

Los dos comandos anteriores comprueban la configuración. Este comprueba el
resultado, que es lo que de verdad importa. **Ejecutarlo desde otra máquina**,
no desde el servidor, sustituyendo por la IP pública del VPS:

```bash
curl -m 5 -s -o /dev/null -w '%{http_code}\n' http://IP_DEL_SERVIDOR:3000/
```

Debe fallar por tiempo de espera o conexión rechazada, sin devolver ningún
código de respuesta. Si devuelve `200`, la aplicación está accesible sin pasar
por nginx pese a lo que digan los comandos anteriores —normalmente por una
regla de cortafuegos o por Docker publicando en otra interfaz—, y **hay que
corregirlo antes de anunciar la plataforma**.

6. Programar el mantenimiento diario:

```bash
crontab -e
```

Añadir, para que corra a las 3 de la mañana (remplazar `/ruta/al/proyecto`
por la ruta real donde se clonó el repositorio):

```
0 3 * * * cd /ruta/al/proyecto && /usr/bin/npm run maintenance >> /var/log/reporta-cali-mantenimiento.log 2>&1
```

Esta tarea es la que cumple la promesa de la política de privacidad de
anonimizar los datos personales de las solicitudes atendidas o canceladas
después de dos meses. Si no queda programada, esa promesa no se cumple.

## Actualizar

```bash
git pull
npm run db:migrate      # solo si hubo cambios de esquema
docker compose up -d --build
```

Si `docker compose up -d --build` falla, revisar `docker compose logs -f
app`; la versión anterior sigue corriendo hasta que la nueva construya con
éxito, así que un build fallido no tumba el sitio.

## Verificar que quedó bien

- `https://TU_DOMINIO` carga y muestra el listado.
- Crear una solicitud de prueba y borrarla con su enlace de gestión.
- `https://TU_DOMINIO/admin` pide clave.
- En los registros de nginx (`sudo tail /var/log/nginx/access.log`) aparecen
  IPs reales de visitantes, no `127.0.0.1`.
- `npm run maintenance` corre a mano sin errores.
- Los dos comandos de la comprobación de seguridad obligatoria (arriba) dan
  el resultado esperado.

## Cerrar la operación

Cuando la emergencia termine, la política de privacidad promete borrar toda
la base de datos. Este paso es irreversible y no tiene vuelta atrás: no hay
respaldo automático antes de correrlo, así que si se quiere conservar algo,
hay que exportarlo antes.

Parado en la carpeta del proyecto (donde está el `.env`):

```bash
docker compose down
export $(grep '^DATABASE_URL=' .env | xargs)
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```
