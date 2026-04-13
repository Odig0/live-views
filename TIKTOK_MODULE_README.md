# TikTok Live Viewers Module

Un módulo simple de NestJS para scrapear la cantidad de viewers en vivo de un live de TikTok.

## Características

- ✅ Obtener el conteo actual de espectadores en un live de TikTok
- ✅ Obtener información detallada del room (sala) de transmisión
- ✅ Sin autenticación requerida
- ✅ Manejo de errores robusto
- ✅ Timeout configurable

## Requisitos Previos

- Node.js 16+
- npm o yarn
- La dependencia `tiktok-live-connector` (ya instalada)

## Instalación

La librería `tiktok-live-connector` ya está instalada en el proyecto. El módulo está listo para usar.

## Endpoints

### 1. Obtener conteo de viewers

**GET** `/tiktok/viewers?username=USERNAME`

Obtiene la cantidad actual de espectadores en el live de un usuario de TikTok.

**Parámetros:**
- `username` (query) - Nombre de usuario de TikTok (con o sin @)

**Ejemplo de solicitud:**
```bash
curl "http://localhost:3000/tiktok/viewers?username=officialgeilegisela"
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": {
    "username": "officialgeilegisela",
    "viewerCount": 15234,
    "isLive": true,
    "timestamp": "2026-04-13T10:30:45.123Z"
  }
}
```

**Respuesta con error:**
```json
{
  "message": "User is not live or does not exist",
  "username": "officialgeilegisela",
  "viewerCount": 0
}
```

### 2. Obtener información del room

**GET** `/tiktok/room-info?username=USERNAME`

Obtiene información detallada del room de transmisión incluyendo título, cantidad de usuarios, etc.

**Parámetros:**
- `username` (query) - Nombre de usuario de TikTok (con o sin @)

**Ejemplo de solicitud:**
```bash
curl "http://localhost:3000/tiktok/room-info?username=officialgeilegisela"
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "username": "officialgeilegisela",
    "userCount": 15234,
    "viewCount": 15234,
    "isLive": true,
    "title": "Transmisión en vivo",
    "owner": {
      "username": "officialgeilegisela",
      "nickname": "Official Giele Gisela"
    },
    "timestamp": "2026-04-13T10:30:45.123Z"
  }
}
```

### 3. Health Check

**GET** `/tiktok/health`

Verifica que el servicio esté funcionando correctamente.

**Respuesta:**
```json
{
  "status": "ok",
  "service": "TikTok Live Viewers"
}
```

## Uso en Código (TypeScript/NestJS)

### Inyectar el servicio en tu controlador:

```typescript
import { Controller, Get, Param } from '@nestjs/common';
import { TikTokLiveService } from './tiktok-live/tiktok-live.service';

@Controller()
export class MyController {
  constructor(private tiktokService: TikTokLiveService) {}

  @Get('check-live/:username')
  async checkLive(@Param('username') username: string) {
    const viewerData = await this.tiktokService.getViewerCount(username);
    return viewerData;
  }

  @Get('live-info/:username')
  async getLiveInfo(@Param('username') username: string) {
    const roomInfo = await this.tiktokService.getRoomInfo(username);
    return roomInfo;
  }
}
```

## Comenzar a Usar

1. **Inicia el servidor de desarrollo:**

```bash
npm run start:dev
```

2. **Probando un endpoint:**

```bash
curl "http://localhost:3000/tiktok/viewers?username=officialgeilegisela"
```

## Estructura del Proyecto

```
src/
├── tiktok-live/
│   ├── tiktok-live.service.ts      # Lógica de conexión a TikTok
│   ├── tiktok-live.controller.ts   # Endpoints HTTP
│   └── tiktok-live.module.ts       # Módulo NestJS
├── app.module.ts                   # Módulo principal (actualizado)
└── main.ts
```

## Opciones Avanzadas

### Usar el servicio directamente en otro módulo

El `TikTokLiveModule` exporta `TikTokLiveService`, por lo que puedes importarlo en otros módulos:

```typescript
import { Module } from '@nestjs/common';
import { TikTokLiveModule } from './tiktok-live/tiktok-live.module';

@Module({
  imports: [TikTokLiveModule],
  // ... resto de tu módulo
})
export class OtherModule {}
```

## Manejo de Errores

El servicio maneja automáticamente:
- Usuarios offline o no existentes
- Timeouts de conexión (15 segundos por defecto)
- Errores de conexión
- Errores inesperados

Todos los errores devuelven un mensaje descriptivo en la respuesta.

## Limitaciones

- **Timeout**: Cada conexión tiene un timeout de 15 segundos
- **No autenticado**: No puedes enviar mensajes sin autenticación
- **Uso responsable**: No hagas scraping masivo o continuo, respeta los límites de TikTok

## Notas Importantes

⚠️ **Este es un proyecto de reverse engineering**. No es una API oficial de TikTok.

- Úsalo responsablemente
- No lo uses para spam o propósitos maliciosos
- Lee los términos de servicio de TikTok

## Recursos Útiles

- [TikTok Live Connector en GitHub](https://github.com/zerodytrash/TikTok-Live-Connector)
- [Documentación de NestJS](https://docs.nestjs.com/)
- [API Documentation](https://github.com/zerodytrash/TikTok-Live-Connector#table-of-contents)

## Troubleshooting

### "User is not live"
- El usuario ingresado no está transmitiendo actualmente
- Verifica que el nombre de usuario sea correcto

### "Connection timeout"
- El servidor de TikTok tardó más de 15 segundos en responder
- Intenta de nuevo en unos segundos

### "Failed to connect"
- Posible problema de conexión a internet
- Verifica tu conexión de red

## Soporte

Si tienes problemas, abre un issue en el repositorio de NestJS o en el repositorio de TikTok-Live-Connector.
