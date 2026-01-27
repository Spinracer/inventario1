const API_URL = '/api';
let currentUser = null;
let authToken = null;
let userPermissions = {};

// ========== DARK MODE ==========
function initDarkMode() {
    // Verificar preferencia guardada o usar preferencia del sistema
    const savedMode = localStorage.getItem('darkMode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDarkMode = savedMode ? savedMode === 'true' : prefersDark;
    
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        updateDarkModeButton(true);
    }
}

function toggleDarkMode() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    updateDarkModeButton(isDarkMode);
}

function updateDarkModeButton(isDarkMode) {
    const btn = document.getElementById('darkModeToggle');
    if (btn) {
        btn.textContent = isDarkMode ? '☀️' : '🌙';
        btn.title = isDarkMode ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
    }
}

// ========== SISTEMA DE NOTIFICACIONES TOAST ==========
function showToast(message, type = 'info', title = '') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    const titles = {
        success: title || 'Éxito',
        error: title || 'Error',
        warning: title || 'Advertencia',
        info: title || 'Información'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <div class="toast-content">
            <div class="toast-title">${titles[type]}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove después de 5 segundos
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ========== AUTENTICACIÓN Y TOKEN ==========
function setAuthToken(token) {
    authToken = token;
    try {
        localStorage.setItem('authToken', token);
        console.log('✅ Token guardado en localStorage');
    } catch (e) {
        console.error('⚠️ Error guardando token en localStorage:', e);
    }
}

function getAuthToken() {
    if (!authToken) {
        try {
            authToken = localStorage.getItem('authToken');
            console.log('📍 Token recuperado de localStorage:', authToken ? 'Sí' : 'No');
        } catch (e) {
            console.error('⚠️ Error leyendo localStorage:', e);
        }
    }
    return authToken;
}

function clearAuth() {
    authToken = null;
    currentUser = null;
    userPermissions = {};
    localStorage.removeItem('authToken');
}

// ========== FUNCIÓN DE VERIFICACIÓN DE PERMISOS ==========
// Verifica si el usuario actual tiene un permiso específico
function tienePermiso(permiso) {
    // Admin siempre tiene todos los permisos
    if (currentUser && currentUser.rol === 'admin') {
        return true;
    }
    // Verificar el permiso específico en userPermissions
    return userPermissions && userPermissions[permiso] === true;
}

// Aplica los permisos a la interfaz ocultando/mostrando elementos
function aplicarPermisosInterfaz() {
    console.log('🔐 Aplicando permisos a la interfaz:', userPermissions);
    
    // === MENU LATERAL ===
    // Mostrar/ocultar menú de Usuarios
    const menuUsuarios = document.getElementById('menuUsuarios');
    if (menuUsuarios) {
        menuUsuarios.style.display = tienePermiso('ver_usuarios') ? 'flex' : 'none';
    }
    
    // === PRODUCTOS ===
    // Botón nuevo producto
    const btnNuevoProducto = document.querySelector('[onclick="mostrarFormProducto()"]');
    if (btnNuevoProducto) {
        btnNuevoProducto.style.display = tienePermiso('crear_productos') ? 'inline-flex' : 'none';
    }
    
    // Formulario de producto
    const formProducto = document.getElementById('formProducto');
    if (formProducto && !tienePermiso('crear_productos')) {
        formProducto.classList.add('hidden');
    }
    
    // === CATEGORÍAS ===
    // Botón nueva categoría
    const btnNuevaCategoria = document.querySelector('[onclick="mostrarFormCategoria()"]');
    if (btnNuevaCategoria) {
        btnNuevaCategoria.style.display = tienePermiso('crear_categorias') ? 'inline-flex' : 'none';
    }
    
    // === MOVIMIENTOS ===
    // Formulario de movimientos
    const formMovimiento = document.getElementById('movimientoForm');
    if (formMovimiento) {
        const puedeEntrada = tienePermiso('crear_entrada');
        const puedeSalida = tienePermiso('crear_salida');
        // Si no puede hacer ninguno, ocultar formulario
        if (!puedeEntrada && !puedeSalida) {
            formMovimiento.closest('.card').style.display = 'none';
        } else {
            formMovimiento.closest('.card').style.display = 'block';
            // Ajustar opciones del select de tipo
            const selectTipo = formMovimiento.querySelector('[name="tipo"]');
            if (selectTipo) {
                Array.from(selectTipo.options).forEach(opt => {
                    if (opt.value === 'ENTRADA') opt.disabled = !puedeEntrada;
                    if (opt.value === 'SALIDA') opt.disabled = !puedeSalida;
                });
            }
        }
    }
    
    // === PROVEEDORES ===
    // Botón nuevo proveedor
    const btnNuevoProveedor = document.querySelector('[onclick="mostrarFormProveedor()"]');
    if (btnNuevoProveedor) {
        btnNuevoProveedor.style.display = tienePermiso('crear_proveedores') ? 'inline-flex' : 'none';
    }
    
    // === ASIGNACIONES ===
    // Formulario de asignaciones
    const formAsignacion = document.getElementById('asignacionForm');
    if (formAsignacion) {
        formAsignacion.closest('.card').style.display = tienePermiso('crear_asignaciones') ? 'block' : 'none';
    }
    // Botón agregar personal
    const btnAgregarPersonal = document.querySelector('[onclick="mostrarFormPersonal()"]');
    if (btnAgregarPersonal) {
        btnAgregarPersonal.style.display = tienePermiso('crear_asignaciones') ? 'inline-flex' : 'none';
    }
    
    console.log('✅ Permisos aplicados a la interfaz');
}

// Función para hacer peticiones autenticadas
async function fetchAuth(url, options = {}) {
    const token = getAuthToken();
    
    if (!token) {
        clearAuth();
        mostrarLogin();
        showToast('No hay sesión activa. Por favor inicia sesión.', 'warning');
        throw new Error('No hay token de autenticación');
    }
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };
    
    try {
        const response = await fetch(url, { ...options, headers });
        
        // Si el token expiró o no es válido, limpiar sesión
        if (response.status === 401) {
            clearAuth();
            mostrarLogin();
            showToast('Sesión expirada. Por favor inicia sesión nuevamente.', 'warning');
            throw new Error('Token expirado o inválido');
        }
        
        return response;
    } catch (error) {
        console.error('Error en fetchAuth:', error);
        throw error;
    }
}

// Verificar autenticación al cargar
async function verificarAutenticacion() {
    const token = getAuthToken();
    
    if (!token) {
        console.log('❌ No hay token en localStorage');
        mostrarLogin();
        return false;
    }
    
    try {
        console.log('🔐 Verificando token con el servidor...');
        const response = await fetchAuth(`${API_URL}/auth/verificar`);
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.usuario;
            userPermissions = data.permisos;
            console.log('✅ Autenticación válida para:', currentUser.email);
            return true;
        } else {
            console.log('❌ Respuesta no OK:', response.status);
            clearAuth();
            mostrarLogin();
            return false;
        }
    } catch (error) {
        console.error('❌ Error verificando autenticación:', error);
        clearAuth();
        mostrarLogin();
        return false;
    }
}

function mostrarLogin() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('dashboard').classList.remove('active');
}

function mostrarDashboard() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('dashboard').classList.add('active');
}

// ========== LOGIN ==========
function setupLoginForm() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) {
        console.error('❌ Elemento loginForm no encontrado');
        return;
    }
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            console.log('🔐 Intentando login con:', email);
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                console.log('✅ Login exitoso');
                setAuthToken(data.token);
                currentUser = data.usuario;
                userPermissions = data.permisos;
                
                console.log('📌 Datos guardados:', {
                    usuario: currentUser.email,
                    token: data.token ? data.token.substring(0, 20) + '...' : 'Sin token',
                    permisos: userPermissions
                });
                
                mostrarDashboard();
                showToast(`Bienvenido ${data.usuario.nombre}`, 'success');
                cargarDashboard();
                aplicarPermisosInterfaz(); // Aplicar permisos a la UI
                actualizarMenuUsuario(); // Actualizar info de usuario en barra superior
            } else {
                console.log('❌ Login fallido:', data.mensaje);
                showToast(data.mensaje || 'Credenciales incorrectas', 'error');
            }
        } catch (error) {
            console.error('Error en login:', error);
            showToast('Error al iniciar sesión', 'error');
        }
    });
}

// ========== LOGOUT ==========
async function logout() {
    try {
        await fetchAuth(`${API_URL}/auth/logout`, { method: 'POST' });
    } catch (error) {
        console.error('Error en logout:', error);
    } finally {
        // Limpiar completamente los datos de sesión
        clearAuth();
        
        // Cerrar cualquier menú abierto
        const menuDropdown = document.getElementById('menuUsuarioDropdown');
        if (menuDropdown) menuDropdown.remove();
        
        // Resetear la interfaz de usuario en la barra superior
        const userInfo = document.querySelector('.user-info');
        if (userInfo) {
            userInfo.innerHTML = `
                <div class="user-avatar">?</div>
                <div>
                    <div style="font-weight: 600;">Usuario</div>
                    <div style="font-size: 12px;" class="text-gray">Sin sesión</div>
                </div>
            `;
        }
        
        // Limpiar formulario de login
        const loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.reset();
        
        mostrarLogin();
        showToast('Sesión cerrada exitosamente', 'info');
    }
}

// ========== MENU NAVIGATION ==========
function setupMenuNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    if (menuItems.length === 0) {
        console.error('❌ No se encontraron elementos .menu-item');
        return;
    }
    
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            const section = this.dataset.section;
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
            document.getElementById('section-' + section).classList.add('active');
            
            const titles = {
                dashboard: 'Dashboard',
                productos: 'Gestión de Productos',
                categorias: 'Gestión de Categorías',
                movimientos: 'Movimientos de Inventario',
                asignaciones: 'Gestión de Asignaciones',
                proveedores: 'Gestión de Proveedores',
                usuarios: 'Gestión de Usuarios',
                reportes: 'Reportes'
            };
            document.getElementById('pageTitle').textContent = titles[section];

            if (section === 'productos') cargarProductos();
            if (section === 'categorias') cargarCategorias();
            if (section === 'movimientos') cargarMovimientos();
            if (section === 'asignaciones') {
                cargarAsignaciones();
                cargarPersonal();
                cargarDestinos();
                cargarProductosParaAsignaciones();
                cargarDepartamentosYZonas();
            }
            if (section === 'proveedores') cargarProveedores();
            if (section === 'usuarios') cargarUsuarios();
            if (section === 'reportes') {
                cargarSelectoresBusqueda();
                cargarEstadisticasGenerales();
            }
        });
    });
}

