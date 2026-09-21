import { Link } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import type { Patient } from '@swasthya-setu/shared-types';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';

export default function SearchPatientsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { session } = useAuth();
  const { t } = useLanguage();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = async (text: string) => {
    setQuery(text);
    if (!text.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<Patient[]>(session, `/api/patients/search?q=${encodeURIComponent(text)}`);
      setResults(data);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
        placeholder={t('search_placeholder')}
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={runSearch}
        autoCapitalize="none"
      />

      {loading && (
        <View style={{ alignItems: 'center', marginTop: 20 }} lightColor="transparent" darkColor="transparent">
          <LoadingSpinner size={28} />
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: 16 }}
        ListEmptyComponent={
          !loading && searched ? (
            <EmptyState icon="search-outline" message={`${t('search_noResults')} "${query}".`} />
          ) : null
        }
        renderItem={({ item }) => (
          <Link href={`/patients/${item.healthId}`} asChild>
            <Pressable
              style={StyleSheet.flatten([
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ])}>
              <Text style={styles.name}>{item.fullName}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>
                {item.healthId} · {item.sex} · {item.dateOfBirth}
              </Text>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: 'SpaceMono',
  },
});
