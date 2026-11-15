export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function api<T = any>(path: string, body?: unknown, method?: string): Promise<T> {
  let r: Response;
  try {
    r = await fetch(path, {
      method: method || (body !== undefined ? 'POST' : 'GET'),
      headers: body !== undefined ? { 'content-type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin'
    });
  } catch {
    throw new ApiError('Sunucuya ulaşılamıyor. İnternet bağlantınızı kontrol edin.', 0);
  }
  let j: any = {};
  try { j = await r.json(); } catch { /* non-JSON (e.g. proxy error page) */ }
  if (!r.ok) {
    if (r.status === 401 && !path.startsWith('/api/auth/')) window.dispatchEvent(new Event('crm-unauthorized'));
    throw new ApiError(j.error || (r.status >= 500 ? 'Sunucu şu an yanıt vermiyor.' : `Hata (${r.status})`), r.status);
  }
  return j as T;
}
