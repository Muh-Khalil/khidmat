import * as Location from 'expo-location';
import type { Coordinates } from '../stores/useAuthStore';

export interface LocationDetectionResult {
  success: boolean;
  coordinates?: Coordinates;
  formattedAddress?: string;
  city?: string;
  district?: string;
  region?: string;
  error?: 'SERVICES_DISABLED' | 'PERMISSION_DENIED' | 'FETCH_FAILED';
  message?: string;
}

/**
 * Checks GPS service, requests foreground permission, fetches current GPS coordinates,
 * and performs reverse-geocoding to produce a clean human-readable city/area.
 *
 * Adheres to HCI and safety rules:
 * - Checks if device location services (GPS) are turned on without attempting to force-enable.
 * - Prompts for foreground location permissions cleanly.
 * - Extracts exact { latitude, longitude } for PostGIS spatial matching.
 * - Reverse-geocodes into user-friendly Pakistani city/area strings (e.g. "Mardan, Khyber Pakhtunkhwa" or "Sector F-7, Islamabad").
 */
export async function getCurrentUserLocation(): Promise<LocationDetectionResult> {
  try {
    // 1. Check if device location services (GPS) are enabled
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      return {
        success: false,
        error: 'SERVICES_DISABLED',
        message:
          'Location services (GPS) are turned off. Please turn on Location in your device settings to detect your current area.',
      };
    }

    // 2. Request foreground location permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return {
        success: false,
        error: 'PERMISSION_DENIED',
        message:
          'Location permission was not granted. Please allow location access in your device settings to automatically find nearby verified providers.',
      };
    }

    // 3. Obtain current GPS position with balanced accuracy
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const { latitude, longitude } = location.coords;
    const coordinates: Coordinates = { latitude, longitude };

    // 4. Reverse geocode coordinates to human-readable address/city
    let formattedAddress = '';
    let detectedCity = '';
    let detectedDistrict = '';
    let detectedRegion = '';

    try {
      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (addresses && addresses.length > 0) {
        const addr = addresses[0];
        detectedCity = addr.city || addr.subregion || '';
        detectedDistrict = addr.district || addr.name || addr.street || '';
        detectedRegion = addr.region || '';

        // Clean up formatting for Pakistan:
        // E.g. "Mardan, Khyber Pakhtunkhwa" or "Sector F-7, Islamabad" or "Saddar, Rawalpindi"
        const parts: string[] = [];

        // Check if district/subregion looks like a known Islamabad sector (e.g. F-7, G-11, etc.)
        if (detectedDistrict && detectedDistrict !== detectedCity) {
          parts.push(detectedDistrict);
        }

        if (detectedCity) {
          parts.push(detectedCity);
        }

        if (detectedRegion && detectedRegion !== detectedCity && detectedRegion !== detectedDistrict) {
          parts.push(detectedRegion);
        }

        formattedAddress = parts.join(', ');
      }
    } catch (geoError) {
      console.warn('[locationService] Reverse geocode non-fatal error:', geoError);
    }

    // Fallback if reverse geocoding returns empty
    if (!formattedAddress) {
      formattedAddress = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }

    return {
      success: true,
      coordinates,
      formattedAddress,
      city: detectedCity,
      district: detectedDistrict,
      region: detectedRegion,
    };
  } catch (err: any) {
    console.error('[locationService] Failed to retrieve current location:', err);
    return {
      success: false,
      error: 'FETCH_FAILED',
      message:
        err.message ||
        'Could not obtain location from device GPS. Please check your connection or choose your area manually.',
    };
  }
}
