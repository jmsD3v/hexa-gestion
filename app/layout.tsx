import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: {
    default: 'HEXA | Sistema de Gestión',
    template: '%s — Hexa Gestión',
  },
  description:
    'Sistema de Gestión Comercial, Operativa y Documental — Hexa Servicios Integrales SAS',
  robots: { index: false, follow: false }, // Sistema interno — no indexar
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang='es-AR'
      className={`${geist.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className='antialiased bg-slate-950 text-slate-100'>
        {children}
      </body>
    </html>
  );
}
