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
                    token: data.token ? data.token.substring(0, 20) + '...' : 'Sin token'
                });
                
                mostrarDashboard();
                showToast(`Bienvenido ${data.usuario.nombre}`, 'success');
                cargarDashboard();
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
        clearAuth();
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
        tbody.innerHTML = productos.map(p => `
            <tr>
                <td>${p.nombre}</td>
                <td>${p.sku}</td>
                <td>${p.categoria_nombre || 'Sin categoría'}</td>
                <td>$${parseFloat(p.precio).toFixed(2)}</td>
                <td><span class="badge ${p.stock <= p.stock_minimo ? 'badge-danger' : 'badge-success'}">${p.stock}</span></td>
                <td><span class="badge badge-success">Activo</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm" style="background: #3b82f6; color: white;" onclick="abrirModalEditarProducto(${p.id})" title="Editar">✏️</button>
                        <button class="btn btn-sm" style="background: #10b981; color: white;" onclick="abrirModalImagenes(${p.id})" title="Imágenes">🖼️</button>
                        <button class="btn btn-sm" style="background: #8b5cf6; color: white;" onclick="abrirModalQR(${p.id})" title="Generar QR">📱</button>
                        <button class="btn btn-sm btn-danger" onclick="eliminarProducto(${p.id})" title="Eliminar">🗑️</button>
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
        tbody.innerHTML = categorias.map(c => `
            <tr>
                <td>${c.id}</td>
                <td>${c.nombre}</td>
                <td>${c.descripcion || '-'}</td>
                <td>${new Date(c.created_at).toLocaleDateString()}</td>
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
    document.getElementById('formProducto').classList.remove('hidden');
}

function ocultarFormProducto() {
    document.getElementById('formProducto').classList.add('hidden');
    document.getElementById('productoForm').reset();
}

