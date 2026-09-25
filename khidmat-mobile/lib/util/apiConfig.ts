import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Returns the active backend API base URL.
 * Automatically handles:
 * 1. Explicit EXPO_PUBLIC_API_BASE_URL environment variable (if set).
 * 2. Web browser: uses window.location.hostname:5000.
 * 3. Physical mobile devices via Expo Go: automatically resolves the development PC's
 *    LAN IP address (e.g. 192.168.1.X:5000) from Constants.expoConfig.hostUri.
 * 4. Emulator / Fallback: defaults to http://localhost:5000.
 */
export function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL.replace(/\/$/, '');
  }

  // Web environment
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:5000`;
  }

  // Physical Android / iOS device running via Expo Go
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any).manifest?.debuggerHost;

  if (hostUri && typeof hostUri === 'string') {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5000`;
    }
  }

  // Android emulator loopback or default localhost
  if (Platform.OS === 'android') {
    // 10.0.2.2 is Android emulator host loopback, but if on Expo Go hostUri handles it
    return 'http://10.0.2.2:5000';
  }

  return 'http://localhost:5000';
}
