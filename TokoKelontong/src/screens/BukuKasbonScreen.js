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
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import debtRepository from "../database/debtRepository";
import { formatRupiah } from "../utils/helpers";
import { colors, fonts } from "../theme/colors";

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
  const [debts, setDebts] = useState([]);
  const [summary, setSummary] = useState({
    totalUnpaidDebt: 0,
    unpaidCustomerCount: 0,
    totalRecords: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("unpaid"); // 'all' | 'unpaid' | 'paid'
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

  const [storeName, setStoreName] = useState("MarketPos");

  useFocusEffect(
    useCallback(() => {
      loadData();
      AsyncStorage.getItem("storeName").then((val) => {
        if (val) setStoreName(val);
      });
    }, [activeTab]),
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await debtRepository.getDebts(activeTab);
      setDebts(data);
      const summ = await debtRepository.getDebtSummary();
      setSummary(summ);
    } catch (e) {
      console.error("Gagal memuat kasbon:", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredDebts = debts.filter((d) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const matchName = (d.customer_name || "").toLowerCase().includes(q);
    const matchPhone = (d.customer_phone || "").toLowerCase().includes(q);
    const matchInvoice = (d.invoice_number || "").toLowerCase().includes(q);
    return matchName || matchPhone || matchInvoice;
  });

  // ── Kirim Pengingat Tagihan via WhatsApp ──
  const handleSendReminderWA = (item) => {
    const phone = (item.customer_phone || "").replace(/\D/g, "");
    if (!phone) {
      Alert.prompt
        ? Alert.prompt(
            "Nomor WhatsApp Pelanggan",
            "Masukkan nomor WhatsApp pelanggan (contoh: 08123456789):",
            [
              { text: "Batal", style: "cancel" },
              {
                text: "Kirim",
                onPress: (input) => {
                  if (input) sendWAMessageToPhone(item, input);
                },
              },
            ],
            "plain-text",
            "",
            "phone-pad",
          )
        : Alert.alert(
            "Nomor Tidak Tersedia",
            "Catatan kasbon ini belum memiliki nomor telepon pelanggan.",
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
    const isPaid = item.status === "paid" || item.remaining_debt <= 0;
    const initial = (item.customer_name || "P").charAt(0).toUpperCase();

    return (
      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.debtCard}
        onPress={() => openDetail(item)}
      >
        <View style={styles.debtCardHeader}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.customerName} numberOfLines={1}>
                {item.customer_name}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  isPaid ? styles.badgePaid : styles.badgeUnpaid,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    isPaid ? styles.textPaid : styles.textUnpaid,
                  ]}
                >
                  {isPaid ? "LUNAS" : "BELUM LUNAS"}
                </Text>
              </View>
            </View>
            <Text style={styles.customerPhone}>
              {item.customer_phone ? `📱 ${item.customer_phone}` : "Tanpa No. Telepon"}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.remainingLabel}>Sisa Hutang</Text>
            <Text
              style={[
                styles.remainingValue,
                isPaid ? { color: colors.success } : { color: "#EF4444" },
              ]}
            >
              {formatRupiah(item.remaining_debt)}
            </Text>
          </View>
        </View>

        {/* Info Tambahan */}
        <View style={styles.infoRow}>
          <Text style={styles.infoMeta}>
            {item.invoice_number ? `Nota: ${item.invoice_number} • ` : ""}
            Total: {formatRupiah(item.total_debt)}
          </Text>
          {item.due_date ? (
            <Text style={styles.dueDateText}>Jatuh Tempo: {item.due_date}</Text>
          ) : null}
        </View>

        {/* Action Buttons */}
        {!isPaid && (
          <View style={styles.cardActionsRow}>
            <TouchableOpacity
              style={styles.btnActionWA}
              onPress={() => handleSendReminderWA(item)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="whatsapp" size={16} color="#15803D" />
              <Text style={styles.btnActionWAText}>Ingatkan WA</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnActionPay}
              onPress={() => openPayModal(item)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="cash-multiple"
                size={16}
                color="#FFFFFF"
              />
              <Text style={styles.btnActionPayText}>Bayar / Cicil</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Summary Hero Card ── */}
      <View style={styles.heroSummaryCard}>
        <View style={styles.summaryTop}>
          <View>
            <Text style={styles.summaryLabel}>TOTAL PIUTANG BELUM LUNAS</Text>
            <Text style={styles.summaryValue}>
              {formatRupiah(summary.totalUnpaidDebt)}
            </Text>
          </View>
          <View style={styles.summaryBadge}>
            <MaterialCommunityIcons
              name="book-account-outline"
              size={24}
              color="#FFFFFF"
            />
          </View>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryBottomRow}>
          <View style={styles.summaryMiniStat}>
            <Text style={styles.miniStatLabel}>Pelanggan Berhutang</Text>
            <Text style={styles.miniStatVal}>
              {summary.unpaidCustomerCount} Orang
            </Text>
          </View>
          <View style={styles.summaryMiniDivider} />
          <View style={styles.summaryMiniStat}>
            <Text style={styles.miniStatLabel}>Total Catatan</Text>
            <Text style={styles.miniStatVal}>{summary.totalRecords} Nota</Text>
          </View>
        </View>
      </View>

      {/* ── Search Bar & Filter ── */}
      <View style={styles.filterSection}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama atau telepon pelanggan..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color="#94A3B8"
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Filter */}
        <View style={styles.tabsRow}>
          {[
            { key: "unpaid", label: "Belum Lunas" },
            { key: "paid", label: "Lunas" },
            { key: "all", label: "Semua" },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabBtn,
                activeTab === tab.key && styles.tabBtnActive,
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === tab.key && styles.tabBtnTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── List Kasbon ── */}
      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.stateText}>Memuat data kasbon...</Text>
        </View>
      ) : filteredDebts.length === 0 ? (
        <View style={styles.centerState}>
          <MaterialCommunityIcons
            name="check-circle-outline"
            size={48}
            color="#94A3B8"
          />
          <Text style={styles.stateTitle}>Tidak Ada Catatan Kasbon</Text>
          <Text style={styles.stateText}>
            {searchQuery
              ? "Tidak ada hasil yang cocok dengan pencarian."
              : activeTab === "unpaid"
                ? "Hebat! Semua kasbon pelanggan sudah lunas."
                : "Belum ada catatan kasbon tercatat."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredDebts}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderDebtItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Floating Add Button ── */}
      <TouchableOpacity
        style={styles.fabBtn}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.88}
      >
        <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
        <Text style={styles.fabBtnText}>Catat Kasbon</Text>
      </TouchableOpacity>

      {/* ── Modal Bayar Kasbon / Cicil ── */}
      <Modal visible={showPayModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Bayar / Cicil Kasbon</Text>
                <Text style={styles.modalSubtitle}>
                  Pelanggan: {selectedDebt?.customer_name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowPayModal(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.sisaHutangBanner}>
              <Text style={styles.sisaHutangLabel}>Sisa Hutang Saat Ini:</Text>
              <Text style={styles.sisaHutangVal}>
                {formatRupiah(selectedDebt?.remaining_debt || 0)}
              </Text>
            </View>

            <Text style={styles.inputLabel}>Nominal Pembayaran (Rp)</Text>
            <TextInput
              style={styles.modalInput}
              value={payAmountInput}
              onChangeText={(val) => setPayAmountInput(formatToRp(val))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#94A3B8"
            />

            {/* Quick Button: Lunasi Semua */}
            <TouchableOpacity
              style={styles.quickPayFullBtn}
              onPress={() =>
                setPayAmountInput(
                  formatToRp(String(selectedDebt?.remaining_debt || 0)),
                )
              }
            >
              <Text style={styles.quickPayFullText}>
                ⚡ Bayar Lunas (
                {formatRupiah(selectedDebt?.remaining_debt || 0)})
              </Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Metode Pembayaran</Text>
            <View style={styles.methodsRow}>
              {[
                { id: "cash", label: "Tunai" },
                { id: "transfer", label: "Transfer" },
                { id: "qris", label: "QRIS" },
              ].map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.methodChip,
                    payMethod === m.id && styles.methodChipActive,
                  ]}
                  onPress={() => setPayMethod(m.id)}
                >
                  <Text
                    style={[
                      styles.methodChipText,
                      payMethod === m.id && styles.methodChipTextActive,
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Catatan (Opsional)</Text>
            <TextInput
              style={[styles.modalInput, { height: 40 }]}
              value={payNotes}
              onChangeText={setPayNotes}
              placeholder="Misal: Cicilan ke-1"
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowPayModal(false)}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, paying && { opacity: 0.7 }]}
                onPress={handleSavePayment}
                disabled={paying}
              >
                <Text style={styles.modalSubmitText}>
                  {paying ? "Menyimpan..." : "Simpan Pembayaran"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal Catat Kasbon Baru Manual ── */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Catat Kasbon Baru</Text>
                  <Text style={styles.modalSubtitle}>
                    Pencatatan piutang pelanggan langsung
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <MaterialCommunityIcons name="close" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Nama Pelanggan *</Text>
              <TextInput
                style={styles.modalInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="Contoh: Pak Budi"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>No. WhatsApp / Telepon (Opsional)</Text>
              <TextInput
                style={styles.modalInput}
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
                placeholder="08123456789"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Nominal Kasbon (Rp) *</Text>
              <TextInput
                style={styles.modalInput}
                value={newAmount}
                onChangeText={(v) => setNewAmount(formatToRp(v))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Jatuh Tempo (Opsional)</Text>
              <TextInput
                style={styles.modalInput}
                value={newDueDate}
                onChangeText={setNewDueDate}
                placeholder="YYYY-MM-DD (Misal: 2026-11-05)"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Catatan Kasbon (Opsional)</Text>
              <TextInput
                style={[styles.modalInput, { height: 44 }]}
                value={newNotes}
                onChangeText={setNewNotes}
                placeholder="Misal: Ambil beras 1 karung & minyak"
                placeholderTextColor="#94A3B8"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowAddModal(false)}
                >
                  <Text style={styles.modalCancelText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, savingNew && { opacity: 0.7 }]}
                  onPress={handleSaveNewDebt}
                  disabled={savingNew}
                >
                  <Text style={styles.modalSubmitText}>
                    {savingNew ? "Menyimpan..." : "Simpan Kasbon"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Modal Detail & Riwayat Cicilan ── */}
      <Modal visible={showDetailModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Detail Catatan Kasbon</Text>
                <Text style={styles.modalSubtitle}>
                  {detailDebt?.customer_name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#64748B" />
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
                          detailDebt?.remaining_debt === 0
                            ? colors.success
                            : "#EF4444",
                        fontFamily: fonts.bold,
                      },
                    ]}
                  >
                    {formatRupiah(detailDebt?.remaining_debt || 0)}
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
                    <Text style={styles.detailVal}>{detailDebt.due_date}</Text>
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
              {(!detailDebt?.debt_payments ||
                detailDebt.debt_payments.length === 0) ? (
                <Text style={styles.noHistoryText}>
                  Belum ada catatan cicilan untuk kasbon ini.
                </Text>
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
            >
              <Text style={styles.modalCloseFullText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  heroSummaryCard: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 20,
    backgroundColor: "#0F172A",
    padding: 18,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  summaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: "#94A3B8",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontFamily: fonts.extraBold,
    fontSize: 24,
    color: "#F8FAFC",
  },
  summaryBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
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
    color: "#94A3B8",
  },
  miniStatVal: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: "#FFFFFF",
    marginTop: 2,
  },
  summaryMiniDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginHorizontal: 12,
  },

  // Filter
  filterSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    height: 42,
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
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  tabBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: "#64748B",
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
  },

  // List
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  debtCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    marginBottom: 10,
  },
  debtCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.primary,
  },
  customerName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: "#0F172A",
  },
  customerPhone: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  badgeUnpaid: {
    backgroundColor: "#FEF2F2",
  },
  badgePaid: {
    backgroundColor: "#DCFCE7",
  },
  statusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
  },
  textUnpaid: {
    color: "#DC2626",
  },
  textPaid: {
    color: "#16A34A",
  },
  remainingLabel: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: "#94A3B8",
  },
  remainingValue: {
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  infoMeta: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#64748B",
  },
  dueDateText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#D97706",
  },
  cardActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  btnActionWA: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#DCFCE7",
    paddingVertical: 8,
    borderRadius: 8,
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
    backgroundColor: "#0F172A",
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnActionPayText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#FFFFFF",
  },

  // Empty / Loading
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  stateTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: "#0F172A",
    marginTop: 12,
  },
  stateText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
  },

  // FAB
  fabBtn: {
    position: "absolute",
    bottom: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 28,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  fabBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#FFFFFF",
  },

  // Modal Common
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
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
  sisaHutangBanner: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sisaHutangLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: "#991B1B",
  },
  sisaHutangVal: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: "#DC2626",
  },
  inputLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#475569",
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: "#0F172A",
  },
  quickPayFullBtn: {
    backgroundColor: "#DCFCE7",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 6,
    marginBottom: 4,
  },
  quickPayFullText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "#15803D",
  },
  methodsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  methodChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  methodChipActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  methodChipText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: "#64748B",
  },
  methodChipTextActive: {
    color: "#FFFFFF",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
  },
  modalCancelText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: "#64748B",
  },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#0F172A",
    alignItems: "center",
  },
  modalSubmitText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#FFFFFF",
  },

  // Detail Modal
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
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  noHistoryText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "#94A3B8",
    fontStyle: "italic",
    paddingVertical: 6,
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    padding: 10,
    marginBottom: 6,
  },
  historyAmount: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.success,
  },
  historyDate: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 2,
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
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  modalCloseFullText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#475569",
  },
});

export default BukuKasbonScreen;