function mostrarFormCategoria() {
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
            <td>$${parseFloat(p.precio).toFixed(2)}</td>
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
                <td>$${precio.toFixed(2)}</td>
                <td>$${subtotal.toFixed(2)}</td>
                <td>${m.usuario_nombre || 'N/A'}</td>
            </tr>
        `;
    }).join('');
    
    document.getElementById('reporteTotalMovimientos').textContent = movimientos.length;
    document.getElementById('reporteCantidadTotal').textContent = totalCantidad;
    document.getElementById('reporteValorTotal').textContent = `$${totalValor.toFixed(2)}`;
    
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
    document.getElementById('gastosTotal').textContent = `$${data.resumen.total_gasto.toFixed(2)}`;
    
    const tbody = document.querySelector('#gastosCategoriaTable tbody');
    tbody.innerHTML = Object.entries(data.resumen.por_categoria).map(([cat, datos]) => `
        <tr>
            <td>${cat}</td>
            <td>${datos.cantidad}</td>
            <td>$${datos.total.toFixed(2)}</td>
        </tr>
    `).join('');
    
    container.classList.remove('hidden');
    showToast('Reporte de gastos generado', 'success');
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
                    <strong>Valor Inventario:</strong> $${stats.valor_inventario.toFixed(2)}
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

function generarCodigoQR(producto) {
    const canvas = document.getElementById('qrCanvas');
    
    // Cargar librería QRCode si no está disponible
    if (typeof QRCode === 'undefined') {
        // Cargar desde CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
        script.onload = () => generarQRInterno(canvas, producto);
        document.head.appendChild(script);
    } else {
        generarQRInterno(canvas, producto);
    }
}

function generarQRInterno(canvas, producto) {
    // Limpiar canvas
    const ctx = canvas.getContext('2d');
    canvas.width = 200;
    canvas.height = 200;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Datos del QR: JSON con info del producto
    const qrData = JSON.stringify({
        sku: producto.sku,
        nombre: producto.nombre,
        precio: producto.precio,
        id: producto.id
    });
    
    // Generar QR usando canvas
    QRCode.toCanvas(canvas, qrData, {
        width: 200,
        margin: 1,
        color: {
            dark: '#000000',
            light: '#FFFFFF'
        }
    }, function (error) {
        if (error) {
            console.error('Error generando QR:', error);
            showToast('Error al generar código QR', 'error');
        }
    });
}

function descargarQR() {
    if (!qrProductoActual) return;
    
    const canvas = document.getElementById('qrCanvas');
    const link = document.createElement('a');
    link.download = `QR_${qrProductoActual.sku || qrProductoActual.id}.png`;
    link.href = canvas.toDataURL();
    link.click();
    
    showToast('QR descargado', 'success');
}

function imprimirEtiqueta() {
    if (!qrProductoActual) return;
    
    // Crear canvas para etiqueta completa (2" x 1" = 200px x 100px @ 100dpi)
    const etiquetaCanvas = document.createElement('canvas');
    etiquetaCanvas.width = 400;
    etiquetaCanvas.height = 200;
    const ctx = etiquetaCanvas.getContext('2d');
    
    // Fondo blanco
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 400, 200);
    
    // Dibujar QR (izquierda)
    const qrCanvas = document.getElementById('qrCanvas');
    ctx.drawImage(qrCanvas, 10, 10, 180, 180);
    
    // Información del producto (derecha)
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(qrProductoActual.nombre.substring(0, 20), 200, 30);
    
    ctx.font = '14px Arial';
    ctx.fillText(`SKU: ${qrProductoActual.sku || 'N/A'}`, 200, 60);
    ctx.fillText(`Precio: $${parseFloat(qrProductoActual.precio).toFixed(2)}`, 200, 85);
    
    ctx.font = '10px Arial';
    ctx.fillStyle = '#666666';
    ctx.fillText(new Date().toLocaleString('es-HN'), 200, 110);
    
    // Descargar etiqueta
    const link = document.createElement('a');
    link.download = `Etiqueta_${qrProductoActual.sku || qrProductoActual.id}.png`;
    link.href = etiquetaCanvas.toDataURL();
    link.click();
    
    showToast('Etiqueta descargada. Lista para imprimir en impresora de etiquetas', 'success');
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
        tbody.innerHTML = usuarios.map(u => `
            <tr>
                <td>${u.nombre}</td>
                <td>${u.email}</td>
                <td><span class="badge badge-${u.rol_nombre === 'admin' ? 'success' : 'info'}">${u.rol_nombre}</span></td>
                <td><span class="badge badge-${u.activo ? 'success' : 'danger'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td>${u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString() : 'Nunca'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm" style="background: #3b82f6; color: white;" onclick="verPermisosUsuario(${u.id})">Permisos</button>
                        <button class="btn btn-sm btn-danger" onclick="desactivarUsuario(${u.id})" ${!u.activo ? 'disabled' : ''}>Desactivar</button>
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
    if (confirm('¿Estás seguro de desactivar este usuario?')) {
        try {
            const response = await fetchAuth(`${API_URL}/usuarios/${id}`, {method: 'DELETE'});
            if (response.ok) {
                showToast('Usuario desactivado exitosamente', 'success');
                cargarUsuarios();
            }
        } catch (error) {
            showToast('Error al desactivar usuario', 'error');
        }
    }
}

function verPermisosUsuario(id) {
    // TODO: Implementar modal de permisos
    showToast('Función de permisos en desarrollo', 'info');
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
        tbody.innerHTML = proveedores.map(p => `
            <tr>
                <td>${p.nombre}</td>
                <td>${p.contacto || '-'}</td>
                <td>${p.telefono || '-'}</td>
                <td>${p.email || '-'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm" style="background: #3b82f6; color: white;" onclick="editarProveedor(${p.id})">Editar</button>
                        <button class="btn btn-sm btn-danger" onclick="eliminarProveedor(${p.id})">Eliminar</button>
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
    document.getElementById('formProveedor').classList.remove('hidden');
}

function ocultarFormProveedor() {
    document.getElementById('formProveedor').classList.add('hidden');
    document.getElementById('proveedorForm').reset();
}

async function eliminarProveedor(id) {
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
                    ${a.estado === 'asignado' ? `
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
        // Mostrar menú de usuarios solo si es admin
        if (currentUser && currentUser.rol === 'admin') {
            document.getElementById('menuUsuarios').style.display = 'flex';
        }
        
        // Cargar datos iniciales
        cargarSelectoresBusqueda();
        cargarEstadisticasGenerales();
        
        // Verificar stock bajo al iniciar y cada 5 minutos
        verificarStockBajo();
        
        mostrarDashboard();
        cargarDashboard();
    } else {
        mostrarLogin();
    }
});