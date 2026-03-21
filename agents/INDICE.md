# HEXA GESTIÓN — Ecosistema de Agentes
## Índice Maestro del Sistema Multi-Agente
### Hexa Servicios Integrales SAS | Ing. Luis Gastón Alarcón

---

## Resumen del ecosistema

El sistema está compuesto por **16 agentes especializados**, cada uno con responsabilidades exclusivas y sin solapamiento. Los agentes se comunican entre sí a través de interfaces bien definidas, siguiendo el principio de responsabilidad única.

---

## Listado completo de agentes

| # | Archivo | Rol | Capa |
|---|---------|-----|------|
| 1 | `arquitecto-sistema.md` | Arquitectura global, convenciones y estructura del proyecto | Transversal |
| 2 | `base-de-datos.md` | Esquema SQL, migraciones, funciones PL/pgSQL, RLS | Infraestructura |
| 3 | `tipos.md` | Sistema de tipos TypeScript, DTOs, interfaces en `/types` | Infraestructura |
| 4 | `seguridad.md` | Auth, permisos, RLS, middleware, roles de usuario | Infraestructura |
| 5 | `api.md` | Rutas API REST en `/app/api`, contratos de entrada/salida | Infraestructura |
| 6 | `ui.md` | Componentes React, formularios, layouts, hooks de UI | Presentación |
| 7 | `calculos-economicos.md` | Funciones puras de cálculo: totales, IVA, márgenes, equilibrio | Lógica compartida |
| 8 | `auditoria-trazabilidad.md` | Registro de audit_log, historial de documentos, trazabilidad | Transversal |
| 9 | `workflow.md` | Flujos entre módulos, efectos secundarios, diagramas de proceso | Transversal |
| 10 | `configuracion-empresa.md` | Datos de la empresa, catálogo de servicios, numeradores | Módulo |
| 11 | `clientes.md` | Módulo clientes: ficha, direcciones, historial, KPIs | Módulo |
| 12 | `presupuestos.md` | Módulo presupuestos: ciclo de vida, ítems, incidencias | Módulo |
| 13 | `ordenes-servicio.md` | Módulo órdenes: asignación técnicos, avance, cierre | Módulo |
| 14 | `notas-pedido.md` | Módulo notas de pedido y recepción de materiales | Módulo |
| 15 | `remitos.md` | Módulo remitos internos y legales | Módulo |
| 16 | `facturacion.md` | Módulo facturación: tipos AFIP, estados de cobro | Módulo |
| 17 | `recibos.md` | Módulo recibos: cobros, cheques, estado de cuenta | Módulo |
| 18 | `calendario.md` | Módulo calendario: eventos, vencimientos, alertas | Módulo |
| 19 | `documentos-pdf.md` | Generación PDF con PDFKit, almacenamiento de adjuntos | Módulo |
| 20 | `reportes.md` | Dashboard de KPIs, análisis lineal, exportaciones | Módulo |
| 21 | `integracion-afip.md` | Integración AFIP/ARCA: CAE, CAI, QR, WSAA, WSFE | Integración externa |

**Total: 21 agentes**

---

## Mapa de dependencias entre agentes

```
                    ┌─────────────────────────────────┐
                    │       arquitecto-sistema         │
                    └──────────────┬──────────────────┘
                                   │ define contratos
            ┌──────────────────────┼────────────────────────┐
            │                      │                        │
     ┌──────▼──────┐      ┌────────▼───────┐      ┌────────▼───────┐
     │  base-de-datos│     │     tipos      │      │   seguridad    │
     └──────┬──────┘      └────────┬───────┘      └────────┬───────┘
            │                      │                        │
            └──────────────────────┼────────────────────────┘
                                   │ todos consumen
                    ┌──────────────▼──────────────────┐
                    │           api   ui               │
                    └──────────────┬──────────────────┘
                                   │
          ┌────────────────────────┼──────────────────────────┐
          │                        │                          │
   ┌──────▼──────┐         ┌───────▼──────┐         ┌────────▼──────┐
   │   clientes  │         │ presupuestos │         │   facturacion  │
   └─────────────┘         └───────┬──────┘         └────────┬──────┘
                                   │ aprueba                  │ emite
                            ┌──────▼──────┐          ┌───────▼──────┐
                            │ordenes-     │          │   recibos     │
                            │servicio     │          └───────┬───────┘
                            └──────┬──────┘                  │ notifica
                                   │                  ┌───────▼──────┐
                            ┌──────▼──────┐          │  calendario   │
                            │notas-pedido │          └──────────────┘
                            └──────┬──────┘
                                   │
                            ┌──────▼──────┐
                            │   remitos   │
                            └──────┬──────┘
                                   │ legal
                            ┌──────▼──────┐
                            │integracion- │
                            │   afip      │
                            └─────────────┘

Transversales (conectan con todos):
  auditoria-trazabilidad ──── todos los módulos
  calculos-economicos ──────── presupuestos, facturacion, reportes
  workflow ─────────────────── documenta todos los flujos
  configuracion-empresa ────── documentos-pdf, integracion-afip
  documentos-pdf ───────────── todos los módulos (generación PDF)
```

---

## Cobertura de módulos requeridos

| Módulo requerido | Agente responsable |
|-----------------|-------------------|
| Clientes | `clientes` |
| Presupuestos | `presupuestos` + `calculos-economicos` |
| Órdenes de servicio | `ordenes-servicio` |
| Notas de pedido y recepción | `notas-pedido` |
| Remitos internos y legales | `remitos` + `integracion-afip` |
| Facturación | `facturacion` + `integracion-afip` |
| Recibos | `recibos` |
| Calendario | `calendario` |
| Documentos y PDFs | `documentos-pdf` |
| Seguridad | `seguridad` |
| Base de datos | `base-de-datos` |
| API | `api` |
| UI | `ui` |
| Auditoría y trazabilidad | `auditoria-trazabilidad` |

✅ Cobertura completa de todos los módulos requeridos.

---

## Principios del ecosistema

1. **Sin solapamiento**: cada responsabilidad pertenece a exactamente un agente.
2. **Interfaces explícitas**: los agentes se comunican a través de funciones tipadas, no por acoplamiento directo.
3. **Security by Design**: el agente `seguridad` es consultado por todos antes de cualquier operación sensible.
4. **Trazabilidad garantizada**: el agente `auditoria-trazabilidad` cubre toda la cadena de documentos.
5. **Escalabilidad**: el agente `integracion-afip` está diseñado para activarse en Fase 3 sin impactar los módulos existentes.
6. **Funciones puras separadas**: `calculos-economicos` garantiza que la lógica matemática es testeable en aislamiento.
