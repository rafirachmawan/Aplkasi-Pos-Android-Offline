import React from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../theme/colors";

/**
 * Pil status koneksi bersama (Online / Offline / Sinkron...) untuk header layar.
 */
const ConnectionStatusPill = ({
  offline = false,
  syncing = false,
  onPress,
  style,
}) => {
  const pillStyle = offline
    ? styles.pillOffline
    : syncing
      ? styles.pillSyncing
      : styles.pillOnline;

  const dotColor = offline
    ? colors.warningDot
    : syncing
      ? colors.primary
      : colors.success;

  const textStyle = offline
    ? styles.textOffline
    : syncing
      ? styles.textSyncing
      : styles.textOnline;

  const label = offline ? "Offline" : syncing ? "Sinkron..." : "Online";

  const a11yLabel = offline
    ? "Status koneksi offline. Ketuk untuk periksa antrean transaksi"
    : syncing
      ? "Sedang menyinkronkan data ke cloud"
      : "Status koneksi online. Ketuk untuk periksa sinkronisasi";

  return (
    <TouchableOpacity
      style={[styles.pill, pillStyle, style]}
      activeOpacity={0.8}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      onPress={onPress}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={[styles.text, textStyle]}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillOnline: {
    backgroundColor: colors.successContainer,
    borderColor: colors.successBorder,
  },
  pillOffline: {
    backgroundColor: colors.warningContainer,
    borderColor: colors.warningBorder,
  },
  pillSyncing: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primaryBorder,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  text: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  textOnline: {
    color: colors.successText,
  },
  textOffline: {
    color: colors.warningText,
  },
  textSyncing: {
    color: colors.primaryDark,
  },
});

export default ConnectionStatusPill;
