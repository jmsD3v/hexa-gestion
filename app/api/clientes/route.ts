// ============================================================
// /app/api/clientes/route.ts
// GET /api/clientes — Listar clientes con filtros y paginación
// POST /api/clientes — Crear cliente
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ClienteSchema } from '@/lib/validations'
import { registrarAudit } from '@/lib/audit'

export async function GET(request: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const busqueda = searchParams.get('busqueda')
  const activo = searchParams.get('activo')
  const condicion_iva = searchParams.get('condicion_iva')
  const segmento = searchParams.get('segmento')
  const pagina = parseInt(searchParams.get('pagina') ?? '1')
  const por_pagina = parseInt(searchParams.get('por_pagina') ?? '20')
  const offset = (pagina - 1) * por_pagina

  let query = supabase
    .from('clientes')
    .select('*, direcciones:clientes_direcciones(id, etiqueta, ciudad, es_principal)', {
      count: 'exact',
    })

  if (busqueda) {
    query = query.or(
      `razon_social.ilike.%${busqueda}%,cuit.ilike.%${busqueda}%,nombre_fantasia.ilike.%${busqueda}%`
    )
  }

  if (activo !== null) {
    query = query.eq('activo', activo === 'true')
  } else {
    query = query.eq('activo', true) // Por defecto solo activos
  }

  if (condicion_iva) {
    query = query.eq('condicion_iva', condicion_iva)
  }

  if (segmento) {
    query = query.eq('segmento', segmento)
  }

  const { data, error, count } = await query
    .order('razon_social')
    .range(offset, offset + por_pagina - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data,
    total: count ?? 0,
    pagina,
    por_pagina,
    total_paginas: Math.ceil((count ?? 0) / por_pagina),
  })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = ClienteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Datos inválidos',
        detalles: parsed.error.flatten().fieldErrors,
      },
      { status: 422 }
    )
  }

  const { direccion_principal, ...clienteData } = parsed.data

  // Verificar CUIT duplicado
  if (clienteData.cuit) {
    const { data: existente } = await supabase
      .from('clientes')
      .select('id, razon_social')
      .eq('cuit', clienteData.cuit)
      .single()

    if (existente) {
      return NextResponse.json(
        { error: `El CUIT ya está registrado para: ${existente.razon_social}` },
        { status: 409 }
      )
    }
  }

  const { data: cliente, error } = await supabase
    .from('clientes')
    .insert({ ...clienteData, creado_por: user.id })
    .select()
    .single()

  if (error || !cliente) {
    return NextResponse.json(
      { error: error?.message ?? 'Error al crear el cliente' },
      { status: 500 }
    )
  }

  if (direccion_principal) {
    await supabase.from('clientes_direcciones').insert({
      ...direccion_principal,
      cliente_id: cliente.id,
      es_principal: true,
    })
  }

  await registrarAudit(supabase, {
    usuario_id: user.id,
    accion: 'CREATE',
    entidad_tipo: 'cliente',
    entidad_id: cliente.id,
    datos_nuevos: cliente,
  })

  return NextResponse.json({ data: cliente }, { status: 201 })
}
