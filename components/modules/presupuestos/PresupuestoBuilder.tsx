'use client';

// ============================================================
// components/modules/presupuestos/PresupuestoBuilder.tsx
// Builder completo de presupuestos: cabecera + ítems +
// matriz de incidencias + panel de totales en tiempo real
// ============================================================

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type ChangeEvent,
} from 'react';
import {
  Wrench,
  Package,
  ClipboardList,
  BarChart3,
  PenLine,
  FileText,
  Briefcase,
  User,
} from 'lucide-react';
import type {
  TipoOperacion,
  TipoIncidencia,
  CrearPresupuestoDTO,
  CrearPresupuestoItemDTO,
  CrearPresupuestoIncidenciaDTO,
  ClienteListaItem,
} from '@/types';
import {
  calcularTotalesPresupuesto,
  formatearMonto,
  redondear,
} from '@/lib/calculos';
import { crearPresupuesto } from '@/app/actions/presupuestos';
import { obtenerClientes } from '@/app/actions/clientes';

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPOS_OPERACION: { value: TipoOperacion; label: string; icon: ReactNode }[] =
  [
    { value: 'SERVICIO', label: 'Servicio', icon: <Wrench className="w-3.5 h-3.5" /> },
    { value: 'PRODUCTO', label: 'Producto', icon: <Package className="w-3.5 h-3.5" /> },
    { value: 'PRODUCTO_SERVICIO', label: 'Producto + Servicio', icon: <span className="flex items-center gap-0.5"><Wrench className="w-3 h-3" /><Package className="w-3 h-3" /></span> },
  ];

const UNIDADES = [
  'UN',
  'HS',
  'DÍA',
  'M²',
  'ML',
  'KG',
  'LT',
  'GL',
  'JGO',
  'KIT',
];

const INCIDENCIA_CONFIG: Record<
  TipoIncidencia,
  { label: string; icon: ReactNode; textCls: string; badgeCls: string; usaDias: boolean; usaKm: boolean }
> = {
  traslado:          { label: 'Traslado',           icon: '🚗', textCls: 'text-blue-400',    badgeCls: 'bg-blue-400/[0.07] border-blue-400/15',     usaDias: false, usaKm: true  },
  viatico:           { label: 'Viático',             icon: <Briefcase className="w-3.5 h-3.5" />, textCls: 'text-amber-500',   badgeCls: 'bg-amber-500/[0.07] border-amber-500/15',   usaDias: true,  usaKm: false },
  hospedaje:         { label: 'Hospedaje',           icon: '🏨', textCls: 'text-violet-400',  badgeCls: 'bg-violet-400/[0.07] border-violet-400/15', usaDias: true,  usaKm: false },
  combustible:       { label: 'Combustible',         icon: '⛽', textCls: 'text-orange-500',  badgeCls: 'bg-orange-500/[0.07] border-orange-500/15', usaDias: false, usaKm: true  },
  vianda:            { label: 'Vianda',              icon: '🍱', textCls: 'text-emerald-400', badgeCls: 'bg-emerald-400/[0.07] border-emerald-400/15', usaDias: true, usaKm: false },
  equipamiento:      { label: 'Equipamiento',        icon: '🛠', textCls: 'text-slate-400',   badgeCls: 'bg-slate-400/[0.06] border-slate-400/15',   usaDias: false, usaKm: false },
  sanidad:           { label: 'Sanidad / Seguros',   icon: '🏥', textCls: 'text-red-400',     badgeCls: 'bg-red-400/[0.07] border-red-400/15',       usaDias: false, usaKm: false },
  honorario_externo: { label: 'Honorario Externo',   icon: <User className="w-3.5 h-3.5" />, textCls: 'text-fuchsia-400', badgeCls: 'bg-fuchsia-400/[0.07] border-fuchsia-400/15', usaDias: false, usaKm: false },
  pago_tercero:      { label: 'Pago a Tercero',      icon: '💸', textCls: 'text-yellow-400',  badgeCls: 'bg-yellow-400/[0.07] border-yellow-400/15', usaDias: false, usaKm: false },
  otro:              { label: 'Otro',                icon: '📎', textCls: 'text-slate-500',   badgeCls: 'bg-slate-500/[0.06] border-slate-500/15',   usaDias: false, usaKm: false },
};

const IVA_OPCIONES = [0, 10.5, 21, 27];

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface ItemForm {
  _id: string; // id local para React key
  descripcion: string;
  detalle: string;
  cantidad: string;
  unidad_medida: string;
  precio_unitario: string;
  costo_unitario: string;
  descuento_pct: string;
}

interface IncidenciaForm {
  _id: string;
  tipo: TipoIncidencia;
  descripcion: string;
  cantidad: string;
  dias: string;
  distancia_km: string;
  monto_unitario: string;
  es_interno: boolean;
  notas: string;
}

interface CabeceraForm {
  cliente_id: string;
  titulo: string;
  objetivo_servicio: string;
  tipo_operacion: TipoOperacion;
  descripcion: string;
  fecha_vencimiento: string;
  descuento_pct: string;
  iva_pct: string;
  condiciones_pago: string;
  tiempo_ejecucion: string;
  garantia: string;
  notas_internas: string;
  notas_cliente: string;
}

type FormErrors = Partial<Record<string, string>>;
type TabActiva = 'cabecera' | 'items' | 'incidencias' | 'condiciones';

// ─── Estado inicial ───────────────────────────────────────────────────────────

const nuevaIncidencia = (
  tipo: TipoIncidencia = 'traslado',
): IncidenciaForm => ({
  _id: crypto.randomUUID(),
  tipo,
  descripcion: INCIDENCIA_CONFIG[tipo].label,
  cantidad: '1',
  dias: '1',
  distancia_km: '',
  monto_unitario: '',
  es_interno: true,
  notas: '',
});

const nuevoItem = (): ItemForm => ({
  _id: crypto.randomUUID(),
  descripcion: '',
  detalle: '',
  cantidad: '1',
  unidad_medida: 'UN',
  precio_unitario: '',
  costo_unitario: '',
  descuento_pct: '0',
});

