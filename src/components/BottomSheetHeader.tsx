import { View } from "react-native";
import { Text } from "heroui-native";
import { SheetCloseButton } from "./SheetCloseButton";
import Animated, { FadeInDown } from "react-native-reanimated";

type BottomSheetHeaderProps = {
  title: string;
  description?: string;
  onClose: () => void;
  closeLabel?: string;
  className?: string;
};

/** Shared compact header for mobile sheets: one clear title, optional context, and an unfilled close control. */
export function BottomSheetHeader({
  title,
  description,
  onClose,
  closeLabel = "Close",
  className = "",
}: BottomSheetHeaderProps) {
  return (
    <Animated.View entering={FadeInDown.duration(180)} className={`mb-4 min-h-11 flex-row items-start gap-3 ${className}`}>
      <View className="min-w-0 flex-1 pt-1">
        <Text accessibilityRole="header" className="text-base font-semibold leading-5 text-foreground">
          {title}
        </Text>
        {description ? (
          <Text className="mt-1 text-sm leading-5 text-muted-foreground" numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
      <SheetCloseButton onPress={onClose} label={closeLabel} />
    </Animated.View>
  );
}
