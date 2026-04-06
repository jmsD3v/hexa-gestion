import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // PDFKit + fontkit usan decoradores de @swc/helpers incompatibles con Turbopack.
  // Excluirlos del bundle hace que Node los cargue directamente (CJS nativo).
  serverExternalPackages: ['pdfkit', 'fontkit'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
}

export default nextConfig
