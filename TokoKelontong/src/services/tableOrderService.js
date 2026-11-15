import { supabase } from "./supabaseClient";

/**
 * Service untuk mengelola Pesanan Meja (Self-Order F&B)
 * Aman terhadap kondisi offline dan error schema.
 */

export const fetchPendingTableOrders = async (storeId) => {
  if (!storeId) return [];
  try {
    const { data, error } = await supabase
      .from("table_orders")
      .select("*")
      .eq("store_id", storeId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("fetchPendingTableOrders warning:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn("fetchPendingTableOrders error:", err.message);
    return [];
  }
};

export const updateTableOrderStatus = async (orderId, newStatus) => {
  if (!orderId) return { success: false, error: "Order ID missing" };
  try {
    const { data, error } = await supabase
      .from("table_orders")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.warn("updateTableOrderStatus warn:", err.message);
    return { success: false, error: err.message };
  }
};

export const fetchStoreFnbConfig = async (storeId) => {
  if (!storeId) return { qrisImageUrl: "", activeTables: 10 };
  try {
    const { data, error } = await supabase
      .from("stores")
      .select("qris_image_url, fnb_active_tables")
      .eq("id", storeId)
      .maybeSingle();

    if (error) {
      console.warn("fetchStoreFnbConfig warning:", error.message);
      return { qrisImageUrl: "", activeTables: 10 };
    }
    return {
      qrisImageUrl: data?.qris_image_url || "",
      activeTables: data?.fnb_active_tables || 10,
    };
  } catch (err) {
    console.warn("fetchStoreFnbConfig error:", err.message);
    return { qrisImageUrl: "", activeTables: 10 };
  }
};

export const updateStoreQrisImage = async (storeId, qrisUrl) => {
  if (!storeId) return { success: false, error: "Store ID missing" };
  try {
    const { error } = await supabase
      .from("stores")
      .update({ qris_image_url: qrisUrl })
      .eq("id", storeId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.warn("updateStoreQrisImage warn:", err.message);
    return { success: false, error: err.message };
  }
};

export const updateStoreActiveTables = async (storeId, tablesCount) => {
  if (!storeId) return { success: false, error: "Store ID missing" };
  try {
    const { error } = await supabase
      .from("stores")
      .update({ fnb_active_tables: parseInt(tablesCount, 10) || 10 })
      .eq("id", storeId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.warn("updateStoreActiveTables warn:", err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Berlangganan Realtime Supabase Channel untuk pesanan meja baru
 * @param {string} storeId
 * @param {Function} onChange
 * @returns {Function} unsubscribe function
 */
export const subscribeToTableOrders = (storeId, onChange) => {
  if (!storeId) return () => {};

  try {
    const channel = supabase
      .channel(`table_orders_${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "table_orders",
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          if (typeof onChange === "function") {
            onChange(payload);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.warn("subscribeToTableOrders error:", err.message);
    return () => {};
  }
};
