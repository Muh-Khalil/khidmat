import { create } from 'zustand';
import { authenticatedFetch } from '../services/authenticatedFetch';
import { getApiBaseUrl } from '../util/apiConfig';
import type { ServiceCategory } from '../mock/providers';

export type ServiceRequest = {
  id: string;
  category: ServiceCategory;
  issueDescription: string;
  urgency: 'low' | 'medium' | 'urgent';
  sector: string;
  requestedStartAt: number;
  requestedTimeLabel: string;
  status: 'collecting_responses' | 'ready_to_choose' | 'booked' | 'cancelled' | 'expired';
  responseCount?: number;
  createdAt: string;
};

export type ProviderOffer = {
  id: string;
  providerId: string;
  proposedStartAt?: number;
  proposedTimeLabel?: string;
  amount?: number;
  priceType?: 'visit_fee' | 'estimate' | 'fixed_quote';
  message?: string;
  provider: { id: string; name: string; rating: number; totalJobs: number; sector: string } | null;
};

type RequestsState = {
  requests: ServiceRequest[];
  offers: ProviderOffer[];
  isLoading: boolean;
  fetchRequests: () => Promise<void>;
  createRequest: (input: Omit<ServiceRequest, 'id' | 'status' | 'createdAt' | 'responseCount'> & { location: { lat: number; lng: number } }) => Promise<string | null>;
  fetchRequest: (id: string) => Promise<ServiceRequest | null>;
  acceptOffer: (requestId: string, responseId: string) => Promise<string | null>;
};

export const useRequestsStore = create<RequestsState>((set) => ({
  requests: [], offers: [], isLoading: false,
  createRequest: async (input) => {
    const response = await authenticatedFetch(`${getApiBaseUrl()}/api/requests`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    });
    const body = await response.json();
    if (!response.ok || !body.success) return null;
    const request = { ...body.data.request, responseCount: 0 };
    set((state) => ({ requests: [request, ...state.requests] }));
    return request.id;
  },
  fetchRequests: async () => {
    set({ isLoading: true });
    try {
      const response = await authenticatedFetch(`${getApiBaseUrl()}/api/requests`);
      const body = await response.json();
      if (response.ok && body.success) set({ requests: body.data });
    } finally { set({ isLoading: false }); }
  },
  fetchRequest: async (id) => {
    set({ isLoading: true });
    try {
      const response = await authenticatedFetch(`${getApiBaseUrl()}/api/requests/${encodeURIComponent(id)}`);
      const body = await response.json();
      if (!response.ok || !body.success) return null;
      set({ offers: body.data.offers });
      return body.data.request;
    } finally { set({ isLoading: false }); }
  },
  acceptOffer: async (requestId, responseId) => {
    const response = await authenticatedFetch(
      `${getApiBaseUrl()}/api/requests/${encodeURIComponent(requestId)}/responses/${encodeURIComponent(responseId)}/accept`,
      { method: 'POST' },
    );
    const body = await response.json();
    if (!response.ok || !body.success) return null;
    set((state) => ({ requests: state.requests.map((item) => item.id === requestId ? { ...item, status: 'booked' } : item) }));
    return body.data.id;
  },
}));
