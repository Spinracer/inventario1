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
                reportes: 'Reportes'
            };
            document.getElementById('pageTitle').textContent = titles[section];

            if (section === 'productos') cargarProductos();
            if (section === 'categorias') cargarCategorias();
            if (section === 'movimientos') cargarMovimientos();
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
                <td>${parseFloat(p.precio).toFixed(2)}</td>
                <td><span class="badge ${p.stock <= p.stock_minimo ? 'badge-danger' : 'badge-success'}">${p.stock}</span></td>
                <td><span class="badge badge-success">Activo</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm" style="background: #3b82f6; color: white;" onclick="abrirModalEditarProducto(${p.id})">Editar</button>
                        <button class="btn btn-sm btn-danger" onclick="eliminarProducto(${p.id})">Eliminar</button>
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

// ========== INICIALIZACIÓN ==========
// Verificar autenticación al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📱 DOM Completamente cargado');
    
    // Inicializar dark mode
    initDarkMode();
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }
    
    // Configurar todos los event listeners
    setupLoginForm();
    setupMenuNavigation();
    setupProductoForm();
    setupCategoriaForm();
    setupMovimientoForm();
    setupEditProductoForm();
    
    // Setup búsqueda
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
        mostrarDashboard();
        cargarDashboard();
    } else {
        mostrarLogin();
    }
});