// ========== DASHBOARD ==========
async function cargarDashboard() {
    try {
        const [productos, categorias, stockBajo] = await Promise.all([
            fetchAuth(`${API_URL}/productos`).then(r => r.json()),
            fetchAuth(`${API_URL}/categorias`).then(r => r.json()),
            fetchAuth(`${API_URL}/reportes/stock-bajo`).then(r => r.json())
        ]);

        document.getElementById('totalProductos').textContent = productos.length;
        document.getElementById('stockTotal').textContent = productos.reduce((sum, p) => sum + parseInt(p.stock), 0);
        document.getElementById('stockBajo').textContent = stockBajo.length;
        document.getElementById('totalCategorias').textContent = categorias.length;

        const tbody = document.querySelector('#stockBajoTable tbody');
        tbody.innerHTML = stockBajo.map(p => `
            <tr>
                <td>${p.nombre}</td>
                <td>${p.sku}</td>
                <td><span class="badge badge-danger">${p.stock}</span></td>
                <td>${p.stock_minimo}</td>
                <td><span class="badge badge-warning">⚠️ Stock Bajo</span></td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error al cargar dashboard:', error);
        showToast('Error al cargar el dashboard', 'error');
    }
}

// ========== PRODUCTOS ==========
async function cargarProductos() {
    try {
        const productos = await fetchAuth(`${API_URL}/productos`).then(r => r.json());
        const tbody = document.querySelector('#productosTable tbody');
        
        // Verificar permisos para botones de acción
        const puedeEditar = tienePermiso('editar_productos');
        const puedeEliminar = tienePermiso('eliminar_productos');
        
        tbody.innerHTML = productos.map(p => `
            <tr>
                <td>${p.nombre}</td>
                <td>${p.sku}</td>
                <td>${p.categoria_nombre || 'Sin categoría'}</td>
                <td>L.${parseFloat(p.precio).toFixed(2)}</td>
                <td><span class="badge ${p.stock <= p.stock_minimo ? 'badge-danger' : 'badge-success'}">${p.stock}</span></td>
                <td><span class="badge badge-success">Activo</span></td>
                <td>
                    <div class="action-buttons">
                        ${puedeEditar ? `<button class="btn btn-sm" style="background: #3b82f6; color: white;" onclick="abrirModalEditarProducto(${p.id})" title="Editar">✏️</button>` : ''}
                        ${puedeEditar ? `<button class="btn btn-sm" style="background: #10b981; color: white;" onclick="abrirModalImagenes(${p.id})" title="Imágenes">🖼️</button>` : ''}
                        <button class="btn btn-sm" style="background: #8b5cf6; color: white;" onclick="abrirModalQR(${p.id})" title="Generar QR">📱</button>
                        ${puedeEliminar ? `<button class="btn btn-sm btn-danger" onclick="eliminarProducto(${p.id})" title="Eliminar">🗑️</button>` : ''}
                    </div>
                </td>
            </tr>
        `).join('');

        await cargarCategoriasEnSelect();
    } catch (error) {
        console.error('Error al cargar productos:', error);
        showToast('Error al cargar productos', 'error');
    }
}

async function eliminarProducto(id) {
    // Verificar permiso antes de ejecutar
    if (!tienePermiso('eliminar_productos')) {
        showToast('No tienes permiso para eliminar productos', 'error');
        return;
    }
    if (confirm('¿Estás seguro de eliminar este producto?')) {
        try {
            const response = await fetchAuth(`${API_URL}/productos/${id}`, {method: 'DELETE'});
            if (response.ok) {
                showToast('Producto eliminado exitosamente', 'success');
                cargarProductos();
                cargarDashboard();
            }
        } catch (error) {
            showToast('Error al eliminar producto', 'error');
        }
    }
}

// Abrir modal para editar producto
async function abrirModalEditarProducto(id) {
    // Verificar permiso antes de abrir modal
    if (!tienePermiso('editar_productos')) {
        showToast('No tienes permiso para editar productos', 'error');
        return;
    }
    try {
        const producto = await fetchAuth(`${API_URL}/productos/${id}`).then(r => r.json());
        
        document.getElementById('editProductoId').value = producto.id;
        document.getElementById('editNombre').value = producto.nombre;
        document.getElementById('editSku').value = producto.sku;
        document.getElementById('editPrecio').value = producto.precio;
        document.getElementById('editStockMinimo').value = producto.stock_minimo;
        document.getElementById('editDescripcion').value = producto.descripcion || '';
        document.getElementById('editActivo').value = producto.activo;
        
        // Cargar categorías en el select
        const categorias = await fetchAuth(`${API_URL}/categorias`).then(r => r.json());
        const selectCategoria = document.getElementById('editCategoria');
        selectCategoria.innerHTML = '<option value="">Sin categoría</option>' + 
            categorias.map(c => `<option value="${c.id}" ${c.id === producto.categoria_id ? 'selected' : ''}>${c.nombre}</option>`).join('');
        
        document.getElementById('modalEditarProducto').classList.add('active');
    } catch (error) {
        console.error('Error al cargar producto:', error);
        showToast('Error al cargar el producto', 'error');
    }
}

function cerrarModalEditarProducto() {
    document.getElementById('modalEditarProducto').classList.remove('active');
}

// Submit editar producto
function setupEditProductoForm() {
    const formEditarProducto = document.getElementById('formEditarProducto');
    if (!formEditarProducto) {
        console.error('❌ Elemento formEditarProducto no encontrado');
        return;
    }
    
    formEditarProducto.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const id = document.getElementById('editProductoId').value;
        const data = {
            nombre: document.getElementById('editNombre').value,
            descripcion: document.getElementById('editDescripcion').value,
            precio: parseFloat(document.getElementById('editPrecio').value),
            stock_minimo: parseInt(document.getElementById('editStockMinimo').value),
            categoria_id: document.getElementById('editCategoria').value || null,
            activo: document.getElementById('editActivo').value === 'true'
        };

        try {
            const response = await fetchAuth(`${API_URL}/productos/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });

            if (response.ok) {
                showToast('Producto actualizado exitosamente', 'success');
                cerrarModalEditarProducto();
                cargarProductos();
                cargarDashboard();
            } else if (response.status === 401) {
                clearAuth();
                mostrarLogin();
                showToast('Sesión expirada. Por favor inicia sesión nuevamente.', 'warning');
            } else {
                showToast('Error al actualizar producto', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            if (!error.message.includes('Token')) {
                showToast('Error al actualizar producto', 'error');
            }
        }
    });
}

