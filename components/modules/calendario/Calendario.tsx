'use client';

// ============================================================
// /components/modules/calendario/Calendario.tsx
// Vista de calendario mensual con eventos, modal de detalle
// y formulario de creación rápida.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  ExternalLink,
  Calendar,
  Clock,
  Trash2,
  CheckCircle2,
  Circle,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import {
  obtenerEventos,
  crearEvento,
  actualizarEvento,
  eliminarEvento,
  sincronizarVencimientos,
} from '@/app/actions/calendario';
import {
  createMockCalendarEvent,
  getMockEventos,
  shouldUsePlatformMocks,
} from '@/app/actions/platform-mocks';
import { COLORES_TIPO, COLORES_TIPO_CLS } from '@/lib/calendario-utils';
import type { EventoCalendario, CrearEventoDTO } from '@/types/calendario';

// ── Constantes ────────────────────────────────────────────────

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

type TipoEvento = EventoCalendario['tipo'];

const TIPO_OPTS: { value: TipoEvento; label: string }[] = [
  { value: 'SERVICIO_PROGRAMADO', label: 'Servicio programado' },
  { value: 'SERVICIO_EJECUTADO', label: 'Servicio ejecutado' },
  { value: 'VENCIMIENTO_FACTURA', label: 'Vencimiento factura' },
  { value: 'COBRO_CHEQUE', label: 'Cobro de cheque' },
  { value: 'PAGO_CHEQUE', label: 'Pago de cheque' },
  { value: 'VENCIMIENTO_PLAN_PAGO', label: 'Vencimiento plan de pago' },
  { value: 'VENCIMIENTO_POLIZA', label: 'Vencimiento póliza' },
  { value: 'PAGO_CLIENTE', label: 'Pago de cliente' },
  {
    value: 'VENCIMIENTO_SERVICIO_CONTINUO',
    label: 'Vencimiento servicio continuo',
  },
];

const HREF_ENTIDAD: Record<string, (id: string) => string> = {
  orden: (id) => `/ordenes/${id}`,
  factura: (id) => `/facturas/${id}`,
  presupuesto: (id) => `/presupuestos/${id}`,
  remito: (id) => `/logistica/remitos/${id}`,
  nota_pedido: (id) => `/logistica/notas/${id}`,
};

// ── Helpers ───────────────────────────────────────────────────

const isoDate = (d: Date) => d.toISOString().split('T')[0];

const getDiasDelMes = (año: number, mes: number) => {
  const primero = new Date(año, mes, 1);
  const ultimo = new Date(año, mes + 1, 0);
  const dias: (Date | null)[] = Array(primero.getDay()).fill(null);
  for (let d = 1; d <= ultimo.getDate(); d++) dias.push(new Date(año, mes, d));
  // Completar semana final
  while (dias.length % 7 !== 0) dias.push(null);
  return dias;
};

// ── Punto de color ────────────────────────────────────────────

function PuntoEvento({
  evento,
  onClick,
}: {
  evento: EventoCalendario;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={evento.titulo}
      className='w-full text-left px-1 py-0.5 rounded text-[10px] font-medium leading-tight truncate hover:opacity-80 transition-opacity border-l-2 bg-[var(--ev-bg)] text-[var(--ev-color)] border-l-[var(--ev-color)]'
      style={{
        '--ev-bg': evento.color + '22',
        '--ev-color': evento.color,
      } as React.CSSProperties}
    >
      {evento.completado && (
        <span className='line-through opacity-60'>{evento.titulo}</span>
      )}
      {!evento.completado && evento.titulo}
    </button>
  );
}

// ── Modal evento ──────────────────────────────────────────────

