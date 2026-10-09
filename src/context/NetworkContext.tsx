import React, { createContext, useContext, useEffect, useState } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

export type NetworkContextType = {
  isOnline: boolean;
  isInternetReachable: boolean | null;
  connectionType: string | null;
};

const NetworkContext = createContext<NetworkContextType>({
  isOnline: true,
  isInternetReachable: true,
  connectionType: null,
});

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [networkState, setNetworkState] = useState<NetworkContextType>({
    isOnline: true,
    isInternetReachable: true,
    connectionType: null,
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setNetworkState({
        isOnline: Boolean(state.isConnected),
        isInternetReachable: state.isInternetReachable,
        connectionType: state.type,
      });
    });

    return () => unsubscribe();
  }, []);

  return <NetworkContext.Provider value={networkState}>{children}</NetworkContext.Provider>;
};

export const useNetwork = (): NetworkContextType => useContext(NetworkContext);
