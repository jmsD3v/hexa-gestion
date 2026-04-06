'use client'

// ============================================================
// components/modules/clientes/ClienteForm.tsx
// Formulario multi-paso de alta de cliente
// Tipado estricto con tipos del sistema y validación Zod
// ============================================================

import { useState, useCallback, useRef, ReactNode } from 'react'
import { ClipboardList, User, Mail, Search } from 'lucide-react'
import type { CondicionIVA, TipoDocumento } from '@/types/database'
import type { CrearClienteDTO, CrearDireccionDTO } from '@/types/clientes'
import { crearCliente } from '@/app/actions/clientes'
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
  icon: ReactNode
  desc: string
}

// ─── Definición de pasos ──────────────────────────────────────────────────────

const STEPS: Step[] = [
  { id: 0, label: 'Datos Fiscales',    icon: '🏛',  desc: 'Razón social, CUIT, condición IVA' },
  { id: 1, label: 'Datos Comerciales', icon: <ClipboardList className='w-3.5 h-3.5' />,  desc: 'Contacto, teléfonos, web' },
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
  clienteId: string
  onNew: () => void
}

interface InfoRowProps {
  label: string
  value: string
}

interface SectionTitleProps {
  icon: ReactNode
  title: string
}

// ─── Componentes de UI base ───────────────────────────────────────────────────

