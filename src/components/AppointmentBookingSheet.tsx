import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from "react-native";
import { BottomSheet, Text, useToast } from "heroui-native";
import { AppIcon } from "./AppIcon";
import { BottomSheetHeader } from "./BottomSheetHeader";
import { AppSelect } from "./FormControls";
import { useAuth } from "../context/UserContext";
import { useNetwork } from "../context/NetworkContext";
import { createAppointmentApi } from "../config/api";
import { createAppointmentLocal, saveAppointmentsLocal } from "../db/repository";

const VISIT_TYPES = ["Prenatal Visit", "Postnatal Checkup", "Neonatal Screening"];

function formatDateInput(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
}

function maskDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseDateInput(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

type AppointmentBookingSheetProps = {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void | Promise<void>;
};

export function AppointmentBookingSheet({ visible, onClose, onCreated }: AppointmentBookingSheetProps) {
  const { user, token } = useAuth();
  const { isOnline } = useNetwork();
  const { toast } = useToast();
  const [dateInput, setDateInput] = useState(() => formatDateInput(new Date()));
  const [type, setType] = useState(VISIT_TYPES[0]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    onClose();
  };

  const schedule = async () => {
    if (!user?.user_id) {
      setError("Your session has expired. Please sign in again.");
      return;
    }
    const date = parseDateInput(dateInput);
    if (!date) {
      setError("Enter a valid date in MM/DD/YYYY format.");
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      setError("Choose today or a future date.");
      return;
    }
    const payload = {
      user_id: user.user_id,
      facility_id: user.facility_id || undefined,
      appointment_date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
      // The API currently expects a time value; the booking flow does not ask the patient to choose one.
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
      setDateInput(formatDateInput(new Date()));
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
              <BottomSheetHeader title="Set Appointment" description="Choose a visit and date." onClose={close} />

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 18, paddingBottom: 16 }}>
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Visit type</Text>
                  <AppSelect value={type} onValueChange={setType} options={VISIT_TYPES} placeholder="Select visit type" />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Date</Text>
                  <TextInput
                    value={dateInput}
                    onChangeText={(value) => { setDateInput(maskDateInput(value)); setError(null); }}
                    placeholder="MM/DD/YYYY"
                    placeholderTextColor="#8a8a8a"
                    keyboardType="number-pad"
                    maxLength={10}
                    className="h-12 rounded-md border border-border bg-field-background px-3 text-sm text-foreground"
                    style={{ includeFontPadding: false }}
                  />
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
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>

    </>
  );
}
