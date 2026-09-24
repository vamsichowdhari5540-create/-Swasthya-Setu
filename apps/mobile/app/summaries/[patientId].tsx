import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import type { AiSummary, SummaryEntry } from '@swasthya-setu/shared-types';
import { parseSummaryEntries } from '@swasthya-setu/shared-types';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';

const TRIAGE_COLORS: Record<string, string> = {
  routine: '#2e7d32',
  priority: '#b7791f',
  urgent: '#c0392b',
};

// One editable line per visit, e.g. "12 Sep 2026 — Head — Headache: BP
//162/98, advised low-salt diet". Lets a doctor edit structured entries as
// plain text instead of raw JSON, under time pressure.
function formatEntriesAsLines(entries: SummaryEntry[]): string {
  return entries
    .map((e) => {
      const head = [e.date, e.bodyPart, e.complaint].filter(Boolean).join(' — ');
      return head ? `${head}: ${e.note}` : e.note;
    })
    .join('\n');
}

function parseLinesAsEntries(text: string): SummaryEntry[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const colonIndex = line.indexOf(': ');
      if (colonIndex === -1) return { date: '', bodyPart: '', complaint: '', note: line };
      const [date = '', bodyPart = '', complaint = ''] = line.slice(0, colonIndex).split(' — ');
      return { date, bodyPart, complaint, note: line.slice(colonIndex + 2) };
    });
}

function SummaryEntries({ entries, colors }: { entries: SummaryEntry[]; colors: (typeof Colors)['light'] }) {
  return (
    <View lightColor="transparent" darkColor="transparent">
      {entries.map((entry, index) => (
        <View
          key={index}
          style={[styles.entryRow, { borderLeftColor: colors.tint }]}
          lightColor="transparent"
          darkColor="transparent">
          <View style={styles.entryHeader} lightColor="transparent" darkColor="transparent">
            {!!entry.date && <Text style={styles.entryDate}>{entry.date}</Text>}
            {!!entry.bodyPart && (
              <Text style={[styles.entryBadge, { color: colors.tint, borderColor: colors.tint }]}>
                {entry.bodyPart}
              </Text>
            )}
          </View>
          {!!entry.complaint && <Text style={styles.entryComplaint}>{entry.complaint}</Text>}
          <Text style={[styles.entryNote, { color: colors.muted }]}>{entry.note}</Text>
        </View>
      ))}
    </View>
  );
}

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

  // drafts[id] holds the doctor-edited text as one line per visit (see
  // formatEntriesAsLines). If the summary being edited was structured
  // entries, those lines are re-parsed back into the same JSON shape before
  // saving; a legacy plain-prose summary is saved as-is.
  const editedTextFor = (summary: AiSummary): string | undefined => {
    const lines = drafts[summary.id]?.trim();
    if (!lines) return undefined;
    const original = parseSummaryEntries(summary.editedText ?? summary.draftText);
    return original ? JSON.stringify(parseLinesAsEntries(lines)) : lines;
  };

  const saveEdit = async (summary: AiSummary) => {
    const editedText = editedTextFor(summary);
    if (!editedText) return;
    setBusyId(summary.id);
    try {
      await apiFetch<AiSummary>(session, `/api/summaries/${summary.id}`, {
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

  const approve = async (summary: AiSummary) => {
    setBusyId(summary.id);
    try {
      const editedText = editedTextFor(summary);
      await apiFetch<AiSummary>(session, `/api/summaries/${summary.id}/approve`, {
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
      {summaries === null && (
        <View style={{ alignItems: 'center', marginTop: 20 }} lightColor="transparent" darkColor="transparent">
          <LoadingSpinner size={28} />
        </View>
      )}
      {summaries?.length === 0 && <EmptyState icon="sparkles-outline" message={t('summary_none')} />}

      {summaries?.map((summary) => {
        const isDraft = summary.status === 'draft';
        const rawText = summary.editedText ?? summary.draftText;
        const entries = parseSummaryEntries(rawText);
        const currentLines = drafts[summary.id] ?? (entries ? formatEntriesAsLines(entries) : rawText);
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
                value={currentLines}
                onChangeText={(text) => setDrafts((prev) => ({ ...prev, [summary.id]: text }))}
                multiline
              />
            ) : entries ? (
              <SummaryEntries entries={entries} colors={colors} />
            ) : (
              <Text style={styles.body}>{rawText}</Text>
            )}

            {isDraft && canReview && (
              <View style={styles.rowBetween} lightColor="transparent" darkColor="transparent">
                <Pressable
                  style={[styles.secondaryButton, { borderColor: colors.tint }]}
                  disabled={busyId === summary.id}
                  onPress={() => saveEdit(summary)}>
                  <Text style={[styles.secondaryButtonText, { color: colors.tint }]}>{t('summary_saveEdit')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, { backgroundColor: colors.tint, paddingHorizontal: 16 }]}
                  disabled={busyId === summary.id}
                  onPress={() => approve(summary)}>
                  {busyId === summary.id ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>{t('summary_approve')}</Text>
                  )}
                </Pressable>
              </View>
            )}

            <Text style={[styles.footer, { color: colors.muted }]}>
              By {summary.createdByName}
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
  entryRow: { borderLeftWidth: 3, paddingLeft: 10, marginBottom: 12 },
  entryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  entryDate: { fontSize: 12, fontWeight: '700', marginRight: 8 },
  entryBadge: { fontSize: 10, fontWeight: '700', borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, textTransform: 'uppercase' },
  entryComplaint: { fontSize: 13.5, fontWeight: '600', marginBottom: 2 },
  entryNote: { fontSize: 13 },
});
