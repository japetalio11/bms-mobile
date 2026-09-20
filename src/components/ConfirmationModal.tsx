import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  TouchableWithoutFeedback,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type ConfirmationVariant = "danger" | "warning" | "info" | "success";

export type ConfirmationModalProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmationVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const VARIANT_CONFIGS: Record<
  ConfirmationVariant,
  {
    iconName: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    badgeBg: string;
    badgeBorder: string;
    confirmBtnBg: string;
  }
> = {
  danger: {
    iconName: "alert-circle-outline",
    iconColor: "#ef4444",
    badgeBg: "rgba(239, 68, 68, 0.12)",
    badgeBorder: "rgba(239, 68, 68, 0.25)",
    confirmBtnBg: "#dc2626",
  },
  warning: {
    iconName: "warning-outline",
    iconColor: "#f59e0b",
    badgeBg: "rgba(245, 158, 11, 0.12)",
    badgeBorder: "rgba(245, 158, 11, 0.25)",
    confirmBtnBg: "#d97706",
  },
  info: {
    iconName: "information-circle-outline",
    iconColor: "#0284c7",
    badgeBg: "rgba(2, 132, 199, 0.12)",
    badgeBorder: "rgba(2, 132, 199, 0.25)",
    confirmBtnBg: "#0284c7",
  },
  success: {
    iconName: "checkmark-circle-outline",
    iconColor: "#10b981",
    badgeBg: "rgba(16, 185, 129, 0.12)",
    badgeBorder: "rgba(16, 185, 129, 0.25)",
    confirmBtnBg: "#059669",
  },
};

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  icon,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const config = VARIANT_CONFIGS[variant] || VARIANT_CONFIGS.danger;
  const activeIcon = icon || config.iconName;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isLoading ? undefined : onCancel}
    >
      <TouchableWithoutFeedback onPress={isLoading ? undefined : onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.cardContainer}>
              {/* Icon Header Badge */}
              <View
                style={[
                  styles.iconBadge,
                  {
                    backgroundColor: config.badgeBg,
                    borderColor: config.badgeBorder,
                  },
                ]}
              >
                <Ionicons name={activeIcon} size={28} color={config.iconColor} />
              </View>

              {/* Title & Message */}
              <Text style={styles.titleText}>{title}</Text>
              <Text style={styles.messageText}>{message}</Text>

              {/* Action Buttons */}
              <View style={styles.buttonRow}>
                {cancelText ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.button,
                      styles.cancelButton,
                      pressed && styles.cancelButtonPressed,
                      isLoading && styles.buttonDisabled,
                    ]}
                    onPress={onCancel}
                    disabled={isLoading}
                  >
                    <Text style={styles.cancelButtonText}>{cancelText}</Text>
                  </Pressable>
                ) : null}

                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    styles.confirmButton,
                    { backgroundColor: config.confirmBtnBg },
                    pressed && styles.confirmButtonPressed,
                    isLoading && styles.buttonDisabled,
                  ]}
                  onPress={onConfirm}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.confirmButtonText}>{confirmText}</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const windowWidth = Dimensions.get("window").width;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  cardContainer: {
    width: Math.min(windowWidth - 40, 380),
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  titleText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#18181b",
    textAlign: "center",
    marginBottom: 8,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#52525b",
    textAlign: "center",
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cancelButton: {
    backgroundColor: "#f4f4f5",
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  cancelButtonPressed: {
    backgroundColor: "#e4e4e7",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3f3f46",
  },
  confirmButton: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmButtonPressed: {
    opacity: 0.85,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
});
