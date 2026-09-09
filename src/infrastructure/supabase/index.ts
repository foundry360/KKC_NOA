/**
 * Composition root placeholders for Foundation.
 * Pipeline wiring is added in later cascade steps.
 */
export {
  createSupabaseBrowserClient,
  createSupabaseServiceClient,
  isSupabaseConfigured,
} from "./client";
export { createSupabaseAuthClient, getSessionUser } from "./auth";
