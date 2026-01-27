# ESTADO DE FUNCIONALIDADES - Sistema de Inventario

## ✅ COMPLETADO / FUNCIONANDO

### Autenticación y Usuarios
- [x] Login/Logout con JWT
- [x] Verificación de token
- [x] Roles (admin, usuario, visitante)
- [x] CRUD de usuarios
- [x] Activar/Desactivar usuarios
- [x] Cambio de contraseña
- [x] Permisos por usuario (24 permisos configurables)
- [x] Endpoint PUT /api/usuarios/:id/permisos

### Productos
- [x] CRUD completo de productos
- [x] Búsqueda de productos
- [x] Filtros por categoría y proveedor
- [x] Stock mínimo y alertas
- [x] Imágenes de productos (subir/eliminar)
- [x] Eliminar productos (soft delete)

### Categorías
- [x] CRUD de categorías
- [x] Eliminar categorías

### Proveedores
- [x] CRUD de proveedores

### Movimientos
- [x] Registrar entradas/salidas
- [x] Historial de movimientos
- [x] Reporte de movimientos por fecha
- [x] PDF de movimientos

### Reportes
- [x] Reporte de movimientos
- [x] Reporte de gastos quincenal
- [x] PDF de gastos
- [x] PDF de inventario completo (horizontal)
- [x] Exportar inventario a CSV/Excel
- [x] Estadísticas generales

### CSV Import/Export
- [x] Función descargarPlantillaCSV() existe
- [x] Función exportarProductosCSV() existe
- [x] Función abrirImportarCSV() existe
- [x] Endpoint POST /api/productos/importar-csv
- [x] Creación automática de categorías al importar

### Asignaciones
- [x] Formulario de asignación (personal/tienda)
- [x] Historial de asignaciones
- [x] Gestión de Personal (agregar)
- [x] Endpoints para asignaciones
- [x] Devolver asignación

### Moneda
- [x] Cambiado de $ a Lempiras (L.) en todo el sistema

### Interfaz
- [x] Notificaciones toast
- [x] Modales para edición
- [x] Sidebar con navegación
- [x] Sección de Búsqueda separada de Reportes

---

## ❌ PENDIENTE DE IMPLEMENTAR (FUTURO)

### 1. Códigos QR - NO FUNCIONA
- [ ] Revisar por qué QRious no genera el QR correctamente
- [ ] El canvas queda vacío y descarga imagen en blanco
- [ ] La etiqueta impresa sale en blanco

### 2. Barra Superior Usuario
- [ ] Mostrar correctamente: Nombre, Rol y Correo (actualmente puede no mostrarse)
- [ ] Verificar que actualizarMenuUsuario() se ejecute después del login

### 3. Stock Bajo PDF
- [ ] No funciona el botón de descargar (verificar endpoint)
- [ ] Agregar precio y proveedor - HECHO pero verificar

### 4. Reportes Rápidos
- [ ] Verificar que "Descargar inventario completo" funcione (Excel y PDF)
- [ ] Verificar que "Stock bajo" descargue correctamente

### 5. Historial de Movimientos - Detalle al hacer clic
- [ ] Cuando se hace clic en un movimiento del historial, abrir modal con detalle completo
- [ ] Mostrar: producto, cantidad, tipo, fecha, usuario, observaciones, precio, subtotal

### 6. Configuración
- [ ] Agregar opción "No mostrar más notificaciones" en menú de configuración (⚙️)
- [ ] Guardar preferencia en localStorage

### 7. Asignaciones - Ver Equipo
- [ ] Completar función "Ver equipo asignado" por personal
- [ ] Mostrar todo lo asignado a una persona o tienda
- [ ] Modal o sección con listado detallado

### 8. Asignaciones - Gestión de Catálogos
- [ ] Agregar/Editar/Eliminar DESTINOS (tiendas)
- [ ] Agregar/Editar/Eliminar DEPARTAMENTOS
- [ ] Agregar/Editar/Eliminar ZONAS/UBICACIONES
- [ ] Interfaz con "+" para agregar nuevos
- [ ] Similar a como está la gestión de Personal

### 9. Asignaciones - Tiendas
- [ ] Completar sección de asignación a tiendas
- [ ] Formulario para agregar tiendas/destinos
- [ ] Ver equipos por tienda/destino

### 10. Devoluciones
- [ ] Eliminar el cuadro de diálogo prompt()
- [ ] Hacer formulario inline o modal elegante para registrar devolución
- [ ] Similar al estilo del resto del sistema

