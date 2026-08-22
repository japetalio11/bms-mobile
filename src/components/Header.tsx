import { View, Text, Pressable } from "react-native";
import { Avatar } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useUser } from "../context/UserContext";

export function Header({
  showBackButton = false,
  title,
  subtitle,
  onBack,
}: {
  showBackButton?: boolean;
  title?: string;
  subtitle?: string;
  rightIcon?: any; // Ignored, kept for backwards compatibility with existing screens
  onBack?: () => void;
}) {
  const router = useRouter();
  const user = useUser();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View className="flex-row items-center justify-between px-5 pt-14 pb-4">
      {/* Left: back button OR avatar + name */}
      <View className="flex-row items-center gap-3 flex-1 mr-3">
        {showBackButton ? (
          <Pressable
            onPress={handleBack}
            className="size-9 rounded-full bg-surface-secondary items-center justify-center"
          >
            <Ionicons name="arrow-back" size={18} color="#a1a1aa" />
          </Pressable>
        ) : (
          <Avatar size="sm">
            <Avatar.Fallback delayMs={0}>
              <View className="w-full h-full bg-orange-300" />
            </Avatar.Fallback>
          </Avatar>
        )}

        <View className="flex-1">
          <Text
            className="text-foreground font-semibold text-base"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title || user.name}
          </Text>
          {subtitle ? (
            <Text className="text-muted text-sm" numberOfLines={1}>{subtitle}</Text>
          ) : !showBackButton ? (
            <Text className="text-muted text-sm" numberOfLines={1}>{user.email}</Text>
          ) : null}
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
