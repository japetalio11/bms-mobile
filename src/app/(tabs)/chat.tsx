import { View, TextInput, Pressable, KeyboardAvoidingView, Platform, FlatList, Alert, ActivityIndicator } from "react-native";
import { Avatar, Text } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useRef, useEffect, useCallback } from "react";
import type { JSX } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../context/UserContext";
import { useNetwork } from "../../context/NetworkContext";
import { getMessagesApi, sendMessageApi } from "../../config/api";
import type { InAppMessage, ChatContact } from "../../config/api";

type Message = {
  id: string;
  text: string;
  mine: boolean;
  time: string;
};

export default function ChatScreen(): JSX.Element {
  const router = useRouter();
  const { user, token } = useAuth();
  const { isOnline } = useNetwork();

  const [messages, setMessages] = useState<Message[]>([]);
  const [contact, setContact] = useState<ChatContact | null>(null);
  const [inputText, setInputText] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // Fetch messages from backend database
  const fetchMessages = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getMessagesApi(token);
      if (res.contact) {
        setContact(res.contact);
      }

      if (res.data) {
        const formatted: Message[] = res.data.map((msg) => ({
          id: msg.message_id,
          text: msg.message_content,
          mine: msg.sender_id === user.user_id,
          time: new Date(msg.message_date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        }));
        setMessages(formatted);
      }
    } catch (err) {
      console.warn("Failed to fetch messages:", err);
    }
  }, [token, user.user_id]);

  useFocusEffect(
    useCallback(() => {
      fetchMessages();
      // Poll every 8 seconds for new messages if online
      const interval = setInterval(() => {
        fetchMessages();
      }, 8000);
      return () => clearInterval(interval);
    }, [fetchMessages])
  );

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || !token || isSending) return;

    const tempId = Date.now().toString();
    const optimisticMessage: Message = {
      id: tempId,
      text: trimmed,
      mine: true,
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputText("");
    setIsSending(true);

    try {
      await sendMessageApi(
        {
          receiver_id: contact?.user_id,
          message_content: trimmed,
        },
        token
      );
      await fetchMessages();
    } catch (err: any) {
      Alert.alert("Send Failed", err.message || "Could not send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleAttachment = () => {
    Alert.alert("Attach File", "Choose an item to attach to your message:", [
      { text: "Photo / Image", onPress: () => {} },
      { text: "Medical Record Booklet", onPress: () => {} },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleCall = () => {
    Alert.alert("Contact Facility", "Calling BMS Health Center hotline: (02) 8123-4567");
  };

  const contactName = contact
    ? `Dr. ${contact.first_name} ${contact.last_name}`
    : "BMS Health Center Care Team";
  const contactRole = contact?.role
    ? `${contact.role} · BMS Health Center`
    : "Maternal Health Support";

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

          {/* Contact Avatar */}
          <View className="relative">
            <Avatar size="sm">
              <Avatar.Fallback delayMs={0}>
                <View className="w-full h-full bg-primary items-center justify-center">
                  <Text className="text-white text-xs font-bold">
                    {contact ? contact.first_name.charAt(0).toUpperCase() : "B"}
                  </Text>
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
                backgroundColor: isOnline ? "#10b981" : "#f59e0b",
                borderWidth: 1.5,
                borderColor: "#18181b",
              }}
            />
          </View>

          {/* Contact Info */}
          <View className="flex-1">
            <Text className="text-foreground font-bold text-base" numberOfLines={1}>
              {contactName}
            </Text>
            <Text className="text-muted text-xs" numberOfLines={1}>
              {contactRole}
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
      {messages.length > 0 ? (
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
      ) : (
        <View className="flex-1 items-center justify-center p-6">
          <View className="size-16 rounded-full bg-surface items-center justify-center mb-3">
            <Ionicons name="chatbubbles-outline" size={28} color="#f43f5e" />
          </View>
          <Text className="text-foreground font-bold text-lg mb-1">Direct Health Messaging</Text>
          <Text className="text-muted text-sm text-center max-w-xs leading-5">
            Send a direct message to your healthcare facility staff or doctor for guidance and support.
          </Text>
        </View>
      )}

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
          disabled={!inputText.trim() || isSending}
          className={`size-10 rounded-full items-center justify-center ${
            inputText.trim() && !isSending ? "bg-primary" : "bg-default opacity-50"
          }`}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="send" size={16} color={inputText.trim() ? "white" : "#71717a"} style={{ marginLeft: 2 }} />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
