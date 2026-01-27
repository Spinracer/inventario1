-- ========================================
-- FASE 2 Y 3: PROVEEDORES, IMÁGENES, ASIGNACIONES
-- ========================================

-- Tabla de proveedores
CREATE TABLE IF NOT EXISTS proveedores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    contacto VARCHAR(200),
    telefono VARCHAR(20),
    email VARCHAR(255),
    direccion TEXT,
    sitio_web VARCHAR(255),
    notas TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agregar proveedor a productos
ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS proveedor_id INTEGER REFERENCES proveedores(id);

-- Tabla de imágenes de productos
CREATE TABLE IF NOT EXISTS imagenes_productos (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER REFERENCES productos(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    nombre_archivo VARCHAR(255),
    es_principal BOOLEAN DEFAULT false,
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_imagenes_producto ON imagenes_productos(producto_id);

-- Tabla de departamentos
CREATE TABLE IF NOT EXISTS departamentos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar departamentos por defecto
INSERT INTO departamentos (nombre, descripcion) VALUES
    ('IT y Seguridad', 'Departamento de Tecnología y Seguridad'),
    ('Ventas', 'Departamento de Ventas'),
    ('Crédito', 'Departamento de Crédito'),
    ('Administración', 'Departamento Administrativo'),
    ('Recursos Humanos', 'Departamento de RRHH'),
    ('Operaciones', 'Departamento de Operaciones'),
    ('Logística', 'Departamento de Logística')
ON CONFLICT (nombre) DO NOTHING;

-- Tabla de zonas
CREATE TABLE IF NOT EXISTS zonas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    region VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar zonas por defecto (Honduras)
INSERT INTO zonas (nombre, region) VALUES
    ('Tegucigalpa', 'Francisco Morazán'),
    ('Comayagua', 'Comayagua'),
    ('San Pedro Sula', 'Cortés'),
    ('La Ceiba', 'Atlántida'),
    ('Choluteca', 'Choluteca'),
    ('El Progreso', 'Yoro'),
    ('Siguatepeque', 'Comayagua')
ON CONFLICT (nombre) DO NOTHING;

-- Tabla de destinos (tiendas/ubicaciones)
CREATE TABLE IF NOT EXISTS destinos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- 'tienda', 'bodega', 'oficina'
    departamento_id INTEGER REFERENCES departamentos(id),
    zona_id INTEGER REFERENCES zonas(id),
    contacto VARCHAR(200),
    telefono VARCHAR(20),
    direccion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de personal
CREATE TABLE IF NOT EXISTS personal (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    puesto VARCHAR(100),
    departamento_id INTEGER REFERENCES departamentos(id),
    zona_id INTEGER REFERENCES zonas(id),
    email VARCHAR(255),
    telefono VARCHAR(20),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de asignaciones
CREATE TABLE IF NOT EXISTS asignaciones (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER REFERENCES productos(id),
    destino_tipo VARCHAR(20) NOT NULL, -- 'tienda' o 'personal'
    destino_id INTEGER, -- ID de destinos o personal según tipo
    personal_id INTEGER REFERENCES personal(id),
    cantidad INTEGER NOT NULL,
    usuario_asigna_id INTEGER REFERENCES usuarios(id),
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_devolucion TIMESTAMP,
    estado VARCHAR(50) DEFAULT 'asignado', -- 'asignado', 'devuelto', 'perdido'
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_asignaciones_producto ON asignaciones(producto_id);
CREATE INDEX IF NOT EXISTS idx_asignaciones_personal ON asignaciones(personal_id);
CREATE INDEX IF NOT EXISTS idx_asignaciones_estado ON asignaciones(estado);
CREATE INDEX IF NOT EXISTS idx_proveedores_nombre ON proveedores(nombre);
CREATE INDEX IF NOT EXISTS idx_productos_proveedor ON productos(proveedor_id);