-- ============================================================
-- HEXA SERVICIOS INTEGRALES SAS
-- Sistema de Gestión Comercial, Operativa y Documental
-- Esquema de Base de Datos - Supabase (PostgreSQL)
-- Autor: Arquitectura generada para Ing. Luis Gastón Alarcón
-- Fecha: 2026
-- ============================================================

-- ============================================================
-- EXTENSIONES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Búsqueda full-text eficiente

-- ============================================================
-- ENUMERACIONES
-- ============================================================

CREATE TYPE tipo_documento AS ENUM (
  'DNI', 'CUIT', 'CUIL', 'PASAPORTE', 'LE', 'LC'
);

CREATE TYPE condicion_iva AS ENUM (
  'RESPONSABLE_INSCRIPTO',
  'MONOTRIBUTISTA',
  'EXENTO',
  'CONSUMIDOR_FINAL',
  'NO_RESPONSABLE'
);

CREATE TYPE tipo_operacion AS ENUM (
  'PRODUCTO',
  'SERVICIO',
  'PRODUCTO_SERVICIO'
);

CREATE TYPE estado_presupuesto AS ENUM (
  'BORRADOR',
  'ENVIADO',
  'APROBADO',
  'RECHAZADO',
  'VENCIDO'
);

CREATE TYPE estado_orden AS ENUM (
  'PENDIENTE',
  'EN_PROGRESO',
  'COMPLETADA',
  'CANCELADA',
  'SUSPENDIDA'
);

CREATE TYPE estado_factura AS ENUM (
  'BORRADOR',
  'EMITIDA',
  'PENDIENTE_COBRO',
  'COBRADA_PARCIAL',
  'COBRADA',
  'ANULADA'
);

CREATE TYPE tipo_remito AS ENUM (
  'INTERNO_ENTRADA',
  'INTERNO_SALIDA',
  'LEGAL_ENTRADA',
  'LEGAL_SALIDA'
);

CREATE TYPE estado_remito AS ENUM (
  'BORRADOR',
  'EMITIDO',
  'ENTREGADO',
  'ANULADO'
);

CREATE TYPE tipo_recibo AS ENUM (
  'ANTICIPO',
  'PAGO_PARCIAL',
  'PAGO_FINAL',
  'DEVOLUCION'
);

CREATE TYPE tipo_comprobante_afip AS ENUM (
  'FACTURA_A',
  'FACTURA_B',
  'FACTURA_C',
  'NOTA_DEBITO_A',
  'NOTA_DEBITO_B',
  'NOTA_CREDITO_A',
  'NOTA_CREDITO_B',
  'REMITO_R'
);

CREATE TYPE tipo_evento_calendario AS ENUM (
  'SERVICIO_PROGRAMADO',
  'SERVICIO_EJECUTADO',
  'VENCIMIENTO_FACTURA',
  'COBRO_CHEQUE',
  'PAGO_CHEQUE',
  'VENCIMIENTO_PLAN_PAGO',
  'VENCIMIENTO_POLIZA',
  'PAGO_CLIENTE',
  'VENCIMIENTO_SERVICIO_CONTINUO'
);

CREATE TYPE tipo_pago AS ENUM (
  'EFECTIVO',
  'TRANSFERENCIA',
  'CHEQUE',
  'TARJETA_DEBITO',
  'TARJETA_CREDITO',
  'CREDITO_CUENTA'
);

