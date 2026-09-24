import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './storageKeys';

export type UserRole = 'customer' | 'provider';

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  sector?: string;
  avatarUrl?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (userData: Partial<User>) => void;
  signup: (userData: { name: string; phone: string; email?: string; role: UserRole; sector?: string }) => void;
  logout: () => void;
  updateProfile: (userData: Partial<User>) => void;
}

const DEFAULT_DEMO_USER: User = {
  id: 'usr_demo_101',
  name: 'Ahmed Hassan',
  phone: '+92 300 1234567',
  email: 'ahmed.hassan@example.com',
  role: 'customer',
  sector: 'F-7',
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: DEFAULT_DEMO_USER,
      token: 'demo-jwt-token-khidmat-2026',
      isAuthenticated: true,

      login: (userData) => {
        const fullUser: User = {
          id: userData.id || `usr_${Date.now()}`,
          name: userData.name || 'User',
          phone: userData.phone || '+92 300 0000000',
          email: userData.email || 'user@khidmat.pk',
          role: userData.role || 'customer',
          sector: userData.sector || 'F-7',
        };
        set({
          user: fullUser,
          token: `token_${Date.now()}`,
          isAuthenticated: true,
        });
      },

      signup: (userData) => {
        const newUser: User = {
          id: `usr_${Date.now()}`,
          name: userData.name,
          phone: userData.phone,
          email: userData.email || '',
          role: userData.role,
          sector: userData.sector || 'F-7',
        };
        set({
          user: newUser,
          token: `token_${Date.now()}`,
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      updateProfile: (updatedData) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updatedData } : null,
        }));
      },
    }),
    {
      name: STORAGE_KEYS.auth,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
