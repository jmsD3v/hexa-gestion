'use client';

// ============================================================
// components/modules/presupuestos/PresupuestoFicha.tsx
// Vista detalle de presupuesto: ítems, incidencias, desglose
// económico, OS vinculada, acciones de estado y PDF.
// ============================================================

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  ArrowLeft,
  PenLine,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  ClipboardList,
  BarChart3,
  FileText,
  Settings,
  AlertTriangle,
  Briefcase,
  Loader2,
} from 'lucide-react';
import { descargarPDF } from '@/lib/pdf-client';
import type {
  PresupuestoCompleto,
  PresupuestoItem,
  PresupuestoIncidencia,
  TipoIncidencia,
  EstadoPresupuesto,
  TipoOperacion,
} from '@/types';
import {
  obtenerPresupuestoCompleto,
  cambiarEstadoPresupuesto,
  aprobarPresupuesto,
  duplicarPresupuesto,
} from '@/app/actions/presupuestos';
import {
  getMockPresupuestoDetalle,
  shouldUsePlatformMocks,
} from '@/app/actions/platform-mocks';
import { formatearMonto } from '@/lib/calculos';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  presupuestoId: string;
}

type PCompleto = PresupuestoCompleto & { razon_social?: string };

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<
  EstadoPresupuesto,
  { label: string; badge: string; icon: ReactNode }
> = {
  BORRADOR: {
    label: 'Borrador',
    badge: 'text-slate-400 bg-slate-400/[0.08] border-slate-400/15',
    icon: <PenLine className='w-3 h-3' />,
  },
  ENVIADO: {
    label: 'Enviado',
    badge: 'text-blue-400 bg-blue-400/[0.08] border-blue-400/20',
    icon: <Send className='w-3 h-3' />,
  },
  APROBADO: {
    label: 'Aprobado',
    badge: 'text-green-400 bg-green-400/[0.08] border-green-400/20',
    icon: <CheckCircle2 className='w-3 h-3' />,
  },
  RECHAZADO: {
    label: 'Rechazado',
    badge: 'text-red-400 bg-red-400/[0.08] border-red-400/20',
    icon: <XCircle className='w-3 h-3' />,
  },
  VENCIDO: {
    label: 'Vencido',
    badge: 'text-amber-500 bg-amber-500/[0.08] border-amber-500/20',
    icon: <Clock className='w-3 h-3' />,
  },
};

const TIPO_LABEL: Record<TipoOperacion, string> = {
  SERVICIO: 'Servicio',
  PRODUCTO: 'Producto',
  PRODUCTO_SERVICIO: 'Producto + Servicio',
};

const INCIDENCIA_CFG: Record<
  TipoIncidencia,
  { label: string; icon: ReactNode; textCls: string; badgeCls: string }
> = {
  traslado: {
    label: 'Traslado',
    icon: '🚗',
    textCls: 'text-blue-400',
    badgeCls: 'bg-blue-400/[0.06] border-blue-400/[0.12]',
  },
  viatico: {
    label: 'Viático',
    icon: <Briefcase className='w-3.5 h-3.5' />,
    textCls: 'text-amber-500',
    badgeCls: 'bg-amber-500/[0.06] border-amber-500/[0.12]',
  },
  hospedaje: {
    label: 'Hospedaje',
    icon: '🏨',
    textCls: 'text-violet-400',
    badgeCls: 'bg-violet-400/[0.06] border-violet-400/[0.12]',
  },
  combustible: {
    label: 'Combustible',
    icon: '⛽',
    textCls: 'text-orange-500',
    badgeCls: 'bg-orange-500/[0.06] border-orange-500/[0.12]',
  },
  vianda: {
    label: 'Vianda',
    icon: '🍱',
    textCls: 'text-emerald-400',
    badgeCls: 'bg-emerald-400/[0.06] border-emerald-400/[0.12]',
  },
  equipamiento: {
    label: 'Equipamiento',
    icon: '🛠',
    textCls: 'text-slate-400',
    badgeCls: 'bg-slate-400/[0.06] border-slate-400/[0.12]',
  },
  sanidad: {
    label: 'Sanidad / Seguros',
    icon: '🏥',
    textCls: 'text-red-400',
    badgeCls: 'bg-red-400/[0.06] border-red-400/[0.12]',
  },
  honorario_externo: {
    label: 'Honorario Externo',
    icon: <User className='w-3.5 h-3.5' />,
    textCls: 'text-fuchsia-400',
    badgeCls: 'bg-fuchsia-400/[0.06] border-fuchsia-400/[0.12]',
  },
  pago_tercero: {
    label: 'Pago a Tercero',
    icon: '💸',
    textCls: 'text-yellow-400',
    badgeCls: 'bg-yellow-400/[0.06] border-yellow-400/[0.12]',
  },
  otro: {
    label: 'Otro',
    icon: '📎',
    textCls: 'text-slate-500',
    badgeCls: 'bg-slate-500/[0.06] border-slate-500/[0.12]',
  },
};

// ─── Estilos ──────────────────────────────────────────────────────────────────

const cardClass =
  'bg-slate-900/70 border border-slate-400/10 rounded-xl backdrop-blur-sm';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtFecha = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—';

