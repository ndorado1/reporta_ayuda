# Reporta Cali — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar una aplicación web responsive donde cualquier persona afectada por el terremoto reporte qué necesita y dónde, y cualquier voluntario lo vea en un mapa, lo contacte por WhatsApp y marque que va en camino.

**Architecture:** Next.js (App Router) full-stack sobre el Postgres existente con Drizzle. La lógica de negocio vive en módulos puros bajo `src/lib/`, probados de forma aislada; las pantallas y Server Actions solo los orquestan. El mapa es Leaflet cargado de forma diferida. Las notificaciones se resuelven con sondeo, no con WebSockets.

**Tech Stack:** Next.js 15+ (App Router, TypeScript), Tailwind CSS v4, Drizzle ORM + Drizzle Kit, Postgres, Zod, Leaflet + react-leaflet, Vitest, Playwright, Docker Compose + nginx.

**Spec:** `docs/superpowers/specs/2026-08-13-reporta-cali-design.md`

**Sistema de diseño:** `design-system/reporta-cali/MASTER.md` — sus *Overrides del proyecto* mandan sobre el resto del archivo.

## Global Constraints

- **Idioma de la interfaz:** español de Colombia. Todo el texto visible, incluidos errores y estados vacíos, va en español con tildes correctas.
- **Nombres en código:** identificadores, tablas y columnas en inglés; valores de enumeración en español, porque se muestran al usuario (`abierta`, `en_atencion`, `atendida`, `cancelada`, `archivada`).
- **Móvil primero:** cada pantalla se construye y se verifica primero a 375 px de ancho.
- **Objetivos táctiles:** mínimo 44×44 px, separación mínima de 8 px.
- **Contraste:** mínimo 4.5:1 en todo texto. El color nunca es el único indicador: urgencia y estado llevan icono + texto.
- **Sin `transform` en hover.** Transiciones solo de color, fondo, borde, opacidad y sombra, de 150 a 200 ms. Se respeta `prefers-reduced-motion`.
- **Iconos:** SVG de Lucide (`lucide-react`). Nunca emojis como iconos.
- **Fuente:** Public Sans en todos los niveles, cargada con `next/font/google`. No se enlaza a `fonts.googleapis.com` en tiempo de ejecución.
- **Paleta:** `#0F172A` primario, `#334155` secundario, `#0369A1` CTA, `#F8FAFC` fondo, `#020617` texto. Urgencias: alta `#B91C1C`, media `#B45309`, baja `#15803D`. WhatsApp: fondo `#067647` con texto blanco.
- **El número de WhatsApp nunca sale en HTML ni en JSON de listados.** Solo por el endpoint de contacto.
- **Todo `ip_hash` es HMAC-SHA256 con `IP_HASH_SECRET`.** Nunca `sha256(ip)` a secas.
- **TDD:** primero la prueba, se ejecuta y falla, luego la implementación mínima. Un commit por tarea como mínimo.
- **Sin secretos en el repositorio.** Todo por variables de entorno, con `.env.example` documentado.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/db/schema.ts` | Tablas y tipos Drizzle. Sin lógica. |
| `src/db/index.ts` | Cliente Drizzle y pool de conexión. |
| `src/db/seed.ts` | Semilla de ciudades. |
| `src/lib/whatsapp.ts` | Normalizar celulares colombianos y construir enlaces `wa.me`. |
| `src/lib/tokens.ts` | Códigos públicos, tokens de gestión y de claim, `hashIp`. |
| `src/lib/geo.ts` | Distancia entre coordenadas y validación del pin contra la ciudad. |
| `src/lib/cities.ts` | Consulta de ciudades activas. |
| `src/lib/ratelimit.ts` | Conteo por IP y acción. No bloquea: informa. |
| `src/lib/events.ts` | Registro y lectura del feed de actividad. |
| `src/lib/requests.ts` | Crear, listar y cambiar de estado las solicitudes. |
| `src/lib/claims.ts` | Reclamar, cancelar y vencer claims. |
| `src/lib/maintenance.ts` | Anonimizar y archivar. Idempotente. |
| `src/scripts/maintenance.ts` | Punto de entrada del cron diario. |
| `src/app/layout.tsx` | Estructura global, fuente, cabecera, salto al contenido. |
| `src/app/page.tsx` | Inicio: lista y mapa. |
| `src/app/nueva/page.tsx` | Formulario de nueva solicitud. |
| `src/app/s/[code]/page.tsx` | Detalle de una solicitud. |
| `src/app/mis-solicitudes/page.tsx` | Solicitudes guardadas en este navegador. |
| `src/app/privacidad/page.tsx` | Aviso de privacidad. |
| `src/app/admin/**` | Moderación. |
| `src/app/api/**` | Endpoint de contacto y sondeo de eventos. |
| `src/components/ui/*` | Piezas base: botón, distintivo, campo. |
| `src/components/*` | Componentes del dominio: tarjeta, mapa, campanita. |

---

### Task 1: Andamiaje del proyecto y normalización de WhatsApp

Se juntan en una sola tarea porque el andamiaje sin nada que probar no es entregable, y `lib/whatsapp` es el primer módulo puro: no necesita base de datos y ejercita todo el ciclo de pruebas.

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.example`, `.gitignore`
- Create: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `src/lib/whatsapp.ts`
- Test: `src/lib/whatsapp.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `normalizePhone(input: string): string | null` — devuelve E.164 (`+573001234567`) o `null` si no es un celular colombiano válido.
  - `buildWhatsAppLink(phone: string, message: string): string` — devuelve `https://wa.me/<digits>?text=<encoded>`.

- [ ] **Step 1: Crear el proyecto Next.js**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm
```

Si el asistente pregunta por sobrescribir archivos existentes, responder que no toque `docs/`, `design-system/` ni `.gitignore`.

- [ ] **Step 2: Instalar dependencias de prueba y de dominio**

```bash
npm install drizzle-orm postgres zod lucide-react
npm install -D drizzle-kit vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom @types/pg
```

- [ ] **Step 3: Configurar Vitest**

Crear `vitest.config.mts` — con extensión `.mts`, no `.ts`: Vite carga los `.ts`
como CommonJS y emite un aviso en cada corrida, y las restricciones globales
exigen salida de pruebas limpia. La alternativa, `"type": "module"` en
`package.json`, afectaría a todo el proyecto.

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Resolución nativa de los alias `@/` de tsconfig: el plugin
  // vite-tsconfig-paths quedó obsoleto y avisa en cada corrida.
  resolve: { tsconfigPaths: true },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Las pruebas de integración comparten una sola base y resetTestDb()
    // la trunca. En paralelo se pisan: un archivo vacía la base mientras
    // otro está insertando. Medido: 21 fallos de 50 con paralelismo,
    // 0 sin él. Una base por archivo sería más rápida y mucho más compleja.
    fileParallelism: false,
  },
})
```

Crear `vitest.setup.ts`:

```ts
// Las pruebas de componentes importan, de forma transitiva, Server Actions
// que inicializan la conexión a la base (RequestCard → ClaimButton →
// actions.ts → lib/claims → db). Sin cargar aquí las variables de entorno,
// esas pruebas fallan al importar el módulo aunque no toquen la base, y
// solo pasarían por casualidad si otra prueba hubiera cargado dotenv antes.
import 'dotenv/config'
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Los componentes cliente que usan useRouter o useSearchParams solo
// funcionan dentro del contexto que monta Next en ejecución. Vitest no lo
// provee: sin este stub, cualquier prueba que los renderice revienta con
// "invariant expected app router to be mounted", aunque no verifique nada
// de navegación. Un archivo de prueba puede sobrescribirlo si necesita
// parámetros concretos: aquí `useSearchParams` devuelve siempre vacío.
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation')
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(), replace: vi.fn(), refresh: vi.fn(),
      back: vi.fn(), forward: vi.fn(), prefetch: vi.fn(),
    }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => '/',
  }
})
```

**Regla que aplica a todas las tareas de interfaz:** cualquier componente
cliente que use `useSearchParams` debe ir envuelto en `<Suspense>` donde se
consuma, o `next build` falla con "Missing Suspense boundary". Afecta al menos
a `CitySelect`, `NotificationBell`, `RequestFilters` y `MapListToggle`.

Añadir a `package.json` en `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Escribir la prueba que falla**

Crear `src/lib/whatsapp.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizePhone, buildWhatsAppLink } from './whatsapp'

describe('normalizePhone', () => {
  it('acepta un celular de diez dígitos', () => {
    expect(normalizePhone('3001234567')).toBe('+573001234567')
  })

  it('ignora espacios, guiones y paréntesis', () => {
    expect(normalizePhone('(300) 123-45 67')).toBe('+573001234567')
  })

  it('acepta el indicativo con y sin signo más', () => {
    expect(normalizePhone('+57 300 123 4567')).toBe('+573001234567')
    expect(normalizePhone('57 3001234567')).toBe('+573001234567')
  })

  it('acepta el cero de marcación nacional', () => {
    expect(normalizePhone('03001234567')).toBe('+573001234567')
  })

  it('rechaza números fijos y longitudes incorrectas', () => {
    expect(normalizePhone('6024851234')).toBeNull()
    expect(normalizePhone('300123456')).toBeNull()
    expect(normalizePhone('30012345678')).toBeNull()
  })

  it('rechaza texto vacío o sin dígitos', () => {
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone('no tengo')).toBeNull()
  })
})

describe('buildWhatsAppLink', () => {
  it('arma el enlace sin el signo más y con el texto codificado', () => {
    const link = buildWhatsAppLink('+573001234567', 'Hola, ¿sigue necesitando agua?')
    expect(link).toBe(
      'https://wa.me/573001234567?text=Hola%2C%20%C2%BFsigue%20necesitando%20agua%3F'
    )
  })
})
```

- [ ] **Step 5: Ejecutar la prueba y confirmar que falla**

Run: `npm test -- src/lib/whatsapp.test.ts`
Expected: FAIL — `Failed to resolve import "./whatsapp"`.

- [ ] **Step 6: Implementar el módulo**

Crear `src/lib/whatsapp.ts`:

```ts
/**
 * En Colombia los celulares tienen diez dígitos y empiezan por 3.
 * Los fijos, que no sirven para WhatsApp, empiezan por 60.
 */
const MOBILE = /^3\d{9}$/

export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  if (!digits) return null

  // Quita el indicativo de país y el cero de marcación nacional.
  let local = digits
  if (local.startsWith('57') && local.length > 10) local = local.slice(2)
  if (local.startsWith('0')) local = local.slice(1)

  return MOBILE.test(local) ? `+57${local}` : null
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
```

- [ ] **Step 7: Ejecutar la prueba y confirmar que pasa**

Run: `npm test -- src/lib/whatsapp.test.ts`
Expected: PASS, 7 pruebas.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: andamiaje del proyecto y normalización de celulares colombianos"
```

---

### Task 2: Tokens, códigos públicos y hash de IP

**Files:**
- Create: `src/lib/tokens.ts`
- Test: `src/lib/tokens.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `generateToken(): string` — 32 bytes aleatorios en base64url.
  - `hashToken(token: string): string` — SHA-256 en hexadecimal.
  - `verifyToken(token: string, hash: string): boolean` — comparación en tiempo constante.
  - `generatePublicCode(): string` — seis caracteres del alfabeto sin ambigüedades.
  - `hashIp(ip: string): string` — HMAC-SHA256 con `IP_HASH_SECRET`.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/lib/tokens.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import {
  generateToken,
  hashToken,
  verifyToken,
  generatePublicCode,
  hashIp,
} from './tokens'

beforeAll(() => {
  process.env.IP_HASH_SECRET = 'secreto-de-prueba'
})

describe('tokens de gestión', () => {
  it('genera tokens distintos en cada llamada', () => {
    expect(generateToken()).not.toBe(generateToken())
  })

  it('genera tokens suficientemente largos', () => {
    expect(generateToken().length).toBeGreaterThanOrEqual(43)
  })

  it('no guarda el token en claro: el hash es distinto del token', () => {
    const token = generateToken()
    expect(hashToken(token)).not.toBe(token)
  })

  it('verifica el token correcto y rechaza el incorrecto', () => {
    const token = generateToken()
    const hash = hashToken(token)
    expect(verifyToken(token, hash)).toBe(true)
    expect(verifyToken(generateToken(), hash)).toBe(false)
  })

  it('rechaza sin lanzar cuando el hash tiene longitud inesperada', () => {
    expect(verifyToken(generateToken(), 'corto')).toBe(false)
  })
})

describe('códigos públicos', () => {
  it('tiene seis caracteres', () => {
    expect(generatePublicCode()).toHaveLength(6)
  })

  it('excluye caracteres que se confunden al dictarlos por teléfono', () => {
    const codes = Array.from({ length: 200 }, () => generatePublicCode()).join('')
    expect(codes).not.toMatch(/[01IOl]/)
  })
})

describe('hashIp', () => {
  it('es estable para la misma IP', () => {
    expect(hashIp('190.0.0.1')).toBe(hashIp('190.0.0.1'))
  })

  it('difiere entre IPs distintas', () => {
    expect(hashIp('190.0.0.1')).not.toBe(hashIp('190.0.0.2'))
  })

  it('cambia si cambia el secreto, de modo que no es un sha256 simple', () => {
    const conSecretoA = hashIp('190.0.0.1')
    process.env.IP_HASH_SECRET = 'otro-secreto'
    expect(hashIp('190.0.0.1')).not.toBe(conSecretoA)
    process.env.IP_HASH_SECRET = 'secreto-de-prueba'
  })
})
```

- [ ] **Step 2: Ejecutar la prueba y confirmar que falla**

Run: `npm test -- src/lib/tokens.test.ts`
Expected: FAIL — no existe `./tokens`.

- [ ] **Step 3: Implementar el módulo**

Crear `src/lib/tokens.ts`:

```ts
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

/** Sin 0, 1, I, O ni L: se confunden al leer un código en voz alta. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function verifyToken(token: string, hash: string): boolean {
  const a = Buffer.from(hashToken(token), 'hex')
  const b = Buffer.from(hash, 'hex')
  // timingSafeEqual exige longitudes iguales; un hash corrupto no debe lanzar.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function generatePublicCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += ALPHABET[randomInt(ALPHABET.length)]
  return code
}

export function hashIp(ip: string): string {
  const secret = process.env.IP_HASH_SECRET
  if (!secret) throw new Error('Falta IP_HASH_SECRET')
  // HMAC y no sha256: el espacio IPv4 completo se revierte por fuerza bruta.
  return createHmac('sha256', secret).update(ip).digest('hex')
}
```

- [ ] **Step 4: Ejecutar la prueba y confirmar que pasa**

Run: `npm test -- src/lib/tokens.test.ts`
Expected: PASS, 10 pruebas.

- [ ] **Step 5: Documentar las variables de entorno**

Crear `.env.example`:

```bash
# Conexión al Postgres existente
DATABASE_URL=postgres://usuario:clave@localhost:5432/reporta_cali
# Base separada que usan las pruebas de integración; se borra y recrea sin aviso
TEST_DATABASE_URL=postgres://usuario:clave@localhost:5432/reporta_cali_test

# Secreto para el HMAC de las IPs. Generar con: openssl rand -base64 32
IP_HASH_SECRET=

# Clave de acceso a /admin. Generar con: openssl rand -base64 32
ADMIN_TOKEN=
# Secreto con el que se firma la cookie de sesión de /admin
ADMIN_COOKIE_SECRET=

# URL pública, usada para armar los enlaces de gestión
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: tokens de gestión, códigos públicos y hash de IP con HMAC"
```

---

### Task 3: Geometría — distancia y validación del pin

**Files:**
- Create: `src/lib/geo.ts`
- Test: `src/lib/geo.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `distanceKm(a: Coords, b: Coords): number` — distancia en kilómetros.
  - `isNearCity(pin: Coords, center: Coords): boolean` — verdadero si el pin está a 60 km o menos del centro.
  - `type Coords = { lat: number; lng: number }`
  - `MAX_PIN_DISTANCE_KM = 60`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/lib/geo.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { distanceKm, isNearCity } from './geo'

const CALI = { lat: 3.4516, lng: -76.532 }
const BOGOTA = { lat: 4.711, lng: -74.0721 }
const JAMUNDI = { lat: 3.2606, lng: -76.5417 }

describe('distanceKm', () => {
  it('da cero para el mismo punto', () => {
    expect(distanceKm(CALI, CALI)).toBe(0)
  })

  it('calcula Cali–Bogotá en unos 300 km', () => {
    expect(distanceKm(CALI, BOGOTA)).toBeGreaterThan(280)
    expect(distanceKm(CALI, BOGOTA)).toBeLessThan(320)
  })

  it('es simétrica', () => {
    expect(distanceKm(CALI, BOGOTA)).toBeCloseTo(distanceKm(BOGOTA, CALI), 6)
  })
})

describe('isNearCity', () => {
  it('acepta un municipio vecino dentro del área de influencia', () => {
    expect(isNearCity(JAMUNDI, CALI)).toBe(true)
  })

  it('rechaza un pin en otra ciudad del país', () => {
    expect(isNearCity(BOGOTA, CALI)).toBe(false)
  })
})
```

- [ ] **Step 2: Ejecutar la prueba y confirmar que falla**

Run: `npm test -- src/lib/geo.test.ts`
Expected: FAIL — no existe `./geo`.

- [ ] **Step 3: Implementar el módulo**

Crear `src/lib/geo.ts`:

```ts
export type Coords = { lat: number; lng: number }

/**
 * Radio holgado. El objetivo no es delimitar el municipio, sino detectar
 * errores gruesos: eligió Cali y dejó el pin en Bogotá.
 */
export const MAX_PIN_DISTANCE_KM = 60

const EARTH_RADIUS_KM = 6371
const toRad = (deg: number) => (deg * Math.PI) / 180

export function distanceKm(a: Coords, b: Coords): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

export function isNearCity(pin: Coords, center: Coords): boolean {
  return distanceKm(pin, center) <= MAX_PIN_DISTANCE_KM
}
```

- [ ] **Step 4: Ejecutar la prueba y confirmar que pasa**

Run: `npm test -- src/lib/geo.test.ts`
Expected: PASS, 5 pruebas.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: distancia entre coordenadas y validación del pin contra la ciudad"
```

---

### Task 4: Esquema de base de datos, migración y semilla de ciudades

**Files:**
- Create: `src/db/schema.ts`, `src/db/index.ts`, `src/db/seed.ts`, `drizzle.config.ts`
- Create: `src/test/db.ts` (utilidad para pruebas de integración)
- Test: `src/db/schema.test.ts`
- Modify: `package.json` (scripts de migración y semilla)

**Interfaces:**
- Consumes: nada.
- Produces:
  - Tablas `cities`, `requests`, `requestItems`, `claims`, `events`, `reports`, `rateLimits`.
  - `db` — instancia de Drizzle.
  - `resetTestDb()` — deja la base de pruebas vacía y migrada; se llama en `beforeEach`.
  - `seedTestCity()` — inserta Cali de forma idempotente y la devuelve.
  - Tipos `City`, `Request`, `NewRequest`, `Claim`, `Event`.

- [ ] **Step 1: Escribir el esquema**

Crear `src/db/schema.ts`:

```ts
import {
  pgTable, uuid, text, doublePrecision, integer, boolean,
  timestamp, jsonb, pgEnum, index, uniqueIndex,
} from 'drizzle-orm/pg-core'

export const urgencyEnum = pgEnum('urgency', ['alta', 'media', 'baja'])
export const requestStatusEnum = pgEnum('request_status', [
  'abierta', 'en_atencion', 'atendida', 'cancelada', 'archivada',
])
export const claimStatusEnum = pgEnum('claim_status', [
  'activo', 'cancelado', 'completado', 'vencido',
])
export const eventTypeEnum = pgEnum('event_type', [
  'request_created', 'request_claimed', 'request_fulfilled',
])

export const cities = pgTable('cities', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  department: text('department').notNull(),
  centerLat: doublePrecision('center_lat').notNull(),
  centerLng: doublePrecision('center_lng').notNull(),
  defaultZoom: integer('default_zoom').notNull().default(12),
  isActive: boolean('is_active').notNull().default(true),
  position: integer('position').notNull().default(0),
})

export const requests = pgTable('requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  cityId: uuid('city_id').notNull().references(() => cities.id),
  publicCode: text('public_code').notNull().unique(),
  manageTokenHash: text('manage_token_hash').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  urgency: urgencyEnum('urgency').notNull().default('media'),
  status: requestStatusEnum('status').notNull().default('abierta'),
  requesterName: text('requester_name').notNull(),
  whatsapp: text('whatsapp'),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  addressText: text('address_text'),
  neighborhood: text('neighborhood'),
  peopleCount: integer('people_count'),
  ipHash: text('ip_hash').notNull(),
  isHidden: boolean('is_hidden').notNull().default(false),
  needsReview: boolean('needs_review').notNull().default(false),
  anonymizedAt: timestamp('anonymized_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  fulfilledAt: timestamp('fulfilled_at', { withTimezone: true }),
}, (t) => ({
  listing: index('requests_listing_idx').on(t.cityId, t.status, t.createdAt),
}))

export const requestItems = pgTable('request_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().references(() => requests.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  quantity: text('quantity'),
  position: integer('position').notNull().default(0),
}, (t) => ({
  byRequest: index('request_items_request_idx').on(t.requestId),
}))

export const claims = pgTable('claims', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().references(() => requests.id, { onDelete: 'cascade' }),
  volunteerName: text('volunteer_name').notNull(),
  volunteerWhatsapp: text('volunteer_whatsapp'),
  claimTokenHash: text('claim_token_hash').notNull(),
  status: claimStatusEnum('status').notNull().default('activo'),
  ipHash: text('ip_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (t) => ({
  // Una solicitud no puede tener dos voluntarios activos a la vez.
  oneActive: uniqueIndex('claims_one_active_idx')
    .on(t.requestId)
    .where(sql`status = 'activo'`),
}))

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: eventTypeEnum('type').notNull(),
  requestId: uuid('request_id').notNull().references(() => requests.id, { onDelete: 'cascade' }),
  cityId: uuid('city_id').notNull().references(() => cities.id),
  payload: jsonb('payload').$type<{ title: string; neighborhood: string | null; city: string }>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  feed: index('events_feed_idx').on(t.cityId, t.createdAt),
}))

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().references(() => requests.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  ipHash: text('ip_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
})

export type City = typeof cities.$inferSelect
export type Request = typeof requests.$inferSelect
export type NewRequest = typeof requests.$inferInsert
export type RequestItem = typeof requestItems.$inferSelect
export type Claim = typeof claims.$inferSelect
export type Event = typeof events.$inferSelect
```

Añadir el import que usa el índice parcial, al principio del archivo:

```ts
import { sql } from 'drizzle-orm'
```

- [ ] **Step 2: Crear el cliente**

Crear `src/db/index.ts`:

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Bajo pruebas apunta a la base de pruebas. Sin esta ramificación, las
// funciones bajo prueba leerían y escribirían la base de desarrollo aunque
// el test preparase sus datos en la otra.
const isTest = process.env.NODE_ENV === 'test'
const connectionString = isTest
  ? process.env.TEST_DATABASE_URL
  : process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    isTest
      ? 'Falta TEST_DATABASE_URL: las pruebas no deben caer en la base de desarrollo'
      : 'Falta DATABASE_URL'
  )
}

// max: 10 es suficiente para un VPS pequeño y evita agotar el Postgres.
const client = postgres(connectionString, { max: 10 })

export const db = drizzle(client, { schema })
export { schema }
```

- [ ] **Step 3: Configurar Drizzle Kit y los scripts**

Crear `drizzle.config.ts`:

```ts
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config
```

Añadir a `package.json` en `scripts`:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:seed": "tsx src/db/seed.ts"
```

Instalar el ejecutor de scripts:

```bash
npm install -D tsx dotenv
```

- [ ] **Step 4: Generar y aplicar la migración**

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

Expected: se crea `drizzle/0000_*.sql` y las tablas quedan en la base.

- [ ] **Step 5: Escribir la semilla de ciudades**

Crear `src/db/seed.ts`:

```ts
import 'dotenv/config'
import { db } from './index'
import { cities } from './schema'

const CITIES = [
  { slug: 'cali', name: 'Cali', department: 'Valle del Cauca', centerLat: 3.4516, centerLng: -76.532, defaultZoom: 12, position: 1 },
  { slug: 'armenia', name: 'Armenia', department: 'Quindío', centerLat: 4.5339, centerLng: -75.6811, defaultZoom: 13, position: 2 },
  { slug: 'pereira', name: 'Pereira', department: 'Risaralda', centerLat: 4.8133, centerLng: -75.6961, defaultZoom: 13, position: 3 },
  { slug: 'buenaventura', name: 'Buenaventura', department: 'Valle del Cauca', centerLat: 3.8801, centerLng: -77.0312, defaultZoom: 12, position: 4 },
  { slug: 'quibdo', name: 'Quibdó', department: 'Chocó', centerLat: 5.6947, centerLng: -76.6611, defaultZoom: 13, position: 5 },
]

async function main() {
  for (const city of CITIES) {
    await db.insert(cities).values(city).onConflictDoUpdate({
      target: cities.slug,
      set: { name: city.name, department: city.department, position: city.position },
    })
  }
  console.log(`Sembradas ${CITIES.length} ciudades.`)
  process.exit(0)
}

