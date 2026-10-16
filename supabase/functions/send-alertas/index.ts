// ============================================================
// supabase/functions/send-alertas/index.ts
// Edge Function — envía resumen diario de alertas por email
// Deploy: supabase functions deploy send-alertas
// Cron:   configurado en supabase/config.toml (08:00 UTC diario)
// Env:    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, ALERT_EMAIL
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const ALERT_EMAIL    = Deno.env.get('ALERT_EMAIL')!;    // destinatario
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL') ?? 'alertas@hexa.com';
const APP_URL        = Deno.env.get('APP_URL')    ?? 'https://hexa.com';

// ── Tipos ────────────────────────────────────────────────────

type TipoAlerta = 'error' | 'warning' | 'info';

interface Alerta {
  tipo: TipoAlerta;
  modulo: string;
  cantidad: number;
  mensaje: string;
  href: string;
}

// ── Queries ──────────────────────────────────────────────────

async function obtenerAlertas(): Promise<Alerta[]> {
  const hoy  = new Date().toISOString().split('T')[0];
  const en7d = new Date(Date.now() + 7 * 86400_000).toISOString().split('T')[0];

  const { data: remitoOrdenIds } = await supabase
    .from('remitos')
    .select('orden_id')
    .not('orden_id', 'is', null);

  const idsConRemito = [
    ...new Set(
      (remitoOrdenIds ?? [])
        .map((r: { orden_id: string }) => r.orden_id)
        .filter(Boolean)
    ),
  ];

  const [
    { data: presVencidos        },
    { data: presProxVencer      },
    { data: factsVencidas       },
    { data: ordenesAtrasadas    },
    { data: ordenesCompletadas  },
    { data: remitosSinFactura   },
    { data: notasParciales      },
  ] = await Promise.all([
    supabase.from('presupuestos').select('id').eq('estado', 'ENVIADO').lt('fecha_validez', hoy),
    supabase.from('presupuestos').select('id').eq('estado', 'ENVIADO').gte('fecha_validez', hoy).lte('fecha_validez', en7d),
    supabase.from('facturas').select('id').eq('estado', 'EMITIDA').lt('fecha_vencimiento', hoy),
    supabase.from('ordenes_servicio').select('id').eq('estado', 'EN_PROGRESO').lt('fecha_fin_estimada', hoy),
    idsConRemito.length > 0
      ? supabase.from('ordenes_servicio').select('id').eq('estado', 'COMPLETADA').not('id', 'in', `(${idsConRemito.join(',')})`)
      : supabase.from('ordenes_servicio').select('id').eq('estado', 'COMPLETADA'),
    supabase.from('remitos').select('id').in('estado', ['EMITIDO', 'ENTREGADO']).is('factura_id', null),
    supabase.from('notas_pedido').select('id').eq('estado', 'PARCIAL').lt('fecha_requerida', hoy),
  ]);

  const p = (n: number, singular: string, plural?: string) =>
    `${n} ${n === 1 ? singular : (plural ?? singular + 's')}`;

  const alertas: Alerta[] = [];

  if ((factsVencidas?.length ?? 0) > 0)
    alertas.push({ tipo: 'error', modulo: 'Facturación', cantidad: factsVencidas!.length, href: '/facturas', mensaje: `${p(factsVencidas!.length, 'factura vencida', 'facturas vencidas')} sin cobrar` });

  if ((ordenesAtrasadas?.length ?? 0) > 0)
    alertas.push({ tipo: 'error', modulo: 'Órdenes', cantidad: ordenesAtrasadas!.length, href: '/ordenes', mensaje: `${p(ordenesAtrasadas!.length, 'orden fuera de plazo', 'órdenes fuera de plazo')}` });

  if ((remitosSinFactura?.length ?? 0) > 0)
    alertas.push({ tipo: 'warning', modulo: 'Facturación', cantidad: remitosSinFactura!.length, href: '/logistica', mensaje: `${p(remitosSinFactura!.length, 'remito entregado sin facturar', 'remitos entregados sin facturar')}` });

  if ((ordenesCompletadas?.length ?? 0) > 0)
    alertas.push({ tipo: 'warning', modulo: 'Logística', cantidad: ordenesCompletadas!.length, href: '/ordenes', mensaje: `${p(ordenesCompletadas!.length, 'orden completada sin remito', 'órdenes completadas sin remito')}` });

  if ((presVencidos?.length ?? 0) > 0)
    alertas.push({ tipo: 'warning', modulo: 'Presupuestos', cantidad: presVencidos!.length, href: '/presupuestos', mensaje: `${p(presVencidos!.length, 'presupuesto enviado vencido', 'presupuestos enviados vencidos')}` });

  if ((presProxVencer?.length ?? 0) > 0)
    alertas.push({ tipo: 'info', modulo: 'Presupuestos', cantidad: presProxVencer!.length, href: '/presupuestos', mensaje: `${p(presProxVencer!.length, 'presupuesto vence en 7 días', 'presupuestos vencen en 7 días')}` });

  if ((notasParciales?.length ?? 0) > 0)
    alertas.push({ tipo: 'info', modulo: 'Logística', cantidad: notasParciales!.length, href: '/logistica', mensaje: `${p(notasParciales!.length, 'nota de pedido con recepción incompleta', 'notas de pedido con recepción incompleta')}` });

  return alertas;
}

