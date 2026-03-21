# Guía de Mocks para Testing

## Acceso a la Página Demo

Hay una página dedicada para ver el Dashboard con datos de prueba completos:

**URL**: `http://localhost:3000/demo`

Esta página aparece *solo en desarrollo* en el menú lateral bajo la sección "🎨 DEV".

## Datos Incluidos en los Mocks

### KPIs (Comercial, Finanzas, Logística)
```
Comercial:
- 12 presupuestos pendientes
- 24 emitidos este mes
- Tasa de conversión: 65%
- 8 órdenes activas
- 5 en progreso
- 18 completadas este mes

Finanzas:
- $185,000 facturado este mes
- $142,000 cobrado
- $89,500 saldo pendiente
- 3 facturas vencidas

Logística:
- 7 notas de pedido pendientes
- 31 remitos emitidos este mes
```

### Actividad Reciente
12 registros con:
- Diferentes tipos: Factura, Orden, Presupuesto, Remito, Nota de Pedido
- Estados variados: COBRADA, EN_PROGRESO, APROBADO, ENTREGADO, PENDIENTE, COMPLETADA, ANULADO
- Fechas realistas (hasta hace 4 días)
- Clientes y subtítulos ficticios

### Alertas
3 alertas de ejemplo:
- 🔴 **Error**: 3 facturas vencidas
- 🟡 **Warning**: 7 notas de pedido pendientes  
- 🔵 **Info**: Tasa de conversión en 65%

## Cómo Usar en Componentes

### Opción 1: Parámetro en Dashboard
```tsx
<Dashboard
  nombreUsuario="Juan Martínez"
  useMocks={true}
/>
```

### Opción 2: Variable de Entorno
En `.env.local`:
```
NEXT_PUBLIC_USE_MOCKS=true
```

Luego el Dashboard usará mocks automáticamente:
```tsx
<Dashboard nombreUsuario="Juan Martínez" />
```

## Archivos de Referencia

- **Mocks**: `/app/actions/dashboard-mocks.ts`
- **Componente Demo**: `/app/(dashboard)/demo/page.tsx`
- **Dashboard**: `/components/modules/dashboard/Dashboard.tsx`

## Personalizar Mocks

Para cambiar los datos de prueba, edita `/app/actions/dashboard-mocks.ts`:

```typescript
export const mockDashboardKPIs: DashboardKPIs = {
  presupuestos_pendientes: 12,  // ← cambiar este valor
  // ...
};

export const mockActividadReciente: ActividadReciente[] = [
  // ← agregar o modificar registros
];

export const mockAlertas: AlertaDashboard[] = [
  // ← agregar o modificar alertas
];
```

## Para Desarrollo

Los mocks son perfectos para:
- ✅ Probar responsive design (flex, grids, padding)
- ✅ Verificar que todas las tarjetas tengan altura consistente
- ✅ Validar que el sidebar collapse/expand funciona
- ✅ Testing visual del layout en móvil/tablet/desktop
- ✅ Screenshots para documentación

**No afectan a la BD** - Los mocks solo se usan en el cliente.
