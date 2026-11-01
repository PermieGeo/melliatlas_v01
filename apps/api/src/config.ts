import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  SOURCE_OPERATOR_TOKEN: z.string().min(32).optional(),
  SATURN_OPERATOR_TOKEN: z.string().min(32).optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().min(1),
  OPEN_METEO_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(30000)
    .default(8000),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): Config {
  return configSchema.parse(environment);
}
