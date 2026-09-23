import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import {
  getMotherProfileApi,
  getNotificationsApi,
  getUnreadNotificationCountApi,
  markAllNotificationsReadApi,
} from "../config/api";
import type { AuthUser, MotherRecord, PregnancyRecord } from "../config/api";
import {
  saveMotherProfileLocal,
  getMotherProfileLocal,
  getNotificationsLocal,
  getUnreadNotificationCountLocal,
  saveNotificationsLocal,
  markAllNotificationsReadLocal,
} from "../db/repository";
import { clearAllTablesLocal } from "../db/db";
import { triggerOutboxSync } from "../services/syncEngine";
import { getSecureToken, setSecureToken, deleteSecureToken } from "../lib/secureStorage";

export const STORAGE_KEYS = {
  TOKEN: "@bms_auth_token",
  USER: "@bms_user_data",
  MOTHER_RECORD: "@bms_mother_record",
  ACTIVE_PREGNANCY: "@bms_active_pregnancy",
};

export type User = AuthUser & {
  name: string;
};

export type UserContextType = {
  user: User;
  token: string | null;
  motherRecord: MotherRecord | null;
  activePregnancy: PregnancyRecord | null;
  isAuthenticated: boolean;
  isLoadingStorage: boolean;
  isOnline: boolean;
  unreadCount: number;
  login: (userData: AuthUser, token: string) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
};

const emptyUserData: AuthUser = {
  user_id: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  role: "Mother",
  email: "",
  phone_number: "",
  address: "",
};

const formatUser = (rawUser: AuthUser): User => {
  const nameParts = [rawUser.first_name, rawUser.middle_name, rawUser.last_name].filter(Boolean);
  return {
    ...rawUser,
    name: nameParts.join(" ") || "Mother",
    facility_name: rawUser.facility?.facility_name || rawUser.facility_name || undefined,
  };
};

const defaultContext: UserContextType = {
  user: formatUser(emptyUserData),
  token: null,
  motherRecord: null,
  activePregnancy: null,
  isAuthenticated: false,
  isLoadingStorage: true,
  isOnline: true,
  unreadCount: 0,
  login: () => {},
  logout: () => {},
  refreshProfile: async () => {},
  refreshNotifications: async () => {},
  markAllNotificationsRead: async () => {},
};

