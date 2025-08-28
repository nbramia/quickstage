// Request validation utilities
export function validateRequired(fields, requiredFields) {
    const missing = requiredFields.filter(field => !fields[field]);
    return { valid: missing.length === 0, missing: missing.length > 0 ? missing : undefined };
}
export function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
export function validatePassword(password) {
    if (!password || password.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    return { valid: true };
}
export function parseLimit(limitStr, defaultLimit = 100, maxLimit = 1000) {
    if (!limitStr)
        return defaultLimit;
    const limit = parseInt(limitStr);
    if (isNaN(limit) || limit <= 0)
        return defaultLimit;
    return Math.min(limit, maxLimit);
}
export function parseExpiryDays(days, defaultDays = 7, maxDays = 365) {
    const parsed = Number(days);
    if (isNaN(parsed) || parsed < 1)
        return defaultDays;
    return Math.min(parsed, maxDays);
}
