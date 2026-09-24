import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './storageKeys';
import { DEFAULT_SECTOR } from '../mock/providers';

type SettingsState = {
  defaultLocation: string;
  setDefaultLocation: (location: string) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultLocation: DEFAULT_SECTOR,
      setDefaultLocation: (location: string) =>
        set({ defaultLocation: location }),
    }),
    {
      name: STORAGE_KEYS.settings,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