const UserContext = createContext<UserContextType>(defaultContext);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(formatUser(emptyUserData));
  const [token, setToken] = useState<string | null>(null);
  const [motherRecord, setMotherRecord] = useState<MotherRecord | null>(null);
  const [activePregnancy, setActivePregnancy] = useState<PregnancyRecord | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const refreshNotifications = useCallback(async () => {
    if (!user.user_id) return;

    try {
      const localCount = await getUnreadNotificationCountLocal(user.user_id);
      setUnreadCount(localCount);
    } catch (e) {
      console.warn("Local unread count error:", e);
    }

    if (token && isOnline) {
      try {
        const [freshCount, freshNotifs] = await Promise.all([
          getUnreadNotificationCountApi(user.user_id, token),
          getNotificationsApi(user.user_id, token),
        ]);
        setUnreadCount(freshCount);
        if (Array.isArray(freshNotifs) && freshNotifs.length > 0) {
          await saveNotificationsLocal(freshNotifs as any);
        }
      } catch (err) {
        console.warn("Backend notification fetch error:", err);
      }
    }
  }, [user.user_id, token, isOnline]);

  const markAllNotificationsRead = useCallback(async () => {
    if (!user.user_id) return;
    setUnreadCount(0);
    try {
      await markAllNotificationsReadLocal(user.user_id);
      if (token && isOnline) {
        await markAllNotificationsReadApi(user.user_id, token);
      }
    } catch (err) {
      console.warn("Error marking all notifications read:", err);
    }
  }, [user.user_id, token, isOnline]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected);
      setIsOnline(online);
      if (online && token && user.user_id) {
        triggerOutboxSync(token, user.user_id);
        refreshNotifications();
      }
    });

    return () => unsubscribe();
  }, [token, user.user_id, refreshNotifications]);

  useEffect(() => {
    if (user.user_id) {
      refreshNotifications();
    }
  }, [user.user_id, token, refreshNotifications]);

  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        let storedToken = await getSecureToken();
        if (!storedToken) {
          storedToken = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
          if (storedToken) {
            await setSecureToken(storedToken);
            await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
          }
        }

        const storedUserJson = await AsyncStorage.getItem(STORAGE_KEYS.USER);
        const storedMotherJson = await AsyncStorage.getItem(STORAGE_KEYS.MOTHER_RECORD);
        const storedPregnancyJson = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_PREGNANCY);

        if (storedToken) {
          setToken(storedToken);
          let currentUserId = "";

          if (storedUserJson) {
            const rawUser = JSON.parse(storedUserJson);
            currentUserId = rawUser.user_id;
            setUser(formatUser(rawUser));

            const sqliteData = await getMotherProfileLocal(rawUser.user_id);
            if (sqliteData?.motherRecord) {
              setMotherRecord(sqliteData.motherRecord);
              if (sqliteData.motherRecord.pregnancies?.length) {
                setActivePregnancy(sqliteData.motherRecord.pregnancies[0]);
              }
            }
          }

          if (storedMotherJson) {
            const parsedMother = JSON.parse(storedMotherJson);
            setMotherRecord((prev) => prev || parsedMother);
          }

          if (storedPregnancyJson) {
            const parsedPreg = JSON.parse(storedPregnancyJson);
            setActivePregnancy((prev) => prev || parsedPreg);
          }

          if (currentUserId) {
            triggerOutboxSync(storedToken, currentUserId);
          }
          fetchProfile(storedToken, currentUserId);
        }
      } catch (err) {
        console.error("Failed to load stored authentication:", err);
      } finally {
        setIsLoadingStorage(false);
      }
    };

    loadStoredAuth();
  }, []);

  const fetchProfile = async (authToken: string, explicitUserId?: string) => {
    try {
      const data = await getMotherProfileApi(authToken);
      if (data.result) {
        if (data.result.user) {
          const formatted = formatUser(data.result.user);
          setUser(formatted);
          await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.result.user));
        }

        const mRecord: MotherRecord = {
          mother_id: data.result.mother_id || (data.result as any).mother_id,
          user_id: data.result.user?.user_id || "",
          family_serial_no: (data.result as any).family_serial_no,
          birth_date: (data.result as any).birth_date,
          age: (data.result as any).age,
          civil_status: (data.result as any).civil_status,
          blood_type: (data.result as any).blood_type,
          assigned_worker_id: (data.result as any).assigned_worker_id || (data.result as any).assignedWorker?.user_id || null,
          created_by_id: (data.result as any).created_by_id || (data.result as any).creator?.user_id || null,
          assignedWorker: (data.result as any).assignedWorker || null,
          creator: (data.result as any).creator || null,
          pregnancies: data.result.pregnancies,
        };
        setMotherRecord(mRecord);
        await AsyncStorage.setItem(STORAGE_KEYS.MOTHER_RECORD, JSON.stringify(mRecord));

        if (data.result.pregnancies && data.result.pregnancies.length > 0) {
          const firstPregnancy = data.result.pregnancies[0];
          setActivePregnancy(firstPregnancy);
          await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_PREGNANCY, JSON.stringify(firstPregnancy));
        }

        await saveMotherProfileLocal({
          user: data.result.user!,
          mother_id: mRecord.mother_id,
          family_serial_no: mRecord.family_serial_no,
          birth_date: mRecord.birth_date,
          age: mRecord.age,
          civil_status: mRecord.civil_status,
          blood_type: mRecord.blood_type,
          assigned_worker_id: mRecord.assigned_worker_id,
          created_by_id: mRecord.created_by_id,
          assignedWorker: mRecord.assignedWorker,
          creator: mRecord.creator,
          pregnancies: mRecord.pregnancies,
        });
      }
    } catch (err) {
      console.log("Network offline or fetch profile failed. Falling back to local SQLite DB:", err);
      const targetUserId = explicitUserId || user.user_id;
      if (targetUserId) {
        const sqliteData = await getMotherProfileLocal(targetUserId);
        if (sqliteData?.motherRecord) {
          setMotherRecord(sqliteData.motherRecord);
          if (sqliteData.motherRecord.pregnancies?.length) {
            setActivePregnancy(sqliteData.motherRecord.pregnancies[0]);
          }
        }
      }
    }
  };

  const login = async (userData: AuthUser, authToken: string) => {
    const formatted = formatUser(userData);
    setUser(formatted);
    setToken(authToken);

    try {
      await setSecureToken(authToken);
      await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
      await fetchProfile(authToken, userData.user_id);
      refreshNotifications();
    } catch (err) {
      console.error("Failed to store user session:", err);
    }
  };

  const logout = async () => {
    const currentUserId = user.user_id;
    setUser(formatUser(emptyUserData));
    setToken(null);
    setMotherRecord(null);
    setActivePregnancy(null);
    setUnreadCount(0);

    try {
      await deleteSecureToken();
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.USER,
        STORAGE_KEYS.MOTHER_RECORD,
        STORAGE_KEYS.ACTIVE_PREGNANCY,
      ]);
      await clearAllTablesLocal(currentUserId);
    } catch (err) {
      console.error("Failed to clear auth storage:", err);
    }
  };

  const refreshProfile = async () => {
    if (token) {
      await fetchProfile(token, user.user_id);
    }
  };

  const value: UserContextType = {
    user,
    token,
    motherRecord,
    activePregnancy,
    isAuthenticated: !!token,
    isLoadingStorage,
    isOnline,
    unreadCount,
    login,
    logout,
    refreshProfile,
    refreshNotifications,
    markAllNotificationsRead,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): User {
  const context = useContext(UserContext);
  return context.user;
}

export function useAuth(): UserContextType {
  return useContext(UserContext);
}
