import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Linking,
  Modal,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts } from "../theme/colors";
import {
  PRO_FEATURES,
  SUPPORT_WHATSAPP,
  SUPPORT_NAME,
  UPGRADE_MESSAGE,
  PRO_PRICE_ORIGINAL,
  PRO_PRICE_PROMO,
  PRO_PRICE_PERIOD,
} from "../config/planConfig";
import { formatRupiah } from "../utils/helpers";
import usePlan from "../hooks/usePlan";

/**
 * Membuka chat WhatsApp pemilik untuk upgrade / perpanjangan paket Pro.
 * Bila nomor belum diisi, tampilkan pesan bantu di console.
 *
 * CATATAN: sengaja TIDAK memakai Linking.canOpenURL(). App tidak mendeklarasikan
 * LSApplicationQueriesSchemes (iOS) maupun <queries> (Android 11+), sehingga
 * canOpenURL selalu false walau WhatsApp terpasang. Pola openURL + catch fallback
 * ini sama dengan yang dipakai BukuKasbonScreen dan KasirScreen, dan bekerja
 * tanpa perlu mengubah konfigurasi native.
 */
export async function openUpgradeChat() {
  if (!SUPPORT_WHATSAPP) {
    console.warn(
      "SUPPORT_WHATSAPP belum diisi di src/config/planConfig.js",
    );
    return false;
  }

  const phone = String(SUPPORT_WHATSAPP).replace(/\D/g, "");
  const appUrl = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(
    UPGRADE_MESSAGE,
  )}`;
  const webUrl = `https://wa.me/${phone}?text=${encodeURIComponent(
    UPGRADE_MESSAGE,
  )}`;

  try {
    await Linking.openURL(appUrl);
    return true;
  } catch (err) {
    // Aplikasi WhatsApp tidak terpasang: buka versi web.
    try {
      await Linking.openURL(webUrl);
      return true;
    } catch (webErr) {
      console.warn("Gagal membuka WhatsApp:", webErr);
      return false;
    }
  }
}

/**
 * Isi kartu kunci (tanpa pembungkus), dipakai ProLock dan ProLockModal.
 */
function ProLockCard({ feature, plan, onClose }) {
  const meta = PRO_FEATURES[feature] || {
    title: "Fitur Pro",
    description: "Fitur ini tersedia pada paket Pro.",
  };
  const isModal = typeof onClose === "function";

  return (
    <View style={[styles.card, isModal && styles.cardModal]}>
      <View style={styles.proPill}>
        <MaterialCommunityIcons
          name="crown-outline"
          size={14}
          color={colors.primaryDark}
        />
        <Text style={styles.proPillText}>PAKET PRO</Text>
      </View>

      <Text style={styles.title}>{meta.title}</Text>
      <Text style={styles.desc}>{meta.description}</Text>

      {plan.expired ? (
        <View style={styles.expiredTag}>
          <MaterialCommunityIcons
            name="clock-alert-outline"
            size={15}
            color={colors.warningTextDark}
          />
          <Text style={styles.expiredText}>
            Masa aktif Pro Anda sudah berakhir
          </Text>
        </View>
      ) : null}

      <View style={styles.priceBox}>
        <View style={styles.priceRow}>
          <Text style={styles.priceOriginal}>
            {formatRupiah(PRO_PRICE_ORIGINAL)}
          </Text>
          <View style={styles.pricePromoWrap}>
            <Text style={styles.pricePromo}>
              {formatRupiah(PRO_PRICE_PROMO)}
            </Text>
            <Text style={styles.pricePeriod}>{PRO_PRICE_PERIOD}</Text>
          </View>
        </View>
        <Text style={styles.hint}>
          {SUPPORT_WHATSAPP
            ? `Pembayaran via WhatsApp ${SUPPORT_NAME}. Aktif otomatis setelah konfirmasi.`
            : "Nomor WhatsApp pengelola belum diatur. Hubungi pengelola MarketPos."}
        </Text>
      </View>

      <View style={styles.actionsGroup}>
        <TouchableOpacity
          style={styles.upgradeBtn}
          onPress={() => void openUpgradeChat()}
          activeOpacity={0.85}
          disabled={!SUPPORT_WHATSAPP}
          accessibilityRole="button"
          accessibilityLabel={
            SUPPORT_WHATSAPP ? "Upgrade via WhatsApp" : "Hubungi pengelola"
          }
        >
          {SUPPORT_WHATSAPP ? (
            <MaterialCommunityIcons
              name="whatsapp"
              size={18}
              color={colors.onPrimary}
            />
          ) : null}
          <Text style={styles.upgradeText}>
            {SUPPORT_WHATSAPP ? "Upgrade via WhatsApp" : "Hubungi pengelola"}
          </Text>
        </TouchableOpacity>

        {isModal ? (
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Tutup panel fitur Pro"
          >
            <Text style={styles.closeBtnText}>Tutup</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Panel yang menampilkan fitur terkunci pada tier Gratis.
 *
 * ATURAN KERAS:
 * - TIDAK PERNAH menghapus atau menyembunyikan data yang sudah ada.
 * - TIDAK PERNAH memblokir jualan, struk, atau sinkronisasi.
 * - Hanya menggantikan tampilan fitur Pro dengan penjelasan upgrade.
 */
export default function ProLock({ feature, children }) {
  const plan = usePlan();

  // Tier Pro aktif → tampilkan isi fitur apa adanya.
  if (plan.isPro) {
    return children ?? null;
  }

  return (
    <View style={styles.wrap}>
      <ProLockCard feature={feature} plan={plan} />
    </View>
  );
}

/**
 * Versi modal untuk layar yang harus TETAP bisa dibuka saat Gratis
 * (read-only, lihat K-11). Contoh: Buku Kasbon — datanya terlihat,
 * hanya aksi tambah/bayar yang dikunci.
 *
 * Dipakai dengan guard di pemanggil:
 *   if (isReadOnly) { setLockVisible(true); return; }
 */
export function ProLockModal({ visible, feature, onClose }) {
  const plan = usePlan();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalInner}>
          <ProLockCard feature={feature} plan={plan} onClose={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  cardModal: {
    width: "100%",
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  proPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.primaryContainer,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 12,
  },
  proPillText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    letterSpacing: 0.5,
    color: colors.primaryTextDark,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 19,
    color: colors.text,
    textAlign: "center",
  },
  desc: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    color: colors.textBodySecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 19,
    maxWidth: 300,
  },
  expiredTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.warningBannerBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 12,
  },
  expiredText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.warningTextDark,
  },
  priceBox: {
    alignSelf: "stretch",
    alignItems: "center",
    backgroundColor: colors.primaryContainer,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 8,
  },
  priceOriginal: {
    fontFamily: fonts.medium,
    fontSize: 13.5,
    color: colors.textSecondary,
    textDecorationLine: "line-through",
  },
  pricePromoWrap: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  pricePromo: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    color: colors.primaryDark,
    letterSpacing: -0.3,
  },
  pricePeriod: {
    fontFamily: fonts.semiBold,
    fontSize: 12.5,
    color: colors.primaryTextDark,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: colors.primaryTextDark,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 16,
  },
  actionsGroup: {
    alignSelf: "stretch",
    marginTop: 18,
    gap: 10,
  },
  upgradeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    backgroundColor: colors.primaryDark,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignSelf: "stretch",
    ...Platform.select({
      android: { elevation: 2 },
      ios: { shadowColor: colors.primaryDark, shadowOpacity: 0.2, shadowRadius: 6 },
    }),
  },
  upgradeText: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    color: colors.onPrimary,
  },

  // ── Varian modal (dipakai di dalam layar read-only) ──
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlayBackdrop,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalInner: {
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
  },
  closeBtn: {
    minHeight: 44,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textDark,
  },
});
