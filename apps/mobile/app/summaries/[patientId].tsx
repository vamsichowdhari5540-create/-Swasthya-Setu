import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import type { AiSummary } from '@swasthya-setu/shared-types';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';

const TRIAGE_COLORS: Record<string, string> = {
  routine: '#2e7d32',
  priority: '#b7791f',
  urgent: '#c0392b',
};

export default function SummariesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { session, profile } = useAuth();
  const { t } = useLanguage();
  const { patientId, patientName } = useLocalSearchParams<{ patientId: string; patientName?: string }>();

  const [summaries, setSummaries] = useState<AiSummary[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<AiSummary[]>(session, `/api/patients/${patientId}/summaries`);
      setSummaries(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load summaries.');
    }
  }, [session, patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await apiFetch<AiSummary>(session, `/api/patients/${patientId}/summaries`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate a summary.');
    } finally {
      setGenerating(false);
    }
  };

  const saveEdit = async (id: string) => {
    const editedText = drafts[id]?.trim();
    if (!editedText) return;
    setBusyId(id);
    try {
      await apiFetch<AiSummary>(session, `/api/summaries/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ editedText }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the edit.');
    } finally {
      setBusyId(null);
    }
  };

  const approve = async (id: string) => {
    setBusyId(id);
    try {
      const editedText = drafts[id]?.trim();
      await apiFetch<AiSummary>(session, `/api/summaries/${id}/approve`, {
        method: 'PATCH',
        body: JSON.stringify(editedText ? { editedText } : {}),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not approve this summary.');
    } finally {
      setBusyId(null);
    }
  };

  const canReview = profile?.role === 'doctor';
  const canGenerate = profile?.role === 'anm_asha' || profile?.role === 'doctor';

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={styles.title}>AI Summary{patientName ? ` — ${patientName}` : ''}</Text>
      <Text style={[styles.note, { color: colors.muted }]}>
        Assistive draft only, built from this patient&apos;s recorded visits — never an autonomous diagnosis.
        {canReview ? ' Review, edit if needed, then approve.' : ' A doctor must approve before this is final.'}
      </Text>

      {canGenerate && (
        <Pressable
          style={[styles.button, { backgroundColor: colors.tint, opacity: generating ? 0.6 : 1 }]}
          disabled={generating}
          onPress={generate}>
          {generating ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('summary_generate')}</Text>}
        </Pressable>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      {summaries === null && <ActivityIndicator color={colors.tint} style={{ marginTop: 20 }} />}
      {summaries?.length === 0 && (
        <Text style={[styles.note, { color: colors.muted, marginTop: 12 }]}>{t('summary_none')}</Text>
      )}

      {summaries?.map((summary) => {
        const isDraft = summary.status === 'draft';
        const currentText = drafts[summary.id] ?? summary.editedText ?? summary.draftText;
        return (
          <View key={summary.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.rowBetween} lightColor="transparent" darkColor="transparent">
              <Text style={[styles.badge, { color: isDraft ? '#b7791f' : '#2e7d32' }]}>
                {isDraft ? 'DRAFT — pending review' : 'APPROVED'}
              </Text>
              <Text style={[styles.meta, { color: colors.muted }]}>
                {new Date(summary.createdAt).toLocaleString()}
              </Text>
            </View>

            {summary.triageLevel && (
              <Text style={[styles.triage, { color: TRIAGE_COLORS[summary.triageLevel] }]}>
                Triage signal: {summary.triageLevel.toUpperCase()} — {summary.triageRationale}
              </Text>
            )}

            {isDraft && canReview ? (
              <TextInput
                style={[
                  styles.input,
                  { borderColor: colors.border, color: colors.text, backgroundColor: colors.background },
                ]}
                value={currentText}
                onChangeText={(text) => setDrafts((prev) => ({ ...prev, [summary.id]: text }))}
                multiline
              />
            ) : (
              <Text style={styles.body}>{summary.editedText ?? summary.draftText}</Text>
            )}

            {isDraft && canReview && (
              <View style={styles.rowBetween} lightColor="transparent" darkColor="transparent">
                <Pressable
                  style={[styles.secondaryButton, { borderColor: colors.tint }]}
                  disabled={busyId === summary.id}
                  onPress={() => saveEdit(summary.id)}>
                  <Text style={[styles.secondaryButtonText, { color: colors.tint }]}>{t('summary_saveEdit')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, { backgroundColor: colors.tint, paddingHorizontal: 16 }]}
                  disabled={busyId === summary.id}
                  onPress={() => approve(summary.id)}>
                  {busyId === summary.id ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>{t('summary_approve')}</Text>
                  )}
                </Pressable>
              </View>
            )}

            <Text style={[styles.footer, { color: colors.muted }]}>
              {summary.source === 'template' ? 'Source: deterministic template' : `Model: ${summary.model} (${summary.source})`} · v
              {summary.modelVersion} · by {summary.createdByName}
              {summary.status === 'approved' && summary.reviewedByName
                ? ` · approved by ${summary.reviewedByName}`
                : ''}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  note: { fontSize: 13, marginBottom: 16 },
  button: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 16 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  secondaryButton: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  secondaryButtonText: { fontWeight: '700', fontSize: 13 },
  error: { color: '#c0392b', fontSize: 13, marginBottom: 12 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  badge: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  meta: { fontSize: 11 },
  triage: { fontSize: 12, fontWeight: '700', marginBottom: 10 },
  body: { fontSize: 14, marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 90, textAlignVertical: 'top', marginBottom: 10 },
  footer: { fontSize: 10, marginTop: 4 },
});
