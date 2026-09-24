import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ServiceCategory } from '../mock/providers';
import type { AgentEvent } from '../agent/types';
import { STORAGE_KEYS } from './storageKeys';

/** Lifecycle states a booking can be in. */
export type BookingStatus = 'confirmed' | 'reminded' | 'completed' | 'cancelled';

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
  addBooking: (booking: Booking) => void;
  updateStatus: (id: string, status: BookingStatus) => void;
  cancel: (id: string) => void;
  clear: () => void;
};

export const useBookingsStore = create<BookingsState>()(
  persist(
    (set, get) => ({
      bookings: [],
      addBooking: (booking: Booking) =>
        set((state) => ({ bookings: [booking, ...state.bookings] })),
      updateStatus: (id, status) =>
        set((state) => ({
          bookings: state.bookings.map((b) =>
            b.id === id ? { ...b, status } : b,
          ),
        })),
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
