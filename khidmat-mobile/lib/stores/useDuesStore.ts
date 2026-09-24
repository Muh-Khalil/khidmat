import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './storageKeys';

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
  addDue: (due: Omit<CustomerDue, 'id' | 'createdAt'>) => void;
  markAsPaid: (id: string) => void;
  deleteDue: (id: string) => void;
  clearAllDues: () => void;
}

const INITIAL_DEMO_DUES: CustomerDue[] = [
  {
    id: 'due_101',
    customerName: 'Ahmed Hassan',
    customerPhone: '+92 300 1234567',
    serviceCategory: 'hvac',
    sector: 'F-7',
    amount: 2500,
    description: 'AC Gas Refill & Outdoor Unit Cleaning',
    date: '2026-08-22',
    status: 'pending',
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'due_102',
    customerName: 'Bilal Khan',
    customerPhone: '+92 313 5558899',
    serviceCategory: 'electrician',
    sector: 'G-11',
    amount: 1200,
    description: 'Main Distribution Board Wiring & Breaker Switch',
    date: '2026-08-20',
    status: 'pending',
    createdAt: Date.now() - 86400000 * 5,
  },
  {
    id: 'due_103',
    customerName: 'Usman Ali',
    customerPhone: '+92 321 4443322',
    serviceCategory: 'plumber',
    sector: 'F-10',
    amount: 800,
    description: 'Bathroom Leakage Repair & Valve Replacement',
    date: '2026-08-15',
    status: 'paid',
    createdAt: Date.now() - 86400000 * 10,
  },
];

export const useDuesStore = create<DuesState>()(
  persist(
    (set) => ({
      dues: INITIAL_DEMO_DUES,

      addDue: (newDueData) => {
        const item: CustomerDue = {
          ...newDueData,
          id: `due_${Date.now()}`,
          createdAt: Date.now(),
        };
        set((state) => ({
          dues: [item, ...state.dues],
        }));
      },

      markAsPaid: (id) => {
        set((state) => ({
          dues: state.dues.map((d) =>
            d.id === id ? { ...d, status: 'paid' } : d,
          ),
        }));
      },

      deleteDue: (id) => {
        set((state) => ({
          dues: state.dues.filter((d) => d.id !== id),
        }));
      },

      clearAllDues: () => set({ dues: [] }),
    }),
    {
      name: STORAGE_KEYS.dues,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
