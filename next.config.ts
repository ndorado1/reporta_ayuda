import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Genera un servidor mínimo con solo las dependencias usadas:
  // la imagen baja de ~1 GB a unos 150 MB.
  output: "standalone",
};

export default nextConfig;
