import { View, ScrollView } from "react-native";
import { Text, Header as HeroHeader } from "heroui-native";
import { Avatar, Button } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import type { JSX } from "react";

function ProfileField({ label, value, icon }: { label: string; value: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View className="mb-4">
      <Text className="text-muted text-sm mb-1.5 ml-1">{label}</Text>
      <View className="bg-default rounded-xl flex-row items-center h-12 px-4 gap-3">
        <Text className="flex-1 text-foreground text-base">{value}</Text>
        {icon && <Ionicons name={icon} size={16} color="#71717a" />}
      </View>
    </View>
  );
}

export default function EditProfileScreen(): JSX.Element {
  return (
    <View className="flex-1 bg-background">
      <Header showBackButton title="Edit Profile" rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* Avatar section */}
        <View className="px-5 items-center pt-2 mb-6">
          <View className="relative mb-4">
            <Avatar size="lg" className="h-24 w-24">
              <Avatar.Fallback delayMs={0}>
                <View className="w-full h-full bg-orange-300" />
              </Avatar.Fallback>
            </Avatar>
            <View className="absolute bottom-0 right-0 size-8 bg-accent rounded-full items-center justify-center">
              <Ionicons name="camera-outline" size={14} color="white" />
            </View>
          </View>
          <Text className="text-foreground text-lg font-bold mb-0.5">Maria Santos</Text>
          <Text className="text-muted text-sm">msantos@gmail.com</Text>
        </View>

        {/* Form */}
        <View className="px-5">
          <Text className="text-muted text-sm font-medium mb-4 ml-1">Personal Information</Text>

          <ProfileField label="Full Name" value="Maria Santos" />
          <ProfileField label="Phone Number" value="+63 912 345 6789" icon="chevron-down" />
          <ProfileField label="Email Address" value="msantos@gmail.com" icon="mail-outline" />
          <ProfileField label="Birth Date" value="January 12, 1997" icon="calendar-outline" />
          <ProfileField label="Blood Type" value="O+" icon="chevron-down" />
        </View>

        <View className="px-5 mt-4">
          <Button variant="primary" className="rounded-xl">
            <Button.Label>Save Changes</Button.Label>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
