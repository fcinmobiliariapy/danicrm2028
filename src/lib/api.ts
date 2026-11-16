const TOKEN_STORAGE_KEY = 'crm_politico_token';

export function getAuthToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage restriction
  }
}

export async function apiFetch<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = typeof data === 'object' && data && 'error' in data ? String((data as { error: string }).error) : `Error HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data as T;
}

export function formatDisplayDate(dateStr?: string | null, format: 'DD/MM/YYYY' | 'YYYY-MM-DD' = 'DD/MM/YYYY'): string {
  if (!dateStr) return '—';
  const clean = dateStr.slice(0, 10);
  if (format === 'YYYY-MM-DD') return clean;
  const parts = clean.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatNumber(n: number | string | null | undefined): string {
  const num = Number(n || 0);
  return new Intl.NumberFormat('es-PY').format(num);
}
