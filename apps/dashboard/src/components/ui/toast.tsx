'use client';

import { toast as sonnerToast } from 'sonner';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  title?: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Toast notification helper functions
 */
export const toast = {
  success: (options: ToastOptions | string) => {
    if (typeof options === 'string') {
      return sonnerToast.success(options);
    }
    return sonnerToast.success(options.title, {
      description: options.description,
      duration: options.duration,
      action: options.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
    });
  },

  error: (options: ToastOptions | string) => {
    if (typeof options === 'string') {
      return sonnerToast.error(options);
    }
    return sonnerToast.error(options.title, {
      description: options.description,
      duration: options.duration || 5000,
      action: options.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
    });
  },

  warning: (options: ToastOptions | string) => {
    if (typeof options === 'string') {
      return sonnerToast.warning(options);
    }
    return sonnerToast.warning(options.title, {
      description: options.description,
      duration: options.duration,
      action: options.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
    });
  },

  info: (options: ToastOptions | string) => {
    if (typeof options === 'string') {
      return sonnerToast.info(options);
    }
    return sonnerToast.info(options.title, {
      description: options.description,
      duration: options.duration,
      action: options.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
    });
  },

  loading: (message: string) => {
    return sonnerToast.loading(message);
  },

  promise: <T,>(
    promise: Promise<T>,
    options: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    }
  ) => {
    return sonnerToast.promise(promise, options);
  },

  dismiss: (toastId?: string | number) => {
    sonnerToast.dismiss(toastId);
  },

  custom: (
    type: ToastType,
    options: ToastOptions
  ) => {
    switch (type) {
      case 'success':
        return toast.success(options);
      case 'error':
        return toast.error(options);
      case 'warning':
        return toast.warning(options);
      case 'info':
        return toast.info(options);
    }
  },
};
