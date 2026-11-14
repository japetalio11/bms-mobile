import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from "react-native";
import { BottomSheet, Text, useToast } from "heroui-native";
import { useRouter } from "expo-router";
import { AppIcon } from "./AppIcon";
import { BottomSheetHeader } from "./BottomSheetHeader";
import { AppSelect } from "./FormControls";
import { AppointmentDatePickerModal } from "./AppointmentDatePickerModal";
import { useAuth } from "../context/UserContext";
import { useNetwork } from "../context/NetworkContext";
import { createAppointmentApi } from "../config/api";
import { createAppointmentLocal, saveAppointmentsLocal } from "../db/repository";

const VISIT_TYPES = ["Prenatal Visit", "Postnatal Checkup", "Neonatal Screening"];

function formatReadableDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isTodayDate(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function isTomorrowDate(date: Date): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate()
  );
}

type AppointmentBookingSheetProps = {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void | Promise<void>;
};

export function AppointmentBookingSheet({ visible, onClose, onCreated }: AppointmentBookingSheetProps) {
  const router = useRouter();
  const { user, token } = useAuth();
  const { isOnline } = useNetwork();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [type, setType] = useState(VISIT_TYPES[0]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasFacility = Boolean(user?.facility_id || user?.facility?.facility_id);

  const close = () => {
    setError(null);
    setIsDatePickerOpen(false);
    onClose();
  };

  const schedule = async () => {
    if (!user?.user_id) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    if (!hasFacility) {
      setError("You are currently not affiliated with any healthcare facility.");
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(selectedDate);
    checkDate.setHours(0, 0, 0, 0);

    if (checkDate < today) {
      setError("Choose today or a future date.");
      return;
    }

    const payload = {
      user_id: user.user_id,
      facility_id: user.facility_id || undefined,
      appointment_date: `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`,
      appointment_time: "09:00 AM",
      appointment_type: type,
      reason: reason.trim() || undefined,
    };

    setSubmitting(true);
    setError(null);
    try {
      if (isOnline && token) {
        try {
          const created = await createAppointmentApi(payload, token);
          if (created) await saveAppointmentsLocal([created], true);
        } catch (apiError) {
          await createAppointmentLocal(payload, false);
          console.warn("Appointment saved to the offline queue:", apiError);
        }
      } else {
        await createAppointmentLocal(payload, false);
      }
      close();
      setReason("");
      setSelectedDate(new Date());
      toast.show({ label: "Appointment scheduled", variant: "success" });
      await onCreated?.();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not schedule appointment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <BottomSheet isOpen={visible} onOpenChange={(open) => { if (!open) close(); }}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay className="bg-black/60" />
          <BottomSheet.Content
            snapPoints={["68%"]}
            enableDynamicSizing={false}
            enableOverDrag={false}
            contentContainerClassName="h-full"
            backgroundClassName="rounded-t-[24px] bg-background"
            handleIndicatorClassName="bg-muted"
          >
            <View className="flex-1 px-5 pb-5 pt-1">
              <BottomSheetHeader
                title="Set Appointment"
                description={hasFacility ? "Choose a visit and date." : "Facility affiliation required."}
                onClose={close}
              />

              {!hasFacility ? (
                <View className="flex-1 items-center justify-center p-4">
                  <View className="size-20 rounded-full bg-muted border border-blue-500/20 items-center justify-center mb-4">
                    <AppIcon name="business-outline" size={36} color="#3b82f6" />
                  </View>
                  <Text className="text-foreground font-semibold text-base mb-2 text-center">
                    Not Affiliated with any Facility
                  </Text>
                  <Text className="text-muted-foreground text-sm text-center max-w-sm leading-6 mb-6">
                    You are currently not affiliated with any healthcare facility. Setting an appointment is only available once your account is linked to a health center.
                  </Text>

                  <Pressable
                    onPress={() => {
                      close();
                      router.push("/(tabs)/profile");
                    }}
                    className="bg-primary px-6 py-3 rounded-full flex-row items-center gap-2 shadow-none"
                  >
                    <AppIcon name="person-circle-outline" size={20} color="white" />
                    <Text className="text-white font-semibold text-sm">View Profile</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 18, paddingBottom: 16 }}>
                    <View className="gap-2">
                      <Text className="text-sm font-medium text-foreground">Visit type</Text>
                      <AppSelect value={type} onValueChange={setType} options={VISIT_TYPES} placeholder="Select visit type" />
                    </View>

                    <View className="gap-2">
                      <Text className="text-sm font-medium text-foreground">Date</Text>
                      <Pressable
                        onPress={() => setIsDatePickerOpen(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Choose appointment date"
                        className="h-12 flex-row items-center justify-between rounded-md border border-border bg-field-background px-3.5 active:bg-surface-secondary"
                      >
                        <View className="flex-row items-center gap-2.5">
                          <View className="size-7 items-center justify-center rounded-md border border-black/25 bg-[#fffe8c] dark:border-white/20">
                            <AppIcon name="calendar" size={16} weight="bold" color="#171717" />
                          </View>
                          <Text className="text-sm font-semibold text-foreground">
                            {formatReadableDate(selectedDate)}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-1.5">
                          {(isTodayDate(selectedDate) || isTomorrowDate(selectedDate)) && (
                            <View className="rounded-full border border-black/20 bg-surface px-2.5 py-0.5 dark:border-white/30">
                              <Text className="text-[11px] font-bold text-foreground">
                                {isTodayDate(selectedDate) ? "Today" : "Tomorrow"}
                              </Text>
                            </View>
                          )}
                          <AppIcon name="chevron-forward" size={16} weight="bold" color="#737373" />
                        </View>
                      </Pressable>
                    </View>

                    <View className="gap-2">
                      <Text className="text-sm font-medium text-foreground">Reason or notes <Text className="text-muted-foreground">(optional)</Text></Text>
                      <TextInput value={reason} onChangeText={setReason} placeholder="What would you like to discuss?" placeholderTextColor="#8a8a8a" multiline numberOfLines={3} textAlignVertical="top" className="min-h-20 rounded-md border border-border bg-field-background px-3 py-2.5 text-sm text-foreground" />
                    </View>
                  </ScrollView>

                  {error && <Text className="mb-2 text-sm text-red-500">{error}</Text>}
                  <Pressable onPress={schedule} disabled={submitting} className="min-h-12 flex-row items-center justify-center gap-2 rounded-md bg-[#fffe8c] active:opacity-80 disabled:opacity-60">
                    {submitting ? <ActivityIndicator size="small" color="#171717" /> : <>
                      <AppIcon name="calendar" size={18} weight="bold" color="#171717" />
                      <Text className="text-sm font-semibold text-[#171717]">Set Appointment</Text>
                    </>}
                  </Pressable>
                </>
              )}
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>

      <AppointmentDatePickerModal
        visible={isDatePickerOpen}
        selectedDate={selectedDate}
        onSelectDate={(date) => {
          setSelectedDate(date);
          setError(null);
        }}
        onClose={() => setIsDatePickerOpen(false)}
      />
    </>
  );
}
