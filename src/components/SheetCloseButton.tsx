import { Pressable } from "react-native";
import { AppIcon } from "./AppIcon";

export function SheetCloseButton({ onPress, label = "Close", disabled = false }: { onPress: () => void; label?: string; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="size-11 items-center justify-center rounded-full active:bg-default disabled:opacity-50"
    >
      <AppIcon name="close" size={18} weight="regular" color="#737373" />
    </Pressable>
  );
}
