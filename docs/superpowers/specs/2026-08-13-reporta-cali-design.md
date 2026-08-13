# Reporta Cali — Diseño de la plataforma

**Fecha:** 2026-08-13
**Estado:** aprobado para implementación

## Contexto

Tras el terremoto del 10 de agosto de 2026, Cali quedó entre las ciudades más
afectadas, junto con Armenia, Pereira, Buenaventura y Quibdó. Existen numerosos
grupos de ayuda y centros de acopio recolectando
donaciones, pero operan desarticulados entre sí. Al mismo tiempo, hay personas
con necesidades concretas que nadie está atendiendo de forma estratégica.

La plataforma conecta ambos lados: quien necesita ayuda publica qué necesita y
dónde; quien puede ayudar lo ve en un mapa, lo contacta por WhatsApp y anuncia
que va en camino.

## Objetivo

Publicar en horas una aplicación web responsive donde:

1. Cualquier persona reporte una necesidad indicando su ciudad, con ubicación en
   mapa y lista de cosas requeridas, sin crear cuenta.
2. Los voluntarios vean las solicitudes de su ciudad como tarjetas y como puntos
   en un mapa.
3. Cada solicitud se pueda contactar por WhatsApp con un clic.
4. Las solicitudes cambien de estado hasta quedar atendidas.
5. Las notificaciones sean únicamente in-app (sin correo, sin SMTP).

## Criterios de éxito

- Una persona con celular de gama baja y datos móviles crea una solicitud en
  menos de dos minutos.
- Un voluntario encuentra las solicitudes cercanas y abre WhatsApp en dos clics.
- Una solicitud reclamada y abandonada vuelve sola a estar visible.
- Recolectar masivamente los números de WhatsApp exige esfuerzo deliberado: no
  basta con leer el HTML ni consultar la API del listado.

## Fuera de alcance

Centros de acopio y brigadas (fase 2), cuentas de usuario, notificaciones por
correo, fotos adjuntas, aplicación móvil nativa.

## Arquitectura

Aplicación Next.js (App Router, versión estable vigente al iniciar el proyecto)
full-stack: interfaz, Server Actions y rutas
de API en un mismo repositorio. Persistencia en el Postgres existente mediante
Drizzle ORM. Mapa con Leaflet + OpenStreetMap, sin llave de API ni cuotas.
Despliegue en el VPS de Contabo con Docker Compose y nginx.

Las notificaciones usan sondeo cada 30 segundos, no WebSockets: sobrevive a
reinicios de nginx y a redes móviles inestables, que es el escenario esperado
después de un sismo.

### Módulos

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| `db/schema` | Tablas y tipos Drizzle | — |
| `lib/requests` | Crear, listar, filtrar solicitudes | `db/schema` |
| `lib/claims` | Reclamar, cancelar y expirar claims | `db/schema` |
| `lib/events` | Registrar y leer el feed de actividad | `db/schema` |
| `lib/whatsapp` | Normalizar números y construir enlaces `wa.me` | — |
| `lib/ratelimit` | Límites por IP | `db/schema` |
| `lib/tokens` | Generar y verificar códigos de gestión | — |
| UI | Pantallas y componentes | los anteriores |

Cada módulo se prueba de forma aislada. Los componentes de servidor y las Server
Actions acceden a los datos únicamente a través de `lib/`; ninguna pantalla
escribe SQL ni consultas Drizzle por su cuenta.

## Modelo de datos

### `cities`

`id`, `slug`, `name`, `department`, `center_lat`, `center_lng`, `default_zoom`,
`is_active`, `position`.

Semilla inicial: Cali (Valle del Cauca), Armenia (Quindío), Pereira
(Risaralda), Quibdó (Chocó) y Buenaventura (Valle del Cauca).

Se modela como tabla y no como enum para poder habilitar una ciudad nueva con
un `INSERT`, sin cambiar código ni volver a desplegar.

### `requests`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | clave primaria |
| `city_id` | fk → `cities` | obligatorio |
| `public_code` | text | código corto único para la URL |
| `manage_token_hash` | text | hash del token de gestión |
| `title` | text | |
| `description` | text | opcional |
| `urgency` | enum | `alta` \| `media` \| `baja` |
| `status` | enum | `abierta` \| `en_atencion` \| `atendida` \| `cancelada` |
| `requester_name` | text | |
| `whatsapp` | text | formato E.164, nunca expuesto públicamente |
| `lat`, `lng` | double | |
| `address_text` | text | dirección o punto de referencia |
| `neighborhood` | text | barrio o comuna, opcional |
| `people_count` | int | personas afectadas, opcional |
| `ip_hash` | text | HMAC-SHA256 de la IP con secreto de entorno; para límite de tasa y moderación |
| `is_hidden` | bool | oculta por moderación |
| `created_at`, `updated_at`, `fulfilled_at` | timestamp | |

