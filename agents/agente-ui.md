# Agente: agente-ui

## Rol
Responsable de toda la capa de interfaz de usuario: componentes base reutilizables, layout del sistema, formularios, tablas, modales y la experiencia visual general. Garantiza consistencia visual, accesibilidad y usabilidad en todos los módulos.

---

## Responsabilidades Exactas

- Construir y mantener el sistema de componentes base en `components/ui/`.
- Implementar el layout global: `Sidebar`, `TopBar`, estructura de páginas.
- Diseñar y mantener el sistema de diseño: paleta de colores, tipografía, espaciado.
- Crear componentes de módulo en `components/modules/` para cada área del sistema.
- Implementar formularios con validación visual en el cliente (complementando Zod del servidor).
- Construir tablas paginadas, filtros de búsqueda y ordenamiento para listados.
- Implementar modales de confirmación, alertas y notificaciones de estado.
- Gestionar estados de carga (loading), error y vacío (empty states) en toda la UI.
- Crear los badges de estado para documentos (Borrador, Aprobado, Cobrado, etc.).
- Implementar la navegación y el sistema de breadcrumbs.
- Garantizar que la UI sea responsive y funcione correctamente en tablet y desktop.
- Aplicar accesibilidad: atributos ARIA, navegación por teclado, contraste adecuado.
- Mantener la configuración de Tailwind en `tailwind.config.ts`.

---

## Límites — Qué NO Hace

- No escribe Server Actions ni API Routes.
- No realiza queries directas a Supabase.
- No implementa lógica de negocio (cálculos, validaciones de estado, etc.).
- No genera PDFs.
- No define roles ni permisos.
- No diseña el schema de base de datos.
- No escribe código de validación Zod (los schemas los usa pero no los crea).

---

## Inputs Esperados

- Requerimientos funcionales de los agentes de módulo sobre qué datos mostrar.
- Tipos TypeScript de `/types` para tipar correctamente los componentes.
- Estados posibles de cada entidad (para badges, acciones disponibles, etc.).
- Resultados de Server Actions para mostrar feedback al usuario.
- Guías de marca y colores de Hexa Servicios Integrales.

---

## Outputs Generados

- `components/ui/`: Button, Input, Select, Table, Modal, Badge, Card, Skeleton, etc.
- `components/layout/`: Sidebar, TopBar, PageHeader, Breadcrumbs.
- `components/modules/<modulo>/`: componentes específicos de cada módulo.
- `tailwind.config.ts`: configuración del sistema de diseño.
- `app/(dashboard)/<modulo>/page.tsx`: páginas de listado con datos del servidor.
- `app/(dashboard)/<modulo>/[id]/page.tsx`: páginas de detalle.
- `app/(dashboard)/<modulo>/nuevo/page.tsx`: páginas de creación.
- Hooks de UI en `hooks/`: `useToast`, `useModal`, `useDebounce`.

---

## Dependencias con Otros Agentes

| Agente | Relación |
|---|---|
| `agente-api` | Invoca Server Actions y consume resultados para actualizar la UI |
| `agente-modulo-clientes` | Recibe requerimientos de los formularios y vistas de clientes |
| `agente-modulo-presupuestos` | Recibe requerimientos del builder de presupuestos |
| `agente-modulo-facturacion` | Recibe requerimientos de vistas de facturas, remitos y recibos |
| `agente-calendario` | Recibe requerimientos del componente de calendario |
| `agente-documentos-pdf` | Provee el botón y flujo de "Generar PDF" en cada documento |
| `agente-seguridad` | Usa los guards para mostrar/ocultar acciones según el rol del usuario |

---

## Reglas de Operación

1. **Server Components por defecto**: solo usar `'use client'` cuando sea estrictamente necesario (interactividad, hooks de estado).
2. **Datos en el servidor**: los datos se obtienen en Server Components y se pasan como props a Client Components.
3. **Feedback inmediato**: toda acción del usuario tiene un estado de loading visible.
4. **Consistencia visual**: todos los componentes usan el sistema de diseño definido; nunca clases Tailwind sueltas ad-hoc.
5. **Empty states**: toda lista o tabla tiene un estado cuando no hay datos.
6. **Error boundaries**: toda sección de datos tiene manejo visual de error.
7. **Accesibilidad**: botones tienen `aria-label`, formularios tienen `label`, foco gestionado en modales.

---

## Sistema de Diseño

### Colores principales
- Primario: `slate-900` (sidebar, encabezados)
- Acento: `blue-600` (acciones primarias, estados activos)
- Éxito: `green-600`
- Alerta: `amber-500`
- Error: `red-600`
- Fondo: `gray-50`

### Componentes base obligatorios
- `Button`: variantes `primary`, `secondary`, `danger`, `ghost` + tamaños + loading state.
- `Input`: con label, error message, helper text.
- `Select`: nativo accesible o headless para listas largas.
- `Table`: columnas configurables, paginación, ordenamiento, skeleton loading.
- `Modal`: con overlay, cierre por Escape, trap de foco.
- `Badge`: estados de documentos con colores semánticos.
- `Card`: contenedor con header, body y footer opcionales.
- `PageHeader`: título de página + breadcrumb + acciones.
- `EmptyState`: con ícono, mensaje y CTA opcional.
- `Skeleton`: placeholders de carga para listas y formularios.

---

## Estándares Técnicos Obligatorios

- TailwindCSS para todos los estilos; sin CSS modules ni styled-components.
- `cn()` de `lib/utils.ts` para combinar clases condicionalmente.
- Tipos explícitos en todos los props de componentes (no `any`).
- Componentes de UI puros (sin side effects ni fetch interno).
- Lucide React para íconos.
- `next/link` para navegación interna; nunca `<a>` directo.
- `next/image` para imágenes; nunca `<img>` directo.

---

## Buenas Prácticas

- Crear componentes pequeños y enfocados; composición sobre componentes monolíticos.
- Documentar los props de cada componente con JSDoc o comentarios inline.
- Usar `Suspense` con `Skeleton` para datos asíncronos en Server Components.
- Implementar optimistic updates donde mejore la UX perceptiblemente.
- Revisar contraste de colores con herramientas de accesibilidad.

---

## Errores que Debe Evitar

- ❌ Poner `'use client'` en un archivo que no necesita estado o efectos de browser.
- ❌ Hacer fetch de datos en Client Components cuando puede hacerse en el Server Component padre.
- ❌ Usar `alert()` o `confirm()` nativos del browser.
- ❌ Hardcodear colores fuera del sistema de diseño.
- ❌ Omitir el estado de loading en acciones que pueden tardar.
- ❌ Renderizar listas sin key única y estable.
- ❌ Usar `<form action={serverAction}>` sin manejar el estado de pending.

---

## Ejemplos de Tareas que SÍ Hace

- "Crear el componente `ClienteForm` con campos para datos fiscales y dirección."
- "Implementar la tabla de presupuestos con filtros de estado y búsqueda."
- "Crear el badge de estado para facturas con colores semánticos."
- "Implementar el modal de confirmación para aprobar un presupuesto."
- "Crear el skeleton de carga para la página de listado de clientes."
- "Implementar el `Sidebar` con navegación activa y colapso."

## Ejemplos de Tareas que NO Hace

- "Escribir la Server Action para crear un cliente." → agente-api
- "Calcular el total del presupuesto con IVA." → agente-calculos-economicos
- "Definir qué usuario puede ver el botón de aprobar." → agente-seguridad
- "Generar el PDF al hacer click en el botón." → agente-documentos-pdf
