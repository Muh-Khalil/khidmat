import { create } from 'zustand';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastState {
  currentToast: ToastItem | null;
  showToast: (
    titleOrItem: string | Omit<ToastItem, 'id'>,
    message?: string,
    type?: ToastType,
    duration?: number,
  ) => void;
  hideToast: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  currentToast: null,
  showToast: (titleOrItem, message, type = 'success', duration = 3500) => {
    let newItem: ToastItem;
    const id = Date.now().toString();

    if (typeof titleOrItem === 'string') {
      newItem = {
        id,
        title: titleOrItem,
        message,
        type: type || 'success',
        duration: duration || 3500,
      };
    } else {
      newItem = {
        ...titleOrItem,
        id,
        duration: titleOrItem.duration || 3500,
      };
    }

    set({ currentToast: newItem });
  },
  hideToast: () => {
    set({ currentToast: null });
  },
}));

/**
 * Convenient standalone trigger functions for showToast
 */
export const toast = {
  success: (title: string, message?: string, duration?: number) => {
    useToastStore.getState().showToast({
      title,
      message,
      type: 'success',
      duration,
    });
  },
  info: (title: string, message?: string, duration?: number) => {
    useToastStore.getState().showToast({
      title,
      message,
      type: 'info',
      duration,
    });
  },
  warning: (title: string, message?: string, duration?: number) => {
    useToastStore.getState().showToast({
      title,
      message,
      type: 'warning',
      duration,
    });
  },
  error: (title: string, message?: string, duration?: number) => {
    useToastStore.getState().showToast({
      title,
      message,
      type: 'error',
      duration,
    });
  },
  hide: () => {
    useToastStore.getState().hideToast();
  },
};
