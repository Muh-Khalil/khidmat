import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ServiceCategory } from '../mock/providers';
import type { AgentEvent } from '../agent/types';
import { STORAGE_KEYS } from './storageKeys';
import { getApiBaseUrl } from '../util/apiConfig';
import { authenticatedFetch } from '../services/authenticatedFetch';

/** Lifecycle states a booking can be in. */
export type BookingStatus = 'pending' | 'confirmed' | 'on_the_way' | 'reminded' | 'completed' | 'cancelled';

export type Booking = {
  id: string;
  providerId: string;
  providerName: string;
  category: ServiceCategory;
  sector: string;
  scheduledFor: string; // 'Tomorrow, 10:00 AM'
  scheduledTimestamp: number;
  status: BookingStatus;
  reminderAt: string;
  agentThread: AgentEvent[]; // preserved events from the conversation
  createdAt: number;
};

type BookingsState = {
  bookings: Booking[];
  isLoading: boolean;
  fetchBookings: (customerId?: string) => Promise<void>;
  addBooking: (booking: Booking) => void;
  updateStatus: (id: string, status: BookingStatus) => void;
  cancel: (id: string) => void;
  clear: () => void;
};

export const useBookingsStore = create<BookingsState>()(
  persist(
    (set, get) => ({
      bookings: [],
      isLoading: false,

      fetchBookings: async (customerId = 'usr_demo_customer') => {
        set({ isLoading: true });
        try {
          const baseUrl = getApiBaseUrl();
          const res = await authenticatedFetch(`${baseUrl}/api/bookings`);
          if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data) && json.data.length > 0) {
              const mapped: Booking[] = json.data.map((j: any) => ({
                id: j.id,
                providerId: j.providerId || 'p_unknown',
                providerName: j.providerName || 'Provider',
                category: j.category || 'general',
                sector: j.sector || 'Islamabad',
                scheduledFor: j.scheduledFor || 'Today, ASAP',
                scheduledTimestamp: j.scheduledTimestamp || Date.now(),
                status:
                  j.status === 'dispatched' || j.status === 'matched' || j.status === 'requested'
                    ? 'pending'
                    : j.status === 'on_the_way'
                    ? 'on_the_way'
                    : j.status === 'accepted' || j.status === 'in_progress'
                    ? 'confirmed'
                    : j.status === 'completed'
                    ? 'completed'
                    : j.status === 'declined' || j.status === 'cancelled'
                    ? 'cancelled'
                    : 'confirmed',
                reminderAt: '1 hour before',
                agentThread: [],
                createdAt: j.createdAt ? new Date(j.createdAt).getTime() : Date.now(),
              }));
              set({ bookings: mapped });
            }
          }
        } catch (err) {
          console.warn('[useBookingsStore] Error syncing bookings from server:', err);
        } finally {
          set({ isLoading: false });
        }
      },

      addBooking: (booking: Booking) =>
        set((state) => ({ bookings: [booking, ...state.bookings] })),
      updateStatus: (id, status) => {
        set((state) => ({
          bookings: state.bookings.map((b) =>
            b.id === id ? { ...b, status } : b,
          ),
        }));

        // Fire-and-forget sync to backend
        try {
          const baseUrl = getApiBaseUrl();
          const serverStatus = status === 'confirmed' ? 'accepted' : status === 'cancelled' ? 'cancelled' : status;
          authenticatedFetch(`${baseUrl}/api/jobs/${encodeURIComponent(id)}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: serverStatus }),
          }).catch(() => {});
        } catch {}
      },
      // Cancelling is just a status transition — reuse updateStatus so the
      // update logic lives in one place.
      cancel: (id) => get().updateStatus(id, 'cancelled'),
      clear: () => set({ bookings: [] }),
    }),
    {
      name: STORAGE_KEYS.bookings,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
