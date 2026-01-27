const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { verificarToken, verificarPermiso } = require('../middleware/auth');
const upload = require('../config/multer');
const path = require('path');
const fs = require('fs');

// ========== SUBIR IMÁGENES DE PRODUCTO ==========
router.post('/producto/:id', verificarToken, verificarPermiso('editar_productos'), upload.array('imagenes', 5), async (req, res) => {
  const productoId = req.params.id;
  const client = await pool.connect();
  
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        error: 'No se subieron archivos',
        mensaje: 'Debes seleccionar al menos una imagen' 
      });
    }
    
    await client.query('BEGIN');
    
    // Verificar que el producto existe
    const producto = await client.query(
      'SELECT id FROM productos WHERE id = $1',
      [productoId]
    );
    
    if (producto.rows.length === 0) {
      throw new Error('Producto no encontrado');
    }
    
    // Obtener el orden máximo actual
    const maxOrden = await client.query(
      'SELECT COALESCE(MAX(orden), -1) as max_orden FROM imagenes_productos WHERE producto_id = $1',
      [productoId]
    );
    
    let orden = maxOrden.rows[0].max_orden + 1;
    const imagenes = [];
    
    // Insertar cada imagen
    for (const file of req.files) {
      const url = `/uploads/productos/${productoId}/${file.filename}`;
      
      const result = await client.query(
        `INSERT INTO imagenes_productos (producto_id, url, nombre_archivo, orden) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *`,
        [productoId, url, file.filename, orden]
      );
      
      imagenes.push(result.rows[0]);
      orden++;
    }
    
    // Si es la primera imagen, marcarla como principal
    if (imagenes.length > 0) {
      const tieneImagenPrincipal = await client.query(
        'SELECT id FROM imagenes_productos WHERE producto_id = $1 AND es_principal = true',
        [productoId]
      );
      
      if (tieneImagenPrincipal.rows.length === 0) {
        await client.query(
          'UPDATE imagenes_productos SET es_principal = true WHERE id = $1',
          [imagenes[0].id]
        );
      }
    }
    
    await client.query('COMMIT');
    
    res.status(201).json({
      mensaje: 'Imágenes subidas exitosamente',
      imagenes: imagenes
    });
  } catch (error) {
    await client.query('ROLLBACK');
    
    // Eliminar archivos subidos si hubo error
    if (req.files) {
      req.files.forEach(file => {
        fs.unlinkSync(file.path);
      });
    }
    
    console.error('Error al subir imágenes:', error);
    res.status(500).json({ 
      error: error.message || 'Error del servidor',
      mensaje: 'No se pudieron subir las imágenes' 
    });
  } finally {
    client.release();
  }
});

// ========== LISTAR IMÁGENES DE PRODUCTO ==========
router.get('/producto/:id', verificarToken, verificarPermiso('ver_productos'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM imagenes_productos WHERE producto_id = $1 ORDER BY orden, created_at',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al listar imágenes:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudieron obtener las imágenes' 
    });
  }
});

// ========== ESTABLECER IMAGEN PRINCIPAL ==========
router.put('/:id/principal', verificarToken, verificarPermiso('editar_productos'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Obtener la imagen
    const imagen = await client.query(
      'SELECT producto_id FROM imagenes_productos WHERE id = $1',
      [req.params.id]
    );
    
    if (imagen.rows.length === 0) {
      throw new Error('Imagen no encontrada');
    }
    
    const productoId = imagen.rows[0].producto_id;
    
    // Quitar principal de todas las imágenes del producto
    await client.query(
      'UPDATE imagenes_productos SET es_principal = false WHERE producto_id = $1',
      [productoId]
    );
    
    // Establecer esta como principal
    await client.query(
      'UPDATE imagenes_productos SET es_principal = true WHERE id = $1',
      [req.params.id]
    );
    
    await client.query('COMMIT');
    
    res.json({ mensaje: 'Imagen principal actualizada' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al establecer imagen principal:', error);
    res.status(500).json({ 
      error: error.message || 'Error del servidor',
      mensaje: 'No se pudo establecer la imagen principal' 
    });
  } finally {
    client.release();
  }
});

// ========== ELIMINAR IMAGEN ==========
router.delete('/:id', verificarToken, verificarPermiso('editar_productos'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Obtener información de la imagen
    const imagen = await client.query(
      'SELECT * FROM imagenes_productos WHERE id = $1',
      [req.params.id]
    );
    
    if (imagen.rows.length === 0) {
      throw new Error('Imagen no encontrada');
    }
    
    const { url, producto_id, es_principal } = imagen.rows[0];
    
    // Eliminar de la base de datos
    await client.query(
      'DELETE FROM imagenes_productos WHERE id = $1',
      [req.params.id]
    );
    
    // Si era la imagen principal, establecer otra como principal
    if (es_principal) {
      const otraImagen = await client.query(
        'SELECT id FROM imagenes_productos WHERE producto_id = $1 ORDER BY orden LIMIT 1',
        [producto_id]
      );
      
      if (otraImagen.rows.length > 0) {
        await client.query(
          'UPDATE imagenes_productos SET es_principal = true WHERE id = $1',
          [otraImagen.rows[0].id]
        );
      }
    }
    
    await client.query('COMMIT');
    
    // Eliminar archivo físico
    const filePath = path.join(__dirname, '..', url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    res.json({ mensaje: 'Imagen eliminada exitosamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al eliminar imagen:', error);
    res.status(500).json({ 
      error: error.message || 'Error del servidor',
      mensaje: 'No se pudo eliminar la imagen' 
    });
  } finally {
    client.release();
  }
});

module.exports = router;