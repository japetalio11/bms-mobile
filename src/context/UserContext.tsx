import { createContext, useContext } from "react";
import type { ReactNode } from "react";

export type User = {
  name: string;
  email: string;
};

const defaultUser: User = {
  name: "Maria Santos",
  email: "msantos@gmail.com",
};

const UserContext = createContext<User>(defaultUser);

export function UserProvider({ children }: { children: ReactNode }) {
  // TODO: Replace with real auth/API data
  return (
    <UserContext.Provider value={defaultUser}>{children}</UserContext.Provider>
  );
}

export function useUser(): User {
  return useContext(UserContext);
}