-- ============================================================
-- TABLA: profiles (usuarios del sistema)
-- ============================================================
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  apellido        TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  rol             TEXT NOT NULL DEFAULT 'operador' CHECK (rol IN ('superadmin', 'admin', 'supervisor', 'operador', 'viewer')),
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_url      TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: clientes
-- ============================================================
CREATE TABLE clientes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Datos fiscales
  razon_social        TEXT NOT NULL,
  nombre_fantasia     TEXT,
  tipo_documento      tipo_documento NOT NULL DEFAULT 'CUIT',
  numero_documento    TEXT NOT NULL,
  cuit                TEXT UNIQUE,
  condicion_iva       condicion_iva NOT NULL DEFAULT 'RESPONSABLE_INSCRIPTO',
  ingresos_brutos     TEXT,
  -- Datos comerciales
  email               TEXT,
  email_facturacion   TEXT,
  telefono            TEXT,
  telefono_alt        TEXT,
  sitio_web           TEXT,
  contacto_nombre     TEXT,
  contacto_cargo      TEXT,
  -- Clasificación
  segmento            TEXT, -- ej: 'HVAC', 'Solar', 'Obra Civil', etc.
  origen              TEXT, -- ej: 'Referido', 'Web', 'Llamada', etc.
  notas               TEXT,
  activo              BOOLEAN NOT NULL DEFAULT TRUE,
  -- Auditoría
  creado_por          UUID REFERENCES profiles(id),
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: clientes_direcciones
-- ============================================================
CREATE TABLE clientes_direcciones (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  etiqueta        TEXT NOT NULL, -- ej: 'Casa Central', 'Planta Norte', 'Obra Ruta 9'
  calle           TEXT NOT NULL,
  numero          TEXT,
  piso_dpto       TEXT,
  barrio          TEXT,
  ciudad          TEXT NOT NULL,
  provincia       TEXT NOT NULL DEFAULT 'Chaco',
  codigo_postal   TEXT,
  pais            TEXT NOT NULL DEFAULT 'Argentina',
  es_principal    BOOLEAN NOT NULL DEFAULT FALSE,
  latitud         DECIMAL(10,8),
  longitud        DECIMAL(11,8),
  distancia_km    DECIMAL(10,2), -- desde sede empresa, para cálculo de viáticos
  notas           TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: servicios_catalogo (catálogo de servicios/productos)
-- ============================================================
CREATE TABLE servicios_catalogo (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo          TEXT UNIQUE,
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  tipo            tipo_operacion NOT NULL DEFAULT 'SERVICIO',
  unidad_medida   TEXT NOT NULL DEFAULT 'UN', -- UN, HS, M2, M3, KG, etc.
  precio_base     DECIMAL(15,2),
  costo_base      DECIMAL(15,2),
  categoria       TEXT, -- HVAC, Solar, Civil, Eléctrico, etc.
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: presupuestos
-- ============================================================
CREATE TABLE presupuestos (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero              TEXT NOT NULL UNIQUE, -- PST-2026-0001
  cliente_id          UUID NOT NULL REFERENCES clientes(id),
  direccion_id        UUID REFERENCES clientes_direcciones(id),
  -- Descripción
  titulo              TEXT NOT NULL,
  objetivo_servicio   TEXT NOT NULL, -- ej: 'Instalación HVAC Planta Norte'
  tipo_operacion      tipo_operacion NOT NULL DEFAULT 'SERVICIO',
  descripcion         TEXT,
  -- Validez
  fecha_emision       DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento   DATE,
  -- Estructura económica
  subtotal_items      DECIMAL(15,2) NOT NULL DEFAULT 0,
  subtotal_incidencias DECIMAL(15,2) NOT NULL DEFAULT 0,
  descuento_pct       DECIMAL(5,2) DEFAULT 0,
  descuento_monto     DECIMAL(15,2) DEFAULT 0,
  subtotal            DECIMAL(15,2) NOT NULL DEFAULT 0,
  iva_pct             DECIMAL(5,2) DEFAULT 21,
  iva_monto           DECIMAL(15,2) DEFAULT 0,
  otros_impuestos     DECIMAL(15,2) DEFAULT 0,
  total               DECIMAL(15,2) NOT NULL DEFAULT 0,
  -- Márgenes (solo uso interno)
  costo_total         DECIMAL(15,2),
  margen_pct          DECIMAL(5,2),
  margen_monto        DECIMAL(15,2),
  -- Estado
  estado              estado_presupuesto NOT NULL DEFAULT 'BORRADOR',
  -- Condiciones
  condiciones_pago    TEXT,
  tiempo_ejecucion    TEXT,
  garantia            TEXT,
  notas_internas      TEXT,
  notas_cliente       TEXT,
  -- Auditoría
  creado_por          UUID REFERENCES profiles(id),
  aprobado_por        UUID REFERENCES profiles(id),
  aprobado_en         TIMESTAMPTZ,
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: presupuestos_items
-- ============================================================
CREATE TABLE presupuestos_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  presupuesto_id      UUID NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  servicio_id         UUID REFERENCES servicios_catalogo(id),
  orden               INTEGER NOT NULL DEFAULT 0,
  descripcion         TEXT NOT NULL,
  detalle             TEXT,
  cantidad            DECIMAL(10,3) NOT NULL DEFAULT 1,
  unidad_medida       TEXT NOT NULL DEFAULT 'UN',
  precio_unitario     DECIMAL(15,2) NOT NULL DEFAULT 0,
  costo_unitario      DECIMAL(15,2) DEFAULT 0,
  descuento_pct       DECIMAL(5,2) DEFAULT 0,
  subtotal            DECIMAL(15,2) NOT NULL DEFAULT 0,
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: presupuestos_incidencias (costos indirectos)
-- ============================================================
CREATE TABLE presupuestos_incidencias (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  presupuesto_id  UUID NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL, -- traslado, viatico, hospedaje, combustible, vianda, equipamiento, sanidad, honorario_externo, pago_tercero, otro
  descripcion     TEXT NOT NULL,
  cantidad        DECIMAL(10,2) DEFAULT 1,
  dias            INTEGER DEFAULT 1,
  distancia_km    DECIMAL(10,2),
  monto_unitario  DECIMAL(15,2) NOT NULL DEFAULT 0,
  subtotal        DECIMAL(15,2) NOT NULL DEFAULT 0,
  es_interno      BOOLEAN DEFAULT TRUE, -- si aparece en el PDF del cliente o solo interno
  notas           TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: ordenes_servicio
-- ============================================================
CREATE TABLE ordenes_servicio (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero              TEXT NOT NULL UNIQUE, -- OS-2026-0001
  presupuesto_id      UUID REFERENCES presupuestos(id),
  cliente_id          UUID NOT NULL REFERENCES clientes(id),
  direccion_id        UUID REFERENCES clientes_direcciones(id),
  -- Descripción
  titulo              TEXT NOT NULL,
  descripcion         TEXT,
  objetivo_tecnico    TEXT,
  -- Planificación
  fecha_inicio        DATE,
  fecha_fin_estimada  DATE,
  fecha_fin_real      DATE,
  -- Estado
  estado              estado_orden NOT NULL DEFAULT 'PENDIENTE',
  porcentaje_avance   INTEGER DEFAULT 0 CHECK (porcentaje_avance BETWEEN 0 AND 100),
  -- Notas
  notas_tecnicas      TEXT,
  notas_cliente       TEXT,
  observaciones_cierre TEXT,
  -- Auditoría
  creado_por          UUID REFERENCES profiles(id),
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: ordenes_tecnicos (asignación de personal)
-- ============================================================
CREATE TABLE ordenes_tecnicos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  orden_id    UUID NOT NULL REFERENCES ordenes_servicio(id) ON DELETE CASCADE,
  tecnico_id  UUID REFERENCES profiles(id),
  nombre      TEXT NOT NULL, -- permite registrar externos
  rol         TEXT, -- Responsable, Auxiliar, Supervisor
  fecha_desde DATE,
  fecha_hasta DATE,
  notas       TEXT
);

-- ============================================================
-- TABLA: notas_pedido
-- ============================================================
CREATE TABLE notas_pedido (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero          TEXT NOT NULL UNIQUE, -- NP-2026-0001
  orden_id        UUID REFERENCES ordenes_servicio(id),
  presupuesto_id  UUID REFERENCES presupuestos(id),
  cliente_id      UUID REFERENCES clientes(id),
  proveedor       TEXT,
  fecha_pedido    DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_requerida DATE,
  fecha_recepcion DATE,
  estado          TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'PARCIAL', 'RECIBIDO', 'ANULADO')),
  notas           TEXT,
  creado_por      UUID REFERENCES profiles(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: notas_pedido_items
-- ============================================================
CREATE TABLE notas_pedido_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nota_pedido_id  UUID NOT NULL REFERENCES notas_pedido(id) ON DELETE CASCADE,
  descripcion     TEXT NOT NULL,
  unidad_medida   TEXT DEFAULT 'UN',
  cantidad_pedida DECIMAL(10,3) NOT NULL DEFAULT 1,
  cantidad_recibida DECIMAL(10,3) DEFAULT 0,
  precio_unitario DECIMAL(15,2),
  subtotal        DECIMAL(15,2),
  notas           TEXT
);

-- ============================================================
-- TABLA: remitos
-- ============================================================
CREATE TABLE remitos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero          TEXT NOT NULL UNIQUE, -- REM-2026-0001
  tipo            tipo_remito NOT NULL,
  -- Vínculos
  orden_id        UUID REFERENCES ordenes_servicio(id),
  nota_pedido_id  UUID REFERENCES notas_pedido(id),
  factura_id      UUID, -- FK circular, se agrega después
  cliente_id      UUID REFERENCES clientes(id),
  proveedor       TEXT,
  -- Datos AFIP/ARCA (remitos legales)
  punto_venta     INTEGER,
  numero_afip     BIGINT,
  cai             TEXT,
  cai_vencimiento DATE,
  cae             TEXT,
  fecha_emision   DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Estado
  estado          estado_remito NOT NULL DEFAULT 'BORRADOR',
  -- Datos de entrega
  direccion_entrega TEXT,
  transportista   TEXT,
  patente_vehiculo TEXT,
  chofer          TEXT,
  notas           TEXT,
  -- Auditoría
  creado_por      UUID REFERENCES profiles(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: remitos_items
-- ============================================================
CREATE TABLE remitos_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  remito_id       UUID NOT NULL REFERENCES remitos(id) ON DELETE CASCADE,
  descripcion     TEXT NOT NULL,
  unidad_medida   TEXT DEFAULT 'UN',
  cantidad        DECIMAL(10,3) NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(15,2),
  subtotal        DECIMAL(15,2),
  orden           INTEGER DEFAULT 0
);

-- ============================================================
-- TABLA: facturas
-- ============================================================
CREATE TABLE facturas (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero              TEXT NOT NULL UNIQUE, -- FAC-2026-0001
  -- Tipo AFIP
  tipo_comprobante    tipo_comprobante_afip NOT NULL DEFAULT 'FACTURA_B',
  punto_venta         INTEGER DEFAULT 1,
  numero_afip         BIGINT,
  cae                 TEXT,
  cae_vencimiento     DATE,
  -- Vínculos
  presupuesto_id      UUID REFERENCES presupuestos(id),
  orden_id            UUID REFERENCES ordenes_servicio(id),
  remito_id           UUID REFERENCES remitos(id),
  cliente_id          UUID NOT NULL REFERENCES clientes(id),
  -- Datos del período
  fecha_emision       DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento   DATE,
  periodo_desde       DATE,
  periodo_hasta       DATE,
  -- Montos
  subtotal            DECIMAL(15,2) NOT NULL DEFAULT 0,
  descuento_monto     DECIMAL(15,2) DEFAULT 0,
  iva_pct             DECIMAL(5,2) DEFAULT 21,
  iva_monto           DECIMAL(15,2) DEFAULT 0,
  otros_impuestos     DECIMAL(15,2) DEFAULT 0,
  total               DECIMAL(15,2) NOT NULL DEFAULT 0,
  saldo_pendiente     DECIMAL(15,2) NOT NULL DEFAULT 0,
  -- Estado
  estado              estado_factura NOT NULL DEFAULT 'BORRADOR',
  -- Datos adicionales
  condicion_venta     TEXT DEFAULT '30 días',
  notas               TEXT,
  -- Auditoría
  creado_por          UUID REFERENCES profiles(id),
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK circular remito → factura
ALTER TABLE remitos ADD CONSTRAINT fk_remito_factura
  FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE SET NULL;

-- ============================================================
-- TABLA: facturas_items
-- ============================================================
CREATE TABLE facturas_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  factura_id      UUID NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  descripcion     TEXT NOT NULL,
  detalle         TEXT,
  cantidad        DECIMAL(10,3) NOT NULL DEFAULT 1,
  unidad_medida   TEXT DEFAULT 'UN',
  precio_unitario DECIMAL(15,2) NOT NULL DEFAULT 0,
  descuento_pct   DECIMAL(5,2) DEFAULT 0,
  iva_pct         DECIMAL(5,2) DEFAULT 21,
  subtotal        DECIMAL(15,2) NOT NULL DEFAULT 0,
  orden           INTEGER DEFAULT 0
);

-- ============================================================
-- TABLA: recibos
-- ============================================================
CREATE TABLE recibos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero          TEXT NOT NULL UNIQUE, -- REC-2026-0001
  factura_id      UUID REFERENCES facturas(id),
  cliente_id      UUID NOT NULL REFERENCES clientes(id),
  tipo            tipo_recibo NOT NULL DEFAULT 'PAGO_FINAL',
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  monto           DECIMAL(15,2) NOT NULL,
  tipo_pago       tipo_pago NOT NULL DEFAULT 'TRANSFERENCIA',
  -- Datos de cheque (si aplica)
  cheque_banco    TEXT,
  cheque_numero   TEXT,
  cheque_fecha    DATE,
  cheque_titular  TEXT,
  -- Notas
  concepto        TEXT,
  notas           TEXT,
  -- Auditoría
  creado_por      UUID REFERENCES profiles(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: documentos (archivos adjuntos)
-- ============================================================
CREATE TABLE documentos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Vínculo polimórfico
  entidad_tipo    TEXT NOT NULL, -- cliente, presupuesto, orden, factura, remito, recibo
  entidad_id      UUID NOT NULL,
  -- Datos del archivo
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  tipo_mime       TEXT NOT NULL,
  tamanio_bytes   INTEGER,
  storage_path    TEXT NOT NULL, -- path en Supabase Storage
  publico         BOOLEAN DEFAULT FALSE,
  -- Auditoría
  subido_por      UUID REFERENCES profiles(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: eventos_calendario
-- ============================================================
CREATE TABLE eventos_calendario (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo            tipo_evento_calendario NOT NULL,
  titulo          TEXT NOT NULL,
  descripcion     TEXT,
  fecha_inicio    TIMESTAMPTZ NOT NULL,
  fecha_fin       TIMESTAMPTZ,
  todo_el_dia     BOOLEAN DEFAULT TRUE,
  -- Vínculo
  entidad_tipo    TEXT, -- presupuesto, orden, factura, remito, recibo, cheque
  entidad_id      UUID,
  cliente_id      UUID REFERENCES clientes(id),
  -- Estado
  completado      BOOLEAN DEFAULT FALSE,
  color           TEXT, -- hex color para el calendario
  -- Auditoría
  creado_por      UUID REFERENCES profiles(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: audit_log (trazabilidad completa)
-- ============================================================
CREATE TABLE audit_log (
  id              BIGSERIAL PRIMARY KEY,
  usuario_id      UUID REFERENCES profiles(id),
  accion          TEXT NOT NULL, -- CREATE, UPDATE, DELETE, VIEW, PRINT, SEND
  entidad_tipo    TEXT NOT NULL,
  entidad_id      UUID NOT NULL,
  datos_anteriores JSONB,
  datos_nuevos    JSONB,
  ip_address      INET,
  user_agent      TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: numeradores (secuencias por tipo de documento)
-- ============================================================
CREATE TABLE numeradores (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo            TEXT NOT NULL UNIQUE, -- presupuesto, orden, nota_pedido, remito, factura, recibo
  prefijo         TEXT NOT NULL,
  ultimo_numero   INTEGER NOT NULL DEFAULT 0,
  anio            INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insertar numeradores iniciales
INSERT INTO numeradores (tipo, prefijo, ultimo_numero) VALUES
  ('presupuesto',  'PST', 0),
  ('orden',        'OS',  0),
  ('nota_pedido',  'NP',  0),
  ('remito',       'REM', 0),
  ('factura',      'FAC', 0),
  ('recibo',       'REC', 0);

-- ============================================================
-- TABLA: configuracion_empresa
-- ============================================================
CREATE TABLE configuracion_empresa (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  razon_social        TEXT NOT NULL DEFAULT 'Hexa Servicios Integrales SAS',
  nombre_fantasia     TEXT DEFAULT 'HEXA',
  cuit                TEXT DEFAULT '30-71703418-6',
  condicion_iva       condicion_iva DEFAULT 'RESPONSABLE_INSCRIPTO',
  ingresos_brutos     TEXT,
  domicilio_fiscal    TEXT,
  telefono            TEXT,
  email               TEXT,
  sitio_web           TEXT,
  logo_url            TEXT,
  -- AFIP/ARCA
  punto_venta_default INTEGER DEFAULT 1,
  certificado_afip    TEXT, -- path al certificado
  clave_afip          TEXT, -- encriptada
  -- PDF
  pie_pagina_pdf      TEXT,
  color_primario      TEXT DEFAULT '#1a1a2e',
  -- Actualizacion
  actualizado_por     UUID REFERENCES profiles(id),
  actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES para rendimiento
-- ============================================================

-- Clientes
CREATE INDEX idx_clientes_cuit ON clientes(cuit);
CREATE INDEX idx_clientes_razon_social ON clientes USING gin(razon_social gin_trgm_ops);
CREATE INDEX idx_clientes_activo ON clientes(activo);

-- Presupuestos
CREATE INDEX idx_presupuestos_cliente ON presupuestos(cliente_id);
CREATE INDEX idx_presupuestos_estado ON presupuestos(estado);
CREATE INDEX idx_presupuestos_fecha ON presupuestos(fecha_emision DESC);
CREATE INDEX idx_presupuestos_numero ON presupuestos(numero);

-- Órdenes
CREATE INDEX idx_ordenes_cliente ON ordenes_servicio(cliente_id);
CREATE INDEX idx_ordenes_presupuesto ON ordenes_servicio(presupuesto_id);
CREATE INDEX idx_ordenes_estado ON ordenes_servicio(estado);

-- Facturas
CREATE INDEX idx_facturas_cliente ON facturas(cliente_id);
CREATE INDEX idx_facturas_estado ON facturas(estado);
CREATE INDEX idx_facturas_fecha ON facturas(fecha_emision DESC);

-- Eventos
CREATE INDEX idx_eventos_fecha ON eventos_calendario(fecha_inicio);
CREATE INDEX idx_eventos_cliente ON eventos_calendario(cliente_id);
CREATE INDEX idx_eventos_tipo ON eventos_calendario(tipo);

-- Audit
CREATE INDEX idx_audit_entidad ON audit_log(entidad_tipo, entidad_id);
CREATE INDEX idx_audit_usuario ON audit_log(usuario_id);
CREATE INDEX idx_audit_fecha ON audit_log(creado_en DESC);

-- Documentos
CREATE INDEX idx_documentos_entidad ON documentos(entidad_tipo, entidad_id);

-- ============================================================
-- FUNCIONES
-- ============================================================

-- Función: generar número correlativo de documento
CREATE OR REPLACE FUNCTION generar_numero_documento(p_tipo TEXT)
RETURNS TEXT AS $$
DECLARE
  v_prefijo     TEXT;
  v_numero      INTEGER;
  v_anio        INTEGER;
  v_resultado   TEXT;
BEGIN
  v_anio := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

  UPDATE numeradores
  SET
    ultimo_numero = CASE WHEN anio = v_anio THEN ultimo_numero + 1 ELSE 1 END,
    anio = v_anio,
    actualizado_en = NOW()
  WHERE tipo = p_tipo
  RETURNING prefijo, ultimo_numero INTO v_prefijo, v_numero;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tipo de numerador no encontrado: %', p_tipo;
  END IF;

  v_resultado := v_prefijo || '-' || v_anio || '-' || LPAD(v_numero::TEXT, 4, '0');
  RETURN v_resultado;
END;
$$ LANGUAGE plpgsql;

-- Función: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS: actualizar updated_at
-- ============================================================
CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_presupuestos_updated_at
  BEFORE UPDATE ON presupuestos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_ordenes_updated_at
  BEFORE UPDATE ON ordenes_servicio
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_facturas_updated_at
  BEFORE UPDATE ON facturas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_remitos_updated_at
  BEFORE UPDATE ON remitos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_notas_pedido_updated_at
  BEFORE UPDATE ON notas_pedido
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_servicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE recibos ENABLE ROW LEVEL SECURITY;
ALTER TABLE remitos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Política base: usuarios autenticados ven todo (se restringe por rol en la app)
-- En producción esto se reemplaza por políticas granulares por rol

CREATE POLICY "Usuarios autenticados pueden leer clientes"
  ON clientes FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden leer presupuestos"
  ON presupuestos FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden leer facturas"
  ON facturas FOR SELECT USING (auth.role() = 'authenticated');

-- Los viewers no pueden escribir (la app maneja el control fino)
CREATE POLICY "Usuarios no-viewer pueden escribir clientes"
  ON clientes FOR ALL USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol != 'viewer')
  );

-- Audit: solo lectura para admin/superadmin
CREATE POLICY "Solo admin puede leer audit log"
  ON audit_log FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('superadmin', 'admin'))
  );
