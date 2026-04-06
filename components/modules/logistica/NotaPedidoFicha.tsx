'use client';

// ============================================================
// components/modules/logistica/NotaPedidoFicha.tsx
// Ficha de nota de pedido: detalle de ítems con recepción
// por línea, historial de estado, acciones de cierre.
// ============================================================

import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { CheckCircle2, Settings } from 'lucide-react';
import type { NotaPedidoCompleta, NotaPedidoItem } from '@/types';
import {
  obtenerNotaPedido,
  cambiarEstadoNotaPedido,
  actualizarRecepcionItem,
} from '@/app/actions/logistica';
import {
  getMockNotaPedidoDetalle,
  shouldUsePlatformMocks,
} from '@/app/actions/platform-mocks';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type EstadoNP = 'PENDIENTE' | 'PARCIAL' | 'RECIBIDO' | 'ANULADO';
type FullNP = NotaPedidoCompleta & { nombre_orden: string | null };

interface Props {
  notaId: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<EstadoNP, { label: string; badge: string; text: string; dot: string }> = {
  PENDIENTE: { label: 'Pendiente', badge: 'text-amber-500 bg-amber-500/[0.08] border-amber-500/20',   text: 'text-amber-500',   dot: 'bg-amber-500'   },
  PARCIAL:   { label: 'Parcial',   badge: 'text-violet-400 bg-violet-400/[0.08] border-violet-400/20', text: 'text-violet-400',  dot: 'bg-violet-400'  },
  RECIBIDO:  { label: 'Recibido',  badge: 'text-green-400 bg-green-400/[0.08] border-green-400/20',   text: 'text-green-400',   dot: 'bg-green-400'   },
  ANULADO:   { label: 'Anulado',   badge: 'text-red-400 bg-red-400/[0.08] border-red-400/20',         text: 'text-red-400',     dot: 'bg-red-400'     },
};

const TRANSICIONES: Record<EstadoNP, EstadoNP[]> = {
  PENDIENTE: ['PARCIAL', 'RECIBIDO', 'ANULADO'],
  PARCIAL: ['RECIBIDO', 'ANULADO'],
  RECIBIDO: [],
  ANULADO: [],
};

// ─── Estilos ──────────────────────────────────────────────────────────────────

const cardClass = 'bg-slate-900/70 border border-slate-400/10 rounded-xl backdrop-blur-sm';
const labelClass = 'text-xs font-semibold tracking-widest uppercase text-slate-600';

const fmtFecha = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—';

// ─── Item row con recepción inline ────────────────────────────────────────────

function ItemRecepcion({
  item,
  notaId,
  canEdit,
  onUpdate,
  showToast,
}: {
  item: NotaPedidoItem;
  notaId: string;
  canEdit: boolean;
  onUpdate: () => void;
  showToast: (m: string, t: 'ok' | 'error') => void;
}) {
  const [cantidad, setCantidad] = useState(String(item.cantidad_recibida));
  const [saving, setSaving] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setCantidad(String(item.cantidad_recibida));
  }, [item.cantidad_recibida]);

  const handleChange = (v: string) => {
    setCantidad(v);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const num = parseFloat(v);
      if (isNaN(num) || num < 0) return;
      const capped = Math.min(num, item.cantidad_pedida);
      setSaving(true);
      const res = await actualizarRecepcionItem(item.id, notaId, capped);
      setSaving(false);
      if (res.error) showToast(res.error, 'error');
      else onUpdate();
    }, 600);
  };

  const pct =
    item.cantidad_pedida > 0
      ? Math.min(100, (item.cantidad_recibida / item.cantidad_pedida) * 100)
      : 0;
  const completo = item.cantidad_recibida >= item.cantidad_pedida;

  return (
    <div className='grid grid-cols-[1fr_100px_100px_140px_32px] gap-3 px-4 py-3 items-center border-b border-slate-400/[0.05]'>
      {/* Descripción */}
      <div>
        <div className='text-[13px] text-slate-400'>
          {item.descripcion}
        </div>
        {item.notas && (
          <div className='text-xs text-slate-600 mt-0.5'>
            {item.notas}
          </div>
        )}
      </div>

      {/* Pedido */}
      <div className='text-center'>
        <div className='text-[13px] font-semibold text-slate-500'>
          {item.cantidad_pedida}
        </div>
        <div className='text-[9px] text-slate-700 mt-px'>
          {item.unidad_medida}
        </div>
      </div>

      {/* Recibido — editable */}
      <div className='text-center'>
        {canEdit ? (
          <div className='relative'>
            <input
              type='number'
              value={cantidad}
              onChange={(e) => handleChange(e.target.value)}
              min={0}
              max={item.cantidad_pedida}
              step='0.01'
              className={`w-20 px-2 py-1 bg-slate-950/60 rounded-md text-slate-200 text-xs outline-none text-center border focus:border-blue-400/[0.35] ${completo ? 'border-emerald-400/30' : 'border-slate-400/10'}`}
            />
            {saving && (
              <div className='absolute right-[-16px] top-1/2 -translate-y-1/2'>
                <svg
                  width='10'
                  height='10'
                  viewBox='0 0 10 10'
                  className='animate-spin text-blue-400'
                >
                  <circle
                    cx='5'
                    cy='5'
                    r='3.5'
                    stroke='currentColor'
                    strokeWidth='1.2'
                    fill='none'
                    strokeDasharray='11'
                    strokeDashoffset='4'
                  />
                </svg>
              </div>
            )}
          </div>
        ) : (
          <span className={`text-[13px] font-semibold ${completo ? 'text-emerald-400' : 'text-slate-500'}`}>
            {item.cantidad_recibida}
          </span>
        )}
        <div className='text-[9px] text-slate-700 mt-px'>
          {item.unidad_medida}
        </div>
      </div>

      {/* Barra de progreso */}
      <div>
        <div className='h-1.5 bg-slate-400/[0.08] rounded overflow-hidden mb-1'>
          <div
            className={`h-full rounded-[3px] transition-all duration-300 w-[var(--bar-w)] ${completo ? 'bg-green-400' : pct > 0 ? 'bg-violet-400' : 'bg-transparent'}`}
            style={{ '--bar-w': `${pct}%` } as React.CSSProperties}
          />
        </div>
        <div
          className={`text-[9px] text-right ${completo ? 'text-emerald-400' : 'text-slate-600'}`}
        >
          {Math.round(pct)}%
        </div>
      </div>

      {/* Estado ítem */}
      <div className='flex items-center justify-center'>
        {completo ? (
          <CheckCircle2 className='w-3 h-3 text-green-400' aria-label='Completo' />
        ) : item.cantidad_recibida > 0 ? (
          <span className='text-sm' title='Parcial'>
            🔶
          </span>
        ) : (
          <span className='text-sm' title='Pendiente'>
            ⏳
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function NotaPedidoFicha({ notaId }: Props) {
  const [nota, setNota] = useState<FullNP | null>(null);
  const [loading, setLoading] = useState(true);
  const [accionLoad, setAccionLoad] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    tipo: 'ok' | 'error';
  } | null>(null);
  const [menuEstado, setMenuEstado] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg: string, tipo: 'ok' | 'error') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const cargar = useCallback(async () => {
    if (shouldUsePlatformMocks) {
      setNota(getMockNotaPedidoDetalle(notaId) as FullNP | null);
      setLoading(false);
      return;
    }
    const res = await obtenerNotaPedido(notaId);
    setLoading(false);
    if (res.data) setNota(res.data as FullNP);
  }, [notaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuEstado(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleCambiarEstado = async (estado: EstadoNP) => {
    if (!nota) return;
    setAccionLoad(true);
    setMenuEstado(false);
    const res = await cambiarEstadoNotaPedido(nota.id, estado);
    setAccionLoad(false);
    if (res.error) showToast(res.error, 'error');
    else {
      showToast(res.mensaje ?? 'Estado actualizado', 'ok');
      cargar();
    }
  };

  const n = nota;
  const canEdit = n && !['RECIBIDO', 'ANULADO'].includes(n.estado);
  const totalItems = n?.items.length ?? 0;
  const itemsCompletos =
    n?.items.filter((i) => i.cantidad_recibida >= i.cantidad_pedida).length ??
    0;
  const pctGeneral =
    totalItems > 0 ? Math.round((itemsCompletos / totalItems) * 100) : 0;
  const posibles = n ? TRANSICIONES[n.estado as EstadoNP] : [];

  return (
    <>
      <div className='px-3 py-3 pb-10 sm:px-5 sm:py-4 sm:pb-12 lg:px-4 lg:py-2 lg:pb-3'>
        <div className='w-full min-w-0'>
          {/* Breadcrumb */}
          <div className='mb-3 flex items-center gap-2 lg:mb-2'>
            <a
              href='/logistica'
              className='text-xs text-slate-700 no-underline tracking-widest uppercase'
            >
              Logística
            </a>
            <span className='text-slate-800'>›</span>
            <span className='text-xs text-slate-600 tracking-widest uppercase'>
              Notas de pedido
            </span>
            <span className='text-slate-800'>›</span>
            <span className='text-xs text-slate-500 tracking-widest uppercase'>
              {loading ? '...' : n?.numero}
            </span>
          </div>

          {/* Header */}
          <div className={`${cardClass} p-4 mb-3`}>
            {loading ? (
              <div className='flex flex-col gap-2.5'>
                <div className='h-3 rounded bg-slate-400/[0.07] w-[120px] animate-pulse' />
                <div className='h-[22px] rounded bg-slate-400/[0.07] w-[280px] animate-pulse' />
              </div>
            ) : n ? (
              <div className='flex items-start justify-between gap-4 flex-wrap'>
                <div>
                  <div className='flex items-center gap-2.5 mb-2 flex-wrap'>
                    <span className='text-[15px] font-bold text-blue-400'>
                      {n.numero}
                    </span>
                    {/* Badge estado */}
                    {(() => {
                      const cfg = ESTADO_CFG[n.estado as EstadoNP];
                      return (
                        <span
                          className={`inline-flex items-center gap-[5px] px-[11px] py-[3px] rounded-full text-[11px] font-semibold border ${cfg.badge}`}
                        >
                          <span
                            className='inline-block w-[5px] h-[5px] rounded-full bg-current'
                          />
                          {cfg.label}
                        </span>
                      );
                    })()}
                    {n.nombre_orden && (
                      <a
                        href={`/ordenes/${n.orden_id}`}
                        className='inline-flex items-center gap-1 text-xs text-blue-400 no-underline bg-blue-400/[0.06] border border-blue-400/[0.15] rounded px-1.5 py-px'
                      >
                        <Settings className='w-3 h-3' /> {n.nombre_orden}
                      </a>
                    )}
                  </div>

                  <div className='text-[15px] font-semibold text-slate-400 mb-1'>
                    {n.proveedor ?? 'Sin proveedor asignado'}
                  </div>

                  {/* Barra de recepción general */}
                  <div className='flex items-center gap-2.5 mt-2.5'>
                    <div className='w-[180px] h-1.5 bg-slate-400/[0.08] rounded overflow-hidden'>
                      <div
                        className={`h-full rounded-[3px] transition-all duration-500 w-[var(--bar-w)] ${pctGeneral === 100 ? 'bg-green-400' : 'bg-violet-400'}`}
                        style={{ '--bar-w': `${pctGeneral}%` } as React.CSSProperties}
                      />
                    </div>
                    <span className='text-xs text-slate-600'>
                      {itemsCompletos}/{totalItems} ítems recibidos
                    </span>
                  </div>
                </div>

                {/* Acciones */}
                <div className='flex gap-2 shrink-0'>
                  {posibles.length > 0 && (
                    <div ref={menuRef} className='relative'>
                      <button
                        onClick={() => setMenuEstado((p) => !p)}
                        disabled={accionLoad}
                        className='inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-blue-400/30 bg-blue-400/[0.06] text-blue-400 text-xs font-semibold cursor-pointer'
                      >
                        Cambiar estado
                        <svg
                          width='8'
                          height='8'
                          viewBox='0 0 8 8'
                          fill='none'
                          className={`transition-transform duration-150 ${menuEstado ? 'rotate-180' : ''}`}
                        >
                          <path
                            d='M1 3L4 6L7 3'
                            stroke='currentColor'
                            strokeWidth='1.2'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                          />
                        </svg>
                      </button>
                      {menuEstado && (
                        <div className='absolute right-0 top-[calc(100%+4px)] z-30 bg-slate-900 border border-slate-400/[0.12] rounded-[9px] p-1 min-w-[170px] shadow-[0_8px_24px_rgba(0,0,0,0.5)] animate-modal-in'>
                          {posibles.map((e) => {
                            const cfg = ESTADO_CFG[e];
                            return (
                              <button
                                key={e}
                                onClick={() => handleCambiarEstado(e)}
                                className='flex items-center gap-2 px-[11px] py-2 rounded-md w-full border-none bg-transparent cursor-pointer text-xs text-slate-400 transition-colors duration-100 hover:bg-slate-400/[0.06] hover:text-slate-200'
                              >
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                                {cfg.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className='text-slate-600'>
                Nota de pedido no encontrada
              </div>
            )}
          </div>

          {n && (
            <div className='grid grid-cols-[1fr_270px] gap-4 items-start'>
              {/* Ítems con recepción */}
              <div className={`${cardClass} overflow-hidden`}>
                {/* Header tabla */}
                <div className='grid grid-cols-[1fr_100px_100px_140px_32px] gap-3 px-4 py-2.5 bg-slate-950/40 border-b border-slate-400/[0.07]'>
                  {['Descripción', 'Pedido', 'Recibido', 'Avance', ''].map(
                    (h, i) => (
                      <span
                        key={i}
                        className={`${labelClass} ${i > 0 ? 'text-center' : 'text-left'}`}
                      >
                        {h}
                      </span>
                    ),
                  )}
                </div>
                {n.items.length === 0 ? (
                  <div className='p-8 text-center text-slate-700 text-[13px]'>
                    Sin ítems
                  </div>
                ) : (
                  n.items.map((item) => (
                    <ItemRecepcion
                      key={item.id}
                      item={item}
                      notaId={n.id}
                      canEdit={!!canEdit}
                      onUpdate={cargar}
                      showToast={showToast}
                    />
                  ))
                )}
              </div>

              {/* Panel lateral */}
              <div className='flex flex-col gap-3'>
                {/* Datos del documento */}
                <div className={`${cardClass} p-[18px]`}>
                  <div className='text-xs font-bold tracking-widest uppercase text-slate-700 mb-3'>
                    Datos
                  </div>
                  {[
                    { label: 'Número', value: n.numero, mono: true },
                    { label: 'Proveedor', value: n.proveedor ?? '—' },
                    {
                      label: 'Fecha pedido',
                      value: fmtFecha(n.fecha_pedido),
                      mono: true,
                    },
                    {
                      label: 'Fecha requerida',
                      value: fmtFecha(n.fecha_requerida),
                      mono: true,
                    },
                    {
                      label: 'Fecha recepción',
                      value: fmtFecha(n.fecha_recepcion),
                      mono: true,
                    },
                    ...(n.orden_id
                      ? [
                          {
                            label: 'OS vinculada',
                            value: n.nombre_orden ?? '—',
                            mono: true,
                          },
                        ]
                      : []),
                  ].map(({ label, value, mono }) => (
                    <div
                      key={label}
                      className='flex justify-between items-start gap-2 pb-[7px] border-b border-slate-400/[0.05]'
                    >
                      <span className='text-xs text-slate-700 shrink-0'>
                        {label}
                      </span>
                      <span
                        className={`text-xs text-slate-500 text-right${mono ? ' font-mono' : ''}`}
                      >
                        {value || '—'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Resumen recepción */}
                <div className={`${cardClass} p-[18px]`}>
                  <div className='text-xs font-bold tracking-widest uppercase text-slate-700 mb-3'>
                    Recepción
                  </div>
                  <div className='flex flex-col gap-2'>
                    {[
                      { label: 'Total ítems',       value: String(totalItems),                    textCls: 'text-slate-500'  },
                      { label: 'Recibidos compl.',  value: String(itemsCompletos),                textCls: itemsCompletos === totalItems ? 'text-green-400' : 'text-slate-500' },
                      { label: 'Pendientes',        value: String(totalItems - itemsCompletos),   textCls: totalItems - itemsCompletos > 0 ? 'text-amber-500' : 'text-slate-800' },
                    ].map(({ label, value, textCls }) => (
                      <div key={label} className='flex justify-between'>
                        <span className='text-xs text-slate-600'>{label}</span>
                        <span className={`text-[13px] font-bold font-mono ${textCls}`}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notas */}
                {n.notas && (
                  <div className={`${cardClass} p-4`}>
                    <div className='text-xs font-bold tracking-widest uppercase text-slate-700 mb-2'>
                      Notas
                    </div>
                    <p className='m-0 text-xs text-slate-500 leading-[1.7] whitespace-pre-wrap'>
                      {n.notas}
                    </p>
                  </div>
                )}

                {/* Accesos rápidos */}
                {n.orden_id && (
                  <div className={`${cardClass} p-3.5`}>
                    <div className='text-xs font-bold tracking-widest uppercase text-slate-700 mb-2'>
                      Accesos
                    </div>
                    <a
                      href={`/ordenes/${n.orden_id}`}
                      className='flex items-center gap-[7px] px-2.5 py-2 rounded-[7px] no-underline text-xs text-slate-500 border border-slate-400/[0.07] bg-slate-950/30 transition-all duration-[120ms] hover:bg-slate-400/[0.05] hover:text-slate-400'
                    >
                      <Settings className='w-4 h-4' /> Ver orden de servicio
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[200] flex items-center gap-2.5 px-[18px] py-3 rounded-[10px] bg-slate-900/[0.97] backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-modal-in ${toast.tipo === 'ok' ? 'border border-emerald-400/30' : 'border border-red-400/30'}`}
        >
          <span
            className={`font-semibold text-[13px] ${toast.tipo === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {toast.tipo === 'ok' ? '✓' : '✕'}
          </span>
          <span
            className={`text-[13px] ${toast.tipo === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {toast.msg}
          </span>
        </div>
      )}
    </>
  );
}