// ========== CATEGORÍAS ==========
async function cargarCategorias() {
    try {
        const categorias = await fetchAuth(`${API_URL}/categorias`).then(r => r.json());
        const tbody = document.querySelector('#categoriasTable tbody');
        
        // Verificar permisos para botones de acción
        const puedeEliminar = tienePermiso('eliminar_categorias');
        
        tbody.innerHTML = categorias.map(c => `
            <tr>
                <td>${c.id}</td>
                <td>${c.nombre}</td>
                <td>${c.descripcion || '-'}</td>
                <td>${new Date(c.created_at).toLocaleDateString()}</td>
                <td>
                    ${puedeEliminar ? `<button class="btn btn-sm btn-danger" onclick="eliminarCategoria(${c.id})">Eliminar</button>` : '-'}
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error al cargar categorías:', error);
        showToast('Error al cargar categorías', 'error');
    }
}

async function cargarCategoriasEnSelect() {
    try {
        const categorias = await fetchAuth(`${API_URL}/categorias`).then(r => r.json());
        
        document.getElementById('categoriaSelect').innerHTML = '<option value="">Sin categoría</option>' + 
            categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

        const productos = await fetchAuth(`${API_URL}/productos`).then(r => r.json());
        document.getElementById('productoSelectMov').innerHTML = 
            productos.map(p => `<option value="${p.id}">${p.nombre} (Stock: ${p.stock})</option>`).join('');
    } catch (error) {
        console.error('Error al cargar categorías en select:', error);
    }
}

// ========== MOVIMIENTOS ==========
async function cargarMovimientos() {
    try {
        const movimientos = await fetchAuth(`${API_URL}/movimientos`).then(r => r.json());
        const tbody = document.querySelector('#movimientosTable tbody');
        tbody.innerHTML = movimientos.map(m => `
            <tr>
                <td>${new Date(m.created_at).toLocaleString()}</td>
                <td>${m.producto_nombre}</td>
                <td><span class="badge ${m.tipo === 'ENTRADA' ? 'badge-success' : 'badge-warning'}">${m.tipo}</span></td>
                <td>${m.cantidad}</td>
                <td>${m.motivo || '-'}</td>
            </tr>
        `).join('');
        await cargarCategoriasEnSelect();
    } catch (error) {
        console.error('Error al cargar movimientos:', error);
        showToast('Error al cargar movimientos', 'error');
    }
}

// ========== FORMS ==========
function mostrarFormProducto() {
    // Verificar permiso
    if (!tienePermiso('crear_productos')) {
        showToast('No tienes permiso para crear productos', 'error');
        return;
    }
    document.getElementById('formProducto').classList.remove('hidden');
}

function ocultarFormProducto() {
    document.getElementById('formProducto').classList.add('hidden');
    document.getElementById('productoForm').reset();
}

function mostrarFormCategoria() {
    // Verificar permiso
    if (!tienePermiso('crear_categorias')) {
        showToast('No tienes permiso para crear categorías', 'error');
        return;
    }
    document.getElementById('formCategoria').classList.remove('hidden');
}

function ocultarFormCategoria() {
    document.getElementById('formCategoria').classList.add('hidden');
    document.getElementById('categoriaForm').reset();
}

// ========== SUBMIT FORMS ==========

// Submit Producto
function setupProductoForm() {
    const productoForm = document.getElementById('productoForm');
    if (!productoForm) {
        console.error('❌ Elemento productoForm no encontrado');
        return;
    }
    
    productoForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const data = Object.fromEntries(formData);
        
        // Convertir valores numéricos y manejar categoría_id vacía
        data.stock = parseInt(data.stock) || 0;
        data.stock_minimo = parseInt(data.stock_minimo) || 0;
        data.precio = parseFloat(data.precio) || 0;
        data.categoria_id = data.categoria_id ? parseInt(data.categoria_id) : null;

        try {
            const response = await fetchAuth(`${API_URL}/productos`, {
                method: 'POST',
                body: JSON.stringify(data)
            });

            if (response.ok) {
                showToast('Producto creado exitosamente', 'success');
                ocultarFormProducto();
                cargarProductos();
                cargarDashboard();
            } else if (response.status === 401) {
                clearAuth();
                mostrarLogin();
                showToast('Sesión expirada. Por favor inicia sesión nuevamente.', 'warning');
            } else {
                const error = await response.json();
                showToast(error.mensaje || error.error || 'Error al crear producto', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            if (!error.message.includes('Token')) {
                showToast('Error al crear producto: ' + error.message, 'error');
            }
        }
    });
}

// Submit Categoría
function setupCategoriaForm() {
    const categoriaForm = document.getElementById('categoriaForm');
    if (!categoriaForm) {
        console.error('❌ Elemento categoriaForm no encontrado');
        return;
    }
    
    categoriaForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const data = Object.fromEntries(formData);

        try {
            const response = await fetchAuth(`${API_URL}/categorias`, {
                method: 'POST',
                body: JSON.stringify(data)
            });

            if (response.ok) {
                showToast('Categoría creada exitosamente', 'success');
                ocultarFormCategoria();
                cargarCategorias();
                cargarDashboard();
            } else if (response.status === 401) {
                clearAuth();
                mostrarLogin();
                showToast('Sesión expirada. Por favor inicia sesión nuevamente.', 'warning');
            } else {
                const error = await response.json();
                showToast(error.mensaje || 'Error al crear categoría', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            if (!error.message.includes('Token')) {
                showToast('Error al crear categoría', 'error');
            }
        }
    });
}

// Submit Movimiento
function setupMovimientoForm() {
    const movimientoForm = document.getElementById('movimientoForm');
    if (!movimientoForm) {
        console.error('❌ Elemento movimientoForm no encontrado');
        return;
    }
    
    movimientoForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const data = Object.fromEntries(formData);

        try {
            const tipo = data.tipo.toLowerCase();
            const response = await fetchAuth(`${API_URL}/movimientos/${tipo}`, {
                method: 'POST',
                body: JSON.stringify(data)
            });

            if (response.ok) {
                showToast('Movimiento registrado exitosamente', 'success');
                this.reset();
                cargarMovimientos();
                cargarDashboard();
            } else if (response.status === 401) {
                clearAuth();
                mostrarLogin();
                showToast('Sesión expirada. Por favor inicia sesión nuevamente.', 'warning');
            } else {
                const error = await response.json();
                showToast(error.mensaje || error.error, 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            if (!error.message.includes('Token')) {
                showToast('Error al registrar movimiento', 'error');
            }
        }
    });
}

// ========== REPORTES ==========
function abrirModalReporteMovimientos() {
    const modal = document.getElementById('modalReporteMovimientos');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function cerrarModalReporteMovimientos() {
    const modal = document.getElementById('modalReporteMovimientos');
    if (modal) {
        modal.style.display = 'none';
    }
}

function generarReportePDF(tipo) {
    if (!tipo || !['ENTRADA', 'SALIDA'].includes(tipo)) {
        showToast('Tipo de reporte inválido', 'error');
        return;
    }

    const token = getAuthToken();
    if (!token) {
        showToast('No hay sesión activa', 'warning');
        return;
    }

    // Crear un iframe temporal para descargar el PDF
    const link = document.createElement('a');
    link.href = `${API_URL}/reportes/movimientos-pdf?tipo=${tipo}`;
    link.style.display = 'none';
    document.body.appendChild(link);
    
    // Necesitamos usar fetch para incluir el token en el header
    fetchAuth(`${API_URL}/reportes/movimientos-pdf?tipo=${tipo}`)
        .then(response => {
            if (response.ok) {
                return response.blob();
            } else {
                throw new Error('Error al generar reporte');
            }
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reporte_${tipo}_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            
            showToast(`Reporte de ${tipo} generado exitosamente`, 'success');
            cerrarModalReporteMovimientos();
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Error al generar el reporte PDF', 'error');
        });
}

function verStockBajo() {
    window.open(`${API_URL}/reportes/stock-bajo`, '_blank');
}

// ========== BÚSQUEDA AVANZADA ==========
let ultimosResultadosBusqueda = [];
let ultimosMovimientos = [];

async function cargarSelectoresBusqueda() {
    try {
        const [categorias, proveedores] = await Promise.all([
            fetchAuth(`${API_URL}/categorias`).then(r => r.json()),
            fetchAuth(`${API_URL}/proveedores`).then(r => r.json())
        ]);
        
        const catSelect = document.getElementById('busquedaCategoriaSelect');
        const provSelect = document.getElementById('busquedaProveedorSelect');
        const reporteCatSelect = document.getElementById('reporteCategoriaSelect');
        
        if (catSelect) {
            catSelect.innerHTML = '<option value="">Todas</option>' + 
                categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        }
        
        if (reporteCatSelect) {
            reporteCatSelect.innerHTML = '<option value="">Todas</option>' + 
                categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        }
        
        if (provSelect) {
            provSelect.innerHTML = '<option value="">Todos</option>' + 
                proveedores.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
        }
    } catch (error) {
        console.error('Error cargando selectores:', error);
    }
}

function setupBusquedaAvanzadaForm() {
    const form = document.getElementById('busquedaAvanzadaForm');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        let data = Object.fromEntries(formData);
        
        // Limpiar valores vacíos
        Object.keys(data).forEach(key => {
            if (data[key] === '') delete data[key];
        });

        try {
            const response = await fetchAuth(`${API_URL}/reportes/buscar-productos`, {
                method: 'POST',
                body: JSON.stringify(data)
            });

            if (response.ok) {
                const resultados = await response.json();
                ultimosResultadosBusqueda = resultados;
                mostrarResultadosBusqueda(resultados);
            } else {
                showToast('Error al realizar la búsqueda', 'error');
            }
        } catch (error) {
            console.error('Error en búsqueda:', error);
            showToast('Error al realizar la búsqueda', 'error');
        }
    });
}

function mostrarResultadosBusqueda(resultados) {
    const container = document.getElementById('resultadosBusqueda');
    const tbody = document.querySelector('#resultadosBusquedaTable tbody');
    
    if (resultados.length === 0) {
        showToast('No se encontraron productos con esos criterios', 'warning');
        container.classList.add('hidden');
        return;
    }
    
    tbody.innerHTML = resultados.map(p => `
        <tr>
            <td>${p.nombre}</td>
            <td>${p.sku || 'N/A'}</td>
            <td>${p.categoria_nombre || 'Sin categoría'}</td>
            <td>${p.proveedor_nombre || 'Sin proveedor'}</td>
            <td><span class="badge ${p.stock <= p.stock_minimo ? 'badge-danger' : 'badge-success'}">${p.stock}</span></td>
            <td>L.${parseFloat(p.precio).toFixed(2)}</td>
        </tr>
    `).join('');
    
    container.classList.remove('hidden');
    showToast(`Se encontraron ${resultados.length} productos`, 'success');
}

function limpiarBusqueda() {
    document.getElementById('busquedaAvanzadaForm').reset();
    document.getElementById('resultadosBusqueda').classList.add('hidden');
    ultimosResultadosBusqueda = [];
}

// ========== REPORTE DE MOVIMIENTOS CON FILTROS ==========
function setupReporteMovimientosForm() {
    const form = document.getElementById('reporteMovimientosForm');
    if (!form) return;
    
    // Establecer fechas por defecto (últimos 30 días)
    const hoy = new Date();
    const hace30Dias = new Date(hoy.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    const fechaFin = document.getElementById('fechaFin');
    const fechaInicio = document.getElementById('fechaInicio');
    
    if (fechaFin) fechaFin.value = hoy.toISOString().split('T')[0];
    if (fechaInicio) fechaInicio.value = hace30Dias.toISOString().split('T')[0];
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        await generarReporteMovimientos();
    });
}

async function generarReporteMovimientos() {
    const formData = new FormData(document.getElementById('reporteMovimientosForm'));
    let data = Object.fromEntries(formData);
    
    Object.keys(data).forEach(key => {
        if (data[key] === '') delete data[key];
    });

    try {
        const response = await fetchAuth(`${API_URL}/reportes/movimientos-rango`, {
            method: 'POST',
            body: JSON.stringify(data)
        });

        if (response.ok) {
            const movimientos = await response.json();
            ultimosMovimientos = movimientos;
            mostrarReporteMovimientos(movimientos);
        } else {
            showToast('Error al generar reporte', 'error');
        }
    } catch (error) {
        console.error('Error generando reporte:', error);
        showToast('Error al generar reporte', 'error');
    }
}

function mostrarReporteMovimientos(movimientos) {
    const container = document.getElementById('resultadosReporte');
    const tbody = document.querySelector('#reporteMovimientosTable tbody');
    
    if (movimientos.length === 0) {
        showToast('No hay movimientos en el período seleccionado', 'warning');
        container.classList.add('hidden');
        return;
    }
    
    let totalCantidad = 0;
    let totalValor = 0;
    
    tbody.innerHTML = movimientos.map(m => {
        const precio = parseFloat(m.precio) || 0;
        const subtotal = m.cantidad * precio;
        totalCantidad += m.cantidad;
        totalValor += subtotal;
        
        return `
            <tr>
                <td>${new Date(m.created_at).toLocaleDateString('es-HN')}</td>
                <td>${m.producto_nombre}</td>
                <td><span class="badge badge-${m.tipo === 'ENTRADA' ? 'success' : 'warning'}">${m.tipo}</span></td>
                <td>${m.cantidad}</td>
                <td>L.${precio.toFixed(2)}</td>
                <td>L.${subtotal.toFixed(2)}</td>
                <td>${m.usuario_nombre || 'N/A'}</td>
            </tr>
        `;
    }).join('');
    
    document.getElementById('reporteTotalMovimientos').textContent = movimientos.length;
    document.getElementById('reporteCantidadTotal').textContent = totalCantidad;
    document.getElementById('reporteValorTotal').textContent = `L.${totalValor.toFixed(2)}`;
    
    container.classList.remove('hidden');
    showToast(`Reporte generado: ${movimientos.length} movimientos`, 'success');
}

async function descargarPDFMovimientos() {
    if (ultimosMovimientos.length === 0) {
        showToast('Primero genera el reporte', 'warning');
        return;
    }
    
    const formData = new FormData(document.getElementById('reporteMovimientosForm'));
    let data = Object.fromEntries(formData);
    data.movimientos = ultimosMovimientos;
    
    try {
        const response = await fetchAuth(`${API_URL}/reportes/movimientos-pdf`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Reporte_Movimientos_${data.fecha_inicio}_${data.fecha_fin}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showToast('PDF descargado exitosamente', 'success');
        } else {
            showToast('Error al generar PDF', 'error');
        }
    } catch (error) {
        console.error('Error descargando PDF:', error);
        showToast('Error al descargar PDF', 'error');
    }
}

// ========== REPORTE DE GASTOS ==========
async function generarReporteGastos() {
    const inicio = document.getElementById('gastosInicio').value;
    const fin = document.getElementById('gastosFin').value;
    
    if (!inicio || !fin) {
        showToast('Selecciona ambas fechas', 'warning');
        return;
    }
    
    try {
        const response = await fetchAuth(`${API_URL}/reportes/gastos-quincenal`, {
            method: 'POST',
            body: JSON.stringify({ fecha_inicio: inicio, fecha_fin: fin })
        });
        
        if (response.ok) {
            const data = await response.json();
            mostrarReporteGastos(data);
        } else {
            showToast('Error al generar reporte de gastos', 'error');
        }
    } catch (error) {
        console.error('Error en reporte de gastos:', error);
        showToast('Error al generar reporte de gastos', 'error');
    }
}

function mostrarReporteGastos(data) {
    const container = document.getElementById('resultadosGastos');
    
    document.getElementById('gastosMovimientos').textContent = data.resumen.total_movimientos;
    document.getElementById('gastosUnidades').textContent = data.resumen.total_unidades;
    document.getElementById('gastosTotal').textContent = `L.${data.resumen.total_gasto.toFixed(2)}`;
    
    const tbody = document.querySelector('#gastosCategoriaTable tbody');
    tbody.innerHTML = Object.entries(data.resumen.por_categoria).map(([cat, datos]) => `
        <tr>
            <td>${cat}</td>
            <td>${datos.cantidad}</td>
            <td>L.${datos.total.toFixed(2)}</td>
        </tr>
    `).join('');
    
    container.classList.remove('hidden');
    showToast('Reporte de gastos generado', 'success');
}

async function descargarPDFGastos() {
    const inicio = document.getElementById('gastosInicio').value;
    const fin = document.getElementById('gastosFin').value;
    
    if (!inicio || !fin) {
        showToast('Primero genera el reporte seleccionando las fechas', 'warning');
        return;
    }
    
    try {
        showToast('Generando PDF...', 'info');
        
        const response = await fetchAuth(`${API_URL}/reportes/gastos-pdf`, {
            method: 'POST',
            body: JSON.stringify({ fecha_inicio: inicio, fecha_fin: fin })
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Reporte_Gastos_${inicio}_${fin}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            showToast('PDF de gastos descargado', 'success');
        } else {
            showToast('Error al generar PDF de gastos', 'error');
        }
    } catch (error) {
        console.error('Error descargando PDF de gastos:', error);
        showToast('Error al descargar PDF', 'error');
    }
}

// ========== ESTADÍSTICAS GENERALES ==========
async function cargarEstadisticasGenerales() {
    try {
        const stats = await fetchAuth(`${API_URL}/reportes/estadisticas`).then(r => r.json());
        
        const container = document.getElementById('estadisticasGenerales');
        if (!container) return;
        
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <div>
                    <strong>Total Productos:</strong> ${stats.total_productos}
                </div>
                <div>
                    <strong>Valor Inventario:</strong> L.${stats.valor_inventario.toFixed(2)}
                </div>
                <div>
                    <strong>Movimientos Hoy:</strong> ${stats.movimientos_hoy}
                </div>
                <div>
                    <strong>Stock Bajo:</strong> <span class="badge badge-${stats.productos_stock_bajo > 0 ? 'warning' : 'success'}">${stats.productos_stock_bajo}</span>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

// ========== CARGAR SELECTS PARA REPORTES ==========
async function cargarSelectsReportes() {
    await cargarSelectoresBusqueda();
}

// ========== GESTIÓN DE IMÁGENES DE PRODUCTOS ==========
let productoImagenActual = null;

async function abrirModalImagenes(id) {
    // Verificar permiso
    if (!tienePermiso('editar_productos')) {
        showToast('No tienes permiso para gestionar imágenes', 'error');
        return;
    }
    try {
        const producto = await fetchAuth(`${API_URL}/productos/${id}`).then(r => r.json());
        productoImagenActual = producto;
        
        document.getElementById('imagenProductoId').value = id;
        document.getElementById('imagenProductoNombre').textContent = producto.nombre;
        
        // Cargar imágenes existentes
        await cargarImagenesProducto(id);
        
        document.getElementById('modalImagenes').classList.add('active');
    } catch (error) {
        console.error('Error abriendo modal de imágenes:', error);
        showToast('Error al cargar imágenes', 'error');
    }
}

function cerrarModalImagenes() {
    document.getElementById('modalImagenes').classList.remove('active');
    document.getElementById('subirImagenesForm').reset();
    productoImagenActual = null;
}

async function cargarImagenesProducto(productoId) {
    try {
        const imagenes = await fetchAuth(`${API_URL}/imagenes/producto/${productoId}`).then(r => r.json());
        const galeria = document.getElementById('galeriaImagenes');
        
        if (imagenes.length === 0) {
            galeria.innerHTML = '<p class="text-gray">No hay imágenes para este producto</p>';
            return;
        }
        
        galeria.innerHTML = imagenes.map(img => `
            <div style="position: relative; border: 2px solid ${img.es_principal ? '#667eea' : '#e5e7eb'}; border-radius: 10px; overflow: hidden;">
                <img src="${img.url}" alt="Imagen" style="width: 100%; height: 150px; object-fit: cover;">
                ${img.es_principal ? '<div style="position: absolute; top: 5px; left: 5px; background: #667eea; color: white; padding: 3px 8px; border-radius: 5px; font-size: 10px;">Principal</div>' : ''}
                <div style="padding: 8px; background: white; display: flex; gap: 5px; justify-content: center;">
                    ${!img.es_principal ? `<button class="btn btn-sm" style="background: #667eea; color: white;" onclick="setImagenPrincipal(${img.id})">★</button>` : ''}
                    <button class="btn btn-sm btn-danger" onclick="eliminarImagen(${img.id})">🗑️</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error cargando imágenes:', error);
    }
}

async function setImagenPrincipal(imagenId) {
    try {
        const response = await fetchAuth(`${API_URL}/imagenes/${imagenId}/principal`, {
            method: 'PUT'
        });
        
        if (response.ok) {
            showToast('Imagen principal actualizada', 'success');
            await cargarImagenesProducto(productoImagenActual.id);
        }
    } catch (error) {
        showToast('Error al actualizar imagen principal', 'error');
    }
}

async function eliminarImagen(imagenId) {
    if (!confirm('¿Estás seguro de eliminar esta imagen?')) return;
    
    try {
        const response = await fetchAuth(`${API_URL}/imagenes/${imagenId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('Imagen eliminada', 'success');
            await cargarImagenesProducto(productoImagenActual.id);
        }
    } catch (error) {
        showToast('Error al eliminar imagen', 'error');
    }
}

function setupSubirImagenesForm() {
    const form = document.getElementById('subirImagenesForm');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const productoId = document.getElementById('imagenProductoId').value;
        const input = document.getElementById('inputImagenes');
        const files = input.files;
        
        if (files.length === 0) {
            showToast('Selecciona al menos una imagen', 'warning');
            return;
        }
        
        if (files.length > 5) {
            showToast('Máximo 5 imágenes por vez', 'warning');
            return;
        }
        
        // Validar tamaño
        for (let file of files) {
            if (file.size > 5 * 1024 * 1024) {
                showToast(`${file.name} supera los 5MB`, 'error');
                return;
            }
        }
        
        const formData = new FormData();
        for (let file of files) {
            formData.append('imagenes', file);
        }
        
        try {
            const token = getAuthToken();
            const response = await fetch(`${API_URL}/imagenes/producto/${productoId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            if (response.ok) {
                showToast('Imágenes subidas exitosamente', 'success');
                this.reset();
                await cargarImagenesProducto(productoId);
            } else {
                const error = await response.json();
                showToast(error.mensaje || 'Error al subir imágenes', 'error');
            }
        } catch (error) {
            console.error('Error subiendo imágenes:', error);
            showToast('Error al subir imágenes', 'error');
        }
    });
}

// ========== GENERACIÓN DE CÓDIGOS QR ==========
let qrProductoActual = null;

async function abrirModalQR(id) {
    try {
        const producto = await fetchAuth(`${API_URL}/productos/${id}`).then(r => r.json());
        qrProductoActual = producto;
        
        document.getElementById('qrProductoNombre').textContent = producto.nombre;
        document.getElementById('qrProductoSKU').textContent = producto.sku || 'Sin SKU';
        
        // Generar QR
        generarCodigoQR(producto);
        
        document.getElementById('modalQR').classList.add('active');
    } catch (error) {
        console.error('Error abriendo modal QR:', error);
        showToast('Error al generar QR', 'error');
    }
}

function cerrarModalQR() {
    document.getElementById('modalQR').classList.remove('active');
    qrProductoActual = null;
}

// ========== GENERACIÓN DE CÓDIGOS QR (ARREGLADO) ==========
function generarCodigoQR(producto) {
    const canvas = document.getElementById('qrCanvas');
    
    // Datos del QR: formato simple SKU
    const qrData = `SKU:${producto.sku}\nProducto:${producto.nombre}\nPrecio:L.${producto.precio}`;
    
    try {
        // Usar QRious que es más confiable
        const qr = new QRious({
            element: canvas,
            value: qrData,
            size: 200,
            level: 'H'
        });
        
        console.log('QR generado exitosamente');
    } catch (error) {
        console.error('Error generando QR:', error);
        showToast('Error al generar código QR', 'error');
    }
}

function descargarQR() {
    if (!qrProductoActual) return;
    
    const canvas = document.getElementById('qrCanvas');
    
    // Verificar que el canvas tenga contenido
    const dataURL = canvas.toDataURL('image/png');
    
    if (dataURL === 'data:,') {
        showToast('Error: QR vacío. Intenta cerrar y abrir el modal de nuevo', 'error');
        return;
    }
    
    const link = document.createElement('a');
    link.download = `QR_${qrProductoActual.sku || qrProductoActual.id}.png`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('QR descargado exitosamente', 'success');
}

function imprimirEtiqueta() {
    if (!qrProductoActual) return;
    
    // Crear canvas para etiqueta completa
    const etiquetaCanvas = document.createElement('canvas');
    etiquetaCanvas.width = 400;
    etiquetaCanvas.height = 200;
    const ctx = etiquetaCanvas.getContext('2d');
    
    // Fondo blanco
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 400, 200);
    
    // Borde
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, 390, 190);
    
    // Dibujar QR (izquierda)
    const qrCanvas = document.getElementById('qrCanvas');
    ctx.drawImage(qrCanvas, 15, 15, 170, 170);
    
    // Información del producto (derecha)
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 18px Arial';
    
    // Nombre (con wrap si es muy largo)
    const nombre = qrProductoActual.nombre;
    if (nombre.length > 20) {
        ctx.fillText(nombre.substring(0, 20), 200, 35);
        ctx.fillText(nombre.substring(20, 40), 200, 55);
    } else {
        ctx.fillText(nombre, 200, 40);
    }
    
    ctx.font = '16px Arial';
    ctx.fillText(`SKU: ${qrProductoActual.sku || 'N/A'}`, 200, 80);
    ctx.fillText(`Precio: L.${parseFloat(qrProductoActual.precio).toFixed(2)}`, 200, 105);
    
    ctx.font = '12px Arial';
    ctx.fillStyle = '#666666';
    const fecha = new Date().toLocaleString('es-HN', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
    ctx.fillText(`Impreso: ${fecha}`, 200, 130);
    
    // Pie de página
    ctx.font = '10px Arial';
    ctx.fillStyle = '#999999';
    ctx.fillText('Sistema de Inventario', 200, 180);
    
    // Descargar etiqueta
    const link = document.createElement('a');
    link.download = `Etiqueta_${qrProductoActual.sku || qrProductoActual.id}.png`;
    link.href = etiquetaCanvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Etiqueta descargada. Lista para imprimir', 'success');
}

