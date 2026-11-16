import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from "react-native";
import { BottomSheet, Text, useToast } from "heroui-native";
import { useRouter } from "expo-router";
import { useUniwind } from "uniwind";
import { AppIcon } from "./AppIcon";
import { BottomSheetHeader } from "./BottomSheetHeader";
import { AppSelect } from "./FormControls";
import { AppointmentDatePickerModal } from "./AppointmentDatePickerModal";
import { StaffUnavailableWarningModal } from "./StaffUnavailableWarningModal";
import { useAuth } from "../context/UserContext";
import { useNetwork } from "../context/NetworkContext";
import { createAppointmentApi } from "../config/api";
import { createAppointmentLocal, saveAppointmentsLocal } from "../db/repository";
import {
  checkStaffAvailability,
  formatDateKey,
  getFacilityClosedReason,
  getWeekdayName,
  isFacilityDateClosed,
  loadFacilityClosedDates,
  loadStaffSchedule,
  type StaffSchedule,
} from "../services/facilityScheduleService";

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

function getInitialAvailableDate(facilityId?: string | null): Date {
  const candidate = new Date();
  for (let i = 0; i < 7; i++) {
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + i);
    testDate.setHours(0, 0, 0, 0);
    if (!isFacilityDateClosed(testDate, facilityId)) {
      return testDate;
    }
  }
  return candidate;
}

type AppointmentBookingSheetProps = {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void | Promise<void>;
};

