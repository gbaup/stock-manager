# Mejoras desktop: detalle de venta, spinner de modelo, compras puntuales

## Context
1. En Home (desktop), al hacer click en una venta se navega directo a `/inventory?model=<id>`. Se quiere un paso previo: un modal con el detalle de la venta que incluya "Ver modelo".
2. Al llegar a Inventario desde ahí, el panel derecho muestra "Elegí un modelo" mientras carga (`selDetail` es null), lo que confunde. Tiene que mostrar un spinner.
3. Los modelos que fueron una compra puntual (una sola unidad, comprada para un cliente) ensucian la lista de Inventario (desktop y mobile). Se ocultan por defecto, con una opción "Incluir compras puntuales". El criterio es **híbrido**: un flag manual en el modelo, que el formulario de compra sugiere marcado cuando el modelo nunca se compró antes y en esta compra entra 1 sola unidad (sin importar talles).

---

## 1) Modal de detalle de venta (Home, desktop)

**Files:** `components/screens/home-screen.tsx`, `components/ui/modal-footer.tsx`, nuevo `components/screens/sale-detail.tsx`

- `ModalFooter`: agregar el prop opcional `cancelLabel` (default `'Cancelar'`), así el botón secundario se reutiliza como "Editar venta". No cambia ningún uso existente.
- Nuevo `SaleDetail({ sale, model, onEdit, onOpenModel })`. Renderiza el contenido que va dentro de `DModal`:
  - `div.dm-body`: header con `Swatch` + equipo/temporada (igual que la celda de la tabla) y filas label/valor: Detalle (color · versión · número/jugador · talle), Monto, Ganancia (+ "provisorio" si `profitPending`), Cobró (Avatar + alias), Fecha (`fmtDate`), Método y Descripción si existen. Si está anulada, `Tag` "anulada" y monto tachado.
  - Footer con `ModalFooter`: secundario "Editar venta" (solo si no está anulada) y primario "Ver modelo" (deshabilitado si no hay modelo, vía `canSave`). Si está anulada, footer con un solo botón "Ver modelo" (o `ModalFooter` con `cancelLabel="Cerrar"`).
  - Sacar la línea de detalle (`color · version · number player · size`) a un helper chico `saleDetailLine(s)` en el mismo archivo, y reutilizarlo en la fila de la tabla desktop para no repetir el armado.
- `HomeContent`: nuevo estado `viewingSale`. En **desktop** el `onClick` de la fila pasa a `setViewingSale(s)` y abre `<DModal title="Detalle de venta" size="md">`. "Ver modelo" → `onOpenModel(m.id)` (misma ruta que hoy). "Editar venta" → `setViewingSale(null); setEditingSale(s)` (reutiliza el `editModal` existente). El lápiz de la fila queda igual.
- Mobile no cambia: sigue navegando a `/inventory/:id`.

## 2) Spinner en el panel derecho de Inventario (desktop)

**Files:** nuevo `components/ui/spinner.tsx`, `app/globals.css`, `components/screens/inventory-screen.tsx`

- `Spinner({ size? })`: un `<span className="spinner" role="status" aria-label="Cargando">` con borde y `@keyframes spin` en `globals.css`, usando los tokens de color existentes. Hoy no hay ningún spinner en la app.
- En `InventoryScreen`, en el render de `split-detail`:
  - `invSel && (!selDetail || selDetail.id !== invSel)` → `<DetailLoading />` (mismo contenedor centrado que `detail-empty`, con Spinner + "Cargando modelo…"). Cubre la llegada desde Home y el cambio de modelo.
  - `invSel && selDetail` (mismo id) → `ModelDetailPanel` como hoy. Un `refreshDetail` sobre el mismo modelo mantiene el dimming actual.
  - si no → `DetailEmpty`.
- Si el fetch falla o devuelve null, hoy queda en blanco. Acá conviene limpiar `invSel` si `detail` es null, para no dejar un spinner infinito.

## 3) Compras puntuales (desktop + mobile)

### Data
- `prisma/schema.prisma` → `CatalogProduct.isOneOff Boolean @default(false) @map("is_one_off")`. Migración: `npx prisma migrate dev --name add_catalog_product_is_one_off`.
- `app/lib/domain.ts`:
  - `ModelMeta` suma `isOneOff: boolean`.
  - `ModelWithStats` suma `totalUnits: number`: unidades compradas alguna vez, sumando todos los talles y todos los estados.
