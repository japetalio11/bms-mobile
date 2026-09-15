import { View, ScrollView } from "react-native";
import type { JSX } from "react";
import { Card, Text, Switch } from "heroui-native";
import { Header } from "../../components/Header";
import { useSettings } from "../../context/settingsContext";

import { useRouter } from "expo-router";

export default function NotificationSettingsScreen(): JSX.Element {
  const router = useRouter();
  const { notifications, setNotificationSetting } = useSettings();

  return (
    <View className="flex-1 bg-background">
      <Header showBackButton title="Notification Preferences" onBack={() => router.push("/(tabs)/profile")} rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        
        <View className="px-5 mb-6 pt-2">
          <Text className="text-muted text-sm font-medium mb-2 ml-1">Maternal Care Reminders</Text>
          <Card variant="secondary" className="bg-surface border-0 rounded-xl p-4">
            
            {/* Prenatal Visit Reminders */}
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1 mr-4">
                <Text className="text-foreground text-base font-medium">Prenatal Visit Reminders</Text>
                <Text className="text-muted text-sm mt-0.5">Receive alerts for scheduled checkups and trimester milestones.</Text>
              </View>
              <Switch 
                isSelected={notifications.prenatalReminders} 
                {...({ onValueChange: (val: boolean) => setNotificationSetting("prenatalReminders", val) } as any)} 
              />
            </View>

            <View className="h-px bg-default mb-4" />

            {/* Daily Supplement & Iron Reminders */}
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1 mr-4">
                <Text className="text-foreground text-base font-medium">Supplement & Iron Reminders</Text>
                <Text className="text-muted text-sm mt-0.5">Daily reminder notifications to log and take prescribed vitamins.</Text>
              </View>
              <Switch 
                isSelected={notifications.supplementReminders} 
                {...({ onValueChange: (val: boolean) => setNotificationSetting("supplementReminders", val) } as any)} 
              />
            </View>

            <View className="h-px bg-default mb-4" />

            {/* Upcoming Appointment Alerts */}
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-4">
                <Text className="text-foreground text-base font-medium">Upcoming Appointment Alerts</Text>
                <Text className="text-muted text-sm mt-0.5">Alerts 24 hours and 1 hour before facility appointments.</Text>
              </View>
              <Switch 
                isSelected={notifications.appointmentAlerts} 
                {...({ onValueChange: (val: boolean) => setNotificationSetting("appointmentAlerts", val) } as any)} 
              />
            </View>

          </Card>
        </View>

        <View className="px-5 mb-6">
          <Text className="text-muted text-sm font-medium mb-2 ml-1">General Updates</Text>
          <Card variant="secondary" className="bg-surface border-0 rounded-xl p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-4">
                <Text className="text-foreground text-base font-medium">Health & Wellness Tips</Text>
                <Text className="text-muted text-sm mt-0.5">Receive weekly pregnancy advice and nutrition guides.</Text>
              </View>
              <Switch 
                isSelected={notifications.healthTips} 
                {...({ onValueChange: (val: boolean) => setNotificationSetting("healthTips", val) } as any)} 
              />
            </View>
          </Card>
        </View>

      </ScrollView>
    </View>
  );
}
