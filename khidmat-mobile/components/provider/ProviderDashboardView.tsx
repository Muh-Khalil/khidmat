import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { User } from '@/lib/stores/useAuthStore';
import { ProviderHeader } from './ProviderHeader';
import { JobCard, ProviderJob } from './JobCard';
import { useDuesStore } from '@/lib/stores/useDuesStore';
import { toast } from '@/lib/stores/useToastStore';
import { colors } from '@/lib/theme/colors';
import { getApiBaseUrl } from '@/lib/util/apiConfig';
import { authenticatedFetch } from '@/lib/services/authenticatedFetch';
import { LeadCard, ProviderLead } from './LeadCard';

interface ProviderDashboardViewProps {
  user: User;
}


export function ProviderDashboardView({ user }: ProviderDashboardViewProps) {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  const [jobs, setJobs] = useState<ProviderJob[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [leads, setLeads] = useState<ProviderLead[]>([]);
  const dues = useDuesStore((s) => s.dues);
  const fetchDues = useDuesStore((s) => s.fetchDues);

  // Fetch live jobs and profile metrics from backend
  const loadData = useCallback(async () => {
    try {
      const baseUrl = getApiBaseUrl();

      // 1. Sync Dues Ledger
      fetchDues();

      // 2. Fetch Provider Status & Profile
      const profileRes = await authenticatedFetch(`${baseUrl}/api/providers/me`);
      if (profileRes.ok) {
        const profileJson = await profileRes.json();
        if (profileJson.success && profileJson.data?.provider) {
          setIsOnline(profileJson.data.provider.isOnline);
        }
      }

      // 3. Fetch marketplace leads and active bookings
      const leadsRes = await authenticatedFetch(`${baseUrl}/api/provider/leads`);
      if (leadsRes.ok) {
        const leadsJson = await leadsRes.json();
        if (leadsJson.success && Array.isArray(leadsJson.data)) {
          setLeads(leadsJson.data);
        } else {
          setLeads([]);
        }
      }

      const jobsRes = await authenticatedFetch(`${baseUrl}/api/jobs`);
      if (jobsRes.ok) {
        const jobsJson = await jobsRes.json();
        if (jobsJson.success && Array.isArray(jobsJson.data)) {
          const mappedJobs: ProviderJob[] = jobsJson.data.map((j: any) => ({
            id: j.id,
            customerName: j.customerName || 'Customer',
            customerPhone: j.customerPhone || '+92 300 0000000',
            serviceCategory: j.category || 'general',
            sector: j.sector || 'Islamabad',
            scheduledTime: j.scheduledFor || 'Today, ASAP',
            urgency: j.urgency === 'urgent' ? 'high' : 'normal',
            problemDescription: j.issueDescription || 'Service requested',
            estimatedFare: j.estimatedFare || 1500,
            status: j.status,
            explainableRationale:
              j.explainabilityRationale ||
              'Matched via spatial proximity and real-time provider availability.',
          }));
          setJobs(mappedJobs);
        } else {
          setJobs([]);
        }
      } else {
        setJobs([]);
      }
    } catch (err) {
      console.warn('[ProviderDashboardView] Server sync error, using cached state:', err);
    }
  }, [fetchDues]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time SSE stream for incoming job alerts
  useEffect(() => {
    const abortController = new AbortController();

    const connectJobStream = async () => {
      try {
        const baseUrl = getApiBaseUrl();
        const streamUrl = `${baseUrl}/api/jobs/stream`;
        const response = await authenticatedFetch(streamUrl, {
          signal: abortController.signal,
          headers: {
            Accept: 'text/event-stream',
          },
        });

        if (!response.ok || !response.body) return;

        const reader = (response.body as any).getReader ? (response.body as any).getReader() : null;
        if (reader) {
          const decoder = new TextDecoder();
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const eventData = JSON.parse(line.slice(6));
                  if (eventData.type === 'new_job_alert' && eventData.job) {
                    const j = eventData.job;
                    const newJob: ProviderJob = {
                      id: j.id,
                      customerName: j.customerName || 'Customer',
                      customerPhone: j.customerPhone || '+92 300 0000000',
                      serviceCategory: j.category || 'general',
                      sector: j.sector || 'Islamabad',
                      scheduledTime: j.scheduledFor || 'Today, ASAP',
                      urgency: j.urgency === 'urgent' ? 'high' : 'normal',
                      problemDescription: j.issueDescription || 'Service requested',
                      estimatedFare: j.estimatedFare || 1500,
                      status: 'pending',
                      explainableRationale:
                        j.explainabilityRationale ||
                        'Matched via spatial proximity and real-time provider availability.',
                    };
                    setJobs((prev) => [newJob, ...prev.filter((existing) => existing.id !== newJob.id)]);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    toast.success('⚡ Naya Kaam Alert!', `${newJob.customerName} (${newJob.sector})`);
                  } else if (eventData.type === 'new_lead_alert' && eventData.dispatch && eventData.request) {
                    setLeads((previous) => [
                      { dispatch: eventData.dispatch, request: eventData.request },
                      ...previous.filter((lead) => lead.dispatch.id !== eventData.dispatch.id),
                    ]);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    toast.success('Naya kaam!', `${eventData.request.sector} • ${eventData.dispatch.distanceKm} km`);
                  }
                } catch {
                  // Ignore heartbeat parse error
                }
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('[ProviderDashboardView] SSE stream closed or unavailable:', err.message);
        }
      }
    };

    if (isOnline) {
      connectJobStream();
    }

    return () => {
      abortController.abort();
    };
  }, [isOnline]);

  const pendingDuesTotal = dues
    .filter((d) => d.status === 'pending')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const handleToggleOnline = async (nextOnline: boolean) => {
    setIsOnline(nextOnline);
    try {
      const baseUrl = getApiBaseUrl();
      await authenticatedFetch(`${baseUrl}/api/providers/me/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOnline: nextOnline }),
      });
      toast.info(nextOnline ? 'You are Online' : 'You are Offline', nextOnline ? 'Ready to receive nearby jobs.' : 'Job alerts paused.');
    } catch (err) {
      console.warn('[ProviderDashboardView] Error toggling status:', err);
    }
  };

  const handleAcceptJob = async (id: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, status: 'accepted' } : j)),
    );
    toast.success('Job Accepted!', 'Client notified. You can now call them.');

    try {
      const baseUrl = getApiBaseUrl();
      await authenticatedFetch(`${baseUrl}/api/jobs/${encodeURIComponent(id)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Provider accepted incoming service request' }),
      });
    } catch (err) {
      console.warn('[ProviderDashboardView] Error accepting job on server:', err);
    }
  };

  const handleDeclineJob = async (id: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, status: 'declined' } : j)),
    );
    toast.info('Job Declined', 'Job has been removed from your active queue.');

    try {
      const baseUrl = getApiBaseUrl();
      await authenticatedFetch(`${baseUrl}/api/jobs/${encodeURIComponent(id)}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Provider unavailable for requested slot' }),
      });
    } catch (err) {
      console.warn('[ProviderDashboardView] Error declining job on server:', err);
    }
  };

  const handleCompleteJob = async (id: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, status: 'completed' } : j)),
    );
    toast.success('Service Completed!', 'Great job! Payment status updated.');

    try {
      const baseUrl = getApiBaseUrl();
      await authenticatedFetch(`${baseUrl}/api/jobs/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
    } catch (err) {
      console.warn('[ProviderDashboardView] Error completing job on server:', err);
    }
  };

  const handleStartJob = async (id: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, status: 'in_progress' } : j)),
    );
    toast.info('Kaam shuru', 'Customer ko status nazar aa raha hai.');

    try {
      const baseUrl = getApiBaseUrl();
      const response = await authenticatedFetch(`${baseUrl}/api/jobs/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      });
      if (!response.ok) await loadData();
    } catch (err) {
      await loadData();
      console.warn('[ProviderDashboardView] Error starting job on server:', err);
    }
  };

  const handleOnMyWay = async (id: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, status: 'on_the_way' } : j)),
    );
    toast.info('On The Way 🛵', 'Customer ko notification chali gayi hai.');

    try {
      const baseUrl = getApiBaseUrl();
      await authenticatedFetch(`${baseUrl}/api/jobs/${encodeURIComponent(id)}/on_the_way`, {
        method: 'POST',
      });
    } catch (err) {
      console.warn('[ProviderDashboardView] Error updating on_the_way:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleLeadResponse = async (dispatchId: string, data: any) => {
    const response = await authenticatedFetch(
      `${getApiBaseUrl()}/api/provider/leads/${encodeURIComponent(dispatchId)}/respond`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) },
    );
    if (!response.ok) {
      toast.error('Jawab nahi gaya', 'Refresh karke dobara koshish karein.');
      return;
    }
    setLeads((previous) => previous.filter((lead) => lead.dispatch.id !== dispatchId));
    toast.success(data.available ? 'Jawab bhej diya' : 'Request hata di', data.available ? 'Customer ab aap ka jawab dekh sakta hai.' : 'Agla kaam milne par batayenge.');
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
        onToggleOnline={handleToggleOnline}
        onSwitchRole={() => router.push('/auth')}
        onViewDues={() => router.push('/(tabs)/dues')}
        pendingJobsCount={pendingJobsCount}
        totalDuesAmount={pendingDuesTotal}
      />

      <Pressable
        onPress={() => router.push('/provider/crm' as any)}
        className="mb-3 flex-row items-center rounded-2xl bg-blue-600 p-4 active:bg-blue-700"
      >
        <View className="h-11 w-11 items-center justify-center rounded-full bg-white/20"><Ionicons name="people" size={22} color="white" /></View>
        <View className="ml-3 flex-1"><Text className="font-black text-white">Mera Kaam • Mini CRM</Text><Text className="mt-0.5 text-xs text-blue-100">Customer, appointment aur udhaar ek jagah</Text></View>
        <Ionicons name="chevron-forward" size={20} color="white" />
      </Pressable>

      <Pressable
        onPress={() => router.push('/providers/external' as any)}
        className="mb-5 flex-row items-center rounded-2xl border border-orange-200 bg-orange-50 p-4 active:bg-orange-100"
      >
        <View className="h-11 w-11 items-center justify-center rounded-full bg-white"><Ionicons name="business" size={21} color={colors.primary} /></View>
        <View className="ml-3 flex-1"><Text className="font-black text-gray-900">Apna purana business claim karein</Text><Text className="mt-0.5 text-xs text-gray-600">Google Maps listing ko Khidmat profile banayein</Text></View>
        <Ionicons name="chevron-forward" size={20} color={colors.primary} />
      </Pressable>

      {leads.length > 0 && (
        <View className="mb-2">
          <View className="mb-3 flex-row items-center gap-2"><Ionicons name="megaphone" size={19} color={colors.primary} /><Text className="text-base font-black text-gray-900">Naye customer requests ({leads.length})</Text></View>
          {leads.map((lead) => <LeadCard key={lead.dispatch.id} lead={lead} onRespond={handleLeadResponse} />)}
        </View>
      )}

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
              onOnMyWay={handleOnMyWay}
              onStart={handleStartJob}
              onComplete={handleCompleteJob}
            />
          ))
      )}

      {/* Footer Padding */}
      <View className="h-10" />
    </ScrollView>
  );
}
