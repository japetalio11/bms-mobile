import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNetwork } from "../context/NetworkContext";

export const OfflineBanner: React.FC = () => {
  const { isOnline } = useNetwork();

  if (isOnline) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="cloud-offline-outline" size={15} color="#f59e0b" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Working Offline</Text>
          <Text style={styles.subtitle}>
            Your health records and actions are saved locally and will sync automatically once reconnected.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#271b05",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(245, 158, 11, 0.3)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 9999,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: "#fbbf24",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  subtitle: {
    color: "#d4d4d8",
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
  },
});
