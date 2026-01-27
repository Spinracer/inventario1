const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { verificarToken, verificarPermiso } = require('../middleware/auth');

// ========== LISTAR ASIGNACIONES ==========
router.get('/', verificarToken, verificarPermiso('ver_asignaciones'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.*,
        p.nombre as producto_nombre,
        p.sku as producto_sku,
        per.nombre as personal_nombre,
        per.puesto as personal_puesto,
        u.nombre as usuario_asigna_nombre,
        d.nombre as destino_nombre
      FROM asignaciones a
      JOIN productos p ON a.producto_id = p.id
      LEFT JOIN personal per ON a.personal_id = per.id
      LEFT JOIN usuarios u ON a.usuario_asigna_id = u.id
      LEFT JOIN destinos d ON a.destino_id = d.id
      ORDER BY a.created_at DESC
      LIMIT 200
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al listar asignaciones:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudieron obtener las asignaciones' 
    });
  }
});

// ========== ASIGNACIONES POR PERSONAL ==========
router.get('/personal/:id', verificarToken, verificarPermiso('ver_asignaciones'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.*,
        p.nombre as producto_nombre,
        p.sku as producto_sku,
        p.precio
      FROM asignaciones a
      JOIN productos p ON a.producto_id = p.id
      WHERE a.personal_id = $1 AND a.estado = 'asignado'
      ORDER BY a.created_at DESC
    `, [req.params.id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener asignaciones por personal:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudieron obtener las asignaciones' 
    });
  }
});

// ========== ASIGNACIONES POR DESTINO ==========
router.get('/destino/:id', verificarToken, verificarPermiso('ver_asignaciones'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.*,
        p.nombre as producto_nombre,
        p.sku as producto_sku,
        p.precio
      FROM asignaciones a
      JOIN productos p ON a.producto_id = p.id
      WHERE a.destino_id = $1 AND a.estado = 'asignado'
      ORDER BY a.created_at DESC
    `, [req.params.id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener asignaciones por destino:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudieron obtener las asignaciones' 
    });
  }
});

