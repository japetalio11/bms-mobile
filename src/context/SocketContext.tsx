import React, { createContext, useContext, useEffect, useState, useRef, useMemo } from "react";
import { AppState, AppStateStatus } from "react-native";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
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
  const appState = useRef<string | null | undefined>(AppState.currentState);
  const refreshNotificationsRef = useRef(refreshNotifications);

  useEffect(() => {
    refreshNotificationsRef.current = refreshNotifications;
  }, [refreshNotifications]);

  useEffect(() => {
    if (!isAuthenticated || !token || !user?.user_id) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
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
      timeout: 10000,
    });

    socketRef.current = socketInstance;

    socketInstance.on("connect", () => {
      setSocket(socketInstance);
      setIsConnected(true);
    });

    socketInstance.on("reconnect", () => {
      setSocket(socketInstance);
      setIsConnected(true);
      refreshNotificationsRef.current();
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
    });

    socketInstance.on("connect_error", (error) => {
      console.warn("[Mobile Socket] Connection error:", error.message);
      setIsConnected(false);
    });

    socketInstance.on("notification:new", async (notification: any) => {
      try {
        if (user.user_id && notification) {
          await saveNotificationsLocal([notification as any]);
        }
      } catch (dbErr) {
        console.warn("[Mobile Socket] Failed to save notification locally:", dbErr);
      }

      refreshNotificationsRef.current();
    });

    socketInstance.on("notification:read_all", () => {
      refreshNotificationsRef.current();
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
      if (appState.current?.match(/inactive|background/) && nextAppState === "active") {
        if (socketRef.current && !socketRef.current.connected) {
          socketRef.current.connect();
        }
        refreshNotificationsRef.current();
      }
      appState.current = nextAppState;
    };

    const handleNetworkChange = (state: NetInfoState) => {
      if (state.isConnected && socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
        refreshNotificationsRef.current();
      }
    };

    const appStateSubscription = AppState.addEventListener("change", handleAppStateChange);
    const networkSubscription = NetInfo.addEventListener(handleNetworkChange);

    return () => {
      appStateSubscription.remove();
      networkSubscription();
      socketInstance.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    };
  }, [isAuthenticated, token, user?.user_id]);

  const contextValue = useMemo(() => ({ socket, isConnected }), [socket, isConnected]);

  return (
    <SocketContext.Provider value={contextValue}>{children}</SocketContext.Provider>
  );
};