const initialCabecera: CabeceraForm = {
  cliente_id: '',
  titulo: '',
  objetivo_servicio: '',
  tipo_operacion: 'SERVICIO',
  descripcion: '',
  fecha_vencimiento: '',
  descuento_pct: '0',
  iva_pct: '21',
  condiciones_pago: '',
  tiempo_ejecucion: '',
  garantia: '',
  notas_internas: '',
  notas_cliente: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const n = (s: string): number => parseFloat(s) || 0;

function subtotalItem(it: ItemForm): number {
  return redondear(
    n(it.cantidad) * n(it.precio_unitario) * (1 - n(it.descuento_pct) / 100),
  );
}

function subtotalIncidencia(inc: IncidenciaForm): number {
  return redondear(n(inc.cantidad) * n(inc.dias) * n(inc.monto_unitario));
}

function uid(): string {
  return crypto.randomUUID().slice(0, 8);
}

// ─── Estilos base (Tailwind class strings) ────────────────────────────────────

const cardClass =
  'bg-slate-900/70 border border-slate-400/10 rounded-xl backdrop-blur-sm';

// Base input Tailwind class used by textarea and direct inputs
const inputClass =
  'w-full px-3 py-[9px] bg-slate-950/60 border border-slate-400/10 rounded-lg text-slate-200 text-[13px] outline-none transition-colors';

const labelClass =
  'text-xs font-semibold tracking-widest uppercase text-slate-600 mb-[5px] block';

// ─── Subcomponentes de UI ─────────────────────────────────────────────────────

function Field({
  label,
  error,
  required,
  hint,
  children,
}: {
  label?: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className='flex flex-col gap-1'>
      {label && (
        <label
          className={`${labelClass} ${error ? 'text-amber-500' : 'text-slate-600'}`}
        >
          {label}
          {required && (
            <span className='text-amber-500 ml-[3px]'>●</span>
          )}
        </label>
      )}
      {children}
      {hint && !error && (
        <span className='text-xs text-slate-400'>{hint}</span>
      )}
      {error && (
        <span className='text-xs text-amber-500 flex items-center gap-1'>
          <svg width='9' height='9' viewBox='0 0 9 9'>
            <circle cx='4.5' cy='4.5' r='4' stroke='#f59e0b' fill='none' />
            <line
              x1='4.5'
              y1='3'
              x2='4.5'
              y2='5.5'
              stroke='#f59e0b'
              strokeWidth='1.1'
              strokeLinecap='round'
            />
            <circle cx='4.5' cy='6.5' r='.5' fill='#f59e0b' />
          </svg>
          {error}
        </span>
      )}
    </div>
  );
}

function Inp({
  value,
  onChange,
  placeholder,
  type = 'text',
  className: extraClass,
  error,
  onFocus,
  onBlur,
  ...rest
}: {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  error?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  min?: string;
  max?: string;
  step?: string;
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? 'border-amber-500/50'
    : focused
      ? 'border-amber-500/35'
      : 'border-slate-400/10';
  const shadowClass = focused ? 'shadow-[0_0_0_3px_rgba(245,158,11,0.06)]' : '';
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => {
        setFocused(false);
        onBlur?.();
      }}
      className={`${inputClass} ${borderColor} ${shadowClass}${extraClass ? ` ${extraClass}` : ''}`}
      {...rest}
    />
  );
}

function Sel({
  value,
  onChange,
  children,
  className: extraClass,
}: {
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = focused ? 'border-amber-500/35' : 'border-slate-400/10';
  return (
    <div className='relative'>
      <select
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`${inputClass} appearance-none cursor-pointer pr-7 ${borderColor}${extraClass ? ` ${extraClass}` : ''}`}
      >
        {children}
      </select>
      <svg
        width='10'
        height='10'
        viewBox='0 0 10 10'
        fill='none'
        className='absolute right-[9px] top-1/2 -translate-y-1/2 pointer-events-none text-slate-600'
      >
        <path
          d='M2 4L5 7L8 4'
          stroke='currentColor'
          strokeWidth='1.3'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  count,
  onAdd,
  addLabel,
}: {
  icon: ReactNode;
  title: string;
  count?: number;
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <div className='flex items-center justify-between mb-4'>
      <div className='flex items-center gap-2'>
        <span className='text-slate-500 flex items-center'>{icon}</span>
        <span className='text-[13px] font-bold text-slate-400'>
          {title}
        </span>
        {count !== undefined && count > 0 && (
          <span className='text-xs font-bold text-slate-600 bg-slate-400/[0.08] border border-slate-400/[0.12] rounded-[20px] px-[7px] py-[1px]'>
            {count}
          </span>
        )}
      </div>
      {onAdd && (
        <button
          onClick={onAdd}
          className='flex items-center gap-[5px] px-3 py-1.5 rounded-[7px] border border-amber-500/25 bg-amber-500/[0.06] text-amber-500 text-xs font-semibold cursor-pointer transition-all duration-150'
        >
          <svg width='11' height='11' viewBox='0 0 11 11'>
            <path
              d='M5.5 1V10M1 5.5H10'
              stroke='currentColor'
              strokeWidth='1.6'
              strokeLinecap='round'
            />
          </svg>
          {addLabel ?? 'Agregar'}
        </button>
      )}
    </div>
  );
}

function MontoDisplay({
  label,
  value,
  size = 'sm',
  accent = false,
  total = false,
}: {
  label: string;
  value: number;
  size?: 'sm' | 'md' | 'lg';
  accent?: boolean;
  total?: boolean;
}) {
  const sizeClass =
    size === 'lg' ? 'text-base' : size === 'md' ? 'text-[13px]' : 'text-xs';
  const labelColorClass = total ? 'text-slate-400' : 'text-slate-600';
  const labelWeightClass = total ? 'font-semibold' : 'font-normal';
  const valueColorClass = total
    ? 'text-amber-500'
    : accent
      ? 'text-emerald-400'
      : 'text-slate-500';
  const valueWeightClass = total ? 'font-bold' : 'font-medium';
  const paddingClass = total ? 'py-2.5' : 'py-[5px]';
  const borderClass = total ? 'border-t border-slate-400/10' : '';
  return (
    <div
      className={`flex justify-between items-center ${paddingClass} ${borderClass}`}
    >
      <span className={`text-xs ${labelColorClass} ${labelWeightClass}`}>
        {label}
      </span>
      <span className={`${sizeClass} ${valueColorClass} ${valueWeightClass}`}>
        {formatearMonto(value)}
      </span>
    </div>
  );
}

// ─── Sección: Cabecera ────────────────────────────────────────────────────────

