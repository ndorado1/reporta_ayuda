import { test, expect } from '@playwright/test'

test('una persona publica una solicitud y aparece en el listado', async ({ page }) => {
  const titulo = `Familia sin agua ${Date.now()}`

  await page.goto('/nueva')

  // { exact: true }: el nombre accesible del selector de la cabecera ahora
  // es "Filtrar por ciudad" (distinto del campo del formulario, que es
  // "Ciudad") — la ambigüedad real de accesibilidad ya no existe. Pero
  // `getByLabel` sin `exact` hace coincidencia de subcadena sin distinguir
  // mayúsculas, y "ciudad" sigue apareciendo dentro de "Filtrar por
  // ciudad", así que Playwright todavía necesita la pista.
  await page.getByLabel('Ciudad', { exact: true }).selectOption('cali')
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

  // Next.js añade su propio elemento role="alert" (el anunciador de rutas
  // de App Router), siempre presente y vacío: hay que filtrar por texto
  // para llegar al alert del formulario.
  await expect(page.getByRole('alert').filter({ hasText: /celular/i })).toBeVisible()
})
