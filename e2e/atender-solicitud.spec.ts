import { test, expect } from '@playwright/test'

async function publicar(page: import('@playwright/test').Page, titulo: string) {
  await page.goto('/nueva')
  // { exact: true }: el nombre accesible del selector de la cabecera ahora
  // es "Filtrar por ciudad" (distinto del campo del formulario, que es
  // "Ciudad") — la ambigüedad real de accesibilidad ya no existe. Pero
  // `getByLabel` sin `exact` hace coincidencia de subcadena sin distinguir
  // mayúsculas, y "ciudad" sigue apareciendo dentro de "Filtrar por
  // ciudad", así que Playwright todavía necesita la pista.
  await page.getByLabel('Ciudad', { exact: true }).selectOption('cali')
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