function SeccionCabecera({
  data,
  onChange,
  errors,
  clientes,
  loadingClientes,
}: {
  data: CabeceraForm;
  onChange: <K extends keyof CabeceraForm>(k: K, v: CabeceraForm[K]) => void;
  errors: FormErrors;
  clientes: ClienteListaItem[];
  loadingClientes: boolean;
}) {
  const set =
    <K extends keyof CabeceraForm>(k: K) =>
    (
      e: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      onChange(k, e.target.value as CabeceraForm[K]);

  return (
    <div className='flex flex-col gap-4'>
      {/* Tipo de operación */}
      <div>
        <label className={`${labelClass} text-slate-600`}>
          Tipo de operación <span className='text-amber-500'>●</span>
        </label>
        <div className='flex gap-2 flex-wrap'>
          {TIPOS_OPERACION.map((t) => (
            <button
              key={t.value}
              onClick={() => onChange('tipo_operacion', t.value)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 ${
                data.tipo_operacion === t.value
                  ? 'border border-amber-500/50 bg-amber-500/[0.08] text-amber-500'
                  : 'border border-slate-400/10 bg-slate-950/40 text-slate-600'
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        {/* Cliente */}
        <div className='col-span-full'>
          <Field label='Cliente' required error={errors.cliente_id}>
            <Sel
              value={data.cliente_id}
              onChange={(e) => onChange('cliente_id', e.target.value)}
            >
              <option value=''>
                {loadingClientes ? 'Cargando...' : 'Seleccionar cliente...'}
              </option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.razon_social}
                  {c.cuit ? ` — ${c.cuit}` : ''}
                </option>
              ))}
            </Sel>
          </Field>
        </div>

        {/* Título */}
        <div className='col-span-full'>
          <Field label='Título del presupuesto' required error={errors.titulo}>
            <Inp
              value={data.titulo}
              onChange={set('titulo')}
              placeholder='Ej: Instalación sistema HVAC Planta Norte'
              error={errors.titulo}
            />
          </Field>
        </div>

        {/* Objetivo */}
        <div className='col-span-full'>
          <Field
            label='Objetivo del servicio'
            required
            error={errors.objetivo_servicio}
          >
            <textarea
              value={data.objetivo_servicio}
              onChange={set('objetivo_servicio')}
              placeholder='Descripción técnica del objetivo a cumplir...'
              rows={3}
              className={`${inputClass} resize-y leading-relaxed min-h-[70px]`}
            />
          </Field>
        </div>

        {/* Descripción */}
        <div className='col-span-full'>
          <Field label='Descripción / Alcance'>
            <textarea
              value={data.descripcion}
              onChange={set('descripcion')}
              placeholder='Descripción detallada del alcance del trabajo...'
              rows={3}
              className={`${inputClass} resize-y leading-relaxed min-h-[70px]`}
            />
          </Field>
        </div>

        <Field label='Fecha de vencimiento'>
          <Inp
            type='date'
            value={data.fecha_vencimiento}
            onChange={set('fecha_vencimiento')}
          />
        </Field>

        <Field label='Tiempo de ejecución'>
          <Inp
            value={data.tiempo_ejecucion}
            onChange={set('tiempo_ejecucion')}
            placeholder='Ej: 15 días hábiles'
          />
        </Field>

        <Field label='Condiciones de pago'>
          <Inp
            value={data.condiciones_pago}
            onChange={set('condiciones_pago')}
            placeholder='Ej: 50% anticipo, 50% a entrega'
          />
        </Field>

        <Field label='Garantía'>
          <Inp
            value={data.garantia}
            onChange={set('garantia')}
            placeholder='Ej: 12 meses de garantía'
          />
        </Field>
      </div>

      {/* Notas */}
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <Field label='Notas para el cliente' hint='Visible en el documento PDF'>
          <textarea
            value={data.notas_cliente}
            onChange={set('notas_cliente')}
            placeholder='Aclaraciones, condiciones especiales...'
            rows={3}
            className={`${inputClass} resize-y leading-relaxed text-xs`}
          />
        </Field>
        <Field label='Notas internas' hint='Solo visible en el sistema'>
          <textarea
            value={data.notas_internas}
            onChange={set('notas_internas')}
            placeholder='Notas de contexto, estrategia de precio...'
            rows={3}
            className={`${inputClass} resize-y leading-relaxed text-xs`}
          />
        </Field>
      </div>
    </div>
  );
}

// ─── Sección: Ítems ───────────────────────────────────────────────────────────

function SeccionItems({
  items,
  onChange,
  onAdd,
  onRemove,
  errors,
}: {
  items: ItemForm[];
  onChange: (idx: number, field: keyof ItemForm, value: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  errors: FormErrors;
}) {
  return (
    <div>
      <SectionHeader
        icon={<ClipboardList className="w-3.5 h-3.5" />}
        title='Ítems'
        count={items.length}
        onAdd={onAdd}
        addLabel='Agregar ítem'
      />

      {items.length === 0 && (
        <div className='p-8 text-center border border-dashed border-slate-400/[0.12] rounded-[10px]'>
          <p className='m-0 text-[13px] text-slate-700'>
            Sin ítems aún — agregá el primer ítem de servicio o producto
          </p>
        </div>
      )}

      {errors.items && (
        <div className='px-3.5 py-2.5 bg-amber-500/[0.06] border border-amber-500/20 rounded-lg mb-3 text-xs text-amber-500'>
          {errors.items}
        </div>
      )}

      <div className='flex flex-col gap-2.5'>
        {items.map((item, idx) => (
          <FilaItem
            key={item._id}
            item={item}
            idx={idx}
            onChange={onChange}
            onRemove={onRemove}
          />
        ))}
      </div>

      {items.length > 0 && (
        <div className='mt-3 flex justify-end'>
          <div className='flex items-center gap-2'>
            <span className='text-xs text-slate-600'>
              Subtotal ítems:
            </span>
            <span className='text-sm font-bold text-slate-200'>
              {formatearMonto(items.reduce((a, it) => a + subtotalItem(it), 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function FilaItem({
  item,
  idx,
  onChange,
  onRemove,
}: {
  item: ItemForm;
  idx: number;
  onChange: (i: number, f: keyof ItemForm, v: string) => void;
  onRemove: (i: number) => void;
}) {
  const [expanded, setExpanded] = useState(idx === 0);
  const subtotal = subtotalItem(item);

  return (
    <div className='bg-slate-950/50 border border-slate-400/[0.08] rounded-[10px] overflow-hidden transition-colors duration-200'>
      {/* Fila principal */}
      <div className='overflow-x-auto'>
        <div
          className='grid grid-cols-[auto_1fr_80px_90px_90px_70px_80px_32px] gap-2 px-3 py-2.5 items-center min-w-[520px]'
        >
          {/* Núm */}
          <div className='w-[22px] h-[22px] rounded-md bg-amber-500/[0.08] border border-amber-500/15 flex items-center justify-center text-xs font-bold text-amber-500'>
            {idx + 1}
          </div>

          {/* Descripción */}
          <Inp
            value={item.descripcion}
            onChange={(e) => onChange(idx, 'descripcion', e.target.value)}
            placeholder='Descripción del ítem...'
            className='text-xs px-2.5 py-[7px]'
          />

          {/* Cantidad */}
          <Inp
            type='number'
            min='0'
            step='0.01'
            value={item.cantidad}
            onChange={(e) => onChange(idx, 'cantidad', e.target.value)}
            placeholder='Cant.'
            className='text-right text-xs px-2 py-[7px]'
          />

          {/* Unidad */}
          <Sel
            value={item.unidad_medida}
            onChange={(e) => onChange(idx, 'unidad_medida', e.target.value)}
            className='text-xs px-2 py-[7px] pr-6'
          >
            {UNIDADES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Sel>

          {/* Precio */}
          <Inp
            type='number'
            min='0'
            step='0.01'
            value={item.precio_unitario}
            onChange={(e) => onChange(idx, 'precio_unitario', e.target.value)}
            placeholder='Precio'
            className='text-right text-xs px-2 py-[7px]'
          />

          {/* Descuento */}
          <div className='relative'>
            <Inp
              type='number'
              min='0'
              max='100'
              step='0.5'
              value={item.descuento_pct}
              onChange={(e) => onChange(idx, 'descuento_pct', e.target.value)}
              placeholder='0'
              className='text-right text-xs px-2 py-[7px] pr-5'
            />
            <span className='absolute right-[7px] top-1/2 -translate-y-1/2 text-xs text-slate-600 pointer-events-none'>
              %
            </span>
          </div>

          {/* Subtotal */}
          <div
            className={`text-right text-xs font-semibold ${subtotal > 0 ? 'text-slate-400' : 'text-slate-700'}`}
          >
            {subtotal > 0 ? formatearMonto(subtotal) : '—'}
          </div>

          {/* Acciones */}
          <div className='flex gap-[3px] justify-end'>
            <button
              onClick={() => setExpanded((p) => !p)}
              className={`w-[26px] h-[26px] rounded-md border border-slate-400/[0.08] bg-transparent cursor-pointer flex items-center justify-center transition-all duration-[120ms] ${expanded ? 'text-amber-500' : 'text-slate-700'}`}
            >
              <svg width='12' height='12' viewBox='0 0 12 12'>
                <path
                  d={expanded ? 'M2 8L6 4L10 8' : 'M2 4L6 8L10 4'}
                  stroke='currentColor'
                  strokeWidth='1.4'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              </svg>
            </button>
            <button
              onClick={() => onRemove(idx)}
              className='w-[26px] h-[26px] rounded-md border border-slate-400/[0.08] bg-transparent cursor-pointer flex items-center justify-center transition-all duration-[120ms] text-slate-600 hover:text-red-400'
            >
              <svg width='12' height='12' viewBox='0 0 12 12'>
                <path
                  d='M2 2L10 10M10 2L2 10'
                  stroke='currentColor'
                  strokeWidth='1.4'
                  strokeLinecap='round'
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Detalle expandido */}
      {expanded && (
        <div
          className='grid grid-cols-1 gap-2.5 sm:grid-cols-2 px-3 pb-3 border-t border-slate-400/[0.05]'
        >
          <Field label='Detalle / especificaciones técnicas'>
            <textarea
              value={item.detalle}
              onChange={(e) => onChange(idx, 'detalle', e.target.value)}
              placeholder='Especificaciones técnicas, marca, modelo...'
              rows={2}
              className={`${inputClass} resize-y text-xs leading-normal`}
            />
          </Field>
          <Field
            label='Costo unitario interno'
            hint='Solo visible en el sistema'
          >
            <div className='relative'>
              <span className='absolute left-[10px] top-1/2 -translate-y-1/2 text-xs text-slate-700 pointer-events-none'>
                $
              </span>
              <Inp
                type='number'
                min='0'
                step='0.01'
                value={item.costo_unitario}
                onChange={(e) =>
                  onChange(idx, 'costo_unitario', e.target.value)
                }
                placeholder='0.00'
                className='text-right text-xs pl-[22px]'
              />
            </div>
          </Field>
        </div>
      )}
    </div>
  );
}

// ─── Sección: Incidencias ─────────────────────────────────────────────────────

function SeccionIncidencias({
  incidencias,
  onChange,
  onAdd,
  onRemove,
}: {
  incidencias: IncidenciaForm[];
  onChange: (
    idx: number,
    field: keyof IncidenciaForm,
    value: string | boolean,
  ) => void;
  onAdd: (tipo: TipoIncidencia) => void;
  onRemove: (idx: number) => void;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <div>
      <div className='flex items-center justify-between mb-4'>
        <div className='flex items-center gap-2'>
          <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
          <span className='text-[13px] font-bold text-slate-400'>
            Incidencias
          </span>
          {incidencias.length > 0 && (
            <span className='text-xs font-bold text-slate-600 bg-slate-400/[0.08] border border-slate-400/[0.12] rounded-[20px] px-[7px] py-[1px]'>
              {incidencias.length}
            </span>
          )}
        </div>
        <div className='relative'>
          <button
            onClick={() => setMenuAbierto((p) => !p)}
            className='flex items-center gap-[5px] px-3 py-1.5 rounded-[7px] border border-amber-500/25 bg-amber-500/[0.06] text-amber-500 text-xs font-semibold cursor-pointer transition-all duration-150'
          >
            <svg width='11' height='11' viewBox='0 0 11 11'>
              <path
                d='M5.5 1V10M1 5.5H10'
                stroke='currentColor'
                strokeWidth='1.6'
                strokeLinecap='round'
              />
            </svg>
            Agregar
          </button>
          {menuAbierto && (
            <div className='absolute right-0 top-full mt-1 bg-slate-900 border border-slate-400/[0.12] rounded-[10px] p-1 min-w-[200px] z-20 shadow-[0_8px_24px_rgba(0,0,0,0.4)] [animation:scaleIn_0.12s_ease]'>
              {(
                Object.entries(INCIDENCIA_CONFIG) as [
                  TipoIncidencia,
                  (typeof INCIDENCIA_CONFIG)[TipoIncidencia],
                ][]
              ).map(([tipo, cfg]) => (
                <button
                  key={tipo}
                  onClick={() => {
                    onAdd(tipo);
                    setMenuAbierto(false);
                  }}
                  className='flex items-center gap-2 w-full px-2.5 py-[7px] rounded-[7px] border-none bg-transparent text-slate-400 text-xs cursor-pointer text-left transition-colors duration-100 hover:bg-slate-400/[0.06] hover:text-slate-200'
                >
                  <span className='flex items-center'>{cfg.icon}</span>
                  <span className={`font-medium ${cfg.textCls}`}>
                    {cfg.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className='mb-3 px-3.5 py-2.5 bg-indigo-500/[0.04] border border-indigo-500/10 rounded-lg text-xs text-slate-600 leading-normal'>
        <span className='text-violet-300 font-semibold'>Incidencias</span>{' '}
        — costos operativos del servicio: traslados, viáticos, hospedaje,
        combustible, etc. Las marcadas como{' '}
        <span className='text-slate-400'>internas</span> afectan el costo pero
        no se muestran al cliente.
      </div>

      {incidencias.length === 0 && (
        <div className='p-7 text-center border border-dashed border-slate-400/10 rounded-[10px]'>
          <p className='m-0 text-[13px] text-slate-700'>
            Sin incidencias — el presupuesto no incluye costos operativos
            adicionales
          </p>
        </div>
      )}

      <div className='flex flex-col gap-2'>
        {incidencias.map((inc, idx) => (
          <FilaIncidencia
            key={inc._id}
            inc={inc}
            idx={idx}
            onChange={onChange}
            onRemove={onRemove}
          />
        ))}
      </div>

      {incidencias.length > 0 && (
        <div className='mt-3 flex justify-end'>
          <div className='flex items-center gap-2'>
            <span className='text-xs text-slate-600'>
              Subtotal incidencias:
            </span>
            <span className='text-sm font-bold text-slate-200'>
              {formatearMonto(
                incidencias.reduce((a, i) => a + subtotalIncidencia(i), 0),
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function FilaIncidencia({
  inc,
  idx,
  onChange,
  onRemove,
}: {
  inc: IncidenciaForm;
  idx: number;
  onChange: (i: number, f: keyof IncidenciaForm, v: string | boolean) => void;
  onRemove: (i: number) => void;
}) {
  const cfg = INCIDENCIA_CONFIG[inc.tipo];
  const subtotal = subtotalIncidencia(inc);
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={`bg-slate-950/50 rounded-[10px] overflow-hidden border ${cfg.badgeCls}`}>
      <div className='overflow-x-auto'>
        <div
          className='grid grid-cols-[auto_32px_1fr_80px_70px_70px_80px_80px_32px] gap-2 px-3 py-2.5 items-center min-w-[600px]'
        >
          {/* Tipo badge */}
          <div className={`flex items-center gap-[5px] px-2 py-[3px] rounded-md whitespace-nowrap border ${cfg.badgeCls}`}>
            <span className='flex items-center'>{cfg.icon}</span>
            <span className={`text-xs font-bold tracking-wide ${cfg.textCls}`}>
              {cfg.label}
            </span>
          </div>

          {/* Núm */}
          <div className='w-[22px] h-[22px] rounded-md bg-slate-400/[0.06] border border-slate-400/10 flex items-center justify-center text-xs font-bold text-slate-600'>
            {idx + 1}
          </div>

          {/* Descripción */}
          <Inp
            value={inc.descripcion}
            onChange={(e) => onChange(idx, 'descripcion', e.target.value)}
            placeholder='Descripción...'
            className='text-xs px-2.5 py-[7px]'
          />

          {/* Cantidad */}
          <div>
            <Inp
              type='number'
              min='0'
              step='1'
              value={inc.cantidad}
              onChange={(e) => onChange(idx, 'cantidad', e.target.value)}
              placeholder='Cant.'
              className='text-right text-xs px-2 py-[7px]'
            />
          </div>

          {/* Días (si aplica) */}
          <div>
            {cfg.usaDias ? (
              <div className='relative'>
                <Inp
                  type='number'
                  min='1'
                  step='1'
                  value={inc.dias}
                  onChange={(e) => onChange(idx, 'dias', e.target.value)}
                  placeholder='Días'
                  className='text-right text-xs px-2 py-[7px] pr-[22px]'
                />
                <span className='absolute right-[6px] top-1/2 -translate-y-1/2 text-[9px] text-slate-600 pointer-events-none'>
                  d
                </span>
              </div>
            ) : (
              <div className='h-[34px] flex items-center justify-center'>
                <span className='text-xs text-slate-800'>—</span>
              </div>
            )}
          </div>

          {/* Km (si aplica) */}
          <div>
            {cfg.usaKm ? (
              <div className='relative'>
                <Inp
                  type='number'
                  min='0'
                  step='1'
                  value={inc.distancia_km}
                  onChange={(e) =>
                    onChange(idx, 'distancia_km', e.target.value)
                  }
                  placeholder='km'
                  className='text-right text-xs px-2 py-[7px] pr-[22px]'
                />
                <span className='absolute right-[6px] top-1/2 -translate-y-1/2 text-[9px] text-slate-600 pointer-events-none'>
                  km
                </span>
              </div>
            ) : (
              <div className='h-[34px] flex items-center justify-center'>
                <span className='text-xs text-slate-800'>—</span>
              </div>
            )}
          </div>

          {/* Monto unitario */}
          <div className='relative'>
            <span className='absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-700 pointer-events-none'>
              $
            </span>
            <Inp
              type='number'
              min='0'
              step='0.01'
              value={inc.monto_unitario}
              onChange={(e) => onChange(idx, 'monto_unitario', e.target.value)}
              placeholder='0.00'
              className='text-right text-xs px-2 py-[7px] pl-[18px]'
            />
          </div>

          {/* Subtotal */}
          <div
            className={`text-right text-xs font-semibold ${subtotal > 0 ? 'text-slate-400' : 'text-slate-700'}`}
          >
            {subtotal > 0 ? formatearMonto(subtotal) : '—'}
          </div>

          {/* Botones */}
          <div className='flex gap-[3px]'>
            <button
              onClick={() => setExpanded((p) => !p)}
              className={`w-[26px] h-[26px] rounded-md border border-slate-400/[0.08] bg-transparent cursor-pointer flex items-center justify-center transition-all duration-[120ms] ${expanded ? 'text-amber-500' : 'text-slate-700'}`}
            >
              <svg width='12' height='12' viewBox='0 0 12 12'>
                <path
                  d={expanded ? 'M2 8L6 4L10 8' : 'M2 4L6 8L10 4'}
                  stroke='currentColor'
                  strokeWidth='1.4'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              </svg>
            </button>
            <button
              onClick={() => onRemove(idx)}
              className='w-[26px] h-[26px] rounded-md border border-slate-400/[0.08] bg-transparent cursor-pointer flex items-center justify-center transition-all duration-[120ms] text-slate-600 hover:text-red-400'
            >
              <svg width='12' height='12' viewBox='0 0 12 12'>
                <path
                  d='M2 2L10 10M10 2L2 10'
                  stroke='currentColor'
                  strokeWidth='1.4'
                  strokeLinecap='round'
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Toggle interno / externo */}
      {expanded && (
        <div
          className='flex flex-col gap-3 sm:flex-row sm:items-center px-3 pb-2.5 border-t border-slate-400/[0.05]'
        >
          <label className='flex items-center gap-[7px] cursor-pointer'>
            <div
              onClick={() => onChange(idx, 'es_interno', !inc.es_interno)}
              className={`relative cursor-pointer transition-all duration-200 shrink-0 w-8 h-[18px] rounded-[9px] border ${inc.es_interno ? 'bg-amber-500/40 border-amber-500/50' : 'bg-slate-400/[0.12] border-slate-400/15'}`}
            >
              <div
                className={`absolute top-[2px] w-3 h-3 rounded-full transition-all duration-200 ${inc.es_interno ? 'left-[15px] bg-amber-500' : 'left-[2px] bg-slate-600'}`}
              />
            </div>
            <span
              className={`text-xs font-medium ${inc.es_interno ? 'text-amber-500' : 'text-slate-600'}`}
            >
              {inc.es_interno
                ? 'Incidencia interna (solo costo)'
                : 'Incidencia externa (visible al cliente)'}
            </span>
          </label>
          {inc.notas !== undefined && (
            <Inp
              value={inc.notas}
              onChange={(e) => onChange(idx, 'notas', e.target.value)}
              placeholder='Notas opcionales...'
              className='text-xs px-2.5 py-[5px] flex-1'
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Panel de totales ─────────────────────────────────────────────────────────

function PanelTotales({
  items,
  incidencias,
  cabecera,
  onChangeCabecera,
}: {
  items: ItemForm[];
  incidencias: IncidenciaForm[];
  cabecera: CabeceraForm;
  onChangeCabecera: <K extends keyof CabeceraForm>(
    k: K,
    v: CabeceraForm[K],
  ) => void;
}) {
  const dtos: CrearPresupuestoItemDTO[] = items.map((it) => ({
    descripcion: it.descripcion || '—',
    cantidad: n(it.cantidad),
    precio_unitario: n(it.precio_unitario),
    descuento_pct: n(it.descuento_pct),
    costo_unitario: n(it.costo_unitario) || undefined,
    unidad_medida: it.unidad_medida,
  }));

  const incDtos: CrearPresupuestoIncidenciaDTO[] = incidencias.map((inc) => ({
    tipo: inc.tipo,
    descripcion: inc.descripcion,
    cantidad: n(inc.cantidad),
    dias: n(inc.dias) || 1,
    distancia_km: n(inc.distancia_km) || undefined,
    monto_unitario: n(inc.monto_unitario),
    es_interno: inc.es_interno,
  }));

  const totales = calcularTotalesPresupuesto(dtos, incDtos, {
    descuento_pct: n(cabecera.descuento_pct),
    iva_pct: n(cabecera.iva_pct),
  });

  const margenCls =
    totales.margen_pct >= 30 ? 'text-green-400' : totales.margen_pct >= 10 ? 'text-amber-500' : 'text-red-400';
  const margenBarCls =
    totales.margen_pct >= 30 ? 'bg-green-400' : totales.margen_pct >= 10 ? 'bg-amber-500' : 'bg-red-400';

  return (
    <div className={`${cardClass} p-4 lg:p-3 xl:sticky xl:top-4`}>
      <div className='flex items-center gap-[7px] mb-[18px]'>
        <span className='text-[13px]'>🧮</span>
        <span className='text-xs font-bold text-slate-500 tracking-[0.06em] uppercase'>
          Resumen
        </span>
      </div>

      {/* Cliente seleccionado */}
      {cabecera.titulo && (
        <div className='px-3 py-2.5 bg-amber-500/[0.05] border border-amber-500/[0.12] rounded-lg mb-4'>
          <div className='text-xs text-slate-600 mb-[2px]'>
            Presupuesto
          </div>
          <div className='text-xs font-semibold text-slate-300 leading-[1.4]'>
            {cabecera.titulo}
          </div>
        </div>
      )}

      {/* Ítems e incidencias */}
      <div className='flex flex-col gap-[2px] mb-3'>
        <MontoDisplay
          label={`Ítems (${items.length})`}
          value={totales.subtotal_items}
        />
        {incidencias.filter((i) => !i.es_interno).length > 0 && (
          <MontoDisplay
            label={`Incidencias externas (${incidencias.filter((i) => !i.es_interno).length})`}
            value={incidencias
              .filter((i) => !i.es_interno)
              .reduce((a, i) => a + subtotalIncidencia(i), 0)}
          />
        )}
        {incidencias.filter((i) => i.es_interno).length > 0 && (
          <div className='flex justify-between items-center py-1'>
            <span className='text-xs text-slate-700 flex items-center gap-1'>
              <span>
                Incidencias internas (
                {incidencias.filter((i) => i.es_interno).length})
              </span>
              <span className='bg-slate-400/[0.08] border border-slate-400/[0.12] rounded px-1 text-[9px]'>
                interno
              </span>
            </span>
            <span className='text-xs text-slate-700'>
              {formatearMonto(
                incidencias
                  .filter((i) => i.es_interno)
                  .reduce((a, i) => a + subtotalIncidencia(i), 0),
              )}
            </span>
          </div>
        )}
      </div>

      {/* Descuento global */}
      <div className='flex items-center gap-2 mb-2'>
        <span className='text-xs text-slate-600 whitespace-nowrap'>
          Descuento global
        </span>
        <div className='relative flex-1'>
          <Inp
            type='number'
            min='0'
            max='100'
            step='0.5'
            value={cabecera.descuento_pct}
            onChange={(e) => onChangeCabecera('descuento_pct', e.target.value)}
            className='text-right text-xs px-2 py-[5px] pr-5'
          />
          <span className='absolute right-[7px] top-1/2 -translate-y-1/2 text-xs text-slate-600 pointer-events-none'>
            %
          </span>
        </div>
      </div>

      {/* IVA */}
      <div className='flex items-center gap-2 mb-4'>
        <span className='text-xs text-slate-600 whitespace-nowrap'>IVA</span>
        <div className='flex gap-1 flex-1'>
          {IVA_OPCIONES.map((pct) => (
            <button
              key={pct}
              onClick={() => onChangeCabecera('iva_pct', String(pct))}
              className={`flex-1 py-[5px] px-1 rounded-[5px] cursor-pointer text-xs font-semibold transition-all duration-150 ${
                n(cabecera.iva_pct) === pct
                  ? 'border border-amber-500/40 bg-amber-500/[0.08] text-amber-500'
                  : 'border border-slate-400/10 bg-transparent text-slate-600'
              }`}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Totales */}
      <div className='border-t border-slate-400/[0.08] pt-2.5'>
        {n(cabecera.descuento_pct) > 0 && (
          <MontoDisplay
            label={`Descuento (${cabecera.descuento_pct}%)`}
            value={-totales.descuento_monto}
          />
        )}
        <MontoDisplay label='Subtotal sin IVA' value={totales.subtotal} />
        <MontoDisplay
          label={`IVA ${cabecera.iva_pct}%`}
          value={totales.iva_monto}
        />
        <MontoDisplay label='TOTAL' value={totales.total} size='lg' total />
      </div>

      {/* Margen interno */}
      <div className='mt-[14px] p-3 bg-slate-950/50 border border-slate-400/[0.07] rounded-lg'>
        <div className='text-xs text-slate-700 font-semibold uppercase tracking-widest mb-2'>
          Análisis interno
        </div>
        <div className='flex flex-col gap-1'>
          <div className='flex justify-between'>
            <span className='text-xs text-slate-700'>Costo estimado</span>
            <span className='text-xs text-slate-700'>
              {formatearMonto(totales.costo_total)}
            </span>
          </div>
          <div className='flex justify-between'>
            <span className='text-xs text-slate-600'>Margen bruto</span>
            <span className={`text-xs font-semibold ${margenCls}`}>
              {formatearMonto(totales.margen_monto)} (
              {totales.margen_pct.toFixed(1)}%)
            </span>
          </div>
          {/* Barra de margen */}
          <div className='h-1 bg-slate-400/[0.08] rounded-sm mt-1 overflow-hidden'>
            <div
              className={`h-full rounded-sm transition-all duration-300 ${margenBarCls} w-[${Math.min(100, Math.max(0, totales.margen_pct))}%]`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PresupuestoBuilder() {
  const [cabecera, setCabecera] = useState<CabeceraForm>(initialCabecera);
  const [items, setItems] = useState<ItemForm[]>([nuevoItem()]);
  const [incidencias, setIncidencias] = useState<IncidenciaForm[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [tabActiva, setTabActiva] = useState<TabActiva>('cabecera');
  const [clientes, setClientes] = useState<ClienteListaItem[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(true);

  // Cargar clientes al montar
  useEffect(() => {
    obtenerClientes({
      activo: true,
      por_pagina: 100,
      orden_por: 'razon_social',
      orden_dir: 'asc',
    }).then((res) => {
      if (res.data) setClientes(res.data.data);
      setLoadingClientes(false);
    });
  }, []);

  // ── Handlers cabecera ──────────────────────────────────────────

  const setCab = useCallback(
    <K extends keyof CabeceraForm>(k: K, v: CabeceraForm[K]) => {
      setCabecera((prev) => ({ ...prev, [k]: v }));
      if (errors[k])
        setErrors((prev) => {
          const e = { ...prev };
          delete e[k];
          return e;
        });
    },
    [errors],
  );

  // ── Handlers ítems ────────────────────────────────────────────

  const handleItemChange = useCallback(
    (idx: number, field: keyof ItemForm, value: string) => {
      setItems((prev) =>
        prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)),
      );
    },
    [],
  );

  const handleAddItem = useCallback(() => {
    setItems((prev) => [...prev, nuevoItem()]);
    setTabActiva('items');
  }, []);

  const handleRemoveItem = useCallback((idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ── Handlers incidencias ──────────────────────────────────────

  const handleIncidenciaChange = useCallback(
    (idx: number, field: keyof IncidenciaForm, value: string | boolean) => {
      setIncidencias((prev) =>
        prev.map((inc, i) => (i === idx ? { ...inc, [field]: value } : inc)),
      );
    },
    [],
  );

  const handleAddIncidencia = useCallback((tipo: TipoIncidencia) => {
    setIncidencias((prev) => [...prev, nuevaIncidencia(tipo)]);
    setTabActiva('incidencias');
  }, []);

  const handleRemoveIncidencia = useCallback((idx: number) => {
    setIncidencias((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ── Validación ────────────────────────────────────────────────

  const validar = (): boolean => {
    const e: FormErrors = {};
    if (!cabecera.cliente_id) e.cliente_id = 'Seleccioná un cliente';
    if (!cabecera.titulo.trim()) e.titulo = 'El título es requerido';
    if (!cabecera.objetivo_servicio.trim())
      e.objetivo_servicio = 'El objetivo es requerido';
    if (items.length === 0) e.items = 'Agregá al menos un ítem';
    if (items.some((it) => !it.descripcion.trim()))
      e.items = 'Todos los ítems deben tener descripción';
    if (items.some((it) => !it.precio_unitario || n(it.precio_unitario) <= 0))
      e.items = 'Todos los ítems deben tener precio mayor a 0';
    setErrors(e);
    if (Object.keys(e).length > 0) {
      if (e.cliente_id || e.titulo || e.objetivo_servicio)
        setTabActiva('cabecera');
      else if (e.items) setTabActiva('items');
    }
    return Object.keys(e).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────

  const handleSubmit = async (estado: 'borrador' | 'enviar') => {
    if (!validar()) return;
    setSubmitting(true);

    const dto: CrearPresupuestoDTO = {
      cliente_id: cabecera.cliente_id,
      titulo: cabecera.titulo,
      objetivo_servicio: cabecera.objetivo_servicio,
      tipo_operacion: cabecera.tipo_operacion,
      descripcion: cabecera.descripcion || undefined,
      fecha_vencimiento: cabecera.fecha_vencimiento || undefined,
      descuento_pct: n(cabecera.descuento_pct),
      iva_pct: n(cabecera.iva_pct),
      condiciones_pago: cabecera.condiciones_pago || undefined,
      tiempo_ejecucion: cabecera.tiempo_ejecucion || undefined,
      garantia: cabecera.garantia || undefined,
      notas_internas: cabecera.notas_internas || undefined,
      notas_cliente: cabecera.notas_cliente || undefined,
      items: items.map((it) => ({
        descripcion: it.descripcion,
        detalle: it.detalle || undefined,
        cantidad: n(it.cantidad),
        unidad_medida: it.unidad_medida,
        precio_unitario: n(it.precio_unitario),
        costo_unitario: n(it.costo_unitario) || undefined,
        descuento_pct: n(it.descuento_pct),
      })),
      incidencias: incidencias.map((inc) => ({
        tipo: inc.tipo,
        descripcion: inc.descripcion,
        cantidad: n(inc.cantidad),
        dias: n(inc.dias) || 1,
        distancia_km: n(inc.distancia_km) || undefined,
        monto_unitario: n(inc.monto_unitario),
        es_interno: inc.es_interno,
        notas: inc.notas || undefined,
      })),
    };

    try {
      const result = await crearPresupuesto(dto);
      if (result.error) {
        setErrors({ _global: result.mensaje ?? result.error });
      } else {
        setSubmitted(true);
      }
    } catch (err) {
      setErrors({ _global: 'Error inesperado. Intentá de nuevo.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Tabs ──────────────────────────────────────────────────────

  const TABS: {
    id: TabActiva;
    label: string;
    icon: ReactNode;
    badge?: number;
    hasError?: boolean;
  }[] = [
    {
      id: 'cabecera',
      label: 'Cabecera',
      icon: <PenLine className="w-3.5 h-3.5" />,
      hasError: !!(
        errors.cliente_id ||
        errors.titulo ||
        errors.objetivo_servicio
      ),
    },
    {
      id: 'items',
      label: 'Ítems',
      icon: <ClipboardList className="w-3.5 h-3.5" />,
      badge: items.length,
      hasError: !!errors.items,
    },
    {
      id: 'incidencias',
      label: 'Incidencias',
      icon: <BarChart3 className="w-3.5 h-3.5" />,
      badge: incidencias.length,
    },
    { id: 'condiciones', label: 'Condiciones', icon: <FileText className="w-3.5 h-3.5" /> },
  ];

  if (submitted)
    return (
      <PantallaExito
        onNuevo={() => {
          setCabecera(initialCabecera);
          setItems([nuevoItem()]);
          setIncidencias([]);
          setSubmitted(false);
        }}
      />
    );

  return (
    <>
      <div
        className='min-h-screen px-3 py-5 pb-20 sm:px-5 sm:py-8 lg:px-6 bg-slate-950 bg-gradient-to-b from-amber-950/5 to-slate-950'
      >
        <div className='max-w-[1280px] mx-auto'>
          {/* Header */}
          <div className='mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between lg:mb-3'>
            <div>
              <div className='flex items-center gap-2 mb-1'>
                <span className='text-xs text-slate-700 tracking-widest uppercase'>
                  Presupuestos
                </span>
                <span className='text-slate-800'>›</span>
                <span className='text-xs text-slate-600 tracking-widest uppercase'>
                  Nuevo
                </span>
              </div>
              <h1 className='m-0 text-[22px] font-bold text-slate-200 tracking-tight'>
                Nuevo Presupuesto
              </h1>
            </div>
            <div className='flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap'>
              <button
                onClick={() => handleSubmit('borrador')}
                disabled={submitting}
                className={`w-full sm:w-auto px-[18px] py-[9px] rounded-[9px] border border-slate-400/15 bg-slate-900/80 text-slate-500 text-[13px] font-semibold transition-all duration-150 ${submitting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                Guardar borrador
              </button>
              <button
                onClick={() => handleSubmit('enviar')}
                disabled={submitting}
                className={`w-full sm:w-auto px-5 py-[9px] rounded-[9px] border-0 text-slate-900 text-[13px] font-bold flex items-center justify-center gap-[7px] transition-all duration-150 ${submitting ? 'cursor-not-allowed bg-emerald-600/30 shadow-none' : 'cursor-pointer bg-gradient-to-br from-emerald-600/80 to-emerald-700/80 hover:from-emerald-600 hover:to-emerald-700 shadow-sm shadow-emerald-600/15'}`}
              >
                {submitting && (
                  <svg
                    width='13'
                    height='13'
                    viewBox='0 0 13 13'
                    className='[animation:spin_0.8s_linear_infinite]'
                  >
                    <circle
                      cx='6.5'
                      cy='6.5'
                      r='5'
                      stroke='rgba(15,23,42,0.5)'
                      strokeWidth='1.5'
                      fill='none'
                    />
                    <path
                      d='M6.5 1.5A5 5 0 0 1 11.5 6.5'
                      stroke='#0f172a'
                      strokeWidth='1.5'
                      strokeLinecap='round'
                      fill='none'
                    />
                  </svg>
                )}
                Crear y enviar
              </button>
            </div>
          </div>

          {/* Error global */}
          {errors._global && (
            <div className='mb-4 px-4 py-3 bg-red-500/[0.08] border border-red-500/25 rounded-[10px] text-[13px] text-red-400 [animation:slideUp_0.2s_ease]'>
              {errors._global}
            </div>
          )}

          {/* Layout principal */}
          <div className='grid grid-cols-1 gap-4 lg:gap-3 xl:grid-cols-[1fr_280px] xl:items-start'>
            {/* Panel izquierdo */}
            <div className='flex flex-col gap-4 lg:gap-3'>
              {/* Tabs */}
              <div className={`${cardClass} overflow-hidden`}>
                {/* Tab bar */}
                <div
                  className='flex overflow-x-auto border-b border-slate-400/[0.07] bg-slate-950/30 [scrollbar-width:none]'
                >
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setTabActiva(tab.id)}
                      className={`flex items-center gap-1.5 px-5 py-[13px] border-0 cursor-pointer bg-transparent text-xs font-semibold whitespace-nowrap transition-all duration-150 border-b-2 ${
                        tabActiva === tab.id
                          ? 'text-slate-200 border-b-amber-500'
                          : 'text-slate-700 border-b-transparent'
                      }`}
                    >
                      <span className='flex items-center text-slate-500'>{tab.icon}</span>
                      {tab.label}
                      {tab.badge !== undefined && tab.badge > 0 && (
                        <span
                          className={`text-[9px] font-bold px-[5px] py-[1px] rounded-[10px] ${
                            tabActiva === tab.id
                              ? 'bg-amber-500/15 text-amber-500'
                              : 'bg-slate-400/[0.08] text-slate-600'
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                      {tab.hasError && (
                        <span className='inline-block w-1.5 h-1.5 rounded-full bg-amber-500' />
                      )}
                    </button>
                  ))}
                </div>

                {/* Contenido del tab */}
                <div
                  className='p-4 sm:p-5 lg:max-h-[calc(100vh-230px)] lg:overflow-y-auto lg:p-4 [animation:fadeIn_0.15s_ease]'
                  key={tabActiva}
                >
                  {tabActiva === 'cabecera' && (
                    <SeccionCabecera
                      data={cabecera}
                      onChange={setCab}
                      errors={errors}
                      clientes={clientes}
                      loadingClientes={loadingClientes}
                    />
                  )}
                  {tabActiva === 'items' && (
                    <SeccionItems
                      items={items}
                      onChange={handleItemChange}
                      onAdd={handleAddItem}
                      onRemove={handleRemoveItem}
                      errors={errors}
                    />
                  )}
                  {tabActiva === 'incidencias' && (
                    <SeccionIncidencias
                      incidencias={incidencias}
                      onChange={handleIncidenciaChange}
                      onAdd={handleAddIncidencia}
                      onRemove={handleRemoveIncidencia}
                    />
                  )}
                  {tabActiva === 'condiciones' && (
                    <SeccionCondiciones cabecera={cabecera} onChange={setCab} />
                  )}
                </div>
              </div>

              {/* Accesos rápidos desde ítems */}
              {tabActiva !== 'items' && items.length > 0 && (
                <div className='flex flex-wrap items-center gap-2 px-1'>
                  <span className='text-xs text-slate-700'>
                    Acceso rápido:
                  </span>
                  <button
                    onClick={handleAddItem}
                    className='px-2.5 py-1 rounded-md border border-slate-400/10 bg-slate-900/50 text-slate-600 text-xs cursor-pointer transition-colors duration-150'
                  >
                    + Ítem
                  </button>
                  <button
                    onClick={() => handleAddIncidencia('traslado')}
                    className='px-2.5 py-1 rounded-md border border-slate-400/10 bg-slate-900/50 text-slate-600 text-xs cursor-pointer transition-colors duration-150'
                  >
                    + Traslado
                  </button>
                  <button
                    onClick={() => handleAddIncidencia('viatico')}
                    className='px-2.5 py-1 rounded-md border border-slate-400/10 bg-slate-900/50 text-slate-600 text-xs cursor-pointer transition-colors duration-150'
                  >
                    + Viático
                  </button>
                </div>
              )}
            </div>

            {/* Panel de totales sticky */}
            <PanelTotales
              items={items}
              incidencias={incidencias}
              cabecera={cabecera}
              onChangeCabecera={setCab}
            />
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Sección condiciones (tab 4) ──────────────────────────────────────────────

function SeccionCondiciones({
  cabecera,
  onChange,
}: {
  cabecera: CabeceraForm;
  onChange: <K extends keyof CabeceraForm>(k: K, v: CabeceraForm[K]) => void;
}) {
  const set =
    <K extends keyof CabeceraForm>(k: K) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(k, e.target.value as CabeceraForm[K]);

  return (
    <div className='flex flex-col gap-4'>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <Field label='Condiciones de pago'>
          <textarea
            value={cabecera.condiciones_pago}
            onChange={set('condiciones_pago')}
            placeholder='Ej: 50% anticipo al inicio, 50% a la entrega...'
            rows={3}
            className={`${inputClass} resize-y leading-relaxed text-xs`}
          />
        </Field>
        <Field label='Tiempo de ejecución'>
          <textarea
            value={cabecera.tiempo_ejecucion}
            onChange={set('tiempo_ejecucion')}
            placeholder='Ej: 15 días hábiles a partir del anticipo...'
            rows={3}
            className={`${inputClass} resize-y leading-relaxed text-xs`}
          />
        </Field>
        <Field label='Garantía'>
          <textarea
            value={cabecera.garantia}
            onChange={set('garantia')}
            placeholder='Ej: 12 meses sobre mano de obra y materiales...'
            rows={3}
            className={`${inputClass} resize-y leading-relaxed text-xs`}
          />
        </Field>
        <Field label='Fecha de vencimiento del presupuesto'>
          <Inp
            type='date'
            value={cabecera.fecha_vencimiento}
            onChange={set('fecha_vencimiento')}
          />
          <span className='text-xs text-slate-700 mt-1'>
            Fecha límite para la validez del precio ofrecido
          </span>
        </Field>
      </div>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <Field
          label='Notas para el cliente'
          hint='Visible en el PDF del presupuesto'
        >
          <textarea
            value={cabecera.notas_cliente}
            onChange={set('notas_cliente')}
            placeholder='Aclaraciones, condiciones especiales, alcance...'
            rows={4}
            className={`${inputClass} resize-y leading-relaxed text-xs`}
          />
        </Field>
        <Field label='Notas internas' hint='Solo visible en el sistema'>
          <textarea
            value={cabecera.notas_internas}
            onChange={set('notas_internas')}
            placeholder='Contexto, estrategia de precio, observaciones del equipo...'
            rows={4}
            className={`${inputClass} resize-y leading-relaxed text-xs`}
          />
        </Field>
      </div>
    </div>
  );
}

// ─── Pantalla de éxito ────────────────────────────────────────────────────────

function PantallaExito({ onNuevo }: { onNuevo: () => void }) {
  return (
    <div className='min-h-screen flex items-center justify-center bg-slate-950 flex-col gap-6 p-10'>
      <div className='w-[72px] h-[72px] rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center [animation:scaleIn_0.4s_cubic-bezier(0.34,1.56,0.64,1)]'>
        <svg width='32' height='32' viewBox='0 0 32 32' fill='none'>
          <path
            d='M8 16L13 21L24 10'
            stroke='#4ade80'
            strokeWidth='2.5'
            strokeLinecap='round'
            strokeLinejoin='round'
          />
        </svg>
      </div>
      <div className='text-center'>
        <h2 className='m-0 mb-2 text-[20px] font-bold text-slate-200'>
          Presupuesto creado
        </h2>
        <p className='m-0 text-sm text-slate-500 leading-normal'>
          El presupuesto fue guardado exitosamente en el sistema.
        </p>
      </div>
      <div className='flex w-full flex-col gap-3 sm:flex-row sm:w-auto'>
        <button
          onClick={onNuevo}
          className='px-5 py-2.5 rounded-lg border border-slate-400/15 bg-slate-900/60 text-slate-400 text-[13px] cursor-pointer transition-colors duration-150'
        >
          + Nuevo presupuesto
        </button>
        <a
          href='/presupuestos'
          className='px-5 py-2.5 rounded-lg border-0 bg-gradient-to-br from-emerald-600/80 to-emerald-700/80 hover:from-emerald-600 hover:to-emerald-700 text-slate-950 text-[13px] font-bold cursor-pointer no-underline inline-flex items-center transition-all'
        >
          Ver presupuestos →
        </a>
      </div>
    </div>
  );
}
