const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { verificarToken, verificarPermiso, verificarRol } = require('../middleware/auth');

// ========== LISTAR TODOS LOS USUARIOS (Solo Admin) ==========
router.get('/', verificarToken, verificarPermiso('ver_usuarios'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.email, u.nombre, u.rol_id, u.activo, 
        u.ultimo_acceso, u.created_at, u.avatar_url,
        r.nombre as rol_nombre
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      ORDER BY u.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudieron obtener los usuarios' 
    });
  }
});

// ========== OBTENER UN USUARIO POR ID ==========
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Solo admin o el mismo usuario pueden ver detalles
    if (req.usuario.rol_nombre !== 'admin' && req.usuario.id !== parseInt(id)) {
      return res.status(403).json({ 
        error: 'Acceso denegado',
        mensaje: 'No tienes permiso para ver este usuario' 
      });
    }

    const result = await pool.query(`
      SELECT 
        u.id, u.email, u.nombre, u.rol_id, u.activo, 
        u.ultimo_acceso, u.created_at, u.avatar_url,
        r.nombre as rol_nombre,
        p.*
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN permisos_usuario p ON u.id = p.usuario_id
      WHERE u.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Usuario no encontrado',
        mensaje: 'El usuario solicitado no existe' 
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudo obtener el usuario' 
    });
  }
});

// ========== CREAR USUARIO (Solo Admin) ==========
router.post('/', verificarToken, verificarPermiso('crear_usuarios'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, password, nombre, rol_id } = req.body;

    // Validaciones
    if (!email || !password || !nombre) {
      return res.status(400).json({ 
        error: 'Datos incompletos',
        mensaje: 'Email, contraseña y nombre son requeridos' 
      });
    }

    // Verificar si el email ya existe
    const usuarioExiste = await client.query(
      'SELECT id FROM usuarios WHERE email = $1',
      [email]
    );

    if (usuarioExiste.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Email ya registrado',
        mensaje: 'Este email ya está en uso' 
      });
    }

    await client.query('BEGIN');

    // Hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Crear usuario
    const nuevoUsuario = await client.query(
      `INSERT INTO usuarios (email, password_hash, nombre, rol_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, email, nombre, rol_id, created_at`,
      [email, passwordHash, nombre, rol_id || 2]
    );

    const usuarioId = nuevoUsuario.rows[0].id;

    // Asignar permisos por defecto según el rol
    let permisos = {};
    if (rol_id === 1) { // Admin
      permisos = {
        ver_productos: true, crear_productos: true, editar_productos: true, eliminar_productos: true, importar_productos: true,
        ver_categorias: true, crear_categorias: true, editar_categorias: true, eliminar_categorias: true,
        ver_movimientos: true, crear_entrada: true, crear_salida: true,
        ver_reportes: true, generar_reportes: true,
        ver_usuarios: true, crear_usuarios: true, editar_usuarios: true, eliminar_usuarios: true,
        ver_proveedores: true, crear_proveedores: true, editar_proveedores: true,
        ver_asignaciones: true, crear_asignaciones: true, editar_asignaciones: true
      };
    } else if (rol_id === 2) { // Usuario
      permisos = {
        ver_productos: true, crear_productos: false, editar_productos: false, eliminar_productos: false, importar_productos: false,
        ver_categorias: true, crear_categorias: false, editar_categorias: false, eliminar_categorias: false,
        ver_movimientos: true, crear_entrada: true, crear_salida: true,
        ver_reportes: true, generar_reportes: true,
        ver_usuarios: false, crear_usuarios: false, editar_usuarios: false, eliminar_usuarios: false,
        ver_proveedores: true, crear_proveedores: false, editar_proveedores: false,
        ver_asignaciones: true, crear_asignaciones: false, editar_asignaciones: false
      };
    } else { // Visitante
      permisos = {
        ver_productos: true, crear_productos: false, editar_productos: false, eliminar_productos: false, importar_productos: false,
        ver_categorias: true, crear_categorias: false, editar_categorias: false, eliminar_categorias: false,
        ver_movimientos: true, crear_entrada: false, crear_salida: false,
        ver_reportes: true, generar_reportes: false,
        ver_usuarios: false, crear_usuarios: false, editar_usuarios: false, eliminar_usuarios: false,
        ver_proveedores: true, crear_proveedores: false, editar_proveedores: false,
        ver_asignaciones: true, crear_asignaciones: false, editar_asignaciones: false
      };
    }

    await client.query(
      `INSERT INTO permisos_usuario (
        usuario_id,
        ver_productos, crear_productos, editar_productos, eliminar_productos, importar_productos,
        ver_categorias, crear_categorias, editar_categorias, eliminar_categorias,
        ver_movimientos, crear_entrada, crear_salida,
        ver_reportes, generar_reportes,
        ver_usuarios, crear_usuarios, editar_usuarios, eliminar_usuarios,
        ver_proveedores, crear_proveedores, editar_proveedores,
        ver_asignaciones, crear_asignaciones, editar_asignaciones
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
      [
        usuarioId,
        permisos.ver_productos, permisos.crear_productos, permisos.editar_productos, permisos.eliminar_productos, permisos.importar_productos,
        permisos.ver_categorias, permisos.crear_categorias, permisos.editar_categorias, permisos.eliminar_categorias,
        permisos.ver_movimientos, permisos.crear_entrada, permisos.crear_salida,
        permisos.ver_reportes, permisos.generar_reportes,
        permisos.ver_usuarios, permisos.crear_usuarios, permisos.editar_usuarios, permisos.eliminar_usuarios,
        permisos.ver_proveedores, permisos.crear_proveedores, permisos.editar_proveedores,
        permisos.ver_asignaciones, permisos.crear_asignaciones, permisos.editar_asignaciones
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      mensaje: 'Usuario creado exitosamente',
      usuario: nuevoUsuario.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear usuario:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudo crear el usuario' 
    });
  } finally {
    client.release();
  }
});

