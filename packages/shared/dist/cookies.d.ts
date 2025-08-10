export declare function signSession(payload: object, secret: string, ttlSeconds: number): Promise<string>;
export declare function verifySession(token: string, secret: string): Promise<null | any>;
export declare function generatePassword(length?: number): string;
