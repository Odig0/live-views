# 🎯 Guía Rápida - Tiempo Real

## La Solución Más Fácil 🌟

### Opción 1: Dashboard Web (SIN CÓDIGO)

Simplemente abre esto en tu navegador:
```
http://localhost:3000/realtime-viewer.html
```

**Hecho.** ✅ Recibirás actualizaciones automáticas cada 5 segundos sin hacer nada más.

---

## Para Desarrolladores 💻

### Opción 2: Usando EventSource (SSE)

**Endpoint:**
```
GET /tiktok/live?username=officialgeilegisela
```

**Código JavaScript:**
```javascript
const eventSource = new EventSource('/tiktok/live?username=officialgeilegisela');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(`👥 Viewers: ${data.viewerCount}`);
  console.log(`🔴 En vivo: ${data.isLive}`);
};
```

---

## Iniciar 🚀

```bash
# Terminal 1: Iniciar servidor
npm run start:dev

# Terminal 2 (opcional): En tu navegador
http://localhost:3000/realtime-viewer.html
```

---

## ¿Qué es SSE?

**Server-Sent Events** es una tecnología que:
- ✅ Mantiene la conexión abierta
- ✅ Envía datos del servidor al cliente automáticamente
- ✅ No necesitas hacer GET cada rato
- ✅ Es mucho más eficiente que polling

---

## Cambiar frecuencia de actualizaciones

En `src/tiktok-live/tiktok-live.controller.ts`, línea ~120:

```typescript
return interval(5000).pipe( // Cambiar aquí
```

- `1000` = cada 1 segundo
- `5000` = cada 5 segundos (por defecto)
- `10000` = cada 10 segundos

---

## Comparar métodos

| Método | Uso | Frecuencia |
|--------|-----|-----------|
| **Dashboard Web** | Para usuarios | Automática cada 5s |
| **GET `/tiktok/viewers`** | Consultas puntuales | Manual (bajo demanda) |
| **SSE `/tiktok/live`** | Para apps web | Automática cada 5s |

---

## ✨ Resumen

**Lo que conseguiste:**

1. **Dashboard en vivo** → `http://localhost:3000/realtime-viewer.html`
2. **API de tiempo real** → `GET /tiktok/live?username=USER`
3. **Actualizaciones automáticas** → Cada 5 segundos sin hacer GET

¡Ya no necesitas estar haciendo GET constantemente! 🎉

---

Ver documentación completa en: [REALTIME_GUIDE.md](REALTIME_GUIDE.md)
