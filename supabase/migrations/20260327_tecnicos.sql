-- ============================================================
-- MIGRACIÓN: Tabla de catálogo de técnicos
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- ─── Tabla principal ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tecnicos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre       TEXT NOT NULL,
  cargo        TEXT,          -- Jefe Técnico, Técnico Instalador, Auxiliar, etc.
  especialidad TEXT,          -- Electrónica, Refrigeración, Software, etc.
  telefono     TEXT,
  email        TEXT,
  activo       BOOLEAN NOT NULL DEFAULT true,
  notas        TEXT,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  creado_por   UUID REFERENCES profiles(id)
);

-- ─── Columna de referencia en ordenes_tecnicos ────────────────────────────────

ALTER TABLE ordenes_tecnicos
  ADD COLUMN IF NOT EXISTS tecnico_catalogo_id UUID REFERENCES tecnicos(id) ON DELETE SET NULL;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE tecnicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden leer tecnicos"
  ON tecnicos FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios no-viewer pueden escribir tecnicos"
  ON tecnicos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.rol <> 'viewer'
    )
  );

-- ─── Index útil ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tecnicos_activo ON tecnicos(activo);
