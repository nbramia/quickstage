// Common response helpers
export function jsonError(c, error, status = 400, additional) {
    const response = { error, ...additional };
    return c.json(response, status);
}
export function jsonSuccess(c, data, status = 200) {
    return c.json({ success: true, ...data }, status);
}
export function jsonNotFound(c, resource = 'Resource') {
    return c.json({ error: `${resource} not found` }, 404);
}
export function jsonUnauthorized(c, message = 'Unauthorized') {
    return c.json({ error: 'unauthorized', message }, 401);
}
export function jsonForbidden(c, message = 'Forbidden') {
    return c.json({ error: 'forbidden', message }, 403);
}
export function jsonServerError(c, message = 'Internal server error') {
    return c.json({ error: 'server_error', message }, 500);
}
