import { create } from 'zustand';
import { authenticatedFetch } from '../services/authenticatedFetch';
import { getApiBaseUrl } from '../util/apiConfig';

export type CrmCustomer = { id: string; name: string; phone?: string; sector?: string; notes?: string; pendingAmount: number; appointmentCount: number };
export type CrmAppointment = { id: string; providerCustomerId: string; category: string; description: string; scheduledAt: number; scheduledLabel: string; status: 'scheduled' | 'completed' | 'cancelled'; quotedAmount?: number; finalAmount?: number; customer: CrmCustomer | null };
type CrmState = { customers: CrmCustomer[]; appointments: CrmAppointment[]; loading: boolean;
  refresh: () => Promise<void>; addCustomer: (input: { name: string; phone?: string; sector?: string; notes?: string }) => Promise<CrmCustomer | null>;
  addAppointment: (input: Record<string, unknown>) => Promise<boolean>; closeAppointment: (id: string, status: 'completed' | 'cancelled') => Promise<boolean> };

export const useCrmStore = create<CrmState>((set, get) => ({
  customers: [], appointments: [], loading: false,
  refresh: async () => {
    set({ loading: true });
    try {
      const [customersResponse, appointmentsResponse] = await Promise.all([
        authenticatedFetch(`${getApiBaseUrl()}/api/provider/crm/customers`),
        authenticatedFetch(`${getApiBaseUrl()}/api/provider/crm/appointments`),
      ]);
      const customersBody = await customersResponse.json(); const appointmentsBody = await appointmentsResponse.json();
      if (customersResponse.ok && customersBody.success) set({ customers: customersBody.data });
      if (appointmentsResponse.ok && appointmentsBody.success) set({ appointments: appointmentsBody.data });
    } finally { set({ loading: false }); }
  },
  addCustomer: async (input) => {
    const response = await authenticatedFetch(`${getApiBaseUrl()}/api/provider/crm/customers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const body = await response.json(); if (!response.ok || !body.success) return null;
    await get().refresh(); return body.data;
  },
  addAppointment: async (input) => {
    const response = await authenticatedFetch(`${getApiBaseUrl()}/api/provider/crm/appointments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    if (!response.ok) return false; await get().refresh(); return true;
  },
  closeAppointment: async (id, status) => {
    const response = await authenticatedFetch(`${getApiBaseUrl()}/api/provider/crm/appointments/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (!response.ok) return false; await get().refresh(); return true;
  },
}));
