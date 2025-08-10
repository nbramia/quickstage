// Router module for organizing API endpoints
export interface RouteConfig {
  path: string;
  method: string;
  handler: Function;
  middleware?: Function[];
}

export interface Router {
  get: (path: string, handler: Function) => void;
  post: (path: string, handler: Function) => void;
  put: (path: string, handler: Function) => void;
  delete: (path: string, handler: Function) => void;
}