main()
```

- [ ] **Step 6: Escribir la utilidad de pruebas de integración**

Crear `src/test/db.ts`:

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import * as schema from '@/db/schema'

const url = process.env.TEST_DATABASE_URL
if (!url) throw new Error('Falta TEST_DATABASE_URL')

// Salvaguarda: resetTestDb trunca todas las tablas. Si una variable mal
// puesta apuntara a la base de desarrollo — o algún día a la de producción —
// borraría datos de personas damnificadas sin aviso.
const dbName = new URL(url).pathname.slice(1)
if (!dbName.endsWith('_test')) {
  throw new Error(
    `Rechazo usar "${dbName}" como base de pruebas: su nombre debe terminar en _test`
  )
}

const client = postgres(url, { max: 1 })
export const testDb = drizzle(client, { schema })

let migrated = false

/** Deja la base vacía y migrada antes de cada prueba. */
export async function resetTestDb() {
  if (!migrated) {
    await migrate(testDb, { migrationsFolder: './drizzle' })
    migrated = true
  }
  await testDb.execute(
    sql`TRUNCATE events, reports, claims, request_items, requests, rate_limits, cities RESTART IDENTITY CASCADE`
  )
}

/**
 * Inserta Cali y la devuelve, que es lo que casi toda prueba necesita.
 * Idempotente: varias pruebas crean más de una solicitud y la llaman una vez
 * por cada una, así que una segunda llamada debe devolver la misma fila en
 * vez de violar la unicidad de `slug`.
 */
export async function seedTestCity() {
  const [city] = await testDb
    .insert(schema.cities)
    .values({
      slug: 'cali', name: 'Cali', department: 'Valle del Cauca',
      centerLat: 3.4516, centerLng: -76.532, defaultZoom: 12, position: 1,
    })
    .onConflictDoUpdate({ target: schema.cities.slug, set: { name: 'Cali' } })
    .returning()
  return city
}
```

- [ ] **Step 7: Escribir la prueba del esquema**

Crear `src/db/schema.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, resetTestDb, seedTestCity } from '@/test/db'
import { requests, claims, requestItems } from './schema'

beforeEach(resetTestDb)

const baseRequest = (cityId: string) => ({
  cityId,
  publicCode: 'ABC123',
  manageTokenHash: 'hash',
  title: 'Necesitamos agua',
  requesterName: 'Ana',
  whatsapp: '+573001234567',
  lat: 3.45,
  lng: -76.53,
  ipHash: 'iphash',
})

describe('esquema', () => {
  it('guarda una solicitud con los valores por defecto esperados', async () => {
    const city = await seedTestCity()
    const [row] = await testDb.insert(requests).values(baseRequest(city.id)).returning()

    expect(row.status).toBe('abierta')
    expect(row.urgency).toBe('media')
    expect(row.isHidden).toBe(false)
    expect(row.needsReview).toBe(false)
  })

  it('impide dos códigos públicos iguales', async () => {
    const city = await seedTestCity()
    await testDb.insert(requests).values(baseRequest(city.id))
    await expect(
      testDb.insert(requests).values(baseRequest(city.id))
    ).rejects.toThrow()
  })

  it('impide dos claims activos sobre la misma solicitud', async () => {
    const city = await seedTestCity()
    const [req] = await testDb.insert(requests).values(baseRequest(city.id)).returning()
    const claim = {
      requestId: req.id,
      volunteerName: 'Luis',
      claimTokenHash: 'h',
      ipHash: 'i',
      expiresAt: new Date(Date.now() + 6 * 3600_000),
    }

    await testDb.insert(claims).values(claim)
    await expect(testDb.insert(claims).values(claim)).rejects.toThrow()
  })

  it('permite un segundo claim si el anterior ya no está activo', async () => {
    const city = await seedTestCity()
    const [req] = await testDb.insert(requests).values(baseRequest(city.id)).returning()
    const base = {
      requestId: req.id,
      volunteerName: 'Luis',
      claimTokenHash: 'h',
      ipHash: 'i',
      expiresAt: new Date(Date.now() + 6 * 3600_000),
    }

    await testDb.insert(claims).values({ ...base, status: 'cancelado' })
    await expect(testDb.insert(claims).values(base)).resolves.toBeDefined()
  })

  it('borra los ítems al borrar la solicitud', async () => {
    const city = await seedTestCity()
    const [req] = await testDb.insert(requests).values(baseRequest(city.id)).returning()
    await testDb.insert(requestItems).values({ requestId: req.id, name: 'Agua' })
    await testDb.delete(requests)
    const left = await testDb.select().from(requestItems)
    expect(left).toHaveLength(0)
  })
})
```

- [ ] **Step 8: Crear la base de pruebas y ejecutar**

```bash
createdb reporta_cali_test || psql -c "CREATE DATABASE reporta_cali_test"
npm test -- src/db/schema.test.ts
```

Expected: PASS, 5 pruebas. Si falla el índice único parcial, revisar que la migración generada incluya `WHERE status = 'activo'`.

- [ ] **Step 9: Sembrar las ciudades y commit**

```bash
npm run db:seed
git add -A
git commit -m "feat: esquema de base de datos, migración y semilla de ciudades"
```

---

### Task 5: Ciudades y límite de tasa

**Files:**
- Create: `src/lib/cities.ts`, `src/lib/ratelimit.ts`
- Test: `src/lib/cities.test.ts`, `src/lib/ratelimit.test.ts`

**Interfaces:**
- Consumes: `db` y el esquema de la Task 4; `hashIp` de la Task 2.
- Produces:
  - `listCities(): Promise<City[]>` — activas, ordenadas por `position`.
  - `getCityBySlug(slug: string): Promise<City | null>`
  - `type RateAction = 'create_request' | 'create_claim' | 'contact'`
  - `RATE_LIMITS: Record<RateAction, number>` — `create_request: 20`, `create_claim: 20`, `contact: 40`, por hora.
  - `consumeRate(ip: string, action: RateAction): Promise<{ exceeded: boolean; count: number }>` — **nunca bloquea**; informa si se pasó del umbral.

- [ ] **Step 1: Escribir la prueba de ciudades**

Crear `src/lib/cities.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, resetTestDb } from '@/test/db'
import { cities } from '@/db/schema'
import { listCities, getCityBySlug } from './cities'

beforeEach(async () => {
  await resetTestDb()
  await testDb.insert(cities).values([
    { slug: 'cali', name: 'Cali', department: 'Valle del Cauca', centerLat: 3.4516, centerLng: -76.532, position: 1 },
    { slug: 'armenia', name: 'Armenia', department: 'Quindío', centerLat: 4.5339, centerLng: -75.6811, position: 2 },
    { slug: 'inactiva', name: 'Inactiva', department: 'X', centerLat: 0, centerLng: 0, position: 3, isActive: false },
  ])
})

describe('listCities', () => {
  it('devuelve solo las activas, en orden', async () => {
    const result = await listCities()
    expect(result.map((c) => c.slug)).toEqual(['cali', 'armenia'])
  })
})

describe('getCityBySlug', () => {
  it('encuentra una ciudad activa', async () => {
    expect((await getCityBySlug('cali'))?.name).toBe('Cali')
  })

  it('devuelve null si no existe o está inactiva', async () => {
    expect(await getCityBySlug('medellin')).toBeNull()
    expect(await getCityBySlug('inactiva')).toBeNull()
  })
})
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `npm test -- src/lib/cities.test.ts`
Expected: FAIL — no existe `./cities`.

- [ ] **Step 3: Implementar `cities`**

Crear `src/lib/cities.ts`:

```ts
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { cities, type City } from '@/db/schema'

export async function listCities(): Promise<City[]> {
  return db.select().from(cities).where(eq(cities.isActive, true)).orderBy(asc(cities.position))
}

export async function getCityBySlug(slug: string): Promise<City | null> {
  const [city] = await db
    .select()
    .from(cities)
    .where(and(eq(cities.slug, slug), eq(cities.isActive, true)))
    .limit(1)
  return city ?? null
}
```

- [ ] **Step 4: Ejecutar y confirmar que pasa**

Run: `npm test -- src/lib/cities.test.ts`
Expected: PASS, 3 pruebas.

- [ ] **Step 5: Escribir la prueba del límite de tasa**

Crear `src/lib/ratelimit.test.ts`:

```ts
import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { resetTestDb } from '@/test/db'
import { consumeRate, RATE_LIMITS } from './ratelimit'

beforeAll(() => { process.env.IP_HASH_SECRET = 'secreto-de-prueba' })
beforeEach(resetTestDb)

describe('consumeRate', () => {
  it('cuenta cada uso', async () => {
    expect((await consumeRate('1.1.1.1', 'create_request')).count).toBe(1)
    expect((await consumeRate('1.1.1.1', 'create_request')).count).toBe(2)
  })

  it('no marca exceso por debajo del umbral', async () => {
    const r = await consumeRate('1.1.1.1', 'create_request')
    expect(r.exceeded).toBe(false)
  })

  it('marca exceso al superar el umbral', async () => {
    const limit = RATE_LIMITS.create_request
    let last = { exceeded: false, count: 0 }
    for (let i = 0; i < limit + 1; i++) last = await consumeRate('1.1.1.1', 'create_request')
    expect(last.exceeded).toBe(true)
  })

  it('cuenta por separado cada acción', async () => {
    await consumeRate('1.1.1.1', 'create_request')
    expect((await consumeRate('1.1.1.1', 'contact')).count).toBe(1)
  })

  it('cuenta por separado cada IP', async () => {
    await consumeRate('1.1.1.1', 'create_request')
    expect((await consumeRate('2.2.2.2', 'create_request')).count).toBe(1)
  })
})
```

- [ ] **Step 6: Ejecutar y confirmar que falla**

Run: `npm test -- src/lib/ratelimit.test.ts`
Expected: FAIL — no existe `./ratelimit`.

- [ ] **Step 7: Implementar `ratelimit`**

Crear `src/lib/ratelimit.ts`:

```ts
import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { rateLimits } from '@/db/schema'
import { hashIp } from './tokens'

export type RateAction = 'create_request' | 'create_claim' | 'contact'

/**
 * Umbrales por hora. Son altos a propósito: los operadores móviles
 * colombianos usan CGNAT y muchas personas comparten una IP pública.
 */
export const RATE_LIMITS: Record<RateAction, number> = {
  create_request: 20,
  create_claim: 20,
  contact: 40,
}

export async function consumeRate(
  ip: string,
  action: RateAction
): Promise<{ exceeded: boolean; count: number }> {
  const hour = new Date()
  hour.setMinutes(0, 0, 0)
  const key = `${hashIp(ip)}:${action}:${hour.toISOString()}`

  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart: hour })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning()

  // Limpieza oportunista: sin esto la tabla crece sin límite.
  await db.delete(rateLimits).where(sql`${rateLimits.windowStart} < now() - interval '2 hours'`)

  return { exceeded: row.count > RATE_LIMITS[action], count: row.count }
}
```

- [ ] **Step 8: Ejecutar y confirmar que pasa**

Run: `npm test -- src/lib/ratelimit.test.ts`
Expected: PASS, 5 pruebas.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: consulta de ciudades y límite de tasa por IP y acción"
```

---

### Task 6: Feed de eventos

**Files:**
- Create: `src/lib/events.ts`
- Test: `src/lib/events.test.ts`

**Interfaces:**
- Consumes: `db`, esquema.
- Produces:
  - `recordEvent(input: { type: EventType; requestId: string; cityId: string; payload: EventPayload }): Promise<Event>`
  - `listEvents(opts: { citySlug?: string; sinceId?: string; limit?: number }): Promise<Event[]>` — más recientes primero, tope 50.
  - `countEventsSince(opts: { citySlug?: string; sinceId?: string }): Promise<number>`
  - `type EventPayload = { title: string; neighborhood: string | null; city: string }`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/lib/events.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, resetTestDb, seedTestCity } from '@/test/db'
import { requests, cities } from '@/db/schema'
import { recordEvent, listEvents, countEventsSince } from './events'

async function makeRequest(cityId: string, code: string) {
  const [row] = await testDb.insert(requests).values({
    cityId, publicCode: code, manageTokenHash: 'h', title: 'Agua',
    requesterName: 'Ana', lat: 3.45, lng: -76.53, ipHash: 'i',
  }).returning()
  return row
}

beforeEach(resetTestDb)

describe('eventos', () => {
  it('registra un evento y lo devuelve en el feed', async () => {
    const city = await seedTestCity()
    const req = await makeRequest(city.id, 'AAA111')

    await recordEvent({
      type: 'request_created', requestId: req.id, cityId: city.id,
      payload: { title: 'Agua', neighborhood: 'El Poblado', city: 'Cali' },
    })

    const feed = await listEvents({})
    expect(feed).toHaveLength(1)
    expect(feed[0].payload.title).toBe('Agua')
  })

  it('ordena del más reciente al más antiguo', async () => {
    const city = await seedTestCity()
    const req = await makeRequest(city.id, 'AAA111')
    const base = { requestId: req.id, cityId: city.id, payload: { title: 'x', neighborhood: null, city: 'Cali' } }

    await recordEvent({ ...base, type: 'request_created' })
    await recordEvent({ ...base, type: 'request_claimed' })

    const feed = await listEvents({})
    expect(feed[0].type).toBe('request_claimed')
  })

  it('filtra por ciudad', async () => {
    const cali = await seedTestCity()
    const [armenia] = await testDb.insert(cities).values({
      slug: 'armenia', name: 'Armenia', department: 'Quindío',
      centerLat: 4.53, centerLng: -75.68, position: 2,
    }).returning()

    const rCali = await makeRequest(cali.id, 'AAA111')
    const rArm = await makeRequest(armenia.id, 'BBB222')

    await recordEvent({ type: 'request_created', requestId: rCali.id, cityId: cali.id, payload: { title: 'Cali', neighborhood: null, city: 'Cali' } })
    await recordEvent({ type: 'request_created', requestId: rArm.id, cityId: armenia.id, payload: { title: 'Armenia', neighborhood: null, city: 'Armenia' } })

    const feed = await listEvents({ citySlug: 'cali' })
    expect(feed).toHaveLength(1)
    expect(feed[0].payload.city).toBe('Cali')
  })

  it('cuenta los eventos posteriores a uno dado', async () => {
    const city = await seedTestCity()
    const req = await makeRequest(city.id, 'AAA111')
    const base = { requestId: req.id, cityId: city.id, payload: { title: 'x', neighborhood: null, city: 'Cali' } }

    const first = await recordEvent({ ...base, type: 'request_created' })
    await recordEvent({ ...base, type: 'request_claimed' })
    await recordEvent({ ...base, type: 'request_fulfilled' })

    expect(await countEventsSince({ sinceId: first.id })).toBe(2)
  })

  it('cuenta todo cuando no se conoce el último visto', async () => {
    const city = await seedTestCity()
    const req = await makeRequest(city.id, 'AAA111')
    await recordEvent({ type: 'request_created', requestId: req.id, cityId: city.id, payload: { title: 'x', neighborhood: null, city: 'Cali' } })

    expect(await countEventsSince({})).toBe(1)
  })
})
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `npm test -- src/lib/events.test.ts`
Expected: FAIL — no existe `./events`.

- [ ] **Step 3: Implementar el módulo**

Crear `src/lib/events.ts`:

```ts
import { and, desc, eq, gt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { cities, events, type Event } from '@/db/schema'

export type EventType = 'request_created' | 'request_claimed' | 'request_fulfilled'
export type EventPayload = { title: string; neighborhood: string | null; city: string }

export async function recordEvent(input: {
  type: EventType
  requestId: string
  cityId: string
  payload: EventPayload
}): Promise<Event> {
  const [row] = await db.insert(events).values(input).returning()
  return row
}

/** Subconsulta: instante de creación del último evento visto por el navegador. */
function createdAtOf(eventId: string) {
  return sql`(select created_at from ${events} where id = ${eventId})`
}

export async function listEvents(opts: {
  citySlug?: string
  sinceId?: string
  limit?: number
}): Promise<Event[]> {
  const conditions = []
  if (opts.citySlug) {
    conditions.push(
      sql`${events.cityId} = (select id from ${cities} where slug = ${opts.citySlug})`
    )
  }
  if (opts.sinceId) conditions.push(gt(events.createdAt, createdAtOf(opts.sinceId) as never))

  return db
    .select()
    .from(events)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(events.createdAt))
    .limit(Math.min(opts.limit ?? 50, 50))
}

export async function countEventsSince(opts: {
  citySlug?: string
  sinceId?: string
}): Promise<number> {
  // count(*) real, no `listEvents(...).length`: con el tope de 50, alguien
  // que vuelve tras muchas horas vería "50" habiendo 200 avisos nuevos.
  // Un tope que el usuario no ve es un contador que miente.
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(events)
    .where(await buildEventFilter(opts))
  return row?.total ?? 0
}
```

**Tres reglas que el feed debe cumplir, y que las pruebas deben demostrar:**

1. `created_at` usa `defaultNow()`, y en Postgres `now()` devuelve el instante
   de inicio de la **transacción**. `requests.ts` y `claims.ts` insertan sus
   eventos dentro de transacciones, así que dos eventos pueden compartir marca
   de tiempo de forma determinista. Por eso el orden es
   `ORDER BY created_at DESC, id DESC` y el corte del `sinceId` compara la
   tupla `(created_at, id)`, no solo la fecha.
2. Si el `sinceId` no existe en la tabla, **se ignora el filtro y se cuenta
   todo**. Ese identificador llega del `localStorage` del navegador; si el
   evento se purgó o el valor se desincronizó, tratarlo como "sin novedades"
   apagaría la campanita de esa persona para siempre y sin error visible.
3. El payload nunca incluye el número de WhatsApp de nadie.

- [ ] **Step 4: Ejecutar y confirmar que pasa**

Run: `npm test -- src/lib/events.test.ts`
Expected: PASS, 5 pruebas.

Si la comparación por `createdAt` falla porque dos eventos comparten el mismo instante, cambiar el orden y la comparación a `(created_at, id)` para desempatar.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: feed de eventos con filtro por ciudad y conteo de no leídos"
```

---

### Task 7: Crear solicitudes

**Files:**
- Create: `src/lib/requests.ts`
- Test: `src/lib/requests.create.test.ts`

**Interfaces:**
- Consumes: `generateToken`, `hashToken`, `generatePublicCode`, `hashIp` (Task 2); `isNearCity` (Task 3); `normalizePhone` (Task 1); `consumeRate` (Task 5); `recordEvent` (Task 6).
- Produces:
  - `createRequestSchema` — esquema Zod del formulario.
  - `createRequest(input: CreateRequestInput, ip: string): Promise<{ publicCode: string; manageToken: string; needsReview: boolean }>`
  - `type CreateRequestInput = z.infer<typeof createRequestSchema>`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/lib/requests.create.test.ts`:

```ts
import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { testDb, resetTestDb, seedTestCity } from '@/test/db'
import { requests, requestItems, events } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createRequest } from './requests'
import { verifyToken } from './tokens'
import { RATE_LIMITS } from './ratelimit'

beforeAll(() => { process.env.IP_HASH_SECRET = 'secreto-de-prueba' })
beforeEach(resetTestDb)

const input = (citySlug = 'cali') => ({
  citySlug,
  title: 'Familia sin agua ni alimentos',
  description: 'Somos cuatro personas, dos son niños.',
  urgency: 'alta' as const,
  items: [{ name: 'Agua', quantity: '10 litros' }, { name: 'Cobijas', quantity: '4' }],
  requesterName: 'Ana Ruiz',
  whatsapp: '300 123 4567',
  lat: 3.44,
  lng: -76.52,
  addressText: 'Calle 5 con carrera 20',
  neighborhood: 'El Diamante',
  peopleCount: 4,
  acceptsPrivacy: true,
  website: '',
})

describe('createRequest', () => {
  it('guarda la solicitud con su código y token', async () => {
    await seedTestCity()
    const result = await createRequest(input(), '1.1.1.1')

    const [row] = await testDb.select().from(requests)
    expect(row.publicCode).toBe(result.publicCode)
    expect(verifyToken(result.manageToken, row.manageTokenHash)).toBe(true)
  })

  it('normaliza el número a formato internacional', async () => {
    await seedTestCity()
    await createRequest(input(), '1.1.1.1')
    const [row] = await testDb.select().from(requests)
    expect(row.whatsapp).toBe('+573001234567')
  })

  it('guarda los ítems en orden', async () => {
    await seedTestCity()
    await createRequest(input(), '1.1.1.1')
    const items = await testDb.select().from(requestItems)
    expect(items.map((i) => i.name).sort()).toEqual(['Agua', 'Cobijas'])
  })

  it('registra el evento de creación', async () => {
    await seedTestCity()
    await createRequest(input(), '1.1.1.1')
    const [event] = await testDb.select().from(events)
    expect(event.type).toBe('request_created')
    expect(event.payload.city).toBe('Cali')
  })

  it('rechaza un número que no es celular colombiano', async () => {
    await seedTestCity()
    await expect(
      createRequest({ ...input(), whatsapp: '6024851234' }, '1.1.1.1')
    ).rejects.toThrow(/celular/i)
  })

  it('rechaza si no se acepta la política de datos', async () => {
    await seedTestCity()
    await expect(
      createRequest({ ...input(), acceptsPrivacy: false }, '1.1.1.1')
    ).rejects.toThrow()
  })

  it('rechaza una solicitud sin ítems', async () => {
    await seedTestCity()
    await expect(createRequest({ ...input(), items: [] }, '1.1.1.1')).rejects.toThrow()
  })

  it('rechaza un pin lejos de la ciudad elegida', async () => {
    await seedTestCity()
    await expect(
      createRequest({ ...input(), lat: 4.711, lng: -74.0721 }, '1.1.1.1')
    ).rejects.toThrow(/ubicación/i)
  })

  it('rechaza una ciudad inexistente', async () => {
    await seedTestCity()
    await expect(createRequest(input('medellin'), '1.1.1.1')).rejects.toThrow(/ciudad/i)
  })

  it('descarta el envío si el campo trampa viene lleno', async () => {
    await seedTestCity()
    await expect(
      createRequest({ ...input(), website: 'http://spam.example' }, '1.1.1.1')
    ).rejects.toThrow()
  })

  it('publica igual al superar el límite, pero marcada para revisión', async () => {
    await seedTestCity()
    let last
    for (let i = 0; i < RATE_LIMITS.create_request + 1; i++) {
      last = await createRequest(input(), '1.1.1.1')
    }
    expect(last!.needsReview).toBe(true)

    const rows = await testDb.select().from(requests).where(eq(requests.needsReview, true))
    expect(rows.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `npm test -- src/lib/requests.create.test.ts`
Expected: FAIL — no existe `./requests`.

- [ ] **Step 3: Implementar**

Crear `src/lib/requests.ts`:

```ts
import { z } from 'zod'
import { db } from '@/db'
import { cities, events, requestItems, requests } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { generatePublicCode, generateToken, hashIp, hashToken } from './tokens'
import { normalizePhone } from './whatsapp'
import { isNearCity } from './geo'
import { consumeRate } from './ratelimit'

