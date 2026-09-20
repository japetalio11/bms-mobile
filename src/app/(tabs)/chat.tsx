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
  Keyboard,
} from "react-native";
import { Avatar, Text } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { JSX } from "react";
import { useRouter, useFocusEffect, useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "../../context/UserContext";
import { useNetwork } from "../../context/NetworkContext";
import { useConfirm } from "../../context/ConfirmationContext";
import {
  getMessagesApi,
  sendMessageApi,
  getFacilityStaffApi,
  uploadMessageFileApi,
  markMessagesAsReadApi,
  formatFormDataFile,
  getFullFileUrl,
} from "../../config/api";
import type { InAppMessage, ChatContact } from "../../config/api";
import {
  getMessagesLocal,
  saveMessagesLocal,
  saveOutgoingMessageLocal,
  deleteLocalMessage,
  getChatContactsLocal,
  saveChatContactsLocal,
} from "../../db/repository";

type MessageBubble = {
  id: string;
  text: string;
  mine: boolean;
  time: string;
  type: string; // 'text' | 'image' | 'file'
  dateRaw: string;
  status?: "sending" | "sent" | "failed" | "queued";
};

export default function ChatScreen(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, token, motherRecord } = useAuth();
  const { isOnline } = useNetwork();
  const { confirm } = useConfirm();

  const assignedWorkerId =
    motherRecord?.assigned_worker_id ||
    motherRecord?.assignedWorker?.user_id ||
    null;

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
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [sendingMessageIds, setSendingMessageIds] = useState<Set<string>>(new Set());

  // Attachment Modal States
  const [isAttachmentSheetVisible, setIsAttachmentSheetVisible] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    uri: string;
    name: string;
    type: string;
    sizeFormatted: string;
    detectedType: "image" | "file";
  } | null>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setIsKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const flatListRef = useRef<FlatList>(null);

  const isInitialHydrationDone = useRef(false);

  // Fetch all messages and staff directory for affiliated facility
  const fetchAllData = useCallback(async () => {
    if (!token && !user?.user_id) return;
    try {
      // 1. Initial hydration or Offline: read from local SQLite
      if (user?.user_id && (!isInitialHydrationDone.current || !isOnline)) {
        const [localMsgs, localStaff] = await Promise.all([
          getMessagesLocal(user.user_id),
          getChatContactsLocal(user.facility_id || undefined),
        ]);
        if (localMsgs.length > 0) {
          setAllMessages((prev) => {
            if (prev.length === 0) return localMsgs;
            const map = new Map<string, InAppMessage>();
            localMsgs.forEach((m) => map.set(m.message_id, m));
            prev.forEach((m) => map.set(m.message_id, m));
            return Array.from(map.values());
          });
        }
        if (localStaff.length > 0) {
          setStaffList(localStaff);
        }
        isInitialHydrationDone.current = true;
      }

      // If offline, don't attempt network calls
      if (!isOnline || !token) {
        return;
      }

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

      const remoteMessages = messagesRes.data || [];
      let remoteStaff = staffRes || [];

      if (messagesRes.contact && !remoteStaff.some((s) => s.user_id === messagesRes.contact?.user_id)) {
        remoteStaff = [messagesRes.contact, ...remoteStaff];
      }
      if (motherRecord?.assignedWorker && !remoteStaff.some((s) => s.user_id === motherRecord.assignedWorker?.user_id)) {
        remoteStaff = [motherRecord.assignedWorker as any, ...remoteStaff];
      }

      // Merge remote messages with in-flight local messages & recently sent state to prevent race-condition drops
      setAllMessages((prev) => {
        const map = new Map<string, InAppMessage>();

        // 1. Add all remote messages
        remoteMessages.forEach((m) => map.set(m.message_id, m));

        // 2. Preserve local/in-flight messages from state that aren't in remoteMessages yet
        prev.forEach((m) => {
          if (map.has(m.message_id)) return;

          // Check if remote already contains a matching message (by sender, receiver, content, timestamp)
          const matchingRemote = remoteMessages.find(
            (rm) =>
              rm.sender_id === m.sender_id &&
              rm.receiver_id === m.receiver_id &&
              rm.message_content === m.message_content &&
              Math.abs(new Date(rm.message_date).getTime() - new Date(m.message_date).getTime()) < 120000
          );

          if (!matchingRemote) {
            // Keep message if it's a local draft or sent recently (< 3 min)
            const isLocal = m.message_id.startsWith("local_");
            const isRecent = Math.abs(Date.now() - new Date(m.message_date).getTime()) < 180000;
            if (isLocal || (isRecent && m.sender_id === user?.user_id)) {
              map.set(m.message_id, m);
            }
          } else {
            if (m.message_id.startsWith("local_")) {
              deleteLocalMessage(m.message_id).catch(() => {});
            }
          }
        });

        return Array.from(map.values()).sort(
          (a, b) => new Date(a.message_date).getTime() - new Date(b.message_date).getTime()
        );
      });

      if (remoteStaff.length > 0) {
        setStaffList(remoteStaff);
      }

      // Persist fresh network data to SQLite database
      if (remoteMessages.length > 0) {
        await saveMessagesLocal(remoteMessages);
      }
      if (remoteStaff.length > 0) {
        await saveChatContactsLocal(remoteStaff);
      }
      isInitialHydrationDone.current = true;
    } catch (err) {
      console.warn("Failed to fetch chat data:", err);
    }
  }, [token, user?.user_id, user?.facility_id, isOnline, motherRecord?.assignedWorker]);

  useFocusEffect(
    useCallback(() => {
      fetchAllData();
      if (!isOnline) return;
      const interval = setInterval(() => {
        if (isOnline) {
          fetchAllData();
        }
      }, 7000);
      return () => clearInterval(interval);
    }, [fetchAllData, isOnline])
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchAllData();
    setIsRefreshing(false);
  };

  // Mark messages as read when opening a conversation with a staff member
  useEffect(() => {
    if (selectedStaff && token && isOnline) {
      markMessagesAsReadApi(selectedStaff.user_id, token).catch(() => {});
    }
  }, [selectedStaff, token, isOnline]);

  // Compute per-staff metadata (last message, unread count, timestamp)
  const staffWithMeta = useMemo(() => {
    return staffList.map((staff) => {
      const isAssigned = Boolean(
        assignedWorkerId && staff.user_id === assignedWorkerId
      );

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

      let previewText = isAssigned ? "Your assigned care provider · Tap to message" : "Tap to start conversation";
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
        isAssigned,
        lastMessage: previewText,
        lastMessageDate: lastMsg ? lastMsg.message_date : null,
        unreadCount: unreadCount,
      };
    });
  }, [staffList, allMessages, user?.user_id, assignedWorkerId]);

  // Filter staff directory by search query and role filter
  const filteredStaff = useMemo(() => {
    let list = staffWithMeta;

    // If assigned to a specific worker, prioritize or scope to assigned provider
    if (assignedWorkerId) {
      const assignedOnly = list.filter((s) => s.user_id === assignedWorkerId);
      if (assignedOnly.length > 0) {
        list = assignedOnly;
      }
    }

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

    // Sort by assigned first, then latest message date, then by name
    return list.sort((a, b) => {
      if (a.isAssigned && !b.isAssigned) return -1;
      if (!a.isAssigned && b.isAssigned) return 1;
      if (a.lastMessageDate && b.lastMessageDate) {
        return new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime();
      }
      if (a.lastMessageDate) return -1;
      if (b.lastMessageDate) return 1;
      return (a.first_name || "").localeCompare(b.first_name || "");
    });
  }, [staffWithMeta, searchQuery, roleFilter, assignedWorkerId]);

  // Messages for the currently selected 1-to-1 chat with robust deduplication
  const currentChatMessages = useMemo<MessageBubble[]>(() => {
    if (!selectedStaff) return [];

    const thread = allMessages.filter(
      (m) =>
        (m.sender_id === selectedStaff.user_id && m.receiver_id === user?.user_id) ||
        (m.sender_id === user?.user_id && m.receiver_id === selectedStaff.user_id)
    );

    // Deduplicate by message_id
    const seenIds = new Set<string>();
    const uniqueMessages: InAppMessage[] = [];

    // Sort chronologically
    const sortedThread = [...thread].sort(
      (a, b) => new Date(a.message_date).getTime() - new Date(b.message_date).getTime()
    );

    for (const msg of sortedThread) {
      if (seenIds.has(msg.message_id)) continue;
      seenIds.add(msg.message_id);
      uniqueMessages.push(msg);
    }

    return uniqueMessages.map((msg) => {
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
        status: sendingMessageIds.has(msg.message_id)
          ? "sending"
          : msg.message_id.startsWith("local_")
          ? "queued"
          : "sent",
      };
    });
  }, [allMessages, selectedStaff, user?.user_id, sendingMessageIds]);

  useEffect(() => {
    if (currentChatMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [currentChatMessages]);

  // Send Text Message with immediate optimistic bubble + loading indicator
  const handleSendText = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || !selectedStaff || isSending || !user?.user_id) return;

    const localId = `local_${Date.now()}`;
    const localMessage: InAppMessage = {
      message_id: localId,
      sender_id: user.user_id,
      receiver_id: selectedStaff.user_id,
      message_content: trimmed,
      message_type: "text",
      message_date: new Date().toISOString(),
      is_read: false,
    };

    // 1. Immediately clear input so the user can continue typing
    setInputText("");
    // 2. Optimistically append message to conversation view right away
    setAllMessages((prev) => [...prev, localMessage]);
    setSendingMessageIds((prev) => new Set(prev).add(localId));
    setIsSending(true);

    try {
      if (isOnline && token) {
        const sentMsg = await sendMessageApi(
          {
            receiver_id: selectedStaff.user_id,
            message_content: trimmed,
            message_type: "text",
          },
          token
        );
        // Replace local placeholder with true server message
        if (sentMsg?.message_id) {
          setAllMessages((prev) =>
            prev.map((m) => (m.message_id === localId ? { ...sentMsg, is_read: false } : m))
          );
          await deleteLocalMessage(localId);
          await saveMessagesLocal([sentMsg]);
        } else {
          await saveOutgoingMessageLocal(localMessage, true);
        }
      } else {
        await saveOutgoingMessageLocal(localMessage, false);
      }
    } catch (err: any) {
      console.warn("Online send failed, saving to offline outbox:", err);
      await saveOutgoingMessageLocal(localMessage, false);
    } finally {
      setIsSending(false);
      setSendingMessageIds((prev) => {
        const next = new Set(prev);
        next.delete(localId);
        return next;
      });
    }
  };

  // Upload and send attachment (Image or File) with immediate optimistic preview + inline loading
  const uploadAndSendAttachment = async (
    fileInfo: { uri: string; name: string; type: string },
    detectedType: "image" | "file"
  ) => {
    if (!token || !selectedStaff || isSending || !user?.user_id) return;
    if (!isOnline) {
      confirm({
        title: "Offline Mode",
        message: "Attachment uploads require an active internet connection. Please reconnect to send photos or files.",
        confirmText: "OK",
        cancelText: "",
        variant: "warning",
        icon: "cloud-offline-outline",
      });
      return;
    }

    const localId = `local_attach_${Date.now()}`;
    const localMessage: InAppMessage = {
      message_id: localId,
      sender_id: user.user_id,
      receiver_id: selectedStaff.user_id,
      message_content: fileInfo.uri, // Show local image preview or local path immediately
      message_type: detectedType,
      message_date: new Date().toISOString(),
      is_read: false,
    };

    // Optimistically render the image or file bubble right away
    setAllMessages((prev) => [...prev, localMessage]);
    setSendingMessageIds((prev) => new Set(prev).add(localId));
    setIsSending(true);

    try {
      const filePayload = formatFormDataFile(fileInfo.uri, fileInfo.name, fileInfo.type);

      const formData = new FormData();
      formData.append("file", filePayload as any);

      const uploadRes = await uploadMessageFileApi(formData, token);
      const serverUrl = uploadRes.fileUrl;

      const sentMsg = await sendMessageApi(
        {
          receiver_id: selectedStaff.user_id,
          message_content: serverUrl,
          message_type: detectedType,
        },
        token
      );

      if (sentMsg?.message_id) {
        setAllMessages((prev) =>
          prev.map((m) => (m.message_id === localId ? { ...sentMsg, is_read: false } : m))
        );
        await deleteLocalMessage(localId);
        await saveMessagesLocal([sentMsg]);
      } else {
        await saveOutgoingMessageLocal(
          { ...localMessage, message_content: serverUrl },
          true
        );
      }
    } catch (err: any) {
      console.error("Attachment upload error:", err);
      confirm({
        title: "Upload Failed",
        message: err.message || "Could not send attachment. Please check your internet connection.",
        confirmText: "OK",
        cancelText: "",
        variant: "danger",
      });
      // Remove failed local item
      setAllMessages((prev) => prev.filter((m) => m.message_id !== localId));
    } finally {
      setIsSending(false);
      setSendingMessageIds((prev) => {
        const next = new Set(prev);
        next.delete(localId);
        return next;
      });
    }
  };

  // Handle Photo selection (Camera or Gallery)
  const handlePickImage = async (useCamera = false) => {
    setIsAttachmentSheetVisible(false);
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          confirm({
            title: "Camera Permission Required",
            message: "Camera access is needed to capture photos. Please enable permissions in your device settings.",
            confirmText: "OK",
            cancelText: "",
            variant: "warning",
            icon: "camera-outline",
          });
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
        const sizeFormatted = asset.fileSize
          ? asset.fileSize < 1024 * 1024
            ? `${(asset.fileSize / 1024).toFixed(1)} KB`
            : `${(asset.fileSize / (1024 * 1024)).toFixed(1)} MB`
          : "Photo";

        setPendingAttachment({
          uri: asset.uri,
          name: asset.fileName || `photo_${Date.now()}.jpg`,
          type: asset.mimeType || "image/jpeg",
          sizeFormatted,
          detectedType: "image",
        });
      }
    } catch (err: any) {
      console.warn("Image picker error:", err);
      confirm({
        title: "Image Selection Error",
        message: "Could not pick image.",
        confirmText: "OK",
        cancelText: "",
        variant: "danger",
      });
    }
  };

  // Handle Document Selection (PDF / Records)
  const handlePickDocument = async () => {
    setIsAttachmentSheetVisible(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["*/*"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const isImg = asset.mimeType?.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(asset.name);
        const sizeFormatted = asset.size
          ? asset.size < 1024 * 1024
            ? `${(asset.size / 1024).toFixed(1)} KB`
            : `${(asset.size / (1024 * 1024)).toFixed(1)} MB`
          : "Document";

        setPendingAttachment({
          uri: asset.uri,
          name: asset.name || "document.pdf",
          type: asset.mimeType || "application/pdf",
          sizeFormatted,
          detectedType: isImg ? "image" : "file",
        });
      }
    } catch (err: any) {
      console.warn("Document picker error:", err);
      confirm({
        title: "Document Error",
        message: "Could not pick document.",
        confirmText: "OK",
        cancelText: "",
        variant: "danger",
      });
    }
  };

  // Open Document Attachment using WebBrowser / Linking safely
  const handleOpenDocument = async (fileUrlOrUri: string) => {
    if (!fileUrlOrUri) return;
    const targetUrl = getFullFileUrl(fileUrlOrUri) || fileUrlOrUri;
    try {
      if (targetUrl.startsWith("http://") || targetUrl.startsWith("https://")) {
        await WebBrowser.openBrowserAsync(targetUrl);
      } else {
        const canOpen = await Linking.canOpenURL(targetUrl);
        if (canOpen) {
          await Linking.openURL(targetUrl);
        } else {
          confirm({
            title: "Document File",
            message: `File path: ${targetUrl}`,
            confirmText: "OK",
            cancelText: "",
            variant: "info",
            icon: "document-text-outline",
          });
        }
      }
    } catch (err: any) {
      console.warn("Error opening document:", err);
      confirm({
        title: "Document Viewer Error",
        message: "Unable to open document viewer.",
        confirmText: "OK",
        cancelText: "",
        variant: "danger",
      });
    }
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
        <View className="px-4 pt-6 pb-3 bg-surface border-b border-default flex-row items-center gap-3">
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
          <View className="size-20 rounded-full bg-blue-500/10 border border-blue-500/20 items-center justify-center mb-4">
            <Ionicons name="business-outline" size={36} color="#3b82f6" />
          </View>
          <Text className="text-foreground font-bold text-lg mb-2 text-center">
            Not Affiliated with any Facility
          </Text>
          <Text className="text-zinc-400 text-sm text-center max-w-sm leading-6 mb-6">
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
      <Modal
        visible={!!selectedStaff}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSelectedStaff(null)}
      >
        <KeyboardAvoidingView
          className="flex-1 bg-background"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        {/* Chat Header */}
        <View
          style={{ paddingTop: Math.max(insets.top, 16) }}
          className="px-4 pb-3 bg-surface border-b border-default flex-row items-center justify-between"
        >
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
                      <Text className="text-primary text-sm font-bold">
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
                {selectedStaff.user_id === assignedWorkerId && (
                  <View className="flex-row items-center gap-1 bg-blue-500/15 px-1.5 py-0.2 rounded border border-blue-500/30">
                    <Ionicons name="shield-checkmark" size={10} color="#3b82f6" />
                    <Text className="text-[10px] font-bold text-[#3b82f6]">Assigned Provider</Text>
                  </View>
                )}
                {selectedStaff.facility?.facility_name && (
                  <Text className="text-zinc-400 text-[11px] truncate flex-1" numberOfLines={1}>
                    • {selectedStaff.facility.facility_name}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Chat Messages */}
        {currentChatMessages.length > 0 ? (
          <FlatList
            ref={flatListRef}
            data={currentChatMessages}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
            }
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => (
              <View
                className={`mb-3 max-w-[82%] ${
                  item.mine ? "self-end items-end" : "self-start items-start"
                }`}
              >
                <View
                  className={`p-3.5 rounded-2xl ${
                    item.mine
                      ? "bg-primary rounded-br-xs shadow-sm shadow-primary/30"
                      : "bg-surface border border-default rounded-bl-xs"
                  }`}
                >
                  {/* Image Attachment */}
                  {item.type === "image" ? (
                    <Pressable onPress={() => setPreviewImage(item.text)} className="active:opacity-90 relative">
                      <Image
                        source={{ uri: getFullFileUrl(item.text) || item.text }}
                        className="w-56 h-48 rounded-xl bg-default/40 mb-1"
                        resizeMode="cover"
                      />
                      {item.status === "sending" && (
                        <View className="absolute inset-0 bg-black/40 rounded-xl items-center justify-center">
                          <ActivityIndicator size="small" color="#ffffff" />
                        </View>
                      )}
                    </Pressable>
                  ) : item.type === "file" ? (
                    /* PDF or generic document attachment */
                    <Pressable
                      onPress={() => handleOpenDocument(item.text)}
                      className={`flex-row items-center gap-3 p-3 rounded-xl border ${
                        item.mine
                          ? "bg-white/10 border-white/20 active:bg-white/20"
                          : "bg-surface border-default active:bg-default/50"
                      }`}
                    >
                      <View
                        className={`size-11 rounded-lg items-center justify-center ${
                          item.mine ? "bg-white/20" : "bg-primary/10 border border-primary/20"
                        }`}
                      >
                        {item.status === "sending" ? (
                          <ActivityIndicator size="small" color={item.mine ? "white" : "#3b82f6"} />
                        ) : (
                          <Ionicons
                            name={
                              item.text.toLowerCase().includes(".pdf")
                                ? "document-text"
                                : item.text.toLowerCase().match(/\.(docx?|doc)$/)
                                ? "document-attach"
                                : "document"
                            }
                            size={22}
                            color={item.mine ? "white" : "#3b82f6"}
                          />
                        )}
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text
                          className={`text-sm font-semibold truncate ${
                            item.mine ? "text-white" : "text-foreground"
                          }`}
                          numberOfLines={1}
                        >
                          {item.text.startsWith("data:")
                            ? "Document Attachment"
                            : item.text.split("/").pop()?.split("?")[0] || "Document Attachment"}
                        </Text>
                        <Text
                          className={`text-[11px] mt-0.5 ${
                            item.mine ? "text-white/70" : "text-zinc-400"
                          }`}
                        >
                          {item.status === "sending" ? "Uploading & sending..." : "Tap to open / download"}
                        </Text>
                      </View>
                      {item.status === "sending" ? (
                        <ActivityIndicator size="small" color={item.mine ? "white" : "#3b82f6"} />
                      ) : (
                        <Ionicons name="open-outline" size={18} color={item.mine ? "white" : "#a1a1aa"} />
                      )}
                    </Pressable>
                  ) : (
                    /* Regular Text Message */
                    <Text className={`text-base leading-5 ${item.mine ? "text-white font-medium" : "text-foreground"}`}>
                      {item.text}
                    </Text>
                  )}

                  <View className="flex-row items-center gap-1.5 justify-end mt-1.5">
                    <Text className={`text-[10px] ${item.mine ? "text-white/70" : "text-zinc-400"}`}>
                      {item.time}
                    </Text>
                    {item.mine && item.status === "sending" ? (
                      <ActivityIndicator size={10} color={item.mine ? "rgba(255,255,255,0.85)" : "#3b82f6"} />
                    ) : item.mine && item.id.startsWith("local_") ? (
                      <Ionicons name="checkmark-outline" size={12} color="rgba(255,255,255,0.7)" />
                    ) : null}
                  </View>
                </View>
              </View>
            )}
          />
        ) : (
          <View className="flex-1 items-center justify-center p-6">
            <View className="size-16 rounded-full bg-surface items-center justify-center mb-3">
              <Ionicons name="chatbubble-ellipses-outline" size={28} color="#3b82f6" />
            </View>
            <Text className="text-foreground font-bold text-lg mb-1">Personalized 1-to-1 Chat</Text>
            <Text className="text-zinc-400 text-sm text-center max-w-xs leading-5">
              Send a direct message or share health records with {staffDisplayName}.
            </Text>
          </View>
        )}

        {/* Input Bar */}
        <View
          style={{
            paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom + 16, 32),
          }}
          className="px-4 pt-3 bg-surface border-t border-default flex-row items-center gap-3"
        >
          <Pressable
            onPress={() => setIsAttachmentSheetVisible(true)}
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
            disabled={!inputText.trim()}
            className={`size-10 rounded-full items-center justify-center ${
              inputText.trim() ? "bg-primary active:scale-95" : "bg-default opacity-50"
            }`}
          >
            <Ionicons name="send" size={16} color={inputText.trim() ? "white" : "#71717a"} style={{ marginLeft: 2 }} />
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
                source={{ uri: getFullFileUrl(previewImage) || previewImage }}
                className="w-full h-4/5 rounded-xl"
                resizeMode="contain"
              />
            )}
          </View>
        </Modal>

        {/* Custom Styled Attachment Action Sheet Modal */}
        <Modal
          visible={isAttachmentSheetVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsAttachmentSheetVisible(false)}
        >
          <Pressable
            onPress={() => setIsAttachmentSheetVisible(false)}
            className="flex-1 bg-black/60 justify-end"
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                paddingBottom: Math.max(insets.bottom + 20, 32),
              }}
              className="bg-surface rounded-t-3xl border-t border-default p-6"
            >
              <View className="w-12 h-1 bg-default/80 rounded-full self-center mb-4" />

              <Text className="text-foreground font-bold text-lg mb-1">Add Attachment</Text>
              <Text className="text-zinc-400 text-sm mb-5">
                Share photos or medical documents directly with your healthcare provider.
              </Text>

              <View className="gap-3 mb-4">
                {/* Take Photo */}
                <Pressable
                  onPress={() => handlePickImage(true)}
                  className="flex-row items-center gap-3.5 p-3.5 bg-default/50 rounded-2xl border border-default active:bg-default"
                >
                  <View className="size-11 rounded-xl bg-blue-500/10 border border-blue-500/20 items-center justify-center">
                    <Ionicons name="camera-outline" size={22} color="#3b82f6" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-foreground font-semibold text-base">Take Photo</Text>
                    <Text className="text-zinc-400 text-sm">Use camera to capture a new photo</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#71717a" />
                </Pressable>

                {/* Photo Library */}
                <Pressable
                  onPress={() => handlePickImage(false)}
                  className="flex-row items-center gap-3.5 p-3.5 bg-default/50 rounded-2xl border border-default active:bg-default"
                >
                  <View className="size-11 rounded-xl bg-blue-500/10 border border-blue-500/20 items-center justify-center">
                    <Ionicons name="images-outline" size={22} color="#3b82f6" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-foreground font-semibold text-base">Photo Library</Text>
                    <Text className="text-zinc-400 text-sm">Select photos from your device gallery</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#71717a" />
                </Pressable>

                {/* Document / Health Record */}
                <Pressable
                  onPress={() => handlePickDocument()}
                  className="flex-row items-center gap-3.5 p-3.5 bg-default/50 rounded-2xl border border-default active:bg-default"
                >
                  <View className="size-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 items-center justify-center">
                    <Ionicons name="document-text-outline" size={22} color="#10b981" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-foreground font-semibold text-base">Document / Health Record</Text>
                    <Text className="text-zinc-400 text-sm">Upload PDF, Word files, or lab reports</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#71717a" />
                </Pressable>
              </View>

              <Pressable
                onPress={() => setIsAttachmentSheetVisible(false)}
                className="bg-default py-3.5 rounded-2xl items-center active:opacity-90 mt-1"
              >
                <Text className="text-foreground font-semibold text-sm">Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Attachment Preview Modal before sending */}
        <Modal
          visible={!!pendingAttachment}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setPendingAttachment(null)}
        >
          <View
            style={{
              paddingBottom: Math.max(insets.bottom + 24, 40),
            }}
            className="flex-1 bg-black/80 justify-end sm:justify-center p-4"
          >
            {pendingAttachment && (
              <View className="bg-surface rounded-3xl p-5 border border-default shadow-2xl">
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center gap-2">
                    <Ionicons
                      name={pendingAttachment.detectedType === "image" ? "image-outline" : "document-text-outline"}
                      size={20}
                      color="#3b82f6"
                    />
                    <Text className="text-foreground font-bold text-lg">Confirm Attachment</Text>
                  </View>
                  <Pressable
                    onPress={() => setPendingAttachment(null)}
                    className="size-8 rounded-full bg-default items-center justify-center"
                  >
                    <Ionicons name="close" size={18} color="#a1a1aa" />
                  </Pressable>
                </View>

                {/* Content preview */}
                {pendingAttachment.detectedType === "image" ? (
                  <Image
                    source={{ uri: pendingAttachment.uri }}
                    className="w-full h-48 rounded-2xl bg-default/40 mb-4"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="bg-default/40 rounded-2xl p-4 flex-row items-center gap-3.5 mb-4 border border-default">
                    <View className="size-12 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center">
                      <Ionicons
                        name={
                          pendingAttachment.name.toLowerCase().endsWith(".pdf")
                            ? "document-text"
                            : "document-attach"
                        }
                        size={26}
                        color="#3b82f6"
                      />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-foreground font-bold text-sm" numberOfLines={1}>
                        {pendingAttachment.name}
                      </Text>
                      <Text className="text-zinc-400 text-sm mt-0.5">
                        {pendingAttachment.sizeFormatted} • {pendingAttachment.name.split(".").pop()?.toUpperCase() || "FILE"}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Confirm Action Buttons */}
                <View className="flex-row items-center gap-3 mt-1">
                  <Pressable
                    onPress={() => setPendingAttachment(null)}
                    disabled={isSending}
                    className="bg-default px-5 py-3.5 rounded-xl active:scale-95 items-center"
                  >
                    <Text className="text-foreground font-semibold text-sm">Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      if (!pendingAttachment) return;
                      const fileToUpload = { ...pendingAttachment };
                      setPendingAttachment(null);
                      await uploadAndSendAttachment(
                        {
                          uri: fileToUpload.uri,
                          name: fileToUpload.name,
                          type: fileToUpload.type,
                        },
                        fileToUpload.detectedType
                      );
                    }}
                    disabled={isSending}
                    className="flex-1 bg-primary py-3.5 rounded-xl flex-row items-center justify-center gap-2 active:scale-95 shadow-sm shadow-primary/30"
                  >
                    {isSending ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <Ionicons name="send" size={16} color="white" />
                        <Text className="text-white font-semibold text-sm">Send Attachment</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </Modal>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  // 3. Messenger-Style Staff & Conversations Directory View
  const facilityTitle = user?.facility_name || user?.facility?.facility_name || "Facility Healthcare Team";

  return (
    <View className="flex-1 bg-background">
      {/* Top Header */}
      <View className="px-5 pt-6 pb-3 bg-surface border-b border-default">
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
              <Text className="text-foreground font-bold text-lg">Messages</Text>
              <Text className="text-zinc-400 text-sm truncate max-w-[240px]" numberOfLines={1}>
                {facilityTitle}
              </Text>
            </View>
          </View>

          <View className="size-9 rounded-full bg-default items-center justify-center">
            <Ionicons name="chatbubbles" size={18} color="#3b82f6" />
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
                  className={`text-sm font-semibold ${
                    isSelected ? "text-white" : "text-zinc-400"
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
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 90 }}
        ListEmptyComponent={
          <View className="items-center justify-center p-10">
            <View className="size-14 rounded-full bg-surface items-center justify-center mb-3">
              <Ionicons name="people-outline" size={24} color="#71717a" />
            </View>
            <Text className="text-foreground font-semibold text-base mb-1">No Staff Found</Text>
            <Text className="text-zinc-400 text-sm text-center max-w-xs">
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
                    <Text className="text-zinc-400 text-[11px] shrink-0">
                      {formatTimeLabel(item.lastMessageDate)}
                    </Text>
                  )}
                </View>

                <View className="flex-row items-center gap-1.5 mb-1 flex-wrap">
                  <View className={`px-1.5 py-0.2 rounded border ${badge.bg} ${badge.border}`}>
                    <Text className={`text-[10px] font-semibold ${badge.text}`}>
                      {item.role}
                    </Text>
                  </View>
                  {item.isAssigned && (
                    <View className="flex-row items-center gap-1 bg-blue-500/15 px-1.5 py-0.2 rounded border border-blue-500/30">
                      <Ionicons name="shield-checkmark" size={10} color="#3b82f6" />
                      <Text className="text-[10px] font-bold text-[#3b82f6]">Assigned Provider</Text>
                    </View>
                  )}
                  {item.facility?.facility_name && (
                    <Text className="text-zinc-400 text-[11px] truncate" numberOfLines={1}>
                      • {item.facility.facility_name}
                    </Text>
                  )}
                </View>

                {/* Snippet */}
                <View className="flex-row items-center justify-between">
                  <Text
                    className={`text-sm truncate flex-1 mr-2 ${
                      item.unreadCount > 0 ? "text-foreground font-semibold" : "text-zinc-400"
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
