'use client';

// ============================================================
// components/modules/logistica/RemitoFicha.tsx
// Ficha de remito: ítems, datos de transporte, estado,
// vínculos a OS / NP / factura.
// ============================================================

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { ArrowLeft, Settings, User, ClipboardList, FileText, Truck, Receipt, Loader2 } from 'lucide-react';
import type { RemitoCompleto, RemitoItem } from '@/types';
import { obtenerRemito, cambiarEstadoRemito } from '@/app/actions/logistica';
import { descargarPDF } from '@/lib/pdf-client';
import { generarFacturaDesdeRemito } from '@/app/actions/facturas';
import {
  getMockRemitoDetalle,
  shouldUsePlatformMocks,
} from '@/app/actions/platform-mocks';
import { formatearMonto } from '@/lib/calculos';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type EstadoRemito = 'BORRADOR' | 'EMITIDO' | 'ENTREGADO' | 'ANULADO';
type FullRemito = RemitoCompleto & {
  numero_orden: string | null;
  razon_social: string | null;
};
interface Props {
  remitoId: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<EstadoRemito, { label: string; badge: string; dot: string }> = {
  BORRADOR:  { label: 'Borrador',    badge: 'text-slate-400 bg-slate-400/[0.08] border-slate-400/15',  dot: 'bg-slate-400'  },
  EMITIDO:   { label: 'En camino',   badge: 'text-blue-400 bg-blue-400/[0.08] border-blue-400/20',     dot: 'bg-blue-400'   },
  ENTREGADO: { label: 'Entregado',   badge: 'text-green-400 bg-green-400/[0.08] border-green-400/20',  dot: 'bg-green-400'  },
  ANULADO:   { label: 'Anulado',     badge: 'text-red-400 bg-red-400/[0.08] border-red-400/20',        dot: 'bg-red-400'    },
};

const TIPO_CFG: Record<string, { label: string; icon: ReactNode; cls: string }> = {
  INTERNO_ENTRADA: { label: 'Interno Entrada', icon: <span className='text-xs'>📥</span>, cls: 'text-violet-400 bg-violet-400/10 border-violet-400/20' },
  INTERNO_SALIDA:  { label: 'Interno Salida',  icon: <span className='text-xs'>📤</span>, cls: 'text-blue-400 bg-blue-400/10 border-blue-400/20'       },
  LEGAL_ENTRADA:   { label: 'Legal Entrada',   icon: <span className='text-xs'>📦</span>, cls: 'text-green-400 bg-green-400/10 border-green-400/20'    },
  LEGAL_SALIDA:    { label: 'Legal Salida',    icon: <Truck className='w-3 h-3' />,       cls: 'text-amber-500 bg-amber-500/10 border-amber-500/20'    },
};

const TRANSICIONES: Record<EstadoRemito, EstadoRemito[]> = {
  BORRADOR: ['EMITIDO', 'ANULADO'],
  EMITIDO: ['ENTREGADO', 'ANULADO'],
  ENTREGADO: [],
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

// ─── Tabla ítems ──────────────────────────────────────────────────────────────

function TablaItems({ items }: { items: RemitoItem[] }) {
  const tienePrecios = items.some((i) => i.precio_unitario != null);
  return (
    <div className={`${cardClass} overflow-hidden`}>
      <div className={`grid gap-2.5 px-4 py-2.5 bg-slate-950/40 border-b border-slate-400/[0.07] ${tienePrecios ? 'grid-cols-[28px_1fr_80px_80px_90px_100px]' : 'grid-cols-[28px_1fr_80px_80px]'}`}>
        {[
          '#',
          'Descripción',
          'Cant.',
          'Unidad',
          ...(tienePrecios ? ['P. Unit.', 'Subtotal'] : []),
        ].map((h, i) => (
          <span
            key={i}
            className={`${labelClass} ${i >= 4 ? 'text-right' : 'text-left'}`}
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
            className={`grid gap-2.5 px-4 py-[11px] items-center ${tienePrecios ? 'grid-cols-[28px_1fr_80px_80px_90px_100px]' : 'grid-cols-[28px_1fr_80px_80px]'}${idx < items.length - 1 ? ' border-b border-slate-400/[0.05]' : ''}`}
          >
            <div className='w-[22px] h-[22px] rounded flex items-center justify-center text-xs font-bold text-amber-500 bg-amber-500/[0.07] border border-amber-500/[0.15]'>
              {idx + 1}
            </div>
            <span className='text-[13px] text-slate-400'>
              {item.descripcion}
            </span>
            <span className='text-xs text-slate-500 font-mono'>
              {item.cantidad}
            </span>
            <span className='text-xs text-slate-600 font-mono'>
              {item.unidad_medida}
            </span>
            {tienePrecios && (
              <>
                <span className='text-xs text-slate-500 text-right font-mono'>
                  {item.precio_unitario != null
                    ? formatearMonto(item.precio_unitario)
                    : '—'}
                </span>
                <span className='text-[13px] font-semibold text-slate-400 text-right font-mono'>
                  {item.subtotal != null ? formatearMonto(item.subtotal) : '—'}
                </span>
              </>
            )}
          </div>
        ))}
      {tienePrecios && (
        <div className='flex justify-end px-4 py-3 border-t border-slate-400/[0.07]'>
          <span className='text-[15px] font-extrabold text-amber-500 font-mono'>
            {formatearMonto(items.reduce((a, i) => a + (i.subtotal ?? 0), 0))}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function RemitoFicha({ remitoId }: Props) {
  const [remito, setRemito] = useState<FullRemito | null>(null);
  const [loading, setLoading] = useState(true);
  const [accionLoad, setAccionLoad] = useState(false);
  const [generandoFactura, setGenerandoFactura] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
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
      setRemito(getMockRemitoDetalle(remitoId) as FullRemito | null);
      setLoading(false);
      return;
    }
    const res = await obtenerRemito(remitoId);
    setLoading(false);
    if (res.data) setRemito(res.data as unknown as FullRemito);
  }, [remitoId]);

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

  const handleCambiarEstado = async (estado: EstadoRemito) => {
    if (!remito) return;
    setAccionLoad(true);
    setMenuEstado(false);
    const res = await cambiarEstadoRemito(remito.id, estado);
    setAccionLoad(false);
    if (res.error) showToast(res.error, 'error');
    else {
      showToast(res.mensaje ?? 'Estado actualizado', 'ok');
      cargar();
    }
  };

  const handleGenerarFactura = async () => {
    if (!remito) return;
    setGenerandoFactura(true);
    const res = await generarFacturaDesdeRemito(remito.id);
    setGenerandoFactura(false);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.mensaje ?? 'Factura generada', 'ok');
    window.location.href = `/facturas/${res.data!.id}`;
  };

  const handlePDF = async () => {
    if (!remito) return;
    setPdfLoading(true);
    const err = await descargarPDF('remito', remito.id, `REM-${remito.numero}.pdf`);
    setPdfLoading(false);
    if (err) showToast(`Error al generar PDF: ${err}`, 'error');
  };

  const r = remito;
  const tipoCfg = r
    ? (TIPO_CFG[r.tipo] ?? { label: r.tipo, icon: <FileText className='w-3 h-3' />, cls: 'text-slate-400 bg-slate-400/10 border-slate-400/20' })
    : null;
  const posibles = r ? TRANSICIONES[r.estado as EstadoRemito] : [];

  return (
    <>
      <div className='px-3 py-3 pb-10 sm:px-5 sm:py-4 sm:pb-12 lg:px-4 lg:py-2 lg:pb-3'>
        <div className='w-full min-w-0'>
          {/* Breadcrumb */}
          <div className='mb-3 flex items-center gap-2 lg:mb-2'>
            <a
              href='/logistica'
              className='flex items-center gap-1 text-xs text-slate-700 no-underline tracking-widest uppercase hover:text-slate-400 transition-colors'
            >
              <ArrowLeft className='w-3 h-3' />
              Logística
            </a>
            <span className='text-slate-800'>›</span>
            <span className='text-xs text-slate-600 tracking-widest uppercase'>
              Remitos
            </span>
            <span className='text-slate-800'>›</span>
            <span className='text-xs text-slate-500'>
              {loading ? '...' : r?.numero}
            </span>
          </div>

          {/* Header */}
          <div className={`${cardClass} p-4 mb-3`}>
            {loading ? (
              <div className='flex flex-col gap-2.5'>
                <div className='h-3 rounded bg-slate-400/[0.07] w-[120px] animate-pulse' />
                <div className='h-[22px] rounded bg-slate-400/[0.07] w-[280px] animate-pulse' />
              </div>
            ) : r ? (
              <div className='flex items-start justify-between gap-4 flex-wrap'>
                <div>
                  <div className='flex items-center gap-2.5 mb-2 flex-wrap'>
                    <span className='text-[15px] font-bold text-amber-500'>
                      {r.numero}
                    </span>

                    {/* Tipo */}
                    {tipoCfg && (
                      <span className={`inline-flex items-center gap-[5px] px-[9px] py-0.5 rounded-md text-xs font-bold border ${tipoCfg.cls}`}>
                        {tipoCfg.icon} {tipoCfg.label}
                      </span>
                    )}

                    {/* Estado */}
                    {(() => {
                      const cfg = ESTADO_CFG[r.estado as EstadoRemito];
                      return (
                        <span className={`inline-flex items-center gap-[5px] px-[11px] py-[3px] rounded-full text-[11px] font-semibold border ${cfg.badge}`}>
                          <span className='inline-block w-[5px] h-[5px] rounded-full bg-current' />
                          {cfg.label}
                        </span>
                      );
                    })()}

                    {/* Vínculos */}
                    {r.numero_orden && (
                      <a
                        href={`/ordenes/${r.orden_id}`}
                        className='inline-flex items-center gap-1 text-xs text-blue-400 no-underline bg-blue-400/[0.06] border border-blue-400/[0.15] rounded px-1.5 py-px'
                      >
                        <Settings className='w-3 h-3' /> {r.numero_orden}
                      </a>
                    )}
                    {r.factura_id && (
                      <a
                        href={`/facturas/${r.factura_id}`}
                        className='inline-flex items-center gap-1 text-xs text-emerald-400 no-underline bg-emerald-400/[0.06] border border-emerald-400/[0.15] rounded px-1.5 py-px'
                      >
                        <span className='text-xs'>🧾</span> Factura
                      </a>
                    )}
                  </div>

                  {r.razon_social && (
                    <a
                      href={`/clientes/${r.cliente_id}`}
                      className='text-[15px] font-semibold text-slate-400 no-underline block mb-1 transition-colors duration-150 hover:text-slate-200'
                    >
                      {r.razon_social}
                    </a>
                  )}
                  {!r.razon_social && r.proveedor && (
                    <div className='text-sm text-slate-500 mb-1'>
                      {r.proveedor}
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div className='flex gap-2 shrink-0 flex-wrap'>
                  <button
                    onClick={handlePDF}
                    disabled={pdfLoading}
                    className='inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-400/[0.15] bg-slate-900/60 text-slate-500 text-xs font-semibold cursor-pointer disabled:opacity-50'
                  >
                    {pdfLoading ? <Loader2 className='w-3 h-3 animate-spin' /> : <FileText className='w-3 h-3' />}
                    PDF
                  </button>
                  {['EMITIDO', 'ENTREGADO'].includes(r.estado) && !r.factura_id && (
                    <button
                      onClick={handleGenerarFactura}
                      disabled={generandoFactura}
                      className='inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border-0 text-slate-900 text-xs font-bold cursor-pointer bg-gradient-to-br from-emerald-400/80 to-teal-500/80 disabled:opacity-60'
                    >
                      {generandoFactura
                        ? <Loader2 className='w-3 h-3 animate-spin' />
                        : <Receipt className='w-3 h-3' />}
                      Generar Factura
                    </button>
                  )}
                  {posibles.length > 0 && (
                    <div ref={menuRef} className='relative'>
                      <button
                        onClick={() => setMenuEstado((p) => !p)}
                        disabled={accionLoad}
                        className='inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border-none text-slate-900 text-xs font-bold cursor-pointer bg-gradient-to-br from-amber-500/80 to-yellow-500/80'
                      >
                        Actualizar estado
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
                        <div className='absolute right-0 top-[calc(100%+4px)] z-30 bg-slate-900 border border-slate-400/[0.12] rounded-[9px] p-1 min-w-[160px] shadow-[0_8px_24px_rgba(0,0,0,0.5)] animate-[scaleIn_0.12s_ease]'>
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
              <div className='text-slate-600'>Remito no encontrado</div>
            )}
          </div>

          {r && (
            <div className='grid grid-cols-[1fr_270px] gap-4 items-start'>
              {/* Ítems */}
              <div className='flex flex-col gap-4'>
                <TablaItems items={r.items} />

                {/* Notas */}
                {r.notas && (
                  <div className={`${cardClass} p-[18px]`}>
                    <div className='text-xs font-bold tracking-widest uppercase text-slate-700 mb-2'>
                      Notas
                    </div>
                    <p className='m-0 text-xs text-slate-500 leading-[1.7] whitespace-pre-wrap'>
                      {r.notas}
                    </p>
                  </div>
                )}
              </div>

              {/* Panel lateral */}
              <div className='flex flex-col gap-3'>
                {/* Datos del documento */}
                <div className={`${cardClass} p-[18px]`}>
                  <div className='text-xs font-bold tracking-widest uppercase text-slate-700 mb-3'>
                    Documento
                  </div>
                  {[
                    { label: 'Número', value: r.numero, mono: true },
                    { label: 'Tipo', value: tipoCfg?.label ?? r.tipo },
                    {
                      label: 'Emisión',
                      value: fmtFecha(r.fecha_emision),
                      mono: true,
                    },
                    ...(r.cae
                      ? [{ label: 'CAE', value: r.cae, mono: true }]
                      : []),
                    ...(r.cai_vencimiento
                      ? [
                          {
                            label: 'Venc. CAE',
                            value: fmtFecha(r.cai_vencimiento),
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

                {/* Datos de entrega */}
                {(r.direccion_entrega ||
                  r.transportista ||
                  r.patente_vehiculo ||
                  r.chofer) && (
                  <div className={`${cardClass} p-[18px]`}>
                    <div className='flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase text-slate-700 mb-3'>
                      <Truck className='w-3 h-3' /> Entrega
                    </div>
                    {[
                      { label: 'Dirección', value: r.direccion_entrega },
                      { label: 'Transportista', value: r.transportista },
                      {
                        label: 'Patente',
                        value: r.patente_vehiculo,
                        mono: true,
                      },
                      { label: 'Chofer', value: r.chofer },
                    ]
                      .filter(({ value }) => !!value)
                      .map(({ label, value, mono }) => (
                        <div
                          key={label}
                          className='flex justify-between items-start gap-2 pb-[7px] mb-[7px] border-b border-slate-400/[0.05]'
                        >
                          <span className='text-xs text-slate-700 shrink-0'>
                            {label}
                          </span>
                          <span
                            className={`text-xs text-slate-500 text-right max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap${mono ? ' font-mono' : ''}`}
                          >
                            {value}
                          </span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Accesos rápidos */}
                <div className={`${cardClass} p-3.5`}>
                  <div className='text-xs font-bold tracking-widest uppercase text-slate-700 mb-2'>
                    Accesos
                  </div>
                  <div className='flex flex-col gap-[5px]'>
                    {([
                      ...(r.cliente_id
                        ? [
                            {
                              href: `/clientes/${r.cliente_id}`,
                              label: 'Ver cliente',
                              icon: <User className='w-4 h-4' />,
                            },
                          ]
                        : []),
                      ...(r.orden_id
                        ? [
                            {
                              href: `/ordenes/${r.orden_id}`,
                              label: 'Ver OS',
                              icon: <Settings className='w-4 h-4' />,
                            },
                          ]
                        : []),
                      ...(r.nota_pedido_id
                        ? [
                            {
                              href: `/logistica/notas/${r.nota_pedido_id}`,
                              label: 'Ver nota de pedido',
                              icon: <ClipboardList className='w-4 h-4' />,
                            },
                          ]
                        : []),
                      ...(r.factura_id
                        ? [
                            {
                              href: `/facturas/${r.factura_id}`,
                              label: 'Ver factura',
                              icon: <span className='text-xs'>🧾</span>,
                            },
                          ]
                        : []),
                    ] as { href: string; label: string; icon: ReactNode }[]).map(({ href, label, icon }) => (
                      <a
                        key={href}
                        href={href}
                        className='flex items-center gap-[7px] px-[9px] py-[7px] rounded-md no-underline text-xs text-slate-500 border border-slate-400/[0.07] bg-slate-950/30 transition-all duration-[120ms] hover:bg-slate-400/[0.05] hover:text-slate-400'
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

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[200] flex items-center gap-2.5 px-[18px] py-3 rounded-[10px] bg-slate-900/[0.97] backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-[slideUp_0.25s_ease] ${toast.tipo === 'ok' ? 'border border-emerald-400/30' : 'border border-red-400/30'}`}
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
