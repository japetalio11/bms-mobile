import { Ionicons } from "@expo/vector-icons";

export type AppointmentStatusConfig = {
  label: string;
  color: string;
  bgStyle: string;
  borderStyle: string;
  textStyle: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export function getAppointmentStatusConfig(statusStr: string): AppointmentStatusConfig {
  const s = (statusStr || "").toLowerCase().trim();

  if (s === "scheduled") {
    return {
      label: "Scheduled",
      color: "#38bdf8",
      bgStyle: "bg-sky-500/15",
      borderStyle: "border-sky-500/30",
      textStyle: "text-sky-400",
      icon: "calendar-outline",
    };
  }

  if (s === "confirmed") {
    return {
      label: "Confirmed",
      color: "#2dd4bf",
      bgStyle: "bg-teal-500/15",
      borderStyle: "border-teal-500/30",
      textStyle: "text-teal-400",
      icon: "checkmark-circle-outline",
    };
  }

  if (s === "completed") {
    return {
      label: "Completed",
      color: "#10b981",
      bgStyle: "bg-emerald-500/15",
      borderStyle: "border-emerald-500/30",
      textStyle: "text-emerald-400",
      icon: "checkmark-done-circle-outline",
    };
  }

  if (s === "cancelled" || s === "canceled") {
    return {
      label: "Cancelled",
      color: "#ef4444",
      bgStyle: "bg-blue-500/15",
      borderStyle: "border-blue-500/30",
      textStyle: "text-blue-400",
      icon: "close-circle-outline",
    };
  }

  if (s === "missed") {
    return {
      label: "Missed",
      color: "#f97316",
      bgStyle: "bg-orange-500/15",
      borderStyle: "border-orange-500/30",
      textStyle: "text-orange-400",
      icon: "alert-circle-outline",
    };
  }

  if (s === "pending") {
    return {
      label: "Pending",
      color: "#eab308",
      bgStyle: "bg-amber-500/15",
      borderStyle: "border-amber-500/30",
      textStyle: "text-amber-400",
      icon: "hourglass-outline",
    };
  }

  if (s === "rescheduled") {
    return {
      label: "Rescheduled",
      color: "#a78bfa",
      bgStyle: "bg-purple-500/15",
      borderStyle: "border-purple-500/30",
      textStyle: "text-purple-400",
      icon: "refresh-circle-outline",
    };
  }

  return {
    label: statusStr ? statusStr.charAt(0).toUpperCase() + statusStr.slice(1) : "Scheduled",
    color: "#38bdf8",
    bgStyle: "bg-sky-500/15",
    borderStyle: "border-sky-500/30",
    textStyle: "text-sky-400",
    icon: "calendar-outline",
  };
}
