// ============================================================
// /app/(dashboard)/clientes/nuevo/page.tsx
// Página de creación de nuevo cliente
// ============================================================

import type { Metadata } from 'next';
import ClienteForm from '@/components/modules/clientes/ClienteForm';

export const metadata: Metadata = {
  title: 'Nuevo Cliente — Hexa Gestión',
  description: 'Formulario de alta de nuevo cliente',
};

export default function NuevoClientePage() {
  return <ClienteForm />;
}
