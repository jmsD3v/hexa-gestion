# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start development server
pnpm build        # Production build
pnpm lint         # ESLint
pnpm type-check   # TypeScript check (tsc --noEmit)
pnpm db:types     # Regenerate Supabase types → types/supabase.ts
```

> Uses **pnpm** (not npm/yarn). Always use pnpm.

## Environment

Copy `.env.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase project
- `SUPABASE_SERVICE_ROLE_KEY` — for admin operations (server-only)
- `NEXT_PUBLIC_USE_MOCKS=true` — enables mock data without DB (for UI dev)

## Architecture

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Supabase (Postgres + Auth) + Tailwind CSS + PDFKit

### Routing & Auth

- `app/(auth)/` — public routes (login, OAuth callback)
- `app/(dashboard)/` — protected routes; `layout.tsx` verifies session and ensures user profile exists
- `proxy.ts` (middleware) — redirects unauthenticated users to `/login`, authenticated away from login

### Data Flow

All mutations go through **Next.js Server Actions** in `app/actions/*.ts`. These are the primary data layer — the REST API routes in `app/api/` are only for specific cases (PDF streaming, health check).

Pattern for each domain:
1. Zod schema in `lib/validations/index.ts` → validates both client (UX) and server (security)
2. Server Action in `app/actions/{domain}.ts` → calls Supabase with `createClient()` from `lib/supabase/server.ts`
3. Component in `components/modules/{domain}/` → calls the Server Action
4. Types in `types/{domain}.ts`

### Supabase Clients

- `lib/supabase/server.ts` → use in Server Components, Server Actions, and API routes
- `lib/supabase/client.ts` → use in Client Components only
- `createAdminClient()` (also in server.ts) → bypasses RLS; use only for admin operations with SERVICE_ROLE_KEY

### Business Domain

Document lifecycle with full traceability:
```
CLIENTE → PRESUPUESTO → ORDEN → NOTA PEDIDO → REMITO → FACTURA → RECIBO
```

Each step is linked by foreign keys and auto-numbered via PL/pgSQL functions (e.g., `PST-2026-XXXX`).

Key modules: `clientes`, `presupuestos`, `ordenes`, `logistica`, `facturas`, `calendario`, `reportes`, `configuracion`.

### PDF Generation

Server-side PDFKit in `lib/pdf/`. Each document type has its own generator. PDFs are regenerated on demand via `app/api/documentos/pdf/route.ts`. No static file storage required.

### Audit

`lib/audit.ts` — logs all CREATE/UPDATE/DELETE with user ID and IP. Called within Server Actions after successful DB writes.

### Mock Data

Set `NEXT_PUBLIC_USE_MOCKS=true` to use mock data (no DB needed). Demo pages at `/demo`. Mock implementations in `app/actions/dashboard-mocks.ts`.

### UI Structure

- `components/ui/` — shared primitives (Button, Input, Modal, Table, Badge, etc.)
- `components/modules/{feature}/` — business-specific components
- `components/layout/` — Sidebar + TopBar
- Sidebar collapse state managed via `lib/sidebar-context.tsx`

### Database Schema

Full schema in `supabase/schema.sql`. Enums (e.g., `CondicionIVA`, `EstadoPresupuesto`) are defined in `types/database.ts`.

## Key Design Decisions

- **Server Actions over REST** — reduces client-server round trips and simplifies auth
- **Zod dual validation** — client validates for UX feedback; server re-validates for security before any DB write
- **RLS enforced at DB level** — even if a Server Action has a bug, RLS prevents unauthorized data access
- **PDFKit (not browser PDF)** — server-side generation avoids client-side printing quirks and supports all document types uniformly
