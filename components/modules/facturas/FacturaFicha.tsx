'use client';

// ============================================================
// components/modules/facturas/FacturaFicha.tsx
// Vista detalle de factura: ítems, historial de cobros,
// formulario de nuevo recibo, emitir/anular.
// ============================================================

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type {
  FacturaCompleta,
  FacturaItem,
  Recibo,
  EstadoFactura,
  TipoComprobanteAFIP,
  TipoPago,
  TipoRecibo,
} from '@/types';
import {
  obtenerFactura,
  emitirFactura,
  anularFactura,
  registrarRecibo,
  eliminarRecibo,
} from '@/app/actions/facturas';
import {
  getMockFacturaDetalle,
  shouldUsePlatformMocks,
} from '@/app/actions/platform-mocks';
import { formatearMonto } from '@/lib/calculos';
import { ArrowLeft, FileText, User, DollarSign, AlertTriangle, Pencil, XCircle, ClipboardList, Settings, Send, Loader2 } from 'lucide-react';
import { descargarPDF } from '@/lib/pdf-client';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Props {
  facturaId: string;
}
type FCompleta = FacturaCompleta & {
  razon_social: string;
  numero_presupuesto: string | null;
  numero_orden: string | null;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<EstadoFactura, { label: string; badge: string; dot: string }> = {
  BORRADOR:        { label: 'Borrador',      badge: 'text-slate-400 bg-slate-400/[0.08] border-slate-400/15',  dot: 'bg-slate-400'  },
  EMITIDA:         { label: 'Emitida',       badge: 'text-blue-400 bg-blue-400/[0.08] border-blue-400/20',     dot: 'bg-blue-400'   },
  PENDIENTE_COBRO: { label: 'Pend. cobro',   badge: 'text-amber-500 bg-amber-500/[0.08] border-amber-500/20',  dot: 'bg-amber-500'  },
  COBRADA_PARCIAL: { label: 'Cobro parcial', badge: 'text-violet-400 bg-violet-400/[0.08] border-violet-400/20', dot: 'bg-violet-400' },
  COBRADA:         { label: 'Cobrada',       badge: 'text-green-400 bg-green-400/[0.08] border-green-400/20',  dot: 'bg-green-400'  },
  ANULADA:         { label: 'Anulada',       badge: 'text-red-400 bg-red-400/[0.08] border-red-400/20',        dot: 'bg-red-400'    },
};

const COMP_LABEL: Record<TipoComprobanteAFIP, string> = {
  FACTURA_A: 'Factura A',
  FACTURA_B: 'Factura B',
  FACTURA_C: 'Factura C',
  NOTA_DEBITO_A: 'Nota Débito A',
  NOTA_DEBITO_B: 'Nota Débito B',
  NOTA_CREDITO_A: 'Nota Crédito A',
  NOTA_CREDITO_B: 'Nota Crédito B',
  REMITO_R: 'Remito R',
};

const TIPO_PAGO_CFG: Record<TipoPago, { label: string; icon: string }> = {
  EFECTIVO: { label: 'Efectivo', icon: '💵' },
  TRANSFERENCIA: { label: 'Transferencia', icon: '🏦' },
  CHEQUE: { label: 'Cheque', icon: '📋' },
  TARJETA_DEBITO: { label: 'Débito', icon: '💳' },
  TARJETA_CREDITO: { label: 'Crédito', icon: '💳' },
  CREDITO_CUENTA: { label: 'Cta. cte.', icon: '📒' },
};

const TIPO_PAGO_ICON_JSX: Record<TipoPago, ReactNode> = {
  EFECTIVO:       <span className='text-sm'>💵</span>,
  TRANSFERENCIA:  <span className='text-sm'>🏦</span>,
  CHEQUE:         <ClipboardList className='w-4 h-4' />,
  TARJETA_DEBITO: <span className='text-sm'>💳</span>,
  TARJETA_CREDITO:<span className='text-sm'>💳</span>,
  CREDITO_CUENTA: <span className='text-sm'>📒</span>,
};

const TIPO_RECIBO_CFG: Record<TipoRecibo, { label: string; textCls: string; badgeCls: string; iconBgCls: string }> = {
  ANTICIPO:     { label: 'Anticipo',     textCls: 'text-violet-400', badgeCls: 'bg-violet-400/[0.06] border-violet-400/15', iconBgCls: 'bg-violet-400/[0.07] border-violet-400/15' },
  PAGO_PARCIAL: { label: 'Pago parcial', textCls: 'text-blue-400',   badgeCls: 'bg-blue-400/[0.06] border-blue-400/15',     iconBgCls: 'bg-blue-400/[0.07] border-blue-400/15'    },
  PAGO_FINAL:   { label: 'Pago final',   textCls: 'text-green-400',  badgeCls: 'bg-green-400/[0.06] border-green-400/15',   iconBgCls: 'bg-green-400/[0.07] border-green-400/15'  },
  DEVOLUCION:   { label: 'Devolución',   textCls: 'text-red-400',    badgeCls: 'bg-red-400/[0.06] border-red-400/15',       iconBgCls: 'bg-red-400/[0.07] border-red-400/15'      },
};

// ─── Estilos ──────────────────────────────────────────────────────────────────

const cardClass = 'bg-slate-900/70 border border-slate-400/10 rounded-xl backdrop-blur-sm';
const inputClass = 'w-full px-[11px] py-2 bg-slate-950/60 border border-slate-400/10 rounded-[7px] text-slate-200 text-xs outline-none transition-colors duration-150';
const labelClass = 'text-[10px] font-semibold tracking-widest uppercase text-slate-600 block mb-1';
const errClass = 'text-[10px] text-amber-500 block mt-[3px]';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtFecha = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—';

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function Skeleton({
  w = '100%',
  h = '14px',
  r = '4px',
}: {
  w?: string;
  h?: string;
  r?: string;
}) {
  return (
    <div
      className={`animate-pulse bg-slate-400/[0.07] w-[${w}] h-[${h}] rounded-[${r}]`}
    />
  );
}

function BadgeEstado({ estado }: { estado: EstadoFactura }) {
  const cfg = ESTADO_CFG[estado];
  return (
    <span className={`inline-flex items-center gap-[5px] px-[11px] py-[3px] rounded-[20px] text-xs font-semibold border ${cfg.badge}`}>
      <span className={`inline-block w-[5px] h-[5px] rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
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
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      className={`fixed bottom-6 right-6 z-[200] flex items-center gap-2.5 px-[18px] py-3 rounded-[10px] backdrop-blur-sm bg-slate-950/[0.97] shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-modal-in ${tipo === 'ok' ? 'border border-emerald-400/30' : 'border border-red-400/30'}`}
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

function ModalConfirm({
  titulo,
  desc,
  icono,
  btnCls,
  labelBtn,
  onOk,
  onCancel,
  loading,
  conTexto = false,
}: {
  titulo: string;
  desc: string;
  icono: ReactNode;
  btnCls: string;
  labelBtn: string;
  onOk: (t?: string) => void;
  onCancel: () => void;
  loading: boolean;
  conTexto?: boolean;
}) {
  const [texto, setTexto] = useState('');
  return (
    <div className='fixed inset-0 flex items-center justify-center z-[100] backdrop-blur-sm bg-black/70 animate-fade-in'>
      <div className='rounded-2xl p-7 w-[90%] max-w-[400px] bg-slate-950 border border-slate-400/[0.12] animate-modal-in'>
        <div className='mb-[10px]'>{icono}</div>
        <h3 className='m-0 mb-[6px] text-[15px] font-bold text-slate-200'>
          {titulo}
        </h3>
        <p className='m-0 mb-[18px] text-[13px] text-slate-500 leading-[1.6]'>
          {desc}
        </p>
        {conTexto && (
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder='Motivo (opcional)...'
            rows={3}
            className={`${inputClass} resize-y leading-[1.6] mb-4`}
          />
        )}
        <div className='flex justify-end gap-2.5'>
          <button
            onClick={onCancel}
            className='px-4 py-2 rounded-lg text-[13px] text-slate-500 cursor-pointer bg-transparent border border-slate-400/[0.12]'
          >
            Cancelar
          </button>
          <button
            onClick={() => onOk(texto || undefined)}
            disabled={loading}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-bold ${loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${btnCls}`}
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

// ─── Tabla ítems ──────────────────────────────────────────────────────────────

function TablaItems({ items }: { items: FacturaItem[] }) {
  return (
    <div className='rounded-[10px] overflow-hidden border border-slate-400/[0.08]'>
      <div className='overflow-x-auto'>
        <div className='grid grid-cols-[32px_1fr_70px_80px_90px_60px_60px_100px] gap-2 px-[14px] py-[9px] border-b border-slate-400/[0.07] bg-slate-950/40 min-w-[600px]'>
          {[
            '#',
            'Descripción',
            'Cant.',
            'Unidad',
            'P. Unit.',
            'Dto.',
            'IVA',
            'Subtotal',
          ].map((h, i) => (
            <span
              key={h}
              className={`text-[10px] font-bold tracking-[0.06em] uppercase text-slate-700 ${i >= 5 ? 'text-right' : 'text-left'}`}
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
              className={`grid grid-cols-[32px_1fr_70px_80px_90px_60px_60px_100px] gap-2 px-[14px] py-[11px] items-center min-w-[600px] ${idx < items.length - 1 ? 'border-b border-slate-400/[0.05]' : ''}`}
            >
              <div className='flex items-center justify-center text-[10px] font-bold text-emerald-400 w-[22px] h-[22px] rounded-[5px] bg-emerald-400/[0.07] border border-emerald-400/[0.12]'>
                {idx + 1}
              </div>
              <div>
                <div className='text-[13px] text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap'>
                  {item.descripcion}
                </div>
                {item.detalle && (
                  <div className='text-[11px] text-slate-600 mt-[2px] overflow-hidden text-ellipsis whitespace-nowrap'>
                    {item.detalle}
                  </div>
                )}
              </div>
              <span className='text-xs text-slate-500 text-right'>
                {item.cantidad}
              </span>
              <span className='text-[11px] text-slate-600 text-right'>
                {item.unidad_medida}
              </span>
              <span className='text-xs text-slate-500 text-right'>
                {formatearMonto(item.precio_unitario)}
              </span>
              <span className={`text-[11px] text-right ${item.descuento_pct > 0 ? 'text-amber-500' : 'text-slate-800'}`}>
                {item.descuento_pct > 0 ? `${item.descuento_pct}%` : '—'}
              </span>
              <span className='text-[11px] text-slate-500 text-right'>
                {item.iva_pct}%
              </span>
              <span className='text-[13px] font-semibold text-slate-400 text-right'>
                {formatearMonto(item.subtotal)}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Formulario recibo ────────────────────────────────────────────────────────

function FormRecibo({
  factura,
  onSuccess,
  showToast,
}: {
  factura: FCompleta;
  onSuccess: () => void;
  showToast: (m: string, t: 'ok' | 'error') => void;
}) {
  const saldoMax = factura.saldo_pendiente;

  const [form, setForm] = useState({
    tipo: 'PAGO_PARCIAL' as TipoRecibo,
    tipo_pago: 'TRANSFERENCIA' as TipoPago,
    monto: '',
    fecha: new Date().toISOString().split('T')[0],
    concepto: '',
    notas: '',
    cheque_banco: '',
    cheque_numero: '',
    cheque_fecha: '',
    cheque_titular: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const esCheque = form.tipo_pago === 'CHEQUE';
  const montoNum = parseFloat(form.monto) || 0;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.monto || montoNum <= 0) e.monto = 'Ingresá un monto válido';
    if (montoNum > saldoMax + 0.01)
      e.monto = `Supera el saldo pendiente (${formatearMonto(saldoMax)})`;
    if (esCheque && !form.cheque_banco.trim()) e.cheque_banco = 'Requerido';
    if (esCheque && !form.cheque_numero.trim()) e.cheque_numero = 'Requerido';
    if (esCheque && !form.cheque_fecha) e.cheque_fecha = 'Requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    const res = await registrarRecibo({
      factura_id: factura.id,
      cliente_id: factura.cliente_id,
      tipo: form.tipo,
      tipo_pago: form.tipo_pago,
      monto: montoNum,
      fecha: form.fecha,
      concepto: form.concepto || undefined,
      notas: form.notas || undefined,
      cheque_banco: esCheque ? form.cheque_banco : undefined,
      cheque_numero: esCheque ? form.cheque_numero : undefined,
      cheque_fecha: esCheque ? form.cheque_fecha : undefined,
      cheque_titular: esCheque ? form.cheque_titular : undefined,
    });
    setLoading(false);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.mensaje ?? 'Recibo registrado', 'ok');
    setForm((p) => ({
      ...p,
      monto: '',
      concepto: '',
      notas: '',
      cheque_banco: '',
      cheque_numero: '',
      cheque_fecha: '',
      cheque_titular: '',
    }));
    onSuccess();
  };

  const field = (
    key: string,
    v: string,
    set: (v: string) => void,
    label: string,
    type = 'text',
    placeholder = '',
  ) => (
    <div>
      <label className={`text-[10px] font-semibold tracking-widest uppercase block mb-1 ${errors[key] ? 'text-amber-500' : 'text-slate-600'}`}>
        {label}
      </label>
      <input
        type={type}
        value={v}
        onChange={(e) => set(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-[11px] py-2 bg-slate-950/60 rounded-[7px] text-slate-200 text-xs outline-none transition-colors duration-150 border focus:border-emerald-400/35 ${errors[key] ? 'border-amber-500/40' : 'border-slate-400/10'}`}
        {...(type === 'date' ? { style: { colorScheme: 'dark' } as React.CSSProperties } : {})}
      />
      {errors[key] && (
        <span className={errClass}>{errors[key]}</span>
      )}
    </div>
  );

  const selectField = (
    key: string,
    value: string,
    onChange: (v: string) => void,
    label: string,
    opts: Array<{ value: string; label: string }>,
  ) => (
    <div>
      <label className={labelClass}>{label}</label>
      <div className='relative'>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} appearance-none pr-[26px] cursor-pointer`}
        >
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          width='9'
          height='9'
          viewBox='0 0 9 9'
          fill='none'
          className='absolute right-[9px] top-1/2 -translate-y-1/2 pointer-events-none text-slate-600'
        >
          <path
            d='M1 3L4.5 6.5L8 3'
            stroke='currentColor'
            strokeWidth='1.2'
            strokeLinecap='round'
            strokeLinejoin='round'
          />
        </svg>
      </div>
    </div>
  );

  return (
    <div
      id='cobros'
      className={`${cardClass} p-5 border border-emerald-400/10`}
    >
      <div className='flex items-center gap-2 mb-[18px]'>
        <DollarSign className='w-4 h-4 text-emerald-400' />
        <span className='text-[11px] font-bold tracking-widest uppercase text-emerald-400'>
          Registrar cobro
        </span>
        <span className='text-xs text-slate-700 ml-auto'>
          Saldo:{' '}
          <span className='text-amber-500 font-bold'>
            {formatearMonto(saldoMax)}
          </span>
        </span>
      </div>

      <div className='mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2'>
        {selectField(
          'tipo',
          form.tipo,
          (v) => setForm((p) => ({ ...p, tipo: v as TipoRecibo })),
          'Tipo de recibo',
          Object.entries(TIPO_RECIBO_CFG).map(([k, v]) => ({
            value: k,
            label: v.label,
          })),
        )}
        {selectField(
          'tipo_pago',
          form.tipo_pago,
          (v) => setForm((p) => ({ ...p, tipo_pago: v as TipoPago })),
          'Medio de pago',
          Object.entries(TIPO_PAGO_CFG).map(([k, v]) => ({
            value: k,
            label: `${v.icon} ${v.label}`,
          })),
        )}
      </div>

      <div className='mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2'>
        {field(
          'monto',
          form.monto,
          (v) => setForm((p) => ({ ...p, monto: v })),
          'Monto *',
          'number',
          '0.00',
        )}
        {field(
          'fecha',
          form.fecha,
          (v) => setForm((p) => ({ ...p, fecha: v })),
          'Fecha *',
          'date',
        )}
      </div>

      {/* Campos de cheque */}
      {esCheque && (
        <div className='p-3 rounded-lg mb-3 bg-slate-400/[0.03] border border-slate-400/[0.08] animate-fade-in'>
          <div className='text-[10px] font-semibold tracking-widest uppercase text-slate-600 mb-2.5'>
            Datos del cheque
          </div>
          <div className='grid grid-cols-1 gap-2.5 sm:grid-cols-2'>
            {field(
              'cheque_banco',
              form.cheque_banco,
              (v) => setForm((p) => ({ ...p, cheque_banco: v })),
              'Banco *',
              'text',
              'Ej: BBVA',
            )}
            {field(
              'cheque_numero',
              form.cheque_numero,
              (v) => setForm((p) => ({ ...p, cheque_numero: v })),
              'Número *',
              'text',
              '00001234',
            )}
            {field(
              'cheque_fecha',
              form.cheque_fecha,
              (v) => setForm((p) => ({ ...p, cheque_fecha: v })),
              'Fecha *',
              'date',
            )}
            {field(
              'cheque_titular',
              form.cheque_titular,
              (v) => setForm((p) => ({ ...p, cheque_titular: v })),
              'Titular',
              'text',
              'Nombre del titular',
            )}
          </div>
        </div>
      )}

      {field(
        'concepto',
        form.concepto,
        (v) => setForm((p) => ({ ...p, concepto: v })),
        'Concepto',
        'text',
        'Ej: Pago parcial OS-024',
      )}

      <div className='mt-3.5 flex justify-end'>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`inline-flex items-center gap-[7px] px-[22px] py-[10px] rounded-[9px] border-0 text-slate-900 text-[13px] font-bold justify-center w-full sm:w-auto bg-gradient-to-br from-green-400/85 to-green-500/85 shadow-[0_4px_12px_rgba(74,222,128,0.15)] ${loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {loading && (
            <svg
              width='13'
              height='13'
              viewBox='0 0 13 13'
              className='animate-spin'
            >
              <circle
                cx='6.5'
                cy='6.5'
                r='5'
                stroke='currentColor'
                strokeWidth='1.5'
                fill='none'
                strokeDasharray='15'
                strokeDashoffset='5'
              />
            </svg>
          )}
          {loading ? 'Guardando...' : 'Registrar cobro'}
        </button>
      </div>
    </div>
  );
}

// ─── Historial de cobros ──────────────────────────────────────────────────────

function HistorialCobros({
  recibos,
  onEliminar,
  canEdit,
}: {
  recibos: Recibo[];
  onEliminar: (id: string) => void;
  canEdit: boolean;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (recibos.length === 0) {
    return (
      <div className='p-5 text-center rounded-lg border border-dashed border-slate-400/10'>
        <p className='m-0 text-xs text-slate-700'>Sin cobros registrados</p>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-1.5'>
      {recibos
        .sort(
          (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
        )
        .map((r) => {
          const tipoCfg = TIPO_RECIBO_CFG[r.tipo];
          const pagoCfg = TIPO_PAGO_CFG[r.tipo_pago];
          const pagoIconJsx = TIPO_PAGO_ICON_JSX[r.tipo_pago];
          return (
            <div
              key={r.id}
              className='flex items-center gap-2.5 px-[14px] py-[11px] rounded-[9px] bg-slate-950/40 border border-slate-400/[0.07]'
            >
              {/* Icono */}
              <div className={`flex items-center justify-center text-sm shrink-0 w-8 h-8 rounded-lg border ${tipoCfg.iconBgCls}`}>
                {pagoIconJsx}
              </div>

              {/* Info */}
              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-[7px] mb-[2px] flex-wrap'>
                  <span className='text-xs font-bold text-slate-400'>
                    {r.numero}
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-[1px] rounded border ${tipoCfg.badgeCls} ${tipoCfg.textCls}`}>
                    {tipoCfg.label}
                  </span>
                  <span className='flex items-center gap-1 text-[11px] text-slate-600'>
                    {pagoIconJsx} {pagoCfg.label}
                  </span>
                </div>
                <div className='flex gap-2.5 flex-wrap'>
                  <span className='text-[11px] text-slate-700'>
                    {fmtFecha(r.fecha)}
                  </span>
                  {r.concepto && (
                    <span className='text-[11px] text-slate-600'>
                      · {r.concepto}
                    </span>
                  )}
                  {r.cheque_banco && (
                    <span className='text-[10px] text-slate-700'>
                      Cheque {r.cheque_banco} #{r.cheque_numero}
                    </span>
                  )}
                </div>
              </div>

              {/* Monto */}
              <span className={`text-[15px] font-extrabold shrink-0 ${r.tipo === 'DEVOLUCION' ? 'text-red-400' : 'text-green-400'}`}>
                {r.tipo === 'DEVOLUCION' ? '−' : ''}
                {formatearMonto(r.monto)}
              </span>

              {/* Eliminar */}
              {canEdit && (
                <button
                  onClick={async () => {
                    setLoadingId(r.id);
                    await onEliminar(r.id);
                    setLoadingId(null);
                  }}
                  disabled={loadingId === r.id}
                  className='flex items-center justify-center shrink-0 cursor-pointer bg-transparent transition-all duration-[120ms] w-[26px] h-[26px] rounded-[5px] border border-slate-400/[0.08] text-slate-700 hover:text-red-400 hover:border-red-400/20'
                >
                  {loadingId === r.id ? (
                    <svg
                      width='10'
                      height='10'
                      viewBox='0 0 10 10'
                      className='animate-spin'
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
                  ) : (
                    <svg width='10' height='10' viewBox='0 0 10 10'>
                      <path
                        d='M2 2L8 8M8 2L2 8'
                        stroke='currentColor'
                        strokeWidth='1.4'
                        strokeLinecap='round'
                      />
                    </svg>
                  )}
                </button>
              )}
            </div>
          );
        })}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function FacturaFicha({ facturaId }: Props) {
  const [factura, setFactura] = useState<FCompleta | null>(null);
  const [loading, setLoading] = useState(true);
  const [accionLoading, setAccionLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [toast, setToast] = useState<{
    mensaje: string;
    tipo: 'ok' | 'error';
  } | null>(null);
  const [modal, setModal] = useState<'emitir' | 'anular' | null>(null);

  const showToast = useCallback(
    (m: string, t: 'ok' | 'error') => setToast({ mensaje: m, tipo: t }),
    [],
  );

  const cargar = useCallback(async () => {
    if (shouldUsePlatformMocks) {
      setFactura(getMockFacturaDetalle(facturaId) as FCompleta | null);
      setLoading(false);
      return;
    }
    const res = await obtenerFactura(facturaId);
    setLoading(false);
    if (res.data) setFactura(res.data as FCompleta);
  }, [facturaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleEmitir = async () => {
    if (!factura) return;
    setAccionLoading(true);
    const res = await emitirFactura(factura.id);
    setAccionLoading(false);
    setModal(null);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.mensaje ?? 'Factura emitida', 'ok');
    cargar();
  };

  const handleAnular = async (motivo?: string) => {
    if (!factura) return;
    setAccionLoading(true);
    const res = await anularFactura(factura.id, motivo);
    setAccionLoading(false);
    setModal(null);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast('Factura anulada', 'ok');
    cargar();
  };

  const handleEliminarRecibo = async (reciboId: string) => {
    const res = await eliminarRecibo(reciboId);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.mensaje ?? 'Recibo eliminado', 'ok');
    cargar();
  };

  const handlePDF = async () => {
    if (!factura) return;
    setPdfLoading(true);
    const err = await descargarPDF('factura', factura.id, `FAC-${factura.numero}.pdf`);
    setPdfLoading(false);
    if (err) showToast(`Error al generar PDF: ${err}`, 'error');
  };

  const f = factura;
  const cobrado = f
    ? f.recibos
        .filter((r) => r.tipo !== 'DEVOLUCION')
        .reduce((a, r) => a + r.monto, 0)
    : 0;
  const devoluciones = f
    ? f.recibos
        .filter((r) => r.tipo === 'DEVOLUCION')
        .reduce((a, r) => a + r.monto, 0)
    : 0;
  const pctCobrado =
    f && f.total > 0 ? Math.min(100, Math.round((cobrado / f.total) * 100)) : 0;
  const canAddCobro =
    f && !['COBRADA', 'ANULADA'].includes(f.estado) && f.saldo_pendiente > 0;
  const canEdit = f && !['COBRADA', 'ANULADA'].includes(f.estado);
  const isVencida =
    f &&
    ['EMITIDA', 'PENDIENTE_COBRO', 'COBRADA_PARCIAL'].includes(f.estado) &&
    !!f.fecha_vencimiento &&
    new Date(f.fecha_vencimiento) < new Date();

  return (
    <>
      <div className='px-3 py-3 pb-10 sm:px-5 sm:py-4 sm:pb-12 lg:px-4 lg:py-2 lg:pb-3'>
        <div className='w-full mx-auto min-w-0'>
          {/* Breadcrumb */}
          <div className='mb-3 flex items-center gap-2 lg:mb-2'>
            <a
              href='/facturas'
              className='flex items-center gap-1 text-[11px] text-slate-700 no-underline tracking-widest uppercase hover:text-slate-400 transition-colors'
            >
              <ArrowLeft className='w-3 h-3' />
              Facturas
            </a>
            <span className='text-[#1e293b]'>›</span>
            <span className='text-[11px] text-slate-600 tracking-widest uppercase'>
              {loading ? '...' : f?.numero}
            </span>
          </div>

          {/* Header */}
          <div className={`${cardClass} p-4 mb-3`}>
            {loading ? (
              <div className='flex flex-col gap-2.5'>
                <Skeleton w='120px' h='13px' />
                <Skeleton w='280px' h='22px' />
                <Skeleton w='180px' h='13px' />
              </div>
            ) : f ? (
              <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                <div className='min-w-0'>
                  <div className='flex items-center gap-2.5 mb-2 flex-wrap'>
                    <span className='text-sm font-bold text-emerald-400 tracking-[0.02em]'>
                      {f.numero}
                    </span>
                    <span className='text-xs font-semibold text-slate-400'>
                      {COMP_LABEL[f.tipo_comprobante]}
                    </span>
                    <BadgeEstado estado={f.estado} />
                    {isVencida && (
                      <span className='flex items-center gap-1 text-[10px] text-red-400 rounded px-2 py-[2px] font-semibold bg-red-500/[0.08] border border-red-500/20'>
                        <AlertTriangle className='w-3 h-3' /> Vencida
                      </span>
                    )}
                    {/* Vínculos */}
                    {f.numero_presupuesto && (
                      <a
                        href={`/presupuestos/${f.presupuesto_id}`}
                        className='flex items-center gap-1 text-[11px] text-amber-500 no-underline rounded px-[7px] py-[1px] bg-amber-500/[0.06] border border-amber-500/[0.15]'
                      >
                        <FileText className='w-3 h-3' /> {f.numero_presupuesto}
                      </a>
                    )}
                    {f.numero_orden && (
                      <a
                        href={`/ordenes/${f.orden_id}`}
                        className='flex items-center gap-1 text-[11px] text-blue-400 no-underline rounded px-[7px] py-[1px] bg-blue-400/[0.06] border border-blue-400/[0.15]'
                      >
                        <Settings className='w-3 h-3' /> {f.numero_orden}
                      </a>
                    )}
                  </div>
                  <a
                    href={`/clientes/${f.cliente_id}`}
                    className='text-base font-bold text-slate-400 no-underline block mb-1 hover:text-slate-200 transition-colors duration-[120ms]'
                  >
                    {f.razon_social}
                  </a>
                  <span className='text-[22px] font-extrabold text-emerald-400 tracking-[-0.02em]'>
                    {formatearMonto(f.total)}
                  </span>
                </div>

                {/* Acciones */}
                <div className='flex w-full flex-wrap gap-2 lg:w-auto lg:flex-shrink-0'>
                  <button
                    onClick={handlePDF}
                    disabled={pdfLoading}
                    className='inline-flex items-center gap-1.5 px-[14px] py-2 rounded-lg text-xs font-semibold text-slate-500 justify-center w-full sm:w-auto border border-slate-400/[0.15] bg-slate-950/60 cursor-pointer disabled:opacity-50'
                  >
                    {pdfLoading ? <Loader2 className='w-4 h-4 animate-spin' /> : <FileText className='w-4 h-4' />}
                    PDF
                  </button>
                  {f.estado === 'BORRADOR' && (
                    <>
                      <a
                        href={`/facturas/${f.id}/editar`}
                        className='inline-flex items-center gap-1.5 px-[14px] py-2 rounded-lg text-xs font-semibold text-slate-500 no-underline justify-center w-full sm:w-auto border border-slate-400/[0.15] bg-slate-950/60'
                      >
                        <Pencil className='w-4 h-4' /> Editar
                      </a>
                      <button
                        onClick={() => setModal('emitir')}
                        disabled={accionLoading}
                        className='inline-flex items-center gap-1.5 px-[18px] py-2 rounded-lg border-0 text-slate-900 text-xs font-bold cursor-pointer justify-center w-full sm:w-auto bg-gradient-to-br from-green-400/85 to-green-500/85 shadow-[0_4px_12px_rgba(74,222,128,0.15)]'
                      >
                        <Send className='w-4 h-4' /> Emitir factura
                      </button>
                    </>
                  )}
                  {!['COBRADA', 'ANULADA'].includes(f.estado) && (
                    <button
                      onClick={() => setModal('anular')}
                      disabled={accionLoading}
                      className='inline-flex items-center gap-1.5 px-[14px] py-2 rounded-lg text-red-400 text-xs font-semibold cursor-pointer justify-center w-full sm:w-auto border border-red-500/20 bg-red-500/[0.05]'
                    >
                      <XCircle className='w-4 h-4' /> Anular
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className='text-center p-5 text-slate-600'>
                Factura no encontrada
              </div>
            )}
          </div>

          {f && (
            <div className='grid grid-cols-1 gap-2.5 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start'>
              {/* Columna principal */}
              <div className='flex min-w-0 flex-col gap-2.5'>
                {/* Ítems */}
                <div className={`${cardClass} p-[14px]`}>
                  <div className='flex items-center gap-2 mb-4'>
                    <ClipboardList className='w-4 h-4 text-slate-600' />
                    <span className='text-[11px] font-bold tracking-widest uppercase text-slate-600'>
                      Ítems facturados
                    </span>
                    <span className='text-[9px] font-bold text-slate-600 rounded-[10px] px-1.5 py-[1px] bg-slate-400/[0.08] border border-slate-400/10'>
                      {f.items.length}
                    </span>
                  </div>
                  <TablaItems items={f.items} />
                </div>

                {/* Cobros */}
                <div className={`${cardClass} p-[14px]`}>
                  <div className='flex items-center gap-2 mb-4'>
                    <span className='text-[13px]'>💳</span>
                    <span className='text-[11px] font-bold tracking-widest uppercase text-slate-600'>
                      Historial de cobros
                    </span>
                    {f.recibos.length > 0 && (
                      <span className='text-[9px] font-bold text-emerald-400 rounded-[10px] px-1.5 py-[1px] bg-emerald-400/[0.08] border border-emerald-400/[0.12]'>
                        {f.recibos.length}
                      </span>
                    )}
                  </div>
                  <HistorialCobros
                    recibos={f.recibos}
                    onEliminar={handleEliminarRecibo}
                    canEdit={!!canEdit}
                  />
                </div>

                {/* Formulario nuevo cobro */}
                {canAddCobro && (
                  <FormRecibo
                    factura={f}
                    onSuccess={cargar}
                    showToast={showToast}
                  />
                )}

                {/* Notas */}
                {f.notas && (
                  <div className={`${cardClass} p-[14px]`}>
                    <div className='text-[10px] font-bold tracking-widest uppercase text-slate-700 mb-2'>
                      Notas
                    </div>
                    <p className='m-0 text-[13px] text-slate-500 leading-[1.7] whitespace-pre-wrap'>
                      {f.notas}
                    </p>
                  </div>
                )}
              </div>

              {/* Panel lateral */}
              <div className='flex min-w-0 flex-col gap-2.5'>
                {/* Barra de cobro */}
                <div className={`${cardClass} p-[14px]`}>
                  <div className='text-[10px] font-bold tracking-widest uppercase text-slate-700 mb-3'>
                    Estado de cobro
                  </div>

                  {/* Barra */}
                  <div className='h-2 rounded overflow-hidden mb-2.5 bg-slate-400/[0.08]'>
                    <div
                      className={`h-full rounded transition-all duration-500 ease-in-out ${pctCobrado === 100 ? 'bg-green-400' : pctCobrado > 50 ? 'bg-blue-400' : 'bg-amber-500'} w-[${pctCobrado}%]`}
                    />
                  </div>
                  <div className='flex justify-between mb-3'>
                    <span className='text-[11px] text-slate-600'>Cobrado</span>
                    <span className={`text-xs font-bold ${pctCobrado === 100 ? 'text-green-400' : 'text-amber-500'}`}>
                      {pctCobrado}%
                    </span>
                  </div>

                  <div className='flex flex-col gap-2'>
                    {[
                      { label: 'Total facturado', value: f.total,             textCls: 'text-slate-400',  bold: false },
                      { label: 'Total cobrado',   value: cobrado,             textCls: 'text-green-400',  bold: false },
                      ...(devoluciones > 0 ? [{ label: 'Devoluciones', value: devoluciones, textCls: 'text-red-400', bold: false }] : []),
                      { label: 'Saldo pendiente', value: f.saldo_pendiente,   textCls: f.saldo_pendiente > 0 ? 'text-amber-500' : 'text-slate-800', bold: true },
                    ].map(({ label, value, textCls, bold }) => (
                      <div
                        key={label}
                        className='flex justify-between items-center pb-1.5 border-b border-slate-400/[0.05]'
                      >
                        <span className='text-[11px] text-slate-600'>{label}</span>
                        <span className={`font-mono ${bold ? 'text-sm font-extrabold' : 'text-xs font-medium'} ${textCls}`}>
                          {formatearMonto(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Datos del documento */}
                <div className={`${cardClass} p-[14px]`}>
                  <div className='text-[10px] font-bold tracking-widest uppercase text-slate-700 mb-3'>
                    Documento
                  </div>
                  <div className='flex flex-col gap-2'>
                    {[
                      { label: 'Número', value: f.numero, mono: true },
                      {
                        label: 'Comprobante',
                        value: COMP_LABEL[f.tipo_comprobante],
                      },
                      {
                        label: 'Emisión',
                        value: fmtFecha(f.fecha_emision),
                        mono: true,
                      },
                      {
                        label: 'Vencimiento',
                        value: fmtFecha(f.fecha_vencimiento),
                        mono: true,
                      },
                      { label: 'Cond. venta', value: f.condicion_venta ?? '—' },
                      ...(f.periodo_desde
                        ? [
                            {
                              label: 'Período',
                              value: `${fmtFecha(f.periodo_desde)} – ${fmtFecha(f.periodo_hasta)}`,
                              mono: true,
                            },
                          ]
                        : []),
                      ...(f.cae
                        ? [{ label: 'CAE', value: f.cae, mono: true }]
                        : []),
                    ].map(({ label, value, mono }) => (
                      <div
                        key={label}
                        className='flex justify-between items-start gap-2 pb-[7px] border-b border-slate-400/[0.05]'
                      >
                        <span className='text-[11px] text-slate-700 shrink-0'>
                          {label}
                        </span>
                        <span className='text-xs text-slate-500 text-right'>
                          {value || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Desglose */}
                <div className={`${cardClass} p-[14px]`}>
                  <div className='text-[10px] font-bold tracking-widest uppercase text-slate-700 mb-3'>
                    Desglose
                  </div>
                  {[
                    { label: 'Subtotal', value: f.subtotal },
                    { label: `IVA ${f.iva_pct}%`, value: f.iva_monto },
                    ...(f.otros_impuestos > 0
                      ? [{ label: 'Otros imp.', value: f.otros_impuestos }]
                      : []),
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className='flex justify-between mb-1.5'
                    >
                      <span className='text-[11px] text-slate-600'>{label}</span>
                      <span className='text-xs text-slate-500'>
                        {formatearMonto(value)}
                      </span>
                    </div>
                  ))}
                  <div className='h-px my-2 bg-slate-400/[0.06]' />
                  <div className='flex justify-between'>
                    <span className='text-xs font-bold text-slate-400'>
                      TOTAL
                    </span>
                    <span className='text-base font-extrabold text-emerald-400'>
                      {formatearMonto(f.total)}
                    </span>
                  </div>
                </div>

                {/* Accesos rápidos */}
                <div className={`${cardClass} p-3`}>
                  <div className='text-[10px] font-bold tracking-widest uppercase text-slate-700 mb-2.5'>
                    Accesos rápidos
                  </div>
                  <div className='flex flex-col gap-[5px]'>
                    {(
                      [
                        {
                          href: `/clientes/${f.cliente_id}`,
                          label: 'Ver cliente',
                          icon: <User className='w-4 h-4' />,
                        },
                        ...(f.presupuesto_id
                          ? [
                              {
                                href: `/presupuestos/${f.presupuesto_id}`,
                                label: 'Ver presupuesto',
                                icon: <FileText className='w-4 h-4' />,
                              },
                            ]
                          : []),
                        ...(f.orden_id
                          ? [
                              {
                                href: `/ordenes/${f.orden_id}`,
                                label: 'Ver orden de servicio',
                                icon: <Settings className='w-4 h-4' />,
                              },
                            ]
                          : []),
                      ] as { href: string; label: string; icon: ReactNode }[]
                    ).map(({ href, label, icon }) => (
                      <a
                        key={href}
                        href={href}
                        className='flex items-center gap-[7px] px-[9px] py-[7px] rounded-md no-underline text-xs text-slate-500 transition-all duration-[120ms] border border-slate-400/[0.07] bg-slate-950/30'
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background =
                            'rgba(148,163,184,0.05)';
                          e.currentTarget.style.color = '#94a3b8';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background =
                            'rgba(8,16,35,0.3)';
                          e.currentTarget.style.color = '#64748b';
                        }}
                      >
                        {icon}
                        {label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {modal === 'emitir' && (
        <ModalConfirm
          titulo='Emitir factura'
          desc='La factura pasará al estado Emitida. Podés registrar cobros a partir de este momento.'
          icono={<Send className='w-8 h-8 text-green-400' />}
          btnCls='bg-green-400/90 text-slate-900 border-0'
          labelBtn='Emitir'
          loading={accionLoading}
          onOk={handleEmitir}
          onCancel={() => setModal(null)}
        />
      )}
      {modal === 'anular' && (
        <ModalConfirm
          titulo='Anular factura'
          desc='La factura quedará anulada. No se puede deshacer.'
          icono={<XCircle className='w-8 h-8 text-red-400' />}
          btnCls='bg-red-400/[0.15] text-red-400 border border-red-400/25'
          labelBtn='Anular'
          loading={accionLoading}
          conTexto
          onOk={handleAnular}
          onCancel={() => setModal(null)}
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
