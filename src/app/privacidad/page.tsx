export const metadata = { title: 'Política de datos — Reporta Cali' }

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <h1 className="text-2xl font-bold tracking-tight text-(--color-primary)">
        Qué hacemos con tus datos
      </h1>

      <p className="text-(--color-secondary)">
        Reporta Cali existe para que la ayuda llegue a quien la necesita después del
        terremoto. Para eso necesitamos unos pocos datos tuyos. Esto es exactamente
        qué guardamos, qué mostramos y por cuánto tiempo.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-(--color-primary)">Qué guardamos</h2>
        <p className="text-(--color-secondary)">
          Tu nombre, tu número de WhatsApp, la ubicación que marcaste, el barrio, la
          descripción y la lista de cosas que necesitas. También guardamos una versión
          cifrada de tu dirección IP, que usamos únicamente para frenar mensajes
          automáticos y contenido malicioso.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-(--color-primary)">Qué se ve en público</h2>
        <p className="text-(--color-secondary)">
          Todo lo anterior, <strong>menos tu número de WhatsApp</strong>. El número no
          aparece en la lista, ni en el mapa, ni en el código de la página. Solo se
          entrega a quien pulsa el botón para contactarte, y limitamos cuántas veces
          se puede pedir desde una misma conexión para que nadie recolecte los números
          de todas las personas afectadas.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-(--color-primary)">Por cuánto tiempo</h2>
        <p className="text-(--color-secondary)">
          Conservamos tus datos <strong>mientras dure la emergencia</strong>. Dos meses
          después de que tu solicitud quede atendida o cancelada, borramos
          automáticamente tu nombre, tu número y tu dirección, y dejamos solo el barrio,
          la ciudad y qué se necesitaba, sin nada que permita identificarte. Cuando la
          operación de ayuda termine, se elimina toda la base de datos.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-(--color-primary)">Qué nunca hacemos</h2>
        <ul className="list-disc space-y-1 pl-5 text-(--color-secondary)">
          <li>No vendemos ni compartimos tus datos con nadie.</li>
          <li>No los usamos para publicidad.</li>
          <li>No hay rastreadores, ni analítica, ni cookies de terceros.</li>
          <li>No enviamos correos: todos los avisos ocurren dentro de la página.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-(--color-primary)">Cómo borrar tu solicitud</h2>
        <p className="text-(--color-secondary)">
          Cuando publicas, te damos un enlace privado. Ábrelo y usa el botón
          &ldquo;Cancelar solicitud&rdquo;: desaparece de inmediato. No tienes que
          esperar ningún plazo ni pedir permiso a nadie.
        </p>
      </section>

      <p className="rounded-lg bg-slate-50 p-4 text-sm text-(--color-muted)">
        Este tratamiento se hace conforme a la Ley 1581 de 2012 de protección de datos
        personales. Al publicar una solicitud autorizas expresamente el uso descrito
        aquí, y puedes revocar esa autorización borrando tu solicitud.
      </p>
    </div>
  )
}
