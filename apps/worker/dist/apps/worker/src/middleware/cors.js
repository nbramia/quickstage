import { cors } from 'hono/cors';
// CORS middleware configuration
export const corsMiddleware = cors({
    origin: (origin) => {
        // Allow requests from quickstage.tech and localhost
        if (!origin)
            return '*';
        if (origin.includes('quickstage.tech') || origin.includes('localhost'))
            return origin;
        return false;
    },
    credentials: true
});