// ========== ACTUALIZAR USUARIO ==========
router.put('/:id', verificarToken, verificarPermiso('editar_usuarios'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { nombre, rol_id, activo } = req.body;

    await client.query('BEGIN');

    // Actualizar usuario
    const result = await client.query(
      `UPDATE usuarios 
       SET nombre = $1, rol_id = $2, activo = $3, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4 
       RETURNING id, email, nombre, rol_id, activo`,
      [nombre, rol_id, activo, id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        error: 'Usuario no encontrado',
        mensaje: 'El usuario solicitado no existe' 
      });
    }

    await client.query('COMMIT');

    res.json({
      mensaje: 'Usuario actualizado exitosamente',
      usuario: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudo actualizar el usuario' 
    });
  } finally {
    client.release();
  }
});

// ========== ACTUALIZAR PERMISOS DE USUARIO ==========
router.put('/:id/permisos', verificarToken, verificarPermiso('editar_usuarios'), async (req, res) => {
  try {
    const { id } = req.params;
    const permisos = req.body;

    // Construir query dinámica
    const campos = Object.keys(permisos).filter(key => key !== 'usuario_id' && key !== 'id');
    const valores = campos.map(campo => permisos[campo]);
    const setClause = campos.map((campo, idx) => `${campo} = $${idx + 1}`).join(', ');

    const result = await pool.query(
      `UPDATE permisos_usuario 
       SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
       WHERE usuario_id = $${campos.length + 1}
       RETURNING *`,
      [...valores, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Permisos no encontrados',
        mensaje: 'No se encontraron permisos para este usuario' 
      });
    }

    res.json({
      mensaje: 'Permisos actualizados exitosamente',
      permisos: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar permisos:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudieron actualizar los permisos' 
    });
  }
});

// ========== DESACTIVAR USUARIO (Soft delete) ==========
router.delete('/:id', verificarToken, verificarPermiso('eliminar_usuarios'), async (req, res) => {
  try {
    const { id } = req.params;

    // No permitir eliminar al mismo usuario
    if (req.usuario.id === parseInt(id)) {
      return res.status(400).json({ 
        error: 'Operación no permitida',
        mensaje: 'No puedes desactivar tu propia cuenta' 
      });
    }

    const result = await pool.query(
      `UPDATE usuarios 
       SET activo = false, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING id, email, nombre`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Usuario no encontrado',
        mensaje: 'El usuario solicitado no existe' 
      });
    }

    res.json({
      mensaje: 'Usuario desactivado exitosamente',
      usuario: result.rows[0]
    });
  } catch (error) {
    console.error('Error al desactivar usuario:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudo desactivar el usuario' 
    });
  }
});