export const createRequestSchema = z.object({
  citySlug: z.string().min(1, 'Elige una ciudad'),
  title: z.string().trim().min(8, 'Escribe un título más descriptivo').max(120),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  urgency: z.enum(['alta', 'media', 'baja']),
  items: z
    .array(z.object({
      name: z.string().trim().min(2, 'Escribe qué necesitas').max(80),
      quantity: z.string().trim().max(40).optional().or(z.literal('')),
    }))
    .min(1, 'Agrega al menos una cosa que necesites')
    .max(20),
  requesterName: z.string().trim().min(2, 'Escribe tu nombre').max(80),
  whatsapp: z.string().min(1, 'Escribe tu número de WhatsApp'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  addressText: z.string().trim().max(200).optional().or(z.literal('')),
  neighborhood: z.string().trim().max(80).optional().or(z.literal('')),
  peopleCount: z.number().int().min(1).max(999).optional(),
  // Zod 4 no admite `z.literal(true, { errorMap })`; además el formulario
  // envía un booleano, no siempre `true`.
  acceptsPrivacy: z
    .boolean()
    .refine((v) => v === true, { message: 'Debes autorizar el tratamiento de tus datos' }),
  // Campo trampa: las personas lo dejan vacío, los bots lo llenan.
  website: z.string().max(0, 'Envío rechazado').optional().or(z.literal('')),
})

export type CreateRequestInput = z.input<typeof createRequestSchema>

export async function createRequest(
  raw: CreateRequestInput,
  ip: string
): Promise<{ publicCode: string; manageToken: string; needsReview: boolean }> {
  const input = createRequestSchema.parse(raw)

  const [city] = await db.select().from(cities)
    .where(eq(cities.slug, input.citySlug)).limit(1)
  if (!city || !city.isActive) throw new Error('La ciudad seleccionada no está disponible')

  const phone = normalizePhone(input.whatsapp)
  if (!phone) throw new Error('El número debe ser un celular colombiano de diez dígitos')

  if (!isNearCity({ lat: input.lat, lng: input.lng }, { lat: city.centerLat, lng: city.centerLng })) {
    throw new Error(`La ubicación marcada queda muy lejos de ${city.name}. Revisa el punto en el mapa.`)
  }

  // No bloquea: publica y marca para revisión. Ver spec, sección de abuso.
  const rate = await consumeRate(ip, 'create_request')

  const manageToken = generateToken()
  const publicCode = generatePublicCode()

  return db.transaction(async (tx) => {
    const [row] = await tx.insert(requests).values({
      cityId: city.id,
      publicCode,
      manageTokenHash: hashToken(manageToken),
      title: input.title,
      description: input.description || null,
      urgency: input.urgency,
      requesterName: input.requesterName,
      whatsapp: phone,
      lat: input.lat,
      lng: input.lng,
      addressText: input.addressText || null,
      neighborhood: input.neighborhood || null,
      peopleCount: input.peopleCount ?? null,
      ipHash: hashIp(ip),
      needsReview: rate.exceeded,
    }).returning()

    await tx.insert(requestItems).values(
      input.items.map((item, index) => ({
        requestId: row.id,
        name: item.name,
        quantity: item.quantity || null,
        position: index,
      }))
    )

    await tx.insert(events).values({
      type: 'request_created',
      requestId: row.id,
      cityId: city.id,
      payload: { title: row.title, neighborhood: row.neighborhood, city: city.name },
    })

    return { publicCode, manageToken, needsReview: rate.exceeded }
  })
}
```

- [ ] **Step 4: Ejecutar y confirmar que pasa**

Run: `npm test -- src/lib/requests.create.test.ts`
Expected: PASS, 11 pruebas.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: creación de solicitudes con validación, campo trampa y marca de revisión"
```

---

### Task 8: Claims — reclamar, cancelar y vencer

**Files:**
- Create: `src/lib/claims.ts`
- Test: `src/lib/claims.test.ts`

**Interfaces:**
- Consumes: `generateToken`, `hashToken`, `verifyToken`, `hashIp`; `consumeRate`; `recordEvent`.
- Produces:
  - `CLAIM_HOURS = 6`
  - `claimRequest(input: { publicCode: string; volunteerName: string; volunteerWhatsapp?: string }, ip: string): Promise<{ claimToken: string }>`
  - `cancelClaim(publicCode: string, claimToken: string): Promise<void>`
  - `expireStaleClaims(): Promise<number>` — devuelve cuántos venció. Idempotente.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/lib/claims.test.ts`:

```ts
import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { testDb, resetTestDb, seedTestCity } from '@/test/db'
import { claims, requests } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { claimRequest, cancelClaim, expireStaleClaims } from './claims'

beforeAll(() => { process.env.IP_HASH_SECRET = 'secreto-de-prueba' })
beforeEach(resetTestDb)

async function makeRequest() {
  const city = await seedTestCity()
  const [row] = await testDb.insert(requests).values({
    cityId: city.id, publicCode: 'AAA111', manageTokenHash: 'h',
    title: 'Agua', requesterName: 'Ana', lat: 3.45, lng: -76.53, ipHash: 'i',
  }).returning()
  return row
}

describe('claimRequest', () => {
  it('pasa la solicitud a en_atencion', async () => {
    await makeRequest()
    await claimRequest({ publicCode: 'AAA111', volunteerName: 'Luis' }, '1.1.1.1')

    const [row] = await testDb.select().from(requests)
    expect(row.status).toBe('en_atencion')
  })

  it('devuelve un token que identifica al voluntario', async () => {
    await makeRequest()
    const { claimToken } = await claimRequest({ publicCode: 'AAA111', volunteerName: 'Luis' }, '1.1.1.1')
    expect(claimToken.length).toBeGreaterThan(20)
  })

  it('impide reclamar una solicitud ya reclamada', async () => {
    await makeRequest()
    await claimRequest({ publicCode: 'AAA111', volunteerName: 'Luis' }, '1.1.1.1')
    await expect(
      claimRequest({ publicCode: 'AAA111', volunteerName: 'Marta' }, '2.2.2.2')
    ).rejects.toThrow(/ya está siendo atendida/i)
  })

  it('falla si la solicitud no existe', async () => {
    await expect(
      claimRequest({ publicCode: 'ZZZ999', volunteerName: 'Luis' }, '1.1.1.1')
    ).rejects.toThrow(/no existe/i)
  })
})

describe('cancelClaim', () => {
  it('devuelve la solicitud a abierta', async () => {
    await makeRequest()
    const { claimToken } = await claimRequest({ publicCode: 'AAA111', volunteerName: 'Luis' }, '1.1.1.1')
    await cancelClaim('AAA111', claimToken)

    const [row] = await testDb.select().from(requests)
    expect(row.status).toBe('abierta')
  })

  it('rechaza a quien no tiene el token del claim', async () => {
    await makeRequest()
    await claimRequest({ publicCode: 'AAA111', volunteerName: 'Luis' }, '1.1.1.1')
    await expect(cancelClaim('AAA111', 'token-ajeno')).rejects.toThrow(/no autorizado/i)

    const [row] = await testDb.select().from(requests)
    expect(row.status).toBe('en_atencion')
  })

  it('permite que otra persona reclame después de la cancelación', async () => {
    await makeRequest()
    const { claimToken } = await claimRequest({ publicCode: 'AAA111', volunteerName: 'Luis' }, '1.1.1.1')
    await cancelClaim('AAA111', claimToken)

    await expect(
      claimRequest({ publicCode: 'AAA111', volunteerName: 'Marta' }, '2.2.2.2')
    ).resolves.toBeDefined()
  })
})

describe('expireStaleClaims', () => {
  it('vence los claims cumplidos y reabre la solicitud', async () => {
    const req = await makeRequest()
    const { claimToken } = await claimRequest({ publicCode: 'AAA111', volunteerName: 'Luis' }, '1.1.1.1')
    expect(claimToken).toBeDefined()

    await testDb.update(claims)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(claims.requestId, req.id))

    expect(await expireStaleClaims()).toBe(1)

    const [row] = await testDb.select().from(requests)
    expect(row.status).toBe('abierta')
    const [claim] = await testDb.select().from(claims)
    expect(claim.status).toBe('vencido')
  })

  it('no toca los claims vigentes', async () => {
    await makeRequest()
    await claimRequest({ publicCode: 'AAA111', volunteerName: 'Luis' }, '1.1.1.1')

    expect(await expireStaleClaims()).toBe(0)

    const [row] = await testDb.select().from(requests)
    expect(row.status).toBe('en_atencion')
  })

  it('es idempotente', async () => {
    const req = await makeRequest()
    await claimRequest({ publicCode: 'AAA111', volunteerName: 'Luis' }, '1.1.1.1')
    await testDb.update(claims)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(claims.requestId, req.id))

    await expireStaleClaims()
    expect(await expireStaleClaims()).toBe(0)
  })

  it('no reabre una solicitud que ya fue atendida', async () => {
    const req = await makeRequest()
    await claimRequest({ publicCode: 'AAA111', volunteerName: 'Luis' }, '1.1.1.1')
    await testDb.update(requests).set({ status: 'atendida' }).where(eq(requests.id, req.id))
    await testDb.update(claims)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(claims.requestId, req.id))

    await expireStaleClaims()

    const [row] = await testDb.select().from(requests)
    expect(row.status).toBe('atendida')
  })
})
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `npm test -- src/lib/claims.test.ts`
Expected: FAIL — no existe `./claims`.

- [ ] **Step 3: Implementar**

Crear `src/lib/claims.ts`:

```ts
import { and, eq, lt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { cities, claims, events, requests } from '@/db/schema'
import { generateToken, hashIp, hashToken, verifyToken } from './tokens'
import { consumeRate } from './ratelimit'

export const CLAIM_HOURS = 6

export async function claimRequest(
  input: { publicCode: string; volunteerName: string; volunteerWhatsapp?: string },
  ip: string
): Promise<{ claimToken: string }> {
  const name = input.volunteerName.trim()
  if (name.length < 2) throw new Error('Escribe tu nombre para que sepan quién va')

  await consumeRate(ip, 'create_claim')

  const [found] = await db
    .select({ request: requests, cityName: cities.name })
    .from(requests)
    .innerJoin(cities, eq(requests.cityId, cities.id))
    .where(eq(requests.publicCode, input.publicCode))
    .limit(1)
  if (!found) throw new Error('Esta solicitud no existe')
  const request = found.request
  if (request.status === 'en_atencion') throw new Error('Esta solicitud ya está siendo atendida')
  if (request.status !== 'abierta') throw new Error('Esta solicitud ya no está abierta')

  const claimToken = generateToken()
  const expiresAt = new Date(Date.now() + CLAIM_HOURS * 3600_000)

  // El chequeo de estado de arriba no basta: entre leerlo e insertar, otro
  // voluntario puede haber reclamado la misma solicitud. El índice único
  // parcial lo impide en la base, pero su violación llegaría al usuario como
  // una excepción cruda de Postgres. Se traduce por código de error (23505),
  // no por texto, que cambia entre versiones.
  try {
    await db.transaction(async (tx) => {
    await tx.insert(claims).values({
      requestId: request.id,
      volunteerName: name,
      volunteerWhatsapp: input.volunteerWhatsapp || null,
      claimTokenHash: hashToken(claimToken),
      ipHash: hashIp(ip),
      expiresAt,
    })

    await tx.update(requests)
      .set({ status: 'en_atencion', updatedAt: new Date() })
      .where(eq(requests.id, request.id))

    await tx.insert(events).values({
      type: 'request_claimed',
      requestId: request.id,
      cityId: request.cityId,
      payload: { title: request.title, neighborhood: request.neighborhood, city: found.cityName },
      })
    })
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      throw new Error('Esta solicitud ya está siendo atendida')
    }
    throw error
  }

  return { claimToken }
}

export async function cancelClaim(publicCode: string, claimToken: string): Promise<void> {
  const [row] = await db
    .select({ claim: claims, requestId: requests.id })
    .from(claims)
    .innerJoin(requests, eq(claims.requestId, requests.id))
    .where(and(eq(requests.publicCode, publicCode), eq(claims.status, 'activo')))
    .limit(1)

  if (!row) throw new Error('No hay nadie en camino para esta solicitud')
  if (!verifyToken(claimToken, row.claim.claimTokenHash)) throw new Error('No autorizado')

  await db.transaction(async (tx) => {
    await tx.update(claims).set({ status: 'cancelado' }).where(eq(claims.id, row.claim.id))
    await tx.update(requests)
      .set({ status: 'abierta', updatedAt: new Date() })
      .where(and(eq(requests.id, row.requestId), eq(requests.status, 'en_atencion')))
  })
}

/**
 * Vence los claims cumplidos y reabre sus solicitudes. Se llama antes de cada
 * listado, así la reapertura no depende de un cron. Idempotente por diseño.
 */
export async function expireStaleClaims(): Promise<number> {
  // Las dos escrituras van en una transacción. Si el proceso muriera entre
  // ellas, el claim quedaría `vencido` y la solicitud pegada en
  // `en_atencion` sin claim activo: el filtro `status = 'activo'` ya no la
  // encontraría en ninguna corrida futura y la necesidad quedaría enterrada
  // para siempre, que es justo lo que esta función existe para evitar.
  return db.transaction(async (tx) => {
    const expired = await tx
      .update(claims)
      .set({ status: 'vencido' })
      .where(and(eq(claims.status, 'activo'), lt(claims.expiresAt, new Date())))
      .returning({ requestId: claims.requestId })

    if (expired.length === 0) return 0

    const ids = expired.map((e) => e.requestId)
    // Solo reabre lo que sigue en atención: si ya la marcaron atendida, no se toca.
    await tx
      .update(requests)
      .set({ status: 'abierta', updatedAt: new Date() })
      .where(and(
        eq(requests.status, 'en_atencion'),
        sql`${requests.id} in ${ids}`
      ))

    return expired.length
  })
}
```

- [ ] **Step 4: Ejecutar y confirmar que pasa**

Run: `npm test -- src/lib/claims.test.ts`
Expected: PASS, 11 pruebas.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: reclamar, cancelar y vencer claims con token de voluntario"
```

---

### Task 9: Listar, consultar y cerrar solicitudes

**Files:**
- Modify: `src/lib/requests.ts`
- Test: `src/lib/requests.read.test.ts`

**Interfaces:**
- Consumes: `expireStaleClaims` (Task 8); `verifyToken` (Task 2); `distanceKm` (Task 3).
- Produces:
  - `type RequestListItem` — **sin `whatsapp`**: código, título, urgencia, estado, barrio, ciudad, coordenadas, nombre de quien va en camino, hasta tres ítems de muestra, total de ítems, fecha y distancia opcional.
  - `listRequests(filters: ListFilters): Promise<RequestListItem[]>`
  - `type ListFilters = { citySlug?: string; statuses?: RequestStatus[]; urgency?: Urgency; search?: string; near?: Coords; limit?: number }`
  - `getRequestByCode(code: string, manageToken?: string): Promise<RequestDetail | null>` — incluye `canManage: boolean` y todos los ítems, nunca el número.
  - `fulfillRequest(code: string, manageToken: string): Promise<void>`
  - `cancelRequest(code: string, manageToken: string): Promise<void>`
  - `getContactPhone(code: string): Promise<{ phone: string; title: string } | null>` — único punto del sistema que devuelve el número.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/lib/requests.read.test.ts`:

```ts
import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { sql } from 'drizzle-orm'
import { testDb, resetTestDb, seedTestCity } from '@/test/db'
import { cities, requests } from '@/db/schema'
import { createRequest, listRequests, getRequestByCode, fulfillRequest, cancelRequest, getContactPhone } from './requests'
import { claimRequest } from './claims'

beforeAll(() => { process.env.IP_HASH_SECRET = 'secreto-de-prueba' })
beforeEach(resetTestDb)

const input = (over: Record<string, unknown> = {}) => ({
  citySlug: 'cali',
  title: 'Familia sin agua ni alimentos',
  urgency: 'alta' as const,
  items: [{ name: 'Agua', quantity: '10 litros' }],
  requesterName: 'Ana Ruiz',
  whatsapp: '3001234567',
  lat: 3.44,
  lng: -76.52,
  neighborhood: 'El Diamante',
  acceptsPrivacy: true as const,
  website: '',
  ...over,
})

describe('listRequests', () => {
  it('nunca incluye el número de WhatsApp', async () => {
    await seedTestCity()
    await createRequest(input(), '1.1.1.1')

    const [item] = await listRequests({})
    expect(JSON.stringify(item)).not.toContain('573001234567')
    expect(item).not.toHaveProperty('whatsapp')
  })

  it('muestra por defecto solo abiertas y en atención', async () => {
    await seedTestCity()
    const a = await createRequest(input({ title: 'Necesito agua potable' }), '1.1.1.1')
    await createRequest(input({ title: 'Necesito cobijas gruesas' }), '1.1.1.1')
    await fulfillRequest(a.publicCode, a.manageToken)

    const list = await listRequests({})
    expect(list).toHaveLength(1)
    expect(list[0].title).toBe('Necesito cobijas gruesas')
  })

  it('devuelve las atendidas cuando se piden explícitamente', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await fulfillRequest(a.publicCode, a.manageToken)

    const list = await listRequests({ statuses: ['atendida'] })
    expect(list).toHaveLength(1)
  })

  it('filtra por ciudad', async () => {
    await seedTestCity()
    await testDb.insert(cities).values({
      slug: 'armenia', name: 'Armenia', department: 'Quindío',
      centerLat: 4.5339, centerLng: -75.6811, position: 2,
    })
    await createRequest(input(), '1.1.1.1')
    await createRequest(input({ citySlug: 'armenia', lat: 4.53, lng: -75.68 }), '1.1.1.1')

    expect(await listRequests({ citySlug: 'cali' })).toHaveLength(1)
    expect(await listRequests({})).toHaveLength(2)
  })

  it('filtra por urgencia', async () => {
    await seedTestCity()
    await createRequest(input({ urgency: 'alta' }), '1.1.1.1')
    await createRequest(input({ urgency: 'baja', title: 'Necesitamos ropa seca' }), '1.1.1.1')

    const altas = await listRequests({ urgency: 'alta' })
    expect(altas).toHaveLength(1)
  })

  it('busca por título y por barrio', async () => {
    await seedTestCity()
    await createRequest(input({ title: 'Necesitamos pañales', neighborhood: 'Siloé' }), '1.1.1.1')
    await createRequest(input({ title: 'Necesitamos agua potable', neighborhood: 'Aguablanca' }), '1.1.1.1')

    expect(await listRequests({ search: 'pañales' })).toHaveLength(1)
    expect(await listRequests({ search: 'aguablanca' })).toHaveLength(1)
  })

  it('incluye una muestra de los ítems y el total', async () => {
    await seedTestCity()
    await createRequest(input({
      items: [
        { name: 'Agua' }, { name: 'Arroz' }, { name: 'Cobijas' }, { name: 'Pañales' },
      ],
    }), '1.1.1.1')

    const [item] = await listRequests({})
    expect(item.itemsPreview).toHaveLength(3)
    expect(item.itemCount).toBe(4)
  })

  it('ordena por cercanía cuando se entrega un punto', async () => {
    await seedTestCity()
    await createRequest(input({ title: 'Lejos del punto de referencia', lat: 3.50, lng: -76.60 }), '1.1.1.1')
    await createRequest(input({ title: 'Cerca del punto de referencia', lat: 3.441, lng: -76.521 }), '1.1.1.1')

    const list = await listRequests({ near: { lat: 3.44, lng: -76.52 } })
    expect(list[0].title).toBe('Cerca del punto de referencia')
    expect(list[0].distanceKm).toBeLessThan(list[1].distanceKm!)
  })

  it('oculta lo que la moderación escondió', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await testDb.update(requests).set({ isHidden: true })

    expect(await listRequests({})).toHaveLength(0)
    expect(a.publicCode).toBeDefined()
  })

  it('vence los claims cumplidos antes de responder', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await claimRequest({ publicCode: a.publicCode, volunteerName: 'Luis' }, '2.2.2.2')
    await testDb.execute(sql`UPDATE claims SET expires_at = now() - interval '1 hour'`)

    const [item] = await listRequests({})
    expect(item.status).toBe('abierta')
  })

  it('muestra quién va en camino', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await claimRequest({ publicCode: a.publicCode, volunteerName: 'Luis Pérez' }, '2.2.2.2')

    const [item] = await listRequests({})
    expect(item.claimedBy).toBe('Luis Pérez')
  })
})

describe('getRequestByCode', () => {
  it('devuelve el detalle sin el número', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')

    const detail = await getRequestByCode(a.publicCode)
    expect(detail?.title).toBe('Familia sin agua ni alimentos')
    expect(JSON.stringify(detail)).not.toContain('573001234567')
    expect(detail?.canManage).toBe(false)
  })

  it('marca canManage con el token correcto', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')

    const detail = await getRequestByCode(a.publicCode, a.manageToken)
    expect(detail?.canManage).toBe(true)
  })

  it('devuelve null si no existe', async () => {
    expect(await getRequestByCode('ZZZ999')).toBeNull()
  })
})

describe('cierre de solicitudes', () => {
  it('marca como atendida con el token correcto', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await fulfillRequest(a.publicCode, a.manageToken)

    const [row] = await testDb.select().from(requests)
    expect(row.status).toBe('atendida')
    expect(row.fulfilledAt).not.toBeNull()
  })

  it('rechaza a quien no tiene el token', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await expect(fulfillRequest(a.publicCode, 'token-ajeno')).rejects.toThrow(/no autorizado/i)
  })

  it('cancela con el token correcto', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await cancelRequest(a.publicCode, a.manageToken)

    const [row] = await testDb.select().from(requests)
    expect(row.status).toBe('cancelada')
  })

  it('cierra también el claim activo al marcar atendida', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await claimRequest({ publicCode: a.publicCode, volunteerName: 'Luis' }, '2.2.2.2')
    await fulfillRequest(a.publicCode, a.manageToken)

    const rows = await testDb.select().from(requests)
    expect(rows[0].status).toBe('atendida')
  })
})

describe('getContactPhone', () => {
  it('devuelve el número solo por esta vía', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')

    const contact = await getContactPhone(a.publicCode)
    expect(contact?.phone).toBe('+573001234567')
  })

  it('no entrega número de solicitudes ocultas', async () => {
    await seedTestCity()
    const a = await createRequest(input(), '1.1.1.1')
    await testDb.update(requests).set({ isHidden: true })

    expect(await getContactPhone(a.publicCode)).toBeNull()
  })
})
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `npm test -- src/lib/requests.read.test.ts`
Expected: FAIL — `listRequests` no está exportada.

- [ ] **Step 3: Añadir las funciones de lectura y cierre a `src/lib/requests.ts`**

Añadir al final del archivo:

```ts
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { claims } from '@/db/schema'
import { expireStaleClaims } from './claims'
import { verifyToken } from './tokens'
import { distanceKm, type Coords } from './geo'

export type RequestStatus = 'abierta' | 'en_atencion' | 'atendida' | 'cancelada' | 'archivada'
export type Urgency = 'alta' | 'media' | 'baja'

const VISIBLE_BY_DEFAULT: RequestStatus[] = ['abierta', 'en_atencion']

export type RequestListItem = {
  publicCode: string
  title: string
  urgency: Urgency
  status: RequestStatus
  neighborhood: string | null
  cityName: string
  citySlug: string
  lat: number
  lng: number
  itemsPreview: string[]
  itemCount: number
  claimedBy: string | null
  createdAt: Date
  distanceKm?: number
}

export type ListFilters = {
  citySlug?: string
  statuses?: RequestStatus[]
  urgency?: Urgency
  search?: string
  near?: Coords
  limit?: number
}

export async function listRequests(filters: ListFilters): Promise<RequestListItem[]> {
  // Reabre lo abandonado antes de responder: la spec no usa cron para esto.
  await expireStaleClaims()

  const statuses = filters.statuses?.length ? filters.statuses : VISIBLE_BY_DEFAULT
  const conditions = [eq(requests.isHidden, false), inArray(requests.status, statuses)]

  if (filters.citySlug) conditions.push(eq(cities.slug, filters.citySlug))
  if (filters.urgency) conditions.push(eq(requests.urgency, filters.urgency))
  if (filters.search) {
    const term = `%${filters.search}%`
    conditions.push(
      or(ilike(requests.title, term), ilike(requests.neighborhood, term)) as never
    )
  }

  const rows = await db
    .select({
      publicCode: requests.publicCode,
      title: requests.title,
      urgency: requests.urgency,
      status: requests.status,
      neighborhood: requests.neighborhood,
      lat: requests.lat,
      lng: requests.lng,
      createdAt: requests.createdAt,
      cityName: cities.name,
      citySlug: cities.slug,
      itemsPreview: sql<string[]>`(
        select coalesce(array_agg(name order by position), '{}')
        from (
          select name, position from ${requestItems}
          where request_id = ${requests.id} order by position limit 3
        ) t
      )`,
      itemCount: sql<number>`(
        select count(*)::int from ${requestItems} where request_id = ${requests.id}
      )`,
      claimedBy: sql<string | null>`(
        select volunteer_name from ${claims}
        where request_id = ${requests.id} and status = 'activo' limit 1
      )`,
    })
    .from(requests)
    .innerJoin(cities, eq(requests.cityId, cities.id))
    .where(and(...conditions))
    .orderBy(desc(requests.createdAt))
    .limit(Math.min(filters.limit ?? 200, 200))

  const items = rows as unknown as RequestListItem[]

  if (!filters.near) return items

  return items
    .map((item) => ({
      ...item,
      distanceKm: distanceKm(filters.near!, { lat: item.lat, lng: item.lng }),
    }))
    .sort((a, b) => a.distanceKm! - b.distanceKm!)
}

export type RequestDetail = Omit<RequestListItem, 'itemsPreview' | 'distanceKm'> & {
  description: string | null
  addressText: string | null
  requesterName: string
  peopleCount: number | null
  items: { name: string; quantity: string | null }[]
  canManage: boolean
  fulfilledAt: Date | null
}

export async function getRequestByCode(
  code: string,
  manageToken?: string
): Promise<RequestDetail | null> {
  await expireStaleClaims()

  const [row] = await db
    .select({ request: requests, cityName: cities.name, citySlug: cities.slug })
    .from(requests)
    .innerJoin(cities, eq(requests.cityId, cities.id))
    .where(and(eq(requests.publicCode, code), eq(requests.isHidden, false)))
    .limit(1)

  if (!row) return null

  const items = await db
    .select({ name: requestItems.name, quantity: requestItems.quantity })
    .from(requestItems)
    .where(eq(requestItems.requestId, row.request.id))
    .orderBy(requestItems.position)

  const [claim] = await db
    .select({ volunteerName: claims.volunteerName })
    .from(claims)
    .where(and(eq(claims.requestId, row.request.id), eq(claims.status, 'activo')))
    .limit(1)

  const r = row.request
  return {
    publicCode: r.publicCode,
    title: r.title,
    description: r.description,
    urgency: r.urgency,
    status: r.status,
    neighborhood: r.neighborhood,
    addressText: r.addressText,
    requesterName: r.requesterName,
    peopleCount: r.peopleCount,
    lat: r.lat,
    lng: r.lng,
    cityName: row.cityName,
    citySlug: row.citySlug,
    items,
    itemCount: items.length,
    claimedBy: claim?.volunteerName ?? null,
    createdAt: r.createdAt,
    fulfilledAt: r.fulfilledAt,
    canManage: manageToken ? verifyToken(manageToken, r.manageTokenHash) : false,
  }
}

async function requireOwner(code: string, manageToken: string) {
  const [row] = await db
    .select({ request: requests, cityName: cities.name })
    .from(requests)
    .innerJoin(cities, eq(requests.cityId, cities.id))
    .where(eq(requests.publicCode, code))
    .limit(1)

  if (!row) throw new Error('Esta solicitud no existe')
  if (!verifyToken(manageToken, row.request.manageTokenHash)) throw new Error('No autorizado')
  return row
}

export async function fulfillRequest(code: string, manageToken: string): Promise<void> {
  const { request, cityName } = await requireOwner(code, manageToken)

  await db.transaction(async (tx) => {
    await tx.update(requests)
      .set({ status: 'atendida', fulfilledAt: new Date(), updatedAt: new Date() })
      .where(eq(requests.id, request.id))

    await tx.update(claims)
      .set({ status: 'completado' })
      .where(and(eq(claims.requestId, request.id), eq(claims.status, 'activo')))

    await tx.insert(events).values({
      type: 'request_fulfilled',
      requestId: request.id,
      cityId: request.cityId,
      payload: { title: request.title, neighborhood: request.neighborhood, city: cityName },
    })
  })
}

/**
 * Cancelar anonimiza en el acto, no solo cambia el estado.
 *
 * La política de datos dice que al cancelar los datos desaparecen sin
 * esperar ningún plazo, y quien pulsa ese botón suele ser alguien que está
 * recibiendo llamadas indeseadas o se arrepintió de publicar dónde vive.
 * Dejar su nombre, su teléfono y su dirección otros 60 días convertiría esa
 * frase en mentira.
 *
 * Marcar como atendida NO anonimiza: quien recibió la ayuda no está pidiendo
 * un borrado, y su solicitud sigue el plazo normal.
 */
