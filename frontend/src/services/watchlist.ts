import { supabase } from "../lib/supabase";

export const addToWatchlist = async (
  userId: string,
  stockId: string,
) => {
  const { data, error } = await supabase
    .from("watchlist")
    .insert({
      user_id: userId,
      stock_id: stockId,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const removeFromWatchlist = async (
  userId: string,
  stockId: string,
) => {
  const { error } = await supabase
    .from("watchlist")
    .delete()
    .eq("user_id", userId)
    .eq("stock_id", stockId);

  if (error) {
    throw error;
  }
};

export const isInWatchlist = async (
  userId: string,
  stockId: string,
) => {
  const { data, error } = await supabase
    .from("watchlist")
    .select("id")
    .eq("user_id", userId)
    .eq("stock_id", stockId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return !!data;
};

export const getStockId = async (symbol: string) => {
  const { data, error } = await supabase
    .from("stocks")
    .select("id")
    .eq("symbol", symbol)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id ?? null;
};




export const getUserWatchlist = async (userId: string) => {
  const { data, error } = await supabase
    .from("watchlist")
    .select(`
      id,
      user_id,
      stock_id,
      created_at,
      stocks!watchlist_stock_id_fkey (
        id,
        symbol
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase watchlist error:", error);
    throw error;
  }

  console.log("Supabase watchlist result:", data);

  return data || [];
};
