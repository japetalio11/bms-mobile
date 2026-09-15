import { View, Text, Pressable } from "react-native";
import { Avatar } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useUser } from "../context/UserContext";
import { useNetwork } from "../context/NetworkContext";

export function Header({
  showBackButton = false,
  title,
  subtitle,
  onBack,
}: {
  showBackButton?: boolean;
  title?: string;
  subtitle?: string;
  rightIcon?: any;
  onBack?: () => void;
}) {
  const router = useRouter();
  const user = useUser();
  const { isOnline } = useNetwork();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.push("/(tabs)/profile");
    }
  };

  return (
    <View className="flex-row items-center justify-between px-5 pt-14 pb-4">
      {/* Left: back button OR avatar + status dot + name */}
      <View className="flex-row items-center gap-3 flex-1 mr-3">
        {showBackButton ? (
          <Pressable
            onPress={handleBack}
            className="size-9 rounded-full bg-surface-secondary items-center justify-center"
          >
            <Ionicons name="arrow-back" size={18} color="#a1a1aa" />
          </Pressable>
        ) : (
          <View className="relative">
            <Avatar size="sm">
              {(user as any).profile_picture_url || (user as any).avatar_url ? (
                <Avatar.Image source={{ uri: (user as any).profile_picture_url || (user as any).avatar_url }} />
              ) : (
                <Avatar.Fallback delayMs={0}>
                  <View className="w-full h-full bg-[#212129] items-center justify-center border border-white/10">
                    <Text className="text-white text-xs font-bold">
                      {user.first_name ? user.first_name.charAt(0).toUpperCase() : "M"}
                    </Text>
                  </View>
                </Avatar.Fallback>
              )}
            </Avatar>

            {/* Bottom-right Status Dot Indicator (Green = Online, Yellow/Amber = Offline) */}
            <View
              style={{
                position: "absolute",
                bottom: -1,
                right: -1,
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: isOnline ? "#10b981" : "#f59e0b",
                borderWidth: 1.5,
                borderColor: "#121214",
              }}
            />
          </View>
        )}

        <View className="flex-1">
          <Text
            className="text-foreground font-bold text-base"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title || user.name}
          </Text>
          {subtitle && (
            <Text className="text-muted text-sm" numberOfLines={1}>{subtitle}</Text>
          )}
        </View>
      </View>

      {/* Right: action icons */}
      <View className="flex-row items-center gap-2">
        {!showBackButton && (
          <>
            <Pressable
              onPress={() => router.push("/(tabs)/search")}
              className="size-9 rounded-full bg-surface-secondary items-center justify-center"
            >
              <Ionicons name="search-outline" size={17} color="#a1a1aa" />
            </Pressable>
            <Pressable
              onPress={() => router.push("/(tabs)/chat")}
              className="size-9 rounded-full bg-surface-secondary items-center justify-center"
            >
              <Ionicons name="chatbubble-ellipses-outline" size={17} color="#a1a1aa" />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
