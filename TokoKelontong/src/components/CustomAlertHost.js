import React, { useState, useEffect, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Pressable,
  Platform,
} from "react-native";
import { colors, fonts } from "../theme/colors";

let globalShowAlert = null;
const pendingQueue = [];

// Strip leading emojis so titles stay clean and professional
const cleanTitleText = (raw = "") =>
  String(raw)
    .replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\s]+/u, "")
    .trim();

// Override Alert.alert globally so all alerts use the modern custom modal
const originalAlert = Alert.alert;
Alert.alert = (title, message, buttons, options) => {
  const payload = {
    title: cleanTitleText(title || "Informasi"),
    message: message ? String(message) : "",
    buttons:
      Array.isArray(buttons) && buttons.length > 0
        ? buttons
        : [{ text: "Mengerti", style: "default" }],
    options: options || {},
  };

  if (globalShowAlert) {
    globalShowAlert(payload);
  } else {
    pendingQueue.push(payload);
  }
};

export { originalAlert };

const CustomAlertHost = () => {
  const [currentAlert, setCurrentAlert] = useState(null);

  const showNext = useCallback((payload) => {
    setCurrentAlert((prev) => {
      if (prev) {
        pendingQueue.push(payload);
        return prev;
      }
      return payload;
    });
  }, []);

  useEffect(() => {
    globalShowAlert = showNext;
    if (pendingQueue.length > 0 && !currentAlert) {
      const next = pendingQueue.shift();
      setCurrentAlert(next);
    }
    return () => {
      if (globalShowAlert === showNext) {
        globalShowAlert = null;
      }
    };
  }, [showNext, currentAlert]);

  const handleClose = (callback) => {
    setCurrentAlert(null);
    setTimeout(() => {
      if (typeof callback === "function") {
        callback();
      }
      if (pendingQueue.length > 0) {
        const next = pendingQueue.shift();
        setCurrentAlert(next);
      }
    }, 150);
  };

  if (!currentAlert) return null;

  const { title, message, buttons, options } = currentAlert;
  const hasDestructive = buttons.some((b) => b.style === "destructive");
  const lowerTitle = title.toLowerCase();
  const isError =
    lowerTitle.includes("gagal") ||
    lowerTitle.includes("error") ||
    lowerTitle.includes("kesalahan");
  const isSuccess =
    lowerTitle.includes("sukses") || lowerTitle.includes("berhasil");

  const accentColor =
    hasDestructive || isError
      ? "#DC2626"
      : isSuccess
        ? "#059669"
        : colors.primary;

  const badgeBg =
    hasDestructive || isError
      ? "#FFF1F2"
      : isSuccess
        ? "#ECFDF5"
        : "#FFF7ED";

  const badgeBorder =
    hasDestructive || isError
      ? "#FECDD3"
      : isSuccess
        ? "#A7F3D0"
        : "#FED7AA";

  const badgeLabel = hasDestructive
    ? "KONFIRMASI"
    : isError
      ? "PERHATIAN"
      : isSuccess
        ? "BERHASIL"
        : "INFORMASI";

  const isTwoButtons = buttons.length === 2;
  const isMultiStack = buttons.length > 2;

  // Sort 3+ buttons so "cancel" appears at the bottom
  const orderedButtons = isMultiStack
    ? [
        ...buttons.filter((b) => b.style !== "cancel"),
        ...buttons.filter((b) => b.style === "cancel"),
      ]
    : buttons;

  return (
    <Modal
      visible={Boolean(currentAlert)}
      transparent
      animationType={Platform.OS === "android" ? "none" : "fade"}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => {
        if (options?.cancelable !== false) {
          const cancelBtn = buttons.find((b) => b.style === "cancel");
          handleClose(cancelBtn?.onPress || options?.onDismiss);
        }
      }}
    >
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          if (options?.cancelable) {
            const cancelBtn = buttons.find((b) => b.style === "cancel");
            handleClose(cancelBtn?.onPress || options?.onDismiss);
          }
        }}
      >
        <Pressable style={styles.dialogCard} onPress={() => {}}>
          {/* Top Tag Pill */}
          <View
            style={[
              styles.statusPill,
              { backgroundColor: badgeBg, borderColor: badgeBorder },
            ]}
          >
            <View
              style={[styles.statusDot, { backgroundColor: accentColor }]}
            />
            <Text style={[styles.statusPillText, { color: accentColor }]}>
              {badgeLabel}
            </Text>
          </View>

          {/* Title */}
          <Text style={styles.titleText}>{title}</Text>

          {/* Message */}
          {Boolean(message) && (
            <Text style={styles.messageText}>{message}</Text>
          )}

          {/* Action Buttons */}
          <View
            style={[
              styles.actionsContainer,
              isTwoButtons && styles.actionsRow,
              isMultiStack && styles.actionsColumn,
            ]}
          >
            {orderedButtons.map((btn, idx) => {
              const isCancel = btn.style === "cancel";
              const isDestructive = btn.style === "destructive";

              return (
                <TouchableOpacity
                  key={`${btn.text || "btn"}-${idx}`}
                  style={[
                    styles.actionBtn,
                    isTwoButtons && { flex: 1 },
                    isCancel
                      ? styles.actionBtnCancel
                      : isDestructive
                        ? styles.actionBtnDestructive
                        : isSuccess && buttons.length === 1
                          ? styles.actionBtnSuccess
                          : styles.actionBtnPrimary,
                  ]}
                  activeOpacity={0.82}
                  onPress={() => handleClose(btn.onPress)}
                >
                  <Text
                    style={[
                      styles.actionBtnText,
                      isCancel
                        ? styles.actionBtnTextCancel
                        : styles.actionBtnTextSolid,
                    ]}
                    numberOfLines={1}
                  >
                    {btn.text || "OK"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  dialogCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  statusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  titleText: {
    fontFamily: fonts.extraBold,
    fontSize: 17,
    color: "#0F172A",
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  messageText: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    color: "#475569",
    lineHeight: 20,
    marginBottom: 20,
  },
  actionsContainer: {
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionsColumn: {
    flexDirection: "column",
    gap: 8,
  },
  actionBtn: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnPrimary: {
    backgroundColor: colors.primary,
  },
  actionBtnDestructive: {
    backgroundColor: "#DC2626",
  },
  actionBtnSuccess: {
    backgroundColor: "#059669",
  },
  actionBtnCancel: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  actionBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    letterSpacing: 0.2,
  },
  actionBtnTextSolid: {
    color: "#FFFFFF",
  },
  actionBtnTextCancel: {
    color: "#475569",
  },
});

export default CustomAlertHost;
