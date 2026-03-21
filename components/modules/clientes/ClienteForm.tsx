'use client'

// ============================================================
// components/modules/clientes/ClienteForm.tsx
// Formulario multi-paso de alta de cliente
// Tipado estricto con tipos del sistema y validación Zod
// ============================================================

import { useState, useCallback, useRef, CSSProperties, ReactNode } from 'react'
import type { CondicionIVA, TipoDocumento } from '@/types/database'
import type { CrearClienteDTO, CrearDireccionDTO } from '@/types/clientes'
import { ClienteSchema, DireccionSchema } from '@/lib/validations'
import type { ClienteFormValues } from '@/lib/validations'
import type { ZodFormattedError } from 'zod'

// ─── Constantes de configuración ─────────────────────────────────────────────

const CONDICIONES_IVA: { value: CondicionIVA; label: string }[] = [
  { value: 'RESPONSABLE_INSCRIPTO', label: 'Responsable Inscripto' },
  { value: 'MONOTRIBUTISTA',        label: 'Monotributista' },
  { value: 'EXENTO',                label: 'Exento' },
  { value: 'CONSUMIDOR_FINAL',      label: 'Consumidor Final' },
  { value: 'NO_RESPONSABLE',        label: 'No Responsable' },
]

const TIPOS_DOCUMENTO: { value: TipoDocumento; label: string }[] = [
  { value: 'CUIT',      label: 'CUIT' },
  { value: 'CUIL',      label: 'CUIL' },
  { value: 'DNI',       label: 'DNI' },
  { value: 'PASAPORTE', label: 'Pasaporte' },
]

const SEGMENTOS: string[] = [
  'HVAC / Climatización',
  'Energía Solar / Fotovoltaica',
  'Obra Civil',
  'Instalaciones Eléctricas',
  'Automatización Industrial',
  'Servicios Técnicos',
  'Otros',
]

const ORIGENES: string[] = [
  'Referido por cliente',
  'Sitio web',
  'LinkedIn',
  'Llamada entrante',
  'Red de contactos',
  'Licitación',
  'Otros',
]

const PROVINCIAS: string[] = [
  'Buenos Aires', 'Chaco', 'Córdoba', 'Corrientes', 'Entre Ríos',
  'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza',
  'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
  'Tierra del Fuego', 'Tucumán', 'CABA',
]

// ─── Tipos locales del formulario ─────────────────────────────────────────────

/** Estado del formulario — extiende ClienteFormValues con el campo de dirección anidado */
interface FormState {
  razon_social: string
  nombre_fantasia: string
  tipo_documento: TipoDocumento
  numero_documento: string
  cuit: string
  condicion_iva: CondicionIVA | ''
  ingresos_brutos: string
  email: string
  email_facturacion: string
  telefono: string
  telefono_alt: string
  sitio_web: string
  contacto_nombre: string
  contacto_cargo: string
  segmento: string
  origen: string
  notas: string
  direccion: DireccionFormState
}

interface DireccionFormState {
  etiqueta: string
  calle: string
  numero: string
  piso_dpto: string
  barrio: string
  ciudad: string
  provincia: string
  codigo_postal: string
  distancia_km: string  // string para el input; se convierte a number al enviar
}

/** Errores por campo — strings de mensaje de error */
type FormErrors = Partial<Record<keyof FormState | keyof DireccionFormState, string>>

/** Dirección de animación entre pasos */
type AnimDir = 'forward' | 'back'

/** Definición de cada paso del formulario */
interface Step {
  id: number
  label: string
  icon: string
  desc: string
}

// ─── Definición de pasos ──────────────────────────────────────────────────────

const STEPS: Step[] = [
  { id: 0, label: 'Datos Fiscales',    icon: '🏛',  desc: 'Razón social, CUIT, condición IVA' },
  { id: 1, label: 'Datos Comerciales', icon: '📋',  desc: 'Contacto, teléfonos, web' },
  { id: 2, label: 'Dirección',         icon: '📍',  desc: 'Domicilio principal del cliente' },
  { id: 3, label: 'Clasificación',     icon: '🏷',  desc: 'Segmento, origen y notas' },
]

// ─── Estado inicial ───────────────────────────────────────────────────────────

const initialDireccion: DireccionFormState = {
  etiqueta:     'Casa Central',
  calle:        '',
  numero:       '',
  piso_dpto:    '',
  barrio:       '',
  ciudad:       '',
  provincia:    'Chaco',
  codigo_postal:'',
  distancia_km: '',
}

const initialData: FormState = {
  razon_social:      '',
  nombre_fantasia:   '',
  tipo_documento:    'CUIT',
  numero_documento:  '',
  cuit:              '',
  condicion_iva:     '',
  ingresos_brutos:   '',
  email:             '',
  email_facturacion: '',
  telefono:          '',
  telefono_alt:      '',
  sitio_web:         '',
  contacto_nombre:   '',
  contacto_cargo:    '',
  segmento:          '',
  origen:            '',
  notas:             '',
  direccion:         initialDireccion,
}

// ─── Helpers de validación ────────────────────────────────────────────────────

/** Verifica el dígito verificador del CUIT argentino */
function validarCUIT(cuit: string): boolean {
  const clean = cuit.replace(/[-\s]/g, '')
  if (!/^\d{11}$/.test(clean)) return false
  const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const sum = mult.reduce((acc, m, i) => acc + parseInt(clean[i]) * m, 0)
  const resto = sum % 11
  const dv = 11 - resto === 11 ? 0 : 11 - resto === 10 ? 9 : 11 - resto
  return dv === parseInt(clean[10])
}

