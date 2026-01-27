# 📋 CAMBIOS VERSIÓN 2.1 - Sistema de Inventario

**Fecha:** 27 de Enero, 2026  
**Autor:** Copilot Assistant  
**Versión anterior:** 2.0  

---

## 🆕 NUEVAS FUNCIONALIDADES IMPLEMENTADAS

### 1. 🔍 Búsqueda Avanzada de Productos
- Filtrado por término de búsqueda (nombre, SKU, descripción)
- Filtrado por categoría
- Filtrado por proveedor
- Filtrado por rango de stock (mínimo - máximo)
- Filtrado por rango de precio (mínimo - máximo)
- Tabla de resultados con badges de stock

### 2. 📋 Reporte de Movimientos con Filtros
- Selección de rango de fechas
- Filtrado por tipo de movimiento (Entradas/Salidas/Todos)
- Filtrado por categoría
- Estadísticas en tiempo real:
  - Total de movimientos
  - Cantidad total de unidades
  - Valor total monetario
- Descarga de reporte en PDF

### 3. 💰 Reporte de Gastos Quincenal
- Selección de período personalizado
- Resumen de salidas por período
- Desglose por categoría
- Cálculo automático de totales

### 4. 📈 Estadísticas Generales del Dashboard
- Total de productos activos
- Valor total del inventario
- Movimientos del día
- Productos con stock bajo (con badge de color)

### 5. 🖼️ Gestión de Imágenes de Productos
- Subida múltiple de imágenes (hasta 5 por vez)
- Límite de 5MB por imagen
- Galería con vista previa
- Marcar imagen como principal
- Eliminar imágenes
- Modal dedicado para gestión

### 6. 📱 Generación de Códigos QR
- Generación automática de QR para cada producto
- Descarga de QR como imagen PNG
- Generación de etiquetas para impresora (2" x 1")
- Información incluida: SKU, nombre, precio, fecha

### 7. ⚠️ Notificaciones de Stock Bajo
- Panel flotante con alertas
- Verificación automática cada 5 minutos
- Lista de productos con stock crítico
- Opción para desactivar notificaciones
- Persistencia de preferencias en localStorage

---

## 📁 ARCHIVOS CREADOS

| Archivo | Descripción |
|---------|-------------|
| `routes/reportes.js` | API completa para reportes y búsqueda avanzada |

---

## 📝 ARCHIVOS MODIFICADOS

### `index.js`
- Agregada importación de `reportesRoutes`
- Registrada ruta `/api/reportes`

### `public/index.html`
- Nueva sección de reportes mejorada con:
  - Búsqueda avanzada
  - Reporte de movimientos
  - Reporte de gastos
  - Reportes rápidos
- Modal de gestión de imágenes
- Modal de generación de QR
- Panel de notificaciones de stock bajo
- Scripts de librería QRCode

### `public/js/app.js`
- Variables globales para búsqueda y movimientos
- Funciones de búsqueda avanzada:
  - `cargarSelectoresBusqueda()`
  - `setupBusquedaAvanzadaForm()`
  - `mostrarResultadosBusqueda()`
  - `limpiarBusqueda()`
- Funciones de reporte de movimientos:
  - `setupReporteMovimientosForm()`
  - `generarReporteMovimientos()`
  - `mostrarReporteMovimientos()`
  - `descargarPDFMovimientos()`
- Funciones de reporte de gastos:
  - `generarReporteGastos()`
  - `mostrarReporteGastos()`
- Funciones de estadísticas:
  - `cargarEstadisticasGenerales()`
- Funciones de gestión de imágenes:
  - `abrirModalImagenes()`
  - `cerrarModalImagenes()`
  - `cargarImagenesProducto()`
  - `setImagenPrincipal()`
  - `eliminarImagen()`
  - `setupSubirImagenesForm()`
- Funciones de QR:
  - `abrirModalQR()`
  - `cerrarModalQR()`
  - `generarCodigoQR()`
  - `generarQRInterno()`
  - `descargarQR()`
  - `imprimirEtiqueta()`
- Funciones de notificaciones:
  - `verificarStockBajo()`
  - `mostrarNotificacionesStock()`
  - `cerrarNotificacionesStock()`
  - `toggleNotificaciones()`
- Actualización de `cargarProductos()` con nuevos botones
- Actualización de `DOMContentLoaded`
- Actualización de `setupMenuNavigation()`

### `public/css/styles.css`
- Estilos para galería de imágenes
- Animación de notificaciones de stock
- Estilos para canvas de QR
- Mejoras responsive para pantallas pequeñas (480px)
- Mejoras responsive para tablets (768px)
- Soporte dark mode para nuevos elementos

---

## 🗄️ ENDPOINTS API AGREGADOS

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/reportes/buscar-productos` | Búsqueda avanzada de productos |
| POST | `/api/reportes/movimientos-rango` | Reporte de movimientos con filtros |
| POST | `/api/reportes/movimientos-pdf` | Generar PDF de movimientos |
| POST | `/api/reportes/gastos-quincenal` | Reporte de gastos por período |
| GET | `/api/reportes/estadisticas` | Estadísticas generales del sistema |
| GET | `/api/reportes/asignaciones/:tipo/:id` | Reporte de asignaciones |

---

## 📦 DEPENDENCIAS

No se agregaron nuevas dependencias npm. Se utilizan:
- CDN para QRCode: `https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js`
- CDN adicional: `https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js`

---

## 🔧 CONFIGURACIÓN REQUERIDA

1. Carpeta `uploads/productos/` debe existir con permisos 755
2. Reiniciar servidor después de cambios: `docker-compose restart`

---

## ✅ ESTADO FINAL

- [x] Búsqueda avanzada funcionando
- [x] Reportes de movimientos con PDF
- [x] Reportes de gastos
- [x] Estadísticas en tiempo real
- [x] Gestión de imágenes
- [x] Generación de QR
- [x] Notificaciones de stock bajo
- [x] Responsive design actualizado
- [x] Dark mode compatible
