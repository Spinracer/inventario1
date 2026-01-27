const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { verificarToken, verificarPermiso } = require('../middleware/auth');

// ========== LISTAR PROVEEDORES ==========
router.get('/', verificarToken, verificarPermiso('ver_proveedores'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM proveedores 
      WHERE activo = true 
      ORDER BY nombre
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al listar proveedores:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudieron obtener los proveedores' 
    });
  }
});

// ========== OBTENER PROVEEDOR POR ID ==========
router.get('/:id', verificarToken, verificarPermiso('ver_proveedores'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM proveedores WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Proveedor no encontrado',
        mensaje: 'El proveedor solicitado no existe' 
      });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener proveedor:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudo obtener el proveedor' 
    });
  }
});

// ========== CREAR PROVEEDOR ==========
router.post('/', verificarToken, verificarPermiso('crear_proveedores'), async (req, res) => {
  const { nombre, contacto, telefono, email, direccion, sitio_web, notas } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO proveedores (nombre, contacto, telefono, email, direccion, sitio_web, notas) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [nombre, contacto, telefono, email, direccion, sitio_web, notas]
    );
    
    res.status(201).json({
      mensaje: 'Proveedor creado exitosamente',
      proveedor: result.rows[0]
    });
  } catch (error) {
    console.error('Error al crear proveedor:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudo crear el proveedor' 
    });
  }
});

// ========== ACTUALIZAR PROVEEDOR ==========
router.put('/:id', verificarToken, verificarPermiso('editar_proveedores'), async (req, res) => {
  const { id } = req.params;
  const { nombre, contacto, telefono, email, direccion, sitio_web, notas, activo } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE proveedores 
       SET nombre = $1, contacto = $2, telefono = $3, email = $4, 
           direccion = $5, sitio_web = $6, notas = $7, activo = $8,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $9 
       RETURNING *`,
      [nombre, contacto, telefono, email, direccion, sitio_web, notas, activo, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Proveedor no encontrado',
        mensaje: 'El proveedor solicitado no existe' 
      });
    }
    
    res.json({
      mensaje: 'Proveedor actualizado exitosamente',
      proveedor: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar proveedor:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudo actualizar el proveedor' 
    });
  }
});

// ========== DESACTIVAR PROVEEDOR ==========
router.delete('/:id', verificarToken, verificarPermiso('editar_proveedores'), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE proveedores SET activo = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Proveedor no encontrado',
        mensaje: 'El proveedor solicitado no existe' 
      });
    }
    
    res.json({
      mensaje: 'Proveedor desactivado exitosamente',
      proveedor: result.rows[0]
    });
  } catch (error) {
    console.error('Error al desactivar proveedor:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudo desactivar el proveedor' 
    });
  }
});

// ========== PRODUCTOS POR PROVEEDOR ==========
router.get('/:id/productos', verificarToken, verificarPermiso('ver_productos'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.nombre as categoria_nombre 
      FROM productos p 
      LEFT JOIN categorias c ON p.categoria_id = c.id 
      WHERE p.proveedor_id = $1 AND p.activo = true
      ORDER BY p.nombre
    `, [req.params.id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener productos del proveedor:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudieron obtener los productos' 
    });
  }
});

module.exports = router;