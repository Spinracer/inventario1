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
    doc.text('Fecha', 40, tableTop, { width: 65, continued: false });
    doc.text('Producto', 105, tableTop, { width: 110, continued: false });
    doc.text('SKU', 215, tableTop, { width: 55, continued: false });
    doc.text('Tipo', 270, tableTop, { width: 45, continued: false });
    doc.text('Cant.', 315, tableTop, { width: 35, continued: false });
    doc.text('Precio', 350, tableTop, { width: 55, continued: false });
    doc.text('Subtotal', 405, tableTop, { width: 60, continued: false });
    doc.text('Usuario', 475, tableTop, { width: 95, continued: false });
    
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
        doc.text('Fecha', 40, yPosition, { width: 65, continued: false });
        doc.text('Producto', 105, yPosition, { width: 110, continued: false });
        doc.text('SKU', 215, yPosition, { width: 55, continued: false });
        doc.text('Tipo', 270, yPosition, { width: 45, continued: false });
        doc.text('Cant.', 315, yPosition, { width: 35, continued: false });
        doc.text('Precio', 350, yPosition, { width: 55, continued: false });
        doc.text('Subtotal', 405, yPosition, { width: 60, continued: false });
        doc.text('Usuario', 475, yPosition, { width: 95, continued: false });
        
        doc.moveTo(40, yPosition + 15).lineTo(572, yPosition + 15).stroke();
        yPosition += itemHeight;
        doc.font('Helvetica').fontSize(8);
      }
      
      const precio = parseFloat(mov.precio) || 0;
      const subtotal = mov.cantidad * precio;
      totalCantidad += mov.cantidad;
      totalValor += subtotal;
      
      const fecha = new Date(mov.created_at).toLocaleDateString('es-HN');
      
      doc.text(fecha, 40, yPosition, { width: 65, continued: false });
      doc.text(mov.producto_nombre.substring(0, 18), 105, yPosition, { width: 110, continued: false });
      doc.text(mov.sku || 'N/A', 215, yPosition, { width: 55, continued: false });
      doc.text(mov.tipo, 270, yPosition, { width: 45, continued: false });
      doc.text(mov.cantidad.toString(), 315, yPosition, { width: 35, align: 'right', continued: false });
      doc.text(`L.${precio.toFixed(2)}`, 350, yPosition, { width: 55, align: 'right', continued: false });
      doc.text(`L.${subtotal.toFixed(2)}`, 405, yPosition, { width: 60, align: 'right', continued: false });
      doc.text((mov.usuario_nombre || 'N/A').substring(0, 18), 475, yPosition, { width: 95, continued: false });
      
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
    doc.text(`Valor total: L.${totalValor.toFixed(2)}`, 40, doc.y, { underline: true });
    
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

