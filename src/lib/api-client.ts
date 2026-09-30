/**
 * GulfHive ERP - Authoritative API Client
 * 
 * Features:
 * 1. Resolves API base URL across Development, Desktop Local, and Hosted Production environments.
 * 2. Safe response parsing: inspects Content-Type and HTTP status before attempting JSON deserialization.
 * 3. Prevents "Unexpected token 'T'" errors when hosting platforms return HTML or plain text error pages.
 * 4. Standardizes error responses into structured AppError instances.
 */

export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Headers;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: any;
  public readonly rawText?: string;

  constructor(message: string, status: number, code = 'API_ERROR', details?: any, rawText?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.rawText = rawText;
  }
}

/**
 * Determine the authoritative API base URL based on runtime environment:
 * 1. Window global config (injected by host or desktop container)
 * 2. Vite environment variable: VITE_GULFHIVE_API_BASE_URL or VITE_API_BASE_URL
 * 3. Default: empty string (same-origin relative paths)
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const win = window as any;
    if (win.__GULFHIVE_CONFIG__?.apiBaseUrl) {
      return win.__GULFHIVE_CONFIG__.apiBaseUrl.replace(/\/+$/, '');
    }
  }

  // Import meta env safely for Vite client runtime
  try {
    const env = (import.meta as any).env;
    if (env?.VITE_GULFHIVE_API_BASE_URL) {
      return env.VITE_GULFHIVE_API_BASE_URL.replace(/\/+$/, '');
    }
    if (env?.VITE_API_BASE_URL) {
      return env.VITE_API_BASE_URL.replace(/\/+$/, '');
    }
  } catch {
    // Non-vite context (e.g. Node / Vitest tests)
  }

  return '';
}

/**
 * Parse an HTTP response safely without crashing on non-JSON HTML/text error pages.
 */
export async function parseResponseSafely<T = any>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');

  if (isJson) {
    try {
      const data = await response.json();
      if (!response.ok) {
        const errorMsg = data?.error?.message || data?.error || data?.message || `Request failed with status ${response.status}`;
        const errorCode = data?.error?.code || data?.code || `HTTP_${response.status}`;
        throw new ApiError(errorMsg, response.status, errorCode, data);
      }
      return data as T;
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      // In case content-type said JSON but body was malformed
      throw new ApiError(
        'The server returned an invalid JSON response. Please check server logs and try again.',
        response.status,
        'MALFORMED_JSON'
      );
    }
  }

  // Handle non-JSON responses (HTML, plain text, proxy 404, hosting error pages)
  const rawText = await response.text();

  if (response.ok) {
    // If 200 OK with plain text, return as data object
    return { text: rawText } as any;
  }

  // Controlled, human-friendly error message for HTML/text error pages
  let userFriendlyMessage = `Unable to connect to the GulfHive server (Status ${response.status}).`;

  if (response.status === 404) {
    userFriendlyMessage = 'The requested GulfHive API endpoint could not be found. Please verify backend deployment and route configuration.';
  } else if (response.status >= 500) {
    userFriendlyMessage = 'The GulfHive backend encountered an internal error. Please check server logs and try again.';
  } else if (response.status === 401 || response.status === 403) {
    userFriendlyMessage = 'Access denied. You do not have permission to execute this operation.';
  }

  // Avoid leaking raw HTML markup to end users, but log technical details
  if (typeof console !== 'undefined' && console.warn) {
    console.warn(`[GulfHive API Client] Non-JSON response received from ${response.url} (Status: ${response.status}):`, rawText.slice(0, 300));
  }

  throw new ApiError(
    userFriendlyMessage,
    response.status,
    `HTTP_${response.status}_NON_JSON`,
    undefined,
    rawText
  );
}

/**
 * Authoritative API Client singleton
 */
export const apiClient = {
  getBaseUrl(): string {
    return getApiBaseUrl();
  },

  buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
    const base = getApiBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    let url = `${base}${cleanEndpoint}`;

    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }

    return url;
  },

  async request<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const { params, headers, ...restOptions } = options;
    const url = this.buildUrl(endpoint, params);

    const defaultHeaders: Record<string, string> = {
      'Accept': 'application/json',
      'X-Correlation-ID': `req_client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };

    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem('gulfhive_session_token') || localStorage.getItem('gulfhive_token') || localStorage.getItem('auth_token');
      if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    if (restOptions.body && !(restOptions.body instanceof FormData)) {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    const mergedHeaders = {
      ...defaultHeaders,
      ...headers,
    };

    try {
      const response = await fetch(url, {
        ...restOptions,
        headers: mergedHeaders,
      });

      if (response.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gulfhive:unauthorized', { detail: { status: 401, url } }));
      }

      return await parseResponseSafely<T>(response);
    } catch (error) {
      throw error;
    }
  },

  async get<T = any>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  },

  async post<T = any>(endpoint: string, body?: any, options?: ApiRequestOptions): Promise<T> {
    const bodyPayload = body && !(body instanceof FormData) ? JSON.stringify(body) : body;
    return this.request<T>(endpoint, { ...options, method: 'POST', body: bodyPayload });
  },

  async put<T = any>(endpoint: string, body?: any, options?: ApiRequestOptions): Promise<T> {
    const bodyPayload = body && !(body instanceof FormData) ? JSON.stringify(body) : body;
    return this.request<T>(endpoint, { ...options, method: 'PUT', body: bodyPayload });
  },

  async delete<T = any>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  },
};
