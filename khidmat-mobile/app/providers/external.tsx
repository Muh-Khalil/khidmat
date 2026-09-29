import React, { useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { authenticatedFetch } from '@/lib/services/authenticatedFetch';
import { getApiBaseUrl } from '@/lib/util/apiConfig';
import { useSettingsStore } from '@/lib/stores/useSettingsStore';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { toast } from '@/lib/stores/useToastStore';
import { colors } from '@/lib/theme/colors';

type Category = 'ac' | 'plumber' | 'electrician' | 'tutor' | 'beautician';
type Listing = { externalId: string; name: string; category: Category; address: string; phone?: string; sourceRating?: number; sourceRatingCount?: number; sourceUrl?: string; disclosure: string; attribution: string };
const CATEGORIES: { id: Category; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'plumber', label: 'Plumber', icon: 'water' }, { id: 'electrician', label: 'Electrician', icon: 'flash' },
  { id: 'ac', label: 'AC Repair', icon: 'snow' }, { id: 'tutor', label: 'Tutor', icon: 'school' },
  { id: 'beautician', label: 'Beautician', icon: 'cut' },
];

export default function ExternalProvidersScreen() {
  const router = useRouter();
  const coordinates = useSettingsStore((state) => state.userCoordinates);
  const user = useAuthStore((state) => state.user);
  const [category, setCategory] = useState<Category>('plumber');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [claim, setClaim] = useState<{ listing: Listing; token: string; phone: string } | null>(null);
  const [code, setCode] = useState('');

  const search = async (next = category) => {
    setCategory(next); setLoading(true);
    const lat = coordinates?.latitude ?? 33.684; const lng = coordinates?.longitude ?? 73.048;
    try {
      const response = await authenticatedFetch(`${getApiBaseUrl()}/api/external-providers/discover?category=${next}&lat=${lat}&lng=${lng}&radiusMeters=15000`);
      const body = await response.json(); setListings(response.ok && body.success ? body.data.listings : []);
      if (!response.ok) toast.error('Search nahi hui', body.message || 'Dobara koshish karein.');
    } finally { setLoading(false); }
  };
  const startClaim = async (listing: Listing) => {
    const response = await authenticatedFetch(`${getApiBaseUrl()}/api/external-providers/claims/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'google_places', externalId: listing.externalId, category: listing.category }) });
    const body = await response.json();
    if (!response.ok) return toast.error('Claim shuru nahi hua', body.message);
    setClaim({ listing, token: body.data.claimToken, phone: body.data.phone });
  };
  const finishClaim = async () => {
    if (!claim) return;
    const response = await authenticatedFetch(`${getApiBaseUrl()}/api/external-providers/claims/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claimToken: claim.token, code }) });
    const body = await response.json();
    if (!response.ok) return toast.error('Code qabool nahi hua', body.message);
    setClaim(null); setCode(''); toast.success('Business verify ho gaya', 'Profile mukammal karke online ho sakte hain.'); router.back();
  };

  const openWhatsApp = (phone: string, name: string) => {
    const clean = phone.replace(/[^0-9]/g, '');
    const formatted = clean.startsWith('92') ? clean : clean.startsWith('0') ? `92${clean.slice(1)}` : `92${clean}`;
    const text = encodeURIComponent(`Salam ${name}, mujhe aap ki service ke silsilay mein rabta karna hai.`);
    Linking.openURL(`whatsapp://send?phone=${formatted}&text=${text}`).catch(() => {
      Linking.openURL(`https://wa.me/${formatted}?text=${text}`);
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3">
        <Pressable onPress={() => router.back()} className="h-11 w-11 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200">
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>
        <View className="ml-3 flex-1">
          <Text className="text-lg font-black text-gray-900">Bahir ke Karigar</Text>
          <Text className="text-xs text-gray-500">Google Maps ki public directory</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        <View className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <View className="flex-row items-center">
            <Ionicons name="information-circle" size={20} color="#1D4ED8" />
            <Text className="ml-2 font-black text-blue-900">Zaroori Baat</Text>
          </View>
          <Text className="mt-1 text-xs leading-5 text-blue-800">
            Yeh karigar Khidmat ke bahar se dhoonday gaye hain. Aap direct Call ya WhatsApp par voice note bhej kar rate tay kar sakte hain.
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="my-4">
          {CATEGORIES.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => search(item.id)}
              className={`mr-2.5 flex-row items-center rounded-2xl border px-4 py-3 ${
                category === item.id ? 'border-primary bg-orange-50' : 'border-gray-200 bg-white'
              }`}
            >
              <Ionicons name={item.icon} size={18} color={category === item.id ? colors.primary : colors.gray500} />
              <Text className={`ml-2 font-bold ${category === item.id ? 'text-primary' : 'text-gray-700'}`}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {!loading && listings.length === 0 && (
          <Pressable onPress={() => search()} className="items-center rounded-3xl bg-white p-8 border border-gray-100 shadow-sm">
            <Ionicons name="search-circle" size={60} color={colors.primary} />
            <Text className="mt-3 text-lg font-black text-gray-900">Qareebi Karigar Dhoondein</Text>
            <Text className="mt-1 text-center text-sm text-gray-500">Apni category chunain aur search dabayein</Text>
            <View className="mt-5 rounded-2xl bg-primary px-8 py-3.5 shadow-md">
              <Text className="font-black text-white">🔍 Search Karein</Text>
            </View>
          </Pressable>
        )}

        {loading && <ActivityIndicator className="mt-10" color={colors.primary} size="large" />}

        {listings.map((listing) => (
          <View key={listing.externalId} className="mb-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <View className="self-start rounded-full bg-amber-100 px-3 py-1">
              <Text className="text-[11px] font-black text-amber-800">BAHIR KI LISTING • DIRECT CONTACT</Text>
            </View>
            <Text className="mt-3 text-lg font-black text-gray-900">{listing.name}</Text>
            <Text className="mt-1 text-xs text-gray-500">📍 {listing.address}</Text>
            {listing.sourceRating && (
              <Text className="mt-2 text-xs font-bold text-gray-700">
                ⭐ {listing.sourceRating} ({listing.sourceRatingCount || 0}) • Google Maps
              </Text>
            )}

            {/* 1-Tap Call & WhatsApp Action Buttons */}
            <View className="mt-4 flex-row gap-2.5">
              {listing.phone && (
                <>
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${listing.phone}`)}
                    className="h-12 flex-1 flex-row items-center justify-center rounded-2xl bg-primary active:opacity-90"
                  >
                    <Ionicons name="call" size={18} color="white" />
                    <Text className="ml-2 font-black text-white">Call Karein</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => openWhatsApp(listing.phone!, listing.name)}
                    className="h-12 flex-1 flex-row items-center justify-center rounded-2xl bg-green-600 active:opacity-90"
                  >
                    <Ionicons name="logo-whatsapp" size={19} color="white" />
                    <Text className="ml-2 font-black text-white">WhatsApp</Text>
                  </Pressable>
                </>
              )}
            </View>

            {user?.role === 'provider' && (
              <Pressable
                onPress={() => startClaim(listing)}
                className="mt-3 h-11 items-center justify-center rounded-2xl border border-orange-300 bg-orange-50 active:bg-orange-100"
              >
                <Text className="font-black text-orange-700">🏢 Yeh mera business hai (Claim)</Text>
              </Pressable>
            )}

            {listing.sourceUrl && (
              <Pressable onPress={() => Linking.openURL(listing.sourceUrl!)}>
                <Text className="mt-3 text-center text-xs font-semibold text-blue-600">Maps par dekhein</Text>
              </Pressable>
            )}
          </View>
        ))}
        <View className="h-10" />
      </ScrollView>

      {/* Claim Modal with 1-tap OTP verification */}
      <Modal visible={!!claim} transparent animationType="slide" onRequestClose={() => setClaim(null)}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="rounded-t-[32px] bg-white p-6">
            <Text className="text-xl font-black text-gray-900">Phone se Tasdeeq</Text>
            <Text className="mt-2 text-xs leading-5 text-gray-600">
              Code aap ke registered business number {claim?.phone} par bheja gaya hai.
            </Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={8}
              className="mt-5 h-16 rounded-2xl border border-gray-200 px-4 text-center text-2xl font-black tracking-[8px]"
              placeholder="1234"
            />
            {/* Quick 1-tap fill in development */}
            <Pressable onPress={() => setCode('1234')} className="mt-2 py-1 self-center">
              <Text className="text-xs font-bold text-primary">Demo Code (1234) Auto-Fill</Text>
            </Pressable>

            <Pressable
              onPress={finishClaim}
              disabled={code.length < 4}
              className="mt-4 h-14 items-center justify-center rounded-2xl bg-primary disabled:opacity-40 shadow-md"
            >
              <Text className="font-black text-white">✅ Mera Business Verify Karein</Text>
            </Pressable>
            <Pressable onPress={() => setClaim(null)} className="mt-3 h-11 items-center justify-center">
              <Text className="font-bold text-gray-500">Band Karein</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
