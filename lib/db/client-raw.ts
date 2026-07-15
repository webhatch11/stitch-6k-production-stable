type ServiceModule = typeof import("../supabase-service");
let _serviceMod: ServiceModule | null = null;

export function loadService(): { supabase: ServiceModule["supabaseService"] | null; isSupabaseConfigured: boolean } {
  if (typeof window !== "undefined") {
    return { supabase: null, isSupabaseConfigured: false };
  }
  if (!_serviceMod) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _serviceMod = require("../supabase-service") as ServiceModule;
  }
  return {
    supabase: _serviceMod.supabaseService,
    isSupabaseConfigured: _serviceMod.isServiceClientConfigured,
  };
}
