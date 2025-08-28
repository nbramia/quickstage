// Common response helpers
export function jsonError(c: any, error: string, status: number = 400, additional?: Record<string, any>) {
  const response = { error, ...additional };
  return c.json(response, status);
}

export function jsonSuccess(c: any, data: any, status: number = 200) {
  return c.json({ success: true, ...data }, status);
}

export function jsonNotFound(c: any, resource: string = 'Resource') {
  return c.json({ error: `${resource} not found` }, 404);
}

export function jsonUnauthorized(c: any, message: string = 'Unauthorized') {
  return c.json({ error: 'unauthorized', message }, 401);
}

export function jsonForbidden(c: any, message: string = 'Forbidden') {
  return c.json({ error: 'forbidden', message }, 403);
}

export function jsonServerError(c: any, message: string = 'Internal server error') {
  return c.json({ error: 'server_error', message }, 500);
}