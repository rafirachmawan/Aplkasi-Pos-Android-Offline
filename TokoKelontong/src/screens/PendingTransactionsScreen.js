import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import { getActiveStoreId } from "../services/sessionStore";
import { listOutbox } from "../database/localDb";
import TransactionRepository from "../database/transactionRepository";
import useSyncStatus from "../hooks/useSyncStatus";
import { formatRupiah } from "../utils/helpers";
import { colors, fonts } from "../theme/colors";

const STATUS_LABEL = {
  pending: { text: "Menunggu kirim", color: "#B45309", bg: "#FEF3C7" },
  needs_review: { text: "Perlu ditinjau", color: "#B91C1C", bg: "#FEE2E2" },
  synced: { text: "Terkirim", color: "#047857", bg: "#D1FAE5" },
};

function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PendingTransactionsScreen() {
  const syncStatus = useSyncStatus();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const storeId = await getActiveStoreId();
      if (!storeId) {
        setRows([]);
        return;
      }
      const unsent = await listOutbox(storeId, ["pending", "needs_review"]);
      const sent = (await listOutbox(storeId, ["synced"])).reverse().slice(0, 20);
      setRows([...unsent, ...sent]);
    } catch (e) {
      console.warn("Gagal memuat transaksi lokal:", e?.message || e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Muat ulang saat hitungan berubah (sync di latar belakang selesai)
  useEffect(() => {
    load();
  }, [syncStatus.pending, syncStatus.needsReview, load]);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await TransactionRepository.syncOfflineQueue();
      if (res.total === 0) {
        Alert.alert("Informasi", "Semua transaksi sudah terkirim ke cloud.");
      } else if (res.failed > 0) {
        Alert.alert(
          "Belum Semua Terkirim",
          `${res.synced} terkirim, ${res.failed} gagal. Transaksi tetap aman di HP. Pastikan internet stabil lalu coba lagi.`,
        );
      } else {
        Alert.alert("Berhasil", `${res.synced} transaksi terkirim ke cloud.`);
      }
    } catch (e) {
      Alert.alert("Gagal Sinkronisasi", e.message || "Terjadi masalah jaringan.");
    } finally {
      setSyncing(false);
      load();
    }
  };

  const unsynced = syncStatus.unsynced;

  const renderItem = ({ item }) => {
    const st = STATUS_LABEL[item.status] || STATUS_LABEL.pending;
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.invoice} numberOfLines={1}>
            {item.status === "synced" && item.server_invoice
              ? item.server_invoice
              : item.invoice_number}
          </Text>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            <Text style={[styles.badgeText, { color: st.color }]}>{st.text}</Text>
          </View>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.meta}>{formatTime(item.created_at)}</Text>
          <Text style={styles.total}>{formatRupiah(item.grand_total)}</Text>
        </View>
        {item.status !== "synced" && item.last_error ? (
          <Text style={styles.error} numberOfLines={3}>
            {item.last_error}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryTitle}>
            {unsynced > 0
              ? `${unsynced} transaksi belum terkirim`
              : "Semua transaksi sudah terkirim"}
          </Text>
          <Text style={styles.summarySub}>
            {syncStatus.needsReview > 0
              ? `${syncStatus.needsReview} perlu ditinjau. Data tetap aman di HP.`
              : syncStatus.offline
                ? "Tidak ada internet. Data tersimpan aman di HP."
                : "Dikirim otomatis saat ada internet."}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.syncBtn, (syncing || syncStatus.syncing) && { opacity: 0.6 }]}
          onPress={handleSync}
          disabled={syncing || syncStatus.syncing}
          activeOpacity={0.8}
        >
          {syncing || syncStatus.syncing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.syncBtnText}>Kirim Sekarang</Text>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(i) => i.client_tx_id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons
                name="cloud-check-outline"
                size={44}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyText}>Belum ada transaksi lokal.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  summarySub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  syncBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 112,
    alignItems: "center",
  },
  syncBtnText: { fontFamily: fonts.semiBold, fontSize: 13, color: "#fff" },
  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  invoice: { flex: 1, fontFamily: fonts.semiBold, fontSize: 13, color: colors.text },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontFamily: fonts.semiBold, fontSize: 11 },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  total: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  error: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.error,
    marginTop: 8,
  },
  empty: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
});
