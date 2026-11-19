import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import debtRepository from "../database/debtRepository";
import {
  formatRupiah,
  formatToRpInput,
  parseRpInput,
  parseFlexibleDueDate,
  formatDueDateDisplay,
} from "../utils/helpers";
import { colors, fonts } from "../theme/colors";
import usePlan from "../hooks/usePlan";
import { ProLockModal } from "../components/ProLock";
import { useAuth } from "../context/AuthContext";
import { getStoreNameKey } from "../services/sessionStore";

/**
 * Shared header for Buku Kasbon modals with 44x44dp accessible close target.
 */
function ModalHeader({ title, subtitle, onClose, closeLabel }) {
  return (
    <View style={styles.modalHeader}>
      <View style={styles.modalHeaderTextWrap}>
        <Text style={styles.modalTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.modalSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={onClose}
        style={styles.modalCloseBtn}
        hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
        accessibilityRole="button"
        accessibilityLabel={closeLabel || `Tutup ${title}`}
      >
        <MaterialCommunityIcons
          name="close"
          size={20}
          color={colors.textBodySecondary}
        />
      </TouchableOpacity>
    </View>
  );
}

function KasbonSheetBody({
  visible,
  title,
  subtitle,
  onClose,
  closeLabel,
  disabled,
  parentInsets,
  footer,
  children,
}) {
  const modalInsets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (!visible) {
      setKeyboardVisible(false);
      return undefined;
    }
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () =>
      setKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(hideEvent, () =>
      setKeyboardVisible(false),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const effectiveTop = Math.max(modalInsets.top, parentInsets?.top || 0, 28) + 16;
  const effectiveBottom = Math.max(modalInsets.bottom, parentInsets?.bottom || 0);
  const bottomPad = keyboardVisible
    ? 14
    : Platform.OS === "android"
      ? Math.max(effectiveBottom + 18, 52)
      : Math.max(effectiveBottom, 16) + 8;

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[
        styles.modalSheetOverlay,
        {
          paddingTop: effectiveTop,
          paddingLeft: Math.max(modalInsets.left, 0),
          paddingRight: Math.max(modalInsets.right, 0),
        },
      ]}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => !disabled && onClose()}
        accessibilityRole="button"
        accessibilityLabel={closeLabel || `Tutup ${title}`}
      />
      <View style={styles.modalBottomSheet}>
        <View style={styles.modalSheetHandle} />
        <View style={styles.modalSheetHeaderWrap}>
          <ModalHeader
            title={title}
            subtitle={subtitle}
            onClose={() => !disabled && onClose()}
            closeLabel={closeLabel}
          />
        </View>
        <ScrollView
          style={styles.modalSheetScroll}
          contentContainerStyle={styles.modalSheetScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {footer ? (
          <View
            style={[
              styles.modalSheetFooter,
              { paddingBottom: bottomPad },
            ]}
          >
            {footer}
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * Container bottom-sheet seragam untuk modal kasbon agar menutup rapat hingga
 * bagian bawah layar (aman terhadap bilah navigasi Android & keyboard).
 */
function KasbonBottomSheetModal({
  visible,
  title,
  subtitle,
  onClose,
  closeLabel,
  disabled = false,
  insets,
  footer,
  children,
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => !disabled && onClose()}
    >
      <SafeAreaProvider>
        <KasbonSheetBody
          visible={visible}
          title={title}
          subtitle={subtitle}
          onClose={onClose}
          closeLabel={closeLabel}
          disabled={disabled}
          parentInsets={insets}
          footer={footer}
        >
          {children}
        </KasbonSheetBody>
      </SafeAreaProvider>
    </Modal>
  );
}

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
  const [payError, setPayError] = useState("");
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
  const [notesInputHeight, setNotesInputHeight] = useState(54);
  const [addErrors, setAddErrors] = useState({
    name: "",
    amount: "",
    dueDate: "",
    submit: "",
  });
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

  const { profile } = useAuth();
  const activeStoreId = profile?.store_id || profile?.stores?.id || null;
  const [storeName, setStoreName] = useState(
    profile?.stores?.store_name || "MarketPos",
  );

  useFocusEffect(
    useCallback(() => {
      loadData();
      const nameKey = getStoreNameKey(activeStoreId);
      if (nameKey) {
        AsyncStorage.getItem(nameKey).then((val) => {
          setStoreName(val || profile?.stores?.store_name || "MarketPos");
        });
      } else {
        setStoreName(profile?.stores?.store_name || "MarketPos");
      }
    }, [activeStoreId, profile?.stores?.store_name]),
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

  // ── Pratinjau parsing tanggal jatuh tempo bebas (mis. "12 januari" -> "12 Jan 2027") ──
  const parsedDuePreview = parseFlexibleDueDate(newDueDate);

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

    const formattedDue = formatDueDateDisplay(item.due_date);
    const dueDateText = formattedDue ? `📅 Jatuh Tempo: ${formattedDue}\n` : "";
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
    setPayAmountInput(formatToRpInput(String(item.remaining_debt || "")));
    setPayError("");
    setPayMethod("cash");
    setPayNotes("");
    setShowPayModal(true);
  };

  // ── Simpan Pembayaran Kasbon ──
  const handleSavePayment = async () => {
    if (!selectedDebt || paying) return;
    const amount = parseRpInput(payAmountInput);
    if (amount <= 0) {
      setPayError("Masukkan nominal pembayaran terlebih dahulu.");
      return;
    }
    if (amount > selectedDebt.remaining_debt) {
      setPayError(
        `Nominal melebihi sisa tagihan (${formatRupiah(selectedDebt.remaining_debt)}).`,
      );
      return;
    }

    setPayError("");
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
      setPayError(e.message || "Gagal mencatat pembayaran. Silakan coba lagi.");
    } finally {
      setPaying(false);
    }
  };

  // ── Tambah Kasbon Baru Manual ──
  const handleSaveNewDebt = async () => {
    if (savingNew) return;
    const trimmedName = newName.trim();
    const amount = parseRpInput(newAmount);
    const dueResult = parseFlexibleDueDate(newDueDate);

    const nextErrors = {
      name: trimmedName ? "" : "Nama pelanggan wajib diisi.",
      amount: amount > 0 ? "" : "Masukkan nominal kasbon lebih dari Rp0.",
      dueDate: dueResult.valid ? "" : dueResult.error,
      submit: "",
    };

    if (nextErrors.name || nextErrors.amount || nextErrors.dueDate) {
      setAddErrors(nextErrors);
      return;
    }

    setAddErrors({ name: "", amount: "", dueDate: "", submit: "" });
    setSavingNew(true);
    try {
      await debtRepository.createDebt({
        customer_name: trimmedName,
        customer_phone: newPhone.trim(),
        total_debt: amount,
        remaining_debt: amount,
        due_date: dueResult.iso,
        notes: newNotes.trim(),
      });

      setShowAddModal(false);
      setNewName("");
      setNewPhone("");
      setNewAmount("");
      setNewDueDate("");
      setNewNotes("");
      setNotesInputHeight(54);
      Alert.alert("✅ Sukses", "Catatan kasbon baru berhasil disimpan.");
      loadData();
    } catch (e) {
      setAddErrors((prev) => ({
        ...prev,
        submit: e.message || "Gagal menyimpan kasbon. Data masih aman, silakan coba lagi.",
      }));
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
                <Text style={styles.dueDateText}>
                  Jatuh Tempo: {formatDueDateDisplay(item.due_date)}
                </Text>
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
      {!(showPayModal || showAddModal || showDetailModal || showLockModal) ? (
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
            setNotesInputHeight(54);
            setAddErrors({ name: "", amount: "", dueDate: "", submit: "" });
            setShowAddModal(true);
          }}
          activeOpacity={0.88}
        >
          <Text style={styles.fabBtnText}>
            {isReadOnly ? "Catat Kasbon (Pro)" : "+ Catat Kasbon"}
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* ── Modal Bayar Kasbon / Cicil ── */}
      <KasbonBottomSheetModal
        visible={showPayModal}
        title="Bayar / Cicil Kasbon"
        subtitle={
          selectedDebt?.customer_name
            ? `Pelanggan: ${selectedDebt.customer_name}`
            : ""
        }
        onClose={() => setShowPayModal(false)}
        closeLabel="Tutup modal pembayaran kasbon"
        disabled={paying}
        insets={insets}
        footer={
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowPayModal(false)}
              disabled={paying}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={styles.modalCancelText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSubmitBtn, paying && { opacity: 0.85 }]}
              onPress={handleSavePayment}
              disabled={paying}
              activeOpacity={0.88}
              accessibilityRole="button"
            >
              {paying ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : null}
              <Text style={styles.modalSubmitText}>
                {paying ? "Menyimpan..." : "Simpan Pembayaran"}
              </Text>
            </TouchableOpacity>
          </View>
        }
      >
        <View style={styles.sisaHutangBanner}>
          <View style={styles.sisaHutangTextWrap}>
            <Text style={styles.sisaHutangLabel}>
              Sisa hutang saat ini
            </Text>
            <Text style={styles.sisaHutangVal}>
              {formatRupiah(selectedDebt?.remaining_debt || 0)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.quickPayFullBtn}
            onPress={() => {
              setPayAmountInput(
                formatToRpInput(String(selectedDebt?.remaining_debt || 0)),
              );
              if (payError) setPayError("");
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Isi nominal bayar lunas"
          >
            <Text style={styles.quickPayFullText}>Bayar Lunas</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.inputLabel}>
          Nominal pembayaran <Text style={styles.requiredMark}>*</Text>
        </Text>
        <TextInput
          style={[
            styles.modalInput,
            styles.modalInputAmount,
            Boolean(payError) && styles.modalInputError,
          ]}
          value={payAmountInput}
          onChangeText={(val) => {
            setPayAmountInput(formatToRpInput(val));
            if (payError) setPayError("");
          }}
          keyboardType="number-pad"
          placeholder="Rp0"
          placeholderTextColor={colors.textMuted}
        />
        {payError ? (
          <Text style={styles.fieldError}>{payError}</Text>
        ) : (
          <Text style={styles.fieldHelper}>
            Otomatis diformat ke Rupiah, contoh: Rp50.000
          </Text>
        )}

        <Text style={styles.inputLabel}>Metode pembayaran</Text>
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
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
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

        <Text style={styles.inputLabel}>Catatan (opsional)</Text>
        <TextInput
          style={styles.modalInput}
          value={payNotes}
          onChangeText={setPayNotes}
          placeholder="Misal: Cicilan ke-1"
          placeholderTextColor={colors.textMuted}
        />
      </KasbonBottomSheetModal>

      {/* ── Modal Catat Kasbon Baru Manual ── */}
      <KasbonBottomSheetModal
        visible={showAddModal}
        title="Catat Kasbon Baru"
        subtitle="Catat piutang pelanggan secara manual"
        onClose={() => setShowAddModal(false)}
        closeLabel="Tutup modal catat kasbon"
        disabled={savingNew}
        insets={insets}
        footer={
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowAddModal(false)}
              disabled={savingNew}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={styles.modalCancelText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSubmitBtn, savingNew && { opacity: 0.85 }]}
              onPress={handleSaveNewDebt}
              disabled={savingNew}
              activeOpacity={0.88}
              accessibilityRole="button"
            >
              {savingNew ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : null}
              <Text style={styles.modalSubmitText}>
                {savingNew ? "Menyimpan..." : "Simpan Kasbon"}
              </Text>
            </TouchableOpacity>
          </View>
        }
      >
        <Text style={styles.formSectionLabel}>Data utama</Text>

        <Text style={styles.inputLabel}>
          Nama pelanggan <Text style={styles.requiredMark}>*</Text>
        </Text>
        <TextInput
          style={[
            styles.modalInput,
            Boolean(addErrors.name) && styles.modalInputError,
          ]}
          value={newName}
          onChangeText={(v) => {
            setNewName(v);
            if (addErrors.name || addErrors.submit) {
              setAddErrors((prev) => ({
                ...prev,
                name: "",
                submit: "",
              }));
            }
          }}
          autoCapitalize="words"
          returnKeyType="next"
          placeholder="Misal: Pak Budi"
          placeholderTextColor={colors.textMuted}
        />
        {addErrors.name ? (
          <Text style={styles.fieldError}>{addErrors.name}</Text>
        ) : null}

        <Text style={styles.inputLabel}>
          Nominal kasbon <Text style={styles.requiredMark}>*</Text>
        </Text>
        <TextInput
          style={[
            styles.modalInput,
            styles.modalInputAmount,
            Boolean(addErrors.amount) && styles.modalInputError,
          ]}
          value={newAmount}
          onChangeText={(v) => {
            setNewAmount(formatToRpInput(v));
            if (addErrors.amount || addErrors.submit) {
              setAddErrors((prev) => ({
                ...prev,
                amount: "",
                submit: "",
              }));
            }
          }}
          keyboardType="number-pad"
          placeholder="Rp0"
          placeholderTextColor={colors.textMuted}
        />
        {addErrors.amount ? (
          <Text style={styles.fieldError}>{addErrors.amount}</Text>
        ) : (
          <Text style={styles.fieldHelper}>
            Otomatis diformat ke Rupiah, contoh: Rp50.000
          </Text>
        )}

        <View style={styles.optionalSection}>
          <Text style={styles.formSectionLabel}>
            Detail tambahan (opsional)
          </Text>

          <Text style={styles.inputLabel}>No. WhatsApp / HP</Text>
          <TextInput
            style={styles.modalInput}
            value={newPhone}
            onChangeText={setNewPhone}
            keyboardType="phone-pad"
            placeholder="Misal: 08123456789"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.fieldHelper}>
            Untuk mengirim pengingat tagihan via WhatsApp
          </Text>

          <Text style={styles.inputLabel}>Jatuh tempo (opsional)</Text>
          <TextInput
            style={[
              styles.modalInput,
              Boolean(addErrors.dueDate) && styles.modalInputError,
            ]}
            value={newDueDate}
            onChangeText={(v) => {
              setNewDueDate(v);
              if (addErrors.dueDate || addErrors.submit) {
                setAddErrors((prev) => ({
                  ...prev,
                  dueDate: "",
                  submit: "",
                }));
              }
            }}
            onBlur={() => {
              const res = parseFlexibleDueDate(newDueDate);
              if (!res.valid) {
                setAddErrors((prev) => ({ ...prev, dueDate: res.error }));
              }
            }}
            autoCapitalize="none"
            placeholder="Misal: 12 Januari atau 12-01"
            placeholderTextColor={colors.textMuted}
          />
          {addErrors.dueDate ? (
            <Text style={styles.fieldError}>{addErrors.dueDate}</Text>
          ) : newDueDate.trim() &&
            parsedDuePreview.valid &&
            parsedDuePreview.display ? (
            <Text style={styles.fieldSuccess}>
              Terjadwal jatuh tempo: {parsedDuePreview.display}
            </Text>
          ) : (
            <Text style={styles.fieldHelper}>
              Boleh kosong, atau tulis bebas seperti 12 Januari, 12-01, atau besok
            </Text>
          )}

          <Text style={styles.inputLabel}>Catatan</Text>
          <TextInput
            style={[
              styles.modalInput,
              styles.notesInput,
              { height: Math.max(54, notesInputHeight) },
            ]}
            value={newNotes}
            onChangeText={setNewNotes}
            multiline
            textAlignVertical="top"
            onContentSizeChange={(e) => {
              const nextH = Math.round(
                e.nativeEvent.contentSize.height + 16,
              );
              setNotesInputHeight(Math.min(110, Math.max(54, nextH)));
            }}
            placeholder="Misal: Ambil beras 1 karung & minyak"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {addErrors.submit ? (
          <View style={styles.submitErrorBox}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={16}
              color={colors.errorDark}
            />
            <Text style={styles.submitErrorText}>{addErrors.submit}</Text>
          </View>
        ) : null}
      </KasbonBottomSheetModal>

      {/* ── Modal Detail & Riwayat Cicilan ── */}
      <KasbonBottomSheetModal
        visible={showDetailModal}
        title="Detail Catatan Kasbon"
        subtitle={detailDebt?.customer_name}
        onClose={() => setShowDetailModal(false)}
        closeLabel="Tutup detail kasbon"
        insets={insets}
        footer={
          <TouchableOpacity
            style={styles.modalCloseFullBtn}
            onPress={() => setShowDetailModal(false)}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Text style={styles.modalCloseFullText}>Tutup</Text>
          </TouchableOpacity>
        }
      >
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
                {formatDueDateDisplay(detailDebt.due_date)}
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
      </KasbonBottomSheetModal>

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

  // ── Modals Common (Bottom Sheet) ──
  modalSheetOverlay: {
    flex: 1,
    backgroundColor: colors.overlayBackdrop,
    justifyContent: "flex-end",
  },
  modalBottomSheet: {
    width: "100%",
    maxWidth: 600,
    maxHeight: "100%",
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 16,
  },
  modalSheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  modalSheetHeaderWrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalSheetScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  modalSheetScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
  },
  modalSheetFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 0,
  },
  modalHeaderTextWrap: {
    flex: 1,
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.text,
  },
  modalSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  sisaHutangBanner: {
    backgroundColor: colors.errorSoftBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.errorBannerBg,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  sisaHutangTextWrap: {
    flex: 1,
  },
  sisaHutangLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.errorTextDark,
  },
  sisaHutangVal: {
    fontFamily: fonts.extraBold,
    fontSize: 17,
    color: colors.errorDark,
    marginTop: 2,
  },
  quickPayFullBtn: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.successBadgeBg,
    borderWidth: 1,
    borderColor: colors.successSoftBorder,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  quickPayFullText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.successDark,
  },
  formSectionLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  optionalSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 16,
    paddingTop: 14,
  },
  inputLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textDark,
    marginBottom: 6,
    marginTop: 10,
  },
  requiredMark: {
    color: colors.errorDark,
    fontFamily: fonts.bold,
  },
  modalInput: {
    minHeight: 48,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
  },
  modalInputAmount: {
    minHeight: 52,
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.text,
  },
  modalInputError: {
    borderColor: colors.errorDark,
    backgroundColor: colors.errorContainer,
  },
  notesInput: {
    paddingTop: 12,
    paddingBottom: 12,
  },
  fieldHelper: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
    marginTop: 5,
  },
  fieldSuccess: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.successText,
    marginTop: 5,
  },
  fieldError: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.errorDark,
    marginTop: 5,
  },
  submitErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.errorContainer,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
  },
  submitErrorText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.errorTextDark,
  },
  methodsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  methodChip: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
  },
  methodChipActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  methodChipText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textDark,
  },
  methodChipTextActive: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 0,
  },
  modalCancelBtn: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textDark,
  },
  modalSubmitBtn: {
    flex: 1.5,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.primaryDark,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSubmitText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.onPrimary,
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
    minHeight: 48,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseFullText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textDark,
  },
});

export default BukuKasbonScreen;
