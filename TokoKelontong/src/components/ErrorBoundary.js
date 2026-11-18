import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts } from "../theme/colors";

/**
 * Penjaga crash global agar kesalahan render tidak meninggalkan layar blank.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || "Terjadi gangguan tampilan sementara.",
    };
  }

  componentDidCatch(error, info) {
    console.error("Global ErrorBoundary caught:", error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: "" });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={34}
                color={colors.errorDark}
              />
            </View>
            <Text style={styles.title}>Terjadi Kesalahan Tampilan</Text>
            <Text style={styles.desc}>
              Data toko dan transaksi Anda tetap tersimpan aman. Muat ulang layar
              untuk melanjutkan pekerjaan.
            </Text>
            {this.state.message ? (
              <Text style={styles.detail} numberOfLines={3}>
                {this.state.message}
              </Text>
            ) : null}
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={this.handleReset}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name="refresh"
                size={18}
                color={colors.onPrimary}
              />
              <Text style={styles.retryText}>Muat Ulang Tampilan</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: "center",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.errorContainer,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.text,
    textAlign: "center",
    marginBottom: 8,
  },
  desc: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 12,
  },
  detail: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.errorDark,
    backgroundColor: colors.errorSoftBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    textAlign: "center",
    marginBottom: 16,
  },
  retryBtn: {
    width: "100%",
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primaryDark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  retryText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.onPrimary,
  },
});
