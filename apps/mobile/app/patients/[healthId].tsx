import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import type {
  CreatePatientAccountRequest,
  CreatePatientAccountResponse,
  Encounter,
  Patient,
} from '@swasthya-setu/shared-types';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';
import { useSync } from '@/context/SyncContext';
import { useLanguage } from '@/lib/i18n';
import { VoiceInputButton } from '@/components/VoiceInputButton';

type PatientState =
  | { kind: 'loading' }
  | { kind: 'needsConsent'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'done'; patient: Patient };

export default function PatientDetailScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { session } = useAuth();
  const { items: outboxItems, queueEncounter } = useSync();
  const { t } = useLanguage();
  const { healthId } = useLocalSearchParams<{ healthId: string }>();
  const [state, setState] = useState<PatientState>({ kind: 'loading' });
  const [encounters, setEncounters] = useState<Encounter[] | null>(null);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [credentials, setCredentials] = useState<CreatePatientAccountResponse | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  const loadEncounters = useCallback(
    async (patientId: string) => {
      try {
        const data = await apiFetch<Encounter[]>(session, `/api/patients/${patientId}/encounters`);
        setEncounters(data);
      } catch {
        // Offline (or the server is unreachable): keep whatever was last
        // loaded and rely on the pending-outbox list below to show what's
        // waiting to sync — this is what "usable without connectivity"
        // means for a screen that would otherwise show a hard error.
        setEncounters((prev) => prev ?? []);
      }
    },
    [session]
  );

  useEffect(() => {
    let cancelled = false;
    apiFetch<Patient>(session, `/api/patients/health-id/${healthId}`)
      .then(async (patient) => {
        if (cancelled) return;
        setState({ kind: 'done', patient });
        await loadEncounters(patient.id);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.body.needsConsent) {
          setState({ kind: 'needsConsent', message: err.message });
        } else {
          setState({
            kind: 'error',
            message: err instanceof ApiError ? err.message : 'Could not load this patient.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, healthId, loadEncounters]);

  // Re-fetch whenever the outbox changes state (queued, synced, retried) so
  // a visit recorded from this same screen while offline appears in the
  // authoritative timeline the moment it actually lands on the server.
  useEffect(() => {
    if (state.kind === 'done') loadEncounters(state.patient.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outboxItems]);

  const handleAddEncounter = async () => {
    if (state.kind !== 'done' || !notes.trim()) return;
    setFormError(null);
    try {
      // Local-first: this writes to the on-device outbox immediately and
      // returns without waiting on the network — see SyncContext.
      await queueEncounter(state.patient.id, { patientName: state.patient.fullName, notes: notes.trim() });
      setNotes('');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save this visit.');
    }
  };

  const handleCreateAccount = async () => {
    if (state.kind !== 'done') return;
    setAccountError(null);
    setCreatingAccount(true);
    try {
      const body: CreatePatientAccountRequest = accountEmail.trim() ? { email: accountEmail.trim() } : {};
      const result = await apiFetch<CreatePatientAccountResponse>(
        session,
        `/api/patients/${state.patient.healthId}/account`,
        { method: 'POST', body: JSON.stringify(body) }
      );
      setCredentials(result);
    } catch (err) {
      setAccountError(err instanceof ApiError ? err.message : 'Could not create the login.');
    } finally {
      setCreatingAccount(false);
    }
  };

  const pendingEncounters =
    state.kind === 'done'
      ? outboxItems.filter(
          (item) => item.type === 'encounter' && item.patient_id === state.patient.id && item.status !== 'synced'
        )
      : [];

  if (state.kind === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.tint} />
      </View>
    );
  }

  if (state.kind === 'needsConsent') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Text style={{ fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
          Access not granted
        </Text>
        <Text style={{ color: colors.muted, textAlign: 'center' }}>
          {state.message} Ask the patient to grant consent to your facility from their Manage
          Consent screen.
        </Text>
      </View>
    );
  }

  if (state.kind === 'error') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Text style={{ color: '#c0392b', textAlign: 'center' }}>{state.message}</Text>
      </View>
    );
  }

  const { patient } = state;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={styles.name}>{patient.fullName}</Text>
      <Text style={[styles.healthId, { color: colors.tint }]}>{patient.healthId}</Text>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Row label={t('patient_dob')} value={patient.dateOfBirth} colors={colors} />
        <Row label={t('patient_sex')} value={patient.sex} colors={colors} />
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.cardLabel}>{t('account_title')}</Text>
        {credentials ? (
          <>
            <Text style={[styles.hint, { color: colors.tint }]}>{t('account_created')}</Text>
            <Text style={[styles.rowLabel, { color: colors.muted }]}>{t('account_loginId')}</Text>
            <Text style={styles.credential} selectable>
              {credentials.loginId}
            </Text>
            <Text style={[styles.rowLabel, { color: colors.muted, marginTop: 10 }]}>{t('account_password')}</Text>
            <Text style={styles.credential} selectable>
              {credentials.temporaryPassword}
            </Text>
          </>
        ) : patient.userId ? (
          <Text style={[styles.placeholder, { color: colors.muted }]}>{t('account_exists')}</Text>
        ) : (
          <>
            <Text style={[styles.hint, { color: colors.muted }]}>{t('account_hint')}</Text>
            <TextInput
              style={[
                styles.input,
                styles.accountInput,
                { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
              ]}
              placeholder={t('account_emailOptional')}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={accountEmail}
              onChangeText={setAccountEmail}
            />
            {accountError && <Text style={styles.error}>{accountError}</Text>}
            <Pressable
              style={[styles.button, { backgroundColor: colors.tint }]}
              disabled={creatingAccount}
              onPress={handleCreateAccount}>
              {creatingAccount ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{t('account_create')}</Text>
              )}
            </Pressable>
          </>
        )}
      </View>

      <Link
        href={{ pathname: '/referrals/new', params: { patientId: patient.id, patientName: patient.fullName } }}
        asChild>
        <Pressable style={StyleSheet.flatten([styles.referButton, { borderColor: colors.tint }])}>
          <Ionicons name="git-branch-outline" size={18} color={colors.tint} />
          <Text style={[styles.referButtonText, { color: colors.tint }]}>{t('patient_referButton')}</Text>
        </Pressable>
      </Link>

      <Link
        href={{ pathname: '/summaries/[patientId]', params: { patientId: patient.id, patientName: patient.fullName } }}
        asChild>
        <Pressable style={StyleSheet.flatten([styles.referButton, { borderColor: colors.tint }])}>
          <Ionicons name="sparkles-outline" size={18} color={colors.tint} />
          <Text style={[styles.referButtonText, { color: colors.tint }]}>{t('patient_aiSummaryButton')}</Text>
        </Pressable>
      </Link>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.cardLabel}>{t('patient_recordVisit')}</Text>
        <Text style={[styles.hint, { color: colors.muted }]}>{t('patient_recordVisitHint')}</Text>
        <View style={styles.inputRow} lightColor="transparent" darkColor="transparent">
          <TextInput
            style={[
              styles.input,
              styles.inputWithVoice,
              { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
            ]}
            placeholder="What happened at this visit? (synthetic demo data only)"
            placeholderTextColor={colors.muted}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          <VoiceInputButton onResult={(text) => setNotes((prev) => (prev ? `${prev} ${text}` : text))} />
        </View>
        {formError && <Text style={styles.error}>{formError}</Text>}
        <Pressable
          style={[styles.button, { backgroundColor: notes.trim() ? colors.tint : colors.border }]}
          disabled={!notes.trim()}
          onPress={handleAddEncounter}>
          <Text style={styles.buttonText}>{t('patient_saveVisit')}</Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.cardLabel}>{t('patient_timeline')}</Text>
        {encounters === null && <ActivityIndicator color={colors.tint} />}
        {encounters?.length === 0 && pendingEncounters.length === 0 && (
          <Text style={[styles.placeholder, { color: colors.muted }]}>{t('patient_noVisits')}</Text>
        )}
        {pendingEncounters.map((item) => {
          const payload = JSON.parse(item.payload) as { notes: string };
          return (
            <View
              key={item.id}
              style={[styles.encounterRow, { borderColor: colors.border }]}
              lightColor="transparent"
              darkColor="transparent">
              <Text style={[styles.pendingBadge, { color: '#b7791f' }]}>
                {item.status === 'failed' ? t('patient_failedSync') : t('patient_waitingSync')}
              </Text>
              <Text style={styles.encounterNotes}>{payload.notes}</Text>
            </View>
          );
        })}
        {encounters?.map((encounter) => (
          <View
            key={encounter.id}
            style={[styles.encounterRow, { borderColor: colors.border }]}
            lightColor="transparent"
            darkColor="transparent">
            <Text style={[styles.encounterMeta, { color: colors.muted }]}>
              {new Date(encounter.encounterDate).toLocaleString()} · {encounter.facilityName} ·{' '}
              {encounter.recordedByName}
            </Text>
            <Text style={styles.encounterNotes}>{encounter.notes}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Row({ label, value, colors }: { label: string; value: string; colors: (typeof Colors)['light'] }) {
  return (
    <View style={styles.row} lightColor="transparent" darkColor="transparent">
      <Text style={[styles.rowLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
  },
  healthId: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'SpaceMono',
    marginTop: 4,
    marginBottom: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  referButton: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    minHeight: 48,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  referButtonText: {
    fontWeight: '700',
    fontSize: 14,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    marginBottom: 10,
  },
  placeholder: {
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rowLabel: {
    fontSize: 13,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputWithVoice: {
    flex: 1,
    marginBottom: 0,
  },
  accountInput: {
    minHeight: 48,
    textAlignVertical: 'center',
    marginBottom: 12,
  },
  credential: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SpaceMono',
    marginTop: 2,
  },
  error: {
    color: '#c0392b',
    fontSize: 13,
    marginBottom: 12,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  encounterRow: {
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 10,
  },
  encounterMeta: {
    fontSize: 11,
    marginBottom: 4,
  },
  pendingBadge: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  encounterNotes: {
    fontSize: 14,
  },
});
