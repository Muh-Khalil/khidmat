import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCrmStore } from '@/lib/stores/useCrmStore';
import { useDuesStore } from '@/lib/stores/useDuesStore';
import { toast } from '@/lib/stores/useToastStore';
import { colors } from '@/lib/theme/colors';

const SECTOR_PRESETS = ['G-11', 'G-13', 'F-7', 'F-10', 'I-8', 'I-9', 'E-11'];
const TIME_PRESETS = ['Aaj sham 5 baje', 'Kal subah 10 baje', 'Kal sham 4 baje', 'Itwar subah'];
const AMOUNT_PRESETS = [500, 1000, 1500, 2500, 5000];

const TRADE_PRESETS: Record<string, string[]> = {
  ac: ['AC Service / Safai', 'Gas Refill', 'Cooling Masla', 'Compressor Check'],
  plumber: ['Pani Leakage', 'Motor Kharab', 'Nal / Pipe Tabdeel', 'Tanki Safai'],
  electrician: ['Fan Fitting', 'Short Circuit', 'Board / Switch Repair', 'Wiring Kaam'],
  tutor: ['Home Tuition', 'Exam Tayyari', 'Math & Science'],
  beautician: ['Facial & Makeup', 'Hair Cut / Styling', 'Mehndi Design'],
};

