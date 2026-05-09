import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

export const createClient = () => {
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient(
      supabaseUrl!,
      supabaseKey!
    );
  }

  return supabaseInstance;
};
