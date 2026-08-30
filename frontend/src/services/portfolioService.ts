import { supabase } from "../lib/supabase";

const BASE_URL = "http://127.0.0.1:8000";

export async function getPortfolioSummary() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!session?.access_token) {
    throw new Error("User is not authenticated");
  }

  const response = await fetch(`${BASE_URL}/portfolio/summary`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    throw new Error(
      errorData.detail || "Failed to load portfolio"
    );
  }

  return response.json();
}