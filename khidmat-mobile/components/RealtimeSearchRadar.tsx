import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '@/lib/theme/colors';

interface RealtimeSearchRadarProps {
  category?: string | null;
  sector?: string | null;
  candidateCount?: number | null;
  phase?: 'analyzing' | 'searching' | 'ranking' | 'matching';
}

export function RealtimeSearchRadar({
  category = 'Technician',
  sector = 'Islamabad',
  candidateCount,
  phase = 'searching',
}: RealtimeSearchRadarProps) {
  // Radar wave animations
  const wave1 = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;
  const wave3 = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0.4)).current;

  const [elapsed, setElapsed] = useState(1);

  // Timer for perceived real-time transparency
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Radar pulsing concentric waves
  useEffect(() => {
    const createWaveAnimation = (animValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: 1,
            duration: 2200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const anim1 = createWaveAnimation(wave1, 0);
    const anim2 = createWaveAnimation(wave2, 600);
    const anim3 = createWaveAnimation(wave3, 1200);

    // Continuous 360 radar sweep rotation
    const rotationLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Shimmer pulse for the preview skeleton
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    anim1.start();
    anim2.start();
    anim3.start();
    rotationLoop.start();
    shimmerLoop.start();

    // Trigger subtle haptic on search initialization
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
      rotationLoop.stop();
      shimmerLoop.stop();
    };
  }, [wave1, wave2, wave3, rotateAnim, shimmerAnim]);

  // Interpolated wave values
  const scale1 = wave1.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] });
  const opacity1 = wave1.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.8, 0.5, 0] });

  const scale2 = wave2.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] });
  const opacity2 = wave2.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.8, 0.5, 0] });

  const scale3 = wave3.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] });
  const opacity3 = wave3.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.8, 0.5, 0] });

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.cardContainer}>
      {/* Top Header Badge */}
      <View style={styles.headerRow}>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE SEARCH SCANNER</Text>
        </View>
        <Text style={styles.timerText}>{elapsed}s</Text>
      </View>

      {/* Main Radar Arena */}
      <View style={styles.radarArena}>
        {/* Animated Concentric Expanding Rings */}
        <Animated.View
          style={[
            styles.radarWave,
            { transform: [{ scale: scale1 }], opacity: opacity1 },
          ]}
        />
        <Animated.View
          style={[
            styles.radarWave,
            { transform: [{ scale: scale2 }], opacity: opacity2 },
          ]}
        />
        <Animated.View
          style={[
            styles.radarWave,
            { transform: [{ scale: scale3 }], opacity: opacity3 },
          ]}
        />

        {/* Outer subtle boundary ring */}
        <View style={styles.staticRing} />

        {/* Rotating Radar Sweep Line */}
        <Animated.View style={[styles.sweepContainer, { transform: [{ rotate: spin }] }]}>
          <View style={styles.sweepLine} />
        </Animated.View>

        {/* Center Hub: Pulse Beacon */}
        <View style={styles.centerBeacon}>
          <View style={styles.centerBeaconInner}>
            <Ionicons name="search" size={20} color="#FFFFFF" />
          </View>
        </View>
      </View>

      {/* Dynamic Status Micro-Stepper */}
      <View style={styles.statusBox}>
        <Text style={styles.statusTitle}>
          {phase === 'ranking'
            ? 'Ranking candidates with pgvector...'
            : `Scanning nearby ${category || 'providers'}...`}
        </Text>
        <Text style={styles.statusSubtitle}>
          {candidateCount !== null && candidateCount !== undefined
            ? `Identified ${candidateCount} active providers within 15km of ${sector}`
            : `Checking real-time GPS proximity in ${sector}`}
        </Text>

        {/* Real-time processing indicators */}
        <View style={styles.pillsRow}>
          <View style={[styles.stepPill, styles.stepPillDone]}>
            <Ionicons name="checkmark-circle" size={13} color="#16A34A" />
            <Text style={styles.stepPillDoneText}>Intent Parsed</Text>
          </View>
          <View style={[styles.stepPill, styles.stepPillActive]}>
            <Animated.View style={{ opacity: shimmerAnim }}>
              <Ionicons name="location" size={13} color="#EA580C" />
            </Animated.View>
            <Text style={styles.stepPillActiveText}>PostGIS Radius</Text>
          </View>
          <View style={[styles.stepPill, candidateCount ? styles.stepPillActive : styles.stepPillPending]}>
            <Ionicons
              name="sparkles"
              size={13}
              color={candidateCount ? '#EA580C' : '#9CA3AF'}
            />
            <Text style={candidateCount ? styles.stepPillActiveText : styles.stepPillPendingText}>
              Skill Vectors
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FED7AA', // Orange 200
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EA580C',
    marginRight: 6,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C2410C',
    letterSpacing: 0.6,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  radarArena: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  staticRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderStyle: 'dashed',
  },
  radarWave: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(251, 146, 60, 0.25)', // primary amber/orange
  },
  sweepContainer: {
    position: 'absolute',
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  sweepLine: {
    width: 2,
    height: 60,
    backgroundColor: 'rgba(234, 88, 12, 0.4)',
    borderRadius: 1,
  },
  centerBeacon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  centerBeaconInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    marginTop: 4,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  statusSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 10,
  },
  pillsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  stepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  stepPillDone: {
    backgroundColor: '#DCFCE7', // green 100
  },
  stepPillDoneText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#15803D',
  },
  stepPillActive: {
    backgroundColor: '#FFEDD5', // orange 100
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  stepPillActiveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C2410C',
  },
  stepPillPending: {
    backgroundColor: '#F1F5F9',
  },
  stepPillPendingText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3B8',
  },
});