const isVencido = (p: PCompleto) =>
  p.estado === 'ENVIADO' &&
  p.fecha_vencimiento &&
  new Date(p.fecha_vencimiento) < new Date();

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function Skeleton({
  w = 'w-full',
  h = 'h-[14px]',
  r = 'rounded',
}: {
  w?: string;
  h?: string;
  r?: string;
}) {
  return (
    <div
      className={`animate-pulse bg-slate-400/[0.07] ${w} ${h} ${r}`}
    />
  );
}

function BadgeEstado({ estado }: { estado: EstadoPresupuesto }) {
  const cfg = ESTADO_CFG[estado];
  return (
    <span
      className={`inline-flex items-center gap-[5px] text-xs font-semibold rounded-full px-[11px] py-[3px] border ${cfg.badge}`}
    >
      <span className='inline-block rounded-full w-[5px] h-[5px] bg-current' />
      {cfg.label}
    </span>
  );
}

function InfoPar({
  label,
  value,
  mono = false,
  children,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className='flex flex-col gap-[3px]'>
      <span className='text-xs font-semibold tracking-widest uppercase text-slate-700'>
        {label}
      </span>
      {children ?? (
        <span className='text-[13px] text-slate-400'>{value || '—'}</span>
      )}
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  count,
}: {
  icon: ReactNode;
  title: string;
  count?: number;
}) {
  return (
    <div className='flex items-center gap-2 mb-4'>
      <span className='flex items-center text-slate-600'>{icon}</span>
      <span className='text-xs font-bold tracking-widest uppercase text-slate-600'>
        {title}
      </span>
      {count !== undefined && count > 0 && (
        <span className='text-[9px] font-bold text-slate-600 bg-slate-400/[0.08] border border-slate-400/[0.12] rounded-[10px] px-1.5 py-px'>
          {count}
        </span>
      )}
    </div>
  );
}

function Divider() {
  return (
    <div className='h-px bg-gradient-to-r from-transparent via-slate-400/[0.08] to-transparent my-0.5' />
  );
}