// ========== MENÚ DE USUARIO MEJORADO ==========
function actualizarMenuUsuario() {
    console.log('🔧 actualizarMenuUsuario ejecutándose, currentUser:', currentUser);
    if (!currentUser) {
        console.log('❌ No hay currentUser');
        return;
    }
    
    const userInfo = document.querySelector('.user-info');
    if (!userInfo) {
        console.log('❌ No se encontró .user-info');
        return;
    }
    
    console.log('✅ Actualizando menú de usuario para:', currentUser.nombre, 'rol:', currentUser.rol);
    userInfo.innerHTML = `
        <div class="user-avatar">${currentUser.nombre.charAt(0).toUpperCase()}</div>
        <div>
            <div style="font-weight: 600;">${currentUser.nombre}</div>
            <div style="font-size: 11px; color: var(--text-gray);">${currentUser.rol}</div>
            <div style="font-size: 10px; color: var(--text-gray);">${currentUser.email}</div>
        </div>
        <button onclick="toggleMenuUsuario()" style="background: none; border: none; cursor: pointer; font-size: 20px; color: var(--text-gray); margin-left: 10px;">⚙️</button>
    `;
}

function toggleMenuUsuario() {
    const menuId = 'menuUsuarioDropdown';
    let menu = document.getElementById(menuId);
    
    if (menu) {
        menu.remove();
        return;
    }
    
    menu = document.createElement('div');
    menu.id = menuId;
    menu.style.cssText = `
        position: absolute;
        top: 60px;
        right: 40px;
        background: var(--bg-white);
        border: 1px solid var(--border-color);
        border-radius: 10px;
        padding: 15px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        z-index: 1000;
        min-width: 280px;
    `;
    
    menu.innerHTML = `
        <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 10px;">
            <strong style="font-size: 16px; color: var(--text-dark);">${currentUser.nombre}</strong><br>
            <span style="font-size: 13px; color: var(--text-gray);">${currentUser.email}</span><br>
            <span class="badge badge-${currentUser.rol === 'admin' ? 'success' : 'info'}" style="margin-top: 5px;">${currentUser.rol}</span>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 8px;">
            <button onclick="abrirConfiguracion()" class="btn" style="width: 100%; justify-content: flex-start; background: var(--border-light);">
                ⚙️ Configuración
            </button>
            <button onclick="cambiarPassword()" class="btn" style="width: 100%; justify-content: flex-start; background: var(--border-light);">
                🔒 Cambiar Contraseña
            </button>
            ${currentUser.rol === 'admin' ? `
            <button onclick="abrirGestionPermisos()" class="btn" style="width: 100%; justify-content: flex-start; background: var(--border-light);">
                👥 Gestión de Permisos
            </button>
            ` : ''}
            <button onclick="logout()" class="btn btn-danger" style="width: 100%;">
                🚪 Cerrar Sesión
            </button>
        </div>
    `;
    
    document.body.appendChild(menu);
    
    // Cerrar al hacer click fuera
    setTimeout(() => {
        document.addEventListener('click', function cerrarMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', cerrarMenu);
            }
        });
    }, 100);
}

