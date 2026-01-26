require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Servir archivos estáticos (Frontend)
app.use(express.static('public'));

// Configuración de la base de datos
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Verificar conexión a la base de datos
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error al conectar a la base de datos:', err.stack);
  } else {
    console.log('✅ Conectado a la base de datos PostgreSQL');
    release();
  }
});

// Inicializar tablas
const initDb = async () => {
  const client = await pool.connect();
  try {
    // Leer y ejecutar el script SQL de usuarios
    const sqlPath = path.join(__dirname, 'scripts', 'createUsers.sql');
    if (fs.existsSync(sqlPath)) {
      const sqlScript = fs.readFileSync(sqlPath, 'utf8');
      await client.query(sqlScript);
      console.log('✅ Tablas de usuarios creadas o verificadas');
    }

    // Crear tablas originales del inventario
    await client.query(`
      CREATE TABLE IF NOT EXISTS categorias (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL UNIQUE,
        descripcion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS productos (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(200) NOT NULL,
        descripcion TEXT,
        sku VARCHAR(50) UNIQUE,
        precio DECIMAL(10, 2) NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        stock_minimo INTEGER DEFAULT 0,
        categoria_id INTEGER REFERENCES categorias(id),
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS movimientos (
        id SERIAL PRIMARY KEY,
        producto_id INTEGER REFERENCES productos(id),
        tipo VARCHAR(20) NOT NULL,
        cantidad INTEGER NOT NULL,
        motivo TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Agregar columnas de usuario y observaciones si no existen
      ALTER TABLE movimientos 
      ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id),
      ADD COLUMN IF NOT EXISTS observaciones TEXT;
    `);
    console.log('✅ Tablas de inventario creadas o verificadas correctamente');
  } catch (err) {
    console.error('❌ Error al crear tablas:', err);
  } finally {
    client.release();
  }
};

initDb();

// ==================== RUTAS ====================

// Ruta de info de la API (cambiada a /api)
app.get('/api', (req, res) => {
  res.json({
    mensaje: '🎯 API de Inventario',
    version: '1.0.0',
    endpoints: {
      categorias: '/api/categorias',
      productos: '/api/productos',
      movimientos: '/api/movimientos'
    }
  });
});

// ========== CATEGORÍAS ==========

// Listar todas las categorías
app.get('/api/categorias', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categorias ORDER BY nombre');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear categoría
app.post('/api/categorias', async (req, res) => {
  const { nombre, descripcion } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO categorias (nombre, descripcion) VALUES ($1, $2) RETURNING *',
      [nombre, descripcion]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== PRODUCTOS ==========

// Listar todos los productos
app.get('/api/productos', verificarToken, verificarPermiso('ver_productos'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.nombre as categoria_nombre 
      FROM productos p 
      LEFT JOIN categorias c ON p.categoria_id = c.id 
      WHERE p.activo = true
      ORDER BY p.nombre
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener un producto por ID
app.get('/api/productos/:id', verificarToken, verificarPermiso('ver_productos'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT p.*, c.nombre as categoria_nombre FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id WHERE p.id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear producto
app.post('/api/productos', verificarToken, verificarPermiso('crear_productos'), async (req, res) => {
  const { nombre, descripcion, sku, precio, stock, stock_minimo, categoria_id } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO productos (nombre, descripcion, sku, precio, stock, stock_minimo, categoria_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [nombre, descripcion, sku, precio, stock || 0, stock_minimo || 0, categoria_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar producto
app.put('/api/productos/:id', verificarToken, verificarPermiso('editar_productos'), async (req, res) => {
  const { nombre, descripcion, precio, stock_minimo, categoria_id, activo } = req.body;
  try {
    const result = await pool.query(
      'UPDATE productos SET nombre = $1, descripcion = $2, precio = $3, stock_minimo = $4, categoria_id = $5, activo = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING *',
      [nombre, descripcion, precio, stock_minimo, categoria_id, activo, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar producto (soft delete)
app.delete('/api/productos/:id', verificarToken, verificarPermiso('eliminar_productos'), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE productos SET activo = false WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json({ mensaje: 'Producto eliminado', producto: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== MOVIMIENTOS DE INVENTARIO ==========

// Registrar entrada de stock
app.post('/api/movimientos/entrada', verificarToken, verificarPermiso('crear_entrada'), async (req, res) => {
  const { producto_id, cantidad, motivo, observaciones } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Actualizar stock
    await client.query(
      'UPDATE productos SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [cantidad, producto_id]
    );
    
    // Registrar movimiento con usuario
    const result = await client.query(
      'INSERT INTO movimientos (producto_id, tipo, cantidad, motivo, usuario_id, observaciones) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [producto_id, 'ENTRADA', cantidad, motivo, req.usuario.id, observaciones]
    );
    
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Registrar salida de stock
app.post('/api/movimientos/salida', verificarToken, verificarPermiso('crear_salida'), async (req, res) => {
  const { producto_id, cantidad, motivo, observaciones } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Verificar stock disponible
    const stockCheck = await client.query(
      'SELECT stock FROM productos WHERE id = $1',
      [producto_id]
    );
    
    if (stockCheck.rows.length === 0) {
      throw new Error('Producto no encontrado');
    }
    
    if (stockCheck.rows[0].stock < cantidad) {
      throw new Error('Stock insuficiente');
    }
    
    // Actualizar stock
    await client.query(
      'UPDATE productos SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [cantidad, producto_id]
    );
    
    // Registrar movimiento con usuario
    const result = await client.query(
      'INSERT INTO movimientos (producto_id, tipo, cantidad, motivo, usuario_id, observaciones) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [producto_id, 'SALIDA', cantidad, motivo, req.usuario.id, observaciones]
    );
    
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Listar movimientos
app.get('/api/movimientos', verificarToken, verificarPermiso('ver_movimientos'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, p.nombre as producto_nombre, u.nombre as usuario_nombre
      FROM movimientos m 
      JOIN productos p ON m.producto_id = p.id 
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      ORDER BY m.created_at DESC 
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== REPORTES ==========

// Productos con stock bajo
app.get('/api/reportes/stock-bajo', verificarToken, verificarPermiso('ver_reportes'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.nombre as categoria_nombre 
      FROM productos p 
      LEFT JOIN categorias c ON p.categoria_id = c.id 
      WHERE p.stock <= p.stock_minimo AND p.activo = true
      ORDER BY p.stock
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📊 Panel de API disponible en http://localhost:${PORT}`);
});