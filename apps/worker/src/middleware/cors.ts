import { cors } from 'hono/cors';

// CORS middleware configuration
export const corsMiddleware = cors({ 
  origin: (origin: string | undefined) => {
    // Allow requests from quickstage.tech, localhost, and VS Code extension
    if (!origin) return '*';
    if (origin.includes('quickstage.tech') || 
        origin.includes('localhost') || 
        origin.includes('127.0.0.1') ||
        origin.includes('vscode-webview://') ||
        origin.includes('vscode-file://')) {
      return origin;
    }
    return false;
  }, 
  credentials: true 
});