Índices: `public_code` y `(city_id, status, created_at)` para el listado
filtrado.

No se usa índice geoespacial. Tras filtrar por ciudad y estado, el conjunto es
de decenas o cientos de filas, y ordenar por distancia se resuelve calculándola
en la consulta. Un índice btree sobre `(lat, lng)` no aceleraría ese orden, y
PostGIS es complejidad que este volumen no justifica.

### `request_items`

`id`, `request_id`, `name`, `quantity` (texto libre: "5 litros", "3 cobijas"),
`position`. Tabla propia en vez de JSON para permitir filtros por artículo más
adelante sin migrar datos.

### `claims`

`id`, `request_id`, `volunteer_name`, `volunteer_whatsapp` (opcional),
`claim_token_hash`, `status` (`activo` \| `cancelado` \| `completado` \|
`vencido`), `created_at`, `expires_at`, `ip_hash`.

Solo puede existir un claim `activo` por solicitud (índice único parcial).

### `events`

`id`, `type` (`request_created` \| `request_claimed` \| `request_fulfilled`),
`request_id`, `city_id`, `payload` jsonb (título, barrio y ciudad, para
renderizar sin JOIN), `created_at`. Es la fuente del feed de notificaciones.
`city_id` se copia aquí para filtrar el feed sin unir con `requests`.

### `reports`

`id`, `request_id`, `reason`, `ip_hash`, `created_at`.

### `rate_limits`

`key` (clave primaria: `ip_hash` + acción + ventana), `count`, `window_start`.
Las filas con ventana vencida se borran de forma oportunista al escribir, para
que la tabla no crezca sin límite.

Todos los `ip_hash` de la aplicación se calculan como HMAC-SHA256 de la IP con
un secreto en variable de entorno. Un hash simple sería reversible: el espacio
IPv4 completo se recorre en minutos, de modo que guardar `sha256(ip)` equivale
a guardar la IP en claro.

## Flujos

### Crear una solicitud

Formulario en scroll único: ciudad, título, ítems (renglones que se añaden y
quitan), urgencia, ubicación, nombre y WhatsApp. La ubicación se obtiene con el
botón "usar mi ubicación" o arrastrando el pin sobre el mapa.

La ciudad es un desplegable obligatorio poblado desde `cities`. Viene
preseleccionada con la ciudad activa en la aplicación, y al cambiarla el mapa se
recentra en las coordenadas de esa ciudad. Se valida en el servidor que el pin
caiga dentro de un radio razonable del centro de la ciudad elegida; si no,
se advierte antes de guardar.

Al guardar se genera un `manage_token` aleatorio de 32 bytes. Se almacena solo
su hash. La respuesta muestra el enlace `/s/{public_code}?t={token}` de forma
prominente, con instrucción explícita de guardarlo, y lo persiste en
`localStorage` bajo "Mis solicitudes". Se registra un evento `request_created`.

### Estados

```
                 ┌──────── solicitante (token) ────────▶ cancelada
                 │
abierta ──"Voy en camino"──▶ en_atencion ──solicitante (token)──▶ atendida
   ▲                              │
   └────claim cancelado o vencido─┘
```

`cancelada` la usa el solicitante cuando ya resolvió la necesidad por otro medio
o publicó por error. Es terminal, igual que `atendida`, y ambas salen del
listado por defecto.

Cualquier persona puede pulsar "Voy en camino" indicando su nombre; eso crea un
claim con vencimiento a 6 horas y pasa la solicitud a `en_atencion`.

El voluntario recibe un `claim_token` que se guarda en su `localStorage`, y solo
con él puede cancelar su propio claim. Sin esto no habría manera de distinguir
al voluntario que se retracta de un tercero cancelando reclamos ajenos.

Al vencer sin completarse, la solicitud vuelve a `abierta`. La expiración no
depende de un cron: antes de cada consulta del listado se ejecuta una sentencia
idempotente que vence los claims cumplidos (`UPDATE … WHERE status = 'activo'
AND expires_at < now()`) y devuelve las solicitudes afectadas a `abierta`.
Al marcar una solicitud como atendida, su claim activo pasa a `completado`.