export function AppointmentBookingSheet({ visible, onClose, onCreated }: AppointmentBookingSheetProps) {
  const router = useRouter();
  const { theme } = useUniwind();
  const isDark = theme === "dark";
  const { user, token, motherRecord } = useAuth();
  const { isOnline } = useNetwork();
  const { toast } = useToast();

  const facilityId = user?.facility_id || user?.facility?.facility_id || null;
  const rawAssignedWorker = motherRecord?.assignedWorker || null;
  const rawCreator = motherRecord?.creator || null;
  const assignedWorkerId =
    motherRecord?.assigned_worker_id ||
    rawAssignedWorker?.user_id ||
    motherRecord?.created_by_id ||
    rawCreator?.user_id ||
    null;

  const assignedStaff =
    rawAssignedWorker ||
    rawCreator ||
    (assignedWorkerId
      ? {
          user_id: assignedWorkerId,
          first_name: "Assigned",
          last_name: "Staff",
          role: "Staff",
        }
      : null);

  const assignedStaffName = rawAssignedWorker
    ? [rawAssignedWorker.first_name, rawAssignedWorker.last_name].filter(Boolean).join(" ")
    : rawCreator
    ? [rawCreator.first_name, rawCreator.last_name].filter(Boolean).join(" ")
    : "Assigned Healthcare Staff";

  const [selectedDate, setSelectedDate] = useState<Date>(() => getInitialAvailableDate(facilityId));
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [showStaffWarningModal, setShowStaffWarningModal] = useState(false);
  const [staffWarningAcknowledgedForDate, setStaffWarningAcknowledgedForDate] = useState<string | null>(null);
  const [staffSchedule, setStaffSchedule] = useState<StaffSchedule | null>(null);

  const [type, setType] = useState(VISIT_TYPES[0]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasFacility = Boolean(facilityId);

  useEffect(() => {
    if (visible && facilityId) {
      loadFacilityClosedDates(facilityId, token).then(() => {
        setSelectedDate((current) => {
          if (isFacilityDateClosed(current, facilityId)) {
            return getInitialAvailableDate(facilityId);
          }
          return current;
        });
      });
    }
    if (visible && assignedStaff?.user_id) {
      loadStaffSchedule(assignedStaff.user_id, token).then(setStaffSchedule);
    }
  }, [visible, facilityId, assignedStaff?.user_id, token]);

  const close = () => {
    setError(null);
    setIsDatePickerOpen(false);
    setShowStaffWarningModal(false);
    onClose();
  };

  const isSelectedDateClosed = isFacilityDateClosed(selectedDate, facilityId);
  const staffAvailability = checkStaffAvailability(selectedDate, assignedStaff, staffSchedule);
  const selectedDateKey = formatDateKey(selectedDate);
  const selectedWeekday = getWeekdayName(selectedDate);

  const executeBooking = async () => {
    const payload = {
      user_id: user.user_id,
      facility_id: facilityId || undefined,
      appointment_date: selectedDateKey,
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
        } catch (apiError: any) {
          const msg = apiError?.message || "";
          const isNetworkError =
            msg.includes("Network request failed") ||
            msg.includes("Failed to fetch") ||
            msg.includes("NetworkError") ||
            msg.includes("timeout");
          if (isNetworkError) {
            await createAppointmentLocal(payload, false);
          } else {
            throw apiError;
          }
        }
      } else {
        await createAppointmentLocal(payload, false);
      }
      close();
      setReason("");
      setSelectedDate(getInitialAvailableDate(facilityId));
      setStaffWarningAcknowledgedForDate(null);
      toast.show({
        label: isOnline ? "Appointment scheduled" : "Appointment scheduled (Saved Offline)",
        description: isOnline ? undefined : "Saved locally on this device. Will sync once connected.",
        variant: "success",
      });
      await onCreated?.();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not schedule appointment.");
    } finally {
      setSubmitting(false);
    }
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

    if (isFacilityDateClosed(checkDate, facilityId)) {
      setError(
        getFacilityClosedReason(checkDate, facilityId) ||
          "The facility is closed on this date. Please pick an open clinic date."
      );
      return;
    }

    if (
      assignedStaff?.user_id &&
      !staffAvailability.isAvailable &&
      staffWarningAcknowledgedForDate !== selectedDateKey
    ) {
      setShowStaffWarningModal(true);
      return;
    }

    await executeBooking();
  };

  return (
    <>
      <BottomSheet isOpen={visible} onOpenChange={(open) => { if (!open) close(); }}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay className="bg-black/60" />
          <BottomSheet.Content
            snapPoints={["72%"]}
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
                    className="px-6 py-3 rounded-full flex-row items-center gap-2 active:opacity-85 shadow-none"
                    style={{ backgroundColor: isDark ? "#fffe8c" : "#171717" }}
                  >
                    <AppIcon name="person-circle-outline" size={20} color={isDark ? "#171717" : "#ffffff"} />
                    <Text style={{ color: isDark ? "#171717" : "#ffffff" }} className="font-semibold text-sm">View Profile</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 16 }}>
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

                      {isSelectedDateClosed && (
                        <View className="flex-row items-center gap-1.5 rounded-lg border border-destructive/25 bg-destructive/10 px-2.5 py-1.5 mt-0.5">
                          <AppIcon name="close-circle-outline" size={14} color="#ef4444" />
                          <Text className="text-[11px] font-medium text-destructive flex-1">
                            {getFacilityClosedReason(selectedDate, facilityId) || "Facility is closed on this date."}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View className="gap-2">
                      <Text className="text-sm font-medium text-foreground">Reason or notes <Text className="text-muted-foreground">(optional)</Text></Text>
                      <TextInput value={reason} onChangeText={setReason} placeholder="What would you like to discuss?" placeholderTextColor="#8a8a8a" multiline numberOfLines={3} textAlignVertical="top" className="min-h-20 rounded-md border border-border bg-field-background px-3 py-2.5 text-sm text-foreground" />
                    </View>
                  </ScrollView>

                  {error && <Text className="mb-2 text-sm text-red-500">{error}</Text>}
                  <Pressable onPress={schedule} disabled={submitting || isSelectedDateClosed} className={`min-h-12 flex-row items-center justify-center gap-2 rounded-md ${isSelectedDateClosed ? "bg-muted opacity-50" : "bg-[#fffe8c]"} active:opacity-80 disabled:opacity-60`}>
                    {submitting ? <ActivityIndicator size="small" color="#171717" /> : <>
                      <AppIcon name="calendar" size={18} weight="bold" color={isSelectedDateClosed ? "#737373" : "#171717"} />
                      <Text className={`text-sm font-semibold ${isSelectedDateClosed ? "text-muted-foreground" : "text-[#171717]"}`}>
                        {isSelectedDateClosed ? "Facility Closed on this Date" : "Set Appointment"}
                      </Text>
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
        facilityId={facilityId}
        onSelectDate={(date) => {
          setSelectedDate(date);
          setError(null);
          setStaffWarningAcknowledgedForDate(null);
          if (assignedStaff?.user_id) {
            const check = checkStaffAvailability(date, assignedStaff, staffSchedule);
            if (!check.isAvailable) {
              setShowStaffWarningModal(true);
            }
          }
        }}
        onClose={() => setIsDatePickerOpen(false)}
      />

      <StaffUnavailableWarningModal
        visible={showStaffWarningModal}
        staffName={assignedStaffName}
        selectedDate={selectedDate}
        onProceed={async () => {
          setShowStaffWarningModal(false);
          setStaffWarningAcknowledgedForDate(selectedDateKey);
          await executeBooking();
        }}
        onChangeDate={() => {
          setShowStaffWarningModal(false);
          setIsDatePickerOpen(true);
        }}
        onClose={() => setShowStaffWarningModal(false)}
      />
    </>
  );
}
