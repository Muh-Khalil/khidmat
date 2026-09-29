import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './storageKeys';
import { getApiBaseUrl } from '../util/apiConfig';
import { useDuesStore } from './useDuesStore';

export type UserRole = 'customer' | 'provider';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  sector?: string;
  coordinates?: Coordinates;
  avatarUrl?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;

  setIsHydrated: (hydrated: boolean) => void;
  login: (params: {
    phone: string;
    password?: string;
    role?: UserRole;
    id?: string;
    name?: string;
    email?: string;
    sector?: string;
    coordinates?: Coordinates;
  }) => Promise<User | null>;
  signup: (userData: {
    name: string;
    phone: string;
    email?: string;
    password?: string;
    role: UserRole;
    sector?: string;
    coordinates?: Coordinates;
    phoneVerificationToken: string;
  }) => Promise<User | null>;
  logout: () => void;
  updateProfile: (userData: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isHydrated: false,
      isLoading: false,
      error: null,

      setIsHydrated: (isHydrated) => set({ isHydrated }),

      login: async (params) => {
        set({ isLoading: true, error: null });
        const cleanPhone = params.phone.replace(/[^0-9]/g, '');
        const formattedPhone = cleanPhone.startsWith('92')
          ? `+${cleanPhone}`
          : cleanPhone.startsWith('0')
          ? `+92${cleanPhone.slice(1)}`
          : `+92${cleanPhone}`;

        const baseUrl = getApiBaseUrl();

        try {
          const res = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: formattedPhone,
              password: params.password,
              role: params.role,
            }),
          });

          const json = await res.json();
          if (res.ok) {
            if (json.success && json.data?.user) {
              const backendUser = json.data.user;
              const userObj: User = {
                id: backendUser.id,
                name: backendUser.name || params.name || 'User',
                phone: backendUser.phone || formattedPhone,
                email: backendUser.email || '',
                role: (backendUser.role as UserRole) || params.role || 'customer',
                sector: backendUser.sector || params.sector || 'G-11',
                coordinates: params.coordinates,
                avatarUrl: backendUser.avatar_url,
              };

              set({
                user: userObj,
                token: json.data.token || `token_${Date.now()}`,
                isAuthenticated: true,
                isLoading: false,
                error: null,
              });
              return userObj;
            }
          }
          throw new Error(json.message || 'Login failed');
        } catch (apiErr) {
          const message = apiErr instanceof Error ? apiErr.message : 'Login failed';
          set({ isLoading: false, error: message, isAuthenticated: false, token: null });
          throw apiErr;
        }
      },

      signup: async (userData) => {
        set({ isLoading: true, error: null });
        const cleanPhone = userData.phone.replace(/[^0-9]/g, '');
        const formattedPhone = cleanPhone.startsWith('92')
          ? `+${cleanPhone}`
          : cleanPhone.startsWith('0')
          ? `+92${cleanPhone.slice(1)}`
          : `+92${cleanPhone}`;

        const baseUrl = getApiBaseUrl();

        try {
          const res = await fetch(`${baseUrl}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: userData.name,
              phone: formattedPhone,
              email: userData.email,
              password: userData.password,
              phoneVerificationToken: userData.phoneVerificationToken,
              role: userData.role,
              sector: userData.sector,
            }),
          });

          const json = await res.json();
          if (res.ok) {
            if (json.success && json.data?.user) {
              const backendUser = json.data.user;
              const userObj: User = {
                id: backendUser.id,
                name: backendUser.name,
                phone: backendUser.phone,
                email: backendUser.email || '',
                role: backendUser.role as UserRole,
                sector: backendUser.sector || userData.sector || 'G-11',
                coordinates: userData.coordinates,
              };

              set({
                user: userObj,
                token: json.data.token || `token_${Date.now()}`,
                isAuthenticated: true,
                isLoading: false,
                error: null,
              });
              return userObj;
            }
          }
          throw new Error(json.message || 'Registration failed');
        } catch (apiErr) {
          const message = apiErr instanceof Error ? apiErr.message : 'Registration failed';
          set({ isLoading: false, error: message, isAuthenticated: false, token: null });
          throw apiErr;
        }
      },

      logout: () => {
        try {
          useDuesStore.getState().clearAllDues();
        } catch {
          // Ignore if dues store uninitialized
        }
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
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
      onRehydrateStorage: () => (state) => {
        state?.setIsHydrated(true);
      },
    },
  ),
);
