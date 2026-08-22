import { View, ScrollView } from "react-native";
import { Text, Card, Tabs } from "heroui-native";
import { Header } from "../../components/Header";
import { useState } from "react";
import type { JSX } from "react";

const DataRow = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-row justify-between py-3 border-b border-separator last:border-0">
    <Text className="text-muted text-sm">{label}</Text>
    <Text className="text-foreground text-sm font-medium">{value}</Text>
  </View>
);

export default function VitalsScreen(): JSX.Element {
  const [activeTab, setActiveTab] = useState("maternal");

  return (
    <View className="flex-1 bg-background">
      <Header showBackButton title="Vitals & Analytics" rightIcon={null} />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* Tabs */}
        <View className="px-5 mb-5">
          <Tabs value={activeTab} onValueChange={setActiveTab} variant="primary">
            <Tabs.List className="bg-default p-1 rounded-xl">
              <Tabs.Indicator className="bg-surface-secondary rounded-xl" />
              <Tabs.Trigger value="maternal">
                {({ isSelected }) => (
                  <Tabs.Label className={`font-medium text-sm py-2 ${isSelected ? "text-foreground" : "text-muted"}`}>
                    Maternal Analytics
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
              <Tabs.Trigger value="newborn">
                {({ isSelected }) => (
                  <Tabs.Label className={`font-medium text-sm py-2 ${isSelected ? "text-foreground" : "text-muted"}`}>
                    Newborn Analytics
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs>
        </View>

        {activeTab === "maternal" && (
          <View className="px-5">
            <Text className="text-foreground text-base font-semibold mb-1">Maternal Vitals</Text>
            <Text className="text-muted text-sm mb-4">Last updated: June 8, 2026</Text>
            <Card variant="secondary" className="bg-surface border-0 rounded-xl px-4 py-1">
              <DataRow label="Blood Pressure" value="120/80 mmHg" />
              <DataRow label="Heart Rate" value="75 bpm" />
              <DataRow label="Blood Sugar" value="90 mg/dL" />
              <DataRow label="Body Temp" value="37.0 °C" />
              <DataRow label="Weight" value="65 kg" />
              <DataRow label="Respiratory Rate" value="16 breaths/min" />
              <DataRow label="O2 Saturation" value="98%" />
            </Card>
          </View>
        )}

        {activeTab === "newborn" && (
          <View className="px-5">
            <Card variant="secondary" className="bg-surface border-0 rounded-xl p-6 items-center">
              <View className="size-16 rounded-full bg-default items-center justify-center mb-3">
                <Text className="text-3xl">👶</Text>
              </View>
              <Text className="text-foreground font-semibold text-base mb-1">No Data Yet</Text>
              <Text className="text-muted text-sm text-center leading-5">
                Newborn analytics will be available after delivery.
              </Text>
            </Card>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
