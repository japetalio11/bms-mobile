import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Card, Text } from "heroui-native";
import { Header } from "../../components/Header";
import { AppIcon as Ionicons } from "../../components/AppIcon";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import type { JSX } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/UserContext";
import { useNetwork } from "../../context/NetworkContext";
import { useConfirm } from "../../context/ConfirmationContext";
import { cancelAppointmentApi } from "../../config/api";
import type { AppointmentRecord } from "../../config/api";
import { getAppointmentStatusConfig } from "../../lib/appointmentUtils";
import {
  getAppointmentByIdLocal,
  getAppointmentsLocal,
  cancelAppointmentLocal,
} from "../../db/repository";

const DataRow = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-row items-start justify-between py-3 border-b border-separator last:border-0 gap-4 w-full">
    <Text className="text-muted-foreground text-sm shrink-0" style={{ maxWidth: "42%" }}>
      {label}
    </Text>
    <View className="flex-1 shrink items-end justify-start">
      <Text
        className="text-foreground text-sm font-medium text-right leading-5"
        style={{ flexShrink: 1 }}
      >
        {value}
      </Text>
    </View>
  </View>
);

export default function AppointmentDetailScreen(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, token, activePregnancy } = useAuth();
  const { isOnline } = useNetwork();
  const { confirm } = useConfirm();

  const [appointment, setAppointment] = useState<AppointmentRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    const fetchAppointment = async () => {
      if (!id) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const localItem = await getAppointmentByIdLocal(id);
        if (localItem) {
          setAppointment(localItem);
        } else if (user?.user_id) {
          const allLocal = await getAppointmentsLocal(user.user_id);
          const found = allLocal.find((a) => a.appointment_id === id);
          if (found) setAppointment(found);
        }
      } catch (err) {
        console.warn("Failed to load appointment details:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAppointment();
  }, [id, user?.user_id]);

  const handleCancelAppointment = () => {
    if (!appointment) return;

    confirm({
      title: "Cancel Appointment",
      message: "Are you sure you want to cancel this scheduled appointment?",
      confirmText: "Yes, Cancel",
      cancelText: "No, Keep It",
      variant: "danger",
      icon: "calendar-outline",
      onConfirm: async () => {
        setIsCancelling(true);
        try {
          await cancelAppointmentLocal(appointment.appointment_id, isOnline, user?.user_id);

          if (isOnline && token) {
            try {
              await cancelAppointmentApi(appointment.appointment_id, token);
            } catch (apiErr: any) {
              console.warn("Online cancellation call failed, queued via sync engine:", apiErr);
            }
          }

          setAppointment((prev) => (prev ? { ...prev, status: "Cancelled" } : null));
          confirm({
            title: "Appointment Cancelled",
            message: "Your appointment has been cancelled successfully.",
            confirmText: "OK",
            cancelText: "",
            variant: "success",
            icon: "checkmark-circle-outline",
          });
        } catch (err: any) {
          confirm({
            title: "Cancellation Failed",
            message: err.message || "Failed to cancel appointment.",
            confirmText: "OK",
            cancelText: "",
            variant: "danger",
          });
        } finally {
          setIsCancelling(false);
        }
      },
    });
  };

  const latestVisit = activePregnancy?.prenatalVisits?.[0];
  const statusCfg = getAppointmentStatusConfig(appointment?.status || "scheduled");
  const isCancelled =
    (appointment?.status || "").toLowerCase() === "cancelled" ||
    (appointment?.status || "").toLowerCase() === "canceled";
  const isCompleted = (appointment?.status || "").toLowerCase() === "completed";
  const canCancel = appointment && !isCancelled && !isCompleted;

  const formattedDate = appointment?.appointment_date
    ? new Date(appointment.appointment_date).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Date not specified";

  return (
    <View className="flex-1 bg-background">
      <Header
        showBackButton
        title="Appointment Details"
        onBack={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/history")}
        rightIcon={null}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 110, 140) }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text className="text-muted-foreground text-sm mt-3">Loading appointment details...</Text>
          </View>
        ) : appointment ? (
          <>
            <View className="px-5 pt-3 mb-5">
              <View className="bg-surface border border-border rounded-xl p-5">
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center gap-2 flex-1 mr-2">
                    <Ionicons name={statusCfg.icon} size={22} color={statusCfg.color} />
                    <Text className="text-foreground text-base font-semibold flex-1" numberOfLines={1}>
                      {appointment.appointment_type || "Clinic Appointment"}
                    </Text>
                  </View>

                  <View
                    className={`px-3 py-1 rounded-full ${statusCfg.bgStyle} border ${statusCfg.borderStyle}`}
                  >
                    <Text className={`text-sm font-semibold uppercase ${statusCfg.textStyle}`}>
                      {statusCfg.label}
                    </Text>
                  </View>
                </View>

                <DataRow label="Scheduled Date" value={formattedDate} />
                <DataRow
                  label="Appointment Time"
                  value={appointment.appointment_time || "To be confirmed"}
                />
                <DataRow
                  label="Healthcare Facility"
                  value={
                    user?.facility_name ||
                    user?.facility?.facility_name ||
                    "Community Health Center"
                  }
                />
                {appointment.reason ? (
                  <DataRow label="Purpose / Notes" value={appointment.reason} />
                ) : null}

                {(appointment as any).sync_status === "pending" && (
                  <View className="mt-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex-row items-center gap-2">
                    <Ionicons name="cloud-offline-outline" size={16} color="#f59e0b" />
                    <Text className="text-amber-400 text-sm flex-1">
                      Stored locally on device. Will sync automatically once connected.
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {canCancel && (
              <View className="px-5 mb-6">
                <Pressable
                  onPress={handleCancelAppointment}
                  disabled={isCancelling}
                  className="bg-muted border border-blue-500/30 rounded-xl py-3.5 px-4 flex-row items-center justify-center gap-2 active:bg-muted"
                >
                  {isCancelling ? (
                    <ActivityIndicator size="small" color="#3b82f6" />
                  ) : (
                    <Ionicons name="close-circle-outline" size={18} color="#3b82f6" />
                  )}
                  <Text className="text-blue-400 font-semibold text-sm">
                    {isCancelling ? "Cancelling..." : "Cancel Appointment"}
                  </Text>
                </Pressable>
              </View>
            )}

            <View className="px-5 mb-5">
              <Text className="text-foreground text-base font-semibold mb-1">Maternal Vitals</Text>
              <Text className="text-muted-foreground text-sm mb-3">
                Latest recorded vitals for this pregnancy.
              </Text>

              {latestVisit ? (
                <Card
                  variant="secondary"
                  className="bg-surface border border-border rounded-xl px-4 py-1"
                >
                  <DataRow
                    label="Blood Pressure"
                    value={`${latestVisit.bp_systolic}/${latestVisit.bp_diastolic} mmHg`}
                  />
                  <DataRow label="Heart Rate" value={`${latestVisit.pulse_rate_bpm} bpm`} />
                  <DataRow label="Body Temp" value={`${latestVisit.temperature_celsius} °C`} />
                  <DataRow label="Weight" value={`${latestVisit.weight_kg} kg`} />
                </Card>
              ) : (
                <Card
                  variant="secondary"
                  className="bg-surface border border-border rounded-xl p-4 items-center"
                >
                  <Text className="text-muted-foreground text-sm">
                    No vital signs recorded for this visit yet.
                  </Text>
                </Card>
              )}
            </View>

            <View className="px-5">
              <Text className="text-foreground text-base font-semibold mb-1">
                Fetal & Visit Metrics
              </Text>
              <Text className="text-muted-foreground text-sm mb-3">
                Key indicators from your clinic records.
              </Text>

              {latestVisit ? (
                <Card
                  variant="secondary"
                  className="bg-surface border border-border rounded-xl px-4 py-1"
                >
                  <DataRow
                    label="Gestational Age"
                    value={`${latestVisit.age_of_gestation_weeks} Weeks`}
                  />
                  <DataRow
                    label="Fetal Heart Tone"
                    value={
                      latestVisit.fetal_heart_tone_bpm
                        ? `${latestVisit.fetal_heart_tone_bpm} bpm`
                        : "N/A"
                    }
                  />
                  <DataRow
                    label="Fundic Height"
                    value={
                      latestVisit.fundic_height_cm ? `${latestVisit.fundic_height_cm} cm` : "N/A"
                    }
                  />
                </Card>
              ) : (
                <Card
                  variant="secondary"
                  className="bg-surface border border-border rounded-xl p-4 items-center"
                >
                  <Text className="text-muted-foreground text-sm">No visit metrics recorded yet.</Text>
                </Card>
              )}
            </View>
          </>
        ) : (
          <View className="py-20 px-6 items-center justify-center">
            <Ionicons name="calendar-outline" size={48} color="#71717a" />
            <Text className="text-foreground font-semibold text-base mt-4 text-center">
              Appointment Not Found
            </Text>
            <Text className="text-muted-foreground text-sm mt-1 text-center max-w-xs">
              This appointment could not be located or may have been removed.
            </Text>
            <Pressable
              onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/history")}
              className="mt-5 bg-primary px-5 py-2.5 rounded-full"
            >
              <Text className="text-[#171717] text-sm font-semibold">Back to Appointments</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
