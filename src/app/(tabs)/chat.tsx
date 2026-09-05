import { View, TextInput, Pressable, KeyboardAvoidingView, Platform, FlatList, Alert } from "react-native";
import { Avatar, Text } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useRef, useEffect } from "react";
import type { JSX } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/UserContext";

type Message = {
  id: string;
  text: string;
  mine: boolean;
  time: string;
};

const INITIAL_MESSAGES: Message[] = [
  { id: "1", text: "Good morning! Just a reminder for your prenatal checkup on July 11.", mine: false, time: "9:01 AM" },
  { id: "2", text: "Thank you for the reminder! Will I need to fast before the appointment?", mine: true, time: "9:03 AM" },
  { id: "3", text: "No fasting needed for this visit. Just bring your health record booklet.", mine: false, time: "9:05 AM" },
  { id: "4", text: "Got it, thank you Dr. Petalio!", mine: true, time: "9:06 AM" },
];

export default function ChatScreen(): JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: trimmed,
      mine: true,
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText("");

    // Simulated automated doctor reply
    setTimeout(() => {
      const doctorReply: Message = {
        id: (Date.now() + 1).toString(),
        text: "Thank you for updating. Let me know if you experience any symptoms before your appointment.",
        mine: false,
        time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, doctorReply]);
    }, 1500);
  };

  const handleAttachment = () => {
    Alert.alert("Attach File", "Choose an item to attach to your message:", [
      { text: "Photo / Image", onPress: () => {} },
      { text: "Medical Document", onPress: () => {} },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleCall = () => {
    Alert.alert("Contact Facility", "Calling BMS Health Center hotline: (02) 8123-4567");
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      {/* Custom Chat Header */}
      <View className="px-4 pt-12 pb-3 bg-surface border-b border-default flex-row items-center justify-between">
        <View className="flex-row items-center gap-3 flex-1 mr-2">
          {/* Back Button */}
          <Pressable
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.push("/(tabs)/profile");
              }
            }}
            className="size-9 rounded-full bg-default items-center justify-center"
          >
            <Ionicons name="arrow-back" size={18} color="#a1a1aa" />
          </Pressable>

          {/* Doctor Avatar */}
          <View className="relative">
            <Avatar size="sm">
              <Avatar.Fallback delayMs={0}>
                <View className="w-full h-full bg-primary items-center justify-center">
                  <Text className="text-white text-xs font-bold">JP</Text>
                </View>
              </Avatar.Fallback>
            </Avatar>
            <View
              style={{
                position: "absolute",
                bottom: -1,
                right: -1,
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: "#10b981",
                borderWidth: 1.5,
                borderColor: "#18181b",
              }}
            />
          </View>

          {/* Doctor Info */}
          <View className="flex-1">
            <Text className="text-foreground font-bold text-base" numberOfLines={1}>
              Dr. Joseph Angelo Petalio
            </Text>
            <Text className="text-muted text-xs" numberOfLines={1}>
              OB-GYN · BMS Health Center
            </Text>
          </View>
        </View>

        {/* Header Actions */}
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={handleCall}
            className="size-9 rounded-full bg-default items-center justify-center"
          >
            <Ionicons name="call-outline" size={17} color="#a1a1aa" />
          </Pressable>
        </View>
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View className={`flex-row ${item.mine ? "justify-end" : "justify-start"}`}>
            <View
              className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                item.mine
                  ? "bg-primary rounded-tr-xs"
                  : "bg-surface border border-default rounded-tl-xs"
              }`}
            >
              <Text className={`text-base leading-5 ${item.mine ? "text-white font-medium" : "text-foreground"}`}>
                {item.text}
              </Text>
              <Text className={`text-xs mt-1.5 align-self-end ${item.mine ? "text-white/70" : "text-muted"}`}>
                {item.time}
              </Text>
            </View>
          </View>
        )}
      />

      {/* Input Bar */}
      <View className="px-4 py-3 bg-surface border-t border-default flex-row items-center gap-3">
        <Pressable
          onPress={handleAttachment}
          className="size-10 bg-default rounded-full items-center justify-center"
        >
          <Ionicons name="add" size={22} color="#a1a1aa" />
        </Pressable>

        <View className="flex-1 bg-default rounded-2xl px-4 py-2 flex-row items-center min-h-[44px]">
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor="#71717a"
            multiline
            className="flex-1 text-foreground text-base max-h-24 p-0"
          />
        </View>

        <Pressable
          onPress={handleSend}
          disabled={!inputText.trim()}
          className={`size-10 rounded-full items-center justify-center ${
            inputText.trim() ? "bg-primary" : "bg-default opacity-50"
          }`}
        >
          <Ionicons name="send" size={16} color={inputText.trim() ? "white" : "#71717a"} style={{ marginLeft: 2 }} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
