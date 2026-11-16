import { Modal, Pressable, View } from "react-native";
import { Text } from "heroui-native";
import { AppIcon } from "./AppIcon";
import { getWeekdayName } from "../services/facilityScheduleService";

type StaffUnavailableWarningModalProps = {
  visible: boolean;
  staffName: string;
  selectedDate: Date;
  onProceed: () => void;
  onChangeDate: () => void;
  onClose: () => void;
};

export function StaffUnavailableWarningModal({
  visible,
  staffName,
  selectedDate,
  onProceed,
  onChangeDate,
  onClose,
}: StaffUnavailableWarningModalProps) {
  const weekday = getWeekdayName(selectedDate);
  const formattedDate = selectedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/65 px-5">
        <View className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-2xl">
          <View className="flex-row items-center justify-end">
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close warning"
              className="size-8 items-center justify-center rounded-full active:opacity-70"
            >
              <AppIcon name="close" size={16} color="#737373" />
            </Pressable>
          </View>

          <View className="size-14 rounded-full bg-amber-500/15 border border-amber-500/30 items-center justify-center mb-3 self-center">
            <AppIcon name="warning-outline" size={28} color="#f59e0b" />
          </View>

          <Text className="text-base font-bold text-foreground text-center mb-2">
            Staff Availability Notice
          </Text>

          <Text className="text-xs text-muted-foreground text-center leading-5 mb-4">
            Your assigned staff <Text className="font-semibold text-foreground">{staffName}</Text> isn't available this day ({weekday}, {formattedDate}), but you are still allowed to make an appointment. A different staff member will take care of you.
          </Text>

          <View className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 mb-5">
            <View className="flex-row items-center gap-2 mb-1">
              <AppIcon name="person-circle-outline" size={18} color="#f59e0b" />
              <Text className="text-xs font-semibold text-foreground">
                {staffName}
              </Text>
            </View>
            <Text className="text-[11px] text-muted-foreground leading-4">
              Not present on {weekday}s. Clinic duty staff will assist with your visit and record your notes.
            </Text>
          </View>

          <View className="gap-2.5">
            <Pressable
              onPress={onProceed}
              accessibilityRole="button"
              accessibilityLabel="Continue with another staff"
              className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-[#fffe8c] active:opacity-80"
            >
              <AppIcon name="checkmark-circle-outline" size={18} color="#171717" />
              <Text className="text-sm font-bold text-[#171717]">
                Continue with Another Staff
              </Text>
            </Pressable>

            <Pressable
              onPress={onChangeDate}
              accessibilityRole="button"
              accessibilityLabel="Choose another date"
              className="h-11 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-surface active:bg-muted/40"
            >
              <AppIcon name="calendar-outline" size={16} color="#737373" />
              <Text className="text-xs font-semibold text-foreground">
                Choose Another Date
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
