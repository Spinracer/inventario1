-- ========================================
-- SISTEMA DE USUARIOS Y AUTENTICACIÓN
-- ========================================

-- Tabla de roles
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar roles por defecto
INSERT INTO roles (nombre, descripcion) VALUES
    ('admin', 'Administrador con acceso total al sistema'),
    ('usuario', 'Usuario con permisos limitados de gestión'),
    ('visitante', 'Solo lectura para auditorías')
ON CONFLICT (nombre) DO NOTHING;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    nombre VARCHAR(200) NOT NULL,
    rol_id INTEGER REFERENCES roles(id) DEFAULT 2,
    google_id VARCHAR(255) UNIQUE,
    avatar_url TEXT,
    activo BOOLEAN DEFAULT true,
    ultimo_acceso TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de permisos granulares por usuario
CREATE TABLE IF NOT EXISTS permisos_usuario (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    
    -- Productos
    ver_productos BOOLEAN DEFAULT true,
    crear_productos BOOLEAN DEFAULT false,
    editar_productos BOOLEAN DEFAULT false,
    eliminar_productos BOOLEAN DEFAULT false,
    importar_productos BOOLEAN DEFAULT false,
    
    -- Categorías
    ver_categorias BOOLEAN DEFAULT true,
    crear_categorias BOOLEAN DEFAULT false,
    editar_categorias BOOLEAN DEFAULT false,
    eliminar_categorias BOOLEAN DEFAULT false,
    
    -- Movimientos
    ver_movimientos BOOLEAN DEFAULT true,
    crear_entrada BOOLEAN DEFAULT false,
    crear_salida BOOLEAN DEFAULT false,
    
    -- Reportes
    ver_reportes BOOLEAN DEFAULT true,
    generar_reportes BOOLEAN DEFAULT false,
    
    -- Usuarios (solo admin)
    ver_usuarios BOOLEAN DEFAULT false,
    crear_usuarios BOOLEAN DEFAULT false,
    editar_usuarios BOOLEAN DEFAULT false,
    eliminar_usuarios BOOLEAN DEFAULT false,
    
    -- Proveedores
    ver_proveedores BOOLEAN DEFAULT true,
    crear_proveedores BOOLEAN DEFAULT false,
    editar_proveedores BOOLEAN DEFAULT false,
    
    -- Asignaciones
    ver_asignaciones BOOLEAN DEFAULT true,
    crear_asignaciones BOOLEAN DEFAULT false,
    editar_asignaciones BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(usuario_id)
);

-- Tabla de sesiones
CREATE TABLE IF NOT EXISTS sesiones (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expira_en TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_google_id ON usuarios(google_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_token ON sesiones(token);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);

-- Crear usuario admin por defecto (password: admin123)
-- Hash bcrypt de "admin123"
INSERT INTO usuarios (email, password_hash, nombre, rol_id, activo) 
VALUES (
    'admin@inventario.com',
    '$2a$10$IM7OHFw6Lc3icEI8cBaT8OtBwAIgUXVdGrC0JRv4FsTkslfgJaL/2',
    'Administrador',
    1,
    true
) ON CONFLICT (email) DO NOTHING;

-- Asignar todos los permisos al admin
INSERT INTO permisos_usuario (
    usuario_id,
    ver_productos, crear_productos, editar_productos, eliminar_productos, importar_productos,
    ver_categorias, crear_categorias, editar_categorias, eliminar_categorias,
    ver_movimientos, crear_entrada, crear_salida,
    ver_reportes, generar_reportes,
    ver_usuarios, crear_usuarios, editar_usuarios, eliminar_usuarios,
    ver_proveedores, crear_proveedores, editar_proveedores,
    ver_asignaciones, crear_asignaciones, editar_asignaciones
)
SELECT 
    id,
    true, true, true, true, true,
    true, true, true, true,
    true, true, true,
    true, true,
    true, true, true, true,
    true, true, true,
    true, true, true
FROM usuarios WHERE email = 'admin@inventario.com'
ON CONFLICT (usuario_id) DO NOTHING;