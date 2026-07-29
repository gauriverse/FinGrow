import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Check your .env file.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getOnboardingStatus(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", userId)
    .single();

  if (error || !data) return false;
  return (
    (data as { onboarding_completed: boolean }).onboarding_completed ?? false
  );
}