function abrirConfiguracion() {
    document.getElementById('menuUsuarioDropdown')?.remove();
    
    // Abrir modal de configuración
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2>⚙️ Configuración</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <div class="form-section">
                <h3 class="form-title">Preferencias de Notificaciones</h3>
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px;">
                    <input type="checkbox" id="configNotificacionesStock" ${localStorage.getItem('notificacionesStockDesactivadas') === 'true' ? '' : 'checked'}>
                    <span>Mostrar notificaciones de stock bajo</span>
                </label>
            </div>
            <div class="form-section">
                <h3 class="form-title">Información de Sesión</h3>
                <p style="color: var(--text-gray); font-size: 14px;">
                    <strong>Usuario:</strong> ${currentUser.nombre}<br>
                    <strong>Email:</strong> ${currentUser.email}<br>
                    <strong>Rol:</strong> ${currentUser.rol}<br>
                    <strong>Último acceso:</strong> ${new Date().toLocaleString('es-HN')}
                </p>
            </div>
            <div class="form-group-row">
                <button onclick="guardarConfiguracion()" class="btn btn-success">Guardar Cambios</button>
                <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-cancel">Cerrar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function guardarConfiguracion() {
    const notifStock = document.getElementById('configNotificacionesStock').checked;
    localStorage.setItem('notificacionesStockDesactivadas', !notifStock);
    notificacionesDesactivadas = !notifStock;
    
    showToast('Configuración guardada', 'success');
    document.querySelector('.modal-overlay.active')?.remove();
    
    if (!notifStock) {
        cerrarNotificacionesStock();
    }
}

async function cambiarPassword() {
    document.getElementById('menuUsuarioDropdown')?.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2>🔒 Cambiar Contraseña</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <form id="cambiarPasswordForm">
                <div class="form-group">
                    <label>Contraseña Actual</label>
                    <input type="password" name="passwordActual" required minlength="6">
                </div>
                <div class="form-group">
                    <label>Nueva Contraseña</label>
                    <input type="password" name="passwordNuevo" required minlength="6">
                </div>
                <div class="form-group">
                    <label>Confirmar Nueva Contraseña</label>
                    <input type="password" name="passwordConfirmar" required minlength="6">
                </div>
                <div class="form-group-row">
                    <button type="submit" class="btn btn-success">Cambiar Contraseña</button>
                    <button type="button" onclick="this.closest('.modal-overlay').remove()" class="btn btn-cancel">Cancelar</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('cambiarPasswordForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const data = Object.fromEntries(formData);
        
        if (data.passwordNuevo !== data.passwordConfirmar) {
            showToast('Las contraseñas no coinciden', 'error');
            return;
        }
        
        try {
            const response = await fetchAuth(`${API_URL}/auth/cambiar-password`, {
                method: 'POST',
                body: JSON.stringify({
                    passwordActual: data.passwordActual,
                    passwordNuevo: data.passwordNuevo
                })
            });
            
            if (response.ok) {
                showToast('Contraseña cambiada exitosamente', 'success');
                modal.remove();
            } else {
                const error = await response.json();
                showToast(error.mensaje || 'Error al cambiar contraseña', 'error');
            }
        } catch (error) {
            showToast('Error al cambiar contraseña', 'error');
        }
    });
}

function abrirGestionPermisos() {
    document.getElementById('menuUsuarioDropdown')?.remove();
    
    // Cambiar a la sección de usuarios
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    document.querySelector('[data-section="usuarios"]').classList.add('active');
    
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById('section-usuarios').classList.add('active');
    
    document.getElementById('pageTitle').textContent = 'Gestión de Usuarios';
    cargarUsuarios();
}

// ========== NOTIFICACIONES DE STOCK BAJO ==========
let notificacionesDesactivadas = false;

async function verificarStockBajo() {
    try {
        const stockBajo = await fetchAuth(`${API_URL}/reportes/stock-bajo`).then(r => r.json());
        
        // Verificar si hay productos con stock bajo y notificaciones activas
        if (stockBajo.length > 0 && !notificacionesDesactivadas) {
            mostrarNotificacionesStock(stockBajo);
        }
    } catch (error) {
        console.error('Error verificando stock bajo:', error);
    }
}

function mostrarNotificacionesStock(productos) {
    const container = document.getElementById('notificacionesStockBajo');
    const lista = document.getElementById('listaNotificacionesStock');
    
    // Verificar preferencia guardada
    const desactivado = localStorage.getItem('notificacionesStockDesactivadas');
    if (desactivado === 'true') {
        notificacionesDesactivadas = true;
        return;
    }
    
    lista.innerHTML = productos.slice(0, 5).map(p => `
        <div style="padding: 8px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <strong style="color: #333;">${p.nombre}</strong><br>
                <span style="color: #666;">Stock: ${p.stock} / Mínimo: ${p.stock_minimo}</span>
            </div>
            <span style="color: #f59e0b; font-size: 18px;">⚠️</span>
        </div>
    `).join('');
    
    if (productos.length > 5) {
        lista.innerHTML += `<p style="padding: 8px; color: #666; text-align: center;">+${productos.length - 5} más...</p>`;
    }
    
    container.style.display = 'block';
}

function cerrarNotificacionesStock() {
    document.getElementById('notificacionesStockBajo').style.display = 'none';
}

function toggleNotificaciones() {
    const checkbox = document.getElementById('desactivarNotificaciones');
    notificacionesDesactivadas = checkbox.checked;
    localStorage.setItem('notificacionesStockDesactivadas', checkbox.checked);
    
    if (checkbox.checked) {
        cerrarNotificacionesStock();
        showToast('Notificaciones de stock desactivadas', 'info');
    }
}

// Verificar stock bajo cada 5 minutos
setInterval(verificarStockBajo, 5 * 60 * 1000);

