import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import debtRepository from "../database/debtRepository";
import { formatRupiah } from "../utils/helpers";
import { colors, fonts } from "../theme/colors";
import usePlan from "../hooks/usePlan";
import { ProLockModal } from "../components/ProLock";

const formatToRp = (raw) => {
  const num = String(raw).replace(/\D/g, "");
  if (!num) return "";
  return parseInt(num, 10).toLocaleString("id-ID");
};

const parseRp = (formatted) => {
  if (!formatted) return 0;
  const cleaned = String(formatted).replace(/\D/g, "");
  return parseInt(cleaned, 10) || 0;
};

const BukuKasbonScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [allDebts, setAllDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("unpaid"); // 'unpaid' | 'paid' | 'all'
  const [searchQuery, setSearchQuery] = useState("");

  // Modal Pembayaran Kasbon
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmountInput, setPayAmountInput] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNotes, setPayNotes] = useState("");
  const [paying, setPaying] = useState(false);

  // Modal Catat Kasbon Baru Manual
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  // Modal Detail Riwayat Cicilan
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailDebt, setDetailDebt] = useState(null);

  // Panel kunci fitur (tier Gratis). Data tetap terlihat; hanya aksi
  // tambah/bayar yang dikunci (K-11).
  const [showLockModal, setShowLockModal] = useState(false);

  // Tier langganan toko. Free = read-only.
  const plan = usePlan();
  const isReadOnly = !plan.isPro;

  const [storeName, setStoreName] = useState("MarketPos");

  useFocusEffect(
    useCallback(() => {
      loadData();
      AsyncStorage.getItem("storeName").then((val) => {
        if (val) setStoreName(val);
      });
    }, []),
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await debtRepository.getDebts("all");
      setAllDebts(data || []);
    } catch (e) {
      console.error("Gagal memuat kasbon:", e);
    } finally {
      setLoading(false);
    }
  };

  // Filter List & Perhitungan Ringkasan
  const unpaidDebts = allDebts.filter(
    (d) => d.status !== "paid" && (Number(d.remaining_debt) || 0) > 0,
  );
  const paidDebts = allDebts.filter(
    (d) => d.status === "paid" || (Number(d.remaining_debt) || 0) <= 0,
  );

  const totalUnpaidDebt = unpaidDebts.reduce(
    (sum, d) => sum + (Number(d.remaining_debt) || 0),
    0,
  );
  const unpaidCustomerCount = new Set(
    unpaidDebts.map((d) => (d.customer_name || "").trim().toLowerCase()),
  ).size;

  const currentTabDebts =
    activeTab === "unpaid"
      ? unpaidDebts
      : activeTab === "paid"
      ? paidDebts
      : allDebts;

  const filteredDebts = currentTabDebts.filter((d) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const matchName = (d.customer_name || "").toLowerCase().includes(q);
    const matchPhone = (d.customer_phone || "").toLowerCase().includes(q);
    const matchInvoice = (d.invoice_number || "").toLowerCase().includes(q);
    return matchName || matchPhone || matchInvoice;
  });

  // ── Helper Cepat Jatuh Tempo ──
  const setQuickDueDate = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    setNewDueDate(`${yyyy}-${mm}-${dd}`);
  };

  // ── Kirim Pengingat Tagihan via WhatsApp ──
  const handleSendReminderWA = (item) => {
    const phone = (item.customer_phone || "").replace(/\D/g, "");
    if (!phone) {
      Alert.alert(
        "Nomor Tidak Tersedia",
        "Catatan kasbon ini belum memiliki nomor telepon WhatsApp pelanggan.",
      );
      return;
    }
    sendWAMessageToPhone(item, phone);
  };

  const sendWAMessageToPhone = (item, rawPhone) => {
    let cleanPhone = rawPhone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "62" + cleanPhone.substring(1);
    }

    const dueDateText = item.due_date ? `📅 Jatuh Tempo: ${item.due_date}\n` : "";
    const noteText = item.notes ? `📝 Catatan: ${item.notes}\n` : "";
    const invoiceText = item.invoice_number
      ? `📋 No. Nota: ${item.invoice_number}\n`
      : "";

    const message =
      `Halo Bpk/Ibu *${item.customer_name}*,\n\n` +
      `Semoga sehat selalu. Kami dari *${storeName}* menginformasikan rincian catatan kasbon Anda:\n\n` +
      invoiceText +
      `💰 Total Kasbon: ${formatRupiah(item.total_debt)}\n` +
      `💳 *Sisa Tagihan: ${formatRupiah(item.remaining_debt)}*\n` +
      dueDateText +
      noteText +
      `\nPembayaran dapat dilakukan langsung di kasir toko atau transfer.\n` +
      `Terima kasih banyak atas kepercayaan dan kerjasamanya! 🙏`;

    const url = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      const webUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      Linking.openURL(webUrl).catch(() => {
        Alert.alert(
          "Gagal Membuka WhatsApp",
          "Pastikan aplikasi WhatsApp terpasang di HP Anda.",
        );
      });
    });
  };

  // ── Buka Modal Bayar Kasbon ──
  const openPayModal = (item) => {
    setSelectedDebt(item);
    setPayAmountInput(formatToRp(String(item.remaining_debt)));
    setPayMethod("cash");
    setPayNotes("");
    setShowPayModal(true);
  };

  // ── Simpan Pembayaran Kasbon ──
  const handleSavePayment = async () => {
    if (!selectedDebt) return;
    const amount = parseRp(payAmountInput);
    if (amount <= 0) {
      Alert.alert("Nominal Salah", "Masukkan nominal pembayaran yang valid.");
      return;
    }
    if (amount > selectedDebt.remaining_debt) {
      Alert.alert(
        "Nominal Lebih",
        `Pembayaran melebihi sisa hutang (${formatRupiah(selectedDebt.remaining_debt)}).`,
      );
      return;
    }

    setPaying(true);
    try {
      await debtRepository.recordPayment(selectedDebt.id, {
        payment_amount: amount,
        payment_method: payMethod,
        notes: payNotes,
      });

      setShowPayModal(false);
      setSelectedDebt(null);
      Alert.alert("✅ Berhasil", "Pembayaran kasbon berhasil dicatat.");
      loadData();
    } catch (e) {
      Alert.alert("Gagal", e.message || "Gagal mencatat pembayaran kasbon.");
    } finally {
      setPaying(false);
    }
  };

  // ── Tambah Kasbon Baru Manual ──
  const handleSaveNewDebt = async () => {
    if (!newName.trim()) {
      Alert.alert("Nama Wajib Diisi", "Masukkan nama pelanggan.");
      return;
    }
    const amount = parseRp(newAmount);
    if (amount <= 0) {
      Alert.alert("Nominal Salah", "Masukkan nominal kasbon.");
      return;
    }

    setSavingNew(true);
    try {
      await debtRepository.createDebt({
        customer_name: newName.trim(),
        customer_phone: newPhone.trim(),
        total_debt: amount,
        remaining_debt: amount,
        due_date: newDueDate.trim() || null,
        notes: newNotes.trim(),
      });

      setShowAddModal(false);
      setNewName("");
      setNewPhone("");
      setNewAmount("");
      setNewDueDate("");
      setNewNotes("");
      Alert.alert("✅ Sukses", "Catatan kasbon baru berhasil disimpan.");
      loadData();
    } catch (e) {
      Alert.alert("Error", e.message || "Gagal menyimpan kasbon baru.");
    } finally {
      setSavingNew(false);
    }
  };

  const openDetail = (item) => {
    setDetailDebt(item);
    setShowDetailModal(true);
  };

  const renderDebtItem = ({ item }) => {
    const isPaid = item.status === "paid" || (Number(item.remaining_debt) || 0) <= 0;
    const initial = (item.customer_name || "P").charAt(0).toUpperCase();

    return (
      <View style={styles.debtCard}>
        {/* Header Baris: Avatar, Nama, Telepon & Status Pill */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => openDetail(item)}
          style={styles.cardHeaderPressable}
        >
          <View
            style={[
              styles.avatarWrap,
              isPaid ? styles.avatarPaid : styles.avatarUnpaid,
            ]}
          >
            <Text
              style={[
                styles.avatarText,
                isPaid ? styles.avatarTextPaid : styles.avatarTextUnpaid,
              ]}
            >
              {initial}
            </Text>
          </View>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.customerName} numberOfLines={1}>
              {item.customer_name}
            </Text>
            <View style={styles.phoneRow}>
              <Text
                style={[
                  styles.customerPhone,
                  !item.customer_phone && { fontStyle: "italic", color: "#94A3B8" },
                ]}
              >
                {item.customer_phone || "Tanpa No. Telepon"}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.statusBadge,
              isPaid ? styles.badgePaid : styles.badgeUnpaid,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                isPaid ? styles.statusDotPaid : styles.statusDotUnpaid,
              ]}
            />
            <Text
              style={[
                styles.statusBadgeText,
                isPaid ? styles.textPaid : styles.textUnpaid,
              ]}
            >
              {isPaid ? "LUNAS" : "BELUM LUNAS"}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Kotak Rincian Hutang (Side-by-side) */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => openDetail(item)}
          style={styles.debtDetailsBox}
        >
          <View style={styles.debtColLeft}>
            <Text style={styles.debtColLabel}>TOTAL KASBON</Text>
            <Text style={styles.debtColValTotal}>
              {formatRupiah(item.total_debt)}
            </Text>
            {item.invoice_number ? (
              <Text style={styles.invoiceMeta} numberOfLines={1}>
                Nota: {item.invoice_number}
              </Text>
            ) : null}
          </View>

          <View style={styles.debtDividerV} />

          <View style={styles.debtColRight}>
            <Text
              style={[
                styles.debtColLabel,
                { color: isPaid ? "#059669" : "#DC2626" },
              ]}
            >
              {isPaid ? "STATUS" : "SISA TAGIHAN"}
            </Text>
            <Text
              style={[
                styles.debtColValRemaining,
                isPaid ? { color: "#059669" } : { color: "#DC2626" },
              ]}
            >
              {isPaid ? "Lunas" : formatRupiah(item.remaining_debt)}
            </Text>
            {item.due_date ? (
              <View style={styles.dueDateBadge}>
                <Text style={styles.dueDateText}>Jatuh Tempo: {item.due_date}</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>

        {/* Catatan Produk / Kasbon jika ada */}
        {item.notes ? (
          <View style={styles.notesPreviewRow}>
            <Text style={styles.notesPreviewText} numberOfLines={1}>
              Catatan: {item.notes}
            </Text>
          </View>
        ) : null}

        {/* Tombol Aksi Bawah */}
        {!isPaid ? (
          <View style={styles.cardActionsRow}>
            <TouchableOpacity
              style={styles.btnActionWA}
              onPress={() => handleSendReminderWA(item)}
              activeOpacity={0.8}
            >
              <Text style={styles.btnActionWAText}>Ingatkan WA</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnActionPay, isReadOnly && styles.btnActionLocked]}
              onPress={() => {
                // Tier Gratis: pembayaran/cicilan baru dikunci, kartu tetap bisa dibuka.
                if (isReadOnly) {
                  setShowLockModal(true);
                  return;
                }
                openPayModal(item);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.btnActionPayText}>
                {isReadOnly ? "Bayar (Pro)" : "Bayar / Cicil"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.btnActionHistoryPaid}
            onPress={() => openDetail(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.btnActionHistoryPaidText}>
              Lunas Sepenuhnya
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Text style={styles.btnActionHistoryPaidSub}>Riwayat Cicilan</Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={16}
                color="#059669"
              />
            </View>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Banner Mode Gratis (read-only) ── */}
      {isReadOnly && (
        <TouchableOpacity
          style={styles.readOnlyBanner}
          activeOpacity={0.85}
          onPress={() => setShowLockModal(true)}
        >
          <Text style={styles.readOnlyBannerText}>
            Paket Gratis: data kasbon bisa dilihat, pencatatan & pembayaran
            baru terkunci.
          </Text>
          <Text style={styles.readOnlyBannerAction}>Upgrade</Text>
        </TouchableOpacity>
      )}

      {/* ── Summary Hero Card (Warm Orange) ── */}
      <View style={styles.heroSummaryCard}>
        <View style={styles.summaryTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.summaryBadgePill}>
              <View style={styles.summaryDotLive} />
              <Text style={styles.summaryBadgePillText}>PIUTANG BELUM LUNAS</Text>
            </View>
            <Text style={styles.summaryValue}>
              {formatRupiah(totalUnpaidDebt)}
            </Text>
          </View>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryBottomRow}>
          <View style={styles.summaryMiniStat}>
            <Text style={styles.miniStatLabel}>Pelanggan Berhutang</Text>
            <Text style={styles.miniStatVal}>{unpaidCustomerCount} Orang</Text>
          </View>

          <View style={styles.summaryMiniDivider} />

          <View style={styles.summaryMiniStat}>
            <Text style={styles.miniStatLabel}>Total Catatan</Text>
            <Text style={styles.miniStatVal}>{unpaidDebts.length} Nota</Text>
          </View>
        </View>
      </View>

      {/* ── Search Bar & Filter ── */}
      <View style={styles.filterSection}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama, telepon, atau nomor nota..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={{ padding: 4 }}
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color="#94A3B8"
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Filter Segmen dengan Badge Jumlah */}
        <View style={styles.tabsRow}>
          {[
            {
              key: "unpaid",
              label: "Belum Lunas",
              count: unpaidDebts.length,
            },
            {
              key: "paid",
              label: "Lunas",
              count: paidDebts.length,
            },
            {
              key: "all",
              label: "Semua",
              count: allDebts.length,
            },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    isActive && styles.tabBtnTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.tabCountPill,
                    isActive && styles.tabCountPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabCountText,
                      isActive && styles.tabCountTextActive,
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── List Kasbon ── */}
      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.stateText}>Memuat catatan kasbon...</Text>
        </View>
      ) : filteredDebts.length === 0 ? (
        <View style={styles.centerState}>
          <View style={styles.emptyIconCircle}>
            <MaterialCommunityIcons
              name={searchQuery ? "magnify" : "check-all"}
              size={36}
              color={colors.primary}
            />
          </View>
          <Text style={styles.stateTitle}>
            {searchQuery
              ? "Pencarian Tidak Ditemukan"
              : activeTab === "unpaid"
              ? "Semua Kasbon Lunas!"
              : "Belum Ada Catatan Kasbon"}
          </Text>
          <Text style={styles.stateText}>
            {searchQuery
              ? `Tidak ada kasbon yang cocok dengan "${searchQuery}".`
              : activeTab === "unpaid"
              ? "Tidak ada piutang aktif saat ini. Semua transaksi pelanggan tertib!"
              : "Tekan tombol Catat Kasbon di bawah untuk menambahkan catatan baru."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredDebts}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderDebtItem}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: Math.max(insets.bottom, 16) + 84 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Floating Action Button (Catat Kasbon) ── */}
      <TouchableOpacity
        style={[
          styles.fabBtn,
          { bottom: Math.max(insets.bottom, 16) + 16 },
          isReadOnly && styles.fabBtnLocked,
        ]}
        onPress={() => {
          // Tier Gratis: data bisa dilihat, pencatatan baru dikunci.
          if (isReadOnly) {
            setShowLockModal(true);
            return;
          }
          setNewName("");
          setNewPhone("");
          setNewAmount("");
          setNewDueDate("");
          setNewNotes("");
          setShowAddModal(true);
        }}
        activeOpacity={0.88}
      >
        <Text style={styles.fabBtnText}>
          {isReadOnly ? "Catat Kasbon (Pro)" : "+ Catat Kasbon"}
        </Text>
      </TouchableOpacity>

      {/* ── Modal Bayar Kasbon / Cicil ── */}
      <Modal
        visible={showPayModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowPayModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Bayar / Cicil Kasbon</Text>
                <Text style={styles.modalSubtitle}>
                  Pelanggan: {selectedDebt?.customer_name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowPayModal(false)}
                style={styles.modalCloseBtn}
              >
                <MaterialCommunityIcons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.sisaHutangBanner}>
              <View>
                <Text style={styles.sisaHutangLabel}>Sisa Hutang Saat Ini</Text>
                <Text style={styles.sisaHutangVal}>
                  {formatRupiah(selectedDebt?.remaining_debt || 0)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.quickPayFullBtn}
                onPress={() =>
                  setPayAmountInput(
                    formatToRp(String(selectedDebt?.remaining_debt || 0)),
                  )
                }
                activeOpacity={0.8}
              >
                <Text style={styles.quickPayFullText}>Bayar Lunas</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>NOMINAL PEMBAYARAN (RP) *</Text>
            <TextInput
              style={styles.modalInput}
              value={payAmountInput}
              onChangeText={(val) => setPayAmountInput(formatToRp(val))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>METODE PEMBAYARAN</Text>
            <View style={styles.methodsRow}>
              {[
                { id: "cash", label: "Tunai" },
                { id: "transfer", label: "Transfer" },
                { id: "qris", label: "QRIS" },
              ].map((m) => {
                const isSelected = payMethod === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.methodChip,
                      isSelected && styles.methodChipActive,
                    ]}
                    onPress={() => setPayMethod(m.id)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.methodChipText,
                        isSelected && styles.methodChipTextActive,
                      ]}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>CATATAN (OPSIONAL)</Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 44 }]}
              value={payNotes}
              onChangeText={setPayNotes}
              placeholder="Misal: Cicilan ke-1"
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowPayModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, paying && { opacity: 0.7 }]}
                onPress={handleSavePayment}
                disabled={paying}
                activeOpacity={0.88}
              >
                <Text style={styles.modalSubmitText}>
                  {paying ? "Menyimpan..." : "Simpan Pembayaran"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal Catat Kasbon Baru Manual ── */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Catat Kasbon Baru</Text>
                  <Text style={styles.modalSubtitle}>
                    Pencatatan piutang pelanggan langsung
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowAddModal(false)}
                  style={styles.modalCloseBtn}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>NAMA PELANGGAN *</Text>
              <TextInput
                style={styles.modalInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="Contoh: Pak Budi"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>
                NO. WHATSAPP / TELEPON (OPSIONAL)
              </Text>
              <TextInput
                style={styles.modalInput}
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
                placeholder="Contoh: 08123456789"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>NOMINAL KASBON (RP) *</Text>
              <TextInput
                style={styles.modalInput}
                value={newAmount}
                onChangeText={(v) => setNewAmount(formatToRp(v))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#94A3B8"
              />

              <View style={styles.fieldHeaderBetween}>
                <Text style={styles.inputLabel}>JATUH TEMPO (OPSIONAL)</Text>
              </View>

              {/* Quick Preset Buttons untuk Jatuh Tempo */}
              <View style={styles.quickPresetRow}>
                {[
                  { label: "+3 Hari", days: 3 },
                  { label: "+7 Hari", days: 7 },
                  { label: "+14 Hari", days: 14 },
                  { label: "+30 Hari", days: 30 },
                ].map((p) => (
                  <TouchableOpacity
                    key={p.label}
                    style={styles.presetChip}
                    onPress={() => setQuickDueDate(p.days)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.presetChipText}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.modalInput}
                value={newDueDate}
                onChangeText={setNewDueDate}
                placeholder="YYYY-MM-DD (Misal: 2026-11-15)"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>CATATAN KASBON (OPSIONAL)</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 44 }]}
                value={newNotes}
                onChangeText={setNewNotes}
                placeholder="Misal: Ambil beras 1 karung & minyak"
                placeholderTextColor="#94A3B8"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowAddModal(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalCancelText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, savingNew && { opacity: 0.7 }]}
                  onPress={handleSaveNewDebt}
                  disabled={savingNew}
                  activeOpacity={0.88}
                >
                  <Text style={styles.modalSubmitText}>
                    {savingNew ? "Menyimpan..." : "Simpan Kasbon"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal Detail & Riwayat Cicilan ── */}
      <Modal
        visible={showDetailModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: "85%" }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Detail Catatan Kasbon</Text>
                <Text style={styles.modalSubtitle}>
                  {detailDebt?.customer_name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowDetailModal(false)}
                style={styles.modalCloseBtn}
              >
                <MaterialCommunityIcons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.detailBox}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Total Hutang Awal</Text>
                  <Text style={styles.detailVal}>
                    {formatRupiah(detailDebt?.total_debt || 0)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Sisa Hutang Belum Lunas</Text>
                  <Text
                    style={[
                      styles.detailVal,
                      {
                        color:
                          (Number(detailDebt?.remaining_debt) || 0) <= 0
                            ? "#059669"
                            : "#DC2626",
                        fontFamily: fonts.extraBold,
                      },
                    ]}
                  >
                    {(Number(detailDebt?.remaining_debt) || 0) <= 0
                      ? "Lunas"
                      : formatRupiah(detailDebt?.remaining_debt || 0)}
                  </Text>
                </View>
                {detailDebt?.invoice_number ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Nomor Nota</Text>
                    <Text style={styles.detailVal}>
                      {detailDebt.invoice_number}
                    </Text>
                  </View>
                ) : null}
                {detailDebt?.due_date ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Jatuh Tempo</Text>
                    <Text style={[styles.detailVal, { color: "#D97706" }]}>
                      {detailDebt.due_date}
                    </Text>
                  </View>
                ) : null}
                {detailDebt?.notes ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Catatan</Text>
                    <Text style={styles.detailVal}>{detailDebt.notes}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.historySectionTitle}>
                RIWAYAT PEMBAYARAN & CICILAN
              </Text>
              {!detailDebt?.debt_payments ||
              detailDebt.debt_payments.length === 0 ? (
                <View style={styles.emptyHistoryBox}>
                  <MaterialCommunityIcons
                    name="cash-clock"
                    size={28}
                    color="#94A3B8"
                  />
                  <Text style={styles.noHistoryText}>
                    Belum ada pembayaran cicilan yang dicatat.
                  </Text>
                </View>
              ) : (
                detailDebt.debt_payments.map((p, idx) => (
                  <View key={p.id || idx} style={styles.historyCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyAmount}>
                        {formatRupiah(p.payment_amount)}
                      </Text>
                      <Text style={styles.historyDate}>
                        {new Date(p.created_at).toLocaleString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        • {p.payment_method?.toUpperCase()}
                      </Text>
                      {p.notes ? (
                        <Text style={styles.historyNotes}>
                          Catatan: {p.notes}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.historyBadge}>
                      <Text style={styles.historyBadgeText}>Tercatat</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseFullBtn}
              onPress={() => setShowDetailModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCloseFullText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Panel Kunci Fitur (tier Gratis) ── */}
      <ProLockModal
        visible={showLockModal}
        feature="kasbon"
        onClose={() => setShowLockModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Hero Summary Card ──
  heroSummaryCard: {
    margin: 16,
    marginBottom: 10,
    borderRadius: 20,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    padding: 18,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 5,
  },
  summaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  summaryDotLive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FDE047",
  },
  summaryBadgePillText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.85)",
    letterSpacing: 0.6,
  },
  summaryValue: {
    fontFamily: fonts.extraBold,
    fontSize: 26,
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  summaryIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    marginVertical: 14,
  },
  summaryBottomRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryMiniStat: {
    flex: 1,
  },
  miniStatLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.82)",
  },
  miniStatVal: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: "#FFFFFF",
    marginTop: 2,
  },
  summaryMiniDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    marginHorizontal: 14,
  },

  // ── Filter & Search ──
  filterSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: "#0F172A",
    marginLeft: 8,
    padding: 0,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: "#64748B",
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
  },
  tabCountPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  tabCountPillActive: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  tabCountText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: "#64748B",
  },
  tabCountTextActive: {
    color: "#FFFFFF",
  },

  // ── List & Debt Card ──
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  debtCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    marginBottom: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderPressable: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarUnpaid: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  avatarPaid: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  avatarText: {
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  avatarTextUnpaid: {
    color: colors.primary,
  },
  avatarTextPaid: {
    color: "#059669",
  },
  customerName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: "#0F172A",
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  customerPhone: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#64748B",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeUnpaid: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  badgePaid: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusDotUnpaid: {
    backgroundColor: "#DC2626",
  },
  statusDotPaid: {
    backgroundColor: "#16A34A",
  },
  statusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 0.3,
  },
  textUnpaid: {
    color: "#DC2626",
  },
  textPaid: {
    color: "#16A34A",
  },

  // Debt Details Side-by-side Box
  debtDetailsBox: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    padding: 10,
    marginTop: 10,
    alignItems: "center",
  },
  debtColLeft: {
    flex: 1,
    paddingRight: 6,
  },
  debtColRight: {
    flex: 1,
    paddingLeft: 6,
    alignItems: "flex-end",
  },
  debtDividerV: {
    width: 1,
    height: 36,
    backgroundColor: "#E2E8F0",
  },
  debtColLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: "#64748B",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  debtColValTotal: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#334155",
  },
  debtColValRemaining: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
  },
  invoiceMeta: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 2,
  },
  dueDateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 3,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  dueDateText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: "#D97706",
  },

  // Notes
  notesPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  notesPreviewText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#64748B",
    fontStyle: "italic",
  },

  // Action Buttons
  cardActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  btnActionWA: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingVertical: 9,
    borderRadius: 10,
  },
  btnActionWAText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#15803D",
  },
  btnActionPay: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 9,
    borderRadius: 10,
    elevation: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  btnActionPayText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#FFFFFF",
  },
  // Variasi terkunci (tier Gratis): tetap terlihat, tapi menandai aksi.
  btnActionLocked: {
    backgroundColor: "#94A3B8",
    shadowOpacity: 0.08,
    elevation: 1,
  },
  btnActionHistoryPaid: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  btnActionHistoryPaidText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#059669",
  },
  btnActionHistoryPaidSub: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: "#059669",
  },

  // ── States (Empty / Loading) ──
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  stateTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: "#0F172A",
    marginBottom: 4,
  },
  stateText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },

  // ── Floating Action Button (FAB) ──
  fabBtn: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 28,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  fabBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  fabBtnLocked: {
    backgroundColor: "#64748B",
    shadowOpacity: 0.12,
    elevation: 3,
  },

  // ── Banner Mode Gratis (read-only) ──
  readOnlyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
  },
  readOnlyBannerText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: "#92400E",
    lineHeight: 16,
  },
  readOnlyBannerAction: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: "#92400E",
    textDecorationLine: "underline",
  },

  // ── Modals Common ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    padding: 20,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: "#0F172A",
  },
  modalSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  sisaHutangBanner: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FEE2E2",
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sisaHutangLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#991B1B",
  },
  sisaHutangVal: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: "#DC2626",
    marginTop: 1,
  },
  quickPayFullBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  quickPayFullText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "#15803D",
  },
  inputLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "#475569",
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 8,
  },
  fieldHeaderBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: "#0F172A",
  },
  methodsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  methodChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  methodChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  methodChipText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: "#64748B",
  },
  methodChipTextActive: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
  },
  quickPresetRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    alignItems: "center",
  },
  presetChipText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primary,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: "#64748B",
  },
  modalSubmitBtn: {
    flex: 1.5,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSubmitText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#FFFFFF",
  },

  // Detail Riwayat Box
  detailBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  detailKey: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "#64748B",
  },
  detailVal: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: "#0F172A",
  },
  historySectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "#475569",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  emptyHistoryBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
  },
  noHistoryText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 4,
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    marginBottom: 6,
  },
  historyAmount: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#059669",
  },
  historyDate: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 2,
  },
  historyNotes: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: "#64748B",
    marginTop: 2,
    fontStyle: "italic",
  },
  historyBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historyBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: "#16A34A",
  },
  modalCloseFullBtn: {
    backgroundColor: "#F1F5F9",
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 14,
  },
  modalCloseFullText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#475569",
  },
});

export default BukuKasbonScreen;
