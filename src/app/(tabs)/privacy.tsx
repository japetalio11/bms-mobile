import { View, ScrollView } from "react-native";
import type { JSX } from "react";
import { Card, Text, Switch, Button } from "heroui-native";
import { Header } from "../../components/Header";
import { useState } from "react";

export default function PrivacyScreen(): JSX.Element {
  const [shareData, setShareData] = useState(true);
  const [analytics, setAnalytics] = useState(true);

  return (
    <View className="flex-1 bg-background">
      <Header showBackButton title="Data Privacy" rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        
        <View className="px-5 mb-6 pt-2">
          <Text className="text-muted text-sm font-medium mb-2 ml-1">Data Sharing</Text>
          <Card variant="secondary" className="bg-surface border-0 rounded-xl p-4">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1 mr-4">
                <Text className="text-foreground text-base font-medium">Share Health Data</Text>
                <Text className="text-muted text-sm mt-0.5">Allow authorized healthcare providers to access your medical records securely.</Text>
              </View>
              <Switch 
                isSelected={shareData} 
                onValueChange={setShareData} 
              />
            </View>
            <View className="h-px bg-default mb-4" />
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-4">
                <Text className="text-foreground text-base font-medium">Analytics & Crash Reports</Text>
                <Text className="text-muted text-sm mt-0.5">Share anonymous usage data to help us improve the app.</Text>
              </View>
              <Switch 
                isSelected={analytics} 
                onValueChange={setAnalytics} 
              />
            </View>
          </Card>
        </View>

        <View className="px-5 mb-6">
          <Text className="text-muted text-sm font-medium mb-2 ml-1">Data Management</Text>
          <Card variant="secondary" className="bg-surface border-0 rounded-xl p-4 gap-4">
            <View>
              <Text className="text-foreground text-base font-medium mb-1">Request Data</Text>
              <Text className="text-muted text-sm mb-3">Download a copy of your health records and personal information.</Text>
              <Button variant="secondary" className="w-full bg-default border-0 rounded-xl">
                <Button.Label className="text-foreground font-medium">Download Data</Button.Label>
              </Button>
            </View>
            <View className="h-px bg-default" />
            <View>
              <Text className="text-danger text-base font-medium mb-1">Delete Account</Text>
              <Text className="text-muted text-sm mb-3">Permanently delete your account and all associated health data.</Text>
              <Button className="w-full bg-[#ef4444]/15 border-0 rounded-xl">
                <Button.Label className="text-[#ef4444] font-medium">Delete Account</Button.Label>
              </Button>
            </View>
          </Card>
        </View>

      </ScrollView>
    </View>
  );
}
