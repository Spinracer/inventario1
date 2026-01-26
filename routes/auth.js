const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { verificarToken } = require('../middleware/auth');

// ========== REGISTRO DE USUARIO ==========
router.post('/registro', async (req, res) => {
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
      [email, passwordHash, nombre, rol_id || 2] // 2 = usuario por defecto
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
      mensaje: 'Usuario registrado exitosamente',
      usuario: nuevoUsuario.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudo registrar el usuario' 
    });
  } finally {
    client.release();
  }
});

// ========== LOGIN ==========
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validaciones
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Datos incompletos',
        mensaje: 'Email y contraseña son requeridos' 
      });
    }

    // Buscar usuario
    const result = await pool.query(
      `SELECT u.*, r.nombre as rol_nombre 
       FROM usuarios u 
       JOIN roles r ON u.rol_id = r.id 
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Credenciales inválidas',
        mensaje: 'Email o contraseña incorrectos' 
      });
    }

    const usuario = result.rows[0];

    // Verificar si está activo
    if (!usuario.activo) {
      return res.status(403).json({ 
        error: 'Usuario inactivo',
        mensaje: 'Tu cuenta ha sido desactivada' 
      });
    }

    // Verificar contraseña
    const passwordValido = await bcrypt.compare(password, usuario.password_hash);
    
    if (!passwordValido) {
      return res.status(401).json({ 
        error: 'Credenciales inválidas',
        mensaje: 'Email o contraseña incorrectos' 
      });
    }

    // Obtener permisos
    const permisos = await pool.query(
      'SELECT * FROM permisos_usuario WHERE usuario_id = $1',
      [usuario.id]
    );

    // Generar JWT
    const token = jwt.sign(
      { 
        userId: usuario.id,
        email: usuario.email,
        rol: usuario.rol_nombre 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Actualizar último acceso
    await pool.query(
      'UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id = $1',
      [usuario.id]
    );

    // Guardar sesión
    await pool.query(
      `INSERT INTO sesiones (usuario_id, token, ip_address, user_agent, expira_en) 
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '24 hours')`,
      [
        usuario.id,
        token,
        req.ip,
        req.get('user-agent')
      ]
    );

    res.json({
      mensaje: 'Login exitoso',
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol_nombre,
        avatar: usuario.avatar_url
      },
      permisos: permisos.rows[0] || {}
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudo iniciar sesión' 
    });
  }
});

// ========== VERIFICAR TOKEN ==========
router.get('/verificar', verificarToken, async (req, res) => {
  try {
    // Obtener permisos
    const permisos = await pool.query(
      'SELECT * FROM permisos_usuario WHERE usuario_id = $1',
      [req.usuario.id]
    );

    res.json({
      usuario: {
        id: req.usuario.id,
        email: req.usuario.email,
        nombre: req.usuario.nombre,
        rol: req.usuario.rol_nombre,
        avatar: req.usuario.avatar_url
      },
      permisos: permisos.rows[0] || {}
    });
  } catch (error) {
    console.error('Error al verificar token:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudo verificar el token' 
    });
  }
});

// ========== LOGOUT ==========
router.post('/logout', verificarToken, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    // Eliminar sesión
    await pool.query(
      'DELETE FROM sesiones WHERE token = $1',
      [token]
    );

    res.json({ mensaje: 'Logout exitoso' });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudo cerrar sesión' 
    });
  }
});

// ========== CAMBIAR CONTRASEÑA ==========
router.post('/cambiar-password', verificarToken, async (req, res) => {
  try {
    const { passwordActual, passwordNuevo } = req.body;
    const usuarioId = req.usuario.id;

    // Obtener password actual
    const result = await pool.query(
      'SELECT password_hash FROM usuarios WHERE id = $1',
      [usuarioId]
    );

    const usuario = result.rows[0];

    // Verificar password actual
    const passwordValido = await bcrypt.compare(passwordActual, usuario.password_hash);
    
    if (!passwordValido) {
      return res.status(401).json({ 
        error: 'Contraseña incorrecta',
        mensaje: 'La contraseña actual no es correcta' 
      });
    }

    // Hash del nuevo password
    const salt = await bcrypt.genSalt(10);
    const nuevoPasswordHash = await bcrypt.hash(passwordNuevo, salt);

    // Actualizar password
    await pool.query(
      'UPDATE usuarios SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [nuevoPasswordHash, usuarioId]
    );

    res.json({ mensaje: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudo cambiar la contraseña' 
    });
  }
});

module.exports = router;