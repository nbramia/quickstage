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
    showSaveFilePicker?: (options: {
      suggestedName?: string;
      types?: Array<{
        description: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<FileSystemFileHandle>;
  }
  
  interface FileSystemFileHandle {
    createWritable(): Promise<FileSystemWritableStream>;
  }
  
  interface FileSystemWritableStream {
    write(data: any): Promise<void>;
    close(): Promise<void>;
  }
}

export {};