function FieldWrapper({ label, error, hint, required, children }: FieldWrapperProps) {
  return (
    <div className='flex flex-col gap-1.5'>
      {label && (
        <label className={`text-xs font-semibold tracking-widest uppercase flex items-center gap-1 ${error ? 'text-amber-500' : 'text-slate-400'}`}>
          {label}
          {required && <span className='text-amber-500 text-[10px]'>●</span>}
        </label>
      )}
      {children}
      {error && (
        <div
          className='text-xs text-amber-500 flex items-center gap-[5px] animate-fade-in'
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="4.5" stroke="#f59e0b" />
            <line x1="5" y1="3" x2="5" y2="5.5" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="5" cy="7" r="0.6" fill="#f59e0b" />
          </svg>
          {error}
        </div>
      )}
      {hint && !error && (
        <div className='text-xs text-slate-600'>{hint}</div>
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
      className={`w-full px-3.5 py-2.5 bg-slate-900/60 border rounded-lg text-slate-200 text-[13.5px] outline-none transition-all ${error ? 'border-amber-500/50 shadow-[0_0_0_3px_rgba(245,158,11,0.05)]' : focused ? 'border-amber-500/40 shadow-[0_0_0_3px_rgba(245,158,11,0.08)]' : 'border-slate-400/[0.12]'}`}
      {...rest}
    />
  )
}

function Select({ value, onChange, children, error }: SelectProps) {
  const [focused, setFocused] = useState(false)
  return (
    <div className='relative'>
      <select
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`w-full px-3.5 py-2.5 bg-slate-900/60 border rounded-lg text-slate-200 text-[13.5px] outline-none cursor-pointer appearance-none pr-9 ${error ? 'border-amber-500/50' : focused ? 'border-amber-500/40 shadow-[0_0_0_3px_rgba(245,158,11,0.08)]' : 'border-slate-400/[0.12]'}`}
      >
        {children}
      </select>
      <div className='absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500'>
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
      className={`w-full px-3.5 py-2.5 bg-slate-900/60 border rounded-lg text-slate-200 text-[13px] outline-none resize-y min-h-[80px] leading-relaxed ${focused ? 'border-amber-500/40 shadow-[0_0_0_3px_rgba(245,158,11,0.08)]' : 'border-slate-400/[0.12]'}`}
    />
  )
}

function Badge({ children, color = 'slate' }: BadgeProps) {
  const colorClass: Record<string, string> = {
    amber: 'bg-amber-500/[0.12] border border-amber-500/30 text-amber-500',
    slate: 'bg-slate-400/[0.08] border border-slate-400/20 text-slate-400',
    green: 'bg-emerald-500/10 border border-emerald-500/25 text-green-400',
  }
  return (
    <span
      className={`text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded ${colorClass[color] ?? colorClass.slate}`}
    >
      {children}
    </span>
  )
}

function SectionTitle({ icon, title }: SectionTitleProps) {
  return (
    <div className='flex items-center gap-2 mb-1'>
      <span className='flex items-center text-slate-500'>{icon}</span>
      <span className='text-xs font-bold tracking-[0.1em] uppercase text-slate-500'>
        {title}
      </span>
    </div>
  )
}

function Divider() {
  return (
    <div
      className='h-px bg-gradient-to-r from-transparent via-slate-400/10 to-transparent'
    />
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
    <div className='flex flex-col gap-5'>
      <div
        className='px-4 py-3.5 rounded-[10px] text-xs text-slate-400 leading-relaxed bg-amber-500/[0.06] border border-amber-500/15'
      >
        <span className='text-amber-500 font-semibold'>Datos fiscales</span>
        {' '}— Esta información se usará en todos los comprobantes y documentos legales emitidos al cliente.
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='col-span-full'>
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
            <div className='relative'>
              <Input
                value={data.cuit}
                onChange={handleCUIT}
                placeholder="20-12345678-9"
                error={errors.cuit}
                maxLength={13}
              />
              {cuitCompleto && (
                <div className='absolute right-3 top-1/2 -translate-y-1/2'>
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
    <div className='flex flex-col gap-5'>
      <SectionTitle icon={<User className='w-3.5 h-3.5' />} title="Contacto Principal" />
      <div className='grid grid-cols-2 gap-4'>
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
      <SectionTitle icon={<Mail className='w-3.5 h-3.5' />} title="Datos de Facturación" />
      <div className='grid grid-cols-2 gap-4'>
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
    <div className='flex flex-col gap-5'>
      <div className='px-4 py-3.5 rounded-[10px] text-xs text-slate-400 bg-indigo-500/[0.06] border border-indigo-500/15 leading-relaxed'>
        <span className='text-indigo-300 font-semibold'>Dirección principal</span>
        {' '}— Esta dirección se usará por defecto en presupuestos y órdenes de servicio. Podés agregar más desde la ficha del cliente.
      </div>

      <FieldWrapper label="Etiqueta" hint="Nombre para identificar esta dirección">
        <Input
          value={dir.etiqueta}
          onChange={(e) => setDir('etiqueta', e.target.value)}
          placeholder="Ej: Casa Central, Planta Norte, Obra..."
        />
      </FieldWrapper>

      <div className='grid grid-cols-[3fr_1fr] gap-4'>
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

      <div className='grid grid-cols-2 gap-4'>
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
    <div className='flex flex-col gap-6'>
      <div>
        <SectionTitle icon="🏷" title="Segmento de Negocio" />
        <p className='text-xs text-slate-500 my-2 mb-3'>
          Clasificá el cliente según el tipo de servicios que requiere
        </p>
        <div className='flex flex-wrap gap-2'>
          {SEGMENTOS.map((s) => (
            <button
              key={s}
              onClick={() => toggleChip('segmento', s)}
              className={`px-3.5 py-[7px] rounded-full text-xs cursor-pointer transition-all duration-200 ${data.segmento === s ? 'border border-amber-500/50 bg-amber-500/10 text-amber-500 font-semibold' : 'border border-slate-400/15 bg-slate-950/40 text-slate-500 font-normal'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <Divider />

      <div>
        <SectionTitle icon={<Search className='w-3.5 h-3.5' />} title="Origen del Cliente" />
        <p className='text-xs text-slate-500 my-2 mb-3'>
          ¿Cómo llegó este cliente a Hexa?
        </p>
        <div className='flex flex-wrap gap-2'>
          {ORIGENES.map((o) => (
            <button
              key={o}
              onClick={() => toggleChip('origen', o)}
              className={`px-3.5 py-[7px] rounded-full text-xs cursor-pointer transition-all duration-200 ${data.origen === o ? 'border border-indigo-500/50 bg-indigo-500/10 text-indigo-300 font-semibold' : 'border border-slate-400/15 bg-slate-950/40 text-slate-500 font-normal'}`}
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
    <div
      className='flex flex-col gap-4 p-5 rounded-xl bg-slate-900/50 border border-slate-400/[0.08]'
    >
      {/* Avatar generativo */}
      <div className='flex items-center gap-3'>
        <div
          className={`flex items-center justify-center text-base font-bold text-amber-500 shrink-0 w-11 h-11 rounded-xl border-2 border-amber-500/20 bg-[${avatarBg}]`}
        >
          {data.razon_social ? data.razon_social.charAt(0).toUpperCase() : '?'}
        </div>
        <div>
          <div className='text-[13px] font-semibold text-slate-200 leading-[1.3]'>
            {data.razon_social || 'Nuevo cliente'}
          </div>
          {data.nombre_fantasia && (
            <div className='text-xs text-slate-500'>{data.nombre_fantasia}</div>
          )}
        </div>
      </div>

      {items.length > 0 && (
        <>
          <div className='h-px bg-slate-400/[0.08]' />
          <div className='flex flex-col gap-2.5'>
            {items.map((item, i) => (
              <div key={i} className='flex justify-between gap-2'>
                <span className='text-xs text-slate-600 shrink-0'>{item.label}</span>
                <span
                  className='text-xs text-slate-400 text-right overflow-hidden text-ellipsis whitespace-nowrap max-w-[120px] font-mono'
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {completedSteps.length > 0 && (
        <>
          <div className='h-px bg-slate-400/[0.08]' />
          <div className='flex flex-col gap-1.5'>
            {completedSteps.map((s) => (
              <div key={s} className='flex items-center gap-2'>
                <div
                  className='flex items-center justify-center shrink-0 w-4 h-4 rounded-full bg-emerald-500/15 border border-emerald-500/40'
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4L3 5.5L6.5 2" stroke="#4ade80" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className='text-xs text-emerald-400'>{STEPS[s].label}</span>
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
    <div className='flex items-start gap-0 mb-8'>
      {steps.map((step, i) => {
        const isDone   = i < current
        const isActive = i === current
        const isLast   = i === steps.length - 1

        return (
          <div
            key={step.id}
            className={`flex items-start ${isLast ? 'flex-none' : 'flex-1'}`}
          >
            <div
              className={`flex flex-col items-center gap-1.5 ${isDone ? 'cursor-pointer' : 'cursor-default'}`}
              onClick={() => isDone && onGoTo(i)}
            >
              <div
                className={`flex items-center justify-center relative w-9 h-9 rounded-full transition-all duration-300 border-2 ${isDone ? 'bg-emerald-500/12 border-emerald-500/50' : isActive ? 'bg-amber-500/12 border-amber-500/60' : 'bg-slate-950/60 border-slate-400/12'}`}
              >
                {isDone ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7L6 10L11 4" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span className={isActive ? 'text-sm' : 'text-xs grayscale opacity-40'}>
                    {step.icon}
                  </span>
                )}
                {isActive && (
                  <div
                    className='absolute rounded-full -inset-1 border border-amber-500/20 animate-pulse'
                  />
                )}
              </div>
              <div className='text-center'>
                <div
                  className={`text-[10px] font-bold tracking-[0.06em] uppercase whitespace-nowrap ${isDone ? 'text-emerald-400' : isActive ? 'text-amber-500' : 'text-slate-700'}`}
                >
                  {step.label}
                </div>
              </div>
            </div>

            {!isLast && (
              <div
                className={`flex-1 mt-[17px] h-0.5 transition-colors duration-500 ${isDone ? 'bg-emerald-500/30' : 'bg-slate-400/[0.08]'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Pantalla de éxito ────────────────────────────────────────────────────────

function SuccessScreen({ data, clienteId, onNew }: SuccessScreenProps) {
  const condLabel = CONDICIONES_IVA.find((c) => c.value === data.condicion_iva)?.label

  return (
    <div className='flex flex-col items-center justify-center gap-6 text-center px-8 py-12'>
      <div className='flex items-center justify-center w-[72px] h-[72px] rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 animate-modal-in'>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M8 16L13 21L24 10" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div>
        <h3 className='m-0 mb-2 text-xl font-bold text-slate-200'>
          Cliente creado
        </h3>
        <p className='m-0 text-sm text-slate-500 leading-relaxed'>
          <span className='text-amber-500 font-semibold'>{data.razon_social}</span>
          {' '}fue agregado<br />exitosamente al sistema.
        </p>
      </div>

      <div className='flex flex-col gap-2 w-full max-w-[300px] px-5 py-4 rounded-[10px] bg-slate-900/60 border border-slate-400/10'>
        {data.cuit      && <InfoRow label="CUIT"     value={data.cuit} />}
        {condLabel      && <InfoRow label="IVA"      value={condLabel} />}
        {data.email     && <InfoRow label="Email"    value={data.email} />}
        {data.segmento  && <InfoRow label="Segmento" value={data.segmento} />}
      </div>

      <div className='flex gap-3'>
        <button
          onClick={onNew}
          className='px-5 py-2.5 rounded-lg border border-slate-400/[0.15] bg-slate-900/60 text-slate-400 text-[13px] cursor-pointer'
        >
          + Nuevo cliente
        </button>
        <a
          href={`/clientes/${clienteId}`}
          className='px-5 py-2.5 rounded-lg border-none text-slate-900 text-[13px] font-bold cursor-pointer bg-gradient-to-br from-amber-500 to-amber-600 no-underline'
        >
          Ver ficha →
        </a>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className='flex justify-between gap-3'>
      <span className='text-xs text-slate-600'>{label}</span>
      <span className='text-xs text-slate-400 font-mono'>
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
  const [submitting,  setSubmitting]  = useState<boolean>(false)
  const [submitted,   setSubmitted]   = useState<boolean>(false)
  const [clienteId,   setClienteId]   = useState<string>('')
  const [submitError, setSubmitError] = useState<string>('')
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
    setSubmitError('')
    try {
      const dto = formStateToDTO(data)
      const res = await crearCliente(dto)
      if (res.error || !res.data) {
        setSubmitError(res.error ?? 'Error al crear el cliente')
        return
      }
      setClienteId(res.data.id)
      setSubmitted(true)
    } catch (err) {
      console.error('[ClienteForm] Error al crear cliente:', err)
      setSubmitError('Error inesperado al crear el cliente')
    } finally {
      setSubmitting(false)
    }
  }

  const handleNew = () => {
    setData(initialData)
    setStep(0)
    setErrors({})
    setSubmitted(false)
    setClienteId('')
    setSubmitError('')
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
      <div
        className='min-h-screen flex items-start justify-center px-3 py-8 sm:px-5 sm:py-10 bg-slate-950 bg-gradient-to-b from-amber-950/5 to-slate-950'
      >
        <div className='w-full max-w-[920px]'>

          {/* Breadcrumb + Header */}
          <div className='mb-7 flex items-center justify-between'>
            <div>
              <div className='flex items-center gap-2.5 mb-1'>
                <div className='flex items-center justify-center text-[13px] w-7 h-7 bg-amber-500/[0.12] border border-amber-500/25 rounded-lg'>
                  👥
                </div>
                <span className='text-xs text-slate-600 tracking-widest uppercase'>
                  Clientes
                </span>
                <span className='text-slate-800'>›</span>
                <span className='text-xs text-slate-500 tracking-widest uppercase'>
                  Nuevo
                </span>
              </div>
              <h1
                className='m-0 text-[22px] font-bold text-slate-200 tracking-[-0.02em]'
              >
                Alta de Cliente
              </h1>
            </div>
            <div className='flex gap-2 items-center'>
              <Badge color="amber">MVP</Badge>
              <Badge color="slate">v0.1</Badge>
            </div>
          </div>

          {/* Layout principal */}
          <div className='grid grid-cols-[1fr_240px] gap-5 items-start'>

            {/* Card del formulario */}
            <div className='overflow-hidden rounded-2xl backdrop-blur-sm bg-slate-900/70 border border-slate-400/[0.08]'>
              {/* Top bar con stepper */}
              <div
                className='px-7 py-5 border-b border-slate-400/[0.06] bg-slate-950/40'
              >
                {!submitted && (
                  <Stepper current={step} steps={STEPS} onGoTo={goTo} />
                )}
                {!submitted && (
                  <div className='flex items-center justify-between'>
                    <div>
                      <h2 className='m-0 mb-0.5 text-base font-bold text-slate-200 flex items-center gap-2'>
                        <span>{STEPS[step].icon}</span>
                        {STEPS[step].label}
                      </h2>
                      <p className='m-0 text-xs text-slate-600'>
                        {STEPS[step].desc}
                      </p>
                    </div>
                    <div className='text-xs text-slate-700 font-mono'>
                      {step + 1} / {STEPS.length}
                    </div>
                  </div>
                )}
              </div>

              {/* Contenido del paso */}
              <div
                key={submitted ? 'success' : step}
                className={`${animDir === 'back' ? 'animate-fade-slide-back' : 'animate-fade-slide-fwd'} ${submitted ? '' : 'p-7'}`}
              >
                {submitted
                  ? <SuccessScreen data={data} clienteId={clienteId} onNew={handleNew} />
                  : stepComponents[step]
                }
              </div>

              {/* Footer con navegación */}
              {!submitted && (
                <div
                  className='px-7 py-5 border-t border-slate-400/[0.06] bg-slate-950/30 flex justify-between items-center'
                >
                  <button
                    onClick={goPrev}
                    disabled={step === 0}
                    className={`flex items-center gap-1.5 px-[18px] py-[9px] rounded-lg border border-slate-400/[0.12] bg-transparent text-[13px] transition-all ${step === 0 ? 'text-slate-800 cursor-not-allowed' : 'text-slate-500 cursor-pointer'}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Anterior
                  </button>

                  {/* Indicadores de progreso */}
                  <div className='flex gap-1.5'>
                    {STEPS.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded transition-all duration-300 ${i === step ? 'w-5' : 'w-1.5'} ${i < step ? 'bg-emerald-500/50' : i === step ? 'bg-amber-500' : 'bg-slate-400/[0.12]'}`}
                      />
                    ))}
                  </div>

                  {step < STEPS.length - 1 ? (
                    <button
                      onClick={goNext}
                      className='flex items-center gap-1.5 px-5 py-[9px] rounded-lg border-none text-slate-900 text-[13px] font-bold cursor-pointer transition-all bg-gradient-to-br from-emerald-600/80 to-emerald-700/80 hover:from-emerald-600 hover:to-emerald-700 shadow-sm shadow-emerald-600/15'
                    >
                      Continuar
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ) : (
                    <div className='flex flex-col items-end gap-1'>
                      {submitError && (
                        <p className='text-xs text-red-400'>{submitError}</p>
                      )}
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className={`flex items-center gap-2 px-[22px] py-[9px] rounded-lg border-none text-slate-900 text-[13px] font-bold transition-all ${submitting ? 'bg-emerald-600/30 cursor-not-allowed' : 'bg-gradient-to-br from-emerald-600/80 to-emerald-700/80 hover:from-emerald-600 hover:to-emerald-700 shadow-sm shadow-emerald-600/15 cursor-pointer'}`}
                    >
                      {submitting ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 14 14" className='animate-spin'>
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
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Panel lateral sticky */}
            <div className='flex flex-col gap-3 sticky top-10'>
              <ResumenLateral data={data} step={step} />

              {!submitted && (
                <div className='px-4 py-3.5 rounded-[10px] text-xs text-slate-700 bg-slate-950/50 border border-slate-400/[0.06] leading-[1.7]'>
                  <div className='text-slate-600 font-semibold mb-1.5 flex items-center gap-1.5'>
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
