import type { ComponentProps, ReactNode } from "react";
import { View } from "react-native";
import { Text } from "heroui-native";
import { AppIcon } from "./AppIcon";
import Animated, { FadeIn } from "react-native-reanimated";

type Props = {
  icon: ComponentProps<typeof AppIcon>["name"];
  title: string;
  description: string;
  action?: ReactNode;
};

/** Compact phone adaptation of the web table empty state. */
export function MobileEmptyState({ icon, title, description, action }: Props) {
  return (
    <Animated.View entering={FadeIn.duration(180)} className="min-h-[210px] items-center justify-center px-6 py-8">
      <View className="mb-4 size-12 items-center justify-center rounded-[15px] border border-[#3a3a3a] bg-[#303030]">
        <AppIcon name={icon} size={21} weight="bold" color="#fffe8c" />
      </View>
      <Text className="text-center text-base font-semibold" style={{ color: "#f5f5f5" }}>
        {title}
      </Text>
      <Text className="mt-1.5 max-w-[280px] text-center text-sm leading-5" style={{ color: "#a3a3a3" }}>
        {description}
      </Text>
      {action && <View className="mt-5">{action}</View>}
    </Animated.View>
  );
}
