#!/usr/bin/env node

/**
 * Script para probar rápidamente el módulo de TikTok Live Viewers
 * 
 * Uso:
 * npx ts-node quick-test.ts [username]
 * 
 * Ejemplo:
 * npx ts-node quick-test.ts officialgeilegisela
 */

import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

const username = process.argv[2] || 'officialgeilegisela';

console.log(`\n📱 Conectando a TikTok Live: @${username}\n`);
console.log('⏳ Esperando datos...\n');

const connection = new TikTokLiveConnection(username);

// Timeout de 20 segundos
const timeout = setTimeout(() => {
  console.log('❌ Timeout: No se pudo obtener datos en 20 segundos');
  if (connection.isConnected) {
    connection.disconnect();
  }
  process.exit(1);
}, 20000);

// Cuando se conecta
connection.on(ControlEvent.CONNECTED, (state) => {
  console.log(`✅ Conectado a ${username}`);
  console.log(`   Room ID: ${state.roomId}`);
  console.log(`   Intenta obtener viewers...\n`);
});

// Evento principal: obtener viewers
connection.on(WebcastEvent.ROOM_USER, (data) => {
  console.log('✨ ¡Datos obtenidos!\n');
  console.log('═══════════════════════════════════════');
  console.log(`📊 Usuario: @${username}`);
  console.log(`👥 Espectadores: ${data.viewerCount || 0}`);
  console.log(`⏰ Timestamp: ${new Date().toLocaleString()}`);
  console.log('═══════════════════════════════════════\n');

  if (data.ranksList && data.ranksList.length > 0) {
    console.log('🏆 Top Gifters:');
    data.ranksList.slice(0, 3).forEach((gifter, idx) => {
      console.log(
        `   ${idx + 1}. ${gifter.user?.nickname || 'Unknown'} - ${gifter.coinCount} coins`,
      );
    });
    console.log();
  }

  clearTimeout(timeout);
  connection.disconnect();
  process.exit(0);
});

// Manejar errores
connection.on(ControlEvent.ERROR, ({ info, exception }) => {
  console.log('❌ Error:', info);
  if (exception) {
    console.log('   Detalles:', exception);
  }
  clearTimeout(timeout);
  process.exit(1);
});

// Intentar conectar
connection
  .connect()
  .then(() => {
    console.log('👍 Conexión iniciada\n');
  })
  .catch((error) => {
    console.log('❌ No se pudo conectar:', error.message);
    console.log('\n💡 Posibles razones:');
    console.log('   - El usuario no existe');
    console.log('   - El usuario no está en vivo');
    console.log('   - Problema de conexión a internet\n');
    clearTimeout(timeout);
    process.exit(1);
  });
