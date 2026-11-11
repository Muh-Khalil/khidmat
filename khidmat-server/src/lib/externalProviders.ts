import * as crypto from 'crypto';
import { env } from '../config/env';
import { ServiceCategory } from '../data/providers';

export type ExternalProviderListing = {
  kind: 'external';
  source: 'google_places';
  externalId: string;
  name: string;
  category: ServiceCategory;
  address: string;
  location: { lat: number; lng: number };
  phone?: string;
  sourceRating?: number;
  sourceRatingCount?: number;
  sourceUrl?: string;
  disclosure: 'External Listing / Not Yet on Khidmat';
  attribution: 'Google Maps';
};

export interface ExternalProviderSource {
  search(input: { category: ServiceCategory; location: { lat: number; lng: number }; radiusMeters: number }): Promise<ExternalProviderListing[]>;
  getById(externalId: string, category: ServiceCategory): Promise<ExternalProviderListing | null>;
}

const CATEGORY_QUERY: Record<ServiceCategory, string> = {
  ac: 'AC repair service', plumber: 'plumber', electrician: 'electrician', tutor: 'home tutor', beautician: 'beautician home service',
};

class DisabledExternalProviderSource implements ExternalProviderSource {
  async search() { return []; }
  async getById() { return null; }
}

class GooglePlacesProviderSource implements ExternalProviderSource {
  constructor(private apiKey: string) {}

  private map(place: any, category: ServiceCategory): ExternalProviderListing | null {
    if (!place?.id || !place?.displayName?.text || !place?.location) return null;
    return { kind: 'external', source: 'google_places', externalId: place.id, name: place.displayName.text,
      category, address: place.formattedAddress || '',
      location: { lat: place.location.latitude, lng: place.location.longitude },
      phone: place.nationalPhoneNumber || undefined, sourceRating: place.rating || undefined,
      sourceRatingCount: place.userRatingCount || undefined, sourceUrl: place.googleMapsUri || undefined,
      disclosure: 'External Listing / Not Yet on Khidmat', attribution: 'Google Maps' };
  }

  async search(input: { category: ServiceCategory; location: { lat: number; lng: number }; radiusMeters: number }) {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.googleMapsUri' },
      body: JSON.stringify({ textQuery: CATEGORY_QUERY[input.category], maxResultCount: 8,
        includePureServiceAreaBusinesses: true,
        locationBias: { circle: { center: { latitude: input.location.lat, longitude: input.location.lng }, radius: Math.min(input.radiusMeters, 50_000) } } }),
    });
    if (!response.ok) throw new Error(`EXTERNAL_SOURCE_${response.status}`);
    const body: any = await response.json();
    return (body.places || []).map((place: any) => this.map(place, input.category)).filter(Boolean);
  }

  async getById(externalId: string, category: ServiceCategory) {
    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(externalId)}`, {
      headers: { 'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,nationalPhoneNumber,rating,userRatingCount,googleMapsUri' },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`EXTERNAL_SOURCE_${response.status}`);
    return this.map(await response.json(), category);
  }
}

export const externalProviderSource: ExternalProviderSource = env.GOOGLE_PLACES_API_KEY
  ? new GooglePlacesProviderSource(env.GOOGLE_PLACES_API_KEY)
  : new DisabledExternalProviderSource();

type ClaimProof = { source: 'google_places'; externalId: string; category: ServiceCategory; exp: number };
export function createClaimProof(input: Omit<ClaimProof, 'exp'>): string {
  const payload = Buffer.from(JSON.stringify({ ...input, exp: Date.now() + 10 * 60_000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', env.AUTH_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyClaimProof(token: string): ClaimProof | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', env.AUTH_SECRET).update(payload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try { const proof = JSON.parse(Buffer.from(payload, 'base64url').toString()) as ClaimProof; return proof.exp > Date.now() ? proof : null; }
  catch { return null; }
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length < 4 ? '••••' : `••••••${digits.slice(-4)}`;
}
