import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getMotherProfileApi } from "../config/api";
import type { AuthUser, MotherRecord, PregnancyRecord } from "../config/api";

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
          if (storedUserJson) {
            setUser(formatUser(JSON.parse(storedUserJson)));
          }
          if (storedMotherJson) {
            setMotherRecord(JSON.parse(storedMotherJson));
          }
          if (storedPregnancyJson) {
            setActivePregnancy(JSON.parse(storedPregnancyJson));
          }

          // Refresh latest profile data from backend using restored token
          fetchProfile(storedToken);
        }
      } catch (err) {
        console.error("Failed to load stored authentication:", err);
      } finally {
        setIsLoadingStorage(false);
      }
    };

    loadStoredAuth();
  }, []);

  const fetchProfile = async (authToken: string) => {
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
      }
    } catch (err) {
      console.log("Could not fetch mother profile:", err);
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

    await fetchProfile(authToken);
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
      await fetchProfile(token);
    }
  };

  const value: UserContextType = {
    user,
    token,
    motherRecord,
    activePregnancy,
    isAuthenticated: !!token,
    isLoadingStorage,
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