// ========== GESTIÓN DE USUARIOS ==========
async function cargarUsuarios() {
    try {
        const usuarios = await fetchAuth(`${API_URL}/usuarios`).then(r => r.json());
        const tbody = document.querySelector('#usuariosTable tbody');
        
        // Verificar permisos para botones de acción
        const puedeEditar = tienePermiso('editar_usuarios');
        const puedeEliminar = tienePermiso('eliminar_usuarios');
        
        tbody.innerHTML = usuarios.map(u => `
            <tr>
                <td>${u.nombre}</td>
                <td>${u.email}</td>
                <td><span class="badge badge-${u.rol_nombre === 'admin' ? 'success' : 'info'}">${u.rol_nombre}</span></td>
                <td><span class="badge badge-${u.activo ? 'success' : 'danger'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td>${u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString() : 'Nunca'}</td>
                <td>
                    <div class="action-buttons">
                        ${puedeEditar ? `<button class="btn btn-sm" style="background: #8b5cf6; color: white;" onclick="editarPermisosUsuario(${u.id})">🔐 Permisos</button>` : ''}
                        ${puedeEditar ? `<button class="btn btn-sm" style="background: #3b82f6; color: white;" onclick="editarRolUsuario(${u.id}, '${u.rol_nombre}')">👤 Rol</button>` : ''}
                        ${puedeEditar ? `<button class="btn btn-sm" style="background: #f59e0b; color: white;" onclick="cambiarPasswordUsuario(${u.id}, '${u.nombre}')">🔑 Clave</button>` : ''}
                        ${puedeEliminar ? (u.activo 
                            ? `<button class="btn btn-sm btn-danger" onclick="desactivarUsuario(${u.id})">🚫 Desactivar</button>`
                            : `<button class="btn btn-sm btn-success" onclick="activarUsuario(${u.id})">✅ Activar</button>`
                        ) : ''}
                        ${!puedeEditar && !puedeEliminar ? '-' : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        showToast('Error al cargar usuarios', 'error');
    }
}

function mostrarFormUsuario() {
    document.getElementById('formUsuario').classList.remove('hidden');
}

function ocultarFormUsuario() {
    document.getElementById('formUsuario').classList.add('hidden');
    document.getElementById('usuarioForm').reset();
}

async function desactivarUsuario(id) {
    if (confirm('¿Estás seguro de desactivar este usuario? No podrá iniciar sesión hasta que lo reactives.')) {
        try {
            const response = await fetchAuth(`${API_URL}/usuarios/${id}`, {method: 'DELETE'});
            if (response.ok) {
                showToast('Usuario desactivado exitosamente', 'success');
                cargarUsuarios();
            } else {
                const data = await response.json();
                showToast(data.mensaje || 'Error al desactivar usuario', 'error');
            }
        } catch (error) {
            showToast('Error al desactivar usuario', 'error');
        }
    }
}

async function activarUsuario(id) {
    if (confirm('¿Activar este usuario? Podrá volver a iniciar sesión.')) {
        try {
            const response = await fetchAuth(`${API_URL}/usuarios/${id}/activar`, {method: 'PUT'});
            if (response.ok) {
                showToast('Usuario activado exitosamente', 'success');
                cargarUsuarios();
            } else {
                const data = await response.json();
                showToast(data.mensaje || 'Error al activar usuario', 'error');
            }
        } catch (error) {
            showToast('Error al activar usuario', 'error');
        }
    }
}

// ========== ADMIN: CAMBIAR CONTRASEÑA DE USUARIO ==========
async function cambiarPasswordUsuario(usuarioId, nombreUsuario) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal" style="max-width: 400px;">
            <div class="modal-header">
                <h2>🔑 Cambiar Contraseña</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            
            <p class="text-gray" style="margin-bottom: 15px;">
                Cambiar contraseña de: <strong>${nombreUsuario}</strong>
            </p>
            
            <form id="cambiarPasswordForm">
                <div class="form-group">
                    <label>Nueva Contraseña</label>
                    <input type="password" id="nuevaPasswordAdmin" minlength="6" required placeholder="Mínimo 6 caracteres">
                </div>
                <div class="form-group">
                    <label>Confirmar Contraseña</label>
                    <input type="password" id="confirmarPasswordAdmin" minlength="6" required placeholder="Repetir contraseña">
                </div>
                <div class="form-group-row" style="margin-top: 20px;">
                    <button type="submit" class="btn btn-success">Cambiar Contraseña</button>
                    <button type="button" class="btn btn-cancel" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('cambiarPasswordForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const nuevaPassword = document.getElementById('nuevaPasswordAdmin').value;
        const confirmarPassword = document.getElementById('confirmarPasswordAdmin').value;
        
        if (nuevaPassword !== confirmarPassword) {
            showToast('Las contraseñas no coinciden', 'error');
            return;
        }
        
        if (nuevaPassword.length < 6) {
            showToast('La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }
        
        try {
            const response = await fetchAuth(`${API_URL}/usuarios/${usuarioId}/cambiar-password`, {
                method: 'PUT',
                body: JSON.stringify({ nuevaPassword })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showToast(data.mensaje || 'Contraseña cambiada exitosamente', 'success');
                modal.remove();
            } else {
                showToast(data.mensaje || 'Error al cambiar contraseña', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Error al cambiar contraseña', 'error');
        }
    });
}

// ========== GESTIÓN COMPLETA DE PERMISOS POR USUARIO ==========

async function editarPermisosUsuario(usuarioId) {
    try {
        const usuario = await fetchAuth(`${API_URL}/usuarios/${usuarioId}`).then(r => r.json());
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal" style="max-width: 700px;">
                <div class="modal-header">
                    <h2>🔐 Permisos de ${usuario.nombre}</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                
                <p class="text-gray" style="margin-bottom: 15px;">
                    Rol: <span class="badge badge-${usuario.rol_nombre === 'admin' ? 'success' : 'info'}">${usuario.rol_nombre}</span>
                </p>
                
                <form id="permisosForm">
                    <input type="hidden" id="permisoUsuarioId" value="${usuarioId}">
                    
                    <!-- Productos -->
                    <div class="form-section">
                        <h3 class="form-title">📦 Productos</h3>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                            <label class="checkbox-label">
                                <input type="checkbox" name="ver_productos" ${usuario.ver_productos ? 'checked' : ''}>
                                <span>Ver productos</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="crear_productos" ${usuario.crear_productos ? 'checked' : ''}>
                                <span>Crear productos</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="editar_productos" ${usuario.editar_productos ? 'checked' : ''}>
                                <span>Editar productos</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="eliminar_productos" ${usuario.eliminar_productos ? 'checked' : ''}>
                                <span>Eliminar productos</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="importar_productos" ${usuario.importar_productos ? 'checked' : ''}>
                                <span>Importar productos</span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- Categorías -->
                    <div class="form-section">
                        <h3 class="form-title">🏷️ Categorías</h3>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                            <label class="checkbox-label">
                                <input type="checkbox" name="ver_categorias" ${usuario.ver_categorias ? 'checked' : ''}>
                                <span>Ver categorías</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="crear_categorias" ${usuario.crear_categorias ? 'checked' : ''}>
                                <span>Crear categorías</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="editar_categorias" ${usuario.editar_categorias ? 'checked' : ''}>
                                <span>Editar categorías</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="eliminar_categorias" ${usuario.eliminar_categorias ? 'checked' : ''}>
                                <span>Eliminar categorías</span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- Movimientos -->
                    <div class="form-section">
                        <h3 class="form-title">📋 Movimientos</h3>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                            <label class="checkbox-label">
                                <input type="checkbox" name="ver_movimientos" ${usuario.ver_movimientos ? 'checked' : ''}>
                                <span>Ver movimientos</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="crear_entrada" ${usuario.crear_entrada ? 'checked' : ''}>
                                <span>Crear entradas</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="crear_salida" ${usuario.crear_salida ? 'checked' : ''}>
                                <span>Crear salidas</span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- Reportes -->
                    <div class="form-section">
                        <h3 class="form-title">📊 Reportes</h3>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                            <label class="checkbox-label">
                                <input type="checkbox" name="ver_reportes" ${usuario.ver_reportes ? 'checked' : ''}>
                                <span>Ver reportes</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="generar_reportes" ${usuario.generar_reportes ? 'checked' : ''}>
                                <span>Generar reportes</span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- Proveedores -->
                    <div class="form-section">
                        <h3 class="form-title">🏭 Proveedores</h3>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                            <label class="checkbox-label">
                                <input type="checkbox" name="ver_proveedores" ${usuario.ver_proveedores ? 'checked' : ''}>
                                <span>Ver proveedores</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="crear_proveedores" ${usuario.crear_proveedores ? 'checked' : ''}>
                                <span>Crear proveedores</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="editar_proveedores" ${usuario.editar_proveedores ? 'checked' : ''}>
                                <span>Editar proveedores</span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- Asignaciones -->
                    <div class="form-section">
                        <h3 class="form-title">👥 Asignaciones</h3>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                            <label class="checkbox-label">
                                <input type="checkbox" name="ver_asignaciones" ${usuario.ver_asignaciones ? 'checked' : ''}>
                                <span>Ver asignaciones</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="crear_asignaciones" ${usuario.crear_asignaciones ? 'checked' : ''}>
                                <span>Crear asignaciones</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="editar_asignaciones" ${usuario.editar_asignaciones ? 'checked' : ''}>
                                <span>Editar asignaciones</span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- Usuarios (solo admin) -->
                    <div class="form-section">
                        <h3 class="form-title">👤 Usuarios</h3>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                            <label class="checkbox-label">
                                <input type="checkbox" name="ver_usuarios" ${usuario.ver_usuarios ? 'checked' : ''}>
                                <span>Ver usuarios</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="crear_usuarios" ${usuario.crear_usuarios ? 'checked' : ''}>
                                <span>Crear usuarios</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="editar_usuarios" ${usuario.editar_usuarios ? 'checked' : ''}>
                                <span>Editar usuarios</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="eliminar_usuarios" ${usuario.eliminar_usuarios ? 'checked' : ''}>
                                <span>Eliminar usuarios</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="form-group-row" style="margin-top: 20px;">
                        <button type="submit" class="btn btn-success">Guardar Permisos</button>
                        <button type="button" onclick="aplicarPerfilesRapidos('${usuario.rol_nombre}')" class="btn btn-primary">Aplicar Perfil de Rol</button>
                        <button type="button" onclick="this.closest('.modal-overlay').remove()" class="btn btn-cancel">Cancelar</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('permisosForm').addEventListener('submit', guardarPermisosUsuario);
    } catch (error) {
        console.error('Error cargando permisos:', error);
        showToast('Error al cargar permisos del usuario', 'error');
    }
}

async function guardarPermisosUsuario(e) {
    e.preventDefault();
    
    const usuarioId = document.getElementById('permisoUsuarioId').value;
    const permisos = {};
    
    // Obtener todos los checkboxes
    const checkboxes = e.target.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        permisos[cb.name] = cb.checked;
    });
    
    try {
        const response = await fetchAuth(`${API_URL}/usuarios/${usuarioId}/permisos`, {
            method: 'PUT',
            body: JSON.stringify(permisos)
        });
        
        if (response.ok) {
            showToast('Permisos actualizados exitosamente', 'success');
            document.querySelector('.modal-overlay.active').remove();
            cargarUsuarios();
        } else {
            const error = await response.json();
            showToast(error.mensaje || 'Error al actualizar permisos', 'error');
        }
    } catch (error) {
        showToast('Error al guardar permisos', 'error');
    }
}

function aplicarPerfilesRapidos(rol) {
    const form = document.getElementById('permisosForm');
    const checkboxes = form.querySelectorAll('input[type="checkbox"]');
    
    // Perfiles según rol
    const perfiles = {
        admin: () => checkboxes.forEach(cb => cb.checked = true),
        usuario: () => {
            checkboxes.forEach(cb => {
                const name = cb.name;
                cb.checked = !name.includes('eliminar') && !name.includes('usuarios');
            });
        },
        visitante: () => {
            checkboxes.forEach(cb => {
                const name = cb.name;
                cb.checked = name.includes('ver') || name.includes('generar_reportes');
            });
        }
    };
    
    perfiles[rol]?.();
    showToast(`Perfil de ${rol} aplicado`, 'info');
}

async function editarRolUsuario(usuarioId, rolActual) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2>👤 Cambiar Rol de Usuario</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <form id="cambiarRolForm">
                <div class="form-group">
                    <label>Rol Actual: <span class="badge badge-info">${rolActual}</span></label>
                </div>
                <div class="form-group">
                    <label>Nuevo Rol</label>
                    <select name="rol_id" required>
                        <option value="1" ${rolActual === 'admin' ? 'selected' : ''}>Administrador</option>
                        <option value="2" ${rolActual === 'usuario' ? 'selected' : ''}>Usuario</option>
                        <option value="3" ${rolActual === 'visitante' ? 'selected' : ''}>Visitante</option>
                    </select>
                </div>
                <div class="form-group">
                    <p class="text-gray" style="font-size: 13px;">
                        <strong>Nota:</strong> Al cambiar el rol, se aplicarán los permisos predeterminados del nuevo rol.
                        Puedes personalizarlos después en "Permisos".
                    </p>
                </div>
                <div class="form-group-row">
                    <button type="submit" class="btn btn-success">Cambiar Rol</button>
                    <button type="button" onclick="this.closest('.modal-overlay').remove()" class="btn btn-cancel">Cancelar</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('cambiarRolForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const nuevoRolId = formData.get('rol_id');
        
        try {
            const response = await fetchAuth(`${API_URL}/usuarios/${usuarioId}`, {
                method: 'PUT',
                body: JSON.stringify({ rol_id: nuevoRolId })
            });
            
            if (response.ok) {
                showToast('Rol actualizado exitosamente', 'success');
                modal.remove();
                cargarUsuarios();
            }
        } catch (error) {
            showToast('Error al cambiar rol', 'error');
        }
    });
}

// ========== ELIMINAR CATEGORÍAS ==========
async function eliminarCategoria(id) {
    // Verificar permiso antes de ejecutar
    if (!tienePermiso('eliminar_categorias')) {
        showToast('No tienes permiso para eliminar categorías', 'error');
        return;
    }
    if (!confirm('¿Estás seguro de eliminar esta categoría? Los productos asociados quedarán sin categoría.')) return;
    
    try {
        const response = await fetchAuth(`${API_URL}/categorias/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('Categoría eliminada exitosamente', 'success');
            cargarCategorias();
        } else {
            const error = await response.json();
            showToast(error.mensaje || 'Error al eliminar categoría', 'error');
        }
    } catch (error) {
        showToast('Error al eliminar categoría', 'error');
    }
}

function setupUsuarioForm() {
    const form = document.getElementById('usuarioForm');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        let data = Object.fromEntries(formData);
        
        // Convertir vacíos a null
        Object.keys(data).forEach(key => {
            if (data[key] === '') data[key] = null;
        });

        try {
            const response = await fetchAuth(`${API_URL}/usuarios`, {
                method: 'POST',
                body: JSON.stringify(data)
            });

            if (response.ok) {
                showToast('Usuario creado exitosamente', 'success');
                ocultarFormUsuario();
                cargarUsuarios();
            } else {
                const error = await response.json();
                showToast(error.mensaje || 'Error al crear usuario', 'error');
            }
        } catch (error) {
            showToast('Error al crear usuario', 'error');
        }
    });
}

