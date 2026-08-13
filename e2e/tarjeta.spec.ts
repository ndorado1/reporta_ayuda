import { test, expect, type Page } from '@playwright/test'

async function publicar(page: Page, titulo: string) {
  await page.goto('/nueva')
  await page.getByLabel('Ciudad', { exact: true }).selectOption('cali')
  await page.getByLabel('¿Qué está pasando?').fill(titulo)
  await page.getByLabel('Qué necesitas (1)').fill('Cobijas')
  await page.getByLabel('Tu nombre').fill('Ana Ruiz')
  await page.getByLabel('Tu WhatsApp').fill('3001234567')
  await page.getByLabel(/Autorizo publicar/).check()
  await page.getByRole('button', { name: 'Publicar solicitud' }).click()
  await expect(page.getByText('Tu solicitud ya está publicada')).toBeVisible()
}

test('pulsar cualquier parte de la tarjeta abre el detalle', async ({ page }) => {
  const titulo = `Tarjeta clicable ${Date.now()}`
  await publicar(page, titulo)

  await page.goto('/')
  const tarjeta = page.locator('article').filter({ hasText: titulo }).first()

  // La línea de ubicación: texto corriente, ni enlace ni botón. Antes solo el
  // título llevaba a algún sitio y pulsar aquí no hacía nada.
  //
  // Se pulsa por coordenadas y no con `locator.click()` porque este último
  // comprueba antes que el elemento no esté tapado, y aquí lo está a
  // propósito: encima va la capa que hace clicable la tarjeta. Un dedo sobre
  // el cristal no hace esa comprobación.
  const ubicacion = tarjeta.getByText(/Cali/).first()
  // Las coordenadas de `boundingBox` son relativas a la ventana: si la
  // tarjeta quedó fuera de la parte visible, el clic caería en otro sitio.
  await ubicacion.scrollIntoViewIfNeeded()
  const caja = (await ubicacion.boundingBox())!
  await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2)

  await expect(page).toHaveURL(/\/s\/[a-z0-9]+/i)
  await expect(page.getByRole('heading', { name: titulo })).toBeVisible()
})

test('los botones de la tarjeta siguen respondiendo a lo suyo', async ({ page }) => {
  const titulo = `Tarjeta con botones ${Date.now()}`
  await publicar(page, titulo)

  await page.goto('/')
  const tarjeta = page.locator('article').filter({ hasText: titulo }).first()

  // La capa que hace clicable la tarjeta cubre también los botones. Si no se
  // los eleva por encima, esto se lleva al detalle en vez de abrir el
  // formulario, y el botón queda inservible sin que salte ningún error.
  await tarjeta.getByRole('button', { name: 'Voy en camino' }).click()

  await expect(page.getByLabel('Tu nombre')).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
})
