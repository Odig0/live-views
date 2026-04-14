import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Habilitar CORS
  app.enableCors();

  // Servir archivos estáticos de la carpeta public
  app.useStaticAssets(join(__dirname, '..', 'public'));

  await app.listen(process.env.PORT ?? 3000, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${process.env.PORT ?? 3000}`);
    console.log(`📊 Ver tiempo real en http://localhost:${process.env.PORT ?? 3000}/realtime-viewer.html`);
  });
}
bootstrap();
