# Nuevas Funcionalidades y Dependencias Integradas

## 📦 Dependencias Agregadas/Actualizadas

Tu proyecto ahora incluye las siguientes tecnologías adicionales:

### 1. **Passport.js** (v0.7.0)
   - Framework modular de autenticación para Node.js
   - Ya integrado en `middleware/auth.js`
   - Estrategias disponibles:
     - `passport-local`: Autenticación con email/contraseña
     - `passport-google-oauth20`: OAuth2 con Google

### 2. **Express Session** (v1.17.3)
   - Manejo de sesiones HTTP
   - Complementa JWT para persistencia de sesión
   - Almacenamiento de estado del usuario

### 3. **Cookie Parser** (v1.4.6)
   - Parser de cookies para Express
   - Necesario para manejo de sesiones

### 4. **Multer** (v2.0.2)
   - Middleware para carga de archivos
   - Soporta múltiples archivos
   - Perfecto para: fotos de productos, facturas, documentos

### 5. **PDFKit** (v0.14.0) ⭐ Actualizado
   - Generación de PDFs en Node.js
   - Ya en uso: reportes de movimientos
   - Nuevas capacidades: añadir imágenes, tablas mejoradas, códigos de barras

### 6. **QRCode** (v1.5.3) ⭐ Nuevo
   - Generación de códigos QR
   - Casos de uso: 
     - Códigos QR en etiquetas de productos
     - Códigos QR en reportes PDF
     - Códigos QR para seguimiento de inventario

---

## 🔧 Cómo Usar las Nuevas Funcionalidades

### A. Cargar Archivos con Multer

```javascript
// En routes/productos.js
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/productos/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Ruta para cargar imagen de producto
router.post('/productos/:id/imagen', upload.single('imagen'), async (req, res) => {
  const { id } = req.params;
  const imagenPath = `/uploads/productos/${req.file.filename}`;
  
  // Guardar ruta en base de datos
  await pool.query('UPDATE productos SET imagen_url = $1 WHERE id = $2', 
    [imagenPath, id]);
  
  res.json({ mensaje: 'Imagen cargada', imagen_url: imagenPath });
});
```

---

### B. Generar Códigos QR

