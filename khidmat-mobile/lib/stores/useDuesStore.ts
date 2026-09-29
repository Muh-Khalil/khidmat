import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './storageKeys';
import { getApiBaseUrl } from '../util/apiConfig';
import { authenticatedFetch } from '../services/authenticatedFetch';

export interface CustomerDue {
  id: string;
  customerName: string;
  customerPhone: string;
  serviceCategory: string;
  sector: string;
  amount: number;
  description: string;
  date: string;
  status: 'pending' | 'paid';
  createdAt: number;
}

interface DuesState {
  dues: CustomerDue[];
  isLoading: boolean;
  fetchDues: (providerId?: string) => Promise<void>;
  addDue: (due: Omit<CustomerDue, 'id' | 'createdAt'>, providerId?: string) => Promise<void>;
  markAsPaid: (id: string) => Promise<void>;
  deleteDue: (id: string) => Promise<void>;
  clearAllDues: () => void;
}


export const useDuesStore = create<DuesState>()(
  persist(
    (set, get) => ({
      dues: [],
      isLoading: false,

      fetchDues: async (_providerId?: string) => {
        set({ isLoading: true });
        try {
          const baseUrl = getApiBaseUrl();
          const res = await authenticatedFetch(`${baseUrl}/api/dues`);
          if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data?.dues)) {
              const mapped: CustomerDue[] = json.data.dues.map((d: any) => ({
                id: d.id,
                customerName: d.customerName || 'Customer',
                customerPhone: d.customerPhone || '',
                serviceCategory: d.serviceCategory || 'general',
                sector: d.sector || 'Islamabad',
                amount: Number(d.amount) || 0,
                description: d.notes || d.description || 'Service balance',
                date: d.dueDate || new Date(d.createdAt).toISOString().split('T')[0],
                status: d.status === 'paid' ? 'paid' : 'pending',
                createdAt: d.createdAt ? new Date(d.createdAt).getTime() : Date.now(),
              }));
              set({ dues: mapped });
            }
          }
        } catch (err) {
          console.warn('[useDuesStore] Error fetching dues from server, using local store:', err);
        } finally {
          set({ isLoading: false });
        }
      },

      addDue: async (newDueData, providerId = 'p_hvac_1') => {
        const tempId = `due_${Date.now()}`;
        const item: CustomerDue = {
          ...newDueData,
          id: tempId,
          createdAt: Date.now(),
        };
        // Optimistic update
        set((state) => ({
          dues: [item, ...state.dues],
        }));

        try {
          const baseUrl = getApiBaseUrl();
          const res = await authenticatedFetch(`${baseUrl}/api/dues`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              providerId,
              customerName: item.customerName,
              customerPhone: item.customerPhone,
              serviceCategory: item.serviceCategory,
              amount: item.amount,
              dueDate: item.date,
              notes: item.description,
            }),
          });
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data?.id) {
              // Update optimistic item with real server ID
              set((state) => ({
                dues: state.dues.map((d) => (d.id === tempId ? { ...d, id: json.data.id } : d)),
              }));
            }
          }
        } catch (err) {
          console.warn('[useDuesStore] Error syncing added due to server:', err);
        }
      },

      markAsPaid: async (id) => {
        // Optimistic update
        set((state) => ({
          dues: state.dues.map((d) => (d.id === id ? { ...d, status: 'paid' } : d)),
        }));

        try {
          const baseUrl = getApiBaseUrl();
          await authenticatedFetch(`${baseUrl}/api/dues/${encodeURIComponent(id)}/pay`, {
            method: 'PATCH',
          });
        } catch (err) {
          console.warn('[useDuesStore] Error syncing markAsPaid to server:', err);
        }
      },

      deleteDue: async (id) => {
        // Optimistic update
        set((state) => ({
          dues: state.dues.filter((d) => d.id !== id),
        }));

        try {
          const baseUrl = getApiBaseUrl();
          await authenticatedFetch(`${baseUrl}/api/dues/${encodeURIComponent(id)}`, {
            method: 'DELETE',
          });
        } catch (err) {
          console.warn('[useDuesStore] Error syncing deleteDue to server:', err);
        }
      },

      clearAllDues: () => set({ dues: [] }),
    }),
    {
      name: STORAGE_KEYS.dues,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
