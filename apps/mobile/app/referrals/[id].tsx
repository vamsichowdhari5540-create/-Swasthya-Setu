import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import {
  CONSULTATION_CHANGED_EVENT,
  type Consultation,
  type ConsultationMode,
  type Facility,
  type Referral,
} from '@swasthya-setu/shared-types';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';
import { loadFacilities } from '@/lib/facilitiesCache';
import { connectSocket, useReferralUpdates } from '@/lib/socket';
import { ReferralStatusBadge } from '@/components/ReferralStatusBadge';
import { useLanguage } from '@/lib/i18n';

export default function ReferralDetailScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { session, profile } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [referral, setReferral] = useState<Referral | null>(null);
  const [facilities, setFacilities] = useState<Facility[] | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [reassignTo, setReassignTo] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consultation, setConsultation] = useState<Consultation | null | undefined>(undefined);
  const [consultationMode, setConsultationMode] = useState<ConsultationMode>('video');

  const load = useCallback(() => {
    apiFetch<Referral>(session, `/api/referrals/${id}`).then(setReferral);
  }, [session, id]);

  const loadConsultation = useCallback(() => {
    apiFetch<Consultation | null>(session, `/api/referrals/${id}/consultations/latest`).then(setConsultation);
  }, [session, id]);

  useEffect(() => {
    load();
    loadConsultation();
  }, [load, loadConsultation]);

  useEffect(() => {
    if (!session?.access_token) return;
    const socket = connectSocket(session.access_token);
    const handler = (updated: Consultation) => {
      if (updated.referralId === id) setConsultation(updated);
    };
    socket.on(CONSULTATION_CHANGED_EVENT, handler);
    return () => {
      socket.off(CONSULTATION_CHANGED_EVENT, handler);
    };
  }, [session?.access_token, id]);

  useEffect(() => {
    if (profile?.role !== 'patient') {
      loadFacilities(session).then(setFacilities);
    }
  }, [session, profile]);

  const onChanged = useCallback(
    (updated: Referral) => {
      if (updated.id === id) setReferral(updated);
    },
    [id]
  );
  useReferralUpdates(session?.access_token, onChanged);

  if (!referral) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.tint} />
      </View>
    );
  }

  const isReceivingFacility = !!profile?.facilityId && profile.facilityId === referral.receivingFacilityId;
  const isEitherFacility =
    isReceivingFacility || (!!profile?.facilityId && profile.facilityId === referral.originatingFacilityId);
  const isDoctor = profile?.role === 'doctor';
  const isStaff = profile?.role === 'anm_asha' || profile?.role === 'doctor';

  const canAccept = isDoctor && isReceivingFacility && referral.status === 'pending';
  const canComplete = isDoctor && isReceivingFacility && referral.status === 'accepted';
  const canReassign = isStaff && isReceivingFacility && referral.status === 'pending';
  const canCancel = isStaff && isEitherFacility && (referral.status === 'pending' || referral.status === 'accepted');

  const startConsultation = async () => {
    if (!referral) return;
    setError(null);
    setBusy('consult');
    try {
      const created = await apiFetch<Consultation>(session, `/api/referrals/${referral.id}/consultations`, {
        method: 'POST',
        body: JSON.stringify({ mode: consultationMode }),
      });
      router.push(`/consultations/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start the consultation.');
    } finally {
      setBusy(null);
    }
  };

  const runAction = async (action: string, path: string, body?: object) => {
    setError(null);
    setBusy(action);
    try {
      const updated = await apiFetch<Referral>(session, path, {
        method: 'PATCH',
        body: body ? JSON.stringify(body) : undefined,
      });
      setReferral(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update this referral.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <ReferralStatusBadge status={referral.status} />
      <Text style={styles.patientName}>{referral.patientName}</Text>
      <Text style={[styles.healthId, { color: colors.tint }]}>{referral.patientHealthId}</Text>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Row label="Reason" value={referral.reason} colors={colors} />
        <Row label="From" value={referral.originatingFacilityName} colors={colors} />
        <Row label="To" value={referral.receivingFacilityName} colors={colors} />
        <Row label="Created by" value={referral.createdByName} colors={colors} />
        <Row label="Created" value={new Date(referral.createdAt).toLocaleString()} colors={colors} />
        {referral.acceptedAt && (
          <Row
            label="Accepted"
            value={`${referral.acceptedByName ?? ''} · ${new Date(referral.acceptedAt).toLocaleString()}`}
            colors={colors}
          />
        )}
        {referral.completedAt && (
          <Row label="Completed" value={new Date(referral.completedAt).toLocaleString()} colors={colors} />
        )}
        {referral.completionNotes && (
          <Row label="Outcome" value={referral.completionNotes} colors={colors} />
        )}
        {referral.cancelledAt && (
          <Row label="Cancelled" value={new Date(referral.cancelledAt).toLocaleString()} colors={colors} />
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {canAccept && (
        <ActionButton
          label={t('accept')}
          busy={busy === 'accept'}
          color={colors.tint}
          onPress={() => runAction('accept', `/api/referrals/${referral.id}/accept`)}
        />
      )}

      {canComplete && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.cardLabel}>{t('referral_completeTitle')}</Text>
          <TextInput
            style={[
              styles.input,
              { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
            ]}
            placeholder={t('referral_outcomeNotes')}
            placeholderTextColor={colors.muted}
            value={completionNotes}
            onChangeText={setCompletionNotes}
            multiline
          />
          <ActionButton
            label={t('markCompleted')}
            busy={busy === 'complete'}
            color={colors.tint}
            onPress={() =>
              runAction('complete', `/api/referrals/${referral.id}/complete`, { completionNotes })
            }
          />
        </View>
      )}

      {isEitherFacility && referral.status === 'accepted' && consultation !== undefined && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.cardLabel}>{t('teleconsult_title')}</Text>
          {consultation && consultation.status !== 'ended' ? (
            <>
              <Text style={[styles.rowValue, { marginBottom: 12 }]}>
                {consultation.status === 'waiting'
                  ? `${consultation.createdByName} is waiting in the call.`
                  : t('teleconsult_inProgress')}
              </Text>
              <Link href={`/consultations/${consultation.id}`} asChild>
                <Pressable style={StyleSheet.flatten([styles.actionButton, { backgroundColor: colors.tint }])}>
                  <Text style={styles.actionButtonText}>{t('teleconsult_join')}</Text>
                </Pressable>
              </Link>
            </>
          ) : (
            <>
              <View style={styles.chipsRow} lightColor="transparent" darkColor="transparent">
                {(['video', 'audio'] as ConsultationMode[]).map((mode) => {
                  const active = mode === consultationMode;
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => setConsultationMode(mode)}
                      style={[
                        styles.modeChip,
                        { borderColor: active ? colors.tint : colors.border },
                        active && { backgroundColor: colors.tint },
                      ]}>
                      <Text style={active ? styles.modeChipTextActive : undefined}>
                        {mode === 'video' ? t('teleconsult_video') : t('teleconsult_audio')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <ActionButton
                label={t('teleconsult_start')}
                busy={busy === 'consult'}
                color={colors.tint}
                onPress={startConsultation}
              />
            </>
          )}
        </View>
      )}

      {canReassign && facilities && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.cardLabel}>{t('referral_reassignTitle')}</Text>
          {facilities
            .filter((f) => f.id !== referral.receivingFacilityId)
            .map((facility) => (
              <Pressable
                key={facility.id}
                onPress={() => setReassignTo(facility.id)}
                style={[
                  styles.facilityRow,
                  { borderColor: reassignTo === facility.id ? colors.tint : colors.border },
                ]}>
                <Text style={reassignTo === facility.id ? { color: colors.tint, fontWeight: '700' } : undefined}>
                  {facility.name}
                </Text>
              </Pressable>
            ))}
          <ActionButton
            label={t('reassign')}
            busy={busy === 'reassign'}
            color={colors.tint}
            disabled={!reassignTo}
            onPress={() =>
              runAction('reassign', `/api/referrals/${referral.id}/reassign`, { facilityId: reassignTo })
            }
          />
        </View>
      )}

      {canCancel && (
        <ActionButton
          label={t('cancel')}
          busy={busy === 'cancel'}
          color="#c0392b"
          outline
          onPress={() => runAction('cancel', `/api/referrals/${referral.id}/cancel`)}
        />
      )}
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

function ActionButton({
  label,
  onPress,
  busy,
  color,
  outline,
  disabled,
}: {
  label: string;
  onPress: () => void;
  busy: boolean;
  color: string;
  outline?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[
        styles.actionButton,
        outline
          ? { borderWidth: 1.5, borderColor: color, backgroundColor: 'transparent' }
          : { backgroundColor: disabled ? '#9db8b0' : color },
      ]}
      disabled={busy || disabled}
      onPress={onPress}>
      {busy ? (
        <ActivityIndicator color={outline ? color : '#fff'} />
      ) : (
        <Text style={outline ? { color, fontWeight: '700', fontSize: 14 } : styles.actionButtonText}>
          {label}
        </Text>
      )}
    </Pressable>
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
  patientName: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 10,
  },
  healthId: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'SpaceMono',
    marginTop: 2,
    marginBottom: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  row: {
    paddingVertical: 6,
  },
  rowLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  facilityRow: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  modeChip: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modeChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  error: {
    color: '#c0392b',
    fontSize: 13,
    marginBottom: 16,
  },
  actionButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
