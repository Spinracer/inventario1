const API_URL = '/api';

// ========== LOGIN ==========
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (username === 'admin' && password === 'admin123') {
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('dashboard').classList.add('active');
        cargarDashboard();
    } else {
        alert('Usuario o contraseña incorrectos');
    }
});

// ========== LOGOUT ==========
function logout() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('dashboard').classList.remove('active');
}

// ========== MENU NAVIGATION ==========
document.querySelectorAll('.menu-item').forEach(item => {
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

// ========== DASHBOARD ==========
async function cargarDashboard() {
    try {
        const [productos, categorias, stockBajo] = await Promise.all([
            fetch(`${API_URL}/productos`).then(r => r.json()),
            fetch(`${API_URL}/categorias`).then(r => r.json()),
            fetch(`${API_URL}/reportes/stock-bajo`).then(r => r.json())
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
    }
}

// ========== PRODUCTOS ==========
async function cargarProductos() {
    try {
        const productos = await fetch(`${API_URL}/productos`).then(r => r.json());
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
                        <button class="btn btn-sm" style="background: #3b82f6; color: white;" onclick="editarProducto(${p.id})">Editar</button>
                        <button class="btn btn-sm btn-danger" onclick="eliminarProducto(${p.id})">Eliminar</button>
                    </div>
                </td>
            </tr>
        `).join('');

        await cargarCategoriasEnSelect();
    } catch (error) {
        console.error('Error al cargar productos:', error);
    }
}

async function eliminarProducto(id) {
    if (confirm('¿Estás seguro de eliminar este producto?')) {
        try {
            await fetch(`${API_URL}/productos/${id}`, {method: 'DELETE'});
            alert('Producto eliminado exitosamente');
            cargarProductos();
            cargarDashboard();
        } catch (error) {
            alert('Error al eliminar producto');
        }
    }
}

function editarProducto(id) {
    alert('Función de edición en desarrollo para producto ID: ' + id);
}

// ========== CATEGORÍAS ==========
async function cargarCategorias() {
    try {
        const categorias = await fetch(`${API_URL}/categorias`).then(r => r.json());
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
    }
}

async function cargarCategoriasEnSelect() {
    try {
        const categorias = await fetch(`${API_URL}/categorias`).then(r => r.json());
        
        document.getElementById('categoriaSelect').innerHTML = '<option value="">Sin categoría</option>' + 
            categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

        const productos = await fetch(`${API_URL}/productos`).then(r => r.json());
        document.getElementById('productoSelectMov').innerHTML = 
            productos.map(p => `<option value="${p.id}">${p.nombre} (Stock: ${p.stock})</option>`).join('');
    } catch (error) {
        console.error('Error al cargar categorías en select:', error);
    }
}

// ========== MOVIMIENTOS ==========
async function cargarMovimientos() {
    try {
        const movimientos = await fetch(`${API_URL}/movimientos`).then(r => r.json());
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
document.getElementById('productoForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const data = Object.fromEntries(formData);

    // Convertir valores numéricos
    if (data.precio !== undefined) data.precio = parseFloat(data.precio);
    if (data.stock !== undefined) data.stock = parseInt(data.stock);
    if (data.stock_minimo !== undefined) data.stock_minimo = parseInt(data.stock_minimo);
    if (data.categoria_id !== undefined) data.categoria_id = parseInt(data.categoria_id);

    try {
        const response = await fetch(`${API_URL}/productos`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert('Producto creado exitosamente');
            ocultarFormProducto();
            cargarProductos();
            cargarDashboard();
        } else {
            alert('Error al crear producto');
        }
    } catch (error) {
        alert('Error al crear producto');
    }
});

// Submit Categoría
document.getElementById('categoriaForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const data = Object.fromEntries(formData);

    try {
        const response = await fetch(`${API_URL}/categorias`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert('Categoría creada exitosamente');
            ocultarFormCategoria();
            cargarCategorias();
            cargarDashboard();
        } else {
            alert('Error al crear categoría');
        }
    } catch (error) {
        alert('Error al crear categoría');
    }
});

// Submit Movimiento
document.getElementById('movimientoForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const data = Object.fromEntries(formData);

    // Convertir valores numéricos
    if (data.producto_id !== undefined) data.producto_id = parseInt(data.producto_id);
    if (data.cantidad !== undefined) data.cantidad = parseInt(data.cantidad);

    try {
        const tipo = data.tipo.toLowerCase();
        const response = await fetch(`${API_URL}/movimientos/${tipo}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert('Movimiento registrado exitosamente');
            this.reset();
            cargarMovimientos();
            cargarDashboard();
        } else {
            const error = await response.json();
            alert('Error: ' + error.error);
        }
    } catch (error) {
        alert('Error al registrar movimiento');
    }
});

// ========== BÚSQUEDA ==========
document.getElementById('searchProductos').addEventListener('input', function(e) {
    const search = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#productosTable tbody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(search) ? '' : 'none';
    });
});

// ========== REPORTES ==========
function generarReporteInventario() {
    window.open(`${API_URL}/productos`, '_blank');
}

function verStockBajo() {
    window.open(`${API_URL}/reportes/stock-bajo`, '_blank');
}