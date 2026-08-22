import { View, ScrollView } from "react-native";
import type { JSX } from "react";
import { Card, Text, Switch, Button } from "heroui-native";
import { Header } from "../../components/Header";
import { useState } from "react";

export default function SecurityScreen(): JSX.Element {
  const [biometricsEnabled, setBiometricsEnabled] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  return (
    <View className="flex-1 bg-background">
      <Header showBackButton title="Security" rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        
        <View className="px-5 mb-6 pt-2">
          <Text className="text-muted text-sm font-medium mb-2 ml-1">Authentication</Text>
          <Card variant="secondary" className="bg-surface border-0 rounded-xl p-4">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1 mr-4">
                <Text className="text-foreground text-base font-medium">Biometric Login</Text>
                <Text className="text-muted text-sm mt-0.5">Use Face ID or Fingerprint to log in</Text>
              </View>
              <Switch 
                isSelected={biometricsEnabled} 
                onValueChange={setBiometricsEnabled} 
              />
            </View>
            <View className="h-px bg-default mb-4" />
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-4">
                <Text className="text-foreground text-base font-medium">Two-Factor Authentication</Text>
                <Text className="text-muted text-sm mt-0.5">Require a code when logging in on a new device</Text>
              </View>
              <Switch 
                isSelected={twoFactorEnabled} 
                onValueChange={setTwoFactorEnabled} 
              />
            </View>
          </Card>
        </View>

        <View className="px-5 mb-6">
          <Text className="text-muted text-sm font-medium mb-2 ml-1">Password</Text>
          <Card variant="secondary" className="bg-surface border-0 rounded-xl p-4">
            <Text className="text-foreground text-base font-medium mb-1">Change Password</Text>
            <Text className="text-muted text-sm mb-4">Last changed 3 months ago</Text>
            <Button variant="secondary" className="w-full bg-default border-0 rounded-xl">
              <Button.Label className="text-foreground font-medium">Update Password</Button.Label>
            </Button>
          </Card>
        </View>

        <View className="px-5 mb-6">
          <Text className="text-muted text-sm font-medium mb-2 ml-1">Active Sessions</Text>
          <Card variant="secondary" className="bg-surface border-0 rounded-xl p-4">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-foreground text-base font-medium">iPhone 13 Pro</Text>
                <Text className="text-muted text-sm mt-0.5">Active now · Manila, PH</Text>
              </View>
              <Text className="text-success text-sm font-medium">Current</Text>
            </View>
          </Card>
        </View>

      </ScrollView>
    </View>
  );
}