export async function cancelRequest(code: string, manageToken: string): Promise<void> {
  const { request } = await requireOwner(code, manageToken)

  await db.transaction(async (tx) => {
    await tx.update(requests)
      .set({
        status: 'cancelada',
        requesterName: 'Anónimo',
        whatsapp: null,
        addressText: null,
        lat: sql`round(${requests.lat}::numeric, 2)::double precision`,
        lng: sql`round(${requests.lng}::numeric, 2)::double precision`,
        anonymizedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(requests.id, request.id))
    await tx.update(claims)
      .set({ status: 'cancelado' })
      .where(and(eq(claims.requestId, request.id), eq(claims.status, 'activo')))
  })
}

/**
 * Único lugar del sistema que devuelve el número. Todo lo demás lo omite,
 * para que el listado público no sirva de directorio de víctimas.
 */
export async function getContactPhone(
  code: string
): Promise<{ phone: string; title: string } | null> {
  const [row] = await db
    .select({ phone: requests.whatsapp, title: requests.title })
    .from(requests)
    .where(and(eq(requests.publicCode, code), eq(requests.isHidden, false)))
    .limit(1)

  if (!row?.phone) return null
  return { phone: row.phone, title: row.title }
}
```

Mover todos los `import` añadidos al principio del archivo, junto a los existentes, y unificar los que se repiten.

- [ ] **Step 4: Ejecutar y confirmar que pasa**

Run: `npm test -- src/lib/requests.read.test.ts`
Expected: PASS, 19 pruebas.

- [ ] **Step 5: Ejecutar toda la batería**

Run: `npm test`
Expected: PASS, sin regresiones en las tareas anteriores.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: listado con filtros, detalle y cierre de solicitudes"
```

---

### Task 10: Mantenimiento — anonimizar y archivar

**Files:**
- Create: `src/lib/maintenance.ts`, `src/scripts/maintenance.ts`
- Test: `src/lib/maintenance.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `db`, esquema.
- Produces:
  - `ANONYMIZE_AFTER_DAYS = 60`, `ARCHIVE_AFTER_DAYS = 14`
  - `anonymizeOldRequests(): Promise<number>`
  - `archiveStaleRequests(): Promise<number>`
  - `runMaintenance(): Promise<{ anonymized: number; archived: number }>`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/lib/maintenance.test.ts`:

```ts
import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { testDb, resetTestDb, seedTestCity } from '@/test/db'
import { requests } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { runMaintenance, anonymizeOldRequests, archiveStaleRequests } from './maintenance'

beforeAll(() => { process.env.IP_HASH_SECRET = 'secreto-de-prueba' })
beforeEach(resetTestDb)

async function makeRequest(over: Record<string, unknown> = {}) {
  const city = await seedTestCity()
  const [row] = await testDb.insert(requests).values({
    cityId: city.id, publicCode: `C${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    manageTokenHash: 'h', title: 'Agua', requesterName: 'Ana',
    whatsapp: '+573001234567', addressText: 'Calle 5 #20-30',
    neighborhood: 'El Diamante', lat: 3.45, lng: -76.53, ipHash: 'i',
    ...over,
  }).returning()
  return row
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)

describe('anonymizeOldRequests', () => {
  it('borra los datos personales de lo cerrado hace más de 60 días', async () => {
    const row = await makeRequest({ status: 'atendida', fulfilledAt: daysAgo(61), updatedAt: daysAgo(61) })

    expect(await anonymizeOldRequests()).toBe(1)

    const [after] = await testDb.select().from(requests).where(eq(requests.id, row.id))
    expect(after.whatsapp).toBeNull()
    expect(after.requesterName).toBe('Anónimo')
    expect(after.addressText).toBeNull()
    expect(after.anonymizedAt).not.toBeNull()
  })

  it('conserva lo que sirve para estadística', async () => {
    const row = await makeRequest({ status: 'atendida', fulfilledAt: daysAgo(61), updatedAt: daysAgo(61) })
    await anonymizeOldRequests()

    const [after] = await testDb.select().from(requests).where(eq(requests.id, row.id))
    expect(after.neighborhood).toBe('El Diamante')
    expect(after.cityId).toBe(row.cityId)
  })

  it('no toca lo cerrado hace poco', async () => {
    await makeRequest({ status: 'atendida', fulfilledAt: daysAgo(10), updatedAt: daysAgo(10) })
    expect(await anonymizeOldRequests()).toBe(0)
  })

  it('no toca lo que sigue abierto, por antiguo que sea', async () => {
    await makeRequest({ status: 'abierta', updatedAt: daysAgo(200) })
    expect(await anonymizeOldRequests()).toBe(0)
  })

  it('es idempotente', async () => {
    await makeRequest({ status: 'atendida', fulfilledAt: daysAgo(61), updatedAt: daysAgo(61) })
    await anonymizeOldRequests()
    expect(await anonymizeOldRequests()).toBe(0)
  })

  it('mide desde el cierre, no desde la última edición', async () => {
    // Cerrada hace 61 días pero editada hace 2: debe anonimizarse igual.
    // Con `updatedAt` como referencia, el reloj se reiniciaría y la
    // plataforma incumpliría su propia política de datos en silencio.
    await makeRequest({ status: 'atendida', fulfilledAt: daysAgo(61), updatedAt: daysAgo(2) })
    expect(await anonymizeOldRequests()).toBe(1)
  })
})

describe('archiveStaleRequests', () => {
  it('archiva lo abierto sin movimiento en 14 días', async () => {
    const row = await makeRequest({ status: 'abierta', updatedAt: daysAgo(15) })

    expect(await archiveStaleRequests()).toBe(1)

    const [after] = await testDb.select().from(requests).where(eq(requests.id, row.id))
    expect(after.status).toBe('archivada')
  })

  it('no archiva lo que tuvo movimiento reciente', async () => {
    await makeRequest({ status: 'abierta', updatedAt: daysAgo(3) })
    expect(await archiveStaleRequests()).toBe(0)
  })

  it('no archiva lo que está en atención', async () => {
    await makeRequest({ status: 'en_atencion', updatedAt: daysAgo(20) })
    expect(await archiveStaleRequests()).toBe(0)
  })

  it('es idempotente', async () => {
    await makeRequest({ status: 'abierta', updatedAt: daysAgo(15) })
    await archiveStaleRequests()
    expect(await archiveStaleRequests()).toBe(0)
  })
})

describe('runMaintenance', () => {
  it('ejecuta ambas tareas y reporta el conteo', async () => {
    await makeRequest({ status: 'abierta', updatedAt: daysAgo(15) })
    await makeRequest({ status: 'atendida', fulfilledAt: daysAgo(61), updatedAt: daysAgo(61) })

    const result = await runMaintenance()
    expect(result).toEqual({ anonymized: 1, archived: 1 })
  })
})
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `npm test -- src/lib/maintenance.test.ts`
Expected: FAIL — no existe `./maintenance`.

- [ ] **Step 3: Implementar**

Crear `src/lib/maintenance.ts`:

```ts
import { and, inArray, isNull, lt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { requests } from '@/db/schema'

export const ANONYMIZE_AFTER_DAYS = 60
export const ARCHIVE_AFTER_DAYS = 14

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)

/**
 * Borra los datos personales de las solicitudes cerradas hace más de 60 días.
 * Conserva ciudad, barrio, ítems y fechas, que sirven para entender qué faltó.
 * Idempotente: `anonymized_at` marca lo ya procesado.
 */
export async function anonymizeOldRequests(): Promise<number> {
  const rows = await db
    .update(requests)
    .set({
      requesterName: 'Anónimo',
      whatsapp: null,
      addressText: null,
      // Redondea a ~1 km para que no se pueda ubicar la vivienda.
      lat: sql`round(${requests.lat}::numeric, 2)::double precision`,
      lng: sql`round(${requests.lng}::numeric, 2)::double precision`,
      anonymizedAt: new Date(),
    })
    .where(and(
      inArray(requests.status, ['atendida', 'cancelada']),
      // Se mide desde el cierre real, no desde la última modificación:
      // `updatedAt` avanza con cualquier edición posterior y reiniciaría el
      // reloj, retrasando la anonimización más allá del plazo que la
      // política de datos promete. Las atendidas tienen `fulfilledAt`; las
      // canceladas caen a `updatedAt`, que en su caso es el cierre.
      lt(
        sql`coalesce(${requests.fulfilledAt}, ${requests.updatedAt})`,
        daysAgo(ANONYMIZE_AFTER_DAYS)
      ),
      isNull(requests.anonymizedAt)
    ))
    .returning({ id: requests.id })

  return rows.length
}

/** Saca del mapa las solicitudes abiertas que nadie tocó en dos semanas. */
export async function archiveStaleRequests(): Promise<number> {
  const rows = await db
    .update(requests)
    .set({ status: 'archivada' })
    .where(and(
      inArray(requests.status, ['abierta']),
      lt(requests.updatedAt, daysAgo(ARCHIVE_AFTER_DAYS))
    ))
    .returning({ id: requests.id })

  return rows.length
}

export async function runMaintenance(): Promise<{ anonymized: number; archived: number }> {
  return {
    anonymized: await anonymizeOldRequests(),
    archived: await archiveStaleRequests(),
  }
}
```

Crear `src/scripts/maintenance.ts`:

```ts
import 'dotenv/config'
import { runMaintenance } from '@/lib/maintenance'

runMaintenance()
  .then((result) => {
    console.log(`[${new Date().toISOString()}] anonimizadas: ${result.anonymized}, archivadas: ${result.archived}`)
    process.exit(0)
  })
  .catch((error) => {
    console.error(`[${new Date().toISOString()}] falló el mantenimiento:`, error)
    process.exit(1)
  })
```

Añadir a `package.json` en `scripts`:

```json
"maintenance": "tsx src/scripts/maintenance.ts"
```

- [ ] **Step 4: Ejecutar y confirmar que pasa**

Run: `npm test -- src/lib/maintenance.test.ts`
Expected: PASS, 10 pruebas.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: mantenimiento idempotente que anonimiza y archiva"
```

---

### Task 11: Endpoints de contacto y de eventos

**Files:**
- Create: `src/lib/request-ip.ts`, `src/app/api/requests/[code]/contact/route.ts`, `src/app/api/events/route.ts`
- Test: `src/lib/request-ip.test.ts`, `src/app/api/contact.test.ts`

**Interfaces:**
- Consumes: `getContactPhone`, `buildWhatsAppLink`, `consumeRate`, `listEvents`.
- Produces:
  - `getClientIp(headers: Headers): string`
  - `POST /api/requests/[code]/contact` → `{ link: string }` o error 404 / 429.
  - `GET /api/events?ciudad=<slug>&desde=<id>` → `{ events: [...] }`.

- [ ] **Step 1: Escribir la prueba de la IP**

Crear `src/lib/request-ip.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getClientIp } from './request-ip'

describe('getClientIp', () => {
  it('toma la primera IP de x-forwarded-for', () => {
    const h = new Headers({ 'x-forwarded-for': '190.1.1.1, 10.0.0.1' })
    expect(getClientIp(h)).toBe('190.1.1.1')
  })

  it('usa x-real-ip cuando no hay x-forwarded-for', () => {
    expect(getClientIp(new Headers({ 'x-real-ip': '190.2.2.2' }))).toBe('190.2.2.2')
  })

  it('devuelve un marcador cuando no hay cabeceras', () => {
    expect(getClientIp(new Headers())).toBe('0.0.0.0')
  })
})
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `npm test -- src/lib/request-ip.test.ts`
Expected: FAIL — no existe `./request-ip`.

- [ ] **Step 3: Implementar el ayudante**

Crear `src/lib/request-ip.ts`:

```ts
/**
 * La IP de confianza es la que escribe nuestro proxy, no la que manda el
 * cliente.
 *
 * `x-real-ip` la fija nginx con `proxy_set_header X-Real-IP $remote_addr`,
 * que SOBRESCRIBE cualquier valor enviado por el cliente: no es falsificable.
 *
 * `x-forwarded-for` sí lo es: con `$proxy_add_x_forwarded_for`, nginx AÑADE
 * la IP real al final de lo que el cliente mandó. Leer el primer valor
 * dejaría que un bot eligiera su propia identidad en cada petición, con un
 * hash distinto cada vez, y el límite del endpoint de contacto no saltaría
 * nunca — es decir, cualquiera podría recolectar los números de todas las
 * personas que pidieron ayuda. Por eso se lee el ÚLTIMO valor, no el primero.
 */
export function getClientIp(headers: Headers): string {
  const realIp = headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const hops = forwarded.split(',').map((h) => h.trim()).filter(Boolean)
    if (hops.length) return hops[hops.length - 1]
  }

  return '0.0.0.0'
}
```

- [ ] **Step 4: Escribir la prueba del endpoint de contacto**

Crear `src/app/api/contact.test.ts`:

```ts
import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { resetTestDb, seedTestCity } from '@/test/db'
import { createRequest } from '@/lib/requests'
import { POST } from './requests/[code]/contact/route'

beforeAll(() => { process.env.IP_HASH_SECRET = 'secreto-de-prueba' })
beforeEach(resetTestDb)

const input = {
  citySlug: 'cali',
  title: 'Familia sin agua ni alimentos',
  urgency: 'alta' as const,
  items: [{ name: 'Agua' }],
  requesterName: 'Ana',
  whatsapp: '3001234567',
  lat: 3.44,
  lng: -76.52,
  acceptsPrivacy: true as const,
  website: '',
}

function request() {
  return new Request('http://localhost/api/requests/X/contact', {
    method: 'POST',
    headers: { 'x-forwarded-for': '190.1.1.1' },
  })
}

describe('POST /api/requests/[code]/contact', () => {
  it('devuelve el enlace de WhatsApp con el título en el mensaje', async () => {
    await seedTestCity()
    const created = await createRequest(input, '1.1.1.1')

    const res = await POST(request(), { params: Promise.resolve({ code: created.publicCode }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.link).toContain('https://wa.me/573001234567')
    expect(decodeURIComponent(body.link)).toContain('Familia sin agua')
  })

  it('responde 404 para un código inexistente', async () => {
    const res = await POST(request(), { params: Promise.resolve({ code: 'ZZZ999' }) })
    expect(res.status).toBe(404)
  })

  it('responde 429 al pasarse del límite de consultas', async () => {
    await seedTestCity()
    const created = await createRequest(input, '1.1.1.1')
    const params = { params: Promise.resolve({ code: created.publicCode }) }

    let last: Response | undefined
    for (let i = 0; i < 45; i++) last = await POST(request(), params)

    expect(last!.status).toBe(429)
  })
})
```

- [ ] **Step 5: Ejecutar y confirmar que falla**

Run: `npm test -- src/app/api/contact.test.ts`
Expected: FAIL — no existe la ruta.

- [ ] **Step 6: Implementar los endpoints**

Crear `src/app/api/requests/[code]/contact/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getContactPhone } from '@/lib/requests'
import { buildWhatsAppLink } from '@/lib/whatsapp'
import { consumeRate } from '@/lib/ratelimit'
import { getClientIp } from '@/lib/request-ip'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const ip = getClientIp(request.headers)

  // Aquí el límite sí bloquea: es la defensa contra la recolección masiva
  // de números, no contra alguien que pide ayuda.
  const rate = await consumeRate(ip, 'contact')
  if (rate.exceeded) {
    return NextResponse.json(
      { error: 'Demasiadas consultas seguidas. Espera unos minutos.' },
      { status: 429 }
    )
  }

  const contact = await getContactPhone(code)
  if (!contact) {
    return NextResponse.json({ error: 'Esta solicitud ya no está disponible' }, { status: 404 })
  }

  const message = `Hola, te escribo por la solicitud "${contact.title}" que publicaste en Reporta Cali. ¿Todavía necesitas ayuda?`
  return NextResponse.json({ link: buildWhatsAppLink(contact.phone, message) })
}
```

Crear `src/app/api/events/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { listEvents } from '@/lib/events'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const citySlug = url.searchParams.get('ciudad') || undefined
  const sinceId = url.searchParams.get('desde') || undefined

  const events = await listEvents({ citySlug, sinceId, limit: 30 })

  return NextResponse.json({
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      title: e.payload.title,
      neighborhood: e.payload.neighborhood,
      city: e.payload.city,
      createdAt: e.createdAt,
    })),
  })
}
```

- [ ] **Step 7: Ejecutar y confirmar que pasa**

Run: `npm test -- src/lib/request-ip.test.ts src/app/api/contact.test.ts`
Expected: PASS, 6 pruebas.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: endpoint de contacto con límite y sondeo de eventos"
```

---

### Task 12: Base visual — tokens, fuente y estructura global

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`
- Create: `src/components/SiteHeader.tsx`, `src/components/CitySelect.tsx`, `src/lib/city-preference.ts`
- Test: `src/lib/city-preference.test.ts`

**Interfaces:**
- Consumes: `listCities` (Task 5).
- Produces:
  - Variables CSS del sistema de diseño y utilidades de Tailwind asociadas.
  - `<SiteHeader cities={City[]} activeSlug={string | null} />`
  - `resolveCitySlug(searchParam: string | null, stored: string | null, valid: string[]): string | null`

- [ ] **Step 1: Asegurar Tailwind v4**

```bash
npm ls tailwindcss
```

Si la versión instalada no es 4.x:

```bash
npm install tailwindcss@4 @tailwindcss/postcss@4
```

y dejar `postcss.config.mjs` con:

```js
export default { plugins: { '@tailwindcss/postcss': {} } }
```

- [ ] **Step 2: Escribir los tokens**

Reemplazar el contenido de `src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-primary: #0f172a;
  --color-secondary: #334155;
  --color-cta: #0369a1;
  --color-cta-hover: #075985;
  --color-surface: #ffffff;
  --color-background: #f8fafc;
  --color-ink: #020617;
  --color-muted: #475569;
  --color-line: #e2e8f0;

  --color-urgente: #b91c1c;
  --color-urgente-soft: #fef2f2;
  --color-media: #b45309;
  --color-media-soft: #fffbeb;
  --color-baja: #15803d;
  --color-baja-soft: #f0fdf4;
  --color-whatsapp: #067647;
  --color-whatsapp-hover: #05603a;
}

html {
  background: var(--color-background);
  color: var(--color-ink);
  /* 16px mínimo: por debajo, Safari en iOS hace zoom al enfocar un campo. */
  font-size: 16px;
}

body {
  line-height: 1.55;
}

/* Foco siempre visible: la app se usa con una mano y con prisa. */
:focus-visible {
  outline: 3px solid var(--color-cta);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Enlace de salto para teclado y lectores de pantalla. */
.skip-link {
  position: absolute;
  left: -9999px;
}
.skip-link:focus {
  left: 1rem;
  top: 1rem;
  z-index: 50;
  background: var(--color-surface);
  padding: 0.75rem 1rem;
  border-radius: 8px;
  box-shadow: 0 10px 15px rgb(0 0 0 / 0.1);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Escribir la prueba de preferencia de ciudad**

Crear `src/lib/city-preference.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveCitySlug } from './city-preference'

const valid = ['cali', 'armenia', 'pereira']

describe('resolveCitySlug', () => {
  it('la URL manda sobre lo guardado', () => {
    expect(resolveCitySlug('armenia', 'cali', valid)).toBe('armenia')
  })

  it('usa lo guardado cuando la URL no dice nada', () => {
    expect(resolveCitySlug(null, 'cali', valid)).toBe('cali')
  })

  it('devuelve null cuando no hay preferencia: se ven todas', () => {
    expect(resolveCitySlug(null, null, valid)).toBeNull()
  })

  it('ignora una ciudad desconocida en la URL', () => {
    expect(resolveCitySlug('medellin', 'cali', valid)).toBe('cali')
  })

  it('ignora un valor guardado que ya no es válido', () => {
    expect(resolveCitySlug(null, 'medellin', valid)).toBeNull()
  })

  it('acepta "todas" como forma explícita de quitar el filtro', () => {
    expect(resolveCitySlug('todas', 'cali', valid)).toBeNull()
  })
})
```

- [ ] **Step 4: Ejecutar y confirmar que falla**

Run: `npm test -- src/lib/city-preference.test.ts`
Expected: FAIL — no existe `./city-preference`.

- [ ] **Step 5: Implementar**

Crear `src/lib/city-preference.ts`:

```ts
export const CITY_STORAGE_KEY = 'reporta-cali:ciudad'
export const ALL_CITIES = 'todas'

/**
 * La URL manda sobre lo guardado: un enlace compartido en un grupo de
 * WhatsApp debe abrir la ciudad que dice el enlace, no la última que
 * miró quien lo recibe.
 */
export function resolveCitySlug(
  searchParam: string | null,
  stored: string | null,
  valid: string[]
): string | null {
  if (searchParam === ALL_CITIES) return null
  if (searchParam && valid.includes(searchParam)) return searchParam
  if (stored && valid.includes(stored)) return stored
  return null
}
```

- [ ] **Step 6: Ejecutar y confirmar que pasa**

Run: `npm test -- src/lib/city-preference.test.ts`
Expected: PASS, 6 pruebas.

- [ ] **Step 7: Escribir el selector de ciudad**

Crear `src/components/CitySelect.tsx`:

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { MapPin } from 'lucide-react'
import { ALL_CITIES, CITY_STORAGE_KEY } from '@/lib/city-preference'

type Option = { slug: string; name: string }

export function CitySelect({ cities }: { cities: Option[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  // El layout raíz no recibe searchParams en el App Router, así que la
  // ciudad activa se lee aquí, en el cliente.
  const activeSlug = searchParams.get('ciudad') ?? ALL_CITIES

  function onChange(value: string) {
    try {
      localStorage.setItem(CITY_STORAGE_KEY, value)
    } catch {
      // Modo incógnito o almacenamiento bloqueado: seguimos con la URL.
    }
    const params = new URLSearchParams(searchParams.toString())
    params.set('ciudad', value)
    router.push(`?${params.toString()}`)
  }

  return (
    <label className="flex items-center gap-2 text-sm font-medium text-[--color-secondary]">
      <MapPin aria-hidden="true" className="h-5 w-5 shrink-0" />
      <span className="sr-only">Ciudad</span>
      <select
        value={activeSlug}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[44px] cursor-pointer rounded-lg border border-[--color-line] bg-white px-3 py-2 text-base font-semibold text-[--color-ink] transition-colors duration-150 hover:border-[--color-cta]"
      >
        <option value={ALL_CITIES}>Todas las ciudades</option>
        {cities.map((city) => (
          <option key={city.slug} value={city.slug}>{city.name}</option>
        ))}
      </select>
    </label>
  )
}
```

- [ ] **Step 8: Escribir la cabecera y el layout**

Crear `src/components/SiteHeader.tsx`:

```tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { CitySelect } from './CitySelect'
import { NotificationBell } from './NotificationBell'

type City = { slug: string; name: string }

export function SiteHeader({ cities }: { cities: City[] }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[--color-line] bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/" className="mr-auto text-lg font-bold tracking-tight text-[--color-primary]">
          Reporta Cali
        </Link>
        {/* `useSearchParams` exige una frontera de Suspense para que Next
            pueda prerrenderizar; sin ella, `next build` falla. */}
        <Suspense fallback={null}>
          <CitySelect cities={cities} />
        </Suspense>
        <Suspense fallback={null}>
          <NotificationBell />
        </Suspense>
      </div>
    </header>
  )
}
```

`NotificationBell` se implementa en la Task 17. Hasta entonces, crear un
marcador de posición en `src/components/NotificationBell.tsx` para que el
proyecto compile:

```tsx
export function NotificationBell() {
  return null
}
```

Reemplazar `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Public_Sans } from 'next/font/google'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { listCities } from '@/lib/cities'
import { SiteHeader } from '@/components/SiteHeader'
import './globals.css'

// Autohospedada por next/font: sin llamadas a Google en tiempo de ejecución.
const publicSans = Public_Sans({ subsets: ['latin'], display: 'swap' })

// El layout lee las ciudades de la base. Sin esto, Next lo prerrenderiza
// una sola vez y la lista queda congelada hasta el próximo despliegue, lo
// que rompería la razón de modelar `cities` como tabla: habilitar una
// ciudad nueva con un INSERT durante la emergencia. Un minuto de desfase
// es irrelevante; `force-dynamic` costaría renderizar el layout entero en
// cada petición.
export const revalidate = 60

export const metadata: Metadata = {
  title: 'Reporta Cali — Ayuda tras el terremoto',
  description:
    'Publica qué necesitas y dónde, o encuentra a quién ayudar. Plataforma abierta para coordinar la ayuda tras el terremoto.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cities = await listCities()

  return (
    <html lang="es-CO">
      <body className={`${publicSans.className} min-h-dvh bg-[--color-background]`}>
        <a href="#contenido" className="skip-link">Saltar al contenido</a>
        <SiteHeader cities={cities.map((c) => ({ slug: c.slug, name: c.name }))} />
        <main id="contenido" className="mx-auto max-w-6xl px-4 pb-28 pt-4">
          {children}
        </main>

        {/* Acción principal siempre alcanzable con el pulgar. */}
        <Link
          href="/nueva"
          className="fixed bottom-4 left-1/2 z-40 flex min-h-[52px] -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full bg-[--color-cta] px-6 text-base font-semibold text-white shadow-lg transition-colors duration-150 hover:bg-[--color-cta-hover]"
        >
          <Plus aria-hidden="true" className="h-5 w-5" />
          Pedir ayuda
        </Link>
      </body>
    </html>
  )
}
```

El filtro de ciudad se resuelve en cada página a partir de sus propios `searchParams` (Task 14); el layout solo aporta la lista de ciudades.

