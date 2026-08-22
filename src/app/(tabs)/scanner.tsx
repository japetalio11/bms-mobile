import { View, Text, Pressable } from "react-native";
import { useState } from "react";
import type { JSX } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ScannerScreen(): JSX.Element {
  const [torchOn, setTorchOn] = useState(false);
  const insets = useSafeAreaInsets();

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
          Point the camera at a QR code to scan your health card or appointment record.
        </Text>
      </View>

      {/* Bottom actions */}
      <View style={{ paddingBottom: insets.bottom + 100, paddingHorizontal: 24 }} className="gap-3">
        <View className="bg-white/10 rounded-xl p-4 flex-row items-center gap-4">
          <View className="size-10 rounded-full bg-primary/20 items-center justify-center">
            <Ionicons name="card-outline" size={20} color="#6366f1" />
          </View>
          <View className="flex-1">
            <Text className="text-white text-base font-medium">Health Card</Text>
            <Text className="text-white/50 text-sm">Scan your BMS health card QR</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#a1a1aa" />
        </View>

        <View className="bg-white/10 rounded-xl p-4 flex-row items-center gap-4">
          <View className="size-10 rounded-full bg-primary/20 items-center justify-center">
            <Ionicons name="calendar-outline" size={20} color="#6366f1" />
          </View>
          <View className="flex-1">
            <Text className="text-white text-base font-medium">Appointment QR</Text>
            <Text className="text-white/50 text-sm">Scan your appointment confirmation</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#a1a1aa" />
        </View>
      </View>
    </View>
  );
}
