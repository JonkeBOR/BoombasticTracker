import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/features/fitness-tracker/server/schema.ts',
  out: './migrations',
});
