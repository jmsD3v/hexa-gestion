'use client';

// ============================================================
// /components/modules/ordenes/OrdenForm.tsx
// Formulario de creación de Orden de Servicio
// ============================================================

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { crearOrden } from '@/app/actions/ordenes';
import type { CrearOrdenServicioDTO } from '@/types';

interface Props {
  presupuestoId?: string;
  clienteId?: string;
  onSuccess?: (id: string) => void;
}

export default function OrdenForm({
  presupuestoId,
  clienteId,
  onSuccess,
}: Props) {
  const [clienteIdLocal, setClienteIdLocal] = useState(clienteId ?? '');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [objetivoTecnico, setObjetivoTecnico] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFinEstimada, setFechaFinEstimada] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (!titulo.trim() || !clienteIdLocal.trim()) {
      setError('Cliente y título son obligatorios');
      return;
    }

    setGuardando(true);

    const dto: CrearOrdenServicioDTO = {
      cliente_id: clienteIdLocal.trim(),
      titulo: titulo.trim(),
      ...(presupuestoId ? { presupuesto_id: presupuestoId } : {}),
      ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
      ...(objetivoTecnico.trim()
        ? { objetivo_tecnico: objetivoTecnico.trim() }
        : {}),
      ...(fechaInicio ? { fecha_inicio: fechaInicio } : {}),
      ...(fechaFinEstimada ? { fecha_fin_estimada: fechaFinEstimada } : {}),
    };

    const r = await crearOrden(dto);
    setGuardando(false);

    if (r.error) {
      setError(r.error);
      return;
    }

    if (onSuccess && r.data) {
      onSuccess(r.data.id);
    } else {
      window.location.href = '/ordenes';
    }
  };

  return (
    <div className='min-h-screen bg-slate-900'>
      {/* Header */}
      <div className='bg-slate-800 border-b border-slate-700 px-6 py-5'>
        <div className='max-w-4xl mx-auto'>
          <h1 className='text-lg font-bold text-slate-100'>
            Nueva Orden de Servicio
          </h1>
          <p className='text-xs text-slate-400'>
            Creá la orden de trabajo para el cliente
          </p>
        </div>
      </div>

      <div className='max-w-4xl mx-auto px-6 py-8 space-y-6'>
        {/* Datos generales */}
        <div className='bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-5'>
          <h2 className='text-sm font-semibold text-slate-100'>
            Datos de la orden
          </h2>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {/* Cliente ID */}
            <div>
              <label className='block text-xs font-medium text-slate-300 mb-1.5'>
                Cliente ID *
              </label>
              <input
                type='text'
                value={clienteIdLocal}
                onChange={(e) => setClienteIdLocal(e.target.value)}
                placeholder='UUID del cliente'
                className='w-full text-sm px-3 py-2 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono'
                readOnly={!!clienteId}
              />
            </div>

            {/* Título */}
            <div>
              <label className='block text-xs font-medium text-slate-300 mb-1.5'>
                Título *
              </label>
              <input
                type='text'
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder='Ej: Instalación de sistema HVAC'
                className='w-full text-sm px-3 py-2 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>

            {/* Fecha inicio */}
            <div>
              <label className='block text-xs font-medium text-slate-300 mb-1.5'>
                Fecha inicio
              </label>
              <input
                type='date'
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className='w-full text-sm px-3 py-2 border border-slate-600 bg-slate-700 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>

            {/* Fecha fin estimada */}
            <div>
              <label className='block text-xs font-medium text-slate-300 mb-1.5'>
                Fecha fin estimada
              </label>
              <input
                type='date'
                value={fechaFinEstimada}
                onChange={(e) => setFechaFinEstimada(e.target.value)}
                className='w-full text-sm px-3 py-2 border border-slate-600 bg-slate-700 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className='block text-xs font-medium text-slate-300 mb-1.5'>
              Descripción
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              placeholder='Descripción general del trabajo a realizar...'
              className='w-full text-sm px-3 py-2 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'
            />
          </div>

          {/* Objetivo técnico */}
          <div>
            <label className='block text-xs font-medium text-slate-300 mb-1.5'>
              Objetivo técnico
            </label>
            <textarea
              value={objetivoTecnico}
              onChange={(e) => setObjetivoTecnico(e.target.value)}
              rows={2}
              placeholder='Objetivos técnicos específicos...'
              className='w-full text-sm px-3 py-2 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className='flex items-center gap-2 px-4 py-3 bg-red-900/20 border border-red-600 rounded-xl text-red-400 text-sm'>
            <AlertTriangle className='w-4 h-4 text-amber-500' /> {error}
          </div>
        )}

        {/* Acciones */}
        <div className='flex items-center justify-between'>
          <a
            href='/ordenes'
            className='px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors'
          >
            ← Volver
          </a>
          <button
            type='button'
            onClick={handleSubmit}
            disabled={guardando}
            className='px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors'
          >
            {guardando ? 'Creando…' : 'Crear orden de servicio'}
          </button>
        </div>
      </div>
    </div>
  );
}
