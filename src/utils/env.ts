import { z } from "zod";

/**
 * Environment access for the application edge.
 * Domain layer must not read process.env directly.
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  FHIR_INGEST_API_KEY: z.string().min(1).optional(),
  REST_DESTINATION_URL: z.string().url().optional().or(z.literal("")),
  REST_DESTINATION_API_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().default("FHIR NOA Accelerator"),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: source.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_URL: source.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: source.SUPABASE_SERVICE_ROLE_KEY,
    FHIR_INGEST_API_KEY: source.FHIR_INGEST_API_KEY,
    REST_DESTINATION_URL: source.REST_DESTINATION_URL,
    REST_DESTINATION_API_KEY: source.REST_DESTINATION_API_KEY,
    NEXT_PUBLIC_APP_NAME: source.NEXT_PUBLIC_APP_NAME,
  });
}

export function getFhirIngestApiKey(): string | undefined {
  return process.env.FHIR_INGEST_API_KEY;
}
