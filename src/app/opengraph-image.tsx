import { ImageResponse } from 'next/og'

// La imagen que acompaña al enlace cuando alguien lo comparte por WhatsApp,
// que es como va a circular esto. Se genera aquí en vez de guardar un PNG
// para que el texto siga al del sitio y no se quede desfasado.
//
// La bandera se dibuja con tres franjas y no con el PNG del icono: así la
// imagen no depende de leer un archivo del disco en tiempo de ejecución.

export const alt = 'Reporta Ayuda — ayuda tras el terremoto del 10 de agosto en Colombia'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#F8FAFC',
        }}
      >
        {/* Bandera de Colombia: la franja amarilla ocupa la mitad. */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <div style={{ height: 20, backgroundColor: '#FCD116' }} />
          <div style={{ height: 10, backgroundColor: '#003893' }} />
          <div style={{ height: 10, backgroundColor: '#CE1126' }} />
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
            padding: '0 90px',
          }}
        >
          <div style={{ fontSize: 92, fontWeight: 700, color: '#0F172A' }}>Reporta Ayuda</div>
          <div style={{ fontSize: 40, color: '#334155', marginTop: 28, lineHeight: 1.35 }}>
            Plataforma de ayuda durante la emergencia por el terremoto del 10 de agosto en
            Colombia.
          </div>
          <div style={{ fontSize: 32, color: '#0369A1', marginTop: 40 }}>reportayuda.com</div>
        </div>
      </div>
    ),
    size
  )
}