// ── Email HTML ───────────────────────────────────────────────

const COLORES: Record<TipoAlerta, { bg: string; border: string; dot: string; label: string }> = {
  error:   { bg: '#1f0e0e', border: '#7f1d1d', dot: '#ef4444', label: 'URGENTE'    },
  warning: { bg: '#1a1507', border: '#713f12', dot: '#f59e0b', label: 'ATENCIÓN'   },
  info:    { bg: '#0c1929', border: '#1e3a5f', dot: '#3b82f6', label: 'INFORMACIÓN' },
};

function buildHtml(alertas: Alerta[]): string {
  const fecha = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const filas = alertas.map((a) => {
    const c = COLORES[a.tipo];
    return `
      <tr>
        <td style="padding:12px 16px; border-bottom:1px solid #1e293b; background:${c.bg}; border-left:3px solid ${c.border};">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c.dot};margin-right:8px;"></span>
                <span style="font-size:10px;font-weight:700;color:${c.dot};text-transform:uppercase;letter-spacing:0.05em;">${c.label}</span>
                <span style="font-size:10px;color:#64748b;margin-left:8px;">${a.modulo}</span>
              </td>
              <td style="text-align:right;vertical-align:middle;">
                <a href="${APP_URL}${a.href}" style="font-size:11px;color:#3b82f6;text-decoration:none;">Ver →</a>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top:4px;">
                <span style="font-size:13px;color:#cbd5e1;">${a.mensaje}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }).join('');

  const errores  = alertas.filter((a) => a.tipo === 'error').length;
  const warnings = alertas.filter((a) => a.tipo === 'warning').length;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="padding:0 0 24px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="font-size:18px;font-weight:800;color:#f8fafc;letter-spacing:-0.02em;">HEXA</span>
                  <span style="font-size:12px;color:#475569;margin-left:8px;">Resumen de Alertas</span>
                </td>
                <td style="text-align:right;">
                  <span style="font-size:11px;color:#475569;">${fecha}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Summary badges -->
        <tr>
          <td style="padding:0 0 16px 0;">
            ${errores > 0  ? `<span style="display:inline-block;padding:4px 10px;border-radius:6px;background:#7f1d1d;color:#fca5a5;font-size:11px;font-weight:700;margin-right:6px;">${errores} urgente${errores > 1 ? 's' : ''}</span>` : ''}
            ${warnings > 0 ? `<span style="display:inline-block;padding:4px 10px;border-radius:6px;background:#713f12;color:#fcd34d;font-size:11px;font-weight:700;">${warnings} atención${warnings > 1 ? 'es' : ''}</span>` : ''}
          </td>
        </tr>

        <!-- Alerts table -->
        <tr>
          <td style="border-radius:10px;overflow:hidden;border:1px solid #1e293b;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${filas}
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:20px 0 0 0;text-align:center;">
            <a href="${APP_URL}" style="display:inline-block;padding:10px 24px;background:#3b82f6;color:#fff;font-size:13px;font-weight:600;text-decoration:none;border-radius:8px;">
              Ir al dashboard →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 0 0 0;text-align:center;">
            <span style="font-size:11px;color:#334155;">HEXA Gestión · Resumen automático diario</span>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Handler ──────────────────────────────────────────────────

Deno.serve(async (_req) => {
  try {
    const alertas = await obtenerAlertas();

    if (alertas.length === 0) {
      return new Response(JSON.stringify({ ok: true, enviado: false, motivo: 'sin alertas' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const errores = alertas.filter((a) => a.tipo === 'error').length;
    const asunto  = errores > 0
      ? `🔴 ${errores} alerta${errores > 1 ? 's' : ''} urgente${errores > 1 ? 's' : ''} — HEXA Gestión`
      : `⚠️ Resumen de alertas — HEXA Gestión`;

    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      [ALERT_EMAIL],
        subject: asunto,
        html:    buildHtml(alertas),
      }),
    });

    if (!res.ok) {
      // El detalle queda en los logs de la función; al cliente, un mensaje genérico.
      console.error('send-alertas: Resend respondió', res.status, await res.text());
      return new Response(
        JSON.stringify({ ok: false, error: 'No se pudo enviar el email de alertas' }),
        { status: 502 },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, enviado: true, alertas: alertas.length }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('send-alertas: error inesperado', e);
    return new Response(
      JSON.stringify({ ok: false, error: 'Error interno al procesar las alertas' }),
      { status: 500 },
    );
  }
});