// ========== ACTIVAR USUARIO ==========
router.put('/:id/activar', verificarToken, verificarPermiso('editar_usuarios'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE usuarios 
       SET activo = true, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING id, email, nombre, activo`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Usuario no encontrado',
        mensaje: 'El usuario solicitado no existe' 
      });
    }

    res.json({
      mensaje: 'Usuario activado exitosamente',
      usuario: result.rows[0]
    });
  } catch (error) {
    console.error('Error al activar usuario:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudo activar el usuario' 
    });
  }
});

// ========== LISTAR ROLES ==========
router.get('/roles/lista', verificarToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM roles ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al listar roles:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudieron obtener los roles' 
    });
  }
});

// ========== 4.3 ACTUALIZAR PERMISOS DE USUARIO ==========
router.put('/:id/permisos', verificarToken, verificarPermiso('editar_usuarios'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const permisos = req.body;
    
    // Verificar que el usuario existe
    const usuario = await client.query('SELECT id FROM usuarios WHERE id = $1', [id]);
    if (usuario.rows.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        mensaje: 'El usuario especificado no existe'
      });
    }
    
    await client.query('BEGIN');
    
    // Verificar si ya tiene registro de permisos
    const permisosExistentes = await client.query(
      'SELECT usuario_id FROM permisos_usuario WHERE usuario_id = $1',
      [id]
    );
    
    // Lista de todos los permisos válidos
    const permisosValidos = [
      'ver_productos', 'crear_productos', 'editar_productos', 'eliminar_productos', 'importar_productos',
      'ver_categorias', 'crear_categorias', 'editar_categorias', 'eliminar_categorias',
      'ver_movimientos', 'crear_entrada', 'crear_salida',
      'ver_reportes', 'generar_reportes',
      'ver_proveedores', 'crear_proveedores', 'editar_proveedores',
      'ver_asignaciones', 'crear_asignaciones', 'editar_asignaciones',
      'ver_usuarios', 'crear_usuarios', 'editar_usuarios', 'eliminar_usuarios'
    ];
    
    // Construir objeto de permisos con valores booleanos
    const permisosActualizados = {};
    permisosValidos.forEach(p => {
      permisosActualizados[p] = permisos[p] === true;
    });
    
    if (permisosExistentes.rows.length > 0) {
      // Actualizar permisos existentes
      const setClauses = permisosValidos.map((p, i) => `${p} = $${i + 2}`).join(', ');
      const valores = [id, ...permisosValidos.map(p => permisosActualizados[p])];
      
      await client.query(
        `UPDATE permisos_usuario SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE usuario_id = $1`,
        valores
      );
    } else {
      // Insertar nuevos permisos
      const columnas = ['usuario_id', ...permisosValidos].join(', ');
      const placeholders = permisosValidos.map((_, i) => `$${i + 2}`).join(', ');
      const valores = [id, ...permisosValidos.map(p => permisosActualizados[p])];
      
      await client.query(
        `INSERT INTO permisos_usuario (${columnas}) VALUES ($1, ${placeholders})`,
        valores
      );
    }
    
    await client.query('COMMIT');
    
    res.json({
      mensaje: 'Permisos actualizados exitosamente',
      usuario_id: id,
      permisos_actualizados: Object.keys(permisos).length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar permisos:', error);
    res.status(500).json({
      error: 'Error del servidor',
      mensaje: 'No se pudieron actualizar los permisos'
    });
  } finally {
    client.release();
  }
});

// ========== ADMIN: CAMBIAR CONTRASEÑA DE CUALQUIER USUARIO ==========
router.put('/:id/cambiar-password', verificarToken, verificarPermiso('editar_usuarios'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nuevaPassword } = req.body;

    if (!nuevaPassword || nuevaPassword.length < 6) {
      return res.status(400).json({
        error: 'Datos inválidos',
        mensaje: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Verificar que el usuario existe
    const usuario = await pool.query('SELECT id, email, nombre FROM usuarios WHERE id = $1', [id]);
    if (usuario.rows.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        mensaje: 'El usuario no existe'
      });
    }

    // Hash de la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(nuevaPassword, salt);

    // Actualizar contraseña
    await pool.query(
      'UPDATE usuarios SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, id]
    );

    // Invalidar todas las sesiones del usuario (forzar re-login)
    await pool.query('DELETE FROM sesiones WHERE usuario_id = $1', [id]);

    res.json({
      mensaje: `Contraseña de ${usuario.rows[0].nombre} actualizada exitosamente`,
      usuario: usuario.rows[0].email
    });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({
      error: 'Error del servidor',
      mensaje: 'No se pudo cambiar la contraseña'
    });
  }
});

module.exports = router;