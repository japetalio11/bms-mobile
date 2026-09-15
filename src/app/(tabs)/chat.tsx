import {
  View,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  RefreshControl,
  Linking,
} from "react-native";
import { Avatar, Text } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { JSX } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useAuth } from "../../context/UserContext";
import { useNetwork } from "../../context/NetworkContext";
import {
  getMessagesApi,
  sendMessageApi,
  getFacilityStaffApi,
  uploadMessageFileApi,
  markMessagesAsReadApi,
} from "../../config/api";
import type { InAppMessage, ChatContact } from "../../config/api";

type MessageBubble = {
  id: string;
  text: string;
  mine: boolean;
  time: string;
  type: string; // 'text' | 'image' | 'file'
  dateRaw: string;
};

export default function ChatScreen(): JSX.Element {
  const router = useRouter();
  const { user, token } = useAuth();
  const { isOnline } = useNetwork();

  // State
  const [staffList, setStaffList] = useState<ChatContact[]>([]);
  const [allMessages, setAllMessages] = useState<InAppMessage[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<ChatContact | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [hasFacility, setHasFacility] = useState<boolean | null>(user?.facility_id ? true : null);

  // Chat conversation state
  const [inputText, setInputText] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  // Fetch all messages and staff directory for affiliated facility
  const fetchAllData = useCallback(async () => {
    if (!token) return;
    try {
      const [messagesRes, staffRes] = await Promise.all([
        getMessagesApi(token).catch((e) => {
          console.warn("Error fetching messages:", e);
          return { data: [], hasFacility: undefined, contact: undefined };
        }),
        getFacilityStaffApi(token, user?.facility_id || undefined).catch((e) => {
          console.warn("Error fetching staff:", e);
          return [];
        }),
      ]);

      if (messagesRes.hasFacility !== undefined) {
        setHasFacility(messagesRes.hasFacility);
      } else if (!user?.facility_id) {
        setHasFacility(false);
      } else {
        setHasFacility(true);
      }

      setAllMessages(messagesRes.data || []);
      setStaffList(staffRes || []);
    } catch (err) {
      console.warn("Failed to fetch chat data:", err);
    }
  }, [token, user?.facility_id]);

  useFocusEffect(
    useCallback(() => {
      fetchAllData();
      const interval = setInterval(() => {
        fetchAllData();
      }, 7000);
      return () => clearInterval(interval);
    }, [fetchAllData])
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchAllData();
    setIsRefreshing(false);
  };

  // Mark messages as read when opening a conversation with a staff member
  useEffect(() => {
    if (selectedStaff && token) {
      markMessagesAsReadApi(selectedStaff.user_id, token);
    }
  }, [selectedStaff, token]);

  // Compute per-staff metadata (last message, unread count, timestamp)
  const staffWithMeta = useMemo(() => {
    return staffList.map((staff) => {
      // Filter messages strictly between current mother and this staff member
      const threadMessages = allMessages.filter(
        (m) =>
          (m.sender_id === staff.user_id && m.receiver_id === user?.user_id) ||
          (m.sender_id === user?.user_id && m.receiver_id === staff.user_id)
      );

      // Latest message
      const lastMsg = threadMessages.length > 0 ? threadMessages[threadMessages.length - 1] : null;

      // Count unread messages received from this staff member
      const unreadCount = threadMessages.filter(
        (m) => m.sender_id === staff.user_id && !m.is_read
      ).length;

      let previewText = "Tap to start conversation";
      if (lastMsg) {
        const isImg =
          lastMsg.message_type === "image" ||
          lastMsg.message_content.startsWith("data:image/") ||
          /\.(jpg|jpeg|png|webp|gif)$/i.test(lastMsg.message_content);
        const isDoc =
          lastMsg.message_type === "file" ||
          lastMsg.message_content.startsWith("data:application/") ||
          /\.(pdf|docx?|xlsx?|txt|csv|zip)$/i.test(lastMsg.message_content);

        if (isImg) {
          previewText = lastMsg.sender_id === user?.user_id ? "You sent a photo" : "📷 Photo attached";
        } else if (isDoc) {
          previewText = lastMsg.sender_id === user?.user_id ? "You sent a document" : "📄 Document attached";
        } else {
          const prefix = lastMsg.sender_id === user?.user_id ? "You: " : "";
          previewText = `${prefix}${lastMsg.message_content}`;
        }
      }

      return {
        ...staff,
        lastMessage: previewText,
        lastMessageDate: lastMsg ? lastMsg.message_date : null,
        unreadCount: unreadCount,
      };
    });
  }, [staffList, allMessages, user?.user_id]);

  // Filter staff directory by search query and role filter
  const filteredStaff = useMemo(() => {
    let list = staffWithMeta;

    if (roleFilter !== "All") {
      list = list.filter((s) => {
        const r = (s.role || "").toLowerCase();
        if (roleFilter === "Doctor") return r.includes("doctor");
        if (roleFilter === "Midwife") return r.includes("midwife");
        if (roleFilter === "Nurse") return r.includes("nurse");
        if (roleFilter === "HealthWorker") return r.includes("healthworker") || r.includes("worker") || r.includes("staff");
        return true;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) => {
        const fullName = `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase();
        const roleName = (s.role || "").toLowerCase();
        return fullName.includes(q) || roleName.includes(q);
      });
    }

    // Sort by latest message date first, then by name
    return list.sort((a, b) => {
      if (a.lastMessageDate && b.lastMessageDate) {
        return new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime();
      }
      if (a.lastMessageDate) return -1;
      if (b.lastMessageDate) return 1;
      return (a.first_name || "").localeCompare(b.first_name || "");
    });
  }, [staffWithMeta, searchQuery, roleFilter]);

  // Messages for the currently selected 1-to-1 chat
  const currentChatMessages = useMemo<MessageBubble[]>(() => {
    if (!selectedStaff) return [];

    return allMessages
      .filter(
        (m) =>
          (m.sender_id === selectedStaff.user_id && m.receiver_id === user?.user_id) ||
          (m.sender_id === user?.user_id && m.receiver_id === selectedStaff.user_id)
      )
      .map((msg) => {
        const isImg =
          msg.message_type === "image" ||
          msg.message_content.startsWith("data:image/") ||
          /\.(jpg|jpeg|png|webp|gif)$/i.test(msg.message_content);
        const isDoc =
          msg.message_type === "file" ||
          msg.message_content.startsWith("data:application/") ||
          /\.(pdf|docx?|xlsx?|txt|csv|zip)$/i.test(msg.message_content);

        return {
          id: msg.message_id,
          text: msg.message_content,
          mine: msg.sender_id === user?.user_id,
          time: new Date(msg.message_date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
          type: isImg ? "image" : isDoc ? "file" : "text",
          dateRaw: msg.message_date,
        };
      });
  }, [allMessages, selectedStaff, user?.user_id]);

  useEffect(() => {
    if (currentChatMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [currentChatMessages]);

  // Send Text Message
  const handleSendText = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || !token || !selectedStaff || isSending) return;

    const tempId = `temp_${Date.now()}`;
    const optimistic: MessageBubble = {
      id: tempId,
      text: trimmed,
      mine: true,
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      type: "text",
      dateRaw: new Date().toISOString(),
    };

    setInputText("");
    setIsSending(true);

    try {
      await sendMessageApi(
        {
          receiver_id: selectedStaff.user_id,
          message_content: trimmed,
          message_type: "text",
        },
        token
      );
      await fetchAllData();
    } catch (err: any) {
      Alert.alert("Send Failed", err.message || "Could not send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  // Upload and send attachment (Image or File)
  const uploadAndSendAttachment = async (
    fileInfo: { uri: string; name: string; type: string },
    detectedType: "image" | "file"
  ) => {
    if (!token || !selectedStaff || isSending) return;
    setIsSending(true);

    try {
      const formData = new FormData();
      formData.append("file", {
        uri: fileInfo.uri,
        name: fileInfo.name,
        type: fileInfo.type,
      } as any);

      const uploadRes = await uploadMessageFileApi(formData, token);
      const serverUrl = uploadRes.fileUrl;

      await sendMessageApi(
        {
          receiver_id: selectedStaff.user_id,
          message_content: serverUrl,
          message_type: detectedType,
        },
        token
      );

      await fetchAllData();
    } catch (err: any) {
      console.error("Attachment upload error:", err);
      Alert.alert("Upload Failed", err.message || "Could not send attachment. Please check your internet connection.");
    } finally {
      setIsSending(false);
    }
  };

  // Handle Photo selection (Camera or Gallery)
  const handlePickImage = async (useCamera = false) => {
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Camera Permission", "Camera access is needed to capture photos.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await uploadAndSendAttachment(
          {
            uri: asset.uri,
            name: asset.fileName || `photo_${Date.now()}.jpg`,
            type: asset.mimeType || "image/jpeg",
          },
          "image"
        );
      }
    } catch (err: any) {
      console.warn("Image picker error:", err);
      Alert.alert("Error", "Could not pick image.");
    }
  };

  // Handle Document Selection (PDF / Records)
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["*/*"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const isImg = asset.mimeType?.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(asset.name);
        await uploadAndSendAttachment(
          {
            uri: asset.uri,
            name: asset.name || "document.pdf",
            type: asset.mimeType || "application/pdf",
          },
          isImg ? "image" : "file"
        );
      }
    } catch (err: any) {
      console.warn("Document picker error:", err);
      Alert.alert("Error", "Could not pick document.");
    }
  };

  // Attachment Options Action Sheet
  const handleAttachmentMenu = () => {
    Alert.alert("Attach File or Photo", "Select an option to share with your healthcare provider:", [
      { text: "📷 Take Photo", onPress: () => handlePickImage(true) },
      { text: "🖼️ Photo Library", onPress: () => handlePickImage(false) },
      { text: "📄 Document / Record", onPress: () => handlePickDocument() },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // Format timestamp for directory
  const formatTimeLabel = (dateStr: string | null) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      }
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      if (d.toDateString() === yest.toDateString()) {
        return "Yesterday";
      }
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  // Render role badge colors
  const getRoleBadgeStyle = (role: string) => {
    const r = (role || "").toLowerCase();
    if (r.includes("doctor")) {
      return { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400" };
    }
    if (r.includes("midwife")) {
      return { bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-400" };
    }
    if (r.includes("nurse")) {
      return { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400" };
    }
    return { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400" };
  };

  // 1. Not affiliated with facility screen
  if (hasFacility === false || (!user?.facility_id && hasFacility !== true)) {
    return (
      <View className="flex-1 bg-background">
        <View className="px-4 pt-12 pb-3 bg-surface border-b border-default flex-row items-center gap-3">
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
          <Text className="text-foreground font-bold text-lg">Direct Messaging</Text>
        </View>

        <View className="flex-1 items-center justify-center p-6">
          <View className="size-20 rounded-full bg-rose-500/10 border border-rose-500/20 items-center justify-center mb-4">
            <Ionicons name="business-outline" size={36} color="#f43f5e" />
          </View>
          <Text className="text-foreground font-bold text-xl mb-2 text-center">
            Not Affiliated with any Facility
          </Text>
          <Text className="text-muted text-sm text-center max-w-sm leading-6 mb-6">
            You are currently not affiliated with any healthcare facility. Direct messaging is only available once your account is linked to a health center.
          </Text>

          <Pressable
            onPress={() => router.push("/(tabs)/profile")}
            className="bg-primary px-6 py-3 rounded-full flex-row items-center gap-2 shadow-xs"
          >
            <Ionicons name="person-circle-outline" size={20} color="white" />
            <Text className="text-white font-semibold text-sm">View Profile</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // 2. 1-to-1 Chat Screen with Selected Staff Member
  if (selectedStaff) {
    const staffBadge = getRoleBadgeStyle(selectedStaff.role);
    const staffDisplayName = selectedStaff.role.toLowerCase().includes("doctor")
      ? `Dr. ${selectedStaff.first_name} ${selectedStaff.last_name}`
      : `${selectedStaff.first_name} ${selectedStaff.last_name}`;

    return (
      <KeyboardAvoidingView
        className="flex-1 bg-background"
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Chat Header */}
        <View className="px-4 pt-12 pb-3 bg-surface border-b border-default flex-row items-center justify-between">
          <View className="flex-row items-center gap-3 flex-1">
            {/* Back Button -> Returns to Messenger Staff Directory */}
            <Pressable
              onPress={() => setSelectedStaff(null)}
              className="size-9 rounded-full bg-default items-center justify-center"
            >
              <Ionicons name="arrow-back" size={18} color="#a1a1aa" />
            </Pressable>

            {/* Staff Avatar */}
            <View className="relative">
              <Avatar size="sm">
                {selectedStaff.profile_url ? (
                  <Avatar.Image source={{ uri: selectedStaff.profile_url }} />
                ) : (
                  <Avatar.Fallback delayMs={0}>
                    <View className="w-full h-full bg-primary/20 items-center justify-center">
                      <Text className="text-primary text-xs font-bold">
                        {selectedStaff.first_name ? selectedStaff.first_name.charAt(0).toUpperCase() : "S"}
                      </Text>
                    </View>
                  </Avatar.Fallback>
                )}
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

            {/* Staff Info */}
            <View className="flex-1 min-w-0">
              <Text className="text-foreground font-bold text-base" numberOfLines={1}>
                {staffDisplayName}
              </Text>
              <View className="flex-row items-center gap-1.5 mt-0.5">
                <View className={`px-1.5 py-0.2 rounded border ${staffBadge.bg} ${staffBadge.border}`}>
                  <Text className={`text-[10px] font-semibold ${staffBadge.text}`}>
                    {selectedStaff.role}
                  </Text>
                </View>
                {selectedStaff.facility?.facility_name && (
                  <Text className="text-muted text-xs truncate" numberOfLines={1}>
                    • {selectedStaff.facility.facility_name}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Message History */}
        {currentChatMessages.length > 0 ? (
          <FlatList
            ref={flatListRef}
            data={currentChatMessages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, gap: 12 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View className={`flex-row ${item.mine ? "justify-end" : "justify-start"}`}>
                <View
                  className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl ${
                    item.mine
                      ? "bg-primary rounded-tr-xs"
                      : "bg-surface border border-default rounded-tl-xs shadow-xs"
                  }`}
                >
                  {/* Image Attachment Rendering */}
                  {item.type === "image" ? (
                    <Pressable onPress={() => setPreviewImage(item.text)} className="overflow-hidden rounded-xl">
                      <Image
                        source={{ uri: item.text }}
                        style={{ width: 220, height: 180, borderRadius: 12 }}
                        resizeMode="cover"
                      />
                    </Pressable>
                  ) : item.type === "file" ? (
                    /* Document Attachment Rendering */
                    <Pressable
                      onPress={() => Linking.openURL(item.text).catch(() => Alert.alert("Error", "Could not open file"))}
                      className="flex-row items-center gap-3 p-2 bg-black/20 rounded-xl"
                    >
                      <View className="size-10 rounded-lg bg-primary/20 items-center justify-center">
                        <Ionicons name="document-text" size={22} color="white" />
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className="text-white text-xs font-semibold" numberOfLines={1}>
                          {item.text.split("/").pop() || "Document Attachment"}
                        </Text>
                        <Text className="text-white/70 text-[10px]">Tap to open / download</Text>
                      </View>
                      <Ionicons name="download-outline" size={18} color="white" />
                    </Pressable>
                  ) : (
                    /* Regular Text Message */
                    <Text className={`text-base leading-5 ${item.mine ? "text-white font-medium" : "text-foreground"}`}>
                      {item.text}
                    </Text>
                  )}

                  <Text className={`text-[10px] mt-1.5 align-self-end ${item.mine ? "text-white/70" : "text-muted"}`}>
                    {item.time}
                  </Text>
                </View>
              </View>
            )}
          />
        ) : (
          <View className="flex-1 items-center justify-center p-6">
            <View className="size-16 rounded-full bg-surface items-center justify-center mb-3">
              <Ionicons name="chatbubble-ellipses-outline" size={28} color="#f43f5e" />
            </View>
            <Text className="text-foreground font-bold text-lg mb-1">Personalized 1-to-1 Chat</Text>
            <Text className="text-muted text-sm text-center max-w-xs leading-5">
              Send a direct message or share health records with {staffDisplayName}.
            </Text>
          </View>
        )}

        {/* Input Bar */}
        <View className="px-4 py-3 bg-surface border-t border-default flex-row items-center gap-3">
          <Pressable
            onPress={handleAttachmentMenu}
            disabled={isSending}
            className="size-10 bg-default rounded-full items-center justify-center active:scale-95"
          >
            <Ionicons name="add" size={22} color="#a1a1aa" />
          </Pressable>

          <View className="flex-1 bg-default rounded-2xl px-4 py-2 flex-row items-center min-h-[44px]">
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder={isSending ? "Sending attachment..." : "Type your message..."}
              placeholderTextColor="#71717a"
              multiline
              editable={!isSending}
              className="flex-1 text-foreground text-base max-h-24 p-0"
            />
          </View>

          <Pressable
            onPress={handleSendText}
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

        {/* Full Screen Image Preview Modal */}
        <Modal
          visible={!!previewImage}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setPreviewImage(null)}
        >
          <View className="flex-1 bg-black/95 justify-center items-center p-4">
            <Pressable
              onPress={() => setPreviewImage(null)}
              className="absolute top-12 right-6 size-10 rounded-full bg-white/20 items-center justify-center z-10"
            >
              <Ionicons name="close" size={24} color="white" />
            </Pressable>
            {previewImage && (
              <Image
                source={{ uri: previewImage }}
                className="w-full h-4/5 rounded-xl"
                resizeMode="contain"
              />
            )}
          </View>
        </Modal>
      </KeyboardAvoidingView>
    );
  }

  // 3. Messenger-Style Staff & Conversations Directory View
  const facilityTitle = user?.facility_name || user?.facility?.facility_name || "Facility Healthcare Team";

  return (
    <View className="flex-1 bg-background">
      {/* Top Header */}
      <View className="px-5 pt-12 pb-3 bg-surface border-b border-default">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-3">
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
            <View>
              <Text className="text-foreground font-bold text-xl">Messages</Text>
              <Text className="text-muted text-xs truncate max-w-[240px]" numberOfLines={1}>
                {facilityTitle}
              </Text>
            </View>
          </View>

          <View className="size-9 rounded-full bg-default items-center justify-center">
            <Ionicons name="chatbubbles" size={18} color="#f43f5e" />
          </View>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-default rounded-xl px-3 py-2">
          <Ionicons name="search-outline" size={18} color="#71717a" className="mr-2" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search healthcare staff by name or role..."
            placeholderTextColor="#71717a"
            className="flex-1 text-foreground text-sm p-0"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color="#71717a" />
            </Pressable>
          )}
        </View>

        {/* Role Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3"
          contentContainerStyle={{ gap: 8, paddingRight: 8 }}
        >
          {["All", "Doctor", "Midwife", "Nurse", "HealthWorker"].map((role) => {
            const isSelected = roleFilter === role;
            return (
              <Pressable
                key={role}
                onPress={() => setRoleFilter(role)}
                className={`px-3 py-1.5 rounded-full border ${
                  isSelected
                    ? "bg-primary border-primary"
                    : "bg-surface border-default"
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    isSelected ? "text-white" : "text-muted"
                  }`}
                >
                  {role === "HealthWorker" ? "Health Worker" : role}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Staff & Conversation List */}
      <FlatList
        data={filteredStaff}
        keyExtractor={(item) => item.user_id}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#f43f5e" />
        }
        contentContainerStyle={{ paddingVertical: 8 }}
        ListEmptyComponent={
          <View className="items-center justify-center p-10">
            <View className="size-14 rounded-full bg-surface items-center justify-center mb-3">
              <Ionicons name="people-outline" size={24} color="#71717a" />
            </View>
            <Text className="text-foreground font-semibold text-base mb-1">No Staff Found</Text>
            <Text className="text-muted text-xs text-center max-w-xs">
              {searchQuery ? "No staff matches your search query." : "No healthcare staff members are listed for your facility."}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const badge = getRoleBadgeStyle(item.role);
          const displayName = item.role.toLowerCase().includes("doctor")
            ? `Dr. ${item.first_name} ${item.last_name}`
            : `${item.first_name} ${item.last_name}`;

          return (
            <Pressable
              onPress={() => setSelectedStaff(item)}
              className="flex-row items-center px-5 py-3.5 border-b border-default/50 active:bg-surface/50"
            >
              {/* Staff Avatar with Online Dot */}
              <View className="relative mr-3.5">
                <Avatar size="md">
                  {item.profile_url ? (
                    <Avatar.Image source={{ uri: item.profile_url }} />
                  ) : (
                    <Avatar.Fallback delayMs={0}>
                      <View className="w-full h-full bg-primary/20 items-center justify-center">
                        <Text className="text-primary text-base font-bold">
                          {item.first_name ? item.first_name.charAt(0).toUpperCase() : "S"}
                        </Text>
                      </View>
                    </Avatar.Fallback>
                  )}
                </Avatar>

                {/* Status Dot */}
                <View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: isOnline ? "#10b981" : "#f59e0b",
                    borderWidth: 2,
                    borderColor: "#18181b",
                  }}
                />
              </View>

              {/* Staff Details & Last Message Preview */}
              <View className="flex-1 min-w-0 pr-2">
                <View className="flex-row items-center justify-between gap-1 mb-1">
                  <Text
                    className={`text-base font-bold truncate ${
                      item.unreadCount > 0 ? "text-foreground" : "text-foreground/90"
                    }`}
                    numberOfLines={1}
                  >
                    {displayName}
                  </Text>
                  {item.lastMessageDate && (
                    <Text className="text-muted text-[11px] shrink-0">
                      {formatTimeLabel(item.lastMessageDate)}
                    </Text>
                  )}
                </View>

                <View className="flex-row items-center gap-1.5 mb-1">
                  <View className={`px-1.5 py-0.2 rounded border ${badge.bg} ${badge.border}`}>
                    <Text className={`text-[10px] font-semibold ${badge.text}`}>
                      {item.role}
                    </Text>
                  </View>
                  {item.facility?.facility_name && (
                    <Text className="text-muted text-[11px] truncate flex-1" numberOfLines={1}>
                      • {item.facility.facility_name}
                    </Text>
                  )}
                </View>

                {/* Snippet */}
                <View className="flex-row items-center justify-between">
                  <Text
                    className={`text-xs truncate flex-1 mr-2 ${
                      item.unreadCount > 0 ? "text-foreground font-semibold" : "text-muted"
                    }`}
                    numberOfLines={1}
                  >
                    {item.lastMessage}
                  </Text>

                  {/* Unread Badge */}
                  {item.unreadCount > 0 && (
                    <View className="size-5 rounded-full bg-primary items-center justify-center shrink-0">
                      <Text className="text-white text-[10px] font-bold">
                        {item.unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <Ionicons name="chevron-forward" size={18} color="#71717a" />
            </Pressable>
          );
        }}
      />
    </View>
  );
}
