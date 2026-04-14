import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Habilitar CORS
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5174',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5174',
    ],
    credentials: true,
  });

  // Servir archivos estáticos de la carpeta public
  app.useStaticAssets(join(__dirname, '..', 'public'));

  await app.listen(process.env.PORT ?? 3000, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${process.env.PORT ?? 3000}`);
    console.log(`📊 Ver tiempo real en http://localhost:${process.env.PORT ?? 3000}/realtime-viewer.html`);
  });
}
bootstrap();
