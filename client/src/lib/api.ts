import type {
  Benchmark,
  Crop,
  Message,
  Negotiation,
  Order,
  PricePreview,
  Receipt,
  Role,
  Unit,
  User,
} from './types';

export const API_BASE: string = import.meta.env.VITE_API_URL ?? '';
const DIRECT_FALLBACK = 'http://localhost:5000';

const TOKEN_KEY = 'khamari_token';
let token: string | null = localStorage.getItem(TOKEN_KEY);

export function getToken() {
  return token;
}
export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function req<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) {
    body = opts.body;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { method: opts.method ?? 'GET', headers, body });
    const ct = res.headers.get('content-type') || '';
    if (!API_BASE && (!ct.includes('application/json') || res.status === 404)) {
      res = await fetch(`${DIRECT_FALLBACK}${path}`, { method: opts.method ?? 'GET', headers, body });
    }
  } catch {
    if (!API_BASE) {
      try {
        res = await fetch(`${DIRECT_FALLBACK}${path}`, { method: opts.method ?? 'GET', headers, body });
      } catch {
        throw new ApiError('Cannot reach the Khamari server. Is it running?', 0);
      }
    } else {
      throw new ApiError('Cannot reach the Khamari server. Is it running?', 0);
    }
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new ApiError(json.error ?? res.statusText ?? 'Request failed', res.status);
  }
  return json.data as T;
}

function qs(params: Record<string, string | number | undefined>) {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return p.length
    ? '?' + p.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
    : '';
}

export interface RegisterInput {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  role: Exclude<Role, 'ADMIN'>;
  organization_name?: string;
  region: string;
}

export interface PublishPriceInput {
  crop_category: string;
  bazaar_region: string;
  unit: Unit;
  min_price: number;
  modal_price: number;
  max_price: number;
  market_notes?: string;
}

export const api = {
  login: (email: string, password: string) =>
    req<{ user: User; token: string }>('/api/auth/login', { method: 'POST', body: { email, password } }),
  register: (body: RegisterInput) =>
    req<{ user: User; token: string }>('/api/auth/register', { method: 'POST', body }),
  me: () => req<{ user: User }>('/api/auth/me'),

  benchmarks: () => req<Benchmark[]>('/api/bazaar-prices/latest'),
  publishPrice: (b: PublishPriceInput) =>
    req<Benchmark>('/api/bazaar-prices', { method: 'POST', body: b }),

  crops: (q: { farmerId?: number; status?: string; region?: string; search?: string } = {}) =>
    req<Crop[]>(`/api/crops${qs(q)}`),
  createCrop: (fd: FormData) => req<Crop>('/api/crops', { method: 'POST', body: fd }),
  updateCrop: (id: number, body: Record<string, unknown>) =>
    req<Crop>(`/api/crops/${id}`, { method: 'PATCH', body }),
  pricePreview: (cropId: number, body: { quantity: number; proposed_unit_price?: number; buyer_role?: string }) =>
    req<PricePreview>(`/api/crops/${cropId}/price-preview`, { method: 'POST', body }),

  negotiations: () => req<Negotiation[]>('/api/negotiations'),
  negotiation: (id: number) =>
    req<{ negotiation: Negotiation; messages: Message[] }>(`/api/negotiations/${id}`),
  startNegotiation: (body: {
    crop_id: number;
    requested_quantity: number;
    offered_unit_price: number;
    initial_message?: string;
  }) => req<{ negotiation: Negotiation; initialMessage: Message }>('/api/negotiations', { method: 'POST', body }),
  counterOffer: (id: number, body: { offered_unit_price: number; offered_quantity?: number; note?: string }) =>
    req<{ negotiation: Negotiation; message: Message }>(`/api/negotiations/${id}/offer`, {
      method: 'POST',
      body,
    }),
  sendMessage: (id: number, content: string) =>
    req<Message>(`/api/negotiations/${id}/messages`, { method: 'POST', body: { content } }),
  respond: (id: number, action: 'ACCEPT' | 'REJECT' | 'CANCEL') =>
    req<{ negotiation: Negotiation }>(`/api/negotiations/${id}/respond`, {
      method: 'PATCH',
      body: { action },
    }),

  orders: () => req<Order[]>('/api/orders'),
  receipt: (orderId: number) => req<Receipt>(`/api/orders/${orderId}/receipt`),
  orderFromNegotiation: (negotiationId: number, delivery_address: string) =>
    req<{ order: Order; receipt: Receipt }>(`/api/orders/from-negotiation/${negotiationId}`, {
      method: 'POST',
      body: { delivery_address },
    }),
  updateOrderStatus: (id: number, body: { order_status?: string; payment_status?: string }) =>
    req<Order>(`/api/orders/${id}/status`, { method: 'PATCH', body }),
};
