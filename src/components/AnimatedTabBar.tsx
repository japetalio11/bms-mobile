import { useEffect, useState } from "react";
import { View, Pressable, Text } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
const TAB_ITEM_SIZE = 54;

type TabBarItemProps = {
  isFocused: boolean;
  options: any;
  onPress: () => void;
  onLongPress: () => void;
};

function TabBarItem({ isFocused, options, onPress, onLongPress }: TabBarItemProps) {
  const iconColor = isFocused ? "#111111" : "#f5f5f5";

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={options.title}
      style={{
        flex: 1,
        height: TAB_ITEM_SIZE,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
      }}
    >
      {options.tabBarIcon?.({
        color: iconColor,
        size: 22,
        focused: isFocused,
      })}
      {isFocused && <Text style={{ color: iconColor, fontSize: 14, fontFamily: "Manrope-Medium" }}>{options.title}</Text>}
    </Pressable>
  );
}

export function AnimatedTabBar({ state, descriptors }: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [barWidth, setBarWidth] = useState(0);
  const activePosition = useSharedValue(0);

  const visibleRoutes = state.routes.filter((route: any) => {
    const { options } = descriptors[route.key] || {};
    return options?.href !== null && (route.name === "index" || route.name === "records");
  });

  const currentTab = state.routes[state.index]?.name === "records" ? "records" : "index";
  const activeIndex = Math.max(0, visibleRoutes.findIndex((route: any) => route.name === currentTab));

  useEffect(() => {
    activePosition.value = withTiming(activeIndex, { duration: 220 });
  }, [activeIndex, activePosition]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: activePosition.value * Math.max(0, (barWidth - 18) / 2) }],
  }));

  return (
    <View
      style={{
        position: "absolute",
        bottom: Math.max(insets.bottom, 8),
        left: 12,
        right: 12,
        height: 72,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 9,
        gap: 2,
        borderRadius: 999,
        backgroundColor: "#111111",
      }}
      onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          indicatorStyle,
          {
            position: "absolute",
            left: 9,
            width: Math.max(0, (barWidth - 18) / 2),
            height: TAB_ITEM_SIZE,
            borderRadius: 999,
            backgroundColor: "#f5f5f5",
          },
        ]}
      />
      {visibleRoutes.map((route: any) => {
        const { options } = descriptors[route.key];
        const isFocused = route.name === currentTab;

        const onPress = () => {
          if (!isFocused) {
            router.navigate(route.name === "records" ? "/(tabs)/records" : "/(tabs)");
          }
        };

        const onLongPress = () => {};

        return (
          <TabBarItem
            key={route.key}
            isFocused={isFocused}
            options={options}
            onPress={onPress}
            onLongPress={onLongPress}
          />
        );
      })}
    </View>
  );
}
