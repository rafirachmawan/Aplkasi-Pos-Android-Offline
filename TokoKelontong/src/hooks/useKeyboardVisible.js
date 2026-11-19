import { useState, useEffect } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Melacak apakah keyboard virtual sedang terbuka di layar aktif.
 */
export default function useKeyboardVisible(enabled = true) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (!enabled) {
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
  }, [enabled]);

  return keyboardVisible;
}
