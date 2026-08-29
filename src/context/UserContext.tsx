import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { getMotherProfileApi } from "../config/api";
import type { AuthUser, MotherRecord, PregnancyRecord } from "../config/api";
import {
  saveMotherProfileLocal,
  getMotherProfileLocal,
} from "../db/repository";
import { triggerOutboxSync } from "../services/syncEngine";

const STORAGE_KEYS = {
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
  login: (userData: AuthUser, token: string) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
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
  login: () => {},
  logout: () => {},
  refreshProfile: async () => {},
};

const UserContext = createContext<UserContextType>(defaultContext);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(formatUser(emptyUserData));
  const [token, setToken] = useState<string | null>(null);
  const [motherRecord, setMotherRecord] = useState<MotherRecord | null>(null);
  const [activePregnancy, setActivePregnancy] = useState<PregnancyRecord | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Network State Listener & Sync Engine Trigger
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected);
      setIsOnline(online);
      if (online && token) {
        triggerOutboxSync(token);
      }
    });

    return () => unsubscribe();
  }, [token]);

  // Load stored state on initial mount
  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
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

            // Hydrate from local SQLite database first
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

          // Trigger outbox sync & refresh profile if connected
          triggerOutboxSync(storedToken);
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
          pregnancies: data.result.pregnancies,
        };
        setMotherRecord(mRecord);
        await AsyncStorage.setItem(STORAGE_KEYS.MOTHER_RECORD, JSON.stringify(mRecord));

        if (data.result.pregnancies && data.result.pregnancies.length > 0) {
          const firstPregnancy = data.result.pregnancies[0];
          setActivePregnancy(firstPregnancy);
          await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_PREGNANCY, JSON.stringify(firstPregnancy));
        }

        // Cache into local SQLite database
        await saveMotherProfileLocal({
          user: data.result.user!,
          mother_id: mRecord.mother_id,
          family_serial_no: mRecord.family_serial_no,
          birth_date: mRecord.birth_date,
          age: mRecord.age,
          civil_status: mRecord.civil_status,
          blood_type: mRecord.blood_type,
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
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, authToken);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
    } catch (err) {
      console.error("Failed to persist login session:", err);
    }

    await fetchProfile(authToken, userData.user_id);
  };

  const logout = async () => {
    setUser(formatUser(emptyUserData));
    setToken(null);
    setMotherRecord(null);
    setActivePregnancy(null);

    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.USER,
        STORAGE_KEYS.MOTHER_RECORD,
        STORAGE_KEYS.ACTIVE_PREGNANCY,
      ]);
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
    login,
    logout,
    refreshProfile,
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
