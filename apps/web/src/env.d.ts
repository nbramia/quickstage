/// <reference types="vite/client" />

interface Window {
  turnstile?: {
    reset: () => void;
    render: (container: string | HTMLElement, options: any) => void;
  };
}

declare global {
  interface Window {
    turnstile?: {
      reset: () => void;
      render: (container: string | HTMLElement, options: any) => void;
    };
  }
}

export {};

