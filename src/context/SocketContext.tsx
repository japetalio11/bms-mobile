import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./UserContext";
import { API_BASE_URL } from "../config/api";
import { saveNotificationsLocal, saveMessagesLocal } from "../db/repository";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

export const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user, isAuthenticated, refreshNotifications } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const socketRef = useRef<Socket | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!isAuthenticated || !token || !user?.user_id) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socketInstance = io(API_BASE_URL, {
      auth: { token },
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socketInstance;

    socketInstance.on("connect", () => {
      setSocket(socketInstance);
      setIsConnected(true);
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
    });

    socketInstance.on("connect_error", (error) => {
      console.warn("[Mobile Socket] Connection error:", error.message);
    });

    socketInstance.on("notification:new", async (notification: any) => {
      try {
        if (user.user_id && notification) {
          await saveNotificationsLocal([notification as any]);
        }
      } catch (dbErr) {
        console.warn("[Mobile Socket] Failed to save notification locally:", dbErr);
      }

      refreshNotifications();
    });

    socketInstance.on("notification:read_all", () => {
      refreshNotifications();
    });

    socketInstance.on("message:new", async (message: any) => {
      try {
        if (message) {
          await saveMessagesLocal([message]);
        }
      } catch (err) {
        console.warn("[Mobile Socket] Failed to save message locally:", err);
      }
    });

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === "active") {
        if (socketRef.current && !socketRef.current.connected) {
          socketRef.current.connect();
        }
        refreshNotifications();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
      socketInstance.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    };
  }, [isAuthenticated, token, user?.user_id, refreshNotifications]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>{children}</SocketContext.Provider>
  );
};
