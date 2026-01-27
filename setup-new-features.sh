#!/bin/bash
# setup-new-features.sh
# Script para configurar las nuevas funcionalidades

echo "🔧 Configurando nuevas funcionalidades..."

# Crear directorio para uploads
mkdir -p public/uploads/productos
mkdir -p public/uploads/documentos
echo "✅ Directorios de carga creados"

# Mostrar dependencias instaladas
echo ""
echo "📦 Dependencias instaladas:"
echo "  ✓ passport@0.7.0 - Autenticación modular"
echo "  ✓ passport-local@1.0.0 - Estrategia local"
echo "  ✓ passport-google-oauth20@2.0.0 - OAuth2 Google"
echo "  ✓ express-session@1.17.3 - Manejo de sesiones"
echo "  ✓ cookie-parser@1.4.6 - Parser de cookies"
echo "  ✓ multer@2.0.2 - Carga de archivos"
echo "  ✓ pdfkit@0.14.0 - Generación de PDFs"
echo "  ✓ qrcode@1.5.3 - Códigos QR"

echo ""
echo "🚀 Sistema listo para las nuevas funcionalidades"
echo ""
echo "📚 Consulta NUEVAS_FUNCIONALIDADES.md para ejemplos de uso"