// ========== CREAR ASIGNACIÓN ==========
router.post('/', verificarToken, verificarPermiso('crear_asignaciones'), async (req, res) => {
  const { producto_id, destino_tipo, destino_id, personal_id, cantidad, observaciones } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Verificar stock disponible
    const stockCheck = await client.query(
      'SELECT stock, nombre FROM productos WHERE id = $1',
      [producto_id]
    );
    
    if (stockCheck.rows.length === 0) {
      throw new Error('Producto no encontrado');
    }
    
    if (stockCheck.rows[0].stock < cantidad) {
      throw new Error(`Stock insuficiente. Stock actual: ${stockCheck.rows[0].stock}`);
    }
    
    // Reducir stock del producto
    await client.query(
      'UPDATE productos SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [cantidad, producto_id]
    );
    
    // Crear asignación
    const result = await client.query(
      `INSERT INTO asignaciones 
       (producto_id, destino_tipo, destino_id, personal_id, cantidad, usuario_asigna_id, observaciones, estado) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'asignado') 
       RETURNING *`,
      [producto_id, destino_tipo, destino_id, personal_id, cantidad, req.usuario.id, observaciones]
    );
    
    // Registrar movimiento
    await client.query(
      `INSERT INTO movimientos (producto_id, tipo, cantidad, motivo, usuario_id, observaciones) 
       VALUES ($1, 'SALIDA', $2, 'Asignación', $3, $4)`,
      [producto_id, cantidad, req.usuario.id, `Asignado a ${destino_tipo}`]
    );
    
    await client.query('COMMIT');
    
    res.status(201).json({
      mensaje: 'Asignación creada exitosamente',
      asignacion: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear asignación:', error);
    res.status(500).json({ 
      error: error.message || 'Error del servidor',
      mensaje: 'No se pudo crear la asignación' 
    });
  } finally {
    client.release();
  }
});

// ========== DEVOLVER ASIGNACIÓN ==========
router.put('/:id/devolver', verificarToken, verificarPermiso('editar_asignaciones'), async (req, res) => {
  const { observaciones } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Obtener asignación
    const asignacion = await client.query(
      'SELECT * FROM asignaciones WHERE id = $1',
      [req.params.id]
    );
    
    if (asignacion.rows.length === 0) {
      throw new Error('Asignación no encontrada');
    }
    
    const { producto_id, cantidad } = asignacion.rows[0];
    
    // Actualizar asignación
    await client.query(
      `UPDATE asignaciones 
       SET estado = 'devuelto', fecha_devolucion = CURRENT_TIMESTAMP, 
           observaciones = COALESCE($1, observaciones), updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [observaciones, req.params.id]
    );
    
    // Devolver stock
    await client.query(
      'UPDATE productos SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [cantidad, producto_id]
    );
    
    // Registrar movimiento
    await client.query(
      `INSERT INTO movimientos (producto_id, tipo, cantidad, motivo, usuario_id, observaciones) 
       VALUES ($1, 'ENTRADA', $2, 'Devolución de asignación', $3, $4)`,
      [producto_id, cantidad, req.usuario.id, observaciones]
    );
    
    await client.query('COMMIT');
    
    res.json({
      mensaje: 'Asignación devuelta exitosamente'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al devolver asignación:', error);
    res.status(500).json({ 
      error: error.message || 'Error del servidor',
      mensaje: 'No se pudo devolver la asignación' 
    });
  } finally {
    client.release();
  }
});

// ========== GESTIÓN DE PERSONAL ==========
router.get('/personal', verificarToken, verificarPermiso('ver_asignaciones'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        per.*,
        d.nombre as departamento_nombre,
        z.nombre as zona_nombre,
        COUNT(a.id) as total_asignaciones
      FROM personal per
      LEFT JOIN departamentos d ON per.departamento_id = d.id
      LEFT JOIN zonas z ON per.zona_id = z.id
      LEFT JOIN asignaciones a ON per.id = a.personal_id AND a.estado = 'asignado'
      WHERE per.activo = true
      GROUP BY per.id, d.nombre, z.nombre
      ORDER BY per.nombre
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al listar personal:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudo obtener el personal' 
    });
  }
});

router.post('/personal', verificarToken, verificarPermiso('crear_asignaciones'), async (req, res) => {
  const { nombre, puesto, departamento_id, zona_id, email, telefono } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO personal (nombre, puesto, departamento_id, zona_id, email, telefono) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [nombre, puesto, departamento_id, zona_id, email, telefono]
    );
    
    res.status(201).json({
      mensaje: 'Personal creado exitosamente',
      personal: result.rows[0]
    });
  } catch (error) {
    console.error('Error al crear personal:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudo crear el personal' 
    });
  }
});

// ========== GESTIÓN DE DESTINOS ==========
router.get('/destinos', verificarToken, verificarPermiso('ver_asignaciones'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        dest.*,
        d.nombre as departamento_nombre,
        z.nombre as zona_nombre,
        COUNT(a.id) as total_asignaciones
      FROM destinos dest
      LEFT JOIN departamentos d ON dest.departamento_id = d.id
      LEFT JOIN zonas z ON dest.zona_id = z.id
      LEFT JOIN asignaciones a ON dest.id = a.destino_id AND a.estado = 'asignado'
      WHERE dest.activo = true
      GROUP BY dest.id, d.nombre, z.nombre
      ORDER BY dest.nombre
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al listar destinos:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudieron obtener los destinos' 
    });
  }
});

router.post('/destinos', verificarToken, verificarPermiso('crear_asignaciones'), async (req, res) => {
  const { nombre, tipo, departamento_id, zona_id, contacto, telefono, direccion } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO destinos (nombre, tipo, departamento_id, zona_id, contacto, telefono, direccion) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [nombre, tipo, departamento_id, zona_id, contacto, telefono, direccion]
    );
    
    res.status(201).json({
      mensaje: 'Destino creado exitosamente',
      destino: result.rows[0]
    });
  } catch (error) {
    console.error('Error al crear destino:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudo crear el destino' 
    });
  }
});

// ========== DEPARTAMENTOS Y ZONAS ==========
router.get('/catalogos/departamentos', verificarToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM departamentos ORDER BY nombre');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al listar departamentos:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.get('/catalogos/zonas', verificarToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM zonas ORDER BY nombre');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al listar zonas:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;