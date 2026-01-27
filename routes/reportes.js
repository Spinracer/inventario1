const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const { pool } = require('../config/database');
const { verificarToken, verificarPermiso } = require('../middleware/auth');

// ========== REPORTE DE MOVIMIENTOS CON RANGO DE FECHAS ==========
router.post('/movimientos-rango', verificarToken, verificarPermiso('generar_reportes'), async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, tipo, categoria_id, usuario_id } = req.body;
    
    let query = `
      SELECT m.*, 
             p.nombre as producto_nombre, 
             p.sku, 
             p.precio,
             c.nombre as categoria_nombre,
             u.nombre as usuario_nombre
      FROM movimientos m 
      JOIN productos p ON m.producto_id = p.id 
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (fecha_inicio) {
      query += ` AND m.created_at >= $${paramIndex}`;
      params.push(fecha_inicio);
      paramIndex++;
    }
    
    if (fecha_fin) {
      query += ` AND m.created_at <= $${paramIndex}`;
      params.push(fecha_fin + ' 23:59:59');
      paramIndex++;
    }
    
    if (tipo && tipo !== 'TODOS') {
      query += ` AND m.tipo = $${paramIndex}`;
      params.push(tipo);
      paramIndex++;
    }
    
    if (categoria_id) {
      query += ` AND p.categoria_id = $${paramIndex}`;
      params.push(categoria_id);
      paramIndex++;
    }
    
    if (usuario_id) {
      query += ` AND m.usuario_id = $${paramIndex}`;
      params.push(usuario_id);
      paramIndex++;
    }
    
    query += ` ORDER BY m.created_at DESC`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en reporte de movimientos:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudo generar el reporte' 
    });
  }
});

// ========== GENERAR PDF DE MOVIMIENTOS ==========
router.post('/movimientos-pdf', verificarToken, verificarPermiso('generar_reportes'), async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, tipo, movimientos } = req.body;
    
    const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
    
    // Headers para descarga
    res.setHeader('Content-Type', 'application/pdf');
    const filename = `Reporte_Movimientos_${fecha_inicio}_${fecha_fin}.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    doc.pipe(res);
    
    // Encabezado del documento
    doc.fontSize(20).font('Helvetica-Bold').text('REPORTE DE MOVIMIENTOS', { align: 'center' });
    doc.moveDown(0.5);
    
    doc.fontSize(10).font('Helvetica');
    doc.text(`Tipo: ${tipo || 'Todos'}`, { align: 'center' });
    doc.text(`Período: ${fecha_inicio} al ${fecha_fin}`, { align: 'center' });
    doc.text(`Generado por: ${req.usuario.nombre}`, { align: 'center' });
    doc.text(`Fecha de generación: ${new Date().toLocaleString('es-HN')}`, { align: 'center' });
    doc.moveDown(1);
    
    // Línea separadora
    doc.moveTo(40, doc.y).lineTo(572, doc.y).stroke();
    doc.moveDown(1);
    
    // Tabla de movimientos
    const tableTop = doc.y;
    const itemHeight = 20;
    
    // Headers de tabla
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Fecha', 40, tableTop, { width: 70, continued: false });
    doc.text('Producto', 110, tableTop, { width: 120, continued: false });
    doc.text('SKU', 230, tableTop, { width: 60, continued: false });
    doc.text('Tipo', 290, tableTop, { width: 50, continued: false });
    doc.text('Cant.', 340, tableTop, { width: 40, continued: false });
    doc.text('Precio', 380, tableTop, { width: 50, continued: false });
    doc.text('Subtotal', 430, tableTop, { width: 60, continued: false });
    doc.text('Usuario', 490, tableTop, { width: 80, continued: false });
    
    doc.moveTo(40, tableTop + 15).lineTo(572, tableTop + 15).stroke();
    
    let yPosition = tableTop + itemHeight;
    let totalCantidad = 0;
    let totalValor = 0;
    
    doc.font('Helvetica').fontSize(8);
    
    movimientos.forEach((mov, index) => {
      // Verificar si necesitamos nueva página
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 40;
        
        // Repetir headers
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Fecha', 40, yPosition, { width: 70, continued: false });
        doc.text('Producto', 110, yPosition, { width: 120, continued: false });
        doc.text('SKU', 230, yPosition, { width: 60, continued: false });
        doc.text('Tipo', 290, yPosition, { width: 50, continued: false });
        doc.text('Cant.', 340, yPosition, { width: 40, continued: false });
        doc.text('Precio', 380, yPosition, { width: 50, continued: false });
        doc.text('Subtotal', 430, yPosition, { width: 60, continued: false });
        doc.text('Usuario', 490, yPosition, { width: 80, continued: false });
        
        doc.moveTo(40, yPosition + 15).lineTo(572, yPosition + 15).stroke();
        yPosition += itemHeight;
        doc.font('Helvetica').fontSize(8);
      }
      
      const precio = parseFloat(mov.precio) || 0;
      const subtotal = mov.cantidad * precio;
      totalCantidad += mov.cantidad;
      totalValor += subtotal;
      
      const fecha = new Date(mov.created_at).toLocaleDateString('es-HN');
      
      doc.text(fecha, 40, yPosition, { width: 70, continued: false });
      doc.text(mov.producto_nombre.substring(0, 20), 110, yPosition, { width: 120, continued: false });
      doc.text(mov.sku || 'N/A', 230, yPosition, { width: 60, continued: false });
      doc.text(mov.tipo, 290, yPosition, { width: 50, continued: false });
      doc.text(mov.cantidad.toString(), 340, yPosition, { width: 40, align: 'right', continued: false });
      doc.text(`$${precio.toFixed(2)}`, 380, yPosition, { width: 50, align: 'right', continued: false });
      doc.text(`$${subtotal.toFixed(2)}`, 430, yPosition, { width: 60, align: 'right', continued: false });
      doc.text((mov.usuario_nombre || 'N/A').substring(0, 15), 490, yPosition, { width: 80, continued: false });
      
      yPosition += itemHeight;
      
      // Línea separadora cada 5 filas
      if ((index + 1) % 5 === 0) {
        doc.moveTo(40, yPosition).lineTo(572, yPosition).strokeOpacity(0.3).stroke().strokeOpacity(1);
      }
    });
    
    // Totales
    doc.moveDown(2);
    doc.moveTo(40, doc.y).lineTo(572, doc.y).lineWidth(2).stroke().lineWidth(1);
    doc.moveDown(0.5);
    
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(`Total de movimientos: ${movimientos.length}`, 40, doc.y);
    doc.text(`Cantidad total: ${totalCantidad} unidades`, 40, doc.y);
    doc.text(`Valor total: $${totalValor.toFixed(2)}`, 40, doc.y, { underline: true });
    
    // Footer
    doc.fontSize(8).font('Helvetica').fillColor('gray');
    doc.text(
      'Sistema de Gestión de Inventario - Reporte generado automáticamente',
      40,
      750,
      { align: 'center' }
    );
    
    doc.end();
  } catch (error) {
    console.error('Error generando PDF:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudo generar el PDF' 
    });
  }
});