// ========== GESTIÓN DE PROVEEDORES ==========
async function cargarProveedores() {
    try {
        const proveedores = await fetchAuth(`${API_URL}/proveedores`).then(r => r.json());
        const tbody = document.querySelector('#proveedoresTable tbody');
        
        // Verificar permisos para botones de acción
        const puedeEditar = tienePermiso('editar_proveedores');
        const puedeEliminar = tienePermiso('editar_proveedores'); // Usar mismo permiso para eliminar
        
        tbody.innerHTML = proveedores.map(p => `
            <tr>
                <td>${p.nombre}</td>
                <td>${p.contacto || '-'}</td>
                <td>${p.telefono || '-'}</td>
                <td>${p.email || '-'}</td>
                <td>
                    <div class="action-buttons">
                        ${puedeEditar ? `<button class="btn btn-sm" style="background: #3b82f6; color: white;" onclick="editarProveedor(${p.id})">Editar</button>` : ''}
                        ${puedeEliminar ? `<button class="btn btn-sm btn-danger" onclick="eliminarProveedor(${p.id})">Eliminar</button>` : ''}
                        ${!puedeEditar && !puedeEliminar ? '-' : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error al cargar proveedores:', error);
        showToast('Error al cargar proveedores', 'error');
    }
}

function mostrarFormProveedor() {
    // Verificar permiso
    if (!tienePermiso('crear_proveedores')) {
        showToast('No tienes permiso para crear proveedores', 'error');
        return;
    }
    document.getElementById('formProveedor').classList.remove('hidden');
}

function ocultarFormProveedor() {
    document.getElementById('formProveedor').classList.add('hidden');
    document.getElementById('proveedorForm').reset();
}

async function eliminarProveedor(id) {
    // Verificar permiso
    if (!tienePermiso('editar_proveedores')) {
        showToast('No tienes permiso para eliminar proveedores', 'error');
        return;
    }
    if (confirm('¿Estás seguro de eliminar este proveedor?')) {
        try {
            const response = await fetchAuth(`${API_URL}/proveedores/${id}`, {method: 'DELETE'});
            if (response.ok) {
                showToast('Proveedor eliminado exitosamente', 'success');
                cargarProveedores();
            }
        } catch (error) {
            showToast('Error al eliminar proveedor', 'error');
        }
    }
}

function editarProveedor(id) {
    showToast('Función de edición en desarrollo', 'info');
}

function setupProveedorForm() {
    const form = document.getElementById('proveedorForm');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        let data = Object.fromEntries(formData);
        
        Object.keys(data).forEach(key => {
            if (data[key] === '') data[key] = null;
        });

        try {
            const response = await fetchAuth(`${API_URL}/proveedores`, {
                method: 'POST',
                body: JSON.stringify(data)
            });

            if (response.ok) {
                showToast('Proveedor creado exitosamente', 'success');
                ocultarFormProveedor();
                cargarProveedores();
            } else {
                const error = await response.json();
                showToast(error.mensaje || 'Error al crear proveedor', 'error');
            }
        } catch (error) {
            showToast('Error al crear proveedor', 'error');
        }
    });
}

// ========== GESTIÓN DE ASIGNACIONES ==========
async function cargarAsignaciones() {
    try {
        const filtro = document.getElementById('filtroAsignaciones')?.value || 'todas';
        const asignaciones = await fetchAuth(`${API_URL}/asignaciones`).then(r => r.json());
        
        const filtradas = filtro === 'todas' ? asignaciones : asignaciones.filter(a => a.estado === filtro);
        
        // Verificar permisos
        const puedeEditar = tienePermiso('editar_asignaciones');
        
        const tbody = document.querySelector('#asignacionesTable tbody');
        tbody.innerHTML = filtradas.map(a => `
            <tr>
                <td>${new Date(a.created_at).toLocaleString()}</td>
                <td>${a.producto_nombre} (${a.producto_sku})</td>
                <td>${a.personal_nombre || a.destino_nombre || '-'}</td>
                <td>${a.cantidad}</td>
                <td><span class="badge badge-${a.estado === 'asignado' ? 'success' : 'warning'}">${a.estado}</span></td>
                <td>${a.usuario_asigna_nombre || '-'}</td>
                <td>
                    ${a.estado === 'asignado' && puedeEditar ? `
                        <button class="btn btn-sm btn-warning" onclick="devolverAsignacion(${a.id})">Devolver</button>
                    ` : '-'}
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error al cargar asignaciones:', error);
        showToast('Error al cargar asignaciones', 'error');
    }
}

async function devolverAsignacion(id) {
    // Verificar permiso
    if (!tienePermiso('editar_asignaciones')) {
        showToast('No tienes permiso para devolver asignaciones', 'error');
        return;
    }
    const observaciones = prompt('Observaciones de la devolución (opcional):');
    
    try {
        const response = await fetchAuth(`${API_URL}/asignaciones/${id}/devolver`, {
            method: 'PUT',
            body: JSON.stringify({ observaciones })
        });

        if (response.ok) {
            showToast('Asignación devuelta exitosamente', 'success');
            cargarAsignaciones();
            cargarDashboard();
        } else {
            const error = await response.json();
            showToast(error.mensaje || 'Error al devolver asignación', 'error');
        }
    } catch (error) {
        showToast('Error al devolver asignación', 'error');
    }
}

function cambiarDestinoTipo() {
    const tipo = document.getElementById('destinoTipo').value;
    document.getElementById('grupoPersonal').style.display = tipo === 'personal' ? 'block' : 'none';
    document.getElementById('grupoDestino').style.display = tipo === 'tienda' ? 'block' : 'none';
}

async function cargarPersonal() {
    try {
        const personal = await fetchAuth(`${API_URL}/asignaciones/personal`).then(r => r.json());
        
        // Para select
        const select = document.getElementById('personalSelect');
        if (select) {
            select.innerHTML = '<option value="">Seleccionar...</option>' + 
                personal.map(p => `<option value="${p.id}">${p.nombre} - ${p.puesto || 'Sin puesto'}</option>`).join('');
        }
        
        // Para tabla
        const tbody = document.querySelector('#personalTable tbody');
        if (tbody) {
            tbody.innerHTML = personal.map(p => `
                <tr>
                    <td>${p.nombre}</td>
                    <td>${p.puesto || '-'}</td>
                    <td>${p.departamento_nombre || '-'}</td>
                    <td>${p.zona_nombre || '-'}</td>
                    <td>${p.total_asignaciones || 0}</td>
                    <td>
                        <button class="btn btn-sm" style="background: #3b82f6; color: white;" onclick="verAsignacionesPersonal(${p.id})">Ver Equipos</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error al cargar personal:', error);
    }
}

async function cargarDestinos() {
    try {
        const destinos = await fetchAuth(`${API_URL}/asignaciones/destinos`).then(r => r.json());
        const select = document.getElementById('destinoSelect');
        if (select) {
            select.innerHTML = '<option value="">Seleccionar...</option>' + 
                destinos.map(d => `<option value="${d.id}">${d.nombre} (${d.tipo})</option>`).join('');
        }
    } catch (error) {
        console.error('Error al cargar destinos:', error);
    }
}

async function cargarDepartamentosYZonas() {
    try {
        const [departamentos, zonas] = await Promise.all([
            fetchAuth(`${API_URL}/asignaciones/catalogos/departamentos`).then(r => r.json()),
            fetchAuth(`${API_URL}/asignaciones/catalogos/zonas`).then(r => r.json())
        ]);
        
        const deptSelect = document.getElementById('departamentoSelect');
        const zonaSelect = document.getElementById('zonaSelect');
        
        if (deptSelect) {
            deptSelect.innerHTML = '<option value="">Seleccionar...</option>' + 
                departamentos.map(d => `<option value="${d.id}">${d.nombre}</option>`).join('');
        }
        
        if (zonaSelect) {
            zonaSelect.innerHTML = '<option value="">Seleccionar...</option>' + 
                zonas.map(z => `<option value="${z.id}">${z.nombre}</option>`).join('');
        }
    } catch (error) {
        console.error('Error al cargar catálogos:', error);
    }
}

function mostrarFormPersonal() {
    // Verificar permiso
    if (!tienePermiso('crear_asignaciones')) {
        showToast('No tienes permiso para agregar personal', 'error');
        return;
    }
    document.getElementById('formPersonal').classList.remove('hidden');
}

function ocultarFormPersonal() {
    document.getElementById('formPersonal').classList.add('hidden');
    document.getElementById('personalForm').reset();
}

function verAsignacionesPersonal(id) {
    showToast('Función de reporte por personal en desarrollo', 'info');
}

function setupAsignacionForm() {
    const form = document.getElementById('asignacionForm');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        let data = Object.fromEntries(formData);
        
        Object.keys(data).forEach(key => {
            if (data[key] === '') data[key] = null;
        });

        try {
            const response = await fetchAuth(`${API_URL}/asignaciones`, {
                method: 'POST',
                body: JSON.stringify(data)
            });

            if (response.ok) {
                showToast('Asignación creada exitosamente', 'success');
                this.reset();
                cambiarDestinoTipo();
                cargarAsignaciones();
                cargarDashboard();
            } else {
                const error = await response.json();
                showToast(error.error || error.mensaje || 'Error al crear asignación', 'error');
            }
        } catch (error) {
            showToast('Error al crear asignación', 'error');
        }
    });
}

function setupPersonalForm() {
    const form = document.getElementById('personalForm');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        let data = Object.fromEntries(formData);
        
        Object.keys(data).forEach(key => {
            if (data[key] === '') data[key] = null;
        });

        try {
            const response = await fetchAuth(`${API_URL}/asignaciones/personal`, {
                method: 'POST',
                body: JSON.stringify(data)
            });

            if (response.ok) {
                showToast('Personal creado exitosamente', 'success');
                ocultarFormPersonal();
                cargarPersonal();
            } else {
                const error = await response.json();
                showToast(error.mensaje || 'Error al crear personal', 'error');
            }
        } catch (error) {
            showToast('Error al crear personal', 'error');
        }
    });
}

// Cargar productos para asignaciones
async function cargarProductosParaAsignaciones() {
    try {
        const productos = await fetchAuth(`${API_URL}/productos`).then(r => r.json());
        const select = document.getElementById('productoSelectAsig');
        if (select) {
            select.innerHTML = '<option value="">Seleccionar...</option>' + 
                productos.map(p => `<option value="${p.id}">${p.nombre} (Stock: ${p.stock})</option>`).join('');
        }
    } catch (error) {
        console.error('Error al cargar productos:', error);
    }
}

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar dark mode
    initDarkMode();
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }
    
    // Setup de formularios
    setupLoginForm();
    setupMenuNavigation();
    setupProductoForm();
    setupCategoriaForm();
    setupMovimientoForm();
    setupEditProductoForm();
    setupUsuarioForm();
    setupProveedorForm();
    setupAsignacionForm();
    setupPersonalForm();
    setupBusquedaAvanzadaForm();
    setupReporteMovimientosForm();
    setupSubirImagenesForm();
    
    // Setup búsqueda de productos
    const searchProductos = document.getElementById('searchProductos');
    if (searchProductos) {
        searchProductos.addEventListener('input', function(e) {
            const search = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#productosTable tbody tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(search) ? '' : 'none';
            });
        });
    }
    
    // Verificar autenticación
    const autenticado = await verificarAutenticacion();
    
    if (autenticado) {
        // Aplicar permisos a la interfaz
        aplicarPermisosInterfaz();
        
        // Cargar datos iniciales
        cargarSelectoresBusqueda();
        cargarEstadisticasGenerales();
        
        // Verificar stock bajo al iniciar y cada 5 minutos
        verificarStockBajo();
        
        mostrarDashboard();
        actualizarMenuUsuario();
        cargarDashboard();
    } else {
        mostrarLogin();
    }
});

// ========== EXPORTAR/IMPORTAR CSV ==========

// Descargar plantilla CSV
function descargarPlantillaCSV() {
    const headers = ['nombre', 'descripcion', 'sku', 'precio', 'stock', 'stock_minimo', 'categoria_nombre', 'proveedor_nombre'];
    const ejemplo = ['Laptop HP 15', 'Laptop para oficina', 'LAP-001', '599.99', '10', '3', 'Electrónica', 'HP Inc'];
    
    let csvContent = headers.join(',') + '\n';
    csvContent += ejemplo.join(',') + '\n';
    csvContent += '# Instrucciones:\n';
    csvContent += '# - nombre: Nombre del producto (requerido)\n';
    csvContent += '# - descripcion: Descripción detallada (opcional)\n';
    csvContent += '# - sku: Código único del producto (requerido, único)\n';
    csvContent += '# - precio: Precio unitario (requerido, números con punto decimal)\n';
    csvContent += '# - stock: Cantidad inicial en inventario (requerido, número entero)\n';
    csvContent += '# - stock_minimo: Nivel mínimo de alerta (opcional, por defecto 0)\n';
    csvContent += '# - categoria_nombre: Nombre de la categoría existente (debe existir previamente)\n';
    csvContent += '# - proveedor_nombre: Nombre del proveedor existente (debe existir previamente)\n';
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'plantilla_productos.csv';
    link.click();
    
    showToast('Plantilla CSV descargada', 'success');
}

// Exportar productos a CSV
async function exportarProductosCSV() {
    try {
        const productos = await fetchAuth(`${API_URL}/productos`).then(r => r.json());
        
        if (productos.length === 0) {
            showToast('No hay productos para exportar', 'warning');
            return;
        }
        
        const headers = ['ID', 'Nombre', 'Descripción', 'SKU', 'Precio', 'Stock', 'Stock Mínimo', 'Categoría', 'Proveedor', 'Activo', 'Fecha Creación'];
        
        let csvContent = headers.join(',') + '\n';
        
        productos.forEach(p => {
            const row = [
                p.id,
                `"${(p.nombre || '').replace(/"/g, '""')}"`,
                `"${(p.descripcion || '').replace(/"/g, '""')}"`,
                p.sku || '',
                p.precio || 0,
                p.stock || 0,
                p.stock_minimo || 0,
                `"${(p.categoria_nombre || 'Sin categoría').replace(/"/g, '""')}"`,
                `"${(p.proveedor_nombre || 'Sin proveedor').replace(/"/g, '""')}"`,
                p.activo ? 'Sí' : 'No',
                new Date(p.created_at).toLocaleDateString('es-HN')
            ];
            csvContent += row.join(',') + '\n';
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `productos_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        showToast(`${productos.length} productos exportados exitosamente`, 'success');
    } catch (error) {
        console.error('Error exportando CSV:', error);
        showToast('Error al exportar productos', 'error');
    }
}

// Abrir modal de importación
function abrirImportarCSV() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2>📥 Importar Productos desde CSV</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            
            <div class="form-section">
                <h3 class="form-title">Paso 1: Descargar Plantilla</h3>
                <p class="text-gray" style="margin-bottom: 10px;">Descarga la plantilla CSV con el formato correcto</p>
                <button onclick="descargarPlantillaCSV()" class="btn btn-primary">📥 Descargar Plantilla</button>
            </div>
            
            <div class="form-section">
                <h3 class="form-title">Paso 2: Seleccionar Archivo</h3>
                <form id="importarCSVForm">
                    <div class="form-group">
                        <label>Archivo CSV</label>
                        <input type="file" id="archivoCSV" accept=".csv" required>
                    </div>
                    
                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="checkbox" id="sobreescribirDuplicados">
                            <span>Actualizar productos existentes (por SKU)</span>
                        </label>
                    </div>
                    
                    <button type="submit" class="btn btn-success">📤 Importar Productos</button>
                </form>
            </div>
            
            <div id="resultadoImportacion" class="hidden form-section">
                <h3 class="form-title">Resultado de Importación</h3>
                <div id="importacionStats"></div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('importarCSVForm').addEventListener('submit', procesarImportacionCSV);
}

async function procesarImportacionCSV(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('archivoCSV');
    const file = fileInput.files[0];
    
    if (!file) {
        showToast('Selecciona un archivo CSV', 'warning');
        return;
    }
    
    const sobreescribir = document.getElementById('sobreescribirDuplicados').checked;
    
    const reader = new FileReader();
    reader.onload = async function(event) {
        try {
            const csv = event.target.result;
            const lineas = csv.split('\n').filter(l => l.trim() && !l.startsWith('#'));
            
            if (lineas.length < 2) {
                showToast('El archivo CSV está vacío', 'error');
                return;
            }
            
            const headers = lineas[0].split(',').map(h => h.trim().toLowerCase());
            const productos = [];
            
            // Obtener categorías y proveedores existentes
            const [categorias, proveedores] = await Promise.all([
                fetchAuth(`${API_URL}/categorias`).then(r => r.json()),
                fetchAuth(`${API_URL}/proveedores`).then(r => r.json())
            ]);
            
            const categoriasMap = {};
            categorias.forEach(c => {
                categoriasMap[c.nombre.toLowerCase()] = c.id;
            });
            
            const proveedoresMap = {};
            proveedores.forEach(p => {
                proveedoresMap[p.nombre.toLowerCase()] = p.id;
            });
            
            // Procesar cada línea
            for (let i = 1; i < lineas.length; i++) {
                const valores = lineas[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                
                const producto = {};
                headers.forEach((header, index) => {
                    producto[header] = valores[index] || null;
                });
                
                // Validaciones básicas
                if (!producto.nombre || !producto.sku || !producto.precio) {
                    console.warn(`Línea ${i + 1} omitida: faltan campos requeridos`);
                    continue;
                }
                
                // Mapear categoría y proveedor
                if (producto.categoria_nombre) {
                    producto.categoria_id = categoriasMap[producto.categoria_nombre.toLowerCase()] || null;
                }
                
                if (producto.proveedor_nombre) {
                    producto.proveedor_id = proveedoresMap[producto.proveedor_nombre.toLowerCase()] || null;
                }
                
                productos.push(producto);
            }
            
            if (productos.length === 0) {
                showToast('No se encontraron productos válidos en el CSV', 'error');
                return;
            }
            
            // Importar productos
            const response = await fetchAuth(`${API_URL}/productos/importar-csv`, {
                method: 'POST',
                body: JSON.stringify({
                    productos: productos,
                    sobreescribir: sobreescribir
                })
            });
            
            if (response.ok) {
                const resultado = await response.json();
                mostrarResultadoImportacion(resultado);
                cargarProductos();
            } else {
                const error = await response.json();
                showToast(error.mensaje || 'Error al importar productos', 'error');
            }
        } catch (error) {
            console.error('Error procesando CSV:', error);
            showToast('Error al procesar el archivo CSV', 'error');
        }
    };
    
    reader.readAsText(file);
}

function mostrarResultadoImportacion(resultado) {
    const container = document.getElementById('resultadoImportacion');
    const stats = document.getElementById('importacionStats');
    
    stats.innerHTML = `
        <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr);">
            <div class="stat-card">
                <h3>Importados</h3>
                <div class="stat-value" style="color: #10b981;">${resultado.importados || 0}</div>
            </div>
            <div class="stat-card">
                <h3>Actualizados</h3>
                <div class="stat-value" style="color: #3b82f6;">${resultado.actualizados || 0}</div>
            </div>
            <div class="stat-card">
                <h3>Categorías Creadas</h3>
                <div class="stat-value" style="color: #8b5cf6;">${resultado.categorias_creadas || 0}</div>
            </div>
            <div class="stat-card">
                <h3>Errores</h3>
                <div class="stat-value" style="color: #ef4444;">${resultado.errores || 0}</div>
            </div>
        </div>
        ${resultado.detalles_errores && resultado.detalles_errores.length > 0 ? `
            <div style="margin-top: 15px;">
                <h4 style="color: #ef4444; margin-bottom: 10px;">Detalles de Errores:</h4>
                <ul style="color: var(--text-gray); font-size: 13px;">
                    ${resultado.detalles_errores.map(e => `<li>${e}</li>`).join('')}
                </ul>
            </div>
        ` : ''}
    `;
    
    container.classList.remove('hidden');
    showToast(`Importación completada: ${resultado.importados} productos${resultado.categorias_creadas > 0 ? `, ${resultado.categorias_creadas} categorías creadas` : ''}`, 'success');
}

// Descargar inventario completo en Excel
async function descargarInventarioCompleto() {
    try {
        const productos = await fetchAuth(`${API_URL}/productos`).then(r => r.json());
        
        if (productos.length === 0) {
            showToast('No hay productos para descargar', 'warning');
            return;
        }
        
        // Crear CSV más completo
        const headers = ['ID', 'Nombre', 'Descripción', 'SKU', 'Precio', 'Stock Actual', 'Stock Mínimo', 'Categoría', 'Proveedor', 'Valor Total', 'Estado', 'Fecha Creación'];
        
        let csvContent = '\uFEFF'; // BOM para Excel UTF-8
        csvContent += headers.join(',') + '\n';
        
        let valorTotal = 0;
        
        productos.forEach(p => {
            const valor = (parseFloat(p.precio) || 0) * (parseInt(p.stock) || 0);
            valorTotal += valor;
            
            const row = [
                p.id,
                `"${(p.nombre || '').replace(/"/g, '""')}"`,
                `"${(p.descripcion || '').replace(/"/g, '""')}"`,
                p.sku || '',
                parseFloat(p.precio).toFixed(2),
                p.stock || 0,
                p.stock_minimo || 0,
                `"${(p.categoria_nombre || 'Sin categoría').replace(/"/g, '""')}"`,
                `"${(p.proveedor_nombre || 'Sin proveedor').replace(/"/g, '""')}"`,
                valor.toFixed(2),
                p.activo ? 'Activo' : 'Inactivo',
                new Date(p.created_at).toLocaleDateString('es-HN')
            ];
            csvContent += row.join(',') + '\n';
        });
        
        // Agregar totales
        csvContent += '\n';
        csvContent += `TOTALES,,,,,${productos.reduce((sum, p) => sum + (parseInt(p.stock) || 0), 0)},,,,${valorTotal.toFixed(2)},,\n`;
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Inventario_Completo_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        showToast('Inventario completo descargado', 'success');
    } catch (error) {
        console.error('Error descargando inventario:', error);
        showToast('Error al descargar inventario', 'error');
    }
}