```javascript
// En index.js
const QRCode = require('qrcode');

// Generar QR para un producto
app.get('/api/productos/:id/qr', async (req, res) => {
  const { id } = req.params;
  
  // Generar código QR con datos del producto
  const qrData = `https://tudominio.com/producto/${id}`;
  
  try {
    const qrImage = await QRCode.toDataURL(qrData);
    res.json({ qr_code: qrImage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// O generar como archivo PNG
app.get('/api/productos/:id/qr/png', async (req, res) => {
  const { id } = req.params;
  const qrData = `https://tudominio.com/producto/${id}`;
  
  res.setHeader('Content-Type', 'image/png');
  QRCode.toStream(res, qrData);
});
```

---

### C. Mejorar Reportes PDF con QR + Imágenes

```javascript
// En index.js - Actualizar ruta de reportes
app.post('/api/reportes/movimientos-pdf', verificarToken, async (req, res) => {
  try {
    const { tipo } = req.body;
    const PDFDocument = require('pdfkit');
    const QRCode = require('qrcode');
    
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte_${tipo}.pdf"`);
    doc.pipe(res);
    
    // Encabezado con QR
    doc.fontSize(20).text(`Reporte de ${tipo}s`, { align: 'center' });
    
    // Generar QR del reporte
    const qrCode = await QRCode.toDataURL(
      `Reporte-${tipo}-${new Date().toISOString()}`
    );
    
    // Añadir QR al PDF
    doc.image(Buffer.from(qrCode.split(',')[1], 'base64'), 
      doc.page.width - 120, 20, { width: 100 });
    
    // Resto del contenido...
    doc.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

### D. Autenticación con Google OAuth2

```javascript
// En index.js (después de configuración inicial)
const GoogleStrategy = require('passport-google-oauth20').Strategy;

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Buscar o crear usuario con Google ID
      const email = profile.emails[0].value;
      
      let user = await pool.query(
        'SELECT * FROM usuarios WHERE email = $1', 
        [email]
      );
      
      if (user.rows.length === 0) {
        // Crear nuevo usuario
        user = await pool.query(
          `INSERT INTO usuarios (email, nombre, google_id) 
           VALUES ($1, $2, $3) RETURNING id`,
          [email, profile.displayName, profile.id]
        );
      }
      
      return done(null, user.rows[0]);
    } catch (error) {
      return done(error);
    }
  }
));

// Rutas de autenticación Google
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // Generar JWT para el usuario
    const token = jwt.sign(
      { id: req.user.id, email: req.user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Redirigir al dashboard con token
    res.redirect(`/?token=${token}`);
  }
);
```

---

### E. Manejo de Sesiones con Express-Session

```javascript
// En index.js (después de configurar CORS y bodyParser)
const session = require('express-session');
const cookieParser = require('cookie-parser');
const passport = require('passport');

app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET || 'tu-secreto-aqui',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // HTTPS en producción
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Serializar usuario para sesión
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    done(null, user.rows[0]);
  } catch (error) {
    done(error);
  }
});
```

---

## 📋 Variables de Entorno Requeridas

Agrega a tu archivo `.env`:

```env
# Existentes
JWT_SECRET=tu_secreto_jwt
DATABASE_URL=postgresql://usuario:pass@localhost:5432/inventario

# Nuevas para OAuth2 Google
GOOGLE_CLIENT_ID=tu_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu_client_secret

# Para sesiones
SESSION_SECRET=tu_secreto_sesion

# Para archivos subidos
UPLOAD_DIR=public/uploads
MAX_FILE_SIZE=5242880  # 5MB en bytes

# Node environment
NODE_ENV=development
```

---

## 🚀 Ejemplos de Implementación Completa

### Ejemplo 1: Sistema de Cargas de Productos

```javascript
// routes/productos.js
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: 'public/uploads/productos/',
  filename: (req, file, cb) => {
    const id = Date.now();
    cb(null, `prod-${id}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (JPG, PNG, WebP)'));
    }
  }
});

router.post('/productos/upload', verificarToken, upload.single('imagen'), 
  async (req, res) => {
    try {
      const { producto_id } = req.body;
      const imagePath = `/uploads/productos/${req.file.filename}`;
      
      await pool.query(
        'UPDATE productos SET imagen_url = $1 WHERE id = $2',
        [imagePath, producto_id]
      );
      
      res.json({ 
        success: true,
        imagen_url: imagePath,
        mensaje: 'Imagen cargada exitosamente'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);
```

---

### Ejemplo 2: Reportes PDF con Códigos QR

```javascript
// routes/reportes.js
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

router.post('/reportes/detallado', verificarToken, async (req, res) => {
  try {
    const { tipo, fecha_inicio, fecha_fin } = req.body;
    
    // Obtener datos del reporte
    const result = await pool.query(`
      SELECT m.*, p.nombre, p.sku, u.email
      FROM movimientos m
      JOIN productos p ON m.producto_id = p.id
      JOIN usuarios u ON m.usuario_id = u.id
      WHERE m.tipo = $1 
        AND m.fecha >= $2 
        AND m.fecha <= $3
      ORDER BY m.fecha DESC
    `, [tipo, fecha_inicio, fecha_fin]);
    
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 
      `attachment; filename="reporte-${tipo}-${Date.now()}.pdf"`);
    
    doc.pipe(res);
    
    // Encabezado
    doc.fontSize(24).font('Helvetica-Bold')
      .text('REPORTE DETALLADO', { align: 'center' });
    
    doc.fontSize(12).font('Helvetica')
      .text(`Tipo: ${tipo}`, { align: 'center' })
      .text(`Período: ${fecha_inicio} a ${fecha_fin}`, { align: 'center' });
    
    // QR del reporte
    const qrString = JSON.stringify({ 
      tipo, fecha_inicio, fecha_fin, 
      generado: new Date().toISOString()
    });
    const qrImage = await QRCode.toDataURL(qrString);
    const qrBuffer = Buffer.from(qrImage.split(',')[1], 'base64');
    
    doc.moveTo(doc.page.width - 120, 60)
      .lineTo(doc.page.width - 20, 60)
      .stroke();
    
    doc.image(qrBuffer, doc.page.width - 120, 70, { width: 100 });
    
    // Tabla con datos
    doc.moveTo(40, 200).lineTo(doc.page.width - 40, 200).stroke();
    
    let yPosition = 220;
    
    result.rows.forEach(mov => {
      doc.fontSize(10)
        .text(`${mov.fecha} | ${mov.nombre} | SKU: ${mov.sku}`, 40, yPosition)
        .text(`Cantidad: ${mov.cantidad} | Usuario: ${mov.email}`, 40, yPosition + 15);
      
      yPosition += 35;
      
      if (yPosition > doc.page.height - 60) {
        doc.addPage();
        yPosition = 60;
      }
    });
    
    // Totales
    doc.moveTo(40, yPosition).lineTo(doc.page.width - 40, yPosition).stroke();
    yPosition += 15;
    
    const totalCant = result.rows.reduce((sum, m) => sum + m.cantidad, 0);
    doc.fontSize(12).font('Helvetica-Bold')
      .text(`Total de movimientos: ${result.rows.length}`, 40, yPosition)
      .text(`Cantidad total: ${totalCant} unidades`, 40, yPosition + 20);
    
    doc.end();
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## ✅ Estado Actual

**Sistema integrado correctamente:**
- ✅ Todas las dependencias instaladas
- ✅ Funcionalidad JWT original preservada
- ✅ Listo para expandir con nuevas características
- ✅ Passport, Multer, QRCode listos para usar

**Próximos pasos opcionales:**
- Implementar carga de imágenes de productos
- Agregar autenticación con Google
- Generar códigos QR para cada producto
- Mejorar reportes con imágenes y códigos QR
- Implementar sesiones de usuario persistentes

---

## 📝 Notas Importantes

1. **Compatibilidad**: Todas las funcionalidades nuevas son opcionales y no interfieren con el código existente
2. **Seguridad**: Asegúrate de validar todos los datos de entrada, especialmente con Multer
3. **Rendimiento**: Para reportes grandes con muchas imágenes, considera usar streaming
4. **Almacenamiento**: Crea la carpeta `public/uploads/` antes de usar Multer

---

**Fecha de actualización:** Enero 26, 2026
**Versión del sistema:** 1.0.0 + Nuevas Funcionalidades
