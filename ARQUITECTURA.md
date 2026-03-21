# HEXA GESTIÓN — Arquitectura del Sistema
## Sistema de Gestión Comercial, Operativa y Documental Integrado
### Hexa Servicios Integrales SAS | Ing. Luis Gastón Alarcón

---

## 1. ARQUITECTURA GENERAL

```
hexa-gestion/
├── app/
│   ├── (auth)/                    # Rutas de autenticación
│   │   ├── login/page.tsx
│   │   └── callback/route.ts
│   ├── (dashboard)/               # Rutas protegidas del sistema
│   │   ├── layout.tsx             # Layout con sidebar + topbar
│   │   ├── page.tsx               # Dashboard principal con KPIs
│   │   ├── clientes/
│   │   │   ├── page.tsx           # Listado con filtros y búsqueda
│   │   │   ├── nuevo/page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx       # Ficha completa del cliente
│   │   │       └── editar/page.tsx
│   │   ├── presupuestos/
│   │   │   ├── page.tsx
│   │   │   ├── nuevo/page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx       # Ver presupuesto completo
│   │   │       ├── editar/page.tsx
│   │   │       └── pdf/page.tsx   # Preview PDF
│   │   ├── ordenes/
│   │   ├── notas-pedido/
│   │   ├── remitos/
│   │   ├── facturas/
│   │   ├── recibos/
│   │   ├── calendario/
│   │   └── reportes/
│   ├── api/
│   │   ├── clientes/route.ts      # GET, POST
│   │   ├── clientes/[id]/route.ts # GET, PATCH, DELETE
│   │   ├── presupuestos/route.ts
│   │   ├── presupuestos/[id]/
│   │   │   ├── route.ts
│   │   │   └── aprobar/route.ts
│   │   ├── ordenes/
│   │   ├── notas-pedido/
│   │   ├── remitos/
│   │   ├── facturas/
│   │   │   └── [id]/afip/route.ts # Integración AFIP/ARCA
│   │   ├── recibos/
│   │   ├── calendario/route.ts
│   │   └── documentos/
│   │       └── pdf/route.ts       # Generación PDF unificada
│   └── actions/                   # Server Actions de Next.js
│       ├── clientes.ts
│       ├── presupuestos.ts
│       ├── ordenes.ts
│       ├── facturacion.ts
│       └── documentos.ts
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── TopBar.tsx
│   ├── ui/                        # Componentes base reutilizables
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Table.tsx
│   │   ├── Modal.tsx
│   │   ├── Badge.tsx
│   │   ├── Card.tsx
│   │   └── ...
│   └── modules/                   # Componentes específicos por módulo
│       ├── clientes/
│       │   ├── ClienteForm.tsx
│       │   ├── ClienteCard.tsx
│       │   ├── ClienteKPIs.tsx
│       │   └── DireccionForm.tsx
│       ├── presupuestos/
│       │   ├── PresupuestoForm.tsx
│       │   ├── ItemsTable.tsx
│       │   ├── IncidenciasMatrix.tsx
│       │   └── PresupuestoEstado.tsx
│       ├── ordenes/
│       ├── facturas/
│       └── calendario/
├── hooks/                         # Custom hooks React
│   ├── useClientes.ts
│   ├── usePresupuestos.ts
│   └── useCalendario.ts
├── lib/
│   ├── supabase/
│   │   ├── server.ts              # Cliente para Server Components
│   │   └── client.ts              # Cliente para Client Components
│   ├── validations/
│   │   └── index.ts               # Schemas Zod
│   ├── pdf/                       # Generadores PDF por tipo
│   │   ├── presupuesto.ts
│   │   ├── factura.ts
│   │   ├── orden.ts
│   │   ├── remito.ts
│   │   └── recibo.ts
│   ├── afip/                      # Integración AFIP/ARCA (etapa 2)
│   │   ├── facturacion.ts
│   │   └── remitos.ts
│   ├── calculos.ts                # Lógica económica pura
│   ├── audit.ts                   # Registro de auditoría
│   └── utils.ts                   # Utilidades generales
├── types/
│   ├── index.ts                   # Re-exporta todo
│   ├── database.ts                # Enums y tipos base
│   ├── clientes.ts
│   ├── presupuestos.ts            # Presupuestos + Órdenes
│   ├── facturacion.ts             # Facturas + Remitos + Recibos + NP
│   ├── documentos.ts              # Documentos + PDF + Calendario
│   └── api.ts                     # Respuestas API
├── supabase/
│   └── schema.sql                 # Esquema completo de BD
└── proxy.ts                       # Protección de rutas
```

---

## 2. FLUJO DE TRAZABILIDAD (CICLO COMPLETO)

```
CLIENTE
  │
  ├─→ PRESUPUESTO (PST-2026-XXXX)
  │       │ Estado: BORRADOR → ENVIADO → APROBADO
  │       │
  │       └─→ ORDEN DE SERVICIO (OS-2026-XXXX) [auto al aprobar]
  │               │ Asignación de técnicos
  │               │ Fechas de ejecución
  │               │
  │               ├─→ NOTA DE PEDIDO (NP-2026-XXXX) [materiales]
  │               │
  │               └─→ REMITO (REM-2026-XXXX) [entrega]
  │                       │
  │                       └─→ FACTURA (FAC-2026-XXXX)
  │                               │ Integración AFIP/ARCA
  │                               │ CAE automático
  │                               │
  │                               └─→ RECIBO (REC-2026-XXXX)
  │                                       Anticipo / Parcial / Final
  │
  └─→ CALENDARIO (eventos automáticos en cada etapa)
      AUDIT LOG (trazabilidad completa de cambios)
```

---

## 3. MÓDULOS Y PLAN MVP

### FASE 1 — MVP Core (semanas 1-6)
- [x] Infraestructura: Next.js + Supabase + Auth
- [x] Esquema de base de datos completo
- [x] Tipos TypeScript / Validaciones Zod
- [ ] Módulo Clientes (CRUD + direcciones)
- [ ] Módulo Presupuestos (generación + cálculos)
- [ ] Módulo Órdenes de Servicio
- [ ] Generación de PDFs (presupuesto + OS)
- [ ] Dashboard con KPIs básicos

### FASE 2 — Documentación Comercial (semanas 7-10)
- [ ] Notas de Pedido y Recepción
- [ ] Remitos Internos
- [ ] Módulo de Facturación (sin AFIP)
- [ ] Módulo de Recibos
- [ ] PDF para todos los documentos

### FASE 3 — Integraciones (semanas 11-14)
- [ ] Integración AFIP/ARCA (facturación electrónica)
- [ ] Remitos Legales con CAI/CAE
- [ ] Calendario integrado completo
- [ ] Reportes y análisis lineal

### FASE 4 — Evolución (semanas 15+)
- [ ] Control de permisos granular por usuario
- [ ] Notificaciones y alertas
- [ ] API pública para integraciones
- [ ] App mobile (React Native)

---

## 4. DECISIONES TÉCNICAS

### Base de Datos
- **PostgreSQL via Supabase**: confiable, escalable, SQL estándar
- **Row Level Security**: seguridad a nivel de fila habilitada
- **Funciones PL/pgSQL**: numeración correlativa, triggers de auditoría
- **Índices GIN**: búsqueda full-text eficiente con `pg_trgm`

### Generación de PDFs
- **PDFKit**: ligero, sin browser headless, genera Buffer en memoria
- **Regeneración desde BD**: cada PDF siempre refleja datos actuales
- **Almacenamiento opcional**: Supabase Storage para cachear PDFs generados

### Seguridad
- **Server Actions**: toda mutación pasa por servidor, nunca expone lógica
- **Zod en backend y frontend**: doble validación
- **Audit Log**: cada CREATE/UPDATE/DELETE queda registrado con usuario e IP
- **RLS de Supabase**: política de acceso a nivel de base de datos

### Escalabilidad AFIP/ARCA
- Módulo `/lib/afip/` preparado para inyectar certificados
- Columnas `cae`, `cae_vencimiento`, `numero_afip` ya en facturas y remitos
- La integración se activa en Fase 3 sin cambios de esquema

---

## 5. COMANDOS DE INICIO

```bash
# 1. Clonar e instalar
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# → Completar con credenciales de Supabase

# 3. Aplicar esquema en Supabase
# Ir a Supabase Dashboard > SQL Editor
# Ejecutar: supabase/schema.sql

# 4. Levantar en desarrollo
npm run dev

# 5. Generar tipos desde Supabase (opcional)
npm run db:types
```
