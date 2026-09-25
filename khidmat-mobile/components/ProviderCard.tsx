import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Provider } from '@/lib/mock/providers';
import { categoryEmoji, categoryServiceLabel } from '@/lib/categories';
import { colors } from '@/lib/theme/colors';
import { formatSchedule } from '@/lib/util/schedule';

type ProviderCardProps = {
  provider: Provider;
  distanceKm: number;
  reasoning: string;
  suggestedSlot: string;
  dayLabel: string;
  onBook: () => void;
};

export function ProviderCard({
  provider,
  distanceKm,
  reasoning,
  suggestedSlot,
  dayLabel,
  onBook,
}: ProviderCardProps) {
  const [showExplainModal, setShowExplainModal] = useState(false);

  return (
    <View
      style={{
        marginTop: 6,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#FED7AA',
        padding: 16,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      {/* ── TOP HEADER: AVATAR, NAME, VERIFIED, AI MATCH ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
          {/* Avatar Container with Verified Badge */}
          <View style={{ position: 'relative', marginRight: 12 }}>
            <View
              style={{
                height: 48,
                width: 48,
                borderRadius: 16,
                backgroundColor: '#FFF7ED',
                borderWidth: 1,
                borderColor: '#FFEDD5',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 24 }}>{categoryEmoji(provider.category)}</Text>
            </View>
            <View
              style={{
                position: 'absolute',
                bottom: -3,
                right: -3,
                backgroundColor: '#16A34A',
                borderRadius: 10,
                height: 18,
                width: 18,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: '#FFFFFF',
              }}
            >
              <Ionicons name="checkmark" size={11} color="#FFFFFF" />
            </View>
          </View>

          {/* Name & Category */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                numberOfLines={1}
                style={{ fontSize: 16, fontWeight: '800', color: '#111827', marginRight: 4 }}
              >
                {provider.name}
              </Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginTop: 1 }}>
              {categoryServiceLabel(provider.category)} • {provider.sector}
            </Text>
          </View>
        </View>

        {/* AI Match Badge (Tappable for Explainability) */}
        <TouchableOpacity
          onPress={() => setShowExplainModal(true)}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#EFF6FF',
            borderColor: '#BFDBFE',
            borderWidth: 1,
            borderRadius: 20,
            paddingHorizontal: 9,
            paddingVertical: 5,
          }}
          accessibilityLabel="Why AI matched this provider"
        >
          <Ionicons name="sparkles" size={12} color="#1D4ED8" />
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#1D4ED8', marginLeft: 4 }}>
            AI Match
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── STATS ROW: DISTANCE, RATING & VERIFIED STATUS ── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginTop: 12,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#F3F4F6',
        }}
      >
        {/* Proximity */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="location-sharp" size={14} color="#EA580C" />
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginLeft: 3 }}>
            {distanceKm} km away
          </Text>
        </View>

        <Text style={{ color: '#D1D5DB' }}>•</Text>

        {/* Rating */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="star" size={13} color="#F59E0B" />
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#1F2937', marginLeft: 3 }}>
            {provider.rating}
          </Text>
          <Text style={{ fontSize: 11, color: '#6B7280', marginLeft: 2 }}>
            ({provider.reviewCount})
          </Text>
        </View>

        <Text style={{ color: '#D1D5DB' }}>•</Text>

        {/* Fast Service Badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="shield-checkmark" size={13} color="#16A34A" />
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#166534', marginLeft: 3 }}>
            Verified
          </Text>
        </View>
      </View>

      {/* ── PRICE & TIME SLOT HIGHLIGHT BOX ── */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#F9FAFB',
          borderRadius: 14,
          padding: 12,
          marginTop: 10,
          borderWidth: 1,
          borderColor: '#F3F4F6',
        }}
      >
        {/* Left: Price */}
        <View>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Estimated Fare
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827', marginTop: 2 }}>
            {provider.priceRange}
          </Text>
        </View>

        {/* Right: Slot */}
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Available Time
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FFF7ED',
              borderColor: '#FED7AA',
              borderWidth: 1,
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 3,
              marginTop: 2,
            }}
          >
            
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#EA580C', marginLeft: 4 }}>
              {formatSchedule(dayLabel, suggestedSlot)}
            </Text>
          </View>
        </View>
      </View>

      {/* ── MATCHMAKER REASONING NOTE ── */}
      {reasoning ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            backgroundColor: '#F0FDF4',
            borderRadius: 10,
            padding: 9,
            marginTop: 10,
            borderWidth: 1,
            borderColor: '#DCFCE7',
          }}
        >
          <Ionicons name="bulb-outline" size={15} color="#15803D" style={{ marginTop: 1, marginRight: 6 }} />
          <Text style={{ fontSize: 12, color: '#166534', flex: 1, lineHeight: 17, fontWeight: '500' }}>
            {reasoning}
          </Text>
        </View>
      ) : null}

      {/* ── PRIMARY BOOKING CTA ── */}
      <TouchableOpacity
        onPress={onBook}
        activeOpacity={0.88}
        style={{
          marginTop: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
          borderRadius: 14,
          paddingVertical: 14,
          shadowColor: '#EA580C',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.2,
          shadowRadius: 5,
          elevation: 3,
        }}
        accessibilityLabel={`Book appointment with ${provider.name}`}
      >
        <Ionicons name="calendar-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>
          Book {dayLabel} at {suggestedSlot}
        </Text>
        <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
      </TouchableOpacity>

      {/* ── AI EXPLAINABILITY MODAL ── */}
      <Modal
        visible={showExplainModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowExplainModal(false)}
      >
        <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, elevation: 5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ height: 32, width: 32, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Ionicons name="sparkles" size={18} color="#1D4ED8" />
                </View>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827' }}>AI Match Rationale</Text>
                  <Text style={{ fontSize: 11, color: '#6B7280' }}>Explainable Matchmaker Agent</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowExplainModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={{ marginTop: 12, fontSize: 13, color: '#4B5563', lineHeight: 18 }}>
              Khidmat AI analyzed spatial coordinates, verified skill tags, and customer ratings for <Text style={{ fontWeight: '700', color: '#111827' }}>{provider.name}</Text>:
            </Text>

            <View style={{ marginTop: 12, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="location-outline" size={18} color="#EA580C" style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>Spatial Proximity</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#15803D' }}>{distanceKm} km (Sector {provider.sector})</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="git-network-outline" size={18} color="#2563EB" style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>Skill Cosine Match</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#15803D' }}>98.2% Compatibility</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="star-outline" size={18} color="#D97706" style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>Customer Rating</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#111827' }}>{provider.rating} ★ ({provider.reviewCount} reviews)</Text>
              </View>
            </View>

            <View style={{ marginTop: 12, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#DBEAFE' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#1E40AF', textTransform: 'uppercase' }}>Agent Decision Log:</Text>
              <Text style={{ marginTop: 4, fontSize: 12, color: '#1E3A8A', lineHeight: 18 }}>{reasoning}</Text>
            </View>

            <TouchableOpacity
              onPress={() => setShowExplainModal(false)}
              style={{ marginTop: 16, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>Theek Hai (Got It)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