function ModalEvento({
  evento,
  onClose,
  onToggle,
  onEliminar,
}: {
  evento: EventoCalendario;
  onClose: () => void;
  onToggle: () => void;
  onEliminar: () => void;
}) {
  const href =
    evento.entidad_tipo && evento.entidad_id
      ? HREF_ENTIDAD[evento.entidad_tipo]?.(evento.entidad_id)
      : null;

  const fmtFecha = (iso: string) =>
    new Date(iso).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in'>
      <div
        className='absolute inset-0 bg-black/50 backdrop-blur-sm'
        onClick={onClose}
      />
      <div className='relative bg-slate-950 rounded-[12px] shadow-2xl border border-slate-400/15 w-full max-w-md overflow-hidden animate-modal-in'>
        {/* Header coloreado */}
        <div
          className='px-5 py-4 border-b-[3px] bg-[var(--ev-header-bg)] border-b-[var(--ev-color)]'
          style={{
            '--ev-header-bg': evento.color + '15',
            '--ev-color': evento.color,
          } as React.CSSProperties}
        >
          <div className='flex items-start justify-between gap-3'>
            <div>
              <p
                className='text-[10px] font-semibold uppercase tracking-wider mb-1 text-[var(--ev-color)]'
                style={{ '--ev-color': evento.color } as React.CSSProperties}
              >
                {TIPO_OPTS.find((t) => t.value === evento.tipo)?.label ??
                  evento.tipo}
              </p>
              <h3
                className={`text-base font-bold text-slate-100 ${evento.completado ? 'line-through opacity-50' : ''}`}
              >
                {evento.titulo}
              </h3>
              {evento.razon_social && (
                <p className='text-sm text-slate-300 mt-0.5'>
                  {evento.razon_social}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className='p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 flex-shrink-0'
            >
              <X className='w-4 h-4' />
            </button>
          </div>
        </div>

        {/* Cuerpo */}
        <div className='px-5 py-4 space-y-3'>
          <div className='flex items-center gap-2 text-sm text-slate-300'>
            <Calendar className='w-4 h-4 text-slate-400' />
            {fmtFecha(evento.fecha_inicio)}
            {evento.fecha_fin && evento.fecha_fin !== evento.fecha_inicio && (
              <span className='text-slate-400'>
                → {fmtFecha(evento.fecha_fin)}
              </span>
            )}
          </div>

          {!evento.todo_el_dia && (
            <div className='flex items-center gap-2 text-sm text-slate-300'>
              <Clock className='w-4 h-4 text-slate-400' />
              {new Date(evento.fecha_inicio).toLocaleTimeString('es-AR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          )}

          {evento.descripcion && (
            <p className='text-sm text-slate-300 leading-relaxed'>
              {evento.descripcion}
            </p>
          )}
        </div>

        {/* Acciones */}
        <div className='px-5 py-3 border-t border-slate-700 flex items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <button
              onClick={onToggle}
              className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-400/10 hover:bg-slate-400/5 bg-transparent text-slate-400 transition-colors'
            >
              {evento.completado ? (
                <>
                  <Circle className='w-3.5 h-3.5 text-slate-400' /> Reabrir
                </>
              ) : (
                <>
                  <CheckCircle2 className='w-3.5 h-3.5 text-emerald-500' />{' '}
                  Completar
                </>
              )}
            </button>
            {href && (
              <a
                href={href}
                target='_blank'
                className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-700 text-blue-300 hover:bg-blue-900/30 transition-colors'
              >
                <ExternalLink className='w-3.5 h-3.5' /> Ver detalle
              </a>
            )}
          </div>
          <button
            onClick={onEliminar}
            className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-red-400 border border-red-700 hover:bg-red-900/30 transition-colors'
          >
            <Trash2 className='w-3.5 h-3.5' /> Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal creación rápida ─────────────────────────────────────

function ModalNuevoEvento({
  fechaInicial,
  onClose,
  onCreado,
}: {
  fechaInicial: string;
  onClose: () => void;
  onCreado: (evento?: EventoCalendario) => void;
}) {
  const [tipo, setTipo] = useState<TipoEvento>('SERVICIO_PROGRAMADO');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDesc] = useState('');
  const [fecha, setFecha] = useState(fechaInicial);
  const [todoDia, setTodoDia] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGuardar = async () => {
    if (!titulo.trim()) {
      setError('El título es requerido');
      return;
    }
    setGuardando(true);
    const dto: CrearEventoDTO = {
      tipo,
      titulo,
      fecha_inicio: fecha,
      descripcion: descripcion || undefined,
      todo_el_dia: todoDia,
    };
    if (shouldUsePlatformMocks) {
      onCreado(
        createMockCalendarEvent({
          tipo,
          titulo,
          descripcion,
          fecha_inicio: todoDia ? `${fecha}T00:00:00` : `${fecha}T09:00:00`,
          todo_el_dia: todoDia,
        }),
      );
      onClose();
      setGuardando(false);
      return;
    }
    const r = await crearEvento(dto);
    setGuardando(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    onCreado();
    onClose();
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in'>
      <div
        className='absolute inset-0 bg-black/50 backdrop-blur-sm'
        onClick={onClose}
      />
      <div className='relative bg-slate-950 rounded-[12px] shadow-2xl border border-slate-400/15 w-full max-w-md overflow-hidden animate-modal-in'>
        <div className='px-5 py-4 border-b border-slate-400/10 flex items-center justify-between'>
          <h3 className='font-semibold text-slate-100'>Nuevo evento</h3>
          <button
            onClick={onClose}
            className='p-1.5 rounded-lg hover:bg-slate-700 text-slate-400'
          >
            <X className='w-4 h-4' />
          </button>
        </div>
        <div className='px-5 py-4 space-y-3'>
          <div>
            <label className='block text-xs font-medium text-slate-300 mb-1'>
              Tipo
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoEvento)}
              className='w-full text-sm px-3 py-2 border border-slate-400/10 bg-slate-800/50 text-slate-100 placeholder-slate-500 rounded-lg focus:outline-none focus:border-emerald-500/40 focus:bg-slate-800/70 transition-colors'
            >
              {TIPO_OPTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className='block text-xs font-medium text-slate-300 mb-1'>
              Título *
            </label>
            <input
              type='text'
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder='Descripción del evento…'
              className='w-full text-sm px-3 py-2 border border-slate-400/10 bg-slate-800/50 text-slate-100 placeholder-slate-500 rounded-lg focus:outline-none focus:border-emerald-500/40 focus:bg-slate-800/70 transition-colors'
            />
          </div>
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className='block text-xs font-medium text-slate-300 mb-1'>
                Fecha
              </label>
              <input
                type='date'
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className='w-full text-sm px-3 py-2 border border-slate-400/10 bg-slate-800/50 text-slate-100 rounded-lg focus:outline-none focus:border-emerald-500/40 focus:bg-slate-800/70 transition-colors'
              />
            </div>
            <div className='flex items-end pb-2'>
              <label className='flex items-center gap-2 text-sm text-slate-300 cursor-pointer'>
                <input
                  type='checkbox'
                  checked={todoDia}
                  onChange={(e) => setTodoDia(e.target.checked)}
                  className='accent-blue-600 w-4 h-4'
                />
                Todo el día
              </label>
            </div>
          </div>
          <div>
            <label className='block text-xs font-medium text-slate-300 mb-1'>
              Descripción
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              placeholder='Notas adicionales…'
              className='w-full text-sm px-3 py-2 border border-slate-400/10 bg-slate-800/50 text-slate-100 placeholder-slate-500 rounded-lg focus:outline-none focus:border-emerald-500/40 focus:bg-slate-800/70 transition-colors resize-none'
            />
          </div>
          {error && (
            <div className='flex items-center gap-2 text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg border border-red-400/15'>
              <AlertCircle className='w-4 h-4 flex-shrink-0' />
              {error}
            </div>
          )}
        </div>
        <div className='px-5 py-3 border-t border-slate-400/10 flex justify-end gap-2'>
          <button
            onClick={onClose}
            className='px-4 py-2 text-sm text-slate-300 hover:text-slate-100'
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={guardando}
            className='flex items-center gap-1.5 px-4 py-2 bg-gradient-to-br from-emerald-600/80 to-emerald-700/80 hover:from-emerald-600 hover:to-emerald-700 text-slate-950 text-sm font-semibold rounded-[7px] transition-all disabled:opacity-50 border-0 cursor-pointer shadow-sm shadow-emerald-600/15'
          >
            {guardando ? 'Guardando…' : 'Crear evento'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════

export default function Calendario() {
  const hoy = new Date();
  const [año, setAño] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const [eventos, setEventos] = useState<EventoCalendario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);

  const [modalEvento, setModalEvento] = useState<EventoCalendario | null>(null);
  const [modalNuevo, setModalNuevo] = useState<string | null>(null); // fecha ISO
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const cargar = useCallback(async () => {
    setCargando(true);
    const desde = isoDate(new Date(año, mes, 1));
    const hasta = isoDate(new Date(año, mes + 1, 0));
    if (shouldUsePlatformMocks) {
      setEventos(getMockEventos(desde + 'T00:00:00', hasta + 'T23:59:59'));
      setCargando(false);
      return;
    }
    const r = await obtenerEventos(desde + 'T00:00:00', hasta + 'T23:59:59');
    if (r.data) setEventos(r.data);
    setCargando(false);
  }, [año, mes]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const mesAnterior = () => {
    if (mes === 0) {
      setAño((a) => a - 1);
      setMes(11);
    } else setMes((m) => m - 1);
  };
  const mesSiguiente = () => {
    if (mes === 11) {
      setAño((a) => a + 1);
      setMes(0);
    } else setMes((m) => m + 1);
  };
  const irHoy = () => {
    setAño(hoy.getFullYear());
    setMes(hoy.getMonth());
  };

  const handleSincronizar = async () => {
    if (shouldUsePlatformMocks) {
      showToast('Vencimientos sincronizados en modo mock');
      return;
    }
    setSincronizando(true);
    const r = await sincronizarVencimientos();
    setSincronizando(false);
    if (r.data) {
      showToast(r.mensaje ?? `${r.data.creados} eventos sincronizados`);
      cargar();
    }
  };

  const handleToggle = async () => {
    if (!modalEvento) return;
    if (shouldUsePlatformMocks) {
      setEventos((prev) =>
        prev.map((evento) =>
          evento.id === modalEvento.id
            ? { ...evento, completado: !evento.completado }
            : evento,
        ),
      );
      setModalEvento(null);
      return;
    }
    await actualizarEvento(modalEvento.id, {
      completado: !modalEvento.completado,
    });
    setModalEvento(null);
    cargar();
  };

  const handleEliminar = async () => {
    if (!modalEvento) return;
    if (!confirm('¿Eliminar este evento?')) return;
    if (shouldUsePlatformMocks) {
      setEventos((prev) =>
        prev.filter((evento) => evento.id !== modalEvento.id),
      );
      setModalEvento(null);
      return;
    }
    await eliminarEvento(modalEvento.id);
    setModalEvento(null);
    cargar();
  };

  const dias = getDiasDelMes(año, mes);
  const hoyStr = isoDate(hoy);

  // Agrupar eventos por día
  const eventosPorDia: Record<string, EventoCalendario[]> = {};
  for (const e of eventos) {
    const key = e.fecha_inicio.split('T')[0];
    if (!eventosPorDia[key]) eventosPorDia[key] = [];
    eventosPorDia[key].push(e);
  }

  // Leyenda de tipos con eventos activos este mes
  const tiposActivos = [...new Set(eventos.map((e) => e.tipo))];

  return (
    <>
      <div
        className='min-h-screen bg-slate-950 bg-gradient-to-b from-emerald-950/5 to-slate-950'
      >
        {/* Toast */}
        {toast && (
          <div className='fixed bottom-6 right-6 z-50 bg-emerald-600 text-white text-xs font-semibold px-4 py-3 rounded-[10px] shadow-2xl animate-in slide-in-from-bottom-2 duration-200'>
            {toast}
          </div>
        )}

        {/* Modales */}
        {modalEvento && (
          <ModalEvento
            evento={modalEvento}
            onClose={() => setModalEvento(null)}
            onToggle={handleToggle}
            onEliminar={handleEliminar}
          />
        )}
        {modalNuevo && (
          <ModalNuevoEvento
            fechaInicial={modalNuevo}
            onClose={() => setModalNuevo(null)}
            onCreado={(evento) => {
              if (shouldUsePlatformMocks && evento) {
                setEventos((prev) => [...prev, evento]);
              } else {
                cargar();
              }
            }}
          />
        )}

        {/* Header */}
        <div className='bg-slate-900/80 backdrop-blur-sm border-b border-slate-400/10 px-6 py-4'>
          <div className='max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3'>
            <div className='flex items-center gap-4'>
              <div className='flex items-center gap-1'>
                <button
                  onClick={mesAnterior}
                  className='p-2 rounded-xl hover:bg-slate-400/5 text-slate-500 transition-colors'
                >
                  <ChevronLeft className='w-4 h-4' />
                </button>
                <h1 className='text-xl font-bold text-slate-100 w-48 text-center'>
                  {MESES[mes]} {año}
                </h1>
                <button
                  onClick={mesSiguiente}
                  className='p-2 rounded-xl hover:bg-slate-400/5 text-slate-500 transition-colors'
                >
                  <ChevronRight className='w-4 h-4' />
                </button>
              </div>
              <button
                onClick={irHoy}
                className='px-3 py-1.5 text-xs font-medium border border-slate-400/10 rounded-lg hover:bg-slate-400/5 bg-transparent text-slate-400 transition-colors'
              >
                Hoy
              </button>
            </div>

            <div className='flex items-center gap-2'>
              <button
                onClick={handleSincronizar}
                disabled={sincronizando}
                className='flex items-center gap-1.5 px-3 py-2 text-sm text-slate-400 border border-slate-400/10 rounded-xl hover:bg-slate-400/5 bg-transparent transition-colors disabled:opacity-50'
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${sincronizando ? 'animate-spin' : ''}`}
                />
                Sincronizar vencimientos
              </button>
              <button
                onClick={() => setModalNuevo(hoyStr)}
                className='flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm'
              >
                <Plus className='w-4 h-4' /> Nuevo evento
              </button>
            </div>
          </div>
        </div>

        <div className='max-w-7xl mx-auto px-6 py-6 space-y-4'>
          {/* Leyenda */}
          {tiposActivos.length > 0 && (
            <div className='flex flex-wrap gap-2'>
              {tiposActivos.map((tipo) => (
                <span
                  key={tipo}
                  className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-700 border border-slate-600 text-slate-300'
                >
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${COLORES_TIPO_CLS[tipo] ?? 'bg-slate-500'}`}
                  />
                  {TIPO_OPTS.find((t) => t.value === tipo)?.label ?? tipo}
                </span>
              ))}
            </div>
          )}

          {/* Grilla */}
          <div className='bg-slate-800/70 rounded-2xl border border-slate-700/80 overflow-hidden shadow-sm backdrop-blur-sm'>
            {/* Cabecera días */}
            <div className='grid grid-cols-7 border-b border-slate-700/60 bg-slate-900/20'>
              {DIAS.map((d) => (
                <div
                  key={d}
                  className='py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500'
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Semanas */}
            {cargando ? (
              <div className='grid grid-cols-7'>
                {Array.from({ length: 35 }).map((_, i) => (
                  <div
                    key={i}
                    className='h-28 border-r border-b border-slate-700 last:border-r-0 animate-pulse bg-slate-800/40'
                  />
                ))}
              </div>
            ) : (
              <div className='grid grid-cols-7'>
                {dias.map((dia, idx) => {
                  const diaStr = dia ? isoDate(dia) : null;
                  const esHoy = diaStr === hoyStr;
                  const esOtroMes = false;
                  const evsDia = diaStr ? (eventosPorDia[diaStr] ?? []) : [];
                  const MAX_VISIBLE = 3;

                  return (
                    <div
                      key={idx}
                      onClick={() => dia && setModalNuevo(isoDate(dia))}
                      className={`min-h-28 p-1.5 border-r border-b border-slate-700/50 last-of-type:border-r-0 transition-colors
                      ${dia ? 'cursor-pointer hover:bg-slate-800/70' : 'bg-slate-800/30'}
                      ${idx % 7 === 6 ? 'border-r-0' : ''}`}
                    >
                      {dia && (
                        <>
                          <div className='flex items-center justify-between mb-1 px-0.5'>
                            <span
                              className={`w-6 h-6 flex items-center justify-center text-xs font-semibold rounded-full transition-colors
                            ${esHoy ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                            >
                              {dia.getDate()}
                            </span>
                            {evsDia.length > 0 && (
                              <span className='text-[9px] text-slate-400 font-medium'>
                                {evsDia.length}
                              </span>
                            )}
                          </div>
                          <div className='space-y-0.5'>
                            {evsDia.slice(0, MAX_VISIBLE).map((ev) => (
                              <PuntoEvento
                                key={ev.id}
                                evento={ev}
                                onClick={() => setModalEvento(ev)}
                              />
                            ))}
                            {evsDia.length > MAX_VISIBLE && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setModalEvento(evsDia[MAX_VISIBLE]);
                                }}
                                className='w-full text-[10px] text-slate-400 hover:text-slate-200 px-1 py-0.5 text-left'
                              >
                                +{evsDia.length - MAX_VISIBLE} más
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Próximos eventos (lista lateral) */}
          {eventos
            .filter((e) => !e.completado && e.fecha_inicio >= hoyStr)
            .slice(0, 8).length > 0 && (
            <div className='bg-slate-800/70 rounded-2xl border border-slate-700/80 shadow-sm overflow-hidden backdrop-blur-sm'>
              <div className='px-5 py-3 border-b border-slate-700/60'>
                <h2 className='text-sm font-semibold text-slate-100'>
                  Próximos eventos
                </h2>
              </div>
              <div className='divide-y divide-slate-700/40'>
                {eventos
                  .filter(
                    (e) =>
                      !e.completado && e.fecha_inicio.split('T')[0] >= hoyStr,
                  )
                  .slice(0, 8)
                  .map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => setModalEvento(ev)}
                      className='w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-800 transition-colors text-left group text-slate-200'
                    >
                      <div
                        className='w-2 h-2 rounded-full flex-shrink-0 mt-0.5 bg-[var(--ev-dot)]'
                        style={{ '--ev-dot': ev.color ?? '#64748b' } as React.CSSProperties}
                      />
                      <div className='flex-1 min-w-0'>
                        <p className='text-sm font-medium text-slate-100 truncate'>
                          {ev.titulo}
                        </p>
                        {ev.razon_social && (
                          <p className='text-xs text-slate-400 truncate'>
                            {ev.razon_social}
                          </p>
                        )}
                      </div>
                      <span className='text-xs text-slate-400 flex-shrink-0 tabular-nums'>
                        {new Date(ev.fecha_inicio).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