export default function ProviderCrmScreen() {
  const router = useRouter();
  const { customers, appointments, loading, refresh, addCustomer, addAppointment, closeAppointment } = useCrmStore();
  const fetchDues = useDuesStore((s) => s.fetchDues);

  const [tab, setTab] = useState<'jobs' | 'customers'>('jobs');
  const [customerModal, setCustomerModal] = useState(false);
  const [jobModal, setJobModal] = useState(false);

  // New Customer State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sector, setSector] = useState('G-11');
  const [notes, setNotes] = useState('');

  // New Job State
  const [customerId, setCustomerId] = useState('');
  const [category, setCategory] = useState<'ac' | 'plumber' | 'electrician' | 'tutor' | 'beautician'>('ac');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState('Kal subah 10 baje');
  const [amount, setAmount] = useState('1000');
  const [addDue, setAddDue] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openWhatsApp = (customerPhone?: string, customerName?: string) => {
    if (!customerPhone) return toast.warning('Phone nahi hai', 'Customer ka phone number maujood nahi.');
    const clean = customerPhone.replace(/[^0-9]/g, '');
    const formatted = clean.startsWith('92') ? clean : clean.startsWith('0') ? `92${clean.slice(1)}` : `92${clean}`;
    const text = encodeURIComponent(`Salam ${customerName || 'bhai'}, aap ke kaam ke hawale se rabta kar raha hoon.`);
    Linking.openURL(`whatsapp://send?phone=${formatted}&text=${text}`).catch(() => {
      Linking.openURL(`https://wa.me/${formatted}?text=${text}`);
    });
  };

  const saveCustomer = async () => {
    if (!name.trim()) return toast.warning('Naam likhein', 'Customer ka naam zaroori hai.');
    const saved = await addCustomer({
      name: name.trim(),
      phone: phone.trim() || undefined,
      sector: sector.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    if (!saved) return toast.error('Save nahi hua', 'Dobara koshish karein.');

    setName('');
    setPhone('');
    setSector('G-11');
    setNotes('');
    setCustomerModal(false);
    toast.success('Customer save ho gaya! 👤', 'Ab is customer ka kaam add kar sakte hain.');
  };

  const saveJob = async () => {
    if (!customerId || !description.trim() || !time.trim()) {
      return toast.warning('Maloomat mukammal karein', 'Customer, kaam aur waqt zaroori hain.');
    }
    const numericAmount = amount ? Number(amount) : undefined;
    const dayOffset = /aaj|today/i.test(time) ? 0 : 86_400_000;

    const ok = await addAppointment({
      providerCustomerId: customerId,
      category,
      description: description.trim(),
      scheduledAt: Date.now() + dayOffset,
      scheduledLabel: time.trim(),
      quotedAmount: numericAmount,
      dueAmount: addDue ? numericAmount : undefined,
    });

    if (!ok) return toast.error('Kaam save nahi hua', 'Dobara koshish karein.');

    setDescription('');
    setAmount('1000');
    setAddDue(false);
    setJobModal(false);
    fetchDues();
    toast.success(
      'Kaam save ho gaya! 📅',
      addDue ? 'Udhaar bhi khatay mein shamil ho gaya.' : 'Appointment list mein add ho gaya.',
    );
  };

  const handleCompleteWithDuePrompt = (jobId: string, quoted?: number) => {
    Alert.alert(
      'Kaam Mukammal?',
      'Customer se raqam mil gayi ya khata (udhaar) mein likhna hai?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: '💰 Pori Raqam Mil Gayi',
          onPress: () => {
            closeAppointment(jobId, 'completed');
            toast.success('Zabardast! 🎉', 'Kaam mukammal ho gaya.');
          },
        },
        {
          text: '📝 Udhaar Mein Likhein',
          onPress: async () => {
            await closeAppointment(jobId, 'completed');
            fetchDues();
            toast.info('Khatay mein darj', 'Dues tab mein ja kar check karein.');
          },
        },
      ],
    );
  };

  const active = appointments.filter((item) => item.status === 'scheduled');

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-11 w-11 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
        >
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>
        <View className="ml-3 flex-1">
          <Text className="text-lg font-black text-gray-900">Mera Kaam • Karigar CRM</Text>
          <Text className="text-xs text-gray-500">Apne offline customers, appointments aur khata</Text>
        </View>
      </View>

      {/* 2 Big Action Buttons */}
      <View className="flex-row gap-3 bg-white px-4 pb-4 pt-3 border-b border-gray-100">
        <Pressable
          onPress={() => setCustomerModal(true)}
          className="h-14 flex-1 flex-row items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 active:bg-orange-100 shadow-sm"
        >
          <Ionicons name="person-add" size={20} color={colors.primary} />
          <Text className="ml-2 font-black text-orange-700">+ Naya Customer</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (!customers.length) {
              toast.info('Pehle customer banayein', 'Kaam add karne ke liye customer zaroori hai.');
              return setCustomerModal(true);
            }
            setCustomerId(customers[0].id);
            setJobModal(true);
          }}
          className="h-14 flex-1 flex-row items-center justify-center rounded-2xl bg-primary active:opacity-90 shadow-sm"
        >
          <Ionicons name="calendar" size={20} color="white" />
          <Text className="ml-2 font-black text-white">+ Naya Kaam</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <View className="mx-4 mt-4 flex-row rounded-2xl bg-gray-200 p-1">
        <Pressable
          onPress={() => setTab('jobs')}
          className={`flex-1 items-center rounded-xl py-3 ${tab === 'jobs' ? 'bg-white shadow-sm' : ''}`}
        >
          <Text className="font-black text-gray-800">📅 Scheduled Kaam ({active.length})</Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('customers')}
          className={`flex-1 items-center rounded-xl py-3 ${tab === 'customers' ? 'bg-white shadow-sm' : ''}`}
        >
          <Text className="font-black text-gray-800">👥 Mere Customers ({customers.length})</Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        {loading && !customers.length && <ActivityIndicator color={colors.primary} className="my-6" />}

        {/* Kaam / Appointments Tab */}
        {tab === 'jobs' &&
          (active.length ? (
            active.map((job) => (
              <View key={job.id} className="mb-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text className="text-lg font-black text-gray-900">{job.customer?.name || 'Customer'}</Text>
                    <Text className="mt-1 text-sm font-semibold text-gray-700">{job.description}</Text>
                    {job.customer?.sector && (
                      <Text className="mt-0.5 text-xs text-gray-500">📍 {job.customer.sector}</Text>
                    )}
                  </View>
                  {job.quotedAmount ? (
                    <View className="rounded-xl bg-green-50 px-3 py-1.5 border border-green-200">
                      <Text className="font-black text-green-800 text-sm">
                        Rs {job.quotedAmount.toLocaleString()}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View className="mt-3.5 rounded-xl bg-orange-50 p-3 border border-orange-100 flex-row items-center">
                  <Ionicons name="time" size={17} color={colors.primary} />
                  <Text className="ml-2 font-black text-orange-900 text-xs">🕐 {job.scheduledLabel}</Text>
                </View>

                {/* 1-Tap Action Row */}
                <View className="mt-4 flex-row gap-2">
                  {job.customer?.phone && (
                    <>
                      <Pressable
                        onPress={() => Linking.openURL(`tel:${job.customer!.phone}`)}
                        className="h-11 flex-1 flex-row items-center justify-center rounded-xl bg-blue-50 border border-blue-200 active:bg-blue-100"
                      >
                        <Ionicons name="call" size={16} color="#1D4ED8" />
                        <Text className="ml-1.5 font-bold text-blue-700 text-xs">Call</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => openWhatsApp(job.customer!.phone, job.customer?.name)}
                        className="h-11 flex-1 flex-row items-center justify-center rounded-xl bg-green-50 border border-green-200 active:bg-green-100"
                      >
                        <Ionicons name="logo-whatsapp" size={16} color="#15803D" />
                        <Text className="ml-1.5 font-bold text-green-700 text-xs">Voice Msg</Text>
                      </Pressable>
                    </>
                  )}
                  <Pressable
                    onPress={() => closeAppointment(job.id, 'cancelled')}
                    className="h-11 px-3 items-center justify-center rounded-xl border border-gray-200 active:bg-gray-100"
                  >
                    <Text className="font-bold text-gray-500 text-xs">Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleCompleteWithDuePrompt(job.id, job.quotedAmount)}
                    className="h-11 px-4 items-center justify-center rounded-xl bg-green-600 active:bg-green-700 shadow-sm"
                  >
                    <Text className="font-black text-white text-xs">✅ Ho Gaya</Text>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <View className="items-center rounded-3xl bg-white p-8 border border-dashed border-gray-200">
              <Text className="text-5xl">📅</Text>
              <Text className="mt-3 text-lg font-black text-gray-900">Koi Scheduled Kaam Nahi</Text>
              <Text className="mt-1 text-center text-sm text-gray-500">
                Apne purane ya offline customer ka kaam yahan darj karein taakay waqt par yaad rahe.
              </Text>
            </View>
          ))}

        {/* Customers Tab */}
        {tab === 'customers' &&
          (customers.length ? (
            customers.map((cust) => (
              <View
                key={cust.id}
                className="mb-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <View className="flex-row items-center">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 border border-blue-100">
                    <Ionicons name="person" size={22} color="#2563EB" />
                  </View>
                  <View className="ml-3.5 flex-1">
                    <Text className="font-black text-base text-gray-900">{cust.name}</Text>
                    <Text className="text-xs font-semibold text-gray-500">
                      📍 {cust.sector || 'Area nahi diya'} • {cust.appointmentCount} kaam mukammal
                    </Text>
                    {cust.pendingAmount > 0 && (
                      <Text className="mt-1 text-xs font-black text-red-600">
                        ⚠️ Rs {cust.pendingAmount.toLocaleString()} udhaar baqi
                      </Text>
                    )}
                  </View>
                </View>

                {cust.phone && (
                  <View className="mt-3 flex-row gap-2 border-t border-gray-100 pt-3">
                    <Pressable
                      onPress={() => Linking.openURL(`tel:${cust.phone}`)}
                      className="h-10 flex-1 flex-row items-center justify-center rounded-xl bg-gray-50 border border-gray-200"
                    >
                      <Ionicons name="call" size={15} color="#374151" />
                      <Text className="ml-1.5 font-bold text-xs text-gray-700">Call</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => openWhatsApp(cust.phone, cust.name)}
                      className="h-10 flex-1 flex-row items-center justify-center rounded-xl bg-green-50 border border-green-200"
                    >
                      <Ionicons name="logo-whatsapp" size={16} color="#15803D" />
                      <Text className="ml-1.5 font-bold text-xs text-green-700">WhatsApp Note</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))
          ) : (
            <View className="items-center rounded-3xl bg-white p-8 border border-dashed border-gray-200">
              <Text className="text-5xl">👤</Text>
              <Text className="mt-3 text-lg font-black text-gray-900">Koi Customer Save Nahi</Text>
              <Text className="mt-1 text-center text-sm text-gray-500">
                Upar diye gaye button se apna pehla customer shamil karein.
              </Text>
            </View>
          ))}

        <View className="h-10" />
      </ScrollView>

      {/* Modal: Add Customer (Zero-Typing Sector Chips) */}
      <Modal visible={customerModal} transparent animationType="slide" onRequestClose={() => setCustomerModal(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[90%] rounded-t-[32px] bg-white p-6">
            <View className="flex-row items-center justify-between border-b border-gray-100 pb-3">
              <Text className="text-xl font-black text-gray-900">Naya Customer Shamil Karein</Text>
              <Pressable onPress={() => setCustomerModal(false)}>
                <Ionicons name="close-circle" size={28} color={colors.gray400} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="mt-4">
              <Text className="mb-1 text-xs font-bold text-gray-600">Customer Ka Naam *</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Maslan: Tariq Sahab"
                className="h-14 rounded-2xl border border-gray-200 px-4 text-base"
              />

              <Text className="mb-1 mt-4 text-xs font-bold text-gray-600">Phone Number (Calling / WhatsApp)</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="0300 1234567"
                className="h-14 rounded-2xl border border-gray-200 px-4 text-base"
              />

              {/* Quick Sector Chips */}
              <Text className="mb-2 mt-4 text-xs font-black uppercase text-gray-600">📍 Ilaqa / Sector</Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {SECTOR_PRESETS.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setSector(s)}
                    className={`rounded-xl border px-3.5 py-2 ${sector === s ? 'border-primary bg-orange-50' : 'border-gray-200 bg-gray-50'}`}
                  >
                    <Text className={`font-bold text-xs ${sector === s ? 'text-primary' : 'text-gray-700'}`}>{s}</Text>
                  </Pressable>
                ))}
              </View>

              <Text className="mb-1 mt-2 text-xs font-bold text-gray-600">Khaas Baat / Yaad Dehani (Optional)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Maslan: Gali number 3, pehla makaan"
                className="h-20 rounded-2xl border border-gray-200 p-4 text-sm"
                multiline
              />

              <Pressable
                onPress={saveCustomer}
                className="mt-6 h-14 items-center justify-center rounded-2xl bg-primary shadow-md active:opacity-90"
              >
                <Text className="text-base font-black text-white">✅ Customer Save Karein</Text>
              </Pressable>
              <View className="h-6" />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Add Offline Job (With Pre-Filled Trade Chips) */}
      <Modal visible={jobModal} transparent animationType="slide" onRequestClose={() => setJobModal(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[92%] rounded-t-[32px] bg-white p-6">
            <View className="flex-row items-center justify-between border-b border-gray-100 pb-3">
              <Text className="text-xl font-black text-gray-900">Naya Kaam Shamil Karein</Text>
              <Pressable onPress={() => setJobModal(false)}>
                <Ionicons name="close-circle" size={28} color={colors.gray400} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="mt-4">
              {/* Select Customer */}
              <Text className="mb-2 text-xs font-black uppercase text-gray-600">1. Customer Chunain *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                {customers.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setCustomerId(c.id)}
                    className={`mr-2 rounded-2xl border px-4 py-2.5 ${customerId === c.id ? 'border-primary bg-orange-50' : 'border-gray-200 bg-gray-50'}`}
                  >
                    <Text className={`font-bold text-sm ${customerId === c.id ? 'text-primary' : 'text-gray-800'}`}>
                      {c.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Trade Category */}
              <Text className="mb-2 text-xs font-black uppercase text-gray-600">2. Kaam Ki Qism</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                {(['ac', 'plumber', 'electrician', 'tutor', 'beautician'] as const).map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => {
                      setCategory(cat);
                      if (TRADE_PRESETS[cat]?.[0]) setDescription(TRADE_PRESETS[cat][0]);
                    }}
                    className={`mr-2 rounded-xl border px-3.5 py-2 ${category === cat ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'}`}
                  >
                    <Text className={`font-bold capitalize text-xs ${category === cat ? 'text-blue-700' : 'text-gray-700'}`}>
                      {cat}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Common Tasks Zero-Typing Chips */}
              <Text className="mb-2 text-xs font-black uppercase text-gray-600">3. Aam Masla / Kaam *</Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {(TRADE_PRESETS[category] || []).map((preset) => (
                  <Pressable
                    key={preset}
                    onPress={() => setDescription(preset)}
                    className={`rounded-xl border px-3 py-2 ${description === preset ? 'border-green-600 bg-green-50' : 'border-gray-200 bg-gray-50'}`}
                  >
                    <Text className={`text-xs font-bold ${description === preset ? 'text-green-700' : 'text-gray-700'}`}>
                      {preset}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Ya khud tafseel likhein..."
                className="h-12 rounded-xl border border-gray-200 px-3 text-sm mb-4"
              />

              {/* Quick Time Selection */}
              <Text className="mb-2 text-xs font-black uppercase text-gray-600">4. Waqt *</Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {TIME_PRESETS.map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setTime(t)}
                    className={`rounded-xl border px-3 py-2 ${time === t ? 'border-primary bg-orange-50' : 'border-gray-200 bg-white'}`}
                  >
                    <Text className={`text-xs font-bold ${time === t ? 'text-primary' : 'text-gray-700'}`}>{t}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Quick Amount Selection */}
              <Text className="mb-2 text-xs font-black uppercase text-gray-600">5. Qeemat (Rs)</Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {AMOUNT_PRESETS.map((a) => (
                  <Pressable
                    key={a}
                    onPress={() => setAmount(String(a))}
                    className={`rounded-xl border px-3 py-2 ${amount === String(a) ? 'border-green-600 bg-green-50' : 'border-gray-200 bg-white'}`}
                  >
                    <Text className={`text-xs font-bold ${amount === String(a) ? 'text-green-700' : 'text-gray-700'}`}>
                      Rs {a}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Add to Dues checkbox */}
              <Pressable
                onPress={() => setAddDue(!addDue)}
                className={`my-3 flex-row items-center rounded-2xl border p-4 ${addDue ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}
              >
                <Ionicons name={addDue ? 'checkbox' : 'square-outline'} size={22} color={addDue ? '#D97706' : colors.gray400} />
                <View className="ml-3 flex-1">
                  <Text className="font-black text-gray-800 text-sm">Yeh raqam Khata (Udhaar) mein shamil karein</Text>
                  <Text className="text-[11px] text-gray-500">Agar customer baad mein ada karega</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={saveJob}
                className="mt-3 h-14 items-center justify-center rounded-2xl bg-primary shadow-md active:opacity-90"
              >
                <Text className="text-base font-black text-white">🚀 Kaam Save Karein</Text>
              </Pressable>
              <View className="h-6" />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