- [ ] **Step 9: Verificar en el navegador**

```bash
npm run dev
```

Abrir `http://localhost:3000` con el navegador en 375 px de ancho. Comprobar: la fuente carga, el selector de ciudad tiene al menos 44 px de alto, el botón "Pedir ayuda" no tapa contenido, y al pulsar Tab aparece "Saltar al contenido".

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: base visual, fuente autohospedada, cabecera y selector de ciudad"
```

---

### Task 13: Componentes base — distintivos y botones

**Files:**
- Create: `src/components/ui/UrgencyBadge.tsx`, `src/components/ui/StatusBadge.tsx`, `src/components/ui/Button.tsx`
- Test: `src/components/ui/badges.test.tsx`

**Interfaces:**
- Consumes: tipos `Urgency` y `RequestStatus` (Task 9).
- Produces:
  - `<UrgencyBadge urgency={Urgency} />`
  - `<StatusBadge status={RequestStatus} claimedBy?={string | null} />`
  - `<Button variant="primary" | "secondary" | "whatsapp" | "danger" ... />`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/components/ui/badges.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UrgencyBadge } from './UrgencyBadge'
import { StatusBadge } from './StatusBadge'

describe('UrgencyBadge', () => {
  it('nombra la urgencia con palabras, no solo con color', () => {
    render(<UrgencyBadge urgency="alta" />)
    expect(screen.getByText(/urgencia alta/i)).toBeInTheDocument()
  })

  it('distingue las tres urgencias', () => {
    const { rerender } = render(<UrgencyBadge urgency="media" />)
    expect(screen.getByText(/urgencia media/i)).toBeInTheDocument()
    rerender(<UrgencyBadge urgency="baja" />)
    expect(screen.getByText(/urgencia baja/i)).toBeInTheDocument()
  })

  it('marca el icono como decorativo para lectores de pantalla', () => {
    const { container } = render(<UrgencyBadge urgency="alta" />)
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('StatusBadge', () => {
  it('describe el estado abierto', () => {
    render(<StatusBadge status="abierta" />)
    expect(screen.getByText(/sin atender/i)).toBeInTheDocument()
  })

  it('dice quién va en camino cuando se conoce', () => {
    render(<StatusBadge status="en_atencion" claimedBy="Luis Pérez" />)
    expect(screen.getByText(/luis pérez va en camino/i)).toBeInTheDocument()
  })

  it('no inventa un nombre cuando no lo hay', () => {
    render(<StatusBadge status="en_atencion" />)
    expect(screen.getByText(/alguien va en camino/i)).toBeInTheDocument()
  })

  it('describe el estado atendido', () => {
    render(<StatusBadge status="atendida" />)
    expect(screen.getByText(/atendida/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `npm test -- src/components/ui/badges.test.tsx`
Expected: FAIL — no existen los componentes.

- [ ] **Step 3: Implementar los distintivos**

Crear `src/components/ui/UrgencyBadge.tsx`:

```tsx
import { AlertTriangle, ArrowDown, Clock } from 'lucide-react'

type Urgency = 'alta' | 'media' | 'baja'

// Icono + texto además del color: bajo el sol, o con daltonismo,
// el tono por sí solo no distingue nada.
const STYLES: Record<Urgency, { label: string; className: string; Icon: typeof Clock }> = {
  alta: {
    label: 'Urgencia alta',
    className: 'bg-[--color-urgente-soft] text-[--color-urgente]',
    Icon: AlertTriangle,
  },
  media: {
    label: 'Urgencia media',
    className: 'bg-[--color-media-soft] text-[--color-media]',
    Icon: Clock,
  },
  baja: {
    label: 'Urgencia baja',
    className: 'bg-[--color-baja-soft] text-[--color-baja]',
    Icon: ArrowDown,
  },
}

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const { label, className, Icon } = STYLES[urgency]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold ${className}`}>
      <Icon aria-hidden="true" className="h-4 w-4" />
      {label}
    </span>
  )
}
```

Crear `src/components/ui/StatusBadge.tsx`:

```tsx
import { CircleDot, CheckCircle2, Truck, Archive, XCircle } from 'lucide-react'

type Status = 'abierta' | 'en_atencion' | 'atendida' | 'cancelada' | 'archivada'

export function StatusBadge({ status, claimedBy }: { status: Status; claimedBy?: string | null }) {
  const map = {
    abierta: { label: 'Sin atender', className: 'bg-slate-100 text-[--color-secondary]', Icon: CircleDot },
    en_atencion: {
      label: claimedBy ? `${claimedBy} va en camino` : 'Alguien va en camino',
      className: 'bg-sky-50 text-[--color-cta]',
      Icon: Truck,
    },
    atendida: { label: 'Atendida', className: 'bg-[--color-baja-soft] text-[--color-baja]', Icon: CheckCircle2 },
    cancelada: { label: 'Cancelada', className: 'bg-slate-100 text-[--color-muted]', Icon: XCircle },
    archivada: { label: 'Archivada', className: 'bg-slate-100 text-[--color-muted]', Icon: Archive },
  }[status]

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold ${map.className}`}>
      <map.Icon aria-hidden="true" className="h-4 w-4" />
      {map.label}
    </span>
  )
}
```

- [ ] **Step 4: Implementar el botón**

Crear `src/components/ui/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'whatsapp' | 'danger'

// Sin transform en hover: en gama baja produce tirones y no aporta nada.
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[--color-cta] text-white hover:bg-[--color-cta-hover]',
  secondary: 'bg-white text-[--color-primary] border-2 border-[--color-primary] hover:bg-slate-50',
  whatsapp: 'bg-[--color-whatsapp] text-white hover:bg-[--color-whatsapp-hover]',
  danger: 'bg-white text-[--color-urgente] border-2 border-[--color-urgente] hover:bg-[--color-urgente-soft]',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-base font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    />
  )
}
```

- [ ] **Step 5: Ejecutar y confirmar que pasa**

Run: `npm test -- src/components/ui/badges.test.tsx`
Expected: PASS, 7 pruebas.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: distintivos de urgencia y estado con icono, y botón base"
```

---

### Task 14: Tarjeta de solicitud, contacto por WhatsApp y pantalla de inicio

**Files:**
- Create: `src/components/WhatsAppButton.tsx`, `src/components/ClaimButton.tsx`, `src/components/RequestCard.tsx`, `src/components/RequestFilters.tsx`, `src/components/EmptyState.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/components/RequestCard.test.tsx`

**Interfaces:**
- Consumes: `listRequests`, `listCities`, `UrgencyBadge`, `StatusBadge`, `Button`.
- Produces:
  - `<RequestCard item={RequestListItem} />`
  - `<WhatsAppButton code={string} />` — pide el enlace al endpoint y navega.
  - `<ClaimButton code={string} status={RequestStatus} />`
  - Página `/` con filtros por ciudad, estado, urgencia y búsqueda.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/components/RequestCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RequestCard } from './RequestCard'

const item = {
  publicCode: 'ABC123',
  title: 'Familia sin agua ni alimentos',
  urgency: 'alta' as const,
  status: 'abierta' as const,
  neighborhood: 'El Diamante',
  cityName: 'Cali',
  citySlug: 'cali',
  lat: 3.44,
  lng: -76.52,
  itemsPreview: ['Agua', 'Arroz', 'Cobijas'],
  itemCount: 5,
  claimedBy: null,
  createdAt: new Date('2026-08-12T10:00:00Z'),
}

