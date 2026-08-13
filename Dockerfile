FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Único valor que hace falta al construir: Next.js incrusta las variables
# NEXT_PUBLIC_ en el JavaScript durante el build, así que ponerla solo en el
# entorno de ejecución no serviría de nada. Es el dominio público, no un
# secreto, y por eso sí puede quedar en la imagen. Ninguna otra variable se
# declara aquí a propósito: la aplicación no necesita base de datos para
# construirse, y un ARG queda grabado en el historial de capas.
ARG NEXT_PUBLIC_SITE_URL=https://reportayuda.com
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Migraciones y scripts de mantenimiento van dentro de la imagen, para poder
# correrlos con `docker exec` en servidores donde no hay una copia del
# repositorio (EasyPanel, Coolify y similares construyen desde su propio
# directorio y no dejan el proyecto accesible).
#
# drizzle.config.ts lo necesita `drizzle-kit migrate` y tsconfig.json lo
# necesita `tsx` para resolver los imports con alias `@/`: sin ellos los
# comandos fallan aunque el código sí esté copiado.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
