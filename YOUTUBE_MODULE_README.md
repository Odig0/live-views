# YouTube Live Viewers Module

## Configuracion

Define la API key de YouTube Data API v3:

```bash
# .env (o variables del sistema)
YOUTUBE_API_KEY=tu_api_key
```

## Endpoint REST

### Obtener viewers de un live

```bash
GET /api/v1/youtube/live-viewers?url=YOUTUBE_URL
```

### Stream SSE (tiempo real)

```bash
GET /api/v1/youtube/live?url=YOUTUBE_URL
```

Ejemplo:

```bash
curl -N "http://localhost:3000/api/v1/youtube/live?url=https://www.youtube.com/watch?v=VIDEO_ID"
```

Cada 25 segundos se envia un evento con el numero actualizado de viewers.

Ejemplo:

```bash
curl "http://localhost:3000/api/v1/youtube/live-viewers?url=https://www.youtube.com/watch?v=VIDEO_ID"
```

Respuesta exitosa:

```json
{
  "success": true,
  "data": {
    "videoId": "VIDEO_ID",
    "concurrentViewers": 15342,
    "title": "Titulo del live",
    "channelTitle": "Canal",
    "isLive": true,
    "fetchedAt": "2026-04-14T21:30:00.000Z"
  }
}
```

Errores manejados:

- URL invalida
- videoId invalido
- video no encontrado
- video no en vivo
- API key faltante
- error de YouTube API

## WebSocket en tiempo real

Namespace:

```text
/api/v1/youtube-live
```

### Eventos cliente -> servidor

- `subscribe-live`: `{ "url": "https://www.youtube.com/watch?v=VIDEO_ID" }`
- `unsubscribe-live`: `{ "videoId": "VIDEO_ID" }` (opcional)

### Eventos servidor -> cliente

- `connected`
- `subscribed-live`
- `live-viewers-update`
- `unsubscribed-live`
- `youtube-error`

Polling:

- El servidor hace polling cada 25 segundos por video.
- Si hay multiples clientes en el mismo video, se reutiliza un solo polling.
- Soporta multiples videos en paralelo.

## Cache JSON compartido

El proyecto guarda snapshots en `data/viewers-cache.json` para no consultar APIs en endpoints de lectura.

Endpoints de lectura del archivo:

- GET /api/v1/viewers-cache
- GET /api/v1/viewers-cache/tiktok
- GET /api/v1/viewers-cache/youtube

## Ejemplo rapido cliente (socket.io)

```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/api/v1/youtube-live');

socket.on('connected', (msg) => console.log(msg));
socket.on('subscribed-live', (msg) => console.log('subscribed', msg));
socket.on('live-viewers-update', (msg) => console.log('update', msg));
socket.on('youtube-error', (err) => console.error('error', err));

socket.emit('subscribe-live', {
  url: 'https://www.youtube.com/watch?v=VIDEO_ID',
});
```
