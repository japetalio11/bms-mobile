import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { getMotherProfileApi } from "../config/api";
import type { AuthUser, MotherRecord, PregnancyRecord } from "../config/api";

export type User = AuthUser & {
  name: string;
};

export type UserContextType = {
  user: User;
  token: string | null;
  motherRecord: MotherRecord | null;
  activePregnancy: PregnancyRecord | null;
  isAuthenticated: boolean;
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

  const fetchProfile = async (authToken: string) => {
    try {
      const data = await getMotherProfileApi(authToken);
      if (data.result) {
        if (data.result.user) {
          setUser(formatUser(data.result.user));
        }
        setMotherRecord(data.result as MotherRecord);
        if (data.result.pregnancies && data.result.pregnancies.length > 0) {
          setActivePregnancy(data.result.pregnancies[0]);
        }
      }
    } catch (err) {
      console.log("Could not fetch mother profile:", err);
    }
  };

  useEffect(() => {
    if (token) {
      let isMounted = true;
      (async () => {
        try {
          const data = await getMotherProfileApi(token);
          if (isMounted && data.result) {
            if (data.result.user) {
              setUser(formatUser(data.result.user));
            }
            setMotherRecord(data.result as MotherRecord);
            if (data.result.pregnancies && data.result.pregnancies.length > 0) {
              setActivePregnancy(data.result.pregnancies[0]);
            }
          }
        } catch (err) {
          console.log("Could not fetch mother profile:", err);
        }
      })();
      return () => {
        isMounted = false;
      };
    }
  }, [token]);

  const login = (userData: AuthUser, authToken: string) => {
    setUser(formatUser(userData));
    setToken(authToken);
    fetchProfile(authToken);
  };

  const logout = () => {
    setUser(formatUser(emptyUserData));
    setToken(null);
    setMotherRecord(null);
    setActivePregnancy(null);
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