### 11. Permisos según Rol
- [ ] Visitante: solo ver, no puede crear/editar/eliminar productos
- [ ] Usuario: puede hacer todo excepto gestionar usuarios
- [ ] Admin: acceso total + gestión de usuarios y permisos
- [ ] Aplicar permisos automáticamente según rol seleccionado
- [ ] Interfaz para que admin modifique permisos individuales

### 12. Gráficos Dinámicos en Dashboard
- [ ] Integrar Chart.js o similar
- [ ] Gráfico de movimientos por día/semana/mes
- [ ] Gráfico de productos por categoría
- [ ] Gráfico de stock bajo vs normal
- [ ] Gráfico de valor de inventario por categoría

### 13. Responsive (Móviles)
- [ ] Adaptar sidebar para móvil (hamburger menu)
- [ ] Tablas responsivas con scroll horizontal o cards
- [ ] Formularios adaptables
- [ ] Modales que no se salgan de pantalla
- [ ] Botones con tamaño adecuado para touch
- [ ] Media queries para breakpoints: 768px, 480px

### 14. Reporte de Gastos - Detalle al clic
- [ ] Cuando se genera reporte de gastos, al hacer clic en una fila
- [ ] Abrir detalle similar al de movimientos
- [ ] Mostrar información completa del gasto

### 15. Almacenamiento de Imágenes
- [ ] Evaluar mover imágenes a servicio externo (S3, Cloudinary)
- [ ] Actualmente se guardan en /uploads/productos/ (funcional pero no escalable)
- [ ] Implementar limpieza de imágenes huérfanas

### 16. Botones de Exportar/Importar en Interfaz
- [ ] Verificar que los botones estén visibles en la sección correcta
- [ ] Agregar en Reportes o Productos según corresponda

---

## � OPCIONAL / EXTRA - SEGURIDAD AVANZADA

### 17. Cifrado de Variables de Entorno
- [ ] Migrar de `.env` texto plano a Docker Secrets
- [ ] Alternativa: Usar gestor de secretos (HashiCorp Vault, Doppler, AWS Secrets Manager)
- [ ] Nunca commitear `.env` al repositorio (verificar `.gitignore`)

### 18. Cifrado de Datos Sensibles en Base de Datos
- [ ] Cifrar columnas sensibles (email, nombre, teléfono) con AES-256-GCM
- [ ] Implementar funciones `encrypt()` y `decrypt()` en Node.js usando `crypto`
- [ ] Alternativa: Usar extensión `pgcrypto` de PostgreSQL
- [ ] Las contraseñas ya están cifradas con bcrypt ✅

### 19. Cifrado de Base de Datos Completa (At-rest)
- [ ] Cifrar volumen de PostgreSQL con LUKS (Linux)
- [ ] Configurar cifrado transparente (TDE) en PostgreSQL Enterprise
- [ ] Cifrar backups de la base de datos

### 20. Cifrado de Archivos de Configuración
- [ ] Implementar git-crypt para cifrar `.env` en el repositorio
- [ ] Alternativa: Usar SOPS (Mozilla) para cifrar valores dentro de archivos
- [ ] Configurar claves GPG para acceso autorizado

**Notas de seguridad actuales:**
| Dato | Estado | Ubicación |
|------|--------|-----------|
| Credenciales DB | ⚠️ Texto plano | `.env` |
| JWT_SECRET | ⚠️ Texto plano | `.env` |
| Contraseñas usuarios | ✅ Cifradas | BD (bcrypt) |
| Emails/Nombres | ⚠️ Texto plano | BD |
| Tokens de sesión | ⚠️ Texto plano | BD |

---

## 🔧 BUGS CONOCIDOS

1. **QR vacío**: El canvas no dibuja el QR, posible problema con el orden de carga de QRious
2. **Emojis en PDF**: PDFKit no soporta emojis Unicode, se cambiaron por texto [!]
3. **actualizarMenuUsuario()**: Puede no ejecutarse si currentUser no está listo

---

## 📋 PRIORIDADES SUGERIDAS

1. **ALTA**: Arreglar códigos QR
2. **ALTA**: Verificar reportes rápidos (inventario, stock bajo)
3. **ALTA**: Completar gestión de asignaciones (destinos, departamentos)
4. **MEDIA**: Responsive para móviles
5. **MEDIA**: Gráficos en dashboard
6. **MEDIA**: Detalle de movimientos al hacer clic
7. **BAJA**: Almacenamiento externo de imágenes
8. **OPCIONAL**: Cifrado de datos sensibles y secretos

---

*Última actualización: 27 de enero de 2026*