describe('RequestCard', () => {
  it('muestra el título y la ubicación', () => {
    render(<RequestCard item={item} />)
    expect(screen.getByText('Familia sin agua ni alimentos')).toBeInTheDocument()
    expect(screen.getByText(/el diamante/i)).toBeInTheDocument()
    expect(screen.getByText(/cali/i)).toBeInTheDocument()
  })

  it('lista los ítems de muestra y cuántos faltan', () => {
    render(<RequestCard item={item} />)
    expect(screen.getByText('Agua')).toBeInTheDocument()
    expect(screen.getByText(/2 más/i)).toBeInTheDocument()
  })

  it('no anuncia ítems adicionales cuando no los hay', () => {
    render(<RequestCard item={{ ...item, itemCount: 3 }} />)
    expect(screen.queryByText(/más$/i)).not.toBeInTheDocument()
  })

  it('enlaza al detalle por su código', () => {
    render(<RequestCard item={item} />)
    expect(screen.getByRole('link', { name: /familia sin agua/i }))
      .toHaveAttribute('href', '/s/ABC123')
  })

  it('muestra la urgencia y el estado', () => {
    render(<RequestCard item={item} />)
    expect(screen.getByText(/urgencia alta/i)).toBeInTheDocument()
    expect(screen.getByText(/sin atender/i)).toBeInTheDocument()
  })

  it('no muestra el botón de ir en camino si ya la atienden', () => {
    render(<RequestCard item={{ ...item, status: 'en_atencion', claimedBy: 'Luis' }} />)
    expect(screen.queryByRole('button', { name: /voy en camino/i })).not.toBeInTheDocument()
    expect(screen.getByText(/luis va en camino/i)).toBeInTheDocument()
  })

  it('muestra la distancia cuando se conoce', () => {
    render(<RequestCard item={{ ...item, distanceKm: 2.4 }} />)
    expect(screen.getByText(/2,4 km/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `npm test -- src/components/RequestCard.test.tsx`
Expected: FAIL — no existe `./RequestCard`.

- [ ] **Step 3: Implementar el botón de WhatsApp**

Crear `src/components/WhatsAppButton.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { Button } from './ui/Button'

export function WhatsAppButton({ code, className = '' }: { code: string; className?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function contact() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/requests/${code}/contact`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'No se pudo abrir WhatsApp')
      // Navegación directa: window.open tras un await suele bloquearse.
      window.location.href = body.link
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir WhatsApp')
      setLoading(false)
    }
  }

  return (
    <div className={className}>
      <Button variant="whatsapp" onClick={contact} disabled={loading} className="w-full">
        <MessageCircle aria-hidden="true" className="h-5 w-5" />
        {loading ? 'Abriendo…' : 'Contactar por WhatsApp'}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-[--color-urgente]">{error}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Implementar el botón de ir en camino**

Crear `src/components/ClaimButton.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Truck } from 'lucide-react'
import { Button } from './ui/Button'
import { claimAction } from '@/app/actions'

export function ClaimButton({ code }: { code: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    setError(null)
    const result = await claimAction({ publicCode: code, volunteerName: name })
    if (result.ok) {
      try {
        const raw = localStorage.getItem('reporta-cali:claims')
        const claims = raw ? JSON.parse(raw) : {}
        claims[code] = result.claimToken
        localStorage.setItem('reporta-cali:claims', JSON.stringify(claims))
      } catch {
        // Sin almacenamiento no podrá cancelar, pero el claim ya quedó hecho.
      }
      setOpen(false)
      router.refresh()
    } else {
      setError(result.error)
    }
    setSaving(false)
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} className="w-full">
        <Truck aria-hidden="true" className="h-5 w-5" />
        Voy en camino
      </Button>
    )
  }

  return (
    <div className="rounded-lg border border-[--color-line] bg-white p-3">
      <label htmlFor={`nombre-${code}`} className="block text-sm font-semibold text-[--color-secondary]">
        Tu nombre
      </label>
      <input
        id={`nombre-${code}`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
        className="mt-1 min-h-[44px] w-full rounded-lg border border-[--color-line] px-3 text-base"
      />
      {error && <p role="alert" className="mt-2 text-sm font-medium text-[--color-urgente]">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button onClick={submit} disabled={saving || name.trim().length < 2} className="flex-1">
          {saving ? 'Guardando…' : 'Confirmar'}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)} className="flex-1">
          Cancelar
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Implementar las Server Actions**

Crear `src/app/actions.ts`:

```ts
'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { claimRequest, cancelClaim } from '@/lib/claims'
import { fulfillRequest, cancelRequest } from '@/lib/requests'
import { getClientIp } from '@/lib/request-ip'

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string }

const fail = (e: unknown): Result => ({
  ok: false,
  error: e instanceof Error ? e.message : 'Ocurrió un error inesperado',
})

export async function claimAction(input: {
  publicCode: string
  volunteerName: string
}): Promise<Result<{ claimToken: string }>> {
  try {
    const ip = getClientIp(await headers())
    const { claimToken } = await claimRequest(input, ip)
    revalidatePath('/')
    revalidatePath(`/s/${input.publicCode}`)
    return { ok: true, claimToken }
  } catch (e) {
    return fail(e) as Result<{ claimToken: string }>
  }
}

export async function cancelClaimAction(publicCode: string, claimToken: string): Promise<Result> {
  try {
    await cancelClaim(publicCode, claimToken)
    revalidatePath('/')
    revalidatePath(`/s/${publicCode}`)
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

export async function fulfillAction(publicCode: string, manageToken: string): Promise<Result> {
  try {
    await fulfillRequest(publicCode, manageToken)
    revalidatePath('/')
    revalidatePath(`/s/${publicCode}`)
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

export async function cancelRequestAction(publicCode: string, manageToken: string): Promise<Result> {
  try {
    await cancelRequest(publicCode, manageToken)
    revalidatePath('/')
    revalidatePath(`/s/${publicCode}`)
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}
```

- [ ] **Step 6: Implementar la tarjeta**

Crear `src/components/RequestCard.tsx`:

```tsx
import Link from 'next/link'
import { MapPin, Navigation } from 'lucide-react'
import { UrgencyBadge } from './ui/UrgencyBadge'
import { StatusBadge } from './ui/StatusBadge'
import { WhatsAppButton } from './WhatsAppButton'
import { ClaimButton } from './ClaimButton'
import type { RequestListItem } from '@/lib/requests'

export function RequestCard({ item }: { item: RequestListItem }) {
  const remaining = item.itemCount - item.itemsPreview.length

  return (
    <article className="rounded-xl border border-[--color-line] bg-white p-4 shadow-sm transition-colors duration-150 hover:border-[--color-cta]">
      <div className="flex flex-wrap items-center gap-2">
        <UrgencyBadge urgency={item.urgency} />
        <StatusBadge status={item.status} claimedBy={item.claimedBy} />
      </div>

      <h2 className="mt-3 text-lg font-bold leading-snug text-[--color-primary]">
        <Link href={`/s/${item.publicCode}`} className="cursor-pointer hover:underline">
          {item.title}
        </Link>
      </h2>

      <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-[--color-muted]">
        <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
        {item.neighborhood ? `${item.neighborhood}, ` : ''}{item.cityName}
        {item.distanceKm !== undefined && (
          <span className="ml-2 inline-flex items-center gap-1">
            <Navigation aria-hidden="true" className="h-4 w-4" />
            a {item.distanceKm.toFixed(1).replace('.', ',')} km
          </span>
        )}
      </p>

      <ul className="mt-3 flex flex-wrap gap-2">
        {item.itemsPreview.map((name) => (
          <li key={name} className="rounded-md bg-slate-100 px-2 py-1 text-sm font-medium text-[--color-secondary]">
            {name}
          </li>
        ))}
        {remaining > 0 && (
          <li className="rounded-md px-2 py-1 text-sm font-medium text-[--color-muted]">
            y {remaining} más
          </li>
        )}
      </ul>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <WhatsAppButton code={item.publicCode} className="flex-1" />
        {item.status === 'abierta' && (
          <div className="flex-1">
            <ClaimButton code={item.publicCode} />
          </div>
        )}
      </div>
    </article>
  )
}
```

- [ ] **Step 7: Ejecutar y confirmar que pasa**

Run: `npm test -- src/components/RequestCard.test.tsx`
Expected: PASS, 7 pruebas.

- [ ] **Step 8: Implementar los filtros y el estado vacío**

Crear `src/components/RequestFilters.tsx`:

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'

const URGENCIES = [
  { value: '', label: 'Cualquier urgencia' },
  { value: 'alta', label: 'Urgencia alta' },
  { value: 'media', label: 'Urgencia media' },
  { value: 'baja', label: 'Urgencia baja' },
]

const STATUSES = [
  { value: '', label: 'Activas' },
  { value: 'atendida', label: 'Ya atendidas' },
]

export function RequestFilters() {
  const router = useRouter()
  const params = useSearchParams()

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.push(`?${next.toString()}`)
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[--color-muted]" />
        <label htmlFor="buscar" className="sr-only">Buscar por necesidad o barrio</label>
        <input
          id="buscar"
          type="search"
          defaultValue={params.get('buscar') ?? ''}
          onChange={(e) => update('buscar', e.target.value)}
          placeholder="Buscar por barrio o necesidad"
          className="min-h-[44px] w-full rounded-lg border border-[--color-line] bg-white pl-10 pr-3 text-base"
        />
      </div>

      <label htmlFor="urgencia" className="sr-only">Urgencia</label>
      <select
        id="urgencia"
        value={params.get('urgencia') ?? ''}
        onChange={(e) => update('urgencia', e.target.value)}
        className="min-h-[44px] cursor-pointer rounded-lg border border-[--color-line] bg-white px-3 text-base"
      >
        {URGENCIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <label htmlFor="estado" className="sr-only">Estado</label>
      <select
        id="estado"
        value={params.get('estado') ?? ''}
        onChange={(e) => update('estado', e.target.value)}
        className="min-h-[44px] cursor-pointer rounded-lg border border-[--color-line] bg-white px-3 text-base"
      >
        {STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
```

Crear `src/components/EmptyState.tsx`:

```tsx
import Link from 'next/link'
import { Inbox } from 'lucide-react'

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[--color-line] bg-white p-8 text-center">
      <Inbox aria-hidden="true" className="mx-auto h-10 w-10 text-[--color-muted]" />
      <p className="mt-3 text-base font-medium text-[--color-secondary]">{message}</p>
      <Link href="/nueva" className="mt-4 inline-block cursor-pointer font-semibold text-[--color-cta] underline">
        Publicar una solicitud
      </Link>
    </div>
  )
}
```

- [ ] **Step 9: Implementar la página de inicio**

Reemplazar `src/app/page.tsx`:

```tsx
import { Suspense } from 'react'
import { listRequests, type RequestStatus, type Urgency } from '@/lib/requests'
import { RequestCard } from '@/components/RequestCard'
import { RequestFilters } from '@/components/RequestFilters'
import { EmptyState } from '@/components/EmptyState'

export const dynamic = 'force-dynamic'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ ciudad?: string; urgencia?: string; estado?: string; buscar?: string }>
}) {
  const params = await searchParams
  const citySlug = params.ciudad && params.ciudad !== 'todas' ? params.ciudad : undefined

  const items = await listRequests({
    citySlug,
    urgency: params.urgencia as Urgency | undefined,
    statuses: params.estado ? ([params.estado] as RequestStatus[]) : undefined,
    search: params.buscar || undefined,
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[--color-primary]">
          Solicitudes de ayuda
        </h1>
        <p className="mt-1 text-[--color-muted]">
          {items.length === 0
            ? 'No hay solicitudes con estos filtros.'
            : `${items.length} ${items.length === 1 ? 'solicitud' : 'solicitudes'}.`}
        </p>
      </div>

      {/* `RequestFilters` usa `useSearchParams`: sin esta frontera,
          `next build` falla con "Missing Suspense boundary". */}
      <Suspense fallback={null}>
        <RequestFilters />
      </Suspense>

      {items.length === 0 ? (
        <EmptyState message="Nadie ha publicado una solicitud con estos filtros todavía." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.publicCode}>
              <RequestCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 10: Verificar a 375 px**

```bash
npm run dev
```

Con la base sembrada, insertar una solicitud de prueba desde `npm run db:seed` o creando una en `/nueva` tras la Task 16. Comprobar que a 375 px no hay desplazamiento horizontal y que los botones no se solapan.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: tarjeta de solicitud, contacto por WhatsApp y pantalla de inicio"
```

---

### Task 15: Mapa

**Files:**
- Create: `src/components/RequestMap.tsx`, `src/components/MapListToggle.tsx`
- Modify: `src/app/page.tsx`, `src/app/globals.css`
- Test: verificación manual en navegador (Leaflet exige DOM real; el recorrido queda cubierto por Playwright en la Task 21)

**Interfaces:**
- Consumes: `RequestListItem`, `listCities`.
- Produces:
  - `<RequestMap items={RequestListItem[]} center={Coords} zoom={number} />` — solo cliente.
  - `<MapListToggle />` — conmuta entre lista y mapa conservando los filtros.

- [ ] **Step 1: Instalar Leaflet**

```bash
npm install leaflet react-leaflet
npm install -D @types/leaflet
```

- [ ] **Step 2: Implementar el mapa**

Crear `src/components/RequestMap.tsx`:

```tsx
'use client'

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import Link from 'next/link'
import 'leaflet/dist/leaflet.css'
import type { RequestListItem } from '@/lib/requests'

// Iconos por urgencia: el color no basta, cambia también la letra.
const ICONS: Record<string, L.DivIcon> = {
  alta: marker('#b91c1c', '!'),
  media: marker('#b45309', '•'),
  baja: marker('#15803d', '·'),
}

function marker(color: string, glyph: string) {
  return L.divIcon({
    className: '',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:${color};color:#fff;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${glyph}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

export default function RequestMap({
  items,
  center,
  zoom,
}: {
  items: RequestListItem[]
  center: { lat: number; lng: number }
  zoom: number
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      scrollWheelZoom
      className="h-[60vh] w-full rounded-xl border border-[--color-line]"
    >
      <TileLayer
        attribution='&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {items.map((item) => (
        <Marker
          key={item.publicCode}
          position={[item.lat, item.lng]}
          icon={ICONS[item.urgency]}
        >
          <Popup>
            <strong className="block text-base">{item.title}</strong>
            <span className="text-sm">{item.neighborhood ?? item.cityName}</span>
            <Link href={`/s/${item.publicCode}`} className="mt-2 block font-semibold text-[--color-cta] underline">
              Ver solicitud
            </Link>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
```

- [ ] **Step 3: Implementar el conmutador**

Crear `src/components/MapListToggle.tsx`:

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { List, Map as MapIcon } from 'lucide-react'

export function MapListToggle({ current }: { current: 'lista' | 'mapa' }) {
  const router = useRouter()
  const params = useSearchParams()

  function go(view: 'lista' | 'mapa') {
    const next = new URLSearchParams(params.toString())
    if (view === 'mapa') next.set('vista', 'mapa')
    else next.delete('vista')
    router.push(`?${next.toString()}`)
  }

  const base = 'flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 font-semibold transition-colors duration-150'

  return (
    <div role="group" aria-label="Cambiar vista" className="flex gap-2 rounded-xl bg-slate-100 p-1">
      <button
        type="button"
        onClick={() => go('lista')}
        aria-pressed={current === 'lista'}
        className={`${base} ${current === 'lista' ? 'bg-white text-[--color-primary] shadow-sm' : 'text-[--color-muted]'}`}
      >
        <List aria-hidden="true" className="h-5 w-5" /> Lista
      </button>
      <button
        type="button"
        onClick={() => go('mapa')}
        aria-pressed={current === 'mapa'}
        className={`${base} ${current === 'mapa' ? 'bg-white text-[--color-primary] shadow-sm' : 'text-[--color-muted]'}`}
      >
        <MapIcon aria-hidden="true" className="h-5 w-5" /> Mapa
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Conectar el mapa en la página de inicio**

`ssr: false` **no puede usarse dentro de un Server Component**, y `page.tsx`
lo es. Hay que aislar la carga diferida en un componente cliente propio.

Crear `src/components/RequestMapLazy.tsx`:

```tsx
'use client'

import dynamic from 'next/dynamic'
import type { RequestListItem } from '@/lib/requests'

// Leaflet toca `window`, así que nunca puede renderizarse en el servidor.
// Además, cargarlo aparte evita que pese en la primera carga de quien solo
// quiere la lista, que en móvil es la vista por defecto.
const RequestMap = dynamic(() => import('./RequestMap'), {
  ssr: false,
  loading: () => (
    <div
      className="h-[60vh] w-full animate-pulse rounded-xl bg-slate-100"
      aria-label="Cargando mapa"
    />
  ),
})

export function RequestMapLazy(props: {
  items: RequestListItem[]
  center: { lat: number; lng: number }
  zoom: number
}) {
  return <RequestMap {...props} />
}
```

Y en `src/app/page.tsx`, importar ese componente y el conmutador:

```tsx
import { Suspense } from 'react'
import { RequestMapLazy } from '@/components/RequestMapLazy'
import { MapListToggle } from '@/components/MapListToggle'
import { getCityBySlug } from '@/lib/cities'
```

`MapListToggle` usa `useSearchParams`, así que también va envuelto en
`<Suspense>` donde se use.

Ampliar la firma de `searchParams` con `vista?: string` y, tras calcular `items`:

```tsx
const view = params.vista === 'mapa' ? 'mapa' : 'lista'
const city = citySlug ? await getCityBySlug(citySlug) : null
const center = city
  ? { lat: city.centerLat, lng: city.centerLng }
  : { lat: 3.4516, lng: -76.532 }   // Cali por defecto
const zoom = city?.defaultZoom ?? 8
```

Y sustituir el bloque de resultados por:

```tsx
<MapListToggle current={view} />

{items.length === 0 ? (
  <EmptyState message="Nadie ha publicado una solicitud con estos filtros todavía." />
) : view === 'mapa' ? (
  <RequestMap items={items} center={center} zoom={zoom} />
) : (
  <ul className="grid gap-4 sm:grid-cols-2">
    {items.map((item) => (
      <li key={item.publicCode}><RequestCard item={item} /></li>
    ))}
  </ul>
)}
```

- [ ] **Step 5: Ajustar la altura del mapa en móvil**

Añadir a `src/app/globals.css`:

```css
/* Leaflet asigna z-index altos a sus paneles; los bajamos para que no
   tapen la cabecera pegajosa ni el botón de "Pedir ayuda". */
.leaflet-pane,
.leaflet-top,
.leaflet-bottom {
  z-index: 10 !important;
}
```

- [ ] **Step 6: Verificar en el navegador**

```bash
npm run dev
```

Comprobar a 375 px: el conmutador arranca en Lista, al pasar a Mapa se cargan las teselas, los marcadores se pulsan con el dedo, la cabecera queda por encima del mapa y el botón "Pedir ayuda" sigue visible.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: mapa Leaflet con carga diferida y conmutador lista/mapa"
```

---

### Task 16: Formulario de nueva solicitud y pantalla de confirmación

**Files:**
- Create: `src/app/nueva/page.tsx`, `src/components/NewRequestForm.tsx`, `src/components/LocationPicker.tsx`, `src/components/ItemsField.tsx`, `src/components/RequestCreated.tsx`, `src/lib/my-requests.ts`
- Modify: `src/app/actions.ts`
- Test: `src/lib/my-requests.test.ts`, `src/components/ItemsField.test.tsx`

**Interfaces:**
- Consumes: `createRequest`, `listCities`, `buildWhatsAppLink`.
- Produces:
  - `createRequestAction(input): Promise<Result<{ publicCode, manageToken, needsReview }>>`
  - `saveMyRequest(entry)`, `listMyRequests()`, `removeMyRequest(code)` sobre `localStorage`.
  - `<NewRequestForm cities={...} />`, `<LocationPicker ... />`, `<ItemsField ... />`, `<RequestCreated ... />`

- [ ] **Step 1: Escribir la prueba de "mis solicitudes"**

Crear `src/lib/my-requests.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { saveMyRequest, listMyRequests, removeMyRequest } from './my-requests'

beforeEach(() => localStorage.clear())

const entry = { publicCode: 'ABC123', manageToken: 'tok', title: 'Agua', createdAt: '2026-08-13T10:00:00Z' }

describe('mis solicitudes', () => {
  it('guarda y recupera una solicitud', () => {
    saveMyRequest(entry)
    expect(listMyRequests()).toEqual([entry])
  })

  it('no duplica el mismo código', () => {
    saveMyRequest(entry)
    saveMyRequest({ ...entry, title: 'Agua y comida' })
    const all = listMyRequests()
    expect(all).toHaveLength(1)
    expect(all[0].title).toBe('Agua y comida')
  })

  it('elimina una solicitud', () => {
    saveMyRequest(entry)
    removeMyRequest('ABC123')
    expect(listMyRequests()).toEqual([])
  })

  it('devuelve lista vacía si el almacenamiento tiene basura', () => {
    localStorage.setItem('reporta-cali:mis-solicitudes', 'no es json')
    expect(listMyRequests()).toEqual([])
  })

  it('devuelve lista vacía cuando no hay nada guardado', () => {
    expect(listMyRequests()).toEqual([])
  })
})
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `npm test -- src/lib/my-requests.test.ts`
Expected: FAIL — no existe `./my-requests`.

- [ ] **Step 3: Implementar el almacenamiento local**

Crear `src/lib/my-requests.ts`:

```ts
const KEY = 'reporta-cali:mis-solicitudes'

export type MyRequest = {
  publicCode: string
  manageToken: string
  title: string
  createdAt: string
}

/** Nunca lanza: en incógnito o con almacenamiento bloqueado, devuelve vacío. */
export function listMyRequests(): MyRequest[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveMyRequest(entry: MyRequest): void {
  try {
    const all = listMyRequests().filter((r) => r.publicCode !== entry.publicCode)
    localStorage.setItem(KEY, JSON.stringify([entry, ...all]))
  } catch {
    // Sin almacenamiento el enlace sigue visible en pantalla; es el respaldo real.
  }
}

export function removeMyRequest(code: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(listMyRequests().filter((r) => r.publicCode !== code)))
  } catch {
    // Nada que hacer.
  }
}
```

- [ ] **Step 4: Ejecutar y confirmar que pasa**

Run: `npm test -- src/lib/my-requests.test.ts`
Expected: PASS, 5 pruebas.

- [ ] **Step 5: Escribir la prueba del campo de ítems**

Crear `src/components/ItemsField.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ItemsField } from './ItemsField'

describe('ItemsField', () => {
  it('muestra un renglón por ítem', () => {
    render(<ItemsField items={[{ name: 'Agua', quantity: '' }]} onChange={vi.fn()} />)
    expect(screen.getByDisplayValue('Agua')).toBeInTheDocument()
  })

  it('añade un renglón', () => {
    const onChange = vi.fn()
    render(<ItemsField items={[{ name: 'Agua', quantity: '' }]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /agregar/i }))
    expect(onChange).toHaveBeenCalledWith([
      { name: 'Agua', quantity: '' },
      { name: '', quantity: '' },
    ])
  })

  it('elimina un renglón', () => {
    const onChange = vi.fn()
    render(<ItemsField items={[{ name: 'Agua', quantity: '' }, { name: 'Arroz', quantity: '' }]} onChange={onChange} />)
    fireEvent.click(screen.getAllByRole('button', { name: /quitar/i })[0])
    expect(onChange).toHaveBeenCalledWith([{ name: 'Arroz', quantity: '' }])
  })

  it('no permite quitar el único renglón', () => {
    render(<ItemsField items={[{ name: 'Agua', quantity: '' }]} onChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /quitar/i })).not.toBeInTheDocument()
  })

  it('etiqueta cada campo para lectores de pantalla', () => {
    render(<ItemsField items={[{ name: 'Agua', quantity: '' }]} onChange={vi.fn()} />)
    expect(screen.getByLabelText(/qué necesitas \(1\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/cuánto \(1\)/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Ejecutar y confirmar que falla**

Run: `npm test -- src/components/ItemsField.test.tsx`
Expected: FAIL — no existe `./ItemsField`.

- [ ] **Step 7: Implementar el campo de ítems**

Crear `src/components/ItemsField.tsx`:

```tsx
'use client'

import { Plus, X } from 'lucide-react'
import { Button } from './ui/Button'

export type Item = { name: string; quantity: string }

export function ItemsField({
  items,
  onChange,
}: {
  items: Item[]
  onChange: (items: Item[]) => void
}) {
  function update(index: number, patch: Partial<Item>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-base font-semibold text-[--color-primary]">
        ¿Qué necesitan?
      </legend>

      {items.map((item, index) => (
        <div key={index} className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <label htmlFor={`item-${index}`} className="sr-only">
              Qué necesitas ({index + 1})
            </label>
            <input
              id={`item-${index}`}
              value={item.name}
              onChange={(e) => update(index, { name: e.target.value })}
              placeholder="Agua, pañales, cobijas…"
              className="min-h-[44px] w-full rounded-lg border border-[--color-line] px-3 text-base"
            />
          </div>
          <div className="sm:w-40">
            <label htmlFor={`cantidad-${index}`} className="sr-only">
              Cuánto ({index + 1})
            </label>
            <input
              id={`cantidad-${index}`}
              value={item.quantity}
              onChange={(e) => update(index, { quantity: e.target.value })}
              placeholder="10 litros"
              className="min-h-[44px] w-full rounded-lg border border-[--color-line] px-3 text-base"
            />
          </div>
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              aria-label={`Quitar ${item.name || `renglón ${index + 1}`}`}
              className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg border border-[--color-line] text-[--color-muted] transition-colors duration-150 hover:border-[--color-urgente] hover:text-[--color-urgente]"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          )}
        </div>
      ))}

      <Button
        type="button"
        variant="secondary"
        onClick={() => onChange([...items, { name: '', quantity: '' }])}
      >
        <Plus aria-hidden="true" className="h-5 w-5" />
        Agregar otra cosa
      </Button>
    </fieldset>
  )
}
```

- [ ] **Step 8: Ejecutar y confirmar que pasa**

Run: `npm test -- src/components/ItemsField.test.tsx`
Expected: PASS, 5 pruebas.

- [ ] **Step 9: Implementar el selector de ubicación**

Crear `src/components/LocationPicker.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Crosshair } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { Button } from './ui/Button'

const pin = L.divIcon({
  className: '',
  html: '<span style="display:block;width:24px;height:24px;border-radius:9999px;background:#0369a1;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => { map.setView([lat, lng]) }, [lat, lng, map])
  return null
}

function ClickCatcher({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

export default function LocationPicker({
  lat,
  lng,
  zoom,
  onChange,
}: {
  lat: number
  lng: number
  zoom: number
  onChange: (lat: number, lng: number) => void
}) {
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function useMyLocation() {
    setLocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude, pos.coords.longitude)
        setLocating(false)
      },
      () => {
        setError('No pudimos obtener tu ubicación. Marca el punto en el mapa.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    )
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="secondary" onClick={useMyLocation} disabled={locating}>
        <Crosshair aria-hidden="true" className="h-5 w-5" />
        {locating ? 'Buscando…' : 'Usar mi ubicación'}
      </Button>

      {error && <p role="alert" className="text-sm font-medium text-[--color-urgente]">{error}</p>}

      <p className="text-sm text-[--color-muted]">
        Toca el mapa o arrastra el punto para marcar dónde se necesita la ayuda.
      </p>

      <MapContainer
        center={[lat, lng]}
        zoom={zoom}
        className="h-64 w-full rounded-xl border border-[--color-line]"
      >
        <TileLayer
          attribution='&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter lat={lat} lng={lng} />
        <ClickCatcher onPick={onChange} />
        <Marker
          position={[lat, lng]}
          icon={pin}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const { lat: newLat, lng: newLng } = e.target.getLatLng()
              onChange(newLat, newLng)
            },
          }}
        />
      </MapContainer>
    </div>
  )
}
```

- [ ] **Step 10: Añadir la Server Action de creación**

Añadir a `src/app/actions.ts`:

```ts
import { createRequest, type CreateRequestInput } from '@/lib/requests'

export async function createRequestAction(
  input: CreateRequestInput
): Promise<Result<{ publicCode: string; manageToken: string; needsReview: boolean }>> {
  try {
    const ip = getClientIp(await headers())
    const created = await createRequest(input, ip)
    revalidatePath('/')
    return { ok: true, ...created }
  } catch (e) {
    // Zod entrega varios errores; mostramos el primero, que es el más útil.
    if (e && typeof e === 'object' && 'issues' in e) {
      const issues = (e as { issues: { message: string }[] }).issues
      return { ok: false, error: issues[0]?.message ?? 'Revisa los datos del formulario' }
    }
    return fail(e) as Result<{ publicCode: string; manageToken: string; needsReview: boolean }>
  }
}
```

- [ ] **Step 11: Implementar el formulario**

Crear `src/components/NewRequestForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import dynamicImport from 'next/dynamic'
import Link from 'next/link'
import { ItemsField, type Item } from './ItemsField'
import { Button } from './ui/Button'
import { RequestCreated } from './RequestCreated'
import { createRequestAction } from '@/app/actions'
import { saveMyRequest } from '@/lib/my-requests'

const LocationPicker = dynamicImport(() => import('./LocationPicker'), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-xl bg-slate-100" />,
})

type City = { slug: string; name: string; centerLat: number; centerLng: number; defaultZoom: number }

export function NewRequestForm({ cities }: { cities: City[] }) {
  const [citySlug, setCitySlug] = useState(cities[0]?.slug ?? '')
  const city = cities.find((c) => c.slug === citySlug) ?? cities[0]

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [urgency, setUrgency] = useState<'alta' | 'media' | 'baja'>('media')
  const [items, setItems] = useState<Item[]>([{ name: '', quantity: '' }])
  const [requesterName, setRequesterName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [addressText, setAddressText] = useState('')
  const [peopleCount, setPeopleCount] = useState('')
  const [coords, setCoords] = useState({ lat: city.centerLat, lng: city.centerLng })
  const [acceptsPrivacy, setAcceptsPrivacy] = useState(false)
  const [website, setWebsite] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ publicCode: string; manageToken: string } | null>(null)

  function changeCity(slug: string) {
    setCitySlug(slug)
    const next = cities.find((c) => c.slug === slug)
    if (next) setCoords({ lat: next.centerLat, lng: next.centerLng })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const result = await createRequestAction({
      citySlug,
      title,
      description,
      urgency,
      items: items.filter((i) => i.name.trim()),
      requesterName,
      whatsapp,
      lat: coords.lat,
      lng: coords.lng,
      neighborhood,
      addressText,
      peopleCount: peopleCount ? Number(peopleCount) : undefined,
      acceptsPrivacy: acceptsPrivacy as true,
      website,
    })

    if (result.ok) {
      saveMyRequest({
        publicCode: result.publicCode,
        manageToken: result.manageToken,
        title,
        createdAt: new Date().toISOString(),
      })
      setCreated({ publicCode: result.publicCode, manageToken: result.manageToken })
    } else {
      setError(result.error)
      setSaving(false)
    }
  }

  if (created) {
    return <RequestCreated {...created} whatsapp={whatsapp} title={title} />
  }

  const field = 'min-h-[44px] w-full rounded-lg border border-[--color-line] px-3 text-base'
  const label = 'block text-base font-semibold text-[--color-primary]'

  return (
    // `noValidate` desactiva la validación nativa del navegador a propósito.
    // Sin él, `required` interrumpe el envío con un mensaje del propio
    // navegador, en el idioma del navegador y sin `role="alert"`: alguien
    // con el teléfono en inglés vería un texto que no entiende justo en la
    // pantalla donde pide ayuda, y un lector de pantalla no lo anunciaría.
    // Toda la validación pasa por `createRequestSchema`, en español.
    <form onSubmit={submit} noValidate className="space-y-6">
      <div>
        <label htmlFor="ciudad" className={label}>Ciudad</label>
        <select
          id="ciudad"
          value={citySlug}
          onChange={(e) => changeCity(e.target.value)}
          className={`${field} cursor-pointer`}
          required
        >
          {cities.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="titulo" className={label}>¿Qué está pasando?</label>
        <input
          id="titulo"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Familia con niños sin agua ni alimentos"
          className={field}
          required
          minLength={8}
          maxLength={120}
        />
      </div>

      <ItemsField items={items} onChange={setItems} />

      <div>
        <label htmlFor="urgencia" className={label}>¿Qué tan urgente es?</label>
        <select
          id="urgencia"
          value={urgency}
          onChange={(e) => setUrgency(e.target.value as 'alta' | 'media' | 'baja')}
          className={`${field} cursor-pointer`}
        >
          <option value="alta">Alta — se necesita hoy</option>
          <option value="media">Media — en los próximos días</option>
          <option value="baja">Baja — puede esperar</option>
        </select>
      </div>

      <div>
        <label htmlFor="descripcion" className={label}>
          Detalles <span className="font-normal text-[--color-muted]">(opcional)</span>
        </label>
        <textarea
          id="descripcion"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={1000}
          className="w-full rounded-lg border border-[--color-line] p-3 text-base"
        />
      </div>

      <div>
        <span className={label}>¿Dónde?</span>
        <LocationPicker
          lat={coords.lat}
          lng={coords.lng}
          zoom={city.defaultZoom}
          onChange={(lat, lng) => setCoords({ lat, lng })}
        />
      </div>

      <div>
        <label htmlFor="barrio" className={label}>
          Barrio o comuna <span className="font-normal text-[--color-muted]">(opcional)</span>
        </label>
        <input id="barrio" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className={field} />
      </div>

      <div>
        <label htmlFor="direccion" className={label}>
          Dirección o punto de referencia <span className="font-normal text-[--color-muted]">(opcional)</span>
        </label>
        <input id="direccion" value={addressText} onChange={(e) => setAddressText(e.target.value)} className={field} />
      </div>

      <div>
        <label htmlFor="personas" className={label}>
          ¿Cuántas personas son? <span className="font-normal text-[--color-muted]">(opcional)</span>
        </label>
        <input
          id="personas"
          value={peopleCount}
          onChange={(e) => setPeopleCount(e.target.value.replace(/\D/g, ''))}
          type="text"
          inputMode="numeric"
          maxLength={3}
          className={field}
        />
      </div>

      <div>
        <label htmlFor="nombre" className={label}>Tu nombre</label>
        <input id="nombre" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} autoComplete="name" className={field} required />
      </div>

      <div>
        <label htmlFor="whatsapp" className={label}>Tu WhatsApp</label>
        <input
          id="whatsapp"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="300 123 4567"
          className={field}
          required
        />
        <p className="mt-1 text-sm text-[--color-muted]">
          No se muestra en la lista. Solo lo ve quien pulse el botón de contactarte.
        </p>
      </div>

      {/* Campo trampa: invisible para personas, tentador para bots. */}
      <div aria-hidden="true" className="absolute left-[-9999px]">
        <label htmlFor="website">No llenar</label>
        <input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      {/* La fila entera es la etiqueta y mide 44 px de alto: la casilla sola
          medía 24 px, por debajo del mínimo táctil, y es justo la que hay
          que marcar para poder pedir ayuda. Así el área pulsable abarca
          también el texto. */}
      <label
        htmlFor="privacidad"
        className="flex min-h-[44px] cursor-pointer gap-3 rounded-lg bg-slate-50 p-4"
      >
        <input
          id="privacidad"
          type="checkbox"
          checked={acceptsPrivacy}
          onChange={(e) => setAcceptsPrivacy(e.target.checked)}
          className="mt-1 h-6 w-6 shrink-0 cursor-pointer"
        />
        <span className="text-sm text-[--color-secondary]">
          Autorizo publicar mi nombre, mi ubicación y lo que necesito, y que mi número
          de WhatsApp se entregue a quien quiera ayudarme. Puedo pedir que se borre
          cuando quiera. Leer la{' '}
          <Link href="/privacidad" className="cursor-pointer font-semibold text-[--color-cta] underline">
            política de datos
          </Link>.
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-[--color-urgente-soft] p-3 text-base font-semibold text-[--color-urgente]">
          {error}
        </p>
      )}

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? 'Publicando…' : 'Publicar solicitud'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 12: Implementar la confirmación**

Crear `src/components/RequestCreated.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { CheckCircle2, Copy, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from './ui/Button'
import { buildWhatsAppLink, normalizePhone } from '@/lib/whatsapp'

export function RequestCreated({
  publicCode,
  manageToken,
  whatsapp,
  title,
}: {
  publicCode: string
  manageToken: string
  whatsapp: string
  title: string
}) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/s/${publicCode}?t=${manageToken}`

  const phone = normalizePhone(whatsapp)
  const selfLink = phone
    ? buildWhatsAppLink(phone, `Enlace para administrar mi solicitud "${title}" en Reporta Cali: ${url}`)
    : null

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-5 rounded-xl border border-[--color-line] bg-white p-5">
      <div className="flex items-center gap-3">
        <CheckCircle2 aria-hidden="true" className="h-8 w-8 shrink-0 text-[--color-baja]" />
        <h1 className="text-xl font-bold text-[--color-primary]">Tu solicitud ya está publicada</h1>
      </div>

      <div className="rounded-lg bg-[--color-media-soft] p-4">
        <p className="font-semibold text-[--color-media]">Guarda este enlace</p>
        <p className="mt-1 text-sm text-[--color-secondary]">
          Es la única forma de marcar tu solicitud como atendida o de borrarla.
          Si borras los datos del navegador, lo pierdes.
        </p>
        <p className="mt-3 break-all rounded-md bg-white p-3 font-mono text-sm">{url}</p>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="secondary" onClick={copy} className="flex-1">
            <Copy aria-hidden="true" className="h-5 w-5" />
            {copied ? 'Copiado' : 'Copiar enlace'}
          </Button>
          {selfLink && (
            <a href={selfLink} className="flex-1">
              <Button type="button" variant="whatsapp" className="w-full">
                <MessageCircle aria-hidden="true" className="h-5 w-5" />
                Enviármelo por WhatsApp
              </Button>
            </a>
          )}
        </div>
      </div>

      <Link href={`/s/${publicCode}`} className="block cursor-pointer text-center font-semibold text-[--color-cta] underline">
        Ver mi solicitud publicada
      </Link>
    </div>
  )
}
```

- [ ] **Step 13: Implementar la página**

Crear `src/app/nueva/page.tsx`:

```tsx
import { listCities } from '@/lib/cities'
import { NewRequestForm } from '@/components/NewRequestForm'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Pedir ayuda — Reporta Cali' }

export default async function NewRequestPage() {
  const cities = await listCities()

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[--color-primary]">Pedir ayuda</h1>
        <p className="mt-1 text-[--color-muted]">
          Cuenta qué necesitas y dónde. Quien pueda ayudarte te escribirá por WhatsApp.
        </p>
      </div>

      <NewRequestForm
        cities={cities.map((c) => ({
          slug: c.slug,
          name: c.name,
          centerLat: c.centerLat,
          centerLng: c.centerLng,
          defaultZoom: c.defaultZoom,
        }))}
      />
    </div>
  )
}
```

- [ ] **Step 14: Verificar el recorrido completo**

```bash
npm run dev
```

A 375 px: llenar el formulario, marcar el punto en el mapa, aceptar la política y publicar. Comprobar que aparece el enlace de gestión, que "Copiar enlace" funciona y que la solicitud sale en el inicio.

Comprobar también los errores: enviar sin aceptar la política, con un número fijo (`6024851234`) y con el pin arrastrado fuera de la ciudad. Los tres deben mostrar un mensaje claro con `role="alert"`.

- [ ] **Step 15: Ejecutar toda la batería y commit**

```bash
npm test
git add -A
git commit -m "feat: formulario de nueva solicitud con mapa, autorización de datos y confirmación"
```

---

### Task 17: Notificaciones in-app

**Files:**
- Create: `src/components/NotificationBell.tsx` (reemplaza el marcador), `src/lib/notifications.ts`
- Test: `src/lib/notifications.test.ts`

**Interfaces:**
- Consumes: `GET /api/events` (Task 11).
- Produces:
  - `getLastSeenEventId()`, `setLastSeenEventId(id)`
  - `countUnseen(events, lastSeenId)`
  - `<NotificationBell />` — sondea cada 30 s solo con la pestaña visible.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/lib/notifications.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { countUnseen, getLastSeenEventId, setLastSeenEventId } from './notifications'

const events = [{ id: 'c' }, { id: 'b' }, { id: 'a' }] // más reciente primero

beforeEach(() => localStorage.clear())

describe('countUnseen', () => {
  it('cuenta todo si nunca se ha visto nada', () => {
    expect(countUnseen(events, null)).toBe(3)
  })

  it('cuenta solo lo posterior al último visto', () => {
    expect(countUnseen(events, 'b')).toBe(1)
  })

  it('devuelve cero si el último visto es el más reciente', () => {
    expect(countUnseen(events, 'c')).toBe(0)
  })

  it('cuenta todo si el último visto ya no está en la lista', () => {
    expect(countUnseen(events, 'desconocido')).toBe(3)
  })

  it('devuelve cero con la lista vacía', () => {
    expect(countUnseen([], 'c')).toBe(0)
  })
})

describe('último evento visto', () => {
  it('guarda y recupera', () => {
    setLastSeenEventId('abc')
    expect(getLastSeenEventId()).toBe('abc')
  })

  it('devuelve null cuando no hay nada guardado', () => {
    expect(getLastSeenEventId()).toBeNull()
  })
})
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `npm test -- src/lib/notifications.test.ts`
Expected: FAIL — no existe `./notifications`.

- [ ] **Step 3: Implementar**

Crear `src/lib/notifications.ts`:

```ts
const KEY = 'reporta-cali:ultimo-evento'

export function getLastSeenEventId(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setLastSeenEventId(id: string): void {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // Sin almacenamiento el contador se reinicia en cada visita. Aceptable.
  }
}

/**
 * Los eventos llegan del más reciente al más antiguo. Si el último visto
 * ya no aparece (pasó mucho tiempo), se cuentan todos: es preferible
 * avisar de más que de menos.
 */
export function countUnseen(events: { id: string }[], lastSeenId: string | null): number {
  if (events.length === 0) return 0
  if (!lastSeenId) return events.length
  const index = events.findIndex((e) => e.id === lastSeenId)
  return index === -1 ? events.length : index
}
```

- [ ] **Step 4: Ejecutar y confirmar que pasa**

Run: `npm test -- src/lib/notifications.test.ts`
Expected: PASS, 7 pruebas.

- [ ] **Step 5: Implementar la campanita**

Reemplazar `src/components/NotificationBell.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Bell, X, PackageCheck, Truck, AlertCircle } from 'lucide-react'
import { countUnseen, getLastSeenEventId, setLastSeenEventId } from '@/lib/notifications'

type FeedEvent = {
  id: string
  type: 'request_created' | 'request_claimed' | 'request_fulfilled'
  title: string
  neighborhood: string | null
  city: string
  createdAt: string
}

const POLL_MS = 30_000

const DESCRIPTIONS = {
  request_created: { text: 'Nueva solicitud', Icon: AlertCircle, className: 'text-[--color-urgente]' },
  request_claimed: { text: 'Alguien va en camino', Icon: Truck, className: 'text-[--color-cta]' },
  request_fulfilled: { text: 'Solicitud atendida', Icon: PackageCheck, className: 'text-[--color-baja]' },
}

export function NotificationBell() {
  const params = useSearchParams()
  const citySlug = params.get('ciudad')

  const [events, setEvents] = useState<FeedEvent[]>([])
  const [open, setOpen] = useState(false)
  const [unseen, setUnseen] = useState(0)

  const load = useCallback(async () => {
    try {
      const query = citySlug && citySlug !== 'todas' ? `?ciudad=${citySlug}` : ''
      const res = await fetch(`/api/events${query}`)
      if (!res.ok) return
      const body = await res.json()
      setEvents(body.events)
      setUnseen(countUnseen(body.events, getLastSeenEventId()))
    } catch {
      // Sin red no pasa nada: se reintenta en el siguiente ciclo.
    }
  }, [citySlug])

  useEffect(() => {
    load()
    // Solo sondea con la pestaña visible: ahorra batería y datos.
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [load])

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && events[0]) {
      setLastSeenEventId(events[0].id)
      setUnseen(0)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={unseen > 0 ? `Novedades: ${unseen} sin leer` : 'Novedades'}
        aria-expanded={open}
        className="relative flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg border border-[--color-line] bg-white transition-colors duration-150 hover:border-[--color-cta]"
      >
        <Bell aria-hidden="true" className="h-5 w-5 text-[--color-secondary]" />
        {unseen > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[22px] rounded-full bg-[--color-urgente] px-1.5 text-sm font-bold leading-[22px] text-white">
            {unseen > 9 ? '9+' : unseen}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={() => setOpen(false)}>
          <aside
            role="dialog"
            aria-label="Novedades"
            onClick={(e) => e.stopPropagation()}
            className="h-full w-full max-w-sm overflow-y-auto bg-white p-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[--color-primary]">Novedades</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar novedades"
                className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg text-[--color-muted] transition-colors duration-150 hover:text-[--color-ink]"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            {events.length === 0 ? (
              <p className="mt-6 text-[--color-muted]">Todavía no hay movimientos.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {events.map((event) => {
                  const info = DESCRIPTIONS[event.type]
                  return (
                    <li key={event.id} className="border-b border-[--color-line] pb-3 last:border-0">
                      <p className={`flex items-center gap-2 text-sm font-semibold ${info.className}`}>
                        <info.Icon aria-hidden="true" className="h-4 w-4" />
                        {info.text}
                      </p>
                      <p className="mt-1 font-medium text-[--color-ink]">{event.title}</p>
                      <p className="text-sm text-[--color-muted]">
                        {event.neighborhood ? `${event.neighborhood}, ` : ''}{event.city}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}

            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="mt-6 block cursor-pointer text-center font-semibold text-[--color-cta] underline"
            >
              Ver todas las solicitudes
            </Link>
          </aside>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 6: Verificar en el navegador**

Abrir dos pestañas. En una, crear una solicitud. En la otra, comprobar que en menos de 30 segundos aparece el contador en la campanita, que al abrir el panel el contador vuelve a cero y que al cambiar de ciudad el feed cambia.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: notificaciones in-app con sondeo y contador de no leídos"
```

---

### Task 18: Detalle de la solicitud y acciones del solicitante

**Files:**
- Create: `src/app/s/[code]/page.tsx`, `src/components/RequestDetail.tsx`, `src/components/OwnerActions.tsx`, `src/components/CancelClaimButton.tsx`
- Test: `src/components/OwnerActions.test.tsx`

**Interfaces:**
- Consumes: `getRequestByCode`, `fulfillAction`, `cancelRequestAction`, `cancelClaimAction`.
- Produces: página `/s/[code]` que acepta `?t=<manageToken>`.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/components/OwnerActions.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OwnerActions } from './OwnerActions'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const fulfill = vi.fn(async () => ({ ok: true as const }))
const cancel = vi.fn(async () => ({ ok: true as const }))

describe('OwnerActions', () => {
  it('ofrece marcar como atendida cuando sigue abierta', () => {
    render(<OwnerActions code="ABC123" token="t" status="abierta" onFulfill={fulfill} onCancel={cancel} />)
    expect(screen.getByRole('button', { name: /ya recibí la ayuda/i })).toBeInTheDocument()
  })

  it('pide confirmación antes de marcar como atendida', async () => {
    render(<OwnerActions code="ABC123" token="t" status="abierta" onFulfill={fulfill} onCancel={cancel} />)
    fireEvent.click(screen.getByRole('button', { name: /ya recibí la ayuda/i }))
    expect(screen.getByText(/¿confirmas/i)).toBeInTheDocument()
    expect(fulfill).not.toHaveBeenCalled()
  })

  it('marca como atendida al confirmar', async () => {
    render(<OwnerActions code="ABC123" token="t" status="abierta" onFulfill={fulfill} onCancel={cancel} />)
    fireEvent.click(screen.getByRole('button', { name: /ya recibí la ayuda/i }))
    fireEvent.click(screen.getByRole('button', { name: /^sí, confirmar$/i }))
    await waitFor(() => expect(fulfill).toHaveBeenCalledWith('ABC123', 't'))
  })

  it('no ofrece acciones cuando ya está atendida', () => {
    render(<OwnerActions code="ABC123" token="t" status="atendida" onFulfill={fulfill} onCancel={cancel} />)
    expect(screen.queryByRole('button', { name: /ya recibí la ayuda/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `npm test -- src/components/OwnerActions.test.tsx`
Expected: FAIL — no existe `./OwnerActions`.

- [ ] **Step 3: Implementar las acciones del solicitante**

Crear `src/components/OwnerActions.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Trash2 } from 'lucide-react'
import { Button } from './ui/Button'

type Result = { ok: true } | { ok: false; error: string }
type Action = (code: string, token: string) => Promise<Result>

export function OwnerActions({
  code,
  token,
  status,
  onFulfill,
  onCancel,
}: {
  code: string
  token: string
  status: string
  onFulfill: Action
  onCancel: Action
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState<'fulfill' | 'cancel' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (status === 'atendida' || status === 'cancelada') return null

  async function run(action: Action) {
    setBusy(true)
    setError(null)
    const result = await action(code, token)
    if (result.ok) {
      setConfirming(null)
      router.refresh()
    } else {
      setError(result.error)
    }
    setBusy(false)
  }

  return (
    <div className="rounded-xl border-2 border-[--color-cta] bg-sky-50 p-4">
      <h2 className="text-base font-bold text-[--color-primary]">Administrar mi solicitud</h2>

      {confirming === null && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => setConfirming('fulfill')} className="flex-1">
            <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
            Ya recibí la ayuda
          </Button>
          <Button variant="danger" onClick={() => setConfirming('cancel')} className="flex-1">
            <Trash2 aria-hidden="true" className="h-5 w-5" />
            Cancelar solicitud
          </Button>
        </div>
      )}

      {confirming && (
        <div className="mt-3">
          <p className="font-medium text-[--color-secondary]">
            {confirming === 'fulfill'
              ? '¿Confirmas que ya recibiste lo que necesitabas? La solicitud saldrá del mapa.'
              : '¿Confirmas que quieres cancelar? Ya nadie podrá verla.'}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              onClick={() => run(confirming === 'fulfill' ? onFulfill : onCancel)}
              disabled={busy}
              className="flex-1"
            >
              {busy ? 'Guardando…' : 'Sí, confirmar'}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(null)} className="flex-1">
              No
            </Button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-sm font-semibold text-[--color-urgente]">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Ejecutar y confirmar que pasa**

Run: `npm test -- src/components/OwnerActions.test.tsx`
Expected: PASS, 4 pruebas.

- [ ] **Step 5: Implementar el botón de cancelar el claim**

Crear `src/components/CancelClaimButton.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from './ui/Button'
import { cancelClaimAction } from '@/app/actions'

/** Solo aparece si este navegador guardó el token del claim. */
export function CancelClaimButton({ code }: { code: string }) {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('reporta-cali:claims')
      setToken(raw ? (JSON.parse(raw)[code] ?? null) : null)
    } catch {
      setToken(null)
    }
  }, [code])

  if (!token) return null

  async function cancel() {
    setBusy(true)
    const result = await cancelClaimAction(code, token!)
    if (result.ok) router.refresh()
    else setError(result.error)
    setBusy(false)
  }

  return (
    <div>
      <Button variant="secondary" onClick={cancel} disabled={busy} className="w-full">
        {busy ? 'Cancelando…' : 'Ya no puedo ir'}
      </Button>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-[--color-urgente]">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 6: Implementar la página de detalle**

Crear `src/components/RequestDetail.tsx`:

```tsx
'use client'

import dynamicImport from 'next/dynamic'
import { MapPin, Users, Clock } from 'lucide-react'
import { UrgencyBadge } from './ui/UrgencyBadge'
import { StatusBadge } from './ui/StatusBadge'
import { WhatsAppButton } from './WhatsAppButton'
import { ClaimButton } from './ClaimButton'
import { CancelClaimButton } from './CancelClaimButton'
import { OwnerActions } from './OwnerActions'
import { fulfillAction, cancelRequestAction } from '@/app/actions'
import type { RequestDetail as Detail } from '@/lib/requests'

const RequestMap = dynamicImport(() => import('./RequestMap'), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-xl bg-slate-100" />,
})

export function RequestDetail({ detail, token }: { detail: Detail; token: string | null }) {
  return (
    <article className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <UrgencyBadge urgency={detail.urgency} />
        <StatusBadge status={detail.status} claimedBy={detail.claimedBy} />
      </div>

      <h1 className="text-2xl font-bold leading-tight text-[--color-primary]">{detail.title}</h1>

      {detail.description && <p className="text-[--color-secondary]">{detail.description}</p>}

      <dl className="grid gap-2 text-[--color-muted] sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <MapPin aria-hidden="true" className="h-5 w-5 shrink-0" />
          <dt className="sr-only">Ubicación</dt>
          <dd>
            {detail.addressText ? `${detail.addressText}. ` : ''}
            {detail.neighborhood ? `${detail.neighborhood}, ` : ''}{detail.cityName}
          </dd>
        </div>
        {detail.peopleCount && (
          <div className="flex items-center gap-2">
            <Users aria-hidden="true" className="h-5 w-5 shrink-0" />
            <dt className="sr-only">Personas</dt>
            <dd>{detail.peopleCount} personas</dd>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Clock aria-hidden="true" className="h-5 w-5 shrink-0" />
          <dt className="sr-only">Publicada</dt>
          <dd>
            Publicada el{' '}
            {new Date(detail.createdAt).toLocaleDateString('es-CO', {
              day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
            })}
          </dd>
        </div>
      </dl>

      <section>
        <h2 className="text-lg font-bold text-[--color-primary]">Lo que necesitan</h2>
        <ul className="mt-2 divide-y divide-[--color-line] rounded-xl border border-[--color-line] bg-white">
          {detail.items.map((item, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="font-medium text-[--color-ink]">{item.name}</span>
              {item.quantity && <span className="text-[--color-muted]">{item.quantity}</span>}
            </li>
          ))}
        </ul>
      </section>

      <RequestMap
        items={[{
          publicCode: detail.publicCode, title: detail.title, urgency: detail.urgency,
          status: detail.status, neighborhood: detail.neighborhood, cityName: detail.cityName,
          citySlug: detail.citySlug, lat: detail.lat, lng: detail.lng,
          itemsPreview: [], itemCount: detail.itemCount, claimedBy: detail.claimedBy,
          createdAt: detail.createdAt,
        }]}
        center={{ lat: detail.lat, lng: detail.lng }}
        zoom={16}
      />

      {detail.status !== 'atendida' && detail.status !== 'cancelada' && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <WhatsAppButton code={detail.publicCode} className="flex-1" />
          <div className="flex-1">
            {detail.status === 'abierta'
              ? <ClaimButton code={detail.publicCode} />
              : <CancelClaimButton code={detail.publicCode} />}
          </div>
        </div>
      )}

      {detail.canManage && token && (
        <OwnerActions
          code={detail.publicCode}
          token={token}
          status={detail.status}
          onFulfill={fulfillAction}
          onCancel={cancelRequestAction}
        />
      )}
    </article>
  )
}
```

Crear `src/app/s/[code]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getRequestByCode } from '@/lib/requests'
import { RequestDetail } from '@/components/RequestDetail'

export const dynamic = 'force-dynamic'

export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ t?: string }>
}) {
  const { code } = await params
  const token = (await searchParams).t ?? null

  const detail = await getRequestByCode(code, token ?? undefined)
  if (!detail) notFound()

  return <RequestDetail detail={detail} token={token} />
}
```

- [ ] **Step 7: Verificar el recorrido**

En el navegador: abrir una solicitud sin token (no deben verse las acciones del solicitante), abrirla con `?t=<token>` (deben verse), pulsar "Voy en camino" desde otra ventana privada, comprobar que el estado cambia y que en la ventana del voluntario aparece "Ya no puedo ir".

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: detalle de solicitud con acciones de voluntario y de solicitante"
```

---

### Task 19: Mis solicitudes y política de datos

**Files:**
- Create: `src/app/mis-solicitudes/page.tsx`, `src/components/MyRequestsList.tsx`, `src/app/privacidad/page.tsx`
- Modify: `src/components/SiteHeader.tsx`

**Interfaces:**
- Consumes: `listMyRequests`, `removeMyRequest`.
- Produces: páginas `/mis-solicitudes` y `/privacidad`.

- [ ] **Step 1: Implementar la lista local**

Crear `src/components/MyRequestsList.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { listMyRequests, type MyRequest } from '@/lib/my-requests'

export function MyRequestsList() {
  const [items, setItems] = useState<MyRequest[] | null>(null)

  useEffect(() => setItems(listMyRequests()), [])

  if (items === null) {
    return <p className="text-[--color-muted]">Cargando…</p>
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[--color-line] bg-white p-6 text-center">
        <p className="text-[--color-secondary]">
          En este navegador no hay solicitudes guardadas.
        </p>
        <p className="mt-2 text-sm text-[--color-muted]">
          Si publicaste una desde otro teléfono, ábrela con el enlace que guardaste.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.publicCode} className="rounded-xl border border-[--color-line] bg-white p-4">
          <p className="font-semibold text-[--color-primary]">{item.title}</p>
          <p className="mt-1 text-sm text-[--color-muted]">
            Publicada el {new Date(item.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}
          </p>
          <Link
            href={`/s/${item.publicCode}?t=${item.manageToken}`}
            className="mt-3 inline-flex cursor-pointer items-center gap-2 font-semibold text-[--color-cta] underline"
          >
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
            Administrar
          </Link>
        </li>
      ))}
    </ul>
  )
}
```

Crear `src/app/mis-solicitudes/page.tsx`:

```tsx
import { MyRequestsList } from '@/components/MyRequestsList'

export const metadata = { title: 'Mis solicitudes — Reporta Cali' }

export default function MyRequestsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-[--color-primary]">Mis solicitudes</h1>
      <p className="text-[--color-muted]">
        Estas son las solicitudes guardadas en este navegador. Si borras los datos de
        navegación, desaparecen de aquí, pero siguen publicadas: para administrarlas
        necesitas el enlace que guardaste.
      </p>
      <MyRequestsList />
    </div>
  )
}
```

- [ ] **Step 2: Escribir la política de datos**

Crear `src/app/privacidad/page.tsx`:

```tsx
export const metadata = { title: 'Política de datos — Reporta Cali' }

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <h1 className="text-2xl font-bold tracking-tight text-[--color-primary]">
        Qué hacemos con tus datos
      </h1>

      <p className="text-[--color-secondary]">
        Reporta Cali existe para que la ayuda llegue a quien la necesita después del
        terremoto. Para eso necesitamos unos pocos datos tuyos. Esto es exactamente
        qué guardamos, qué mostramos y por cuánto tiempo.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-[--color-primary]">Qué guardamos</h2>
        <p className="text-[--color-secondary]">
          Tu nombre, tu número de WhatsApp, la ubicación que marcaste, el barrio, la
          descripción y la lista de cosas que necesitas. También guardamos una versión
          cifrada de tu dirección IP, que usamos únicamente para frenar mensajes
          automáticos y contenido malicioso.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-[--color-primary]">Qué se ve en público</h2>
        <p className="text-[--color-secondary]">
          Todo lo anterior, <strong>menos tu número de WhatsApp</strong>. El número no
          aparece en la lista, ni en el mapa, ni en el código de la página. Solo se
          entrega a quien pulsa el botón para contactarte, y limitamos cuántas veces
          se puede pedir desde una misma conexión para que nadie recolecte los números
          de todas las personas afectadas.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-[--color-primary]">Por cuánto tiempo</h2>
        <p className="text-[--color-secondary]">
          Conservamos tus datos <strong>mientras dure la emergencia</strong>. Dos meses
          después de que tu solicitud quede atendida o cancelada, borramos
          automáticamente tu nombre, tu número y tu dirección, y dejamos solo el barrio,
          la ciudad y qué se necesitaba, sin nada que permita identificarte. Cuando la
          operación de ayuda termine, se elimina toda la base de datos.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-[--color-primary]">Qué nunca hacemos</h2>
        <ul className="list-disc space-y-1 pl-5 text-[--color-secondary]">
          <li>No vendemos ni compartimos tus datos con nadie.</li>
          <li>No los usamos para publicidad.</li>
          <li>No hay rastreadores, ni analítica, ni cookies de terceros.</li>
          <li>No enviamos correos: todos los avisos ocurren dentro de la página.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-[--color-primary]">Cómo borrar tu solicitud</h2>
        <p className="text-[--color-secondary]">
          Cuando publicas, te damos un enlace privado. Ábrelo y usa el botón
          &ldquo;Cancelar solicitud&rdquo;: desaparece de inmediato. No tienes que
          esperar ningún plazo ni pedir permiso a nadie.
        </p>
      </section>

      <p className="rounded-lg bg-slate-50 p-4 text-sm text-[--color-muted]">
        Este tratamiento se hace conforme a la Ley 1581 de 2012 de protección de datos
        personales. Al publicar una solicitud autorizas expresamente el uso descrito
        aquí, y puedes revocar esa autorización borrando tu solicitud.
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Enlazar desde la cabecera**

En `src/components/SiteHeader.tsx`, añadir dentro del contenedor, antes de `CitySelect`:

```tsx
<Link
  href="/mis-solicitudes"
  className="hidden cursor-pointer text-sm font-semibold text-[--color-secondary] underline transition-colors duration-150 hover:text-[--color-cta] sm:block"
>
  Mis solicitudes
</Link>
```

Y añadir un pie en `src/app/layout.tsx`, después de `<main>`:

```tsx
<footer className="mx-auto max-w-6xl px-4 pb-24 pt-8 text-sm text-[--color-muted]">
  <nav className="flex flex-wrap gap-4">
    <Link href="/mis-solicitudes" className="cursor-pointer underline">Mis solicitudes</Link>
    <Link href="/privacidad" className="cursor-pointer underline">Política de datos</Link>
  </nav>
  <p className="mt-3">
    Reporta Cali es una iniciativa ciudadana sin ánimo de lucro para coordinar la
    ayuda tras el terremoto.
  </p>
</footer>
```

- [ ] **Step 4: Verificar**

Comprobar a 375 px que la política se lee cómoda, que "Mis solicitudes" muestra lo publicado en este navegador y que el pie no queda tapado por el botón flotante.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: mis solicitudes y política de datos"
```

---

### Task 20: Moderación

**Files:**
- Create: `src/app/admin/page.tsx`, `src/app/admin/login/page.tsx`, `src/lib/admin-auth.ts`, `src/app/admin/actions.ts`, `src/components/ReportButton.tsx`
- Modify: `src/components/RequestCard.tsx`, `src/lib/requests.ts`
- Test: `src/lib/admin-auth.test.ts`

**Interfaces:**
- Consumes: `db`, esquema.
- Produces:
  - `signAdminCookie(): string`, `isValidAdminCookie(value: string | undefined): boolean`
  - `listForModeration()`, `hideRequest(id)`, `unhideRequest(id)`, `reportRequest(code, reason, ip)`
  - `<ReportButton code={string} />`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/lib/admin-auth.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { signAdminCookie, isValidAdminCookie } from './admin-auth'

beforeAll(() => { process.env.ADMIN_COOKIE_SECRET = 'secreto-cookie' })

describe('cookie de administración', () => {
  it('acepta la cookie que ella misma firma', () => {
    expect(isValidAdminCookie(signAdminCookie())).toBe(true)
  })

  it('rechaza una cookie inventada', () => {
    expect(isValidAdminCookie('lo-que-sea')).toBe(false)
  })

  it('rechaza la ausencia de cookie', () => {
    expect(isValidAdminCookie(undefined)).toBe(false)
  })

  it('rechaza una firma alterada', () => {
    const cookie = signAdminCookie()
    expect(isValidAdminCookie(`${cookie}x`)).toBe(false)
  })
})
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `npm test -- src/lib/admin-auth.test.ts`
Expected: FAIL — no existe `./admin-auth`.

- [ ] **Step 3: Implementar la autenticación**

Crear `src/lib/admin-auth.ts`:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'

export const ADMIN_COOKIE = 'reporta_admin'

function secret(): string {
  const value = process.env.ADMIN_COOKIE_SECRET
  if (!value) throw new Error('Falta ADMIN_COOKIE_SECRET')
  return value
}

/**
 * La cookie es "admin.<hmac>". No lleva el token dentro, y como se firma
 * con un secreto del servidor, no se puede fabricar desde fuera.
 */
export function signAdminCookie(): string {
  const payload = 'admin'
  const mac = createHmac('sha256', secret()).update(payload).digest('hex')
  return `${payload}.${mac}`
}

export function isValidAdminCookie(value: string | undefined): boolean {
  if (!value) return false
  const [payload, mac] = value.split('.')
  if (payload !== 'admin' || !mac) return false

  const expected = Buffer.from(createHmac('sha256', secret()).update(payload).digest('hex'))
  const given = Buffer.from(mac)
  if (expected.length !== given.length) return false
  return timingSafeEqual(expected, given)
}

export function checkAdminToken(input: string): boolean {
  const expected = process.env.ADMIN_TOKEN
  if (!expected) throw new Error('Falta ADMIN_TOKEN')
  const a = Buffer.from(input)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
```

- [ ] **Step 4: Ejecutar y confirmar que pasa**

Run: `npm test -- src/lib/admin-auth.test.ts`
Expected: PASS, 4 pruebas.

- [ ] **Step 5: Añadir las funciones de moderación**

Añadir a `src/lib/requests.ts`:

```ts
import { reports } from '@/db/schema'

export async function reportRequest(code: string, reason: string, ip: string): Promise<void> {
  const [row] = await db.select({ id: requests.id }).from(requests)
    .where(eq(requests.publicCode, code)).limit(1)
  if (!row) throw new Error('Esta solicitud no existe')

  await db.insert(reports).values({
    requestId: row.id,
    reason: reason.trim().slice(0, 500),
    ipHash: hashIp(ip),
  })
  // Un reporte no oculta nada por sí solo: lo decide una persona en /admin.
  await db.update(requests).set({ needsReview: true }).where(eq(requests.id, row.id))
}

export type ModerationRow = {
  publicCode: string
  title: string
  cityName: string
  status: RequestStatus
  isHidden: boolean
  needsReview: boolean
  reportCount: number
  createdAt: Date
}

export async function listForModeration(): Promise<ModerationRow[]> {
  const rows = await db
    .select({
      publicCode: requests.publicCode,
      title: requests.title,
      cityName: cities.name,
      status: requests.status,
      isHidden: requests.isHidden,
      needsReview: requests.needsReview,
      createdAt: requests.createdAt,
      reportCount: sql<number>`(
        select count(*)::int from ${reports} where request_id = ${requests.id}
      )`,
    })
    .from(requests)
    .innerJoin(cities, eq(requests.cityId, cities.id))
    .orderBy(desc(requests.needsReview), desc(requests.createdAt))
    .limit(200)

  return rows as ModerationRow[]
}

export async function setHidden(code: string, hidden: boolean): Promise<void> {
  await db.update(requests)
    .set({ isHidden: hidden, needsReview: false })
    .where(eq(requests.publicCode, code))
}
```

- [ ] **Step 6: Implementar el acceso y la vista de moderación**

Crear `src/app/admin/actions.ts`:

```ts
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { ADMIN_COOKIE, checkAdminToken, isValidAdminCookie, signAdminCookie } from '@/lib/admin-auth'
import { setHidden } from '@/lib/requests'

export async function loginAction(formData: FormData) {
  const token = String(formData.get('token') ?? '')
  if (!checkAdminToken(token)) redirect('/admin/login?error=1')

  const store = await cookies()
  store.set(ADMIN_COOKIE, signAdminCookie(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/admin',
    maxAge: 60 * 60 * 12,
  })
  redirect('/admin')
}

async function requireAdmin() {
  const store = await cookies()
  if (!isValidAdminCookie(store.get(ADMIN_COOKIE)?.value)) redirect('/admin/login')
}

export async function hideAction(code: string, hidden: boolean) {
  await requireAdmin()
  await setHidden(code, hidden)
  revalidatePath('/admin')
  revalidatePath('/')
}
```

Crear `src/app/admin/login/page.tsx`:

```tsx
import { loginAction } from '../actions'

export const metadata = { title: 'Acceso — Reporta Cali' }

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const hasError = (await searchParams).error === '1'

  return (
    <form action={loginAction} className="mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-bold text-[--color-primary]">Acceso de moderación</h1>

      <div>
        <label htmlFor="token" className="block font-semibold text-[--color-primary]">Clave</label>
        <input
          id="token"
          name="token"
          type="password"
          autoComplete="current-password"
          required
          className="min-h-[44px] w-full rounded-lg border border-[--color-line] px-3 text-base"
        />
      </div>

      {hasError && (
        <p role="alert" className="text-sm font-semibold text-[--color-urgente]">Clave incorrecta.</p>
      )}

      <button
        type="submit"
        className="min-h-[44px] w-full cursor-pointer rounded-lg bg-[--color-cta] px-4 font-semibold text-white transition-colors duration-150 hover:bg-[--color-cta-hover]"
      >
        Entrar
      </button>
    </form>
  )
}
```

Crear `src/app/admin/page.tsx`:

```tsx
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ADMIN_COOKIE, isValidAdminCookie } from '@/lib/admin-auth'
import { listForModeration } from '@/lib/requests'
import { hideAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const store = await cookies()
  if (!isValidAdminCookie(store.get(ADMIN_COOKIE)?.value)) redirect('/admin/login')

  const rows = await listForModeration()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[--color-primary]">Moderación</h1>
      <p className="text-[--color-muted]">
        Primero lo marcado para revisión: reportes de la comunidad y envíos que
        superaron el límite por conexión.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[--color-line] text-sm text-[--color-muted]">
              <th className="py-2 pr-3">Solicitud</th>
              <th className="py-2 pr-3">Ciudad</th>
              <th className="py-2 pr-3">Reportes</th>
              <th className="py-2 pr-3">Estado</th>
              <th className="py-2">Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.publicCode} className={`border-b border-[--color-line] ${row.needsReview ? 'bg-[--color-media-soft]' : ''}`}>
                <td className="py-3 pr-3">
                  <Link href={`/s/${row.publicCode}`} className="cursor-pointer font-medium underline">
                    {row.title}
                  </Link>
                </td>
                <td className="py-3 pr-3">{row.cityName}</td>
                <td className="py-3 pr-3">{row.reportCount}</td>
                <td className="py-3 pr-3">{row.isHidden ? 'Oculta' : row.status}</td>
                <td className="py-3">
                  <form action={hideAction.bind(null, row.publicCode, !row.isHidden)}>
                    <button
                      type="submit"
                      className="min-h-[44px] cursor-pointer rounded-lg border-2 border-[--color-primary] px-3 font-semibold transition-colors duration-150 hover:bg-slate-50"
                    >
                      {row.isHidden ? 'Mostrar' : 'Ocultar'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Añadir el botón de reportar**

Crear `src/components/ReportButton.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'
import { reportAction } from '@/app/actions'

export function ReportButton({ code }: { code: string }) {
  const [done, setDone] = useState(false)
  const [reason, setReason] = useState('')
  const [open, setOpen] = useState(false)

  if (done) {
    return <p className="text-sm text-[--color-muted]">Gracias. Lo revisaremos.</p>
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 text-sm text-[--color-muted] underline transition-colors duration-150 hover:text-[--color-urgente]"
      >
        <Flag aria-hidden="true" className="h-4 w-4" />
        Reportar
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <label htmlFor={`motivo-${code}`} className="block text-sm font-semibold">
        ¿Qué problema tiene?
      </label>
      <input
        id={`motivo-${code}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="min-h-[44px] w-full rounded-lg border border-[--color-line] px-3 text-base"
      />
      <button
        type="button"
        onClick={async () => {
          await reportAction(code, reason)
          setDone(true)
        }}
        className="min-h-[44px] cursor-pointer rounded-lg border-2 border-[--color-urgente] px-3 font-semibold text-[--color-urgente]"
      >
        Enviar reporte
      </button>
    </div>
  )
}
```

Añadir a `src/app/actions.ts`:

```ts
import { reportRequest } from '@/lib/requests'

export async function reportAction(publicCode: string, reason: string): Promise<Result> {
  try {
    const ip = getClientIp(await headers())
    await reportRequest(publicCode, reason, ip)
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}
```

Y colocar `<ReportButton code={item.publicCode} />` al final de `RequestCard`, dentro de un contenedor con `className="mt-3"`.

- [ ] **Step 8: Verificar**

Entrar a `/admin` sin cookie debe redirigir a `/admin/login`. Con la clave correcta debe listar solicitudes. Ocultar una debe sacarla del inicio. Comprobar que la clave no aparece en la URL.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: moderación con cookie firmada, reportes y ocultamiento"
```

---

### Task 21: Pruebas de extremo a extremo

**Files:**
- Create: `playwright.config.ts`, `e2e/publicar-solicitud.spec.ts`, `e2e/atender-solicitud.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: la aplicación completa.
- Produces: `npm run e2e`.

- [ ] **Step 1: Instalar Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Configurar**

Crear `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  // Pixel 5: representativo de la gama que va a usar la aplicación.
  projects: [{ name: 'movil', use: { ...devices['Pixel 5'] } }],
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
```

Añadir a `package.json` en `scripts`:

```json
"e2e": "playwright test"
```

- [ ] **Step 3: Escribir el recorrido de publicación**

Crear `e2e/publicar-solicitud.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('una persona publica una solicitud y aparece en el listado', async ({ page }) => {
  const titulo = `Familia sin agua ${Date.now()}`

  await page.goto('/nueva')

  await page.getByLabel('Ciudad').selectOption('cali')
  await page.getByLabel('¿Qué está pasando?').fill(titulo)
  await page.getByLabel('Qué necesitas (1)').fill('Agua potable')
  await page.getByLabel('Cuánto (1)').fill('20 litros')
  await page.getByLabel('¿Qué tan urgente es?').selectOption('alta')
  await page.getByLabel('Barrio o comuna (opcional)').fill('El Diamante')
  await page.getByLabel('Tu nombre').fill('Ana Ruiz')
  await page.getByLabel('Tu WhatsApp').fill('3001234567')
  await page.getByLabel(/Autorizo publicar/).check()

  await page.getByRole('button', { name: 'Publicar solicitud' }).click()

  // La confirmación debe mostrar el enlace de gestión de forma visible.
  await expect(page.getByText('Tu solicitud ya está publicada')).toBeVisible()
  await expect(page.getByText('Guarda este enlace')).toBeVisible()

  await page.goto('/')
  await expect(page.getByText(titulo)).toBeVisible()
})

test('el formulario rechaza un número que no es celular', async ({ page }) => {
  await page.goto('/nueva')

  await page.getByLabel('¿Qué está pasando?').fill('Necesitamos alimentos no perecederos')
  await page.getByLabel('Qué necesitas (1)').fill('Arroz')
  await page.getByLabel('Tu nombre').fill('Ana')
  await page.getByLabel('Tu WhatsApp').fill('6024851234')
  await page.getByLabel(/Autorizo publicar/).check()

  await page.getByRole('button', { name: 'Publicar solicitud' }).click()

  await expect(page.getByRole('alert')).toContainText(/celular/i)
})
```

- [ ] **Step 4: Escribir el recorrido de atención**

Crear `e2e/atender-solicitud.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

async function publicar(page: import('@playwright/test').Page, titulo: string) {
  await page.goto('/nueva')
  await page.getByLabel('Ciudad').selectOption('cali')
  await page.getByLabel('¿Qué está pasando?').fill(titulo)
  await page.getByLabel('Qué necesitas (1)').fill('Cobijas')
  await page.getByLabel('Tu nombre').fill('Ana Ruiz')
  await page.getByLabel('Tu WhatsApp').fill('3001234567')
  await page.getByLabel(/Autorizo publicar/).check()
  await page.getByRole('button', { name: 'Publicar solicitud' }).click()
  await expect(page.getByText('Tu solicitud ya está publicada')).toBeVisible()

  const enlace = await page.locator('p.font-mono').innerText()
  return enlace.trim()
}

test('un voluntario va en camino y la solicitante la cierra', async ({ page }) => {
  const titulo = `Necesitamos cobijas ${Date.now()}`
  const enlaceGestion = await publicar(page, titulo)

  const codigo = new URL(enlaceGestion).pathname.split('/').pop()!

  // El voluntario, sin el token de gestión.
  await page.goto(`/s/${codigo}`)
  await page.getByRole('button', { name: 'Voy en camino' }).click()
  await page.getByLabel('Tu nombre').fill('Luis Pérez')
  await page.getByRole('button', { name: 'Confirmar' }).click()

  await expect(page.getByText(/luis pérez va en camino/i)).toBeVisible()

  // La solicitante, con su enlace privado.
  await page.goto(enlaceGestion)
  await page.getByRole('button', { name: /ya recibí la ayuda/i }).click()
  await page.getByRole('button', { name: 'Sí, confirmar' }).click()

  await expect(page.getByText('Atendida')).toBeVisible()

  // Ya no debe salir entre las activas.
  await page.goto('/')
  await expect(page.getByText(titulo)).toHaveCount(0)
})

test('sin el enlace de gestión no se puede cerrar una solicitud', async ({ page }) => {
  const titulo = `Necesitamos pañales ${Date.now()}`
  const enlaceGestion = await publicar(page, titulo)
  const codigo = new URL(enlaceGestion).pathname.split('/').pop()!

  await page.goto(`/s/${codigo}`)
  await expect(page.getByRole('button', { name: /ya recibí la ayuda/i })).toHaveCount(0)
})
```

- [ ] **Step 5: Ejecutar**

```bash
npm run e2e
```

Expected: PASS, 4 pruebas. Ejecutar contra una base de datos de desarrollo, no contra la de producción.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: recorridos de extremo a extremo de publicación y atención"
```

---

### Task 22: Despliegue en el VPS

**Files:**
- Create: `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `nginx/reporta-cali.conf`, `docs/DESPLIEGUE.md`
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la aplicación en línea con TLS y el cron de mantenimiento.

- [ ] **Step 1: Preparar la salida autónoma**

En `next.config.ts`:

```ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  // Genera un servidor mínimo con solo las dependencias usadas:
  // la imagen baja de ~1 GB a unos 150 MB.
  output: 'standalone',
}

export default config
```

- [ ] **Step 2: Escribir el Dockerfile**

Crear `Dockerfile`:

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Migraciones y scripts de mantenimiento van dentro de la imagen.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
```

Crear `.dockerignore`:

```
node_modules
.next
.git
docs
e2e
design-system
*.test.ts
*.test.tsx
.env*
```

- [ ] **Step 3: Escribir el compose**

Crear `docker-compose.yml`:

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      IP_HASH_SECRET: ${IP_HASH_SECRET}
      ADMIN_TOKEN: ${ADMIN_TOKEN}
      ADMIN_COOKIE_SECRET: ${ADMIN_COOKIE_SECRET}
      NEXT_PUBLIC_SITE_URL: ${NEXT_PUBLIC_SITE_URL}
    # El `127.0.0.1:` del mapeo de puertos no es opcional ni cosmético: sin
    # él, la aplicación quedaría accesible desde internet sin pasar por
    # nginx, y entonces `X-Real-IP` la fijaría el propio cliente. El límite
    # que protege los números de teléfono de las personas que pidieron
    # ayuda se evadiría enviando una cabecera distinta en cada petición.
    # nginx debe ser la única puerta de entrada.
```

- [ ] **Step 4: Escribir la configuración de nginx**

Crear `nginx/reporta-cali.conf`:

```nginx
server {
    listen 80;
    server_name DOMINIO;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        # X-Real-IP es la fuente de verdad del límite de tasa. nginx la
        # SOBRESCRIBE con la IP real de conexión, así que el cliente no
        # puede falsificarla. Si se quita esta línea, la aplicación cae a
        # X-Forwarded-For y un bot podría elegir su propia identidad en
        # cada petición, evadiendo el límite que protege los números de
        # teléfono de las personas que pidieron ayuda. No la quites.
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Sustituir `DOMINIO` por el dominio real antes de instalarlo.

- [ ] **Step 5: Escribir el instructivo de despliegue**

Crear `docs/DESPLIEGUE.md`:

````markdown
# Despliegue en el VPS

## Primera vez

1. Instalar Docker, Docker Compose, nginx y certbot en el servidor.

2. Clonar el repositorio y crear el archivo de entorno:

```bash
cp .env.example .env
```

Generar los secretos y pegarlos en `.env`:

```bash
openssl rand -base64 32   # IP_HASH_SECRET
openssl rand -base64 32   # ADMIN_TOKEN
openssl rand -base64 32   # ADMIN_COOKIE_SECRET
```

`DATABASE_URL` apunta al Postgres ya existente. Si corre en el mismo host,
usar `host.docker.internal` o la IP del puente de Docker, no `localhost`.

3. Crear la base y aplicar el esquema:

```bash
npm ci
npm run db:migrate
npm run db:seed
```

4. Levantar la aplicación:

```bash
docker compose up -d --build
```

5. Configurar nginx y el certificado:

```bash
sudo cp nginx/reporta-cali.conf /etc/nginx/sites-available/reporta-cali
sudo ln -s /etc/nginx/sites-available/reporta-cali /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d TU_DOMINIO
```

6. Programar el mantenimiento diario:

```bash
crontab -e
```

Añadir, para que corra a las 3 de la mañana:

```
0 3 * * * cd /ruta/al/proyecto && /usr/bin/npm run maintenance >> /var/log/reporta-cali-mantenimiento.log 2>&1
```

## Actualizar

```bash
git pull
npm run db:migrate      # solo si hubo cambios de esquema
docker compose up -d --build
```

## Verificar que quedó bien

- `https://TU_DOMINIO` carga y muestra el listado.
- Crear una solicitud de prueba y borrarla con su enlace de gestión.
- `https://TU_DOMINIO/admin` pide clave.
- En los registros de nginx aparecen IPs reales de visitantes, no `127.0.0.1`.
- `npm run maintenance` corre a mano sin errores.

### Comprobación de seguridad obligatoria

El límite que impide recolectar los números de teléfono de quienes pidieron
ayuda depende por completo de que nginx sea la única puerta de entrada. Si la
aplicación queda accesible directamente, el propio cliente controla la
cabecera `X-Real-IP` y el límite se evade enviando una distinta en cada
petición.

Desde **otra máquina**, comprobar que el puerto de la aplicación no responde:

```bash
curl -m 5 http://IP_DEL_SERVIDOR:3000/
```

Debe fallar por tiempo de espera o conexión rechazada. Si responde con la
página, hay que corregirlo antes de anunciar la plataforma: revisar el mapeo
`127.0.0.1:3000:3000` del compose y el cortafuegos del servidor.

Y comprobar que la cabecera llega bien:

```bash
curl -s -H 'X-Real-IP: 1.2.3.4' https://TU_DOMINIO/api/events | head -c 200
```

nginx debe sobrescribir ese valor con la IP real de quien llama. Si en los
registros aparece `1.2.3.4`, falta `proxy_set_header X-Real-IP $remote_addr`.

## Cerrar la operación

Cuando la emergencia termine, la política de datos promete borrar todo:

```bash
docker compose down
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```
````

- [ ] **Step 6: Probar la imagen en local**

```bash
docker compose up --build
```

Abrir `http://localhost:3000` y comprobar que carga, que el mapa muestra teselas y que se puede publicar una solicitud.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: empaquetado con Docker, nginx, cron e instructivo de despliegue"
```

---

### Task 23: Editar una solicitud publicada

La spec promete al solicitante "editar, marcar atendida y cancelar". Las dos
últimas quedaron en la Task 18; esta cierra la primera.

**Files:**
- Modify: `src/lib/requests.ts`, `src/app/actions.ts`, `src/components/OwnerActions.tsx`
- Create: `src/components/EditRequestForm.tsx`
- Test: `src/lib/requests.update.test.ts`

**Interfaces:**
- Consumes: `requireOwner`, `createRequestSchema`.
- Produces:
  - `updateRequestSchema` — título, descripción, urgencia, ítems, barrio y dirección.
  - `updateRequest(code: string, manageToken: string, patch: UpdateRequestInput): Promise<void>`
  - `updateRequestAction(code, token, patch): Promise<Result>`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/lib/requests.update.test.ts`:

```ts
import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { testDb, resetTestDb, seedTestCity } from '@/test/db'
import { requests, requestItems } from '@/db/schema'
import { createRequest, updateRequest, getRequestByCode } from './requests'

beforeAll(() => { process.env.IP_HASH_SECRET = 'secreto-de-prueba' })
beforeEach(resetTestDb)

const input = {
  citySlug: 'cali',
  title: 'Familia sin agua ni alimentos',
  urgency: 'alta' as const,
  items: [{ name: 'Agua', quantity: '10 litros' }],
  requesterName: 'Ana Ruiz',
  whatsapp: '3001234567',
  lat: 3.44,
  lng: -76.52,
  acceptsPrivacy: true as const,
  website: '',
}

const patch = {
  title: 'Ya tenemos agua, ahora faltan cobijas',
  urgency: 'media' as const,
  items: [{ name: 'Cobijas', quantity: '4' }],
  neighborhood: 'Siloé',
  description: '',
  addressText: '',
}

describe('updateRequest', () => {
  it('cambia los datos con el token correcto', async () => {
    await seedTestCity()
    const created = await createRequest(input, '1.1.1.1')

    await updateRequest(created.publicCode, created.manageToken, patch)

    const detail = await getRequestByCode(created.publicCode)
    expect(detail?.title).toBe('Ya tenemos agua, ahora faltan cobijas')
    expect(detail?.urgency).toBe('media')
    expect(detail?.neighborhood).toBe('Siloé')
  })

  it('reemplaza la lista de ítems por completo', async () => {
    await seedTestCity()
    const created = await createRequest(input, '1.1.1.1')

    await updateRequest(created.publicCode, created.manageToken, patch)

    const items = await testDb.select().from(requestItems)
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('Cobijas')
  })

  it('rechaza a quien no tiene el token', async () => {
    await seedTestCity()
    const created = await createRequest(input, '1.1.1.1')
    await expect(
      updateRequest(created.publicCode, 'token-ajeno', patch)
    ).rejects.toThrow(/no autorizado/i)
  })

  it('no permite dejar la solicitud sin ítems', async () => {
    await seedTestCity()
    const created = await createRequest(input, '1.1.1.1')
    await expect(
      updateRequest(created.publicCode, created.manageToken, { ...patch, items: [] })
    ).rejects.toThrow()
  })

  it('no cambia el número ni la ciudad', async () => {
    await seedTestCity()
    const created = await createRequest(input, '1.1.1.1')

    await updateRequest(created.publicCode, created.manageToken, patch)

    const [row] = await testDb.select().from(requests)
    expect(row.whatsapp).toBe('+573001234567')
  })

  it('renueva updatedAt, lo que aplaza el archivado automático', async () => {
    await seedTestCity()
    const created = await createRequest(input, '1.1.1.1')
    await testDb.update(requests).set({ updatedAt: new Date('2026-01-01') })

    await updateRequest(created.publicCode, created.manageToken, patch)

    const [row] = await testDb.select().from(requests)
    expect(row.updatedAt.getFullYear()).toBe(new Date().getFullYear())
  })
})
```

- [ ] **Step 2: Ejecutar y confirmar que falla**

Run: `npm test -- src/lib/requests.update.test.ts`
Expected: FAIL — `updateRequest` no está exportada.

- [ ] **Step 3: Implementar**

Añadir a `src/lib/requests.ts`:

```ts
export const updateRequestSchema = createRequestSchema.pick({
  title: true,
  description: true,
  urgency: true,
  items: true,
  neighborhood: true,
  addressText: true,
})

export type UpdateRequestInput = z.input<typeof updateRequestSchema>

/**
 * No toca el WhatsApp ni la ciudad: cambiar el número por esta vía
 * permitiría secuestrar el contacto de una solicitud ajena si alguien
 * llegara a filtrar un enlace de gestión.
 */
export async function updateRequest(
  code: string,
  manageToken: string,
  raw: UpdateRequestInput
): Promise<void> {
  const patch = updateRequestSchema.parse(raw)
  const { request } = await requireOwner(code, manageToken)

  // Una solicitud cerrada no se edita. Además de no tener sentido para el
  // usuario, editarla movería `updatedAt` y alteraría el reloj de
  // anonimización que la política de datos promete cumplir.
  if (request.status !== 'abierta' && request.status !== 'en_atencion') {
    throw new Error('Esta solicitud ya está cerrada y no se puede editar')
  }

  await db.transaction(async (tx) => {
    await tx.update(requests).set({
      title: patch.title,
      description: patch.description || null,
      urgency: patch.urgency,
      neighborhood: patch.neighborhood || null,
      addressText: patch.addressText || null,
      updatedAt: new Date(),
    }).where(eq(requests.id, request.id))

    await tx.delete(requestItems).where(eq(requestItems.requestId, request.id))
    await tx.insert(requestItems).values(
      patch.items.map((item, index) => ({
        requestId: request.id,
        name: item.name,
        quantity: item.quantity || null,
        position: index,
      }))
    )
  })
}
```

- [ ] **Step 4: Ejecutar y confirmar que pasa**

Run: `npm test -- src/lib/requests.update.test.ts`
Expected: PASS, 6 pruebas.

- [ ] **Step 5: Añadir la Server Action**

Añadir a `src/app/actions.ts`:

```ts
import { updateRequest, type UpdateRequestInput } from '@/lib/requests'

export async function updateRequestAction(
  code: string,
  token: string,
  patch: UpdateRequestInput
): Promise<Result> {
  try {
    await updateRequest(code, token, patch)
    revalidatePath('/')
    revalidatePath(`/s/${code}`)
    return { ok: true }
  } catch (e) {
    if (e && typeof e === 'object' && 'issues' in e) {
      const issues = (e as { issues: { message: string }[] }).issues
      return { ok: false, error: issues[0]?.message ?? 'Revisa los datos' }
    }
    return fail(e)
  }
}
```

- [ ] **Step 6: Implementar el formulario de edición**

Crear `src/components/EditRequestForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ItemsField, type Item } from './ItemsField'
import { Button } from './ui/Button'
import { updateRequestAction } from '@/app/actions'
import type { RequestDetail } from '@/lib/requests'

export function EditRequestForm({
  detail,
  token,
  onDone,
}: {
  detail: RequestDetail
  token: string
  onDone: () => void
}) {
  const router = useRouter()
  const [title, setTitle] = useState(detail.title)
  const [description, setDescription] = useState(detail.description ?? '')
  const [urgency, setUrgency] = useState(detail.urgency)
  const [neighborhood, setNeighborhood] = useState(detail.neighborhood ?? '')
  const [addressText, setAddressText] = useState(detail.addressText ?? '')
  const [items, setItems] = useState<Item[]>(
    detail.items.map((i) => ({ name: i.name, quantity: i.quantity ?? '' }))
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const field = 'min-h-[44px] w-full rounded-lg border border-[--color-line] px-3 text-base'
  const label = 'block text-base font-semibold text-[--color-primary]'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const result = await updateRequestAction(detail.publicCode, token, {
      title,
      description,
      urgency,
      neighborhood,
      addressText,
      items: items.filter((i) => i.name.trim()),
    })

    if (result.ok) {
      onDone()
      router.refresh()
    } else {
      setError(result.error)
    }
    setSaving(false)
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-[--color-line] bg-white p-4">
      <h3 className="text-lg font-bold text-[--color-primary]">Editar solicitud</h3>

      <div>
        <label htmlFor="edit-titulo" className={label}>¿Qué está pasando?</label>
        <input id="edit-titulo" value={title} onChange={(e) => setTitle(e.target.value)} className={field} required minLength={8} />
      </div>

      <ItemsField items={items} onChange={setItems} />

      <div>
        <label htmlFor="edit-urgencia" className={label}>Urgencia</label>
        <select
          id="edit-urgencia"
          value={urgency}
          onChange={(e) => setUrgency(e.target.value as 'alta' | 'media' | 'baja')}
          className={`${field} cursor-pointer`}
        >
          <option value="alta">Alta — se necesita hoy</option>
          <option value="media">Media — en los próximos días</option>
          <option value="baja">Baja — puede esperar</option>
        </select>
      </div>

      <div>
        <label htmlFor="edit-descripcion" className={label}>Detalles</label>
        <textarea
          id="edit-descripcion"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-[--color-line] p-3 text-base"
        />
      </div>

      <div>
        <label htmlFor="edit-barrio" className={label}>Barrio o comuna</label>
        <input id="edit-barrio" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className={field} />
      </div>

      <div>
        <label htmlFor="edit-direccion" className={label}>Dirección o punto de referencia</label>
        <input id="edit-direccion" value={addressText} onChange={(e) => setAddressText(e.target.value)} className={field} />
      </div>

      {error && <p role="alert" className="text-sm font-semibold text-[--color-urgente]">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone} className="flex-1">
          Cancelar
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 7: Conectar el botón de editar**

En `src/components/OwnerActions.tsx`, añadir la prop `detail` y un tercer botón:

```tsx
import { Pencil } from 'lucide-react'
import { EditRequestForm } from './EditRequestForm'
import type { RequestDetail } from '@/lib/requests'
```

Añadir `detail: RequestDetail` a las props, un estado `const [editing, setEditing] = useState(false)`, y antes del bloque de confirmación:

```tsx
if (editing) {
  return <EditRequestForm detail={detail} token={token} onDone={() => setEditing(false)} />
}
```

Y dentro del grupo de botones, como primero:

```tsx
<Button variant="secondary" onClick={() => setEditing(true)} className="flex-1">
  <Pencil aria-hidden="true" className="h-5 w-5" />
  Editar
</Button>
```

En `src/components/RequestDetail.tsx`, pasar `detail={detail}` a `<OwnerActions>`.

En `src/components/OwnerActions.test.tsx`, añadir la prop en los cuatro renders:

```tsx
const detail = {
  publicCode: 'ABC123', title: 'Agua', description: null, urgency: 'alta' as const,
  status: 'abierta' as const, neighborhood: null, addressText: null,
  requesterName: 'Ana', peopleCount: null, lat: 3.44, lng: -76.52,
  cityName: 'Cali', citySlug: 'cali', items: [{ name: 'Agua', quantity: null }],
  itemCount: 1, claimedBy: null, createdAt: new Date(), fulfilledAt: null, canManage: true,
}
// ...
render(<OwnerActions code="ABC123" token="t" status="abierta" detail={detail} onFulfill={fulfill} onCancel={cancel} />)
```

- [ ] **Step 8: Ejecutar la batería completa**

Run: `npm test`
Expected: PASS, sin regresiones.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: edición de solicitudes por parte del solicitante"
```

---

## Verificación final

Antes de dar el trabajo por terminado, ejecutar y confirmar la salida:

```bash
npm test          # toda la batería de unidad e integración
npm run e2e       # los cuatro recorridos
npm run build     # compila sin errores de tipos
```

Y comprobar a mano, a 375 px de ancho:

- [ ] Ninguna pantalla se desplaza en horizontal.
- [ ] Todos los botones miden al menos 44 px de alto.
- [ ] Al recorrer con Tab, el foco se ve siempre.
- [ ] El número de WhatsApp no aparece en el HTML del inicio: `curl -s http://localhost:3000 | grep -c "57300"` devuelve `0`.
- [ ] Con la red desconectada, la aplicación no se queda en blanco: muestra el error.

