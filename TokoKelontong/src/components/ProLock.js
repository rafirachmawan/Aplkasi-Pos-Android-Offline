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
} from "../config/planConfig";
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
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons
          name="crown-outline"
          size={24}
          color={colors.primaryDark}
        />
      </View>

      <View style={styles.proPill}>
        <Text style={styles.proPillText}>FITUR PRO</Text>
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

      <TouchableOpacity
        style={styles.upgradeBtn}
        onPress={() => void openUpgradeChat()}
        activeOpacity={0.85}
        disabled={!SUPPORT_WHATSAPP}
        accessibilityRole="button"
        accessibilityLabel={
          SUPPORT_WHATSAPP ? "Upgrade ke Pro via WhatsApp" : "Hubungi pengelola"
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
          {SUPPORT_WHATSAPP ? "Upgrade ke Pro via WhatsApp" : "Hubungi pengelola"}
        </Text>
      </TouchableOpacity>

      {SUPPORT_WHATSAPP ? (
        <Text style={styles.hint}>
          {`Pembayaran via WhatsApp ke ${SUPPORT_NAME}. Paket aktif otomatis setelah dikonfirmasi.`}
        </Text>
      ) : (
        <Text style={styles.hint}>
          {
            "Nomor WhatsApp pengelola belum diatur. Hubungi pengelola MarketPos."
          }
        </Text>
      )}

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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 24,
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
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primaryContainer,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  proPill: {
    backgroundColor: colors.primaryContainer,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 10,
  },
  proPillText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.primaryTextDark,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  desc: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textBodySecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
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
    marginTop: 20,
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
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 18,
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
    maxWidth: 380,
    alignSelf: "center",
  },
  closeBtn: {
    marginTop: 14,
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
