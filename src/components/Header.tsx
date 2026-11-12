import { View, Text, Pressable } from "react-native";
import { Avatar } from "heroui-native";
import { AppIcon as Ionicons } from "./AppIcon";
import { useRouter } from "expo-router";
import { useUniwind } from "uniwind";
import { useUser, useAuth } from "../context/UserContext";
import { useNetwork } from "../context/NetworkContext";

export function Header({
  showBackButton = false,
  title,
  subtitle,
  onBack,
  variant = "default",
  darkHero = false,
}: {
  showBackButton?: boolean;
  title?: string;
  subtitle?: string;
  variant?: "default" | "dashboard";
  darkHero?: boolean;
  rightIcon?: any;
  onBack?: () => void;
}) {
  const router = useRouter();
  const { theme } = useUniwind();
  const isDark = theme === "dark";
  const user = useUser();
  const { unreadCount } = useAuth();
  const { isOnline } = useNetwork();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  const iconColor = isDark ? "#a1a1aa" : "#52525b";
  const dotBorder = isDark ? "#121214" : "#ffffff";

  if (variant === "dashboard") {
    return (
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3 flex-1 mr-3">
          <View className="size-10 rounded-full items-center justify-center" style={{ backgroundColor: darkHero ? "#303030" : isDark ? "#292929" : "#e5e5e5" }}>
            <Ionicons name="person" size={17} color={darkHero ? "#f5f5f5" : isDark ? "#f5f5f5" : "#404040"} />
          </View>
          <View className="flex-1">
            <Text className="text-sm" style={{ color: darkHero ? "#a3a3a3" : isDark ? "#a3a3a3" : "#737373" }} numberOfLines={1}>
              {user.name}
            </Text>
            <Text className="text-base font-medium" style={{ color: darkHero ? "#fafafa" : isDark ? "#fafafa" : "#171717" }} numberOfLines={1}>
              {subtitle || user.facility_name || "Maternal care"}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityLabel="Settings"
            onPress={() => router.push("/(tabs)/profile")}
            className="size-10 rounded-full items-center justify-center active:opacity-80"
            style={{ backgroundColor: darkHero ? "#303030" : isDark ? "#292929" : "#e5e5e5" }}
          >
            <Ionicons name="settings-outline" size={18} color={darkHero ? "#f5f5f5" : isDark ? "#f5f5f5" : "#404040"} />
          </Pressable>
          <Pressable
            accessibilityLabel="Notifications"
            onPress={() => router.push({ pathname: "/(tabs)/notifications", params: { from: "dashboard" } })}
            className="size-10 rounded-full items-center justify-center relative active:opacity-80"
            style={{ backgroundColor: darkHero ? "#303030" : isDark ? "#292929" : "#e5e5e5" }}
          >
            <Ionicons name="notifications-outline" size={18} color={darkHero ? "#f5f5f5" : isDark ? "#f5f5f5" : "#404040"} />
            {unreadCount > 0 && (
              <View
                className="absolute right-2 top-2 size-2 rounded-full"
                style={{ backgroundColor: "#f59e0b", borderColor: isDark ? "#292929" : "#f5f5f5", borderWidth: 1 }}
              />
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-row items-center justify-between border-b border-border bg-background px-4 py-3">
      <View className="flex-row items-center gap-3 flex-1 mr-3">
        {showBackButton ? (
          <Pressable
            onPress={handleBack}
            className="size-9 rounded-md border border-border bg-surface items-center justify-center active:opacity-80"
          >
            <Ionicons name="chevron-back" size={20} weight="bold" color={iconColor} />
          </Pressable>
        ) : (
          <View className="relative">
            <Avatar size="sm">
              {user.profile_url || (user as any).profile_picture_url || (user as any).avatar_url ? (
                <Avatar.Image
                  source={{
                    uri:
                      user.profile_url ||
                      (user as any).profile_picture_url ||
                      (user as any).avatar_url,
                  }}
                />
              ) : (
                <Avatar.Fallback delayMs={0}>
                  <View className="w-full h-full bg-primary/20 items-center justify-center">
                    <Text className="text-foreground text-sm font-semibold">
                      {user.first_name ? user.first_name.charAt(0).toUpperCase() : "M"}
                    </Text>
                  </View>
                </Avatar.Fallback>
              )}
            </Avatar>

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
                borderColor: dotBorder,
              }}
            />
          </View>
        )}

        <View className="flex-1">
          <Text
            className="text-foreground font-semibold text-base"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title || user.name}
          </Text>
          {subtitle && (
            <Text className="text-muted-foreground text-sm" numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      <View className="flex-row items-center gap-2">
        {!showBackButton && (
          <>
            <Pressable
              onPress={() => router.push("/(tabs)/search")}
              className="size-9 rounded-md border border-border bg-surface items-center justify-center active:opacity-80"
            >
              <Ionicons name="search-outline" size={17} color={iconColor} />
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: "/(tabs)/notifications", params: { from: "dashboard" } })}
              className="size-9 rounded-md border border-border bg-surface items-center justify-center relative active:opacity-80"
            >
              <Ionicons name="notifications-outline" size={18} color={iconColor} />
              {unreadCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: "#ef4444",
                    borderWidth: 1.5,
                    borderColor: dotBorder,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 3,
                  }}
                >
                  <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "600" }}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