/** Formatea el CUIT con guiones mientras el usuario escribe */
function formatCUIT(val: string): string {
  const clean = val.replace(/\D/g, '').slice(0, 11)
  if (clean.length <= 2)  return clean
  if (clean.length <= 10) return `${clean.slice(0, 2)}-${clean.slice(2)}`
  return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`
}

/**
 * Valida el paso actual usando Zod sobre los campos correspondientes.
 * Retorna un mapa de errores por campo.
 */
function validateStep(step: number, data: FormState): FormErrors {
  const errors: FormErrors = {}

  if (step === 0) {
    // Validar campos fiscales con Zod parcial
    const result = ClienteSchema.pick({
      razon_social:    true,
      tipo_documento:  true,
      numero_documento:true,
      condicion_iva:   true,
      email:           true,
      cuit:            true,
    }).safeParse({
      razon_social:     data.razon_social,
      tipo_documento:   data.tipo_documento,
      numero_documento: data.numero_documento,
      condicion_iva:    data.condicion_iva || undefined,
      email:            data.email || undefined,
      cuit:             data.cuit || undefined,
    })

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors
      if (fieldErrors.razon_social)     errors.razon_social     = fieldErrors.razon_social[0]
      if (fieldErrors.tipo_documento)   errors.tipo_documento   = fieldErrors.tipo_documento[0]
      if (fieldErrors.numero_documento) errors.numero_documento = fieldErrors.numero_documento[0]
      if (fieldErrors.condicion_iva)    errors.condicion_iva    = fieldErrors.condicion_iva[0]
      if (fieldErrors.email)            errors.email            = fieldErrors.email[0]
      if (fieldErrors.cuit)             errors.cuit             = fieldErrors.cuit[0]
    }

    // Validar dígito verificador cuando el CUIT está completo
    if (data.cuit && data.cuit.length === 13 && !validarCUIT(data.cuit)) {
      errors.cuit = 'El CUIT no es válido (dígito verificador incorrecto)'
    }
  }

  if (step === 1) {
    const result = ClienteSchema.pick({ email_facturacion: true }).safeParse({
      email_facturacion: data.email_facturacion || undefined,
    })
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors
      if (fieldErrors.email_facturacion) errors.email_facturacion = fieldErrors.email_facturacion[0]
    }
  }

  if (step === 2) {
    const result = DireccionSchema.pick({ calle: true, ciudad: true }).safeParse({
      calle:  data.direccion.calle,
      ciudad: data.direccion.ciudad,
    })
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors
      if (fieldErrors.calle)  errors.calle  = fieldErrors.calle[0]
      if (fieldErrors.ciudad) errors.ciudad = fieldErrors.ciudad[0]
    }
  }

  return errors
}

/**
 * Convierte el FormState al DTO que espera la Server Action,
 * normalizando strings vacíos a undefined y distancia_km a number.
 */
function formStateToDTO(data: FormState): CrearClienteDTO {
  const dto: CrearClienteDTO = {
    razon_social:      data.razon_social,
    tipo_documento:    data.tipo_documento,
    numero_documento:  data.numero_documento,
    condicion_iva:     data.condicion_iva as CondicionIVA,
    nombre_fantasia:   data.nombre_fantasia   || undefined,
    cuit:              data.cuit              || undefined,
    ingresos_brutos:   data.ingresos_brutos   || undefined,
    email:             data.email             || undefined,
    email_facturacion: data.email_facturacion || undefined,
    telefono:          data.telefono          || undefined,
    telefono_alt:      data.telefono_alt      || undefined,
    sitio_web:         data.sitio_web         || undefined,
    contacto_nombre:   data.contacto_nombre   || undefined,
    contacto_cargo:    data.contacto_cargo    || undefined,
    segmento:          data.segmento          || undefined,
    origen:            data.origen            || undefined,
    notas:             data.notas             || undefined,
  }

  // Incluir dirección solo si tiene al menos calle y ciudad
  if (data.direccion.calle && data.direccion.ciudad) {
    const dir: CrearDireccionDTO = {
      etiqueta:     data.direccion.etiqueta || 'Casa Central',
      calle:        data.direccion.calle,
      ciudad:       data.direccion.ciudad,
      numero:       data.direccion.numero       || undefined,
      piso_dpto:    data.direccion.piso_dpto    || undefined,
      barrio:       data.direccion.barrio       || undefined,
      provincia:    data.direccion.provincia    || undefined,
      codigo_postal:data.direccion.codigo_postal|| undefined,
      es_principal: true,
      distancia_km: data.direccion.distancia_km
        ? parseFloat(data.direccion.distancia_km)
        : undefined,
    }
    dto.direccion_principal = dir
  }

  return dto
}

// ─── Tipos de props de componentes de UI ─────────────────────────────────────

interface FieldWrapperProps {
  label?: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
}

interface InputProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  error?: string
  type?: string
  maxLength?: number
  min?: string
  style?: CSSProperties
}

interface SelectProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  error?: string
  children: ReactNode
}

interface TextareaProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  rows?: number
}

interface BadgeProps {
  children: ReactNode
  color?: 'amber' | 'slate' | 'green'
}

interface StepFiscalProps {
  data: FormState
  onChange: <K extends keyof FormState>(field: K, value: FormState[K]) => void
  errors: FormErrors
}

interface StepComercialProps {
  data: FormState
  onChange: <K extends keyof FormState>(field: K, value: FormState[K]) => void
  errors: FormErrors
}

interface StepDireccionProps {
  data: FormState
  onChange: <K extends keyof FormState>(field: K, value: FormState[K]) => void
  errors: FormErrors
}

interface StepClasificacionProps {
  data: FormState
  onChange: <K extends keyof FormState>(field: K, value: FormState[K]) => void
}

interface ResumenLateralProps {
  data: FormState
  step: number
}

interface StepperProps {
  current: number
  steps: Step[]
  onGoTo: (step: number) => void
}

interface SuccessScreenProps {
  data: FormState
  onNew: () => void
}

interface InfoRowProps {
  label: string
  value: string
}

interface SectionTitleProps {
  icon: string
  title: string
}

// ─── Estilos base compartidos ─────────────────────────────────────────────────

const inputBase: CSSProperties = {
  width:        '100%',
  padding:      '10px 14px',
  background:   'rgba(15, 23, 42, 0.6)',
  border:       '1px solid rgba(148, 163, 184, 0.12)',
  borderRadius: '8px',
  color:        '#e2e8f0',
  fontSize:     '13.5px',
  fontFamily:   "'DM Mono', monospace",
  outline:      'none',
  transition:   'all 0.2s',
  boxSizing:    'border-box',
}

// ─── Componentes de UI base ───────────────────────────────────────────────────

function FieldWrapper({ label, error, hint, required, children }: FieldWrapperProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <label style={{
          fontSize:      '11px',
          fontWeight:    '600',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color:         error ? '#f59e0b' : '#94a3b8',
          display:       'flex',
          alignItems:    'center',
          gap:           '4px',
        }}>
          {label}
          {required && <span style={{ color: '#f59e0b', fontSize: '10px' }}>●</span>}
        </label>
      )}
      {children}
      {error && (
        <div style={{
          fontSize:   '11px',
          color:      '#f59e0b',
          display:    'flex',
          alignItems: 'center',
          gap:        '5px',
          animation:  'slideIn 0.15s ease',
        }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="4.5" stroke="#f59e0b" />
            <line x1="5" y1="3" x2="5" y2="5.5" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="5" cy="7" r="0.6" fill="#f59e0b" />
          </svg>
          {error}
        </div>
      )}
      {hint && !error && (
        <div style={{ fontSize: '11px', color: '#475569' }}>{hint}</div>
      )}
    </div>
  )
}

function Input({ value, onChange, placeholder, error, type = 'text', ...rest }: InputProps) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...inputBase,
        borderColor: error
          ? 'rgba(245, 158, 11, 0.5)'
          : focused
          ? 'rgba(245, 158, 11, 0.4)'
          : 'rgba(148, 163, 184, 0.12)',
        boxShadow: focused
          ? '0 0 0 3px rgba(245, 158, 11, 0.08)'
          : error
          ? '0 0 0 3px rgba(245, 158, 11, 0.05)'
          : 'none',
      }}
      {...rest}
    />
  )
}

function Select({ value, onChange, children, error }: SelectProps) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...inputBase,
          appearance:    'none',
          cursor:        'pointer',
          paddingRight:  '36px',
          borderColor:   error
            ? 'rgba(245, 158, 11, 0.5)'
            : focused
            ? 'rgba(245, 158, 11, 0.4)'
            : 'rgba(148, 163, 184, 0.12)',
          boxShadow: focused ? '0 0 0 3px rgba(245, 158, 11, 0.08)' : 'none',
        }}
      >
        {children}
      </select>
      <div style={{
        position:      'absolute',
        right:         '12px',
        top:           '50%',
        transform:     'translateY(-50%)',
        pointerEvents: 'none',
        color:         '#64748b',
      }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}

function Textarea({ value, onChange, placeholder, rows = 3 }: TextareaProps) {
  const [focused, setFocused] = useState(false)
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...inputBase,
        resize:      'vertical',
        minHeight:   '80px',
        lineHeight:  '1.6',
        fontFamily:  "'DM Sans', sans-serif",
        fontSize:    '13px',
        borderColor: focused ? 'rgba(245, 158, 11, 0.4)' : 'rgba(148, 163, 184, 0.12)',
        boxShadow:   focused ? '0 0 0 3px rgba(245, 158, 11, 0.08)' : 'none',
      }}
    />
  )
}

function Badge({ children, color = 'slate' }: BadgeProps) {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    amber: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)',  text: '#f59e0b' },
    slate: { bg: 'rgba(148,163,184,0.08)',border: 'rgba(148,163,184,0.2)', text: '#94a3b8' },
    green: { bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.25)',  text: '#4ade80' },
  }
  const c = colors[color] ?? colors.slate
  return (
    <span style={{
      background:    c.bg,
      border:        `1px solid ${c.border}`,
      color:         c.text,
      fontSize:      '10px',
      fontWeight:    '700',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      padding:       '2px 8px',
      borderRadius:  '4px',
    }}>
      {children}
    </span>
  )
}

function SectionTitle({ icon, title }: SectionTitleProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
      <span style={{ fontSize: '14px' }}>{icon}</span>
      <span style={{
        fontSize:      '11px',
        fontWeight:    '700',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color:         '#64748b',
      }}>
        {title}
      </span>
    </div>
  )
}

function Divider() {
  return (
    <div style={{
      height:     '1px',
      background: 'linear-gradient(to right, transparent, rgba(148,163,184,0.1), transparent)',
    }} />
  )
}

// ─── Pasos del formulario ─────────────────────────────────────────────────────

function StepFiscal({ data, onChange, errors }: StepFiscalProps) {
  const handleCUIT = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCUIT(e.target.value)
    onChange('cuit', formatted)
    onChange('numero_documento', formatted.replace(/-/g, ''))
  }

  const needsCUIT =
    data.condicion_iva === 'RESPONSABLE_INSCRIPTO' ||
    data.condicion_iva === 'MONOTRIBUTISTA'

  const cuitCompleto = data.cuit?.length === 13
  const cuitValido   = cuitCompleto && validarCUIT(data.cuit)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{
        padding:      '14px 16px',
        background:   'rgba(245, 158, 11, 0.06)',
        border:       '1px solid rgba(245, 158, 11, 0.15)',
        borderRadius: '10px',
        fontSize:     '12px',
        color:        '#94a3b8',
        lineHeight:   '1.6',
      }}>
        <span style={{ color: '#f59e0b', fontWeight: '600' }}>Datos fiscales</span>
        {' '}— Esta información se usará en todos los comprobantes y documentos legales emitidos al cliente.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <FieldWrapper label="Razón Social" required error={errors.razon_social}>
            <Input
              value={data.razon_social}
              onChange={(e) => onChange('razon_social', e.target.value)}
              placeholder="Ej: Construcciones del Norte SRL"
              error={errors.razon_social}
            />
          </FieldWrapper>
        </div>

        <FieldWrapper label="Nombre de Fantasía" hint="Opcional — nombre comercial">
          <Input
            value={data.nombre_fantasia}
            onChange={(e) => onChange('nombre_fantasia', e.target.value)}
            placeholder="Ej: Norte Construcciones"
          />
        </FieldWrapper>

        <FieldWrapper label="Condición IVA" required error={errors.condicion_iva}>
          <Select
            value={data.condicion_iva}
            onChange={(e) => onChange('condicion_iva', e.target.value as CondicionIVA)}
            error={errors.condicion_iva}
          >
            <option value="">Seleccionar...</option>
            {CONDICIONES_IVA.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </FieldWrapper>

        <FieldWrapper label="Tipo de Documento" required error={errors.tipo_documento}>
          <Select
            value={data.tipo_documento}
            onChange={(e) => onChange('tipo_documento', e.target.value as TipoDocumento)}
            error={errors.tipo_documento}
          >
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </FieldWrapper>

        <FieldWrapper
          label={needsCUIT ? 'CUIT / CUIL' : 'Número de Documento'}
          required
          error={errors.cuit ?? errors.numero_documento}
          hint={needsCUIT ? 'Formato: XX-XXXXXXXX-X' : undefined}
        >
          {needsCUIT ? (
            <div style={{ position: 'relative' }}>
              <Input
                value={data.cuit}
                onChange={handleCUIT}
                placeholder="20-12345678-9"
                error={errors.cuit}
                maxLength={13}
              />
              {cuitCompleto && (
                <div style={{
                  position:  'absolute',
                  right:     '12px',
                  top:       '50%',
                  transform: 'translateY(-50%)',
                }}>
                  {cuitValido ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" fill="rgba(34,197,94,0.15)" stroke="#4ade80" />
                      <path d="M5 8L7 10L11 6" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" fill="rgba(245,158,11,0.15)" stroke="#f59e0b" />
                      <line x1="6" y1="6" x2="10" y2="10" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
                      <line x1="10" y1="6" x2="6" y2="10" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
              )}
            </div>
          ) : (
            <Input
              value={data.numero_documento}
              onChange={(e) => onChange('numero_documento', e.target.value)}
              placeholder="Número de documento"
              error={errors.numero_documento}
            />
          )}
        </FieldWrapper>

        <FieldWrapper label="Ingresos Brutos" hint="Número de inscripción (opcional)">
          <Input
            value={data.ingresos_brutos}
            onChange={(e) => onChange('ingresos_brutos', e.target.value)}
            placeholder="Ej: 902-123456-7"
          />
        </FieldWrapper>

        <FieldWrapper label="Email" error={errors.email}>
          <Input
            type="email"
            value={data.email}
            onChange={(e) => onChange('email', e.target.value)}
            placeholder="contacto@empresa.com"
            error={errors.email}
          />
        </FieldWrapper>
      </div>
    </div>
  )
}

function StepComercial({ data, onChange, errors }: StepComercialProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <SectionTitle icon="👤" title="Contacto Principal" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <FieldWrapper label="Nombre del Contacto">
          <Input
            value={data.contacto_nombre}
            onChange={(e) => onChange('contacto_nombre', e.target.value)}
            placeholder="Ej: María González"
          />
        </FieldWrapper>
        <FieldWrapper label="Cargo">
          <Input
            value={data.contacto_cargo}
            onChange={(e) => onChange('contacto_cargo', e.target.value)}
            placeholder="Ej: Gerente de Compras"
          />
        </FieldWrapper>
        <FieldWrapper label="Teléfono Principal">
          <Input
            value={data.telefono}
            onChange={(e) => onChange('telefono', e.target.value)}
            placeholder="+54 362 4000000"
          />
        </FieldWrapper>
        <FieldWrapper label="Teléfono Alternativo">
          <Input
            value={data.telefono_alt}
            onChange={(e) => onChange('telefono_alt', e.target.value)}
            placeholder="+54 362 4000001"
          />
        </FieldWrapper>
      </div>

      <Divider />
      <SectionTitle icon="📧" title="Datos de Facturación" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <FieldWrapper
          label="Email de Facturación"
          error={errors.email_facturacion}
          hint="Si es diferente al email general"
        >
          <Input
            type="email"
            value={data.email_facturacion}
            onChange={(e) => onChange('email_facturacion', e.target.value)}
            placeholder="facturacion@empresa.com"
            error={errors.email_facturacion}
          />
        </FieldWrapper>
        <FieldWrapper label="Sitio Web">
          <Input
            value={data.sitio_web}
            onChange={(e) => onChange('sitio_web', e.target.value)}
            placeholder="https://www.empresa.com"
          />
        </FieldWrapper>
      </div>
    </div>
  )
}

function StepDireccion({ data, onChange, errors }: StepDireccionProps) {
  const dir = data.direccion

  const setDir = (field: keyof DireccionFormState, value: string) => {
    onChange('direccion', { ...dir, [field]: value })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{
        padding:      '14px 16px',
        background:   'rgba(99, 102, 241, 0.06)',
        border:       '1px solid rgba(99, 102, 241, 0.15)',
        borderRadius: '10px',
        fontSize:     '12px',
        color:        '#94a3b8',
        lineHeight:   '1.6',
      }}>
        <span style={{ color: '#a5b4fc', fontWeight: '600' }}>Dirección principal</span>
        {' '}— Esta dirección se usará por defecto en presupuestos y órdenes de servicio. Podés agregar más desde la ficha del cliente.
      </div>

      <FieldWrapper label="Etiqueta" hint="Nombre para identificar esta dirección">
        <Input
          value={dir.etiqueta}
          onChange={(e) => setDir('etiqueta', e.target.value)}
          placeholder="Ej: Casa Central, Planta Norte, Obra..."
        />
      </FieldWrapper>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '16px' }}>
        <FieldWrapper label="Calle" required error={errors.calle}>
          <Input
            value={dir.calle}
            onChange={(e) => setDir('calle', e.target.value)}
            placeholder="Av. Sarmiento"
            error={errors.calle}
          />
        </FieldWrapper>
        <FieldWrapper label="Número">
          <Input
            value={dir.numero}
            onChange={(e) => setDir('numero', e.target.value)}
            placeholder="1450"
          />
        </FieldWrapper>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <FieldWrapper label="Piso / Dpto">
          <Input
            value={dir.piso_dpto}
            onChange={(e) => setDir('piso_dpto', e.target.value)}
            placeholder="Piso 3, Of. B"
          />
        </FieldWrapper>
        <FieldWrapper label="Barrio">
          <Input
            value={dir.barrio}
            onChange={(e) => setDir('barrio', e.target.value)}
            placeholder="Centro"
          />
        </FieldWrapper>
        <FieldWrapper label="Ciudad" required error={errors.ciudad}>
          <Input
            value={dir.ciudad}
            onChange={(e) => setDir('ciudad', e.target.value)}
            placeholder="Resistencia"
            error={errors.ciudad}
          />
        </FieldWrapper>
        <FieldWrapper label="Código Postal">
          <Input
            value={dir.codigo_postal}
            onChange={(e) => setDir('codigo_postal', e.target.value)}
            placeholder="H3500"
          />
        </FieldWrapper>
      </div>

      <FieldWrapper label="Provincia">
        <Select
          value={dir.provincia}
          onChange={(e) => setDir('provincia', e.target.value)}
        >
          {PROVINCIAS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </Select>
      </FieldWrapper>

      <FieldWrapper
        label="Distancia desde sede (km)"
        hint="Para cálculo automático de viáticos y traslados en presupuestos"
      >
        <Input
          type="number"
          value={dir.distancia_km}
          onChange={(e) => setDir('distancia_km', e.target.value)}
          placeholder="0"
          min="0"
        />
      </FieldWrapper>
    </div>
  )
}

function StepClasificacion({ data, onChange }: StepClasificacionProps) {
  const toggleChip = (field: 'segmento' | 'origen', value: string) => {
    onChange(field, data[field] === value ? '' : value)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <SectionTitle icon="🏷" title="Segmento de Negocio" />
        <p style={{ fontSize: '12px', color: '#64748b', margin: '8px 0 12px' }}>
          Clasificá el cliente según el tipo de servicios que requiere
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {SEGMENTOS.map((s) => (
            <button
              key={s}
              onClick={() => toggleChip('segmento', s)}
              style={{
                padding:      '7px 14px',
                borderRadius: '20px',
                border:       data.segmento === s
                  ? '1px solid rgba(245, 158, 11, 0.5)'
                  : '1px solid rgba(148, 163, 184, 0.15)',
                background:   data.segmento === s
                  ? 'rgba(245, 158, 11, 0.1)'
                  : 'rgba(15, 23, 42, 0.4)',
                color:        data.segmento === s ? '#f59e0b' : '#64748b',
                fontSize:     '12px',
                fontWeight:   data.segmento === s ? '600' : '400',
                cursor:       'pointer',
                transition:   'all 0.2s',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <Divider />

      <div>
        <SectionTitle icon="🔍" title="Origen del Cliente" />
        <p style={{ fontSize: '12px', color: '#64748b', margin: '8px 0 12px' }}>
          ¿Cómo llegó este cliente a Hexa?
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {ORIGENES.map((o) => (
            <button
              key={o}
              onClick={() => toggleChip('origen', o)}
              style={{
                padding:      '7px 14px',
                borderRadius: '20px',
                border:       data.origen === o
                  ? '1px solid rgba(99, 102, 241, 0.5)'
                  : '1px solid rgba(148, 163, 184, 0.15)',
                background:   data.origen === o
                  ? 'rgba(99, 102, 241, 0.1)'
                  : 'rgba(15, 23, 42, 0.4)',
                color:        data.origen === o ? '#a5b4fc' : '#64748b',
                fontSize:     '12px',
                fontWeight:   data.origen === o ? '600' : '400',
                cursor:       'pointer',
                transition:   'all 0.2s',
              }}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      <Divider />

      <FieldWrapper label="Notas Internas" hint="Solo visible para el equipo de Hexa">
        <Textarea
          value={data.notas}
          onChange={(e) => onChange('notas', e.target.value)}
          placeholder="Observaciones relevantes sobre el cliente, preferencias, historial previo..."
          rows={4}
        />
      </FieldWrapper>
    </div>
  )
}

// ─── Panel de resumen lateral ─────────────────────────────────────────────────

function ResumenLateral({ data, step }: ResumenLateralProps) {
  const hasValue = (v: string | null | undefined): v is string =>
    typeof v === 'string' && v.trim() !== ''

  const items: { label: string; value: string }[] = [
    { label: 'Razón Social', value: data.razon_social },
    { label: 'CUIT',         value: data.cuit },
    { label: 'Cond. IVA',    value: CONDICIONES_IVA.find((c) => c.value === data.condicion_iva)?.label ?? '' },
    { label: 'Email',        value: data.email },
    { label: 'Contacto',     value: data.contacto_nombre },
    { label: 'Teléfono',     value: data.telefono },
    { label: 'Ciudad',       value: data.direccion.ciudad },
    { label: 'Segmento',     value: data.segmento },
  ].filter((i) => hasValue(i.value))

  const completedSteps = ([0, 1, 2] as const).filter((s) => s < step)

  const avatarBg = data.razon_social
    ? `hsl(${data.razon_social.charCodeAt(0) * 7 % 360}, 40%, 25%)`
    : 'rgba(30, 41, 59, 0.8)'

  return (
    <div style={{
      background:   'rgba(15, 23, 42, 0.5)',
      border:       '1px solid rgba(148, 163, 184, 0.08)',
      borderRadius: '12px',
      padding:      '20px',
      display:      'flex',
      flexDirection:'column',
      gap:          '16px',
    }}>
      {/* Avatar generativo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width:          '44px',
          height:         '44px',
          borderRadius:   '12px',
          background:     avatarBg,
          border:         '2px solid rgba(245, 158, 11, 0.2)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontSize:       '16px',
          fontWeight:     '700',
          color:          '#f59e0b',
          fontFamily:     "'DM Sans', sans-serif",
          flexShrink:     0,
        }}>
          {data.razon_social ? data.razon_social.charAt(0).toUpperCase() : '?'}
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0', lineHeight: '1.3' }}>
            {data.razon_social || 'Nuevo cliente'}
          </div>
          {data.nombre_fantasia && (
            <div style={{ fontSize: '11px', color: '#64748b' }}>{data.nombre_fantasia}</div>
          )}
        </div>
      </div>

      {items.length > 0 && (
        <>
          <div style={{ height: '1px', background: 'rgba(148,163,184,0.08)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: '#475569', flexShrink: 0 }}>{item.label}</span>
                <span style={{
                  fontSize:      '11px',
                  color:         '#94a3b8',
                  fontFamily:    "'DM Mono', monospace",
                  textAlign:     'right',
                  overflow:      'hidden',
                  textOverflow:  'ellipsis',
                  whiteSpace:    'nowrap',
                  maxWidth:      '120px',
                }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {completedSteps.length > 0 && (
        <>
          <div style={{ height: '1px', background: 'rgba(148,163,184,0.08)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {completedSteps.map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width:          '16px',
                  height:         '16px',
                  borderRadius:   '50%',
                  background:     'rgba(34,197,94,0.15)',
                  border:         '1px solid rgba(34,197,94,0.4)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                }}>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4L3 5.5L6.5 2" stroke="#4ade80" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span style={{ fontSize: '11px', color: '#4ade80' }}>{STEPS[s].label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ current, steps, onGoTo }: StepperProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0', marginBottom: '32px' }}>
      {steps.map((step, i) => {
        const isDone   = i < current
        const isActive = i === current
        const isLast   = i === steps.length - 1

        return (
          <div
            key={step.id}
            style={{ display: 'flex', alignItems: 'flex-start', flex: isLast ? '0' : '1' }}
          >
            <div
              style={{
                display:       'flex',
                flexDirection: 'column',
                alignItems:    'center',
                gap:           '6px',
                cursor:        isDone ? 'pointer' : 'default',
              }}
              onClick={() => isDone && onGoTo(i)}
            >
              <div style={{
                width:          '36px',
                height:         '36px',
                borderRadius:   '50%',
                background:     isDone
                  ? 'rgba(34, 197, 94, 0.12)'
                  : isActive
                  ? 'rgba(245, 158, 11, 0.12)'
                  : 'rgba(15, 23, 42, 0.6)',
                border: `2px solid ${isDone
                  ? 'rgba(34,197,94,0.5)'
                  : isActive
                  ? 'rgba(245,158,11,0.6)'
                  : 'rgba(148,163,184,0.12)'}`,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                transition:     'all 0.3s',
                position:       'relative',
              }}>
                {isDone ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7L6 10L11 4" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span style={{
                    fontSize: isActive ? '14px' : '12px',
                    filter:   isActive ? 'none' : 'grayscale(1) opacity(0.4)',
                  }}>
                    {step.icon}
                  </span>
                )}
                {isActive && (
                  <div style={{
                    position:     'absolute',
                    inset:        '-4px',
                    borderRadius: '50%',
                    border:       '1px solid rgba(245,158,11,0.2)',
                    animation:    'pulse 2s infinite',
                  }} />
                )}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize:      '10px',
                  fontWeight:    '700',
                  letterSpacing: '0.06em',
                  color:         isDone ? '#4ade80' : isActive ? '#f59e0b' : '#334155',
                  textTransform: 'uppercase',
                  whiteSpace:    'nowrap',
                }}>
                  {step.label}
                </div>
              </div>
            </div>

            {!isLast && (
              <div style={{
                flex:       1,
                height:     '2px',
                background: isDone ? 'rgba(34,197,94,0.3)' : 'rgba(148,163,184,0.08)',
                marginTop:  '17px',
                transition: 'background 0.5s',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Pantalla de éxito ────────────────────────────────────────────────────────

function SuccessScreen({ data, onNew }: SuccessScreenProps) {
  const condLabel = CONDICIONES_IVA.find((c) => c.value === data.condicion_iva)?.label

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            '24px',
      padding:        '48px 32px',
      textAlign:      'center',
    }}>
      <div style={{
        width:          '72px',
        height:         '72px',
        borderRadius:   '50%',
        background:     'rgba(34,197,94,0.1)',
        border:         '2px solid rgba(34,197,94,0.4)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        animation:      'scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M8 16L13 21L24 10" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div>
        <h3 style={{
          margin:     '0 0 8px',
          fontSize:   '20px',
          fontWeight: '700',
          color:      '#e2e8f0',
          fontFamily: "'DM Sans', sans-serif",
        }}>
          Cliente creado
        </h3>
        <p style={{ margin: 0, fontSize: '14px', color: '#64748b', lineHeight: '1.6' }}>
          <span style={{ color: '#f59e0b', fontWeight: '600' }}>{data.razon_social}</span>
          {' '}fue agregado<br />exitosamente al sistema.
        </p>
      </div>

      <div style={{
        background:   'rgba(15, 23, 42, 0.6)',
        border:       '1px solid rgba(148,163,184,0.1)',
        borderRadius: '10px',
        padding:      '16px 20px',
        display:      'flex',
        flexDirection:'column',
        gap:          '8px',
        width:        '100%',
        maxWidth:     '300px',
      }}>
        {data.cuit      && <InfoRow label="CUIT"     value={data.cuit} />}
        {condLabel      && <InfoRow label="IVA"      value={condLabel} />}
        {data.email     && <InfoRow label="Email"    value={data.email} />}
        {data.segmento  && <InfoRow label="Segmento" value={data.segmento} />}
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={onNew}
          style={{
            padding:    '10px 20px',
            borderRadius:'8px',
            border:     '1px solid rgba(148,163,184,0.15)',
            background: 'rgba(15,23,42,0.6)',
            color:      '#94a3b8',
            fontSize:   '13px',
            cursor:     'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          + Nuevo cliente
        </button>
        <button
          style={{
            padding:     '10px 20px',
            borderRadius:'8px',
            border:      'none',
            background:  'linear-gradient(135deg, #f59e0b, #d97706)',
            color:       '#0f172a',
            fontSize:    '13px',
            fontWeight:  '700',
            cursor:      'pointer',
            fontFamily:  "'DM Sans', sans-serif",
          }}
        >
          Ver ficha →
        </button>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <span style={{ fontSize: '11px', color: '#475569' }}>{label}</span>
      <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: "'DM Mono', monospace" }}>
        {value}
      </span>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ClienteForm() {
  const [step,       setStep]       = useState<number>(0)
  const [data,       setData]       = useState<FormState>(initialData)
  const [errors,     setErrors]     = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [submitted,  setSubmitted]  = useState<boolean>(false)
  const [animDir,    setAnimDir]    = useState<AnimDir>('forward')

  /** Actualiza un campo del FormState con tipado completo */
  const handleChange = useCallback(
    <K extends keyof FormState>(field: K, value: FormState[K]) => {
      setData((prev) => ({ ...prev, [field]: value }))
      // Limpiar el error del campo al modificarlo
      if (field in errors) {
        setErrors((prev) => {
          const next = { ...prev }
          delete next[field as keyof FormErrors]
          return next
        })
      }
    },
    [errors]
  )

  const goNext = () => {
    const stepErrors = validateStep(step, data)
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return
    }
    setErrors({})
    setAnimDir('forward')
    setStep((s) => s + 1)
  }

  const goPrev = () => {
    setErrors({})
    setAnimDir('back')
    setStep((s) => s - 1)
  }

  const goTo = (s: number) => {
    setErrors({})
    setAnimDir(s > step ? 'forward' : 'back')
    setStep(s)
  }

  const handleSubmit = async () => {
    const stepErrors = validateStep(step, data)
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return
    }

    setSubmitting(true)
    try {
      // Convertir FormState → CrearClienteDTO antes de enviarlo a la Server Action
      const dto = formStateToDTO(data)

      // TODO: reemplazar por: const result = await crearCliente(dto)
      await new Promise<void>((r) => setTimeout(r, 1800))

      setSubmitted(true)
    } catch (err) {
      console.error('[ClienteForm] Error al crear cliente:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleNew = () => {
    setData(initialData)
    setStep(0)
    setErrors({})
    setSubmitted(false)
    setAnimDir('forward')
  }

  const stepComponents: ReactNode[] = [
    <StepFiscal        key="fiscal"   data={data} onChange={handleChange} errors={errors} />,
    <StepComercial     key="comercial"data={data} onChange={handleChange} errors={errors} />,
    <StepDireccion     key="dir"      data={data} onChange={handleChange} errors={errors} />,
    <StepClasificacion key="clasif"   data={data} onChange={handleChange} />,
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@300;400;500&display=swap');

        * { box-sizing: border-box; }

        body {
          margin: 0;
          background: #060d1a;
          font-family: 'DM Sans', sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        ::placeholder { color: #334155 !important; }

        option { background: #0f172a; color: #e2e8f0; }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideForward {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeSlideBack {
          from { opacity: 0; transform: translateX(-20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 0.8; transform: scale(1.05); }
        }
        @keyframes scaleIn {
          from { transform: scale(0.5); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .step-content         { animation: fadeSlideForward 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        .step-content.back    { animation: fadeSlideBack    0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        input:focus, select:focus, textarea:focus { outline: none !important; }
        ::-webkit-scrollbar       { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.15); border-radius: 2px; }
      `}</style>

      <div style={{
        minHeight:      '100vh',
        background:     'radial-gradient(ellipse 120% 80% at 10% 0%, rgba(245,158,11,0.04) 0%, transparent 60%), radial-gradient(ellipse 80% 60% at 90% 100%, rgba(99,102,241,0.04) 0%, transparent 60%), #060d1a',
        display:        'flex',
        alignItems:     'flex-start',
        justifyContent: 'center',
        padding:        '40px 20px',
      }}>
        <div style={{ width: '100%', maxWidth: '920px' }}>

          {/* Breadcrumb + Header */}
          <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <div style={{
                  width: '28px', height: '28px',
                  background: 'rgba(245,158,11,0.12)',
                  border: '1px solid rgba(245,158,11,0.25)',
                  borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px',
                }}>👥</div>
                <span style={{ fontSize: '11px', color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Clientes
                </span>
                <span style={{ color: '#1e293b' }}>›</span>
                <span style={{ fontSize: '11px', color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Nuevo
                </span>
              </div>
              <h1 style={{
                margin: 0, fontSize: '22px', fontWeight: '700',
                color: '#e2e8f0', letterSpacing: '-0.02em',
              }}>
                Alta de Cliente
              </h1>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Badge color="amber">MVP</Badge>
              <Badge color="slate">v0.1</Badge>
            </div>
          </div>

          {/* Layout principal */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: '20px', alignItems: 'start' }}>

            {/* Card del formulario */}
            <div style={{
              background:    'rgba(15, 23, 42, 0.7)',
              border:        '1px solid rgba(148, 163, 184, 0.08)',
              borderRadius:  '16px',
              overflow:      'hidden',
              backdropFilter:'blur(12px)',
            }}>
              {/* Top bar con stepper */}
              <div style={{
                padding:      '20px 28px',
                borderBottom: '1px solid rgba(148, 163, 184, 0.06)',
                background:   'rgba(8, 16, 35, 0.4)',
              }}>
                {!submitted && (
                  <Stepper current={step} steps={STEPS} onGoTo={goTo} />
                )}
                {!submitted && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h2 style={{
                        margin: '0 0 2px', fontSize: '16px', fontWeight: '700', color: '#e2e8f0',
                        display: 'flex', alignItems: 'center', gap: '8px',
                      }}>
                        <span>{STEPS[step].icon}</span>
                        {STEPS[step].label}
                      </h2>
                      <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>
                        {STEPS[step].desc}
                      </p>
                    </div>
                    <div style={{ fontSize: '11px', color: '#334155', fontFamily: "'DM Mono', monospace" }}>
                      {step + 1} / {STEPS.length}
                    </div>
                  </div>
                )}
              </div>

              {/* Contenido del paso */}
              <div
                key={submitted ? 'success' : step}
                className={`step-content${animDir === 'back' ? ' back' : ''}`}
                style={{ padding: submitted ? '0' : '28px' }}
              >
                {submitted
                  ? <SuccessScreen data={data} onNew={handleNew} />
                  : stepComponents[step]
                }
              </div>

              {/* Footer con navegación */}
              {!submitted && (
                <div style={{
                  padding:        '20px 28px',
                  borderTop:      '1px solid rgba(148, 163, 184, 0.06)',
                  background:     'rgba(8, 16, 35, 0.3)',
                  display:        'flex',
                  justifyContent: 'space-between',
                  alignItems:     'center',
                }}>
                  <button
                    onClick={goPrev}
                    disabled={step === 0}
                    style={{
                      padding:     '9px 18px',
                      borderRadius:'8px',
                      border:      '1px solid rgba(148,163,184,0.12)',
                      background:  'transparent',
                      color:       step === 0 ? '#1e293b' : '#64748b',
                      fontSize:    '13px',
                      cursor:      step === 0 ? 'not-allowed' : 'pointer',
                      fontFamily:  "'DM Sans', sans-serif",
                      display:     'flex',
                      alignItems:  'center',
                      gap:         '6px',
                      transition:  'all 0.2s',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Anterior
                  </button>

                  {/* Indicadores de progreso */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {STEPS.map((_, i) => (
                      <div key={i} style={{
                        width:        i === step ? '20px' : '6px',
                        height:       '6px',
                        borderRadius: '3px',
                        background:   i < step
                          ? 'rgba(34,197,94,0.5)'
                          : i === step
                          ? '#f59e0b'
                          : 'rgba(148,163,184,0.12)',
                        transition: 'all 0.3s',
                      }} />
                    ))}
                  </div>

                  {step < STEPS.length - 1 ? (
                    <button
                      onClick={goNext}
                      style={{
                        padding:     '9px 20px',
                        borderRadius:'8px',
                        border:      'none',
                        background:  'linear-gradient(135deg, rgba(245,158,11,0.9), rgba(217,119,6,0.9))',
                        color:       '#0f172a',
                        fontSize:    '13px',
                        fontWeight:  '700',
                        cursor:      'pointer',
                        fontFamily:  "'DM Sans', sans-serif",
                        display:     'flex',
                        alignItems:  'center',
                        gap:         '6px',
                        boxShadow:   '0 4px 12px rgba(245,158,11,0.2)',
                        transition:  'all 0.2s',
                      }}
                    >
                      Continuar
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      style={{
                        padding:     '9px 22px',
                        borderRadius:'8px',
                        border:      'none',
                        background:  submitting
                          ? 'rgba(245,158,11,0.3)'
                          : 'linear-gradient(135deg, rgba(245,158,11,0.9), rgba(217,119,6,0.9))',
                        color:     '#0f172a',
                        fontSize:  '13px',
                        fontWeight:'700',
                        cursor:    submitting ? 'not-allowed' : 'pointer',
                        fontFamily:"'DM Sans', sans-serif",
                        display:   'flex',
                        alignItems:'center',
                        gap:       '8px',
                        boxShadow: submitting ? 'none' : '0 4px 12px rgba(245,158,11,0.2)',
                        transition:'all 0.2s',
                      }}
                    >
                      {submitting ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 14 14" style={{ animation: 'spin 0.8s linear infinite' }}>
                            <circle cx="7" cy="7" r="5.5" stroke="rgba(15,23,42,0.5)" strokeWidth="1.5" fill="none" />
                            <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                          </svg>
                          Guardando...
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 7L5.5 10.5L12 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Crear Cliente
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Panel lateral sticky */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'sticky', top: '40px' }}>
              <ResumenLateral data={data} step={step} />

              {!submitted && (
                <div style={{
                  padding:      '14px 16px',
                  background:   'rgba(8, 16, 35, 0.5)',
                  border:       '1px solid rgba(148,163,184,0.06)',
                  borderRadius: '10px',
                  fontSize:     '11px',
                  color:        '#334155',
                  lineHeight:   '1.7',
                }}>
                  <div style={{
                    color: '#475569', fontWeight: '600', marginBottom: '6px',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="5" stroke="#475569" />
                      <line x1="6" y1="5.5" x2="6" y2="8.5" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" />
                      <circle cx="6" cy="3.5" r="0.6" fill="#475569" />
                    </svg>
                    Paso {step + 1} de {STEPS.length}
                  </div>
                  {step === 0 && 'Los datos fiscales se usan en todos los documentos legales emitidos al cliente.'}
                  {step === 1 && 'Podés cargar múltiples contactos desde la ficha del cliente una vez creado.'}
                  {step === 2 && 'La distancia en km permite calcular viáticos automáticamente en los presupuestos.'}
                  {step === 3 && 'La clasificación ayuda a filtrar clientes y generar reportes por unidad de negocio.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
