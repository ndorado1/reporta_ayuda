# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Reporta Cali
**Generated:** 2026-08-13 10:30:16
**Category:** Government/Public Service

---

## Overrides del proyecto (prevalecen sobre lo demás)

Estas decisiones se toman por el contexto real de uso: personas damnificadas,
teléfonos Android de gama baja, datos móviles y batería escasa.

### Tipografía: solo Public Sans

Se descarta **Libre Bodoni**. Una serif editorial no aporta nada aquí y suma una
familia extra que hay que descargar con datos móviles. Public Sans en todos los
niveles: es la fuente del sistema de diseño del gobierno de EE. UU., diseñada
para legibilidad en texto administrativo, y rinde bien en pantallas pequeñas.

Se carga con `next/font/google`, que la autohospeda: sin petición a
`fonts.googleapis.com` en tiempo de ejecución y sin salto de maquetación.

### Colores semánticos

| Rol | Hex | Contraste sobre `#F8FAFC` |
|---|---|---|
| Urgencia alta | `#B91C1C` | 6.0:1 |
| Urgencia media | `#B45309` | 4.9:1 |
| Urgencia baja | `#15803D` | 4.8:1 |
| WhatsApp (fondo de botón, texto blanco) | `#067647` | 4.9:1 |

El verde de marca de WhatsApp (`#25D366`) **no se usa como fondo con texto
blanco**: da 1.9:1 y sería ilegible al sol, que es justo donde va a usarse. Se
reserva para el icono SVG sobre fondo claro.

### El color nunca es el único indicador

Cada distintivo de urgencia y de estado combina **icono + texto + color**. Una
persona con daltonismo, o mirando la pantalla bajo el sol, debe distinguir una
urgencia alta de una baja sin depender del tono.

### Movimiento

El estilo base ya desaconseja los efectos de movimiento y aquí se refuerza:
transiciones solo de `color`, `background-color`, `border-color`, `opacity` y
`box-shadow`, entre 150 y 200 ms. Sin `transform: translateY` en tarjetas ni
botones: en gama baja produce tirones y no aporta información.

Esto **anula** las reglas `.btn-primary:hover { transform: translateY(-1px) }` y
`.card:hover { transform: translateY(-2px) }` que aparecen más abajo.

### Objetivos táctiles

Mínimo 44×44 px con 8 px de separación, sin excepciones. Los botones de
"Contactar por WhatsApp" y "Voy en camino" conviven en la misma tarjeta y son
las dos acciones que no se pueden pulsar por error.

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#0F172A` | `--color-primary` |
| Secondary | `#334155` | `--color-secondary` |
| CTA/Accent | `#0369A1` | `--color-cta` |
| Background | `#F8FAFC` | `--color-background` |
| Text | `#020617` | `--color-text` |

**Color Notes:** High contrast navy + blue

### Typography

- **Heading Font:** Libre Bodoni
- **Body Font:** Public Sans
- **Mood:** magazine, editorial, publishing, refined, journalism, print
- **Google Fonts:** [Libre Bodoni + Public Sans](https://fonts.google.com/share?selection.family=Libre+Bodoni:wght@400;500;600;700|Public+Sans:wght@300;400;500;600;700)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Libre+Bodoni:wght@400;500;600;700&family=Public+Sans:wght@300;400;500;600;700&display=swap');
```

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #0369A1;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #0F172A;
  border: 2px solid #0F172A;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #F8FAFC;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #0F172A;
  outline: none;
  box-shadow: 0 0 0 3px #0F172A20;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Accessible & Ethical

**Keywords:** High contrast, large text (16px+), keyboard navigation, screen reader friendly, WCAG compliant, focus state, semantic

**Best For:** Government, healthcare, education, inclusive products, large audience, legal compliance, public

**Key Effects:** Clear focus rings (3-4px), ARIA labels, skip links, responsive design, reduced motion, 44x44px touch targets

### Page Pattern

**Pattern Name:** Minimal & Direct

- **CTA Placement:** Above fold
- **Section Order:** Hero > Features > CTA

---

## Anti-Patterns (Do NOT Use)

- ❌ Ornate design
- ❌ Low contrast
- ❌ Motion effects
- ❌ AI purple/pink gradients

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
