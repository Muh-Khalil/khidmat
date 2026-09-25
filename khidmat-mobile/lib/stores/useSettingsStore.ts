import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './storageKeys';
import { DEFAULT_SECTOR } from '../mock/providers';
import type { Coordinates } from './useAuthStore';

type SettingsState = {
  defaultLocation: string;
  userCoordinates: Coordinates | null;
  setDefaultLocation: (location: string) => void;
  setUserCoordinates: (coords: Coordinates | null) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultLocation: DEFAULT_SECTOR,
      userCoordinates: {
        latitude: 33.7215,
        longitude: 73.0538,
      },
      setDefaultLocation: (location: string) =>
        set({ defaultLocation: location }),
      setUserCoordinates: (coords: Coordinates | null) =>
        set({ userCoordinates: coords }),
    }),
    {
      name: STORAGE_KEYS.settings,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