function Toast({
  mensaje,
  tipo,
  onClose,
}: {
  mensaje: string;
  tipo: 'ok' | 'error';
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      className={`fixed bottom-6 right-6 z-[200] flex items-center gap-2.5 px-[18px] py-3 rounded-[10px] bg-slate-900/[0.97] backdrop-blur-sm shadow-xl animate-modal-in ${
        tipo === 'ok'
          ? 'border border-emerald-400/30'
          : 'border border-red-400/30'
      }`}
    >
      <span
        className={`text-[13px] font-semibold ${tipo === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
      >
        {tipo === 'ok' ? '✓' : '✕'}
      </span>
      <span
        className={`text-[13px] ${tipo === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
      >
        {mensaje}
      </span>
    </div>
  );
}

// ─── Tabla de ítems ───────────────────────────────────────────────────────────

function TablaItems({ items }: { items: PresupuestoItem[] }) {
  const [expandido, setExpandido] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className='p-6 text-center rounded-lg border border-dashed border-slate-400/10'>
        <p className='m-0 text-xs text-slate-700'>Sin ítems</p>
      </div>
    );
  }

  return (
    <div className='rounded-[10px] overflow-hidden border border-slate-400/[0.08]'>
      {/* Encabezado */}
      <div className='grid grid-cols-[32px_1fr_70px_80px_90px_70px_100px] gap-2 px-3.5 py-[9px] bg-slate-950/40 border-b border-slate-400/[0.07]'>
        {[
          '#',
          'Descripción',
          'Cant.',
          'Unidad',
          'P. Unit.',
          'Desc.',
          'Subtotal',
        ].map((h, i) => (
          <span
            key={h}
            className={`text-xs font-bold tracking-wide uppercase text-slate-700 ${i >= 4 ? 'text-right' : 'text-left'}`}
          >
            {h}
          </span>
        ))}
      </div>

      {items
        .sort((a, b) => a.orden - b.orden)
        .map((item, idx) => (
          <div
            key={item.id}
            className={
              idx < items.length - 1 ? 'border-b border-slate-400/[0.05]' : ''
            }
          >
            {/* Fila principal */}
            <div
              onClick={() =>
                item.detalle
                  ? setExpandido(expandido === item.id ? null : item.id)
                  : undefined
              }
              className={`grid grid-cols-[32px_1fr_70px_80px_90px_70px_100px] gap-2 px-3.5 py-[11px] items-center transition-colors duration-150 hover:bg-slate-400/[0.02] ${item.detalle ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {/* Número */}
              <div className='w-[22px] h-[22px] rounded flex items-center justify-center text-xs font-bold text-amber-500 bg-amber-500/[0.07] border border-amber-500/[0.12]'>
                {idx + 1}
              </div>

              {/* Descripción */}
              <div className='flex items-center gap-[7px] min-w-0'>
                <span className='text-[13px] text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap'>
                  {item.descripcion}
                </span>
                {item.detalle && (
                  <svg
                    width='10'
                    height='10'
                    viewBox='0 0 10 10'
                    fill='none'
                    className={`shrink-0 text-slate-700 transition-transform duration-150 ${expandido === item.id ? 'rotate-180' : ''}`}
                  >
                    <path
                      d='M2 4L5 7L8 4'
                      stroke='currentColor'
                      strokeWidth='1.3'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                    />
                  </svg>
                )}
              </div>

              {/* Cantidad */}
              <span className='text-xs text-slate-500 text-right'>
                {item.cantidad}
              </span>

              {/* Unidad */}
              <span className='text-xs text-slate-600 text-right'>
                {item.unidad_medida}
              </span>

              {/* Precio unitario */}
              <span className='text-xs text-slate-500 text-right'>
                {formatearMonto(item.precio_unitario)}
              </span>

              {/* Descuento */}
              <span
                className={`text-xs text-right ${item.descuento_pct > 0 ? 'text-amber-500' : 'text-slate-700'}`}
              >
                {item.descuento_pct > 0 ? `${item.descuento_pct}%` : '—'}
              </span>

              {/* Subtotal */}
              <span className='text-[13px] font-semibold text-slate-400 text-right'>
                {formatearMonto(item.subtotal)}
              </span>
            </div>

            {/* Detalle expandido */}
            {expandido === item.id && item.detalle && (
              <div className='pt-0 px-[14px] pb-3 pl-[52px] animate-fade-in'>
                <p className='m-0 text-xs text-slate-600 italic leading-[1.7] border-l-2 border-amber-500/20 pl-[10px]'>
                  {item.detalle}
                </p>
              </div>
            )}
          </div>
        ))}
    </div>
  );
}

// ─── Tabla de incidencias ─────────────────────────────────────────────────────

function TablaIncidencias({
  incidencias,
}: {
  incidencias: PresupuestoIncidencia[];
}) {
  const externas = incidencias.filter((i) => !i.es_interno);
  const internas = incidencias.filter((i) => i.es_interno);

  if (incidencias.length === 0) {
    return (
      <div className='p-6 text-center rounded-lg border border-dashed border-slate-400/10'>
        <p className='m-0 text-xs text-slate-700'>
          Sin incidencias registradas
        </p>
      </div>
    );
  }

  const FilaInc = ({
    inc,
    interna,
  }: {
    inc: PresupuestoIncidencia;
    interna: boolean;
  }) => {
    const cfg = INCIDENCIA_CFG[inc.tipo];
    return (
      <div className='grid grid-cols-[auto_1fr_60px_50px_60px_90px_100px] gap-2 px-3.5 py-2.5 items-center border-b border-slate-400/[0.04]'>
        {/* Badge tipo */}
        <div
          className={`flex items-center gap-[5px] px-2 py-0.5 rounded whitespace-nowrap border ${cfg.badgeCls}`}
        >
          <span className={`flex items-center ${cfg.textCls}`}>{cfg.icon}</span>
          <span
            className={`text-[9px] font-bold tracking-wide uppercase ${cfg.textCls}`}
          >
            {cfg.label}
          </span>
        </div>
        <span className='text-xs text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap'>
          {inc.descripcion}
        </span>
        <span className='text-xs text-slate-500 text-right'>
          {inc.cantidad}
        </span>
        <span className='text-xs text-slate-500 text-right'>
          {inc.dias > 1 ? `${inc.dias}d` : '—'}
        </span>
        <span className='text-xs text-slate-500 text-right'>
          {inc.distancia_km ? `${inc.distancia_km}km` : '—'}
        </span>
        <span className='text-xs text-slate-500 text-right'>
          {formatearMonto(inc.monto_unitario)}
        </span>
        <span
          className={`text-[13px] font-semibold text-right ${interna ? 'text-slate-600' : 'text-slate-400'}`}
        >
          {formatearMonto(inc.subtotal)}
        </span>
      </div>
    );
  };

  return (
    <div className='rounded-[10px] overflow-hidden border border-slate-400/[0.08]'>
      {/* Header */}
      <div className='grid grid-cols-[auto_1fr_60px_50px_60px_90px_100px] gap-2 px-3.5 py-[9px] bg-slate-950/40 border-b border-slate-400/[0.07]'>
        {[
          'Tipo',
          'Descripción',
          'Cant.',
          'Días',
          'Km',
          'Monto',
          'Subtotal',
        ].map((h, i) => (
          <span
            key={h}
            className={`text-xs font-bold tracking-wide uppercase text-slate-700 ${i >= 5 ? 'text-right' : 'text-left'}`}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Externas */}
      {externas.length > 0 && (
        <>
          <div className='px-3.5 pt-1.5 pb-1 bg-blue-400/[0.03]'>
            <span className='text-[9px] font-bold tracking-widest uppercase text-blue-400'>
              Visibles al cliente ({externas.length})
            </span>
          </div>
          {externas.map((inc) => (
            <FilaInc key={inc.id} inc={inc} interna={false} />
          ))}
        </>
      )}

      {/* Internas */}
      {internas.length > 0 && (
        <>
          <div
            className={`px-3.5 pt-1.5 pb-1 bg-slate-400/[0.02] ${externas.length > 0 ? 'border-t border-slate-400/[0.05]' : ''}`}
          >
            <span className='text-[9px] font-bold tracking-widest uppercase text-slate-700'>
              Solo costo interno ({internas.length})
            </span>
          </div>
          {internas.map((inc) => (
            <FilaInc key={inc.id} inc={inc} interna={true} />
          ))}
        </>
      )}
    </div>
  );
}

// ─── Panel de totales ─────────────────────────────────────────────────────────

function PanelTotales({ p }: { p: PCompleto }) {
  const margenCls = !p.margen_pct
    ? 'text-slate-700'
    : p.margen_pct >= 30
      ? 'text-green-400'
      : p.margen_pct >= 10
        ? 'text-amber-500'
        : 'text-red-400';
  const margenBgCls = !p.margen_pct
    ? 'bg-slate-700'
    : p.margen_pct >= 30
      ? 'bg-green-400'
      : p.margen_pct >= 10
        ? 'bg-amber-500'
        : 'bg-red-400';

  return (
    <div className={`${cardClass} p-5`}>
      <SectionTitle icon='🧮' title='Desglose económico' />

      <div className='flex flex-col gap-px'>
        {/* Ítems */}
        <Row label={`Ítems (${p.items.length})`} value={p.subtotal_items} />

        {/* Incidencias externas */}
        {p.incidencias.filter((i) => !i.es_interno).length > 0 && (
          <Row
            label={`Incidencias externas (${p.incidencias.filter((i) => !i.es_interno).length})`}
            value={p.incidencias
              .filter((i) => !i.es_interno)
              .reduce((a, i) => a + i.subtotal, 0)}
          />
        )}

        <Divider />

        {/* Descuento */}
        {p.descuento_pct > 0 && (
          <Row
            label={`Descuento (${p.descuento_pct}%)`}
            value={-p.descuento_monto}
            accent='amber'
          />
        )}

        {/* Subtotal */}
        <Row label='Subtotal sin IVA' value={p.subtotal} />

        {/* IVA */}
        <Row label={`IVA (${p.iva_pct}%)`} value={p.iva_monto} />

        <Divider />

        {/* TOTAL */}
        <div className='flex justify-between items-center py-3 pb-1'>
          <span className='text-[13px] font-bold text-slate-400'>TOTAL</span>
          <span
            className='text-[22px] font-extrabold text-amber-500 tracking-[-0.02em]'
          >
            {formatearMonto(p.total)}
          </span>
        </div>
      </div>

      {/* Análisis interno */}
      {p.costo_total !== null && p.costo_total > 0 && (
        <div className='mt-4 p-3.5 rounded-[9px] bg-slate-950/60 border border-slate-400/[0.07]'>
          <div className='text-xs font-semibold tracking-widest uppercase text-slate-700 mb-2.5'>
            Análisis interno
          </div>

          {/* Incidencias internas */}
          {p.incidencias.filter((i) => i.es_interno).length > 0 && (
            <div className='flex justify-between mb-1.5'>
              <span className='text-xs text-slate-700 flex items-center gap-[5px]'>
                Incidencias internas
                <span className='text-[9px] bg-slate-400/[0.07] border border-slate-400/[0.1] rounded px-1'>
                  costo
                </span>
              </span>
              <span className='text-xs text-slate-700'>
                {formatearMonto(
                  p.incidencias
                    .filter((i) => i.es_interno)
                    .reduce((a, i) => a + i.subtotal, 0),
                )}
              </span>
            </div>
          )}

          <div className='flex justify-between mb-1.5'>
            <span className='text-xs text-slate-600'>Costo estimado total</span>
            <span className='text-xs text-slate-600'>
              {formatearMonto(p.costo_total)}
            </span>
          </div>
          <div className='flex justify-between items-center mb-2'>
            <span className='text-xs text-slate-500'>Margen bruto</span>
            <span className={`text-xs font-bold ${margenCls}`}>
              {formatearMonto(p.margen_monto ?? 0)} (
              {(p.margen_pct ?? 0).toFixed(1)}%)
            </span>
          </div>

          {/* Barra de margen */}
          <div className='h-1 rounded overflow-hidden bg-slate-400/[0.08]'>
            <div
              className={`h-full rounded-sm transition-[width] duration-500 ${margenBgCls} w-[${Math.min(100, Math.max(0, p.margen_pct ?? 0))}%]`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'amber';
}) {
  return (
    <div className='flex justify-between items-center py-1.5'>
      <span className='text-xs text-slate-600'>{label}</span>
      <span
        className={`text-[13px] font-medium ${accent === 'amber' ? 'text-amber-500' : 'text-slate-500'}`}
      >
        {value < 0
          ? `−${formatearMonto(Math.abs(value))}`
          : formatearMonto(value)}
      </span>
    </div>
  );
}

// ─── Modal rechazo ────────────────────────────────────────────────────────────

function ModalAccion({
  titulo,
  descripcion,
  emoji,
  btnCls,
  labelBtn,
  onConfirmar,
  onCancelar,
  loading,
  conTexto = false,
}: {
  titulo: string;
  descripcion: string;
  emoji: ReactNode;
  btnCls: string;
  labelBtn: string;
  onConfirmar: (texto?: string) => void;
  onCancelar: () => void;
  loading: boolean;
  conTexto?: boolean;
}) {
  const [texto, setTexto] = useState('');
  return (
    <div className='fixed inset-0 flex items-center justify-center z-[100] bg-black/70 backdrop-blur-sm animate-fade-in'>
      <div className='bg-slate-900 border border-slate-400/[0.12] rounded-2xl p-7 w-[90%] max-w-[400px] animate-modal-in'>
        <div className='flex items-center mb-2.5'>{emoji}</div>
        <h3 className='m-0 mb-1.5 text-[15px] font-bold text-slate-200'>
          {titulo}
        </h3>
        <p className='m-0 mb-[18px] text-[13px] text-slate-500 leading-[1.6]'>
          {descripcion}
        </p>
        {conTexto && (
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder='Motivo (opcional)...'
            rows={3}
            className='w-full px-[11px] py-[9px] bg-slate-950/60 border border-slate-400/[0.1] rounded-[7px] text-slate-200 text-xs outline-none resize-y mb-4'
          />
        )}
        <div className='flex justify-end gap-2.5'>
          <button
            onClick={onCancelar}
            className='px-4 py-2 rounded-lg border border-slate-400/[0.12] bg-transparent text-slate-500 text-[13px] cursor-pointer'
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(texto || undefined)}
            disabled={loading}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-lg border-none text-[13px] font-bold ${btnCls} ${loading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
          >
            {loading && (
              <svg
                width='12'
                height='12'
                viewBox='0 0 12 12'
                className='animate-spin'
              >
                <circle
                  cx='6'
                  cy='6'
                  r='4.5'
                  stroke='currentColor'
                  strokeWidth='1.5'
                  fill='none'
                  strokeDasharray='14'
                  strokeDashoffset='5'
                />
              </svg>
            )}
            {labelBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PresupuestoFicha({ presupuestoId }: Props) {
  const [presupuesto, setPresupuesto] = useState<PCompleto | null>(null);
  const [loading, setLoading] = useState(true);
  const [accionLoading, setAccionLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [toast, setToast] = useState<{
    mensaje: string;
    tipo: 'ok' | 'error';
  } | null>(null);
  const [modal, setModal] = useState<'enviar' | 'aprobar' | 'rechazar' | null>(
    null,
  );
  const [tabActiva, setTabActiva] = useState<
    'items' | 'incidencias' | 'condiciones'
  >('items');

  const showToast = useCallback(
    (mensaje: string, tipo: 'ok' | 'error') => setToast({ mensaje, tipo }),
    [],
  );

  const cargar = useCallback(async () => {
    if (shouldUsePlatformMocks) {
      setPresupuesto(
        getMockPresupuestoDetalle(presupuestoId) as PCompleto | null,
      );
      setLoading(false);
      return;
    }
    const res = await obtenerPresupuestoCompleto(presupuestoId);
    setLoading(false);
    if (res.data) setPresupuesto(res.data as PCompleto);
  }, [presupuestoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleCambioEstado = async (estado: EstadoPresupuesto) => {
    if (!presupuesto) return;
    setAccionLoading(true);
    const res = await cambiarEstadoPresupuesto(presupuesto.id, estado);
    setAccionLoading(false);
    setModal(null);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.mensaje ?? 'Estado actualizado', 'ok');
    cargar();
  };

  const handleAprobar = async () => {
    if (!presupuesto) return;
    setAccionLoading(true);
    const res = await aprobarPresupuesto(presupuesto.id, true);
    setAccionLoading(false);
    setModal(null);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.mensaje ?? 'Aprobado — OS generada', 'ok');
    cargar();
  };

  const handleDuplicar = async () => {
    if (!presupuesto) return;
    setAccionLoading(true);
    const res = await duplicarPresupuesto(presupuesto.id);
    setAccionLoading(false);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.mensaje ?? 'Presupuesto duplicado', 'ok');
    if (res.data?.id)
      setTimeout(
        () => (window.location.href = `/presupuestos/${res.data!.id}`),
        1200,
      );
  };

  const handlePDF = async () => {
    if (!presupuesto) return;
    setPdfLoading(true);
    const err = await descargarPDF('presupuesto', presupuesto.id, `PST-${presupuesto.numero}.pdf`);
    setPdfLoading(false);
    if (err) showToast(`Error al generar PDF: ${err}`, 'error');
  };

  const vencido = presupuesto ? isVencido(presupuesto) : false;
  const p = presupuesto;

  const TABS: {
    id: 'items' | 'incidencias' | 'condiciones';
    label: string;
    icon: ReactNode;
    badge?: number;
  }[] = [
    {
      id: 'items' as const,
      label: 'Ítems',
      icon: <ClipboardList className='w-3.5 h-3.5' />,
      badge: p?.items.length,
    },
    {
      id: 'incidencias' as const,
      label: 'Incidencias',
      icon: <BarChart3 className='w-3.5 h-3.5' />,
      badge: p?.incidencias.length,
    },
    { id: 'condiciones' as const, label: 'Condiciones', icon: <FileText className='w-3.5 h-3.5' /> },
  ];

  return (
    <>
      <div className='px-5 pt-3.5 pb-10'>
        <div className='w-full'>
          {/* Breadcrumb */}
          <div className='flex items-center gap-2 mb-5'>
            <a
              href='/presupuestos'
              className='flex items-center gap-1 text-xs text-slate-700 no-underline tracking-widest uppercase hover:text-slate-400 transition-colors'
            >
              <ArrowLeft className='w-3 h-3' />
              Presupuestos
            </a>
            <span className='text-slate-800'>›</span>
            <span className='text-xs text-slate-600 tracking-widest uppercase'>
              {loading ? '...' : p?.numero}
            </span>
          </div>

          {/* ── Header ── */}
          <div className={`${cardClass} p-6 mb-5`}>
            {loading ? (
              <div className='flex flex-col gap-2.5'>
                <Skeleton w='w-[120px]' h='h-[13px]' />
                <Skeleton w='w-[320px]' h='h-[22px]' />
                <Skeleton w='w-[200px]' h='h-[13px]' />
              </div>
            ) : p ? (
              <div className='flex items-start justify-start gap-4'>
                <div className='flex-1'>
                  {/* Número + estado + tipo */}
                  <div className='flex items-center gap-2.5 mb-2 flex-wrap'>
                    <span className='text-sm font-bold text-amber-500 tracking-[0.02em]'>
                      {p.numero}
                    </span>
                    <BadgeEstado estado={p.estado} />
                    <span className='text-xs text-slate-600 bg-slate-400/[0.07] border border-slate-400/[0.1] rounded px-2 py-0.5'>
                      {TIPO_LABEL[p.tipo_operacion]}
                    </span>
                    {vencido && (
                      <span className='flex items-center gap-1 text-xs text-amber-500 bg-amber-500/[0.08] border border-amber-500/[0.2] rounded px-2 py-0.5 font-semibold'>
                        <Clock className='w-3 h-3' /> Vencido
                      </span>
                    )}
                  </div>

                  {/* Título */}
                  <h1 className='m-0 mb-1.5 text-xl font-bold text-slate-200 leading-[1.3] tracking-[-0.02em]'>
                    {p.titulo}
                  </h1>

                  {/* Cliente */}
                  <a
                    href={`/clientes/${p.cliente_id}`}
                    className='text-[13px] text-slate-500 no-underline hover:text-slate-400 transition-colors duration-150'
                  >
                    <User className='w-3.5 h-3.5 inline mr-1' />{(p as any).razon_social ?? p.cliente_id}
                  </a>
                </div>

                {/* Acciones */}
                <div className='flex gap-2 flex-wrap shrink-0 items-center'>
                  {/* Editar (solo en borrador) */}
                  {p.estado === 'BORRADOR' && (
                    <a
                      href={`/presupuestos/${p.id}/editar`}
                      className='inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-400/[0.15] bg-slate-900/60 text-slate-500 text-xs font-semibold no-underline'
                    >
                      <svg width='11' height='11' viewBox='0 0 11 11'>
                        <path
                          d='M2 9L3.5 5.5L8.5 0.5C9 0 10 0 10.5 0.5C11 1 11 2 10.5 2.5L5.5 7.5L2 9Z'
                          stroke='currentColor'
                          strokeWidth='1.2'
                          strokeLinejoin='round'
                          strokeLinecap='round'
                        />
                      </svg>
                      Editar
                    </a>
                  )}

                  {/* PDF */}
                  <button
                    onClick={handlePDF}
                    disabled={pdfLoading}
                    className='inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-400/[0.15] bg-slate-900/60 text-slate-500 text-xs font-semibold cursor-pointer disabled:opacity-50'
                  >
                    {pdfLoading
                      ? <Loader2 className='w-3 h-3 animate-spin' />
                      : <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
                          <path d='M2 1H7L10 4V11H2V1Z' stroke='currentColor' strokeWidth='1.2' strokeLinejoin='round' />
                          <path d='M7 1V4H10' stroke='currentColor' strokeWidth='1.2' strokeLinejoin='round' />
                        </svg>
                    }
                    PDF
                  </button>

                  {/* Duplicar */}
                  <button
                    onClick={handleDuplicar}
                    disabled={accionLoading}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-400/[0.15] bg-slate-900/60 text-slate-500 text-xs font-semibold cursor-pointer ${accionLoading ? 'opacity-60' : ''}`}
                  >
                    <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
                      <rect
                        x='1'
                        y='3'
                        width='7'
                        height='8'
                        rx='1'
                        stroke='currentColor'
                        strokeWidth='1.2'
                      />
                      <path
                        d='M4 3V2a1 1 0 011-1h5a1 1 0 011 1v7a1 1 0 01-1 1H9'
                        stroke='currentColor'
                        strokeWidth='1.2'
                        strokeLinecap='round'
                      />
                    </svg>
                    Duplicar
                  </button>

                  {/* Enviar */}
                  {p.estado === 'BORRADOR' && (
                    <button
                      onClick={() => setModal('enviar')}
                      disabled={accionLoading}
                      className='inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-blue-400/30 bg-blue-400/[0.08] text-blue-400 text-xs font-bold cursor-pointer'
                    >
                      <Send className='w-4 h-4' /> Enviar al cliente
                    </button>
                  )}

                  {/* Aprobar */}
                  {['BORRADOR', 'ENVIADO'].includes(p.estado) && (
                    <button
                      onClick={() => setModal('aprobar')}
                      disabled={accionLoading}
                      className='inline-flex items-center gap-1.5 px-[18px] py-2 rounded-lg border-none text-slate-900 text-xs font-bold cursor-pointer bg-gradient-to-br from-emerald-400/85 to-emerald-500/85 shadow-[0_4px_12px_rgba(74,222,128,0.15)]'
                    >
                      <CheckCircle2 className='w-4 h-4' /> Aprobar → OS
                    </button>
                  )}

                  {/* Rechazar */}
                  {p.estado === 'ENVIADO' && (
                    <button
                      onClick={() => setModal('rechazar')}
                      disabled={accionLoading}
                      className='inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-400/25 bg-red-400/[0.06] text-red-400 text-xs font-semibold cursor-pointer'
                    >
                      <XCircle className='w-4 h-4' /> Rechazar
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className='text-center p-5 text-slate-600'>
                Presupuesto no encontrado
              </div>
            )}
          </div>

          {p && (
            <div className='grid grid-cols-[1fr_300px] gap-4 items-start'>
              {/* ── Columna principal ── */}
              <div className='flex flex-col gap-4'>
                {/* Objetivo */}
                <div className={`${cardClass} p-5`}>
                  <SectionTitle icon='🎯' title='Objetivo del servicio' />
                  <p className='m-0 mb-3.5 text-[13px] text-slate-400 leading-[1.8]'>
                    {p.objetivo_servicio}
                  </p>
                  {p.descripcion && (
                    <div className='pt-3.5 border-t border-slate-400/[0.06]'>
                      <span className='text-xs font-semibold tracking-widest uppercase text-slate-700 block mb-1.5'>
                        Descripción / Alcance
                      </span>
                      <p className='m-0 text-[13px] text-slate-500 leading-[1.8] whitespace-pre-wrap'>
                        {p.descripcion}
                      </p>
                    </div>
                  )}
                </div>

                {/* Tabs: ítems / incidencias / condiciones */}
                <div className={`${cardClass} overflow-hidden`}>
                  {/* Tab bar */}
                  <div className='flex border-b border-slate-400/[0.07] bg-slate-950/30'>
                    {TABS.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setTabActiva(tab.id)}
                        className={`flex items-center gap-1.5 px-5 py-[13px] border-none cursor-pointer bg-transparent text-xs font-semibold whitespace-nowrap transition-all duration-150 border-b-2 ${tabActiva === tab.id ? 'text-slate-200 border-amber-500' : 'text-slate-700 border-transparent'}`}
                      >
                        {tab.icon}
                        {tab.label}
                        {tab.badge !== undefined && tab.badge > 0 && (
                          <span
                            className={`text-[9px] font-bold px-[5px] py-px rounded-[10px] ${tabActiva === tab.id ? 'bg-amber-500/15 text-amber-500' : 'bg-slate-400/[0.08] text-slate-600'}`}
                          >
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Contenido */}
                  <div
                    className='p-5 animate-fade-in'
                    key={tabActiva}
                  >
                    {tabActiva === 'items' && <TablaItems items={p.items} />}
                    {tabActiva === 'incidencias' && (
                      <TablaIncidencias incidencias={p.incidencias} />
                    )}
                    {tabActiva === 'condiciones' && (
                      <div className='grid grid-cols-2 gap-5'>
                        <InfoPar
                          label='Condiciones de pago'
                          value={p.condiciones_pago}
                        />
                        <InfoPar
                          label='Tiempo de ejecución'
                          value={p.tiempo_ejecucion}
                        />
                        <InfoPar label='Garantía' value={p.garantia} />
                        <InfoPar label='Fecha de vencimiento'>
                          <span
                            className={`text-[13px] ${vencido ? 'text-amber-500' : 'text-slate-400'}`}
                          >
                            {fmtFecha(p.fecha_vencimiento)}
                            {vencido && <AlertTriangle className='w-3 h-3 inline ml-1' />}
                          </span>
                        </InfoPar>
                        {p.notas_cliente && (
                          <div className='col-span-full'>
                            <span className='text-xs font-semibold tracking-widest uppercase text-slate-700 block mb-1.5'>
                              Notas al cliente
                            </span>
                            <p className='m-0 text-[13px] text-slate-500 p-3 rounded-lg border border-slate-400/[0.07] bg-slate-950/40 leading-[1.7] whitespace-pre-wrap'>
                              {p.notas_cliente}
                            </p>
                          </div>
                        )}
                        {p.notas_internas && (
                          <div className='col-span-full'>
                            <span className='text-xs font-semibold tracking-widest uppercase text-slate-700 block mb-1.5'>
                              Notas internas{' '}
                              <span className='text-[9px] bg-slate-400/[0.07] border border-slate-400/[0.1] rounded px-[5px] ml-1'>
                                solo interno
                              </span>
                            </span>
                            <p className='m-0 text-[13px] text-slate-600 p-3 rounded-lg border border-slate-400/[0.07] bg-slate-950/40 leading-[1.7] whitespace-pre-wrap'>
                              {p.notas_internas}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Aprobación */}
                {p.estado === 'APROBADO' && p.aprobado_en && (
                  <div
                    className={`${cardClass} px-5 py-4 border-emerald-400/[0.15]`}
                  >
                    <div className='flex items-center gap-2.5'>
                      <CheckCircle2 className='w-5 h-5 text-emerald-400' />
                      <div>
                        <div className='text-xs font-semibold text-emerald-400'>
                          Presupuesto aprobado
                        </div>
                        <div className='text-xs text-slate-600 mt-0.5'>
                          {fmtFecha(p.aprobado_en)}
                          {' · '}
                          <a
                            href='/ordenes'
                            className='text-blue-400 no-underline'
                          >
                            Ver orden de servicio generada →
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Panel lateral ── */}
              <div className='flex flex-col gap-4'>
                {/* Totales */}
                <PanelTotales p={p} />

                {/* Datos del documento */}
                <div className={`${cardClass} p-[18px]`}>
                  <div className='text-xs font-bold tracking-widest uppercase text-slate-700 mb-3.5'>
                    Documento
                  </div>
                  <div className='flex flex-col gap-2.5'>
                    {[
                      { label: 'Número', value: p.numero, mono: true },
                      {
                        label: 'Emisión',
                        value: fmtFecha(p.fecha_emision),
                        mono: true,
                      },
                      {
                        label: 'Vence',
                        value: fmtFecha(p.fecha_vencimiento),
                        mono: true,
                      },
                      {
                        label: 'Tipo',
                        value: TIPO_LABEL[p.tipo_operacion],
                        mono: false,
                      },
                      {
                        label: 'Ítems',
                        value: String(p.items.length),
                        mono: true,
                      },
                      {
                        label: 'Incidencias',
                        value: String(p.incidencias.length),
                        mono: true,
                      },
                    ].map(({ label, value, mono }) => (
                      <div
                        key={label}
                        className='flex justify-between items-center pb-2 border-b border-slate-400/[0.05]'
                      >
                        <span className='text-xs text-slate-700'>{label}</span>
                        <span
                          className={`text-xs text-slate-500 ${mono ? 'font-mono' : ''}`}
                        >
                          {value || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Accesos rápidos */}
                <div className={`${cardClass} p-[18px]`}>
                  <div className='text-xs font-bold tracking-widest uppercase text-slate-700 mb-3'>
                    Accesos rápidos
                  </div>
                  <div className='flex flex-col gap-1.5'>
                    {(
                      [
                        {
                          href: `/clientes/${p.cliente_id}`,
                          label: 'Ver ficha del cliente',
                          icon: <User className='w-3.5 h-3.5' />,
                        },
                        {
                          href: `/ordenes?presupuesto=${p.id}`,
                          label: 'Ver órdenes vinculadas',
                          icon: <Settings className='w-3.5 h-3.5' />,
                        },
                        {
                          href: `/facturas/nueva?presupuesto=${p.id}&cliente=${p.cliente_id}`,
                          label: 'Generar factura',
                          icon: <FileText className='w-3.5 h-3.5' />,
                        },
                      ] as { href: string; label: string; icon: ReactNode }[]
                    ).map(({ href, label, icon }) => (
                      <a
                        key={href}
                        href={href}
                        className='flex items-center gap-2 px-2.5 py-2 rounded-[7px] no-underline text-xs text-slate-500 border border-slate-400/[0.07] bg-slate-950/30 transition-all duration-150 hover:bg-slate-400/5 hover:text-slate-400'
                      >
                        <span className='flex items-center'>{icon}</span>
                        {label}
                      </a>
                    ))}
                    <button
                      onClick={handlePDF}
                      disabled={pdfLoading}
                      className='flex items-center gap-2 px-2.5 py-2 rounded-[7px] text-xs text-slate-500 border border-slate-400/[0.07] bg-slate-950/30 transition-all duration-150 hover:bg-slate-400/5 hover:text-slate-400 cursor-pointer disabled:opacity-50 w-full text-left'
                    >
                      {pdfLoading
                        ? <Loader2 className='w-3.5 h-3.5 animate-spin' />
                        : <FileText className='w-3.5 h-3.5' />
                      }
                      Descargar PDF
                    </button>
                  </div>
                </div>

                {/* Metadatos */}
                <div className={`${cardClass} p-4`}>
                  <div className='flex flex-col gap-2'>
                    <div className='flex justify-between'>
                      <span className='text-xs font-semibold uppercase tracking-[0.07em] text-slate-800'>
                        Creado
                      </span>
                      <span className='text-xs text-slate-700 font-mono'>
                        {fmtFecha(p.creado_en)}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-xs font-semibold uppercase tracking-[0.07em] text-slate-800'>
                        Actualizado
                      </span>
                      <span className='text-xs text-slate-700 font-mono'>
                        {fmtFecha(p.actualizado_en)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modales */}
      {modal === 'enviar' && (
        <ModalAccion
          titulo='Enviar presupuesto al cliente'
          descripcion='El presupuesto pasará al estado Enviado. Podrás aprobarlo o rechazarlo una vez que el cliente responda.'
          emoji={<Send className='w-8 h-8 text-blue-400' />}
          btnCls='bg-blue-400/90 text-slate-900'
          labelBtn='Enviar'
          loading={accionLoading}
          onCancelar={() => setModal(null)}
          onConfirmar={() => handleCambioEstado('ENVIADO')}
        />
      )}
      {modal === 'aprobar' && (
        <ModalAccion
          titulo='Aprobar presupuesto'
          descripcion='Se generará automáticamente una Orden de Servicio vinculada a este presupuesto.'
          emoji={<CheckCircle2 className='w-8 h-8 text-green-400' />}
          btnCls='bg-green-400/90 text-slate-900'
          labelBtn='Aprobar y generar OS'
          loading={accionLoading}
          onCancelar={() => setModal(null)}
          onConfirmar={handleAprobar}
        />
      )}
      {modal === 'rechazar' && (
        <ModalAccion
          titulo='Rechazar presupuesto'
          descripcion='El presupuesto pasará al estado Rechazado. Podés volver a borrarlo si necesitás modificarlo.'
          emoji={<XCircle className='w-8 h-8 text-red-400' />}
          btnCls='bg-red-400/[0.15] text-red-400 border border-red-400/25'
          labelBtn='Rechazar'
          loading={accionLoading}
          conTexto
          onCancelar={() => setModal(null)}
          onConfirmar={() => handleCambioEstado('RECHAZADO')}
        />
      )}

      {toast && (
        <Toast
          mensaje={toast.mensaje}
          tipo={toast.tipo}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
