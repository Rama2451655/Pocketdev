// src/components/explorer/SearchPanel.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { openFile } from '../../store/editorSlice';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import FileSystemService from '../../services/FileSystemService';

interface SearchResult {
  file: string;
  line: number;
  content: string;
  match: string;
}

const SearchPanel: React.FC = () => {
  const theme = useSelector((s: RootState) => s.settings.theme);
  const currentProject = useSelector((s: RootState) => s.project.currentProject);
  const colors = Colors[theme];
  const dispatch = useDispatch();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !currentProject) return;
    setIsSearching(true);
    try {
      const found = await FileSystemService.searchInFiles(
        currentProject.path,
        query,
        { caseSensitive, regex: useRegex }
      );
      setResults(found);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [query, currentProject, caseSensitive, useRegex]);

  const handleResultPress = async (result: SearchResult) => {
    if (!currentProject) return;
    try {
      const fullPath = `${currentProject.path}/${result.file}`;
      const content = await FileSystemService.readFile(fullPath);
      const fileName = result.file.split('/').pop() || result.file;
      dispatch(openFile({ filePath: fullPath, fileName, content }));
    } catch {}
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.secondary }]}>
      <View style={[styles.header, { borderBottomColor: colors.surface.border }]}>
        <Text style={[styles.title, { color: colors.text.primary }]}>SEARCH</Text>
      </View>

      {/* Search input */}
      <View style={styles.searchBox}>
        <View style={[styles.inputRow, { backgroundColor: colors.bg.elevated, borderColor: colors.surface.border }]}>
          <Icon name="magnify" size={16} color={colors.text.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            placeholder="Search in files..."
            placeholderTextColor={colors.text.muted}
            style={[styles.input, { color: colors.text.primary }]}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query ? (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
              <Icon name="close" size={14} color={colors.text.muted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Options */}
        <View style={styles.options}>
          <TouchableOpacity
            style={[styles.optionBtn, caseSensitive && { backgroundColor: colors.surface.active }]}
            onPress={() => setCaseSensitive(!caseSensitive)}
          >
            <Text style={[styles.optionText, { color: caseSensitive ? colors.accent.blue : colors.text.muted }]}>Aa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionBtn, useRegex && { backgroundColor: colors.surface.active }]}
            onPress={() => setUseRegex(!useRegex)}
          >
            <Text style={[styles.optionText, { color: useRegex ? colors.accent.blue : colors.text.muted }]}>.*</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.searchBtn, { backgroundColor: colors.accent.blue }]}
            onPress={handleSearch}
            disabled={isSearching}
          >
            {isSearching
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.searchBtnText}>Search</Text>
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* Results */}
      <ScrollView style={styles.results} showsVerticalScrollIndicator={false}>
        {results.length > 0 && (
          <Text style={[styles.resultCount, { color: colors.text.muted }]}>
            {results.length} result{results.length !== 1 ? 's' : ''}
          </Text>
        )}
        {results.map((result, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.resultItem, { borderBottomColor: colors.surface.border }]}
            onPress={() => handleResultPress(result)}
          >
            <View style={styles.resultHeader}>
              <Icon name="file-outline" size={12} color={colors.text.muted} />
              <Text style={[styles.resultFile, { color: colors.accent.blue }]} numberOfLines={1}>
                {result.file}
              </Text>
              <Text style={[styles.resultLine, { color: colors.text.muted }]}>:{result.line}</Text>
            </View>
            <Text style={[styles.resultContent, { color: colors.text.secondary }]} numberOfLines={2}>
              {result.content}
            </Text>
          </TouchableOpacity>
        ))}
        {!isSearching && query && results.length === 0 && (
          <View style={styles.noResults}>
            <Text style={[styles.noResultsText, { color: colors.text.muted }]}>No results found</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderBottomWidth: 1 },
  title: { fontSize: 11, fontFamily: Typography.ui.fontFamily, fontWeight: '700', letterSpacing: 0.8 },
  searchBox: { padding: Spacing.sm, gap: Spacing.xs },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    borderRadius: BorderRadius.md, borderWidth: 1,
    paddingHorizontal: Spacing.sm, height: 34,
  },
  input: { flex: 1, fontSize: 13, fontFamily: Typography.ui.fontFamily },
  options: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  optionBtn: { padding: 6, borderRadius: BorderRadius.sm },
  optionText: { fontSize: 12, fontFamily: Typography.code.fontFamily, fontWeight: '700' },
  searchBtn: {
    flex: 1, height: 30, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  results: { flex: 1 },
  resultCount: { padding: Spacing.sm, fontSize: 11, fontFamily: Typography.ui.fontFamily },
  resultItem: { paddingHorizontal: Spacing.sm, paddingVertical: 8, borderBottomWidth: 1, gap: 4 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resultFile: { flex: 1, fontSize: 12, fontFamily: Typography.code.fontFamily },
  resultLine: { fontSize: 12, fontFamily: Typography.code.fontFamily },
  resultContent: { fontSize: 12, fontFamily: Typography.code.fontFamily, lineHeight: 18 },
  noResults: { padding: Spacing.xl, alignItems: 'center' },
  noResultsText: { fontSize: 13, fontFamily: Typography.ui.fontFamily },
});

export default SearchPanel;
