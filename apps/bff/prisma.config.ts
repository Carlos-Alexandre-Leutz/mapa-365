import { defineConfig } from '@prisma/config';

export default defineConfig({
  datasource: {
    // Injetamos a string direto para testar e destravar a task
    url: "postgresql://alexandre:mysecretpassword@localhost:5432/saas_business_manager?schema=public",
  },
});