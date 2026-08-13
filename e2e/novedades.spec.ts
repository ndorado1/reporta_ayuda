import { test, expect } from '@playwright/test'

// Regresión: el panel se recortaba a la altura de la cabecera porque un
// ancestro con `backdrop-filter` pasaba a resolver la posición del `fixed`,
// en vez del viewport. Se veía como una tira de unos 100 px pegada arriba.
//
// Esto solo se puede comprobar midiendo la caja renderizada: en jsdom no hay
// disposición que medir, así que una prueba unitaria pasaría con el código
// roto igual que con el arreglado.
test('el panel de novedades ocupa el alto de la pantalla', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Novedades/ }).click()

  const panel = page.getByRole('dialog', { name: 'Novedades' })
  await expect(panel).toBeVisible()

  const caja = await panel.boundingBox()
  const alto = page.viewportSize()!.height

  // Arriba del todo y hasta abajo. Con el fallo, `caja.height` era la altura
  // de la cabecera: una décima parte de esto.
  expect(caja!.y).toBe(0)
  expect(caja!.height).toBe(alto)
})