// ========== REPORTE DE GASTOS QUINCENAL ==========
router.post('/gastos-quincenal', verificarToken, verificarPermiso('generar_reportes'), async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.body;
    
    const result = await pool.query(`
      SELECT 
        m.*,
        p.nombre as producto_nombre,
        p.sku,
        p.precio,
        c.nombre as categoria_nombre,
        (m.cantidad * p.precio) as subtotal
      FROM movimientos m
      JOIN productos p ON m.producto_id = p.id
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE m.tipo = 'SALIDA'
        AND m.created_at >= $1
        AND m.created_at <= $2
      ORDER BY m.created_at DESC
    `, [fecha_inicio, fecha_fin + ' 23:59:59']);
    
    const movimientos = result.rows;
    const totalGasto = movimientos.reduce((sum, m) => sum + parseFloat(m.subtotal || 0), 0);
    const totalUnidades = movimientos.reduce((sum, m) => sum + parseInt(m.cantidad), 0);
    
    // Agrupar por categoría
    const porCategoria = {};
    movimientos.forEach(m => {
      const cat = m.categoria_nombre || 'Sin Categoría';
      if (!porCategoria[cat]) {
        porCategoria[cat] = { cantidad: 0, total: 0 };
      }
      porCategoria[cat].cantidad += m.cantidad;
      porCategoria[cat].total += parseFloat(m.subtotal || 0);
    });
    
    res.json({
      movimientos,
      resumen: {
        total_movimientos: movimientos.length,
        total_unidades: totalUnidades,
        total_gasto: totalGasto,
        por_categoria: porCategoria,
        periodo: { inicio: fecha_inicio, fin: fecha_fin }
      }
    });
  } catch (error) {
    console.error('Error en reporte de gastos:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudo generar el reporte de gastos' 
    });
  }
});

