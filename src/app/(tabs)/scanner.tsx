import { View, Text, Pressable } from "react-native";
import { useState } from "react";
import type { JSX } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/UserContext";
import { MotherQRCodeModal } from "../../components/MotherQRCodeModal";

export default function ScannerScreen(): JSX.Element {
  const [torchOn, setTorchOn] = useState(false);
  const [showMyQr, setShowMyQr] = useState(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, motherRecord } = useAuth();

  return (
    <View className="flex-1 bg-black">
      {/* Top controls */}
      <View
        className="flex-row items-center justify-between px-6"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Text className="text-white text-lg font-semibold">Scan QR Code</Text>
        <Pressable
          onPress={() => setTorchOn(!torchOn)}
          className="size-10 rounded-full bg-white/10 items-center justify-center"
        >
          <Ionicons
            name={torchOn ? "flash" : "flash-outline"}
            size={20}
            color={torchOn ? "#fbbf24" : "white"}
          />
        </Pressable>
      </View>

      {/* Viewfinder */}
      <View className="flex-1 items-center justify-center">
        <View className="relative items-center justify-center">
          <View className="size-64 relative">
            {/* Corner brackets */}
            <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
            <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
            <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
            <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
            {/* Scan line */}
            <View className="absolute top-1/2 left-4 right-4 h-0.5 bg-primary opacity-80" />
          </View>
        </View>

        <Text className="text-white/70 text-sm font-medium mt-8 text-center px-12 leading-5">
          Point camera at a clinic check-in terminal or tap below to show your personal health card.
        </Text>
      </View>

      {/* Bottom actions */}
      <View style={{ paddingBottom: insets.bottom + 100, paddingHorizontal: 24 }} className="gap-3">
        <Pressable
          onPress={() => setShowMyQr(true)}
          className="bg-white/10 active:bg-white/15 rounded-xl p-4 flex-row items-center gap-4"
        >
          <View className="size-10 rounded-full bg-primary/20 items-center justify-center">
            <Ionicons name="qr-code-outline" size={20} color="#6366f1" />
          </View>
          <View className="flex-1">
            <Text className="text-white text-base font-medium">Show My Health Card QR</Text>
            <Text className="text-white/50 text-sm">Present your QR card to clinic staff</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#a1a1aa" />
        </Pressable>

        <Pressable
          onPress={() => router.push("/(tabs)/appointments")}
          className="bg-white/10 active:bg-white/15 rounded-xl p-4 flex-row items-center gap-4"
        >
          <View className="size-10 rounded-full bg-primary/20 items-center justify-center">
            <Ionicons name="calendar-outline" size={20} color="#6366f1" />
          </View>
          <View className="flex-1">
            <Text className="text-white text-base font-medium">View Scheduled Appointments</Text>
            <Text className="text-white/50 text-sm">Check upcoming clinic bookings</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#a1a1aa" />
        </Pressable>
      </View>

      <MotherQRCodeModal
        visible={showMyQr}
        onClose={() => setShowMyQr(false)}
        user={user}
        motherRecord={motherRecord}
      />
    </View>
  );
}
