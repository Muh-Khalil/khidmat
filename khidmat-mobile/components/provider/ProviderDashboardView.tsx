import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { User } from '@/lib/stores/useAuthStore';
import { ProviderHeader } from './ProviderHeader';
import { JobCard, ProviderJob } from './JobCard';
import { useDuesStore } from '@/lib/stores/useDuesStore';
import { toast } from '@/lib/stores/useToastStore';
import { colors } from '@/lib/theme/colors';

interface ProviderDashboardViewProps {
  user: User;
}

const INITIAL_DEMO_JOBS: ProviderJob[] = [
  {
    id: 'job_201',
    customerName: 'Muhammad Khalil',
    customerPhone: '+92 300 9876543',
    serviceCategory: 'hvac',
    sector: 'G-11',
    scheduledTime: 'Today, 3:30 PM',
    urgency: 'high',
    problemDescription: 'AC outdoor unit not cooling properly, noise in compressor',
    estimatedFare: 2200,
    status: 'pending',
    explainableRationale:
      'Matched via 1.2km spatial proximity, 4.9 HVAC rating, and available 3:30 PM slot.',
  },
  {
    id: 'job_202',
    customerName: 'Imad Ali',
    customerPhone: '+92 312 3456789',
    serviceCategory: 'electrician',
    sector: 'F-7',
    scheduledTime: 'Tomorrow, 11:00 AM',
    urgency: 'normal',
    problemDescription: 'Install 4 ceiling fans & repair distribution board fuses',
    estimatedFare: 3500,
    status: 'accepted',
    explainableRationale:
      'Matched via skill vector similarity (Electrical Installation) & customer preferred sector F-7.',
  },
];

export function ProviderDashboardView({ user }: ProviderDashboardViewProps) {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  const [jobs, setJobs] = useState<ProviderJob[]>(INITIAL_DEMO_JOBS);
  const [refreshing, setRefreshing] = useState(false);
  const dues = useDuesStore((s) => s.dues);

  const pendingDuesTotal = dues
    .filter((d) => d.status === 'pending')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const handleAcceptJob = (id: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, status: 'accepted' } : j)),
    );
    toast.success('Job Accepted!', 'Client notified. You can now call them.');
  };

  const handleDeclineJob = (id: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, status: 'declined' } : j)),
    );
    toast.info('Job Declined', 'Job has been removed from your active queue.');
  };

  const handleCompleteJob = (id: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, status: 'completed' } : j)),
    );
    toast.success('Service Completed!', 'Great job! Payment status updated.');
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 600);
  };

  const pendingJobsCount = jobs.filter((j) => j.status === 'pending').length;

  return (
    <ScrollView
      className="flex-1 bg-white px-5 pt-3"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Provider Karigar Header */}
      <ProviderHeader
        user={user}
        isOnline={isOnline}
        onToggleOnline={setIsOnline}
        onSwitchRole={() => router.push('/auth')}
        onViewDues={() => router.push('/dues')}
        pendingJobsCount={pendingJobsCount}
        totalDuesAmount={pendingDuesTotal}
      />

      {/* Jobs Dispatch Queue Header */}
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Ionicons name="flash-outline" size={18} color={colors.primary} />
          <Text className="text-base font-bold text-gray-900">
            Incoming Job Alerts
          </Text>
        </View>
        <Text className="text-xs font-semibold text-gray-400">
          Agent Supervised Queue
        </Text>
      </View>

      {/* Job Cards */}
      {jobs.filter((j) => j.status !== 'declined').length === 0 ? (
        <View className="my-6 rounded-2xl bg-gray-50 p-6 items-center border border-dashed border-gray-200">
          <Ionicons name="checkmark-circle-outline" size={32} color={colors.gray400} />
          <Text className="mt-2 text-sm font-bold text-gray-700">
            No active job requests right now
          </Text>
          <Text className="text-xs text-gray-400 text-center mt-1">
            Stay online — the AI Matchmaker Agent will dispatch nearby requests as they arrive.
          </Text>
        </View>
      ) : (
        jobs
          .filter((j) => j.status !== 'declined')
          .map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onAccept={handleAcceptJob}
              onDecline={handleDeclineJob}
              onComplete={handleCompleteJob}
            />
          ))
      )}

      {/* Footer Padding */}
      <View className="h-10" />
    </ScrollView>
  );
}
