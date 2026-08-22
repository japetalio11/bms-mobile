import { View, TextInput, Pressable, KeyboardAvoidingView, Platform, FlatList } from "react-native";
import { Avatar, SearchField, Text } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../../components/Header";
import { useState } from "react";
import type { JSX } from "react";

type Message = {
  id: string;
  text: string;
  mine: boolean;
  time: string;
};

const MOCK_MESSAGES: Message[] = [
  { id: "1", text: "Good morning! Just a reminder for your prenatal checkup on July 11.", mine: false, time: "9:01 AM" },
  { id: "2", text: "Thank you for the reminder! Will I need to fast before the appointment?", mine: true, time: "9:03 AM" },
  { id: "3", text: "No fasting needed for this visit. Just bring your health record booklet.", mine: false, time: "9:05 AM" },
  { id: "4", text: "Got it, thank you!", mine: true, time: "9:06 AM" },
];

export default function ChatScreen(): JSX.Element {
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Header />

      {/* Doctor header */}
      <View className="items-center px-5 py-4 border-b border-separator">
        <Avatar size="md" className="mb-2">
          <Avatar.Fallback delayMs={0}>
            <View className="w-full h-full bg-blue-300" />
          </Avatar.Fallback>
        </Avatar>
        <Text className="text-foreground font-semibold text-base">Joseph Angelo Q. Petalio</Text>
        <Text className="text-muted text-sm">OB-GYN · BMS Health Center</Text>
      </View>

      {/* Messages */}
      <FlatList
        data={MOCK_MESSAGES}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, gap: 12 }}
        renderItem={({ item }) => (
          <View className={`flex-row ${item.mine ? "justify-end" : "justify-start"}`}>
            <View
              className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
                item.mine ? "bg-accent rounded-tr-sm" : "bg-surface rounded-tl-sm"
              }`}
            >
              <Text className={`text-base ${item.mine ? "text-white" : "text-foreground"}`}>{item.text}</Text>
              <Text className={`text-sm mt-1 ${item.mine ? "text-white/60" : "text-muted"}`}>{item.time}</Text>
            </View>
          </View>
        )}
      />

      {/* Input bar */}
      <View className="px-5 pb-28 pt-3 border-t border-separator">
        <View className="bg-default rounded-2xl p-3 flex-row items-end gap-2">
          <Pressable className="size-8 bg-surface-secondary rounded-full items-center justify-center mb-0.5">
            <Ionicons name="add" size={20} color="#a1a1aa" />
          </Pressable>

          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Message..."
            placeholderTextColor="#71717a"
            multiline
            className="flex-1 text-foreground text-base max-h-28 min-h-[36px] pt-1"
          />

          <Pressable className="size-8 bg-accent rounded-full items-center justify-center mb-0.5">
            <Ionicons name="send" size={14} color="white" style={{ marginLeft: 1 }} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
