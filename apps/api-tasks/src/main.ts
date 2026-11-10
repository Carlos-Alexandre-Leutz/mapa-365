import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  const rawPort = process.env.PORT;
  const parsedPort = rawPort ? parseInt(rawPort, 10) : NaN;
  const port = !Number.isNaN(parsedPort) && parsedPort > 0 ? parsedPort : 3002;

  await app.listen(port, '0.0.0.0');

  console.log(`✅ Microserviço API-TASKS rodando em: ${port}`);
}
bootstrap();