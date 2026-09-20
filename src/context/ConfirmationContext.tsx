import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ConfirmationModal, ConfirmationVariant } from "../components/ConfirmationModal";

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmationVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
};

export type ConfirmAsyncOptions = Omit<ConfirmOptions, "onConfirm" | "onCancel">;

type ConfirmationContextType = {
  confirm: (options: ConfirmOptions) => void;
  confirmAsync: (options: ConfirmAsyncOptions) => Promise<boolean>;
};

const ConfirmationContext = createContext<ConfirmationContextType | undefined>(undefined);

export const ConfirmationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [modalOptions, setModalOptions] = useState<ConfirmOptions>({
    title: "",
    message: "",
  });

  const [asyncResolver, setAsyncResolver] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setModalOptions(options);
    setIsLoading(false);
    setVisible(true);
  }, []);

  const confirmAsync = useCallback((options: ConfirmAsyncOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setModalOptions(options);
      setAsyncResolver(() => resolve);
      setIsLoading(false);
      setVisible(true);
    });
  }, []);

  const handleConfirm = async () => {
    if (modalOptions.onConfirm) {
      try {
        setIsLoading(true);
        await modalOptions.onConfirm();
      } catch (err) {
        console.error("Confirmation onConfirm error:", err);
      } finally {
        setIsLoading(false);
      }
    }
    
    if (asyncResolver) {
      asyncResolver(true);
      setAsyncResolver(null);
    }
    
    setVisible(false);
  };

  const handleCancel = () => {
    if (modalOptions.onCancel) {
      modalOptions.onCancel();
    }
    if (asyncResolver) {
      asyncResolver(false);
      setAsyncResolver(null);
    }
    setVisible(false);
  };

  return (
    <ConfirmationContext.Provider value={{ confirm, confirmAsync }}>
      {children}
      <ConfirmationModal
        visible={visible}
        title={modalOptions.title}
        message={modalOptions.message}
        confirmText={modalOptions.confirmText}
        cancelText={modalOptions.cancelText}
        variant={modalOptions.variant}
        icon={modalOptions.icon}
        isLoading={isLoading}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmationContext.Provider>
  );
};

export const useConfirm = (): ConfirmationContextType => {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmationProvider");
  }
  return context;
};