// ========== REPORTE DE ASIGNACIONES POR PERSONAL/DESTINO ==========
router.get('/asignaciones/:tipo/:id', verificarToken, verificarPermiso('generar_reportes'), async (req, res) => {
  try {
    const { tipo, id } = req.params; // tipo: 'personal' o 'destino'
    
    let query = `
      SELECT 
        a.*,
        p.nombre as producto_nombre,
        p.sku,
        p.precio,
        (a.cantidad * p.precio) as valor_total
      FROM asignaciones a
      JOIN productos p ON a.producto_id = p.id
      WHERE a.estado = 'asignado'
    `;
    
    if (tipo === 'personal') {
      query += ` AND a.personal_id = $1`;
    } else {
      query += ` AND a.destino_id = $1`;
    }
    
    query += ` ORDER BY a.created_at DESC`;
    
    const result = await pool.query(query, [id]);
    
    const valorTotal = result.rows.reduce((sum, a) => sum + parseFloat(a.valor_total || 0), 0);
    const cantidadTotal = result.rows.reduce((sum, a) => sum + parseInt(a.cantidad), 0);
    
    res.json({
      asignaciones: result.rows,
      resumen: {
        total_equipos: result.rows.length,
        cantidad_total: cantidadTotal,
        valor_total: valorTotal
      }
    });
  } catch (error) {
    console.error('Error en reporte de asignaciones:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudo generar el reporte' 
    });
  }
});

// ========== BÚSQUEDA AVANZADA DE PRODUCTOS ==========
router.post('/buscar-productos', verificarToken, verificarPermiso('ver_productos'), async (req, res) => {
  try {
    const { termino, categoria_id, proveedor_id, stock_minimo, stock_maximo, precio_min, precio_max } = req.body;
    
    let query = `
      SELECT 
        p.*,
        c.nombre as categoria_nombre,
        pr.nombre as proveedor_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
      WHERE p.activo = true
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (termino) {
      query += ` AND (
        p.nombre ILIKE $${paramIndex} OR 
        p.sku ILIKE $${paramIndex} OR 
        p.descripcion ILIKE $${paramIndex}
      )`;
      params.push(`%${termino}%`);
      paramIndex++;
    }
    
    if (categoria_id) {
      query += ` AND p.categoria_id = $${paramIndex}`;
      params.push(categoria_id);
      paramIndex++;
    }
    
    if (proveedor_id) {
      query += ` AND p.proveedor_id = $${paramIndex}`;
      params.push(proveedor_id);
      paramIndex++;
    }
    
    if (stock_minimo !== undefined) {
      query += ` AND p.stock >= $${paramIndex}`;
      params.push(stock_minimo);
      paramIndex++;
    }
    
    if (stock_maximo !== undefined) {
      query += ` AND p.stock <= $${paramIndex}`;
      params.push(stock_maximo);
      paramIndex++;
    }
    
    if (precio_min !== undefined) {
      query += ` AND p.precio >= $${paramIndex}`;
      params.push(precio_min);
      paramIndex++;
    }
    
    if (precio_max !== undefined) {
      query += ` AND p.precio <= $${paramIndex}`;
      params.push(precio_max);
      paramIndex++;
    }
    
    query += ` ORDER BY p.nombre LIMIT 100`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en búsqueda avanzada:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudo realizar la búsqueda' 
    });
  }
});

// ========== ESTADÍSTICAS GENERALES ==========
router.get('/estadisticas', verificarToken, verificarPermiso('ver_reportes'), async (req, res) => {
  try {
    const [
      totalProductos,
      valorInventario,
      movimientosHoy,
      stockBajo,
      productosPopulares
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM productos WHERE activo = true'),
      pool.query('SELECT SUM(stock * precio) as valor FROM productos WHERE activo = true'),
      pool.query(`SELECT COUNT(*) as total FROM movimientos WHERE DATE(created_at) = CURRENT_DATE`),
      pool.query('SELECT COUNT(*) as total FROM productos WHERE stock <= stock_minimo AND activo = true'),
      pool.query(`
        SELECT 
          p.nombre,
          p.sku,
          COUNT(m.id) as total_movimientos,
          SUM(CASE WHEN m.tipo = 'SALIDA' THEN m.cantidad ELSE 0 END) as total_salidas
        FROM productos p
        LEFT JOIN movimientos m ON p.id = m.producto_id
        WHERE m.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY p.id, p.nombre, p.sku
        ORDER BY total_movimientos DESC
        LIMIT 10
      `)
    ]);
    
    res.json({
      total_productos: parseInt(totalProductos.rows[0].total),
      valor_inventario: parseFloat(valorInventario.rows[0].valor || 0),
      movimientos_hoy: parseInt(movimientosHoy.rows[0].total),
      productos_stock_bajo: parseInt(stockBajo.rows[0].total),
      productos_populares: productosPopulares.rows
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudieron obtener las estadísticas' 
    });
  }
});

module.exports = router;