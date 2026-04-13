# 🎥 Tiempo Real - TikTok Live Viewers

Guía completa para obtener actualizaciones de viewers en **tiempo real** sin hacer GET constantemente.

## 📋 Opciones Disponibles

Hay **3 formas** de obtener viewers en tiempo real:

### 1. 🌐 Dashboard Web Interactivo (MÁS FÁCIL)

**Accede desde el navegador:**
```
http://localhost:3000/realtime-viewer.html
```

✨ Características:
- ✅ Interfaz visual hermosa
- ✅ Actualizaciones cada 5 segundos
- ✅ Historial de cambios
- ✅ Estado en vivo/offline
- ✅ Sin necesidad de código

Simplemente ingresa el nombre de usuario y ¡listo!

---

### 2. 🔌 Server-Sent Events (SSE) - Recomendado

Ideal para aplicaciones web que necesitan actualizaciones en tiempo real.

#### Endpoint

```
GET /tiktok/live?username=USUARIO
```

#### Ejemplo con JavaScript

```javascript
// Conectar al stream en tiempo real
const eventSource = new EventSource('/tiktok/live?username=officialgeilegisela');

// Recibir actualizaciones
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  console.log(`Viewers: ${data.viewerCount}`);
  console.log(`En vivo: ${data.isLive}`);
  console.log(`Actualización #${data.updateNumber}`);
};

// Cerrar la conexión
eventSource.close();
```

#### Formato de Respuesta

```json
{
  "type": "viewers_update",
  "username": "officialgeilegisela",
  "viewerCount": 15234,
  "isLive": true,
  "timestamp": "2026-04-13T10:30:45.123Z",
  "updateNumber": 5
}
```

#### Ejemplo con cURL

```bash
curl "http://localhost:3000/tiktok/live?username=officialgeilegisela"
```

---

### 3. 📡 RxJS Observable

Ideal para aplicaciones NestJS/Angular.

#### Uso en Controlador

```typescript
import { Controller, Get, Query, Res } from '@nestjs/common';
import { interval } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Response } from 'express';

@Controller('my-api')
export class MyController {
  constructor(private tiktokService: TikTokLiveService) {}

  @Get('live-updates')
  liveUpdates(@Query('username') username: string) {
    return interval(5000).pipe(
      switchMap(() => this.tiktokService.getViewerCount(username)),
      map(data => ({
        viewerCount: data.viewerCount,
        isLive: data.isLive,
        timestamp: data.timestamp,
      }))
    );
  }
}
```

---

## 🚀 Quick Start - Tiempo Real

### Paso 1: Iniciar el servidor

```bash
npm run start:dev
```

### Paso 2: Abrir el dashboard (MÁS FÁCIL)

```
http://localhost:3000/realtime-viewer.html
```

O si quieres hacerlo con código, usa SSE:

### Paso 2 (Alternativa): Conectar con JavaScript

```javascript
const es = new EventSource('http://localhost:3000/tiktok/live?username=officialgeilegisela');

es.onmessage = (e) => {
  const data = JSON.parse(e.data);
  console.log(`👥 ${data.viewerCount} viewers`);
};
```

---

## 📊 Comparación: GET vs Tiempo Real

| Característica | GET | SSE (Tiempo Real) |
|---|---|---|
| Actualización | Bajo demanda | Automática cada 5s |
| Latencia | Depende del cliente | Mínima (~0s) |
| Tráfico | Eficiente | Continuos |
| Complejidad | Fácil | Media |
| Mejor para | Consultas ocasionales | Monitoreo constante |

---

## 🎯 Casos de Uso

### Usar GET cuando:
- ✅ Necesitas datos puntuales
- ✅ No necesitas updates constantes
- ✅ Quieres controlar cuándo se actualizan

**Endpoint:**
```bash
GET /tiktok/viewers?username=USER
```

### Usar Tiempo Real (SSE) cuando:
- ✅ Necesitas actualizaciones automáticas
- ✅ Quieres un dashboard en vivo
- ✅ Necesitas reaccionar a cambios en tiempo real

**Endpoint:**
```bash
GET /tiktok/live?username=USER
```

---

## 💡 Ejemplos Prácticos

### Ejemplo 1: Dashboard HTML Simple

```html
<div id="viewers">0</div>

