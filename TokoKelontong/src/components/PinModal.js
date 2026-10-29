import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Vibration,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts } from "../theme/colors";
import { verifyPin } from "../utils/securityPin";

const KEYPAD = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["cancel", "0", "backspace"],
];

const PinModal = ({
  visible,
  title = "Masukkan PIN Pemilik",
  subtitle = "Menu ini dilindungi PIN keamanan",
  onSuccess,
  onCancel,
  targetPin = null, // jika di-pass, mencocokkan ke string ini
}) => {
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (visible) {
      setPin("");
      setErrorMsg("");
    }
  }, [visible]);

  const handleKeyPress = async (key) => {
    setErrorMsg("");
    if (key === "cancel") {
      onCancel?.();
      return;
    }
    if (key === "backspace") {
      setPin((prev) => prev.slice(0, -1));
      return;
    }

    if (pin.length < 4) {
      const nextPin = pin + key;
      setPin(nextPin);

      if (nextPin.length === 4) {
        // Cek PIN
        let isValid = false;
        if (targetPin === "ANY") {
          isValid = true;
        } else if (targetPin !== null) {
          isValid = String(nextPin) === String(targetPin);
        } else {
          isValid = await verifyPin(nextPin);
        }

        if (isValid) {
          setPin("");
          onSuccess?.(nextPin);
        } else {
          Vibration.vibrate(100);
          setErrorMsg(
            targetPin !== null && targetPin !== "ANY"
              ? "PIN konfirmasi tidak cocok!"
              : "PIN salah! Silakan coba lagi.",
          );
          setTimeout(() => {
            setPin("");
          }, 350);
        }
      }
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons
              name="lock-outline"
              size={28}
              color={colors.primary}
            />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {/* Dots Indicator */}
          <View style={styles.dotsRow}>
            {[0, 1, 2, 3].map((idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  pin.length > idx && styles.dotFilled,
                  errorMsg ? styles.dotError : null,
                ]}
              />
            ))}
          </View>

          {/* Error Message */}
          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          {/* Keypad */}
          <View style={styles.keypad}>
            {KEYPAD.map((row, rIdx) => (
              <View key={rIdx} style={styles.keyRow}>
                {row.map((btn) => {
                  if (btn === "cancel") {
                    return (
                      <TouchableOpacity
                        key={btn}
                        style={styles.keyBtnAux}
                        onPress={() => handleKeyPress("cancel")}
                      >
                        <Text style={styles.cancelText}>Batal</Text>
                      </TouchableOpacity>
                    );
                  }
                  if (btn === "backspace") {
                    return (
                      <TouchableOpacity
                        key={btn}
                        style={styles.keyBtnAux}
                        onPress={() => handleKeyPress("backspace")}
                      >
                        <MaterialCommunityIcons
                          name="backspace-outline"
                          size={24}
                          color={colors.text}
                        />
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <TouchableOpacity
                      key={btn}
                      style={styles.keyBtn}
                      onPress={() => handleKeyPress(btn)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.keyText}>{btn}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.text,
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 20,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 14,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    backgroundColor: "transparent",
  },
  dotFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dotError: {
    borderColor: colors.error,
    backgroundColor: colors.error,
  },
  errorText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.error,
    marginBottom: 10,
  },
  keypad: {
    width: "100%",
    marginTop: 8,
  },
  keyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 6,
  },
  keyBtn: {
    width: 72,
    height: 60,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  keyText: {
    fontFamily: fonts.semiBold,
    fontSize: 22,
    color: colors.text,
  },
  keyBtnAux: {
    width: 72,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },
});

export default PinModal;
