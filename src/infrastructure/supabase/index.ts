/**
 * Supabase clients and repository adapters.
 * Domain/services must not import this module — compose only from infrastructure.
 */
export {
  createSupabaseBrowserClient,
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "./client";
export { createSupabaseAuthClient, getSessionUser } from "./auth";
export { createSupabaseStores } from "./stores";
export { ensureSupabaseConfigSeed } from "./seed-config";
