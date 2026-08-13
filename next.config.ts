import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Genera un servidor mínimo con solo las dependencias usadas:
  // la imagen baja de ~1 GB a unos 150 MB.
  output: "standalone",

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            // El enlace de gestión de una solicitud lleva el token en la URL
            // (?t=...) y ese token da control total sobre la solicitud de
            // una persona damnificada (cerrarla, cancelarla, ver sus datos).
            // La pantalla de detalle tiene enlaces externos (atribución de
            // OpenStreetMap, WhatsApp): sin esta cabecera, el navegador
            // podría enviarles la URL completa, con el token incluido, como
            // referente. "same-origin" hace que el referente solo viaje
            // dentro de nuestro propio sitio y nunca a un destino externo.
            // La aplicación no depende del referente para nada: no quitar.
            key: "Referrer-Policy",
            value: "same-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