// Descargar inventario completo en PDF
async function descargarInventarioPDF() {
    try {
        showToast('Generando PDF...', 'info');
        
        const response = await fetchAuth(`${API_URL}/reportes/inventario-pdf`, {
            method: 'POST'
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Inventario_Completo_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            showToast('PDF de inventario descargado', 'success');
        } else {
            showToast('Error al generar PDF', 'error');
        }
    } catch (error) {
        console.error('Error descargando PDF inventario:', error);
        showToast('Error al descargar PDF', 'error');
    }
}

// Descargar stock bajo en PDF
async function descargarStockBajo() {
    try {
        const stockBajo = await fetchAuth(`${API_URL}/reportes/stock-bajo`).then(r => r.json());
        
        if (stockBajo.length === 0) {
            showToast('No hay productos con stock bajo', 'info');
            return;
        }
        
        // Generar PDF con datos
        const response = await fetchAuth(`${API_URL}/reportes/stock-bajo-pdf`, {
            method: 'POST',
            body: JSON.stringify({ productos: stockBajo })
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Stock_Bajo_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showToast('Reporte de stock bajo descargado', 'success');
        } else {
            showToast('Error al generar PDF', 'error');
        }
    } catch (error) {
        console.error('Error descargando stock bajo:', error);
        showToast('Error al descargar reporte', 'error');
    }
}