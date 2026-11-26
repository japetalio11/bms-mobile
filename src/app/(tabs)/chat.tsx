import {
  View,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  RefreshControl,
  Linking,
  Keyboard,
  Text,
} from "react-native";
import { AppIcon as Ionicons } from "../../components/AppIcon";
import { BottomSheetHeader } from "../../components/BottomSheetHeader";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { JSX } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import * as Sharing from "expo-sharing";
import * as IntentLauncher from "expo-intent-launcher";
import * as FileSystem from "expo-file-system/legacy";
import { useUniwind } from "uniwind";
import { useAuth } from "../../context/UserContext";
import { useSocket } from "../../context/SocketContext";
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
import { subscribeSyncEvents } from "../../services/syncEngine";
import { getCachedOrRemoteUri, prefetchMediaFiles, isLocalUri } from "../../lib/fileCache";

type MessageBubble = {
  id: string;
  text: string;
  mine: boolean;
  time: string;
  type: string;
  dateRaw: string;
  isRead?: boolean;
  status?: "sending" | "sent" | "failed" | "queued";
};

function ChatImageBubble({
  rawUri,
  status,
  onPress,
}: {
  rawUri: string;
  status?: string;
  onPress: () => void;
}): JSX.Element {
  const fullUrl = getFullFileUrl(rawUri) || rawUri;
  const [displayUri, setDisplayUri] = useState<string>(fullUrl);

  useEffect(() => {
    let isMounted = true;
    getCachedOrRemoteUri(fullUrl).then((cached) => {
      if (isMounted && cached) {
        setDisplayUri(cached);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [fullUrl]);

  return (
    <Pressable onPress={onPress} className="active:opacity-90 relative">
      <Image
        source={{ uri: displayUri }}
        className="w-56 h-48 rounded-xl bg-default/40 mb-1"
        resizeMode="cover"
      />
      {status === "sending" && (
        <View className="absolute inset-0 bg-black/40 rounded-xl items-center justify-center">
          <ActivityIndicator size="small" color="#ffffff" />
        </View>
      )}
    </Pressable>
  );
}

function ChatImagePreview({ uri }: { uri: string }): JSX.Element {
  const fullUrl = getFullFileUrl(uri) || uri;
  const [displayUri, setDisplayUri] = useState<string>(fullUrl);

  useEffect(() => {
    let isMounted = true;
    getCachedOrRemoteUri(fullUrl).then((cached) => {
      if (isMounted && cached) {
        setDisplayUri(cached);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [fullUrl]);

  return (
    <Image
      source={{ uri: displayUri }}
      className="w-full h-4/5 rounded-xl"
      resizeMode="contain"
    />
  );
}

function MessagesTopBar({
  onBack,
  isDark,
  contact,
  isOnline = true,
}: {
  onBack: () => void;
  isDark: boolean;
  contact?: ChatContact | null;
  isOnline?: boolean;
}): JSX.Element {
  if (contact) {
    const displayName = contact.role.toLowerCase().includes("doctor")
      ? `Dr. ${contact.first_name} ${contact.last_name}`
      : `${contact.first_name} ${contact.last_name}`;

    return (
      <View className="mt-2 h-14 flex-row items-center justify-between bg-background px-4 border-b border-border/40">
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="size-9 items-center justify-center active:opacity-70 mr-1"
        >
          <Ionicons name="chevron-back" size={20} weight="bold" color={isDark ? "#f5f5f5" : "#262626"} />
        </Pressable>

        <View className="flex-1 flex-row items-center gap-2.5 min-w-0">
          <View className="size-9 rounded-full bg-primary/20 overflow-hidden items-center justify-center">
            {contact.profile_url ? (
              <Image
                source={{ uri: contact.profile_url }}
                className="size-full"
                resizeMode="cover"
              />
            ) : (
              <Text className="text-primary text-xs font-semibold">
                {contact.first_name ? contact.first_name.charAt(0).toUpperCase() : "S"}
              </Text>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
              {displayName}
            </Text>
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {contact.role} {contact.facility?.facility_name ? `• ${contact.facility.facility_name}` : ""}
            </Text>
          </View>
        </View>

        <View className="ml-2">
          {!isOnline ? (
            <View className="flex-row items-center gap-1 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
              <Ionicons name="cloud-offline-outline" size={11} color="#f59e0b" />
              <Text className="text-[11px] text-amber-500 font-medium">Offline</Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              <View className="size-1.5 rounded-full bg-emerald-500" />
              <Text className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Online</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View className="mt-4 h-12 flex-row items-center justify-center bg-background px-4">
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        className="absolute left-4 size-9 items-center justify-center active:opacity-70"
      >
        <Ionicons name="chevron-back" size={20} weight="bold" color={isDark ? "#f5f5f5" : "#262626"} />
      </Pressable>
      <Text className="text-2xl font-semibold text-foreground">Messages</Text>
    </View>
  );
}

export default function ChatScreen(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
  const isDark = theme === "dark";
  const { user, token, motherRecord } = useAuth();
  const { socket } = useSocket();
  const { isOnline } = useNetwork();
  const { confirm } = useConfirm();

  const assignedWorkerId =
    motherRecord?.assigned_worker_id ||
    motherRecord?.assignedWorker?.user_id ||
    null;

  const [staffList, setStaffList] = useState<ChatContact[]>([]);
  const [allMessages, setAllMessages] = useState<InAppMessage[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<ChatContact | null>(null);
  const [isStaffListVisible, setIsStaffListVisible] = useState(false);
  const assignedStaff =
    staffList.find((staff) => staff.user_id === assignedWorkerId) ||
    motherRecord?.assignedWorker ||
    null;

  let mostRecentStaffContact: ChatContact | null = null;
  if (allMessages.length > 0 && user?.user_id) {
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const m = allMessages[i];
      const otherId = m.sender_id === user.user_id ? m.receiver_id : m.sender_id;
      if (otherId && otherId !== user.user_id) {
        const found = staffList.find((s) => s.user_id === otherId);
        mostRecentStaffContact = found || {
          user_id: otherId,
          first_name: "Care",
          last_name: "Provider",
          role: "Health Worker",
        };
        break;
      }
    }
  }

  const defaultStaffContact: ChatContact | null = assignedWorkerId
    ? (assignedStaff as ChatContact | null) || {
        user_id: assignedWorkerId,
        first_name: "Assigned",
        last_name: "Care Provider",
        role: "Health Worker",
      }
    : mostRecentStaffContact;

  const activeStaff = selectedStaff || (isStaffListVisible ? null : defaultStaffContact);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [hasFacility, setHasFacility] = useState<boolean | null>(user?.facility_id ? true : null);

  const [inputText, setInputText] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [sendingMessageIds, setSendingMessageIds] = useState<Set<string>>(new Set());

  const [isAttachmentSheetVisible, setIsAttachmentSheetVisible] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    uri: string;
    name: string;
    type: string;
    sizeFormatted: string;
    detectedType: "image" | "file";
  } | null>(null);

  useEffect(() => {
    if (!socket) return;
    const handleIncomingMessage = (newMsg: InAppMessage) => {
      if (!newMsg) return;
      setAllMessages((prev) => {
        if (prev.some((m) => m.message_id === newMsg.message_id)) return prev;
        const filtered = prev.filter(
          (m) =>
            !(
              m.message_id.startsWith("local_") &&
              m.sender_id === newMsg.sender_id &&
              m.message_content === newMsg.message_content
            )
        );
        return [...filtered, newMsg].sort(
          (a, b) => new Date(a.message_date).getTime() - new Date(b.message_date).getTime()
        );
      });
    };

    socket.on("message:new", handleIncomingMessage);
    return () => {
      socket.off("message:new", handleIncomingMessage);
    };
  }, [socket]);

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

  const fetchAllData = useCallback(async () => {
    if (!token && !user?.user_id) return;
    try {
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

          const localMediaUrls = localMsgs
            .filter((m) => m.message_type === "image" || m.message_type === "file")
            .map((m) => getFullFileUrl(m.message_content) || m.message_content);
          prefetchMediaFiles(localMediaUrls);
        }

        const activeAssignedId =
          motherRecord?.assigned_worker_id ||
          motherRecord?.assignedWorker?.user_id ||
          null;

        const knownStaffIds = new Set(localStaff.map((s) => s.user_id));
        const combinedStaff: ChatContact[] = [...localStaff];
        for (const m of localMsgs) {
          const otherId = m.sender_id === user.user_id ? m.receiver_id : m.sender_id;
          if (otherId && otherId !== user.user_id && !knownStaffIds.has(otherId)) {
            knownStaffIds.add(otherId);
            combinedStaff.push({
              user_id: otherId,
              first_name: "Care",
              last_name: "Provider",
              role: "Health Worker",
            });
          }
        }

        let scopedStaff: ChatContact[] = [];
        if (activeAssignedId) {
          scopedStaff = combinedStaff.filter((s) => s.user_id === activeAssignedId);
          if (scopedStaff.length === 0 && motherRecord?.assignedWorker) {
            scopedStaff = [motherRecord.assignedWorker as any];
          }
        } else {
          const messagedIds = new Set(
            localMsgs
              .map((m) => (m.sender_id === user.user_id ? m.receiver_id : m.sender_id))
              .filter(Boolean)
          );
          scopedStaff = combinedStaff.filter((s) => messagedIds.has(s.user_id));
        }

        if (scopedStaff.length > 0) {
          setStaffList(scopedStaff);
        } else if (combinedStaff.length > 0) {
          setStaffList(combinedStaff);
        } else if (motherRecord?.assignedWorker) {
          setStaffList([motherRecord.assignedWorker as any]);
        } else {
          setStaffList([]);
        }
        isInitialHydrationDone.current = true;
      }

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

      if (
        messagesRes.contact &&
        !remoteStaff.some((s) => s.user_id === messagesRes.contact?.user_id)
      ) {
        remoteStaff = [messagesRes.contact, ...remoteStaff];
      }
      if (
        motherRecord?.assignedWorker &&
        !remoteStaff.some((s) => s.user_id === motherRecord.assignedWorker?.user_id)
      ) {
        remoteStaff = [motherRecord.assignedWorker as any, ...remoteStaff];
      }

      setAllMessages((prev) => {
        const map = new Map<string, InAppMessage>();

        remoteMessages.forEach((m) => map.set(m.message_id, m));

        prev.forEach((m) => {
          if (map.has(m.message_id)) return;

          const matchingRemote = remoteMessages.find(
            (rm) =>
              rm.sender_id === m.sender_id &&
              rm.receiver_id === m.receiver_id &&
              rm.message_content === m.message_content
          );

          if (!matchingRemote) {
            const isLocal = m.message_id.startsWith("local_");
            if (isLocal || m.sender_id === user?.user_id) {
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

      if (remoteMessages.length > 0) {
        await saveMessagesLocal(remoteMessages);
        const remoteMediaUrls = remoteMessages
          .filter((m) => m.message_type === "image" || m.message_type === "file")
          .map((m) => getFullFileUrl(m.message_content) || m.message_content);
        prefetchMediaFiles(remoteMediaUrls);
      }
      if (remoteStaff.length > 0) {
        await saveChatContactsLocal(remoteStaff);
      }
      isInitialHydrationDone.current = true;
    } catch (err) {
      console.warn("Failed to fetch chat data:", err);
    }
  }, [token, user, isOnline, motherRecord]);

  useEffect(() => {
    const unsubscribe = subscribeSyncEvents((event) => {
      if (event.type === "item_synced" && event.actionType === "CREATE_MESSAGE") {
        if (event.tempId && event.serverId) {
          setAllMessages((prev) =>
            prev.map((m) =>
              m.message_id === event.tempId
                ? { ...m, message_id: event.serverId!, sync_status: "synced" }
                : m
            )
          );
        }
      } else if (event.type === "sync_completed") {
        fetchAllData();
      }
    });
    return () => unsubscribe();
  }, [fetchAllData]);

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

  useEffect(() => {
    if (activeStaff && token && isOnline) {
      markMessagesAsReadApi(activeStaff.user_id, token).catch(() => {});
    }
  }, [activeStaff, token, isOnline]);

  const staffWithMeta = useMemo(() => {
    return staffList.map((staff) => {
      const isAssigned = Boolean(assignedWorkerId && staff.user_id === assignedWorkerId);

      const threadMessages = allMessages.filter(
        (m) =>
          (m.sender_id === staff.user_id && m.receiver_id === user?.user_id) ||
          (m.sender_id === user?.user_id && m.receiver_id === staff.user_id)
      );

      const lastMsg = threadMessages.length > 0 ? threadMessages[threadMessages.length - 1] : null;

      const unreadCount = threadMessages.filter(
        (m) => m.sender_id === staff.user_id && !m.is_read
      ).length;

      let previewText = isAssigned
        ? "Your assigned care provider · Tap to message"
        : "Tap to start conversation";
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
          previewText =
            lastMsg.sender_id === user?.user_id ? "You sent a photo" : "📷 Photo attached";
        } else if (isDoc) {
          previewText =
            lastMsg.sender_id === user?.user_id ? "You sent a document" : "📄 Document attached";
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

  const filteredStaff = useMemo(() => {
    let list = staffWithMeta;

    if (assignedWorkerId) {
      const assignedOnly = list.filter((s) => s.user_id === assignedWorkerId);
      if (assignedOnly.length > 0) {
        list = assignedOnly;
      } else if (motherRecord?.assignedWorker) {
        list = [
          {
            user_id: assignedWorkerId,
            first_name: motherRecord.assignedWorker.first_name || "Assigned",
            last_name: motherRecord.assignedWorker.last_name || "Care Provider",
            role: motherRecord.assignedWorker.role || "HealthWorker",
            profile_url: motherRecord.assignedWorker.profile_url,
            isAssigned: true,
            lastMessage: "Your assigned care provider · Tap to message",
            lastMessageDate: null,
            unreadCount: 0,
          } as any,
        ];
      } else {
        list = [];
      }
    } else {
      const messagedStaffIds = new Set(
        allMessages
          .map((m) => (m.sender_id === user?.user_id ? m.receiver_id : m.sender_id))
          .filter(Boolean)
      );

      list = list.filter((s) => messagedStaffIds.has(s.user_id));
    }

    if (roleFilter !== "All") {
      list = list.filter((s) => {
        const r = (s.role || "").toLowerCase();
        if (roleFilter === "Doctor") return r.includes("doctor");
        if (roleFilter === "Midwife") return r.includes("midwife");
        if (roleFilter === "Nurse") return r.includes("nurse");
        if (roleFilter === "HealthWorker")
          return r.includes("healthworker") || r.includes("worker") || r.includes("staff");
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
  }, [
    staffWithMeta,
    searchQuery,
    roleFilter,
    assignedWorkerId,
    motherRecord,
    allMessages,
    user?.user_id,
  ]);

  const currentChatMessages = useMemo<MessageBubble[]>(() => {
    if (!activeStaff) return [];

    const thread = allMessages.filter(
      (m) =>
        (m.sender_id === activeStaff.user_id && (!user?.user_id || m.receiver_id === user.user_id)) ||
        ((!user?.user_id || m.sender_id === user.user_id) && m.receiver_id === activeStaff.user_id)
    );

    const seenIds = new Set<string>();
    const uniqueMessages: InAppMessage[] = [];

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
        time: new Date(msg.message_date).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
        type: isImg ? "image" : isDoc ? "file" : "text",
        dateRaw: msg.message_date,
        isRead: Boolean(msg.is_read),
        status: sendingMessageIds.has(msg.message_id)
          ? "sending"
          : msg.message_id.startsWith("local_")
            ? "queued"
            : "sent",
      };
    });
  }, [allMessages, activeStaff, user, sendingMessageIds]);

  useEffect(() => {
    if (currentChatMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [currentChatMessages]);

  const handleSendText = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || !activeStaff || isSending || !user?.user_id) return;

    const localId = `local_${Date.now()}`;
    const localMessage: InAppMessage = {
      message_id: localId,
      sender_id: user.user_id,
      receiver_id: activeStaff.user_id,
      message_content: trimmed,
      message_type: "text",
      message_date: new Date().toISOString(),
      is_read: false,
    };

    setInputText("");
    setAllMessages((prev) => [...prev, localMessage]);
    setSendingMessageIds((prev) => new Set(prev).add(localId));
    setIsSending(true);

    try {
      if (isOnline && token) {
        const sentMsg = await sendMessageApi(
          {
            receiver_id: activeStaff.user_id,
            message_content: trimmed,
            message_type: "text",
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
          await saveOutgoingMessageLocal(localMessage, true);
        }
      } else {
        await saveOutgoingMessageLocal(localMessage, false);
      }
    } catch (err: any) {
      console.warn("Online send failed, saving to offline outbox:", err);
      await saveOutgoingMessageLocal(localMessage, false);
      setAllMessages((prev) =>
        prev.map((m) =>
          m.message_id === localId ? { ...localMessage, sync_status: "pending" } : m
        )
      );
    } finally {
      setIsSending(false);
      setSendingMessageIds((prev) => {
        const next = new Set(prev);
        next.delete(localId);
        return next;
      });
    }
  };

  const uploadAndSendAttachment = async (
    fileInfo: { uri: string; name: string; type: string },
    detectedType: "image" | "file"
  ) => {
    if (!token || !activeStaff || isSending || !user?.user_id) return;
    if (!isOnline) {
      confirm({
        title: "Offline Mode",
        message:
          "Attachment uploads require an active internet connection. Please reconnect to send photos or files.",
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
      receiver_id: activeStaff.user_id,
      message_content: fileInfo.uri,
      message_type: detectedType,
      message_date: new Date().toISOString(),
      is_read: false,
    };

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
          receiver_id: activeStaff.user_id,
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
        await saveOutgoingMessageLocal({ ...localMessage, message_content: serverUrl }, true);
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

  const handlePickImage = async (useCamera = false) => {
    setIsAttachmentSheetVisible(false);
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          confirm({
            title: "Camera Permission Required",
            message:
              "Camera access is needed to capture photos. Please enable permissions in your device settings.",
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

  const handlePickDocument = async () => {
    setIsAttachmentSheetVisible(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["*/*"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const isImg =
          asset.mimeType?.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(asset.name);
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

  const handleOpenDocument = async (fileUrlOrUri: string) => {
    if (!fileUrlOrUri) return;
    const targetUrl = getFullFileUrl(fileUrlOrUri) || fileUrlOrUri;
    try {
      const localUri = await getCachedOrRemoteUri(targetUrl);

      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          window.open(localUri || targetUrl, "_blank");
        } else {
          await Linking.openURL(localUri || targetUrl);
        }
        return;
      }

      if (isLocalUri(localUri)) {
        if (Platform.OS === "android") {
          try {
            const contentUri = localUri.startsWith("content://")
              ? localUri
              : await FileSystem.getContentUriAsync(localUri);
            await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
              data: contentUri,
              flags: 1,
            });
            return;
          } catch {}
        }

        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(localUri);
          return;
        }
      }

      if (isOnline && (targetUrl.startsWith("http://") || targetUrl.startsWith("https://"))) {
        await WebBrowser.openBrowserAsync(targetUrl);
        return;
      }

      const canOpen = await Linking.canOpenURL(localUri || targetUrl);
      if (canOpen) {
        await Linking.openURL(localUri || targetUrl);
      } else {
        confirm({
          title: "Document File",
          message: `File path: ${localUri || targetUrl}`,
          confirmText: "OK",
          cancelText: "",
          variant: "info",
          icon: "document-text-outline",
        });
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

  const getChatDayLabel = (dateStr?: string) => {
    if (!dateStr) return "Today";
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };

  const getRoleBadgeStyle = (role: string) => {
    const r = (role || "").toLowerCase();
    if (r.includes("doctor")) {
      return {
        bg: "bg-muted",
        border: "border-blue-500/25",
        text: "text-blue-600 dark:text-blue-400",
      };
    }
    if (r.includes("midwife")) {
      return {
        bg: "bg-purple-500/10",
        border: "border-purple-500/25",
        text: "text-purple-600 dark:text-purple-400",
      };
    }
    if (r.includes("nurse")) {
      return {
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/25",
        text: "text-emerald-600 dark:text-emerald-400",
      };
    }
    return {
      bg: "bg-amber-500/10",
      border: "border-amber-500/25",
      text: "text-amber-600 dark:text-amber-400",
    };
  };

  const canMessageAssignedProvider = Boolean(motherRecord && assignedWorkerId);

  if (
    !canMessageAssignedProvider &&
    (hasFacility === false || (!user?.facility_id && hasFacility !== true))
  ) {
    return (
      <View className="flex-1 bg-background">
        <MessagesTopBar
          isDark={isDark}
          onBack={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
        />

        <View className="flex-1 items-center justify-center p-6">
          <View className="size-20 rounded-full bg-muted border border-blue-500/20 items-center justify-center mb-4">
            <Ionicons name="business-outline" size={36} color="#3b82f6" />
          </View>
          <Text className="text-foreground font-semibold text-base mb-2 text-center">
            Not Affiliated with any Facility
          </Text>
          <Text className="text-muted-foreground dark:text-muted-foreground text-sm text-center max-w-sm leading-6 mb-6">
            You are currently not affiliated with any healthcare facility. Direct messaging is only
            available once your account is linked to a health center.
          </Text>

          <Pressable
            onPress={() => router.push("/(tabs)/profile")}
            className="px-6 py-3 rounded-full flex-row items-center gap-2 active:opacity-85 shadow-none"
            style={{ backgroundColor: isDark ? "#fffe8c" : "#171717" }}
          >
            <Ionicons name="person-circle-outline" size={20} color={isDark ? "#171717" : "#ffffff"} />
            <Text style={{ color: isDark ? "#171717" : "#ffffff" }} className="font-semibold text-sm">View Profile</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (activeStaff) {
    const staffDisplayName = activeStaff.role.toLowerCase().includes("doctor")
      ? `Dr. ${activeStaff.first_name} ${activeStaff.last_name}`
      : `${activeStaff.first_name} ${activeStaff.last_name}`;

    return (
      <Modal
        visible={!!activeStaff}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => {
          if (router.canGoBack()) router.back();
          else router.replace("/(tabs)");
        }}
      >
        <KeyboardAvoidingView
          className="flex-1 bg-background"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={{ paddingTop: Math.max(insets.top, 12) }} className="bg-background">
            <MessagesTopBar
              isDark={isDark}
              contact={activeStaff}
              isOnline={isOnline}
              onBack={() => {
                if (staffList.length > 1) {
                  setSelectedStaff(null);
                  setIsStaffListVisible(true);
                } else if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/(tabs)");
                }
              }}
            />
            {!isOnline && (
              <View className="flex-row items-center justify-center gap-1.5 bg-amber-500/10 border-b border-amber-500/20 py-2 px-4">
                <Ionicons name="cloud-offline-outline" size={13} color="#f59e0b" />
                <Text className="text-amber-500 text-xs font-medium text-center">
                  Working offline • Messages are saved on your device and will send once reconnected
                </Text>
              </View>
            )}
          </View>

          {currentChatMessages.length > 0 ? (
            <FlatList
              ref={flatListRef}
              data={currentChatMessages}
              keyExtractor={(item) => item.id}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={onRefresh}
                  tintColor="#3b82f6"
                />
              }
              ListHeaderComponent={
                <View className="items-center pb-5 pt-1">
                  <View className="rounded-full bg-surface px-3 py-1">
                    <Text className="text-sm font-medium text-muted-foreground">
                      {getChatDayLabel(currentChatMessages[currentChatMessages.length - 1]?.dateRaw)}
                    </Text>
                  </View>
                </View>
              }
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 18 }}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item }) => (
                <View
                  className={`mb-3 max-w-[82%] ${
                    item.mine ? "self-end items-end" : "self-start items-start"
                  }`}
                >
                  <View
                    style={{
                      backgroundColor: item.mine ? "#2563eb" : isDark ? "#262626" : "#ffffff",
                      borderColor: item.mine ? "transparent" : isDark ? "#343434" : "#e5e5e5",
                      borderWidth: item.mine ? 0 : 1,
                      borderRadius: 16,
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                    }}
                  >
                    {item.type === "image" ? (
                      <ChatImageBubble
                        rawUri={item.text}
                        status={item.status}
                        onPress={() => setPreviewImage(item.text)}
                      />
                    ) : item.type === "file" ? (
                      <Pressable
                        onPress={() => handleOpenDocument(item.text)}
                        style={
                          item.mine
                            ? {
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 12,
                                padding: 10,
                                borderRadius: 12,
                                backgroundColor: "rgba(255, 255, 255, 0.15)",
                                borderWidth: 1,
                                borderColor: "rgba(255, 255, 255, 0.25)",
                              }
                            : {
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 12,
                                padding: 10,
                                borderRadius: 12,
                                backgroundColor: isDark
                                  ? "rgba(255,255,255,0.05)"
                                  : "rgba(0,0,0,0.03)",
                                borderWidth: 1,
                                borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                              }
                        }
                      >
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: item.mine
                              ? "rgba(255, 255, 255, 0.2)"
                              : isDark
                                ? "rgba(255,255,255,0.08)"
                                : "rgba(37, 99, 235, 0.1)",
                            borderWidth: item.mine ? 0 : 1,
                            borderColor: "rgba(37, 99, 235, 0.2)",
                          }}
                        >
                          {item.status === "sending" ? (
                            <ActivityIndicator
                              size="small"
                              color={item.mine ? "#ffffff" : isDark ? "#d4d4d8" : "#2563eb"}
                            />
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
                              color={item.mine ? "#ffffff" : "#2563eb"}
                            />
                          )}
                        </View>
                        <View className="flex-1 min-w-0">
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: "600",
                              color: item.mine ? "#ffffff" : isDark ? "#f4f4f5" : "#18181b",
                            }}
                            numberOfLines={1}
                          >
                            {item.text.startsWith("data:")
                              ? "Document Attachment"
                              : item.text.split("/").pop()?.split("?")[0] || "Document Attachment"}
                          </Text>
                          <Text
                            style={{
                              fontSize: 14,
                              marginTop: 2,
                              color: item.mine
                                ? "rgba(255, 255, 255, 0.75)"
                                : isDark
                                  ? "#a1a1aa"
                                  : "#71717a",
                            }}
                          >
                            {item.status === "sending"
                              ? "Uploading & sending..."
                              : "Tap to open / download"}
                          </Text>
                        </View>
                        {item.status === "sending" ? (
                          <ActivityIndicator
                            size="small"
                            color={item.mine ? "#ffffff" : "#2563eb"}
                          />
                        ) : (
                          <Ionicons
                            name="open-outline"
                            size={18}
                            color={item.mine ? "#ffffff" : isDark ? "#a1a1aa" : "#71717a"}
                          />
                        )}
                      </Pressable>
                    ) : (
                      <Text
                        style={{
                          fontSize: 14,
                          lineHeight: 20,
                          fontWeight: "400",
                          color: item.mine ? "#ffffff" : isDark ? "#fafafa" : "#111827",
                        }}
                      >
                        {item.text}
                      </Text>
                    )}

                    <View className={`flex-row items-center gap-1.5 mt-1 ${item.mine ? "justify-end" : "justify-start"}`}>
                      <Text
                        style={{
                          fontSize: 14,
                          color: item.mine
                            ? "rgba(255, 255, 255, 0.75)"
                            : isDark
                              ? "#a1a1aa"
                              : "#71717a",
                        }}
                      >
                        {item.time}
                      </Text>
                      {item.mine ? (
                        item.status === "sending" ? (
                          <ActivityIndicator size={10} color="rgba(255,255,255,0.85)" />
                        ) : item.status === "queued" || item.id.startsWith("local_") ? (
                          <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.75)" />
                        ) : item.isRead ? (
                          <Ionicons name="checkmark-done" size={13} weight="bold" color="#93c5fd" />
                        ) : (
                          <Ionicons name="checkmark" size={13} weight="bold" color="rgba(255,255,255,0.85)" />
                        )
                      ) : null}
                    </View>
                  </View>
                </View>
              )}
            />
          ) : (
            <View className="flex-1 items-center justify-center p-6">
              <View className="size-14 rounded-full bg-surface items-center justify-center mb-3">
                <Ionicons name="chatbubble-ellipses-outline" size={24} color={isDark ? "#d4d4d8" : "#52525b"} />
              </View>
              <Text className="text-foreground font-semibold text-sm mb-1">
                Start a conversation
              </Text>
              <Text className="text-muted-foreground text-sm text-center max-w-xs leading-5">
                Send a message to {staffDisplayName} or share a health record.
              </Text>
            </View>
          )}

          <View
            style={{ paddingBottom: isKeyboardVisible ? 8 : Math.max(insets.bottom + 10, 20) }}
            className="px-4 pt-2 bg-background flex-row items-center gap-2"
          >
            <Pressable
              onPress={() => setIsAttachmentSheetVisible(true)}
              disabled={isSending}
              className="size-9 items-center justify-center rounded-full bg-surface active:opacity-70"
            >
              <Ionicons name="add" size={21} color={isDark ? "#d4d4d8" : "#52525b"} />
            </Pressable>

            <View className="flex-1 min-h-11 flex-row items-center rounded-full bg-surface px-4 py-1.5">
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder={isSending ? "Sending attachment..." : "Type a message"}
                placeholderTextColor={isDark ? "#71717a" : "#94a3b8"}
                multiline
                editable={!isSending}
                className="max-h-20 flex-1 p-0 text-sm text-foreground"
              />
              {!inputText.trim() && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Voice message"
                  className="ml-2 size-8 items-center justify-center"
                >
                  <Ionicons name="mic-outline" size={18} color={isDark ? "#a1a1aa" : "#737373"} />
                </Pressable>
              )}
            </View>

            <Pressable
              onPress={handleSendText}
              disabled={isSending || !inputText.trim()}
              accessibilityRole="button"
              accessibilityLabel={isSending ? "Sending message" : "Send message"}
              className={`size-9 rounded-full items-center justify-center ${
                isSending || inputText.trim()
                  ? "bg-primary active:opacity-80"
                  : "bg-surface opacity-60"
              }`}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#171717" />
              ) : (
                <Ionicons
                  name="send"
                  size={16}
                  color={inputText.trim() ? "#171717" : isDark ? "#71717a" : "#94a3b8"}
                  style={{ marginLeft: 2 }}
                />
              )}
            </Pressable>
          </View>

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
                <ChatImagePreview uri={previewImage} />
              )}
            </View>
          </Modal>

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
                className="bg-surface rounded-t-[24px] px-5 pb-4 pt-1 shadow-none"
              >
                <View className="w-12 h-1 bg-default rounded-full self-center mb-3" />
                <BottomSheetHeader
                  title="Add attachment"
                  description="Choose a photo or health record."
                  onClose={() => setIsAttachmentSheetVisible(false)}
                  closeLabel="Close attachments"
                  className="mb-4"
                />

                <View className="gap-1 mb-3">
                  <Pressable
                    onPress={() => handlePickImage(true)}
                    className="min-h-12 flex-row items-center gap-3 rounded-xl px-2 active:bg-default"
                  >
                    <View className="size-9 rounded-full bg-muted items-center justify-center">
                      <Ionicons name="camera-outline" size={19} color={isDark ? "#e5e5e5" : "#404040"} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-foreground font-medium text-sm">Take photo</Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={isDark ? "#71717a" : "#94a3b8"}
                    />
                  </Pressable>

                  <Pressable
                    onPress={() => handlePickImage(false)}
                    className="min-h-12 flex-row items-center gap-3 rounded-xl px-2 active:bg-default"
                  >
                    <View className="size-9 rounded-full bg-muted items-center justify-center">
                      <Ionicons name="images-outline" size={19} color={isDark ? "#e5e5e5" : "#404040"} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-foreground font-medium text-sm">Photo library</Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={isDark ? "#71717a" : "#94a3b8"}
                    />
                  </Pressable>

                  <Pressable
                    onPress={() => handlePickDocument()}
                    className="min-h-12 flex-row items-center gap-3 rounded-xl px-2 active:bg-default"
                  >
                    <View className="size-9 rounded-full bg-muted items-center justify-center">
                      <Ionicons name="document-text-outline" size={19} color={isDark ? "#e5e5e5" : "#404040"} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-foreground font-medium text-sm">Health record</Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={isDark ? "#71717a" : "#94a3b8"}
                    />
                  </Pressable>
                </View>

              </Pressable>
            </Pressable>
          </Modal>

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
              className="flex-1 bg-black/70 justify-end sm:justify-center p-0"
            >
              {pendingAttachment && (
                <View className="bg-surface rounded-t-[24px] px-5 pt-1 pb-4 shadow-none">
                  <View className="w-12 h-1 bg-default rounded-full self-center mb-3" />
                  <BottomSheetHeader
                    title="Send attachment?"
                    description="Review the file before sending."
                    onClose={() => setPendingAttachment(null)}
                    closeLabel="Close attachment preview"
                    className="mb-4"
                  />

                  {pendingAttachment.detectedType === "image" ? (
                    <Image
                      source={{ uri: pendingAttachment.uri }}
                      className="w-full h-48 rounded-xl bg-default/40 mb-4"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="bg-default/40 rounded-xl p-3 flex-row items-center gap-3 mb-4">
                      <View className="size-10 rounded-xl bg-muted items-center justify-center">
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
                        <Text className="text-foreground font-semibold text-sm" numberOfLines={1}>
                          {pendingAttachment.name}
                        </Text>
                        <Text className="text-muted-foreground dark:text-muted-foreground text-sm mt-0.5">
                          {pendingAttachment.sizeFormatted} •{" "}
                          {pendingAttachment.name.split(".").pop()?.toUpperCase() || "FILE"}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View className="flex-row items-center gap-3 mt-1">
                    <Pressable
                      onPress={() => setPendingAttachment(null)}
                      disabled={isSending}
                      className="min-h-11 px-5 rounded-md bg-default active:opacity-75 items-center justify-center"
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
                      className="min-h-11 flex-1 bg-primary rounded-md flex-row items-center justify-center gap-2 active:opacity-85"
                    >
                      {isSending ? (
                        <ActivityIndicator size="small" color="#171717" />
                      ) : (
                        <>
                          <Ionicons name="send" size={16} color="#171717" />
                          <Text className="text-[#171717] font-semibold text-sm">Send Attachment</Text>
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

  if (
    motherRecord &&
    assignedWorkerId &&
    !isStaffListVisible &&
    allMessages.length === 0 &&
    staffList.length === 0
  ) {
    return (
      <View className="flex-1 bg-background">
        <MessagesTopBar
          isDark={isDark}
          onBack={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
        />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color={isDark ? "#fffe8c" : "#003f2c"} />
        </View>
      </View>
    );
  }

  const facilityTitle =
    user?.facility_name || user?.facility?.facility_name || "Facility Healthcare Team";

  return (
    <View className="flex-1 bg-background">
      <MessagesTopBar
        isDark={isDark}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
      />

      <View className="px-4 pt-3 pb-3 bg-background">
        <Text className="mb-3 text-sm text-muted-foreground" numberOfLines={1}>
          {facilityTitle}
        </Text>

        <View className="flex-row items-center bg-field-background border border-border rounded-md px-3 py-2">
          <Ionicons
            name="search-outline"
            size={18}
            color={isDark ? "#71717a" : "#64748b"}
            className="mr-2"
          />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search healthcare staff by name or role..."
            placeholderTextColor={isDark ? "#71717a" : "#94a3b8"}
            className="flex-1 text-foreground text-base p-0"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color={isDark ? "#71717a" : "#94a3b8"} />
            </Pressable>
          )}
        </View>

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
                    : "bg-surface dark:bg-default/50 border-default"
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    isSelected ? "text-white" : "text-muted-foreground dark:text-muted-foreground"
                  }`}
                >
                  {role === "HealthWorker" ? "Health Worker" : role}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filteredStaff}
        keyExtractor={(item) => item.user_id}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 90 }}
        ListEmptyComponent={
          <View className="items-center justify-center p-10">
            <View className="size-14 rounded-full bg-surface border border-default items-center justify-center mb-3 shadow-none">
              <Ionicons name="people-outline" size={24} color={isDark ? "#71717a" : "#94a3b8"} />
            </View>
            <Text className="text-foreground font-semibold text-base mb-1">No Staff Found</Text>
            <Text className="text-muted-foreground dark:text-muted-foreground text-sm text-center max-w-xs">
              {searchQuery
                ? "No staff matches your search query."
                : "No healthcare staff members are listed for your facility."}
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
              onPress={() => {
                setSelectedStaff(item);
                setIsStaffListVisible(false);
              }}
              className="flex-row items-center px-5 py-3.5 border-b border-default/50 active:bg-surface-secondary"
            >
              <View className="relative mr-3.5">
                <View className="size-11 rounded-full bg-primary/20 overflow-hidden items-center justify-center">
                  {item.profile_url ? (
                    <Image
                      source={{ uri: item.profile_url }}
                      className="size-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Text className="text-primary text-base font-semibold">
                      {item.first_name ? item.first_name.charAt(0).toUpperCase() : "S"}
                    </Text>
                  )}
                </View>

                <View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: isOnline ? "#10b981" : "#71717a",
                    borderWidth: 2,
                    borderColor: isDark ? "#18181b" : "#ffffff",
                  }}
                />
              </View>

              <View className="flex-1 min-w-0 pr-2">
                <View className="flex-row items-center justify-between gap-1 mb-1">
                  <Text
                    className={`text-base font-semibold truncate ${
                      item.unreadCount > 0 ? "text-foreground" : "text-foreground/90"
                    }`}
                    numberOfLines={1}
                  >
                    {displayName}
                  </Text>
                  {item.lastMessageDate && (
                    <Text className="text-muted-foreground dark:text-muted-foreground text-sm shrink-0">
                      {formatTimeLabel(item.lastMessageDate)}
                    </Text>
                  )}
                </View>

                <View className="flex-row items-center gap-1.5 mb-1 flex-wrap">
                  <View className={`px-1.5 py-0.2 rounded border ${badge.bg} ${badge.border}`}>
                    <Text className={`text-sm font-semibold ${badge.text}`}>{item.role}</Text>
                  </View>
                  {item.isAssigned && (
                    <View className="flex-row items-center gap-1 bg-muted px-1.5 py-0.2 rounded border border-blue-500/25">
                      <Ionicons name="shield-checkmark" size={10} color="#3b82f6" />
                      <Text className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                        Assigned Provider
                      </Text>
                    </View>
                  )}
                  {item.facility?.facility_name && (
                    <Text
                      className="text-muted-foreground dark:text-muted-foreground text-sm truncate"
                      numberOfLines={1}
                    >
                      • {item.facility.facility_name}
                    </Text>
                  )}
                </View>

                <View className="flex-row items-center justify-between">
                  <Text
                    className={`text-sm truncate flex-1 mr-2 ${
                      item.unreadCount > 0
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground dark:text-muted-foreground"
                    }`}
                    numberOfLines={1}
                  >
                    {item.lastMessage}
                  </Text>

                  {item.unreadCount > 0 && (
                    <View className="size-5 rounded-full bg-primary items-center justify-center shrink-0">
                      <Text className="text-white text-sm font-semibold">{item.unreadCount}</Text>
                    </View>
                  )}
                </View>
              </View>

              <Ionicons name="chevron-forward" size={18} color={isDark ? "#71717a" : "#a1a1aa"} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}
