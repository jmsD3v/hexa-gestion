'use client';

// ============================================================
// /components/modules/logistica/RemitoForm.tsx
// Formulario de creación de Remito
// ============================================================

import { useState, useCallback } from 'react';
import { Plus, Trash2, Truck, AlertCircle, ArrowUpDown } from 'lucide-react';
import { crearRemito } from '@/app/actions/logistica';
import type { CrearRemitoDTO } from '@/types';
import type { TipoRemito } from '@/types/database';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ItemLocal {
  _key: string;
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
  precio_unitario: string;
}

const UNIDADES = [
  'un',
  'kg',
  'lt',
  'm',
  'm²',
  'm³',
  'hs',
  'día',
  'mts',
  'rollo',
  'caja',
  'set',
];

const TIPO_REMITO_OPTS: { value: TipoRemito; label: string; desc: string }[] = [
  {
    value: 'INTERNO_ENTRADA',
    label: 'Interno Entrada',
    desc: 'Ingreso de materiales o equipos propios',
  },
  {
    value: 'INTERNO_SALIDA',
    label: 'Interno Salida',
    desc: 'Salida de materiales o equipos propios',
  },
  {
    value: 'LEGAL_ENTRADA',
    label: 'Legal Entrada',
    desc: 'Recepción con documento fiscal',
  },
  {
    value: 'LEGAL_SALIDA',
    label: 'Legal Salida',
    desc: 'Entrega con documento fiscal (Remito R)',
  },
];

function crearItem(): ItemLocal {
  return {
    _key: crypto.randomUUID(),
    descripcion: '',
    unidad_medida: 'un',
    cantidad: 1,
    precio_unitario: '',
  };
}

// ── Fila de ítem ──────────────────────────────────────────────────────────────

function FilaItem({
  item,
  onChange,
  onRemove,
  idx,
  canRemove,
}: {
  item: ItemLocal;
  onChange: (
    key: string,
    field: keyof ItemLocal,
    value: string | number,
  ) => void;
  onRemove: (key: string) => void;
  idx: number;
  canRemove: boolean;
}) {
  return (
    <div className='grid grid-cols-12 gap-2 items-center px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl'>
      <div className='col-span-1 text-center text-xs text-slate-500 font-mono font-semibold'>
        {idx + 1}
      </div>

      <div className='col-span-5'>
        <input
          type='text'
          value={item.descripcion}
          onChange={(e) => onChange(item._key, 'descripcion', e.target.value)}
          placeholder='Descripción del ítem…'
          className='w-full text-sm px-3 py-1.5 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
      </div>

      <div className='col-span-2'>
        <select
          value={item.unidad_medida}
          onChange={(e) => onChange(item._key, 'unidad_medida', e.target.value)}
          className='w-full text-sm px-2 py-1.5 border border-slate-600 bg-slate-700 text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
        >
          {UNIDADES.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </div>

      <div className='col-span-2'>
        <input
          type='number'
          min={0.01}
          step='any'
          value={item.cantidad}
          onChange={(e) =>
            onChange(item._key, 'cantidad', parseFloat(e.target.value) || 0)
          }
          className='w-full text-sm px-3 py-1.5 border border-slate-600 bg-slate-700 text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right'
        />
      </div>

      <div className='col-span-1'>
        <input
          type='number'
          min={0}
          step='any'
          value={item.precio_unitario}
          onChange={(e) =>
            onChange(item._key, 'precio_unitario', e.target.value)
          }
          placeholder='$'
          className='w-full text-sm px-2 py-1.5 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right'
        />
      </div>

      <div className='col-span-1 flex justify-end'>
        {canRemove && (
          <button
            type='button'
            onClick={() => onRemove(item._key)}
            className='p-1.5 rounded-lg hover:bg-red-900/30 text-slate-500 hover:text-red-400 transition-colors'
          >
            <Trash2 className='w-3.5 h-3.5' />
          </button>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// FORMULARIO PRINCIPAL
// ════════════════════════════════════════════════════════════

interface Props {
  ordenId?: string;
  notaPedidoId?: string;
  clienteId?: string;
  onSuccess?: (id: string) => void;
}

export default function RemitoForm({
  ordenId,
  notaPedidoId,
  clienteId,
  onSuccess,
}: Props) {
  const [tipo, setTipo] = useState<TipoRemito>('LEGAL_SALIDA');
  const [fechaEmision, setFechaEmision] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [ordenIdLocal, setOrdenIdLocal] = useState(ordenId ?? '');
  const [direccionEntrega, setDireccionEntrega] = useState('');
  const [transportista, setTransportista] = useState('');
  const [patenteVehiculo, setPatenteVehiculo] = useState('');
  const [chofer, setChofer] = useState('');
  const [notas, setNotas] = useState('');
  const [items, setItems] = useState<ItemLocal[]>([crearItem()]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleItemChange = useCallback(
    (key: string, field: keyof ItemLocal, value: string | number) => {
      setItems((prev) =>
        prev.map((it) => (it._key === key ? { ...it, [field]: value } : it)),
      );
    },
    [],
  );

  const agregarItem = () => setItems((prev) => [...prev, crearItem()]);
  const eliminarItem = (key: string) =>
    setItems((prev) => prev.filter((it) => it._key !== key));

  // Subtotal estimado
  const subtotal = items.reduce((acc, it) => {
    const p = parseFloat(it.precio_unitario) || 0;
    return acc + p * it.cantidad;
  }, 0);
  const tienePrecios = items.some((it) => it.precio_unitario !== '');

  const handleSubmit = async () => {
    setError(null);

    const itemsInvalidos = items.filter(
      (it) => !it.descripcion.trim() || it.cantidad <= 0,
    );
    if (itemsInvalidos.length) {
      setError('Completá descripción y cantidad de todos los ítems');
      return;
    }

    setGuardando(true);

    const dto: CrearRemitoDTO = {
      tipo,
      fecha_emision: fechaEmision,
      ...(ordenIdLocal ? { orden_id: ordenIdLocal } : {}),
      ...(notaPedidoId ? { nota_pedido_id: notaPedidoId } : {}),
      ...(clienteId ? { cliente_id: clienteId } : {}),
      ...(direccionEntrega.trim()
        ? { direccion_entrega: direccionEntrega.trim() }
        : {}),
      ...(transportista.trim() ? { transportista: transportista.trim() } : {}),
      ...(patenteVehiculo.trim()
        ? { patente_vehiculo: patenteVehiculo.trim() }
        : {}),
      ...(chofer.trim() ? { chofer: chofer.trim() } : {}),
      ...(notas.trim() ? { notas: notas.trim() } : {}),
      items: items.map((it) => ({
        descripcion: it.descripcion.trim(),
        unidad_medida: it.unidad_medida,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario
          ? parseFloat(it.precio_unitario)
          : undefined,
      })),
    };

    const r = await crearRemito(dto);
    setGuardando(false);

    if (r.error) {
      setError(r.error);
      return;
    }
    if (onSuccess && r.data) onSuccess(r.data.id);
    else window.location.href = '/logistica';
  };

  return (
    <div className='min-h-screen bg-slate-900'>
      {/* Header */}
      <div className='bg-slate-800 border-b border-slate-700 px-6 py-5'>
        <div className='max-w-4xl mx-auto flex items-center gap-3'>
          <div className='w-9 h-9 rounded-xl bg-indigo-900/40 flex items-center justify-center'>
            <Truck className='w-5 h-5 text-indigo-400' />
          </div>
          <div>
            <h1 className='text-lg font-bold text-slate-100'>Nuevo remito</h1>
            <p className='text-xs text-slate-400'>
              Registrá movimiento de materiales o entrega de servicio
            </p>
          </div>
        </div>
      </div>

      <div className='max-w-4xl mx-auto px-6 py-8 space-y-6'>
        {/* Tipo de remito */}
        <div className='bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-4'>
          <h2 className='text-sm font-semibold text-slate-100'>
            Tipo de remito
          </h2>
          <div className='grid grid-cols-2 gap-3'>
            {TIPO_REMITO_OPTS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-colors ${
                  tipo === opt.value
                    ? 'border-blue-500 bg-blue-900/30'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <input
                  type='radio'
                  name='tipo'
                  value={opt.value}
                  checked={tipo === opt.value}
                  onChange={() => setTipo(opt.value)}
                  className='mt-0.5 accent-blue-600'
                />
                <div>
                  <p className='text-sm font-semibold text-slate-100'>
                    {opt.label}
                  </p>
                  <p className='text-xs text-slate-400 mt-0.5'>{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Datos generales */}
        <div className='bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-4'>
          <h2 className='text-sm font-semibold text-slate-100'>
            Datos del remito
          </h2>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {/* Fecha emisión */}
            <div>
              <label className='block text-xs font-medium text-slate-400 mb-1.5'>
                Fecha de emisión
              </label>
              <input
                type='date'
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
                className='w-full text-sm px-3 py-2 border border-slate-600 bg-slate-700 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>

            {/* OS vinculada */}
            <div>
              <label className='block text-xs font-medium text-slate-400 mb-1.5'>
                OS vinculada (opcional)
              </label>
              <input
                type='text'
                value={ordenIdLocal}
                onChange={(e) => setOrdenIdLocal(e.target.value)}
                placeholder='ID de la Orden de Servicio…'
                className='w-full text-sm px-3 py-2 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono'
                readOnly={!!ordenId}
              />
            </div>

            {/* Dirección entrega */}
            <div className='md:col-span-2'>
              <label className='block text-xs font-medium text-slate-400 mb-1.5'>
                Dirección de entrega
              </label>
              <input
                type='text'
                value={direccionEntrega}
                onChange={(e) => setDireccionEntrega(e.target.value)}
                placeholder='Calle, número, localidad…'
                className='w-full text-sm px-3 py-2 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>
          </div>
        </div>

        {/* Datos del transporte */}
        <div className='bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-4'>
          <div className='flex items-center gap-2'>
            <ArrowUpDown className='w-4 h-4 text-slate-500' />
            <h2 className='text-sm font-semibold text-slate-100'>
              Datos del transporte (opcional)
            </h2>
          </div>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div>
              <label className='block text-xs font-medium text-slate-400 mb-1.5'>
                Transportista
              </label>
              <input
                type='text'
                value={transportista}
                onChange={(e) => setTransportista(e.target.value)}
                placeholder='Nombre o empresa…'
                className='w-full text-sm px-3 py-2 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-slate-400 mb-1.5'>
                Patente del vehículo
              </label>
              <input
                type='text'
                value={patenteVehiculo}
                onChange={(e) =>
                  setPatenteVehiculo(e.target.value.toUpperCase())
                }
                placeholder='AA 000 AA'
                className='w-full text-sm px-3 py-2 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase font-mono tracking-widest'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-slate-400 mb-1.5'>
                Chofer
              </label>
              <input
                type='text'
                value={chofer}
                onChange={(e) => setChofer(e.target.value)}
                placeholder='Nombre del chofer…'
                className='w-full text-sm px-3 py-2 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>
          </div>
          <div>
            <label className='block text-xs font-medium text-slate-400 mb-1.5'>
              Observaciones
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder='Condiciones de entrega, aclaraciones…'
              className='w-full text-sm px-3 py-2 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'
            />
          </div>
        </div>

        {/* Ítems */}
        <div className='bg-slate-800 rounded-2xl border border-slate-700 p-6'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='text-sm font-semibold text-slate-100'>
              Ítems del remito
            </h2>
            {tienePrecios && (
              <span className='text-sm font-semibold text-slate-300'>
                Subtotal:{' '}
                <span className='text-blue-400'>
                  $
                  {subtotal.toLocaleString('es-AR', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </span>
            )}
          </div>

          <div className='grid grid-cols-12 gap-2 px-3 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider'>
            <div className='col-span-1 text-center'>#</div>
            <div className='col-span-5'>Descripción</div>
            <div className='col-span-2'>Unidad</div>
            <div className='col-span-2 text-right'>Cantidad</div>
            <div className='col-span-1 text-right'>$ Unit.</div>
            <div className='col-span-1' />
          </div>

          <div className='space-y-2'>
            {items.map((it, idx) => (
              <FilaItem
                key={it._key}
                item={it}
                idx={idx}
                onChange={handleItemChange}
                onRemove={eliminarItem}
                canRemove={items.length > 1}
              />
            ))}
          </div>

          <button
            type='button'
            onClick={agregarItem}
            className='mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-700 hover:border-indigo-400/50 hover:bg-indigo-900/20 text-slate-400 hover:text-indigo-400 text-sm font-medium rounded-xl transition-all'
          >
            <Plus className='w-4 h-4' /> Agregar ítem
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className='flex items-center gap-2 px-4 py-3 bg-red-900/20 border border-red-600 rounded-xl text-red-400 text-sm'>
            <AlertCircle className='w-4 h-4 flex-shrink-0' />
            {error}
          </div>
        )}

        {/* Acciones */}
        <div className='flex items-center justify-between'>
          <a
            href='/logistica'
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
            {guardando ? 'Guardando…' : 'Crear remito'}
          </button>
        </div>
      </div>
    </div>
  );
}