<script>
  const es = new EventSource('/tiktok/live?username=officialgeilegisela');
  
  es.onmessage = (e) => {
    const data = JSON.parse(e.data);
    document.getElementById('viewers').textContent = data.viewerCount;
  };
</script>
```

### Ejemplo 2: React Component

```jsx
import { useEffect, useState } from 'react';

function LiveViewers({ username }) {
  const [viewers, setViewers] = useState(0);

  useEffect(() => {
    const es = new EventSource(`/tiktok/live?username=${username}`);
    
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setViewers(data.viewerCount);
    };

    return () => es.close();
  }, [username]);

  return <div>Viewers: {viewers.toLocaleString()}</div>;
}

export default LiveViewers;
```

### Ejemplo 3: Vue 3 Component

```vue
<template>
  <div>
    <h1>👥 {{ viewers }} viewers</h1>
    <span v-if="isLive" class="live">🔴 EN VIVO</span>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps(['username']);
const viewers = ref(0);
const isLive = ref(false);
let eventSource;

onMounted(() => {
  eventSource = new EventSource(`/tiktok/live?username=${props.username}`);
  
  eventSource.onmessage = (e) => {
    const data = JSON.parse(e.data);
    viewers.value = data.viewerCount;
    isLive.value = data.isLive;
  };
});

onUnmounted(() => {
  eventSource?.close();
});
</script>
```

---

## 🔧 Configuración Avanzada

### Cambiar intervalo de actualización

En `src/tiktok-live/tiktok-live.controller.ts`, modifica:

```typescript
interval(5000).pipe( // Cambiar 5000 (5 segundos)
```

Ejemplos:
- `1000` = 1 segundo
- `3000` = 3 segundos
- `10000` = 10 segundos

### Filtrar datos antes de enviar

```typescript
return interval(5000).pipe(
  switchMap(() => this.tiktokService.getViewerCount(username)),
  filter(data => data.isLive), // Solo si está en vivo
  distinctUntilChanged((prev, curr) => prev.viewerCount === curr.viewerCount),
  map(data => ({ /* ... */ }))
);
```

---

## 📱 WebSocket Alternativo

Si prefieres WebSocket en lugar de SSE, puedo crear un servidor WebSocket.

Ventajas de WebSocket:
- Bidireccional
- Menor latencia en algunos navegadores
- Compatible con clientes que no soportan SSE

¿Lo necesitas? Dímelo y lo implemento.

---

## 🐛 Troubleshooting

### "No recibo actualizaciones"
- Verifica que el servidor está corriendo: `npm run start:dev`
- Asegúrate que el usuario está en vivo en TikTok
- Comprueba que el nombre de usuario es correcto

### "La conexión se cierra"
- Es normal si se cierra por inactividad
- Reconecta automáticamente
- Verifica tu conexión de internet

### "Error CORS"
- Ya está habilitado en `main.ts`
- Si necesitas dominio específico, modifica `app.enableCors()`

---

## 📚 Más Recursos

- [MDN - Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [NestJS - Streaming Files](https://docs.nestjs.com/techniques/streaming-files)
- [TikTok Live Connector](https://github.com/zerodytrash/TikTok-Live-Connector)

---

## ✨ Resumen

| Método | URL | Frecuencia | Mejor para |
|--------|-----|-----------|-----------|
| GET | `/tiktok/viewers` | Manual | Consultas puntuales |
| SSE | `/tiktok/live` | Automática | Dashboards en vivo |
| Web | `/realtime-viewer.html` | Automática | Usuarios finales |

¡Elige la que mejor se adapte a tus necesidades! 🚀