// ========== GENERAR PDF DE GASTOS ==========
router.post('/gastos-pdf', verificarToken, verificarPermiso('generar_reportes'), async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.body;
    
    const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
    const buffers = [];
    
    res.setHeader('Content-Type', 'application/pdf');
    const filename = `Reporte_Gastos_${fecha_inicio}_${fecha_fin}.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.end(pdfData);
    });
    
    // Obtener datos
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
      ORDER BY c.nombre, m.created_at DESC
    `, [fecha_inicio, fecha_fin + ' 23:59:59']);
    
    const movimientos = result.rows;
    const totalGasto = movimientos.reduce((sum, m) => sum + parseFloat(m.subtotal || 0), 0);
    const totalUnidades = movimientos.reduce((sum, m) => sum + parseInt(m.cantidad), 0);
    
    // Agrupar por categoría
    const porCategoria = {};
    movimientos.forEach(m => {
      const cat = m.categoria_nombre || 'Sin Categoría';
      if (!porCategoria[cat]) {
        porCategoria[cat] = { cantidad: 0, total: 0, items: [] };
      }
      porCategoria[cat].cantidad += m.cantidad;
      porCategoria[cat].total += parseFloat(m.subtotal || 0);
      porCategoria[cat].items.push(m);
    });
    
    // === ENCABEZADO ===
    doc.fontSize(20).font('Helvetica-Bold').text('REPORTE DE GASTOS', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica').text(`Período: ${fecha_inicio} al ${fecha_fin}`, { align: 'center' });
    doc.fontSize(10).text(`Generado: ${new Date().toLocaleString('es-ES')}`, { align: 'center' });
    doc.moveDown();
    
    // === RESUMEN GENERAL ===
    doc.fontSize(14).font('Helvetica-Bold').text('RESUMEN GENERAL');
    doc.moveDown(0.5);
    
    const startX = 50;
    doc.fontSize(11).font('Helvetica');
    doc.text(`Total de Movimientos: ${movimientos.length}`, startX);
    doc.text(`Total de Unidades: ${totalUnidades}`, startX);
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text(`TOTAL GASTO: L.${totalGasto.toFixed(2)}`, startX);
    doc.moveDown();
    
    // === GASTOS POR CATEGORÍA ===
    doc.fontSize(14).font('Helvetica-Bold').text('GASTOS POR CATEGORÍA');
    doc.moveDown(0.5);
    
    // Tabla de categorías
    let y = doc.y;
    const colWidths = [200, 100, 150];
    
    // Encabezados de tabla
    doc.fontSize(10).font('Helvetica-Bold');
    doc.rect(startX, y, 450, 20).fill('#4f46e5');
    doc.fillColor('white');
    doc.text('Categoría', startX + 5, y + 5, { width: colWidths[0] });
    doc.text('Unidades', startX + colWidths[0] + 5, y + 5, { width: colWidths[1] });
    doc.text('Total Gasto', startX + colWidths[0] + colWidths[1] + 5, y + 5, { width: colWidths[2] });
    y += 20;
    
    doc.fillColor('black').font('Helvetica');
    let rowColor = true;
    
    Object.entries(porCategoria).forEach(([cat, datos]) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      
      if (rowColor) {
        doc.rect(startX, y, 450, 18).fill('#f3f4f6');
        doc.fillColor('black');
      }
      rowColor = !rowColor;
      
      doc.fontSize(10);
      doc.text(cat, startX + 5, y + 4, { width: colWidths[0] });
      doc.text(datos.cantidad.toString(), startX + colWidths[0] + 5, y + 4, { width: colWidths[1] });
      doc.text(`L.${datos.total.toFixed(2)}`, startX + colWidths[0] + colWidths[1] + 5, y + 4, { width: colWidths[2] });
      y += 18;
    });
    
    doc.moveDown(2);
    
    // === DETALLE DE MOVIMIENTOS ===
    if (movimientos.length > 0) {
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').text('DETALLE DE MOVIMIENTOS');
      doc.moveDown(0.5);
      
      y = doc.y;
      const detailCols = [40, 140, 70, 80, 80, 90];
      
      // Encabezados
      doc.fontSize(9).font('Helvetica-Bold');
      doc.rect(startX, y, 500, 18).fill('#4f46e5');
      doc.fillColor('white');
      doc.text('#', startX + 3, y + 4, { width: detailCols[0] });
      doc.text('Producto', startX + detailCols[0] + 3, y + 4, { width: detailCols[1] });
      doc.text('SKU', startX + detailCols[0] + detailCols[1] + 3, y + 4, { width: detailCols[2] });
      doc.text('Cantidad', startX + detailCols[0] + detailCols[1] + detailCols[2] + 3, y + 4, { width: detailCols[3] });
      doc.text('Precio Unit.', startX + detailCols[0] + detailCols[1] + detailCols[2] + detailCols[3] + 3, y + 4, { width: detailCols[4] });
      doc.text('Subtotal', startX + detailCols[0] + detailCols[1] + detailCols[2] + detailCols[3] + detailCols[4] + 3, y + 4, { width: detailCols[5] });
      y += 18;
      
      doc.fillColor('black').font('Helvetica');
      rowColor = true;
      
      movimientos.slice(0, 50).forEach((m, index) => {
        if (y > 720) {
          doc.addPage();
          y = 50;
        }
        
        if (rowColor) {
          doc.rect(startX, y, 500, 16).fill('#f9fafb');
          doc.fillColor('black');
        }
        rowColor = !rowColor;
        
        doc.fontSize(8);
        doc.text((index + 1).toString(), startX + 3, y + 4, { width: detailCols[0] });
        doc.text(m.producto_nombre?.substring(0, 25) || 'N/A', startX + detailCols[0] + 3, y + 4, { width: detailCols[1] });
        doc.text(m.sku || 'N/A', startX + detailCols[0] + detailCols[1] + 3, y + 4, { width: detailCols[2] });
        doc.text(m.cantidad.toString(), startX + detailCols[0] + detailCols[1] + detailCols[2] + 3, y + 4, { width: detailCols[3] });
        doc.text(`L.${parseFloat(m.precio || 0).toFixed(2)}`, startX + detailCols[0] + detailCols[1] + detailCols[2] + detailCols[3] + 3, y + 4, { width: detailCols[4] });
        doc.text(`L.${parseFloat(m.subtotal || 0).toFixed(2)}`, startX + detailCols[0] + detailCols[1] + detailCols[2] + detailCols[3] + detailCols[4] + 3, y + 4, { width: detailCols[5] });
        y += 16;
      });
      
      if (movimientos.length > 50) {
        doc.moveDown();
        doc.fontSize(9).text(`... y ${movimientos.length - 50} movimientos más`, { align: 'center' });
      }
    }
    
    // === PIE DE PÁGINA ===
    doc.moveDown(2);
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`TOTAL GENERAL: L.${totalGasto.toFixed(2)}`, { align: 'right' });
    
    doc.end();
    
  } catch (error) {
    console.error('Error generando PDF de gastos:', error);
    res.status(500).json({ 
      error: 'Error del servidor',
      mensaje: 'No se pudo generar el PDF de gastos' 
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