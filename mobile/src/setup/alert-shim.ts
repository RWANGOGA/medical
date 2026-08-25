// react-native-web does not implement Alert.alert, so every dialog
// (logout confirm, save confirmations, error notices) is a silent no-op
// on web. Provide a browser-native fallback so behavior matches mobile.
import { Alert, AlertButton, Platform } from "react-native";

if (Platform.OS === "web" && typeof window !== "undefined") {
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join("\n");

    if (!buttons || buttons.length <= 1) {
      window.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }

    // Confirmation dialog: first button cancels, last one confirms
    const cancel = buttons.find((b) => b.style === "cancel") ?? buttons[0];
    const confirm = buttons[buttons.length - 1];
    if (window.confirm(text)) {
      confirm.onPress?.();
    } else {
      cancel.onPress?.();
    }
  };
}

export {};