Solo quien tenga el token de gestión marca la solicitud como `atendida` o la
cancela. Cada transición registra un evento.

### Contacto por WhatsApp

El número nunca se incluye en el HTML ni en las respuestas JSON del listado. El
botón consulta `POST /api/requests/{code}/contact`, sujeto a límite por IP, que
devuelve el enlace `wa.me` con un mensaje inicial precargado que menciona el
título de la solicitud.

Motivo: después de cada desastre aparecen campañas de estafa dirigidas a las
víctimas. Publicar los números en texto plano permitiría recolectarlos todos con
un script en minutos.

### Notificaciones in-app

Campanita con panel lateral que lista los eventos recientes. El navegador guarda
el identificador del último evento visto y calcula el contador de no leídos. El
sondeo ocurre cada 30 segundos y solo con la pestaña visible.

El feed respeta la ciudad activa: quien está viendo Cali no recibe avisos de
Armenia. Existe la opción "todas las ciudades" para quien coordine a nivel
nacional.

## Interfaz

Diseño móvil primero, asumiendo gama baja, datos móviles y batería limitada.

- **Selector de ciudad** — visible en la cabecera de toda la aplicación, con
  opción "todas". La elección se guarda en `localStorage` y se refleja en la
  URL (`/?ciudad=cali`), de modo que un enlace compartido en un grupo de
  WhatsApp abre directamente la ciudad correcta. En la primera visita, si la
  persona concede ubicación, se preselecciona la ciudad más cercana; si no,
  queda en "todas".
- **Inicio** — conmutador Lista/Mapa. En móvil abre en Lista, porque el mapa
  pesa; en escritorio, mapa a la izquierda y tarjetas a la derecha,
  sincronizados. Filtros por ciudad, estado, urgencia, texto y cercanía. El mapa
  se centra en la ciudad activa. Por defecto se
  muestran las solicitudes `abierta` y `en_atencion`; las atendidas y canceladas
  quedan accesibles solo al activar el filtro correspondiente.
- **Tarjeta** — título, urgencia, ciudad y barrio, primeros ítems, estado, botón de
  WhatsApp y botón de "Voy en camino". Al pulsarla, abre el detalle.
- **Detalle** `/s/{code}` — mapa, ítems completos, historial de estado, acciones.
  Con token válido aparecen editar, marcar atendida y cancelar.
- **Mis solicitudes** — lo guardado en este navegador.
- Botón fijo de "Pedir ayuda" visible en toda la aplicación.

## Abuso y moderación

- Límite por IP: 3 solicitudes por hora, 10 claims por hora, 20 consultas de
  contacto por hora.
- Campo trampa oculto contra bots.
- Validación de número celular colombiano antes de guardar.
- Botón "Reportar" en cada tarjeta.
- Vista `/admin` que permite ocultar solicitudes y ver los reportes. Sin ella no
  habría forma de limpiar contenido malicioso. El acceso se hace con un
  formulario que compara el token con el de la variable de entorno y deja una
  cookie firmada, `HttpOnly` y `Secure`. El token nunca viaja en la URL: ahí
  quedaría registrado en los logs de nginx, en el historial del navegador y en
  la cabecera `Referer` hacia terceros.

## Pruebas

Vitest sobre la lógica cuyo fallo causa daño real: transiciones de estado,
expiración de claims, unicidad del claim activo, límites por IP, verificación
del token de gestión, filtrado por ciudad, validación del pin contra el centro
de la ciudad y normalización de números a formato `wa.me`.

Playwright sobre dos recorridos: crear una solicitud y verla en el listado;
reclamarla, marcarla atendida y confirmar que desaparece de las activas.

## Despliegue

Docker Compose con la aplicación Next.js y nginx como proxy inverso, apuntando
al Postgres existente. Migraciones con Drizzle Kit. Variables de entorno para
la cadena de conexión y el token de administración. Certificado TLS con certbot.

## Riesgos asumidos

- **Solicitudes falsas o duplicadas.** Sin cuentas no hay verificación de
  identidad. Se mitiga con límites por IP, reportes y moderación manual.
- **Precisión de la ubicación.** El pin lo coloca la persona; puede estar
  desplazado. La dirección en texto sirve de respaldo.
- **Abandono de claims.** Cubierto por el vencimiento a 6 horas.
