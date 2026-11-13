import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
function ProLockCard({ feature, plan }) {
  const meta = PRO_FEATURES[feature] || {
    title: "Fitur Pro",
    description: "Fitur ini tersedia pada paket Pro.",
  };

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons
          name="crown-outline"
          size={26}
          color={colors.warning}
        />
      </View>

      <Text style={styles.title}>{meta.title}</Text>
      <Text style={styles.desc}>{meta.description}</Text>

      {plan.expired ? (
        <View style={styles.expiredTag}>
          <MaterialCommunityIcons
            name="clock-alert-outline"
            size={13}
            color="#92400E"
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
      >
        <MaterialCommunityIcons
          name="whatsapp"
          size={17}
          color="#FFFFFF"
        />
        <Text style={styles.upgradeText}>
          {SUPPORT_WHATSAPP ? "Upgrade ke Pro" : "Hubungi pengelola"}
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
        <View style={styles.modalInner}>
          <ProLockCard feature={feature} plan={plan} />

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.closeBtnText}>Tutup</Text>
          </TouchableOpacity>
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  desc: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 7,
    lineHeight: 19,
  },
  expiredTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 14,
  },
  expiredText: {
    fontFamily: fonts.semiBold,
    fontSize: 11.5,
    color: "#92400E",
  },
  upgradeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#15803D",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 22,
    marginTop: 20,
    alignSelf: "stretch",
    ...Platform.select({
      android: { elevation: 1 },
      ios: { shadowColor: "#15803D", shadowOpacity: 0.2, shadowRadius: 6 },
    }),
  },
  upgradeText: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    color: "#FFFFFF",
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 17,
  },

  // ── Varian modal (dipakai di dalam layar read-only) ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalInner: {
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
  },
  closeBtn: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  closeBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: "#FFFFFF",
  },
});
