import { supabase } from "../lib/supabase";

export async function getRecommendations() {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error("User is not authenticated");
  }

  const response = await fetch("http://127.0.0.1:8000/recommendations", {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);

    throw new Error(
      errorData?.detail || "Failed to load recommendations",
    );
  }

  return response.json();
}