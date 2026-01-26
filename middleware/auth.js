const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// Middleware para verificar JWT
const verificarToken = async (req, res, next) => {
  try {
    // Obtener token del header
    const token = req.headers.authorization?.split(' ')[1]; // "Bearer TOKEN"
    
    if (!token) {
      return res.status(401).json({ 
        error: 'No autorizado',
        mensaje: 'Token no proporcionado' 
      });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar que el usuario existe y está activo
    const result = await pool.query(
      'SELECT u.*, r.nombre as rol_nombre FROM usuarios u JOIN roles r ON u.rol_id = r.id WHERE u.id = $1 AND u.activo = true',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'No autorizado',
        mensaje: 'Usuario no encontrado o inactivo' 
      });
    }

    // Agregar usuario a la request
    req.usuario = result.rows[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expirado',
        mensaje: 'Por favor inicia sesión nuevamente' 
      });
    }
    return res.status(401).json({ 
      error: 'Token inválido',
      mensaje: 'Autenticación fallida' 
    });
  }
};

// Middleware para verificar permisos específicos
const verificarPermiso = (permiso) => {
  return async (req, res, next) => {
    try {
      const usuarioId = req.usuario.id;
      
      // Admin tiene todos los permisos
      if (req.usuario.rol_nombre === 'admin') {
        return next();
      }

      // Verificar permiso específico
      const result = await pool.query(
        `SELECT ${permiso} FROM permisos_usuario WHERE usuario_id = $1`,
        [usuarioId]
      );

      if (result.rows.length === 0 || !result.rows[0][permiso]) {
        return res.status(403).json({ 
          error: 'Acceso denegado',
          mensaje: `No tienes permiso para: ${permiso}` 
        });
      }

      next();
    } catch (error) {
      console.error('Error verificando permiso:', error);
      return res.status(500).json({ 
        error: 'Error del servidor',
        mensaje: 'Error al verificar permisos' 
      });
    }
  };
};

// Middleware para verificar rol
const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ 
        error: 'No autorizado',
        mensaje: 'Usuario no autenticado' 
      });
    }

    if (!rolesPermitidos.includes(req.usuario.rol_nombre)) {
      return res.status(403).json({ 
        error: 'Acceso denegado',
        mensaje: 'No tienes permisos suficientes' 
      });
    }

    next();
  };
};

module.exports = {
  verificarToken,
  verificarPermiso,
  verificarRol
};