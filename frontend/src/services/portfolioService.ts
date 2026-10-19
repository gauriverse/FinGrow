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
export async function buyStock(stock_id: string, quantity: number) {
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

  const response = await fetch(`${BASE_URL}/portfolio/buy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      stock_id,
      quantity,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    throw new Error(
      errorData.detail || "Failed to buy stock"
    );
  }

  return response.json();
}

export async function sellStock(stock_id: string, quantity: number) {
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

  const response = await fetch(`${BASE_URL}/portfolio/sell`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      stock_id,
      quantity,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    throw new Error(
      errorData.detail || "Failed to sell stock"
    );
  }

  return response.json();
}

export async function addFunds(amount: number) {
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

  const response = await fetch(`${BASE_URL}/portfolio/add-funds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ amount }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    throw new Error(errorData.detail || "Failed to add funds");
  }

  return response.json();
}

export async function getWalletHistory() {
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

  const response = await fetch(`${BASE_URL}/portfolio/wallet/history`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to load wallet activity");
  }

  return response.json();
}


async function authedGet(path: string, failureMessage: string) {
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
 
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });
 
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || failureMessage);
  }
 
  return response.json();
}
 
export function getPortfolioHistory(days = 365) {
  return authedGet(
    `/portfolio/history?days=${days}`,
    "Failed to load portfolio history"
  );
}
 
export function getPortfolioInsights() {
  return authedGet(
    "/portfolio/insights",
    "Failed to load portfolio insights"
  );
}
 
export function getPortfolioTrades() {
  return authedGet(
    "/portfolio/trades",
    "Failed to load trade history"
  );
}