import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // During build-time static generation, env vars may not be available.
    // Client components only call supabase inside useEffect/event handlers,
    // so this null is never invoked at SSR time — only at runtime in the browser.
    return null as any;
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