- `app/lib/queries.ts`:
  - `productMeta` mapea `isOneOff`.
  - `getModels` calcula `totalUnits = available + inTransit + reserved + sold` desde `stockByModel` (que ya trae `sold` en `StockCount`). No hace falta una query nueva.
  - Revisar los otros constructores de `ModelWithStats`/`ModelDetail` (por ejemplo `getModelById`) para que compilen: `countStock` ya está ahí.

### Marcado manual
- `app/lib/schemas.ts`: `modelFormSchema` suma `isOneOff: z.boolean()`.
- `components/screens/model-form.tsx`: en la sección "Notas", un `Segmented` Sí/No (o switch) "Compra puntual", con default `initial?.isOneOff ?? false`.
- `app/actions/models.ts`: `createModel` y `updateModel` persisten `isOneOff`.
- Mostrar un `Tag` "Compra puntual" en los tags del hero de `ModelDetailPanel` (`inventory-screen.tsx`) y en `components/screens/model-detail.tsx` (mobile).

### Sugerencia automática al registrar una compra
- `components/screens/purchase-form.tsx` (solo alta, no edición):
  - Por cada `modelId` del pedido: `qtyInPurchase` = suma de `quantity` de todas sus líneas (sin importar talle).
  - **Sugerido** = `m.totalUnits === 0 && qtyInPurchase === 1`, es decir, nunca se compró antes y viene una sola unidad.
  - Se muestra un checkbox "Compra puntual" en la **primera** línea de ese modelo cuando la sugerencia aplica **o** cuando el modelo ya tiene `isOneOff` (en ese caso arranca desmarcado: volver a comprarlo sugiere que ya no es puntual).
  - El estado vive en `useState<Record<modelId, boolean>>` de overrides; el valor efectivo es `override ?? default`.
  - Al enviar: `oneOffFlags: { modelId, isOneOff }[]`, solo con los modelos donde se mostró el checkbox.
- `app/actions/purchases.ts` → `createPurchase` acepta `oneOffFlags?` (agregarlo al zod `createPurchaseSchema`). Dentro de la misma `$transaction`, hace `catalogProduct.update({ isOneOff })` por cada uno y después `updateTag('models')` (verificar que ya lo hace).

### Ocultar en Inventario
- `components/screens/inventory-screen.tsx`:
  - Un modelo se oculta si `m.isOneOff && m.stock === 0 && m.inTransit === 0 && m.reserved === 0`. Un puntual que todavía está en camino, en stock o reservado sigue visible, porque hay que gestionarlo.
  - Nuevo estado `includeOneOff` (default `false`). Toggle como chip al final de la fila de filtros: "Incluir compras puntuales" (`chip is-active` cuando está activo, con count de ocultos). Va en desktop (`split-list-tools`) y en mobile (`.chips`). Solo se muestra si hay alguno oculto.
  - El filtro se aplica antes que `matchesModel`/filtros. `counts` y el subtítulo se calculan sobre la lista base ya filtrada, para que los números coincidan con lo que se ve.
- No se tocan Home (KPIs, ventas, picker de venta rápida) ni el catálogo público.

---

## Verificación
- `npm run lint && npm run build` (equivale al pre-push).
- `npx prisma migrate dev` aplica sin errores. Los modelos existentes quedan con `isOneOff=false`.
- `npm run dev`, en desktop:
  1. Home → click en una venta → abre el modal de detalle con los datos correctos. "Ver modelo" navega a Inventario con el modelo seleccionado. "Editar venta" abre el modal de edición. Una venta anulada no muestra "Editar". El lápiz de la fila sigue abriendo la edición directo.
  2. En Inventario se ve el spinner en el panel derecho mientras carga, tanto al llegar desde Home como al cambiar de modelo. Reservar/liberar sigue refrescando sin spinner.
  3. Editar un modelo agotado → marcar "Compra puntual" → desaparece de la lista. El chip "Incluir compras puntuales" lo vuelve a mostrar, con el tag en el detalle.
  4. Nueva compra con un modelo nuevo × 1 → checkbox sugerido marcado. Con cantidad 2 o un modelo con compras previas → no aparece. Con un modelo ya puntual → aparece desmarcado y al guardar se desmarca.
- En mobile (viewport chico): la lista de Inventario oculta los puntuales y muestra el chip. Home sigue navegando al modelo como antes.
