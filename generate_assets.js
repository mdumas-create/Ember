/**
 * Ember Asset Generation Script
 * 
 * Este script utiliza la API de Canvas (en entorno web o Node con node-canvas)
 * para generar los assets visuales de la aplicación Ember.
 * 
 * Instrucciones:
 * 1. Abre este código en un editor con soporte para HTML/JS.
 * 2. Ejecuta en el navegador para ver y descargar las imágenes.
 */

function generateEmberIcon(canvasId, size = 1024) {
  const canvas = document.getElementById(canvasId) || document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // 1. Fondo con Gradiente Radial
  const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  gradient.addColorStop(0, '#F59E0B'); // Ámbar
  gradient.addColorStop(1, '#E07A5F'); // Coral terracota
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
  ctx.fill();

  // 2. Llama Estilizada
  ctx.fillStyle = '#FDF4E3'; // Crema claro
  
  // Dibujamos la llama (proporcional al tamaño)
  const scale = size / 48;
  ctx.save();
  ctx.translate(size/2, size/2);
  ctx.scale(scale, scale);
  ctx.translate(-24, -24); // Centrar el path de 48x48

  const p = new Path2D("M24 10C24 10 16 18 16 26C16 31 19.5 35 24 35C28.5 35 32 31 32 26C32 18 24 10 24 10ZM20 31C19 30 18.5 28.5 18.5 27C18.5 24 21 22 21 22C21 22 20.5 24 20.5 26C20.5 27.5 21.5 29 23 29.5C21.5 30 20.5 30.5 20 31Z");
  ctx.fill(p);
  ctx.restore();

  return canvas.toDataURL('image/png');
}

console.log("Generando iconos de Ember...");
// Para usar en navegador: document.body.appendChild(canvas);
