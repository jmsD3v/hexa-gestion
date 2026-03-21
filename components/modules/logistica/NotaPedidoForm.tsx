'use client';

// ============================================================
// /components/modules/logistica/NotaPedidoForm.tsx
// Formulario de creación de Nota de Pedido
// ============================================================

import { useState, useCallback } from 'react';
import {
  Plus,
  Trash2,
  ClipboardList,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Link2,
  Package,
} from 'lucide-react';
import { crearNotaPedido } from '@/app/actions/logistica';
import type { CrearNotaPedidoDTO } from '@/types';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ItemLocal {
  _key: string;
  descripcion: string;
  unidad_medida: string;
  cantidad_pedida: number;
  precio_unitario: string;
  notas: string;
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

function crearItem(): ItemLocal {
  return {
    _key: crypto.randomUUID(),
    descripcion: '',
    unidad_medida: 'un',
    cantidad_pedida: 1,
    precio_unitario: '',
    notas: '',
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
  const [expandido, setExpandido] = useState(false);

  return (
    <div className='border border-slate-700 rounded-xl overflow-hidden'>
      <div className='grid grid-cols-12 gap-2 items-center px-3 py-2 bg-slate-800'>
        {/* Nro */}
        <div className='col-span-1 text-center text-xs text-slate-400 font-mono font-semibold select-none'>
          {idx + 1}
        </div>

        {/* Descripción */}
        <div className='col-span-5'>
          <input
            type='text'
            value={item.descripcion}
            onChange={(e) => onChange(item._key, 'descripcion', e.target.value)}
            placeholder='Descripción del ítem…'
            className='w-full text-sm px-3 py-1.5 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </div>

        {/* Unidad */}
        <div className='col-span-2'>
          <select
            value={item.unidad_medida}
            onChange={(e) =>
              onChange(item._key, 'unidad_medida', e.target.value)
            }
            className='w-full text-sm px-2 py-1.5 border border-slate-600 bg-slate-700 text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            {UNIDADES.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>

        {/* Cantidad */}
        <div className='col-span-2'>
          <input
            type='number'
            min={0.01}
            step='any'
            value={item.cantidad_pedida}
            onChange={(e) =>
              onChange(
                item._key,
                'cantidad_pedida',
                parseFloat(e.target.value) || 0,
              )
            }
            className='w-full text-sm px-3 py-1.5 border border-slate-600 bg-slate-700 text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right'
          />
        </div>

        {/* Precio (opcional) */}
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
            className='w-full text-sm px-2 py-1.5 border border-slate-600 bg-slate-700 text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right'
          />
        </div>

        {/* Acciones */}
        <div className='col-span-1 flex items-center justify-end gap-1'>
          <button
            type='button'
            onClick={() => setExpandido(!expandido)}
            className='p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors'
          >
            {expandido ? (
              <ChevronUp className='w-3.5 h-3.5' />
            ) : (
              <ChevronDown className='w-3.5 h-3.5' />
            )}
          </button>
          {canRemove && (
            <button
              type='button'
              onClick={() => onRemove(item._key)}
              className='p-1.5 rounded-lg hover:bg-red-900/40 text-slate-300 hover:text-red-400 transition-colors'
            >
              <Trash2 className='w-3.5 h-3.5' />
            </button>
          )}
        </div>
      </div>

      {/* Notas expandibles */}
      {expandido && (
        <div className='px-3 pb-3 pt-1 bg-slate-700 border-t border-slate-600'>
          <label className='text-xs font-medium text-slate-500 mb-1 block'>
            Notas / especificaciones
          </label>
          <textarea
            value={item.notas}
            rows={2}
            onChange={(e) => onChange(item._key, 'notas', e.target.value)}
            placeholder='Marca preferida, especificaciones técnicas, notas de recepción…'
            className='w-full text-sm px-3 py-2 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'
          />
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// FORMULARIO PRINCIPAL
// ════════════════════════════════════════════════════════════

interface Props {
  ordenId?: string;
  presupuestoId?: string;
  clienteId?: string;
  onSuccess?: (id: string) => void;
}

export default function NotaPedidoForm({
  ordenId,
  presupuestoId,
  clienteId,
  onSuccess,
}: Props) {
  const [proveedor, setProveedor] = useState('');
  const [fechaRequerida, setFechaRequerida] = useState('');
  const [notas, setNotas] = useState('');
  const [ordenIdLocal, setOrdenIdLocal] = useState(ordenId ?? '');
  const [items, setItems] = useState<ItemLocal[]>([crearItem()]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Handlers items ──────────────────────────────────────────

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

  // ── Submit ──────────────────────────────────────────────────

  const handleSubmit = async () => {
    setError(null);

    // Validación básica
    const itemsInvalidos = items.filter(
      (it) => !it.descripcion.trim() || it.cantidad_pedida <= 0,
    );
    if (itemsInvalidos.length) {
      setError('Completá la descripción y cantidad de todos los ítems');
      return;
    }

    setGuardando(true);

    const dto: CrearNotaPedidoDTO = {
      ...(ordenIdLocal ? { orden_id: ordenIdLocal } : {}),
      ...(presupuestoId ? { presupuesto_id: presupuestoId } : {}),
      ...(clienteId ? { cliente_id: clienteId } : {}),
      ...(proveedor.trim() ? { proveedor: proveedor.trim() } : {}),
      ...(fechaRequerida ? { fecha_requerida: fechaRequerida } : {}),
      ...(notas.trim() ? { notas: notas.trim() } : {}),
      items: items.map((it) => ({
        descripcion: it.descripcion.trim(),
        unidad_medida: it.unidad_medida,
        cantidad_pedida: it.cantidad_pedida,
        precio_unitario: it.precio_unitario
          ? parseFloat(it.precio_unitario)
          : undefined,
        notas: it.notas.trim() || undefined,
      })),
    };

    const r = await crearNotaPedido(dto);
    setGuardando(false);

    if (r.error) {
      setError(r.error);
      return;
    }
    if (onSuccess && r.data) {
      onSuccess(r.data.id);
    } else window.location.href = '/logistica';
  };

  return (
    <div className='min-h-screen bg-slate-900'>
      {/* Header */}
      <div className='bg-slate-800 border-b border-slate-700 px-6 py-5'>
        <div className='max-w-4xl mx-auto flex items-center gap-3'>
          <div className='w-9 h-9 rounded-xl bg-blue-900/40 flex items-center justify-center'>
            <Package className='w-5 h-5 text-blue-400' />
          </div>
          <div>
            <h1 className='text-lg font-bold text-slate-100'>
              Nueva nota de pedido
            </h1>
            <p className='text-xs text-slate-400'>
              Registrá el pedido de materiales para el cliente
            </p>
          </div>
        </div>
      </div>

      <div className='max-w-4xl mx-auto px-6 py-8 space-y-6'>
        {/* Datos generales */}
        <div className='bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-5'>
          <h2 className='text-sm font-semibold text-slate-100'>
            Datos del pedido
          </h2>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {/* Proveedor */}
            <div>
              <label className='block text-xs font-medium text-slate-300 mb-1.5'>
                Proveedor
              </label>
              <input
                type='text'
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                placeholder='Nombre del proveedor…'
                className='w-full text-sm px-3 py-2 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>

            {/* Fecha requerida */}
            <div>
              <label className='block text-xs font-medium text-slate-300 mb-1.5'>
                Fecha requerida
              </label>
              <input
                type='date'
                value={fechaRequerida}
                onChange={(e) => setFechaRequerida(e.target.value)}
                className='w-full text-sm px-3 py-2 border border-slate-600 bg-slate-700 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>

            {/* OS vinculada */}
            <div>
              <label className='block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1'>
                <Link2 className='w-3.5 h-3.5' /> OS vinculada (opcional)
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
          </div>

          {/* Notas generales */}
          <div>
            <label className='block text-xs font-medium text-slate-300 mb-1.5'>
              Notas internas
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder='Instrucciones de entrega, condiciones especiales…'
              className='w-full text-sm px-3 py-2 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'
            />
          </div>
        </div>

        {/* Ítems */}
        <div className='bg-slate-800 rounded-2xl border border-slate-700 p-6'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='text-sm font-semibold text-slate-100'>
              Ítems del pedido
            </h2>
            <span className='text-xs text-slate-500'>
              {items.length} ítem{items.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Encabezados */}
          <div className='grid grid-cols-12 gap-2 px-3 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider'>
            <div className='col-span-1 text-center'>#</div>
            <div className='col-span-5'>Descripción</div>
            <div className='col-span-2'>Unidad</div>
            <div className='col-span-2 text-right'>Cant.</div>
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
            className='mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-700 hover:border-blue-400/50 hover:bg-blue-900/20 text-slate-400 hover:text-blue-400 text-sm font-medium rounded-xl transition-all'
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
            {guardando ? 'Guardando…' : 'Crear nota de pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}
