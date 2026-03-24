// src/components/extensions/ExtensionsPanel.tsx
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

interface Extension {
  id: string;
  name: string;
  description: string;
  author: string;
  icon: string;
  iconColor: string;
  installed: boolean;
  enabled: boolean;
  version: string;
  downloads: string;
  category: 'language' | 'theme' | 'linter' | 'formatter' | 'tool';
}

const BUILT_IN_EXTENSIONS: Extension[] = [
  {
    id: 'prettier',
    name: 'Prettier',
    description: 'Opinionated code formatter for JS, TS, CSS, JSON',
    author: 'Prettier',
    icon: 'format-align-left',
    iconColor: '#F7B93E',
    installed: true,
    enabled: true,
    version: '3.1.1',
    downloads: '2.1M',
    category: 'formatter',
  },
  {
    id: 'eslint',
    name: 'ESLint',
    description: 'JavaScript / TypeScript linting',
    author: 'ESLint',
    icon: 'alert-circle-outline',
    iconColor: '#4B32C3',
    installed: true,
    enabled: true,
    version: '8.57.0',
    downloads: '1.8M',
    category: 'linter',
  },
  {
    id: 'git-lens',
    name: 'GitLens',
    description: 'Git supercharged – blame, history, compare',
    author: 'GitKraken',
    icon: 'source-branch',
    iconColor: '#F05133',
    installed: true,
    enabled: false,
    version: '14.9.1',
    downloads: '950K',
    category: 'tool',
  },
  {
    id: 'python-ext',
    name: 'Python',
    description: 'Full Python support, debugging, IntelliSense',
    author: 'Microsoft',
    icon: 'language-python',
    iconColor: '#3776AB',
    installed: true,
    enabled: true,
    version: '2023.22.0',
    downloads: '3.2M',
    category: 'language',
  },
  {
    id: 'java-ext',
    name: 'Java Extension Pack',
    description: 'Java development tools: debug, test, Maven',
    author: 'Microsoft',
    icon: 'language-java',
    iconColor: '#ED8B00',
    installed: false,
    enabled: false,
    version: '0.25.13',
    downloads: '750K',
    category: 'language',
  },
  {
    id: 'rust-analyzer',
    name: 'Rust Analyzer',
    description: 'Rust language support with advanced IntelliSense',
    author: 'rust-lang',
    icon: 'cog',
    iconColor: '#CE422B',
    installed: false,
    enabled: false,
    version: '0.3.1823',
    downloads: '420K',
    category: 'language',
  },
  {
    id: 'go-ext',
    name: 'Go',
    description: 'Full Go language support',
    author: 'Google',
    icon: 'language-go',
    iconColor: '#00ADD8',
    installed: false,
    enabled: false,
    version: '0.41.1',
    downloads: '680K',
    category: 'language',
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    description: 'AI pair programmer (requires GitHub subscription)',
    author: 'GitHub',
    icon: 'robot-outline',
    iconColor: '#24292E',
    installed: false,
    enabled: false,
    version: '1.148.0',
    downloads: '5.2M',
    category: 'tool',
  },
  {
    id: 'docker-ext',
    name: 'Docker',
    description: 'Dockerfile syntax, container management',
    author: 'Microsoft',
    icon: 'docker',
    iconColor: '#2496ED',
    installed: false,
    enabled: false,
    version: '1.28.0',
    downloads: '1.1M',
    category: 'tool',
  },
  {
    id: 'dracula-theme',
    name: 'Dracula Theme',
    description: 'Dark theme with vibrant colors',
    author: 'Dracula',
    icon: 'palette-outline',
    iconColor: '#BD93F9',
    installed: false,
    enabled: false,
    version: '3.0.0',
    downloads: '2.8M',
    category: 'theme',
  },
  {
    id: 'material-theme',
    name: 'Material Theme',
    description: 'Google Material Design inspired theme',
    author: 'Equinusocio',
    icon: 'palette',
    iconColor: '#89DDFF',
    installed: false,
    enabled: false,
    version: '33.10.4',
    downloads: '1.9M',
    category: 'theme',
  },
];

const CATEGORIES = ['all', 'language', 'formatter', 'linter', 'tool', 'theme'] as const;

const ExtensionsPanel: React.FC = () => {
  const theme = useSelector((s: RootState) => s.settings.theme);
  const colors = Colors[theme];

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [extensions, setExtensions] = useState(BUILT_IN_EXTENSIONS);
  const [activeTab, setActiveTab] = useState<'marketplace' | 'installed'>('marketplace');

  const filtered = extensions.filter(ext => {
    const matchSearch = !search ||
      ext.name.toLowerCase().includes(search.toLowerCase()) ||
      ext.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = activeCategory === 'all' || ext.category === activeCategory;
    const matchTab = activeTab === 'marketplace' || ext.installed;
    return matchSearch && matchCategory && matchTab;
  });

  const toggleInstall = (id: string) => {
    setExtensions(prev => prev.map(e =>
      e.id === id ? { ...e, installed: !e.installed, enabled: !e.installed } : e
    ));
  };

  const toggleEnable = (id: string) => {
    setExtensions(prev => prev.map(e =>
      e.id === id ? { ...e, enabled: !e.enabled } : e
    ));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.secondary }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.surface.border }]}>
        <Text style={[styles.title, { color: colors.text.primary }]}>EXTENSIONS</Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.surface.border }]}>
        {(['marketplace', 'installed'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && { borderBottomColor: colors.accent.blue, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, { color: activeTab === tab ? colors.text.primary : colors.text.muted }]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'installed' && ` (${extensions.filter(e => e.installed).length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={[styles.searchRow, { backgroundColor: colors.bg.elevated, borderColor: colors.surface.border }]}>
        <Icon name="magnify" size={14} color={colors.text.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search extensions..."
          placeholderTextColor={colors.text.muted}
          style={[styles.searchInput, { color: colors.text.primary }]}
        />
      </View>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categories}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.catChip,
              { borderColor: colors.surface.border },
              activeCategory === cat && { backgroundColor: colors.accent.blue, borderColor: colors.accent.blue },
            ]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text style={[styles.catText, { color: activeCategory === cat ? '#fff' : colors.text.secondary }]}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Extension list */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.map(ext => (
          <View
            key={ext.id}
            style={[styles.extCard, { backgroundColor: colors.bg.elevated, borderColor: colors.surface.border }]}
          >
            {/* Icon + info */}
            <View style={[styles.extIcon, { backgroundColor: ext.iconColor + '20' }]}>
              <Icon name={ext.icon} size={24} color={ext.iconColor} />
            </View>
            <View style={styles.extInfo}>
              <View style={styles.extNameRow}>
                <Text style={[styles.extName, { color: colors.text.primary }]}>{ext.name}</Text>
                <Text style={[styles.extVersion, { color: colors.text.muted }]}>v{ext.version}</Text>
              </View>
              <Text style={[styles.extDesc, { color: colors.text.secondary }]} numberOfLines={2}>
                {ext.description}
              </Text>
              <View style={styles.extMeta}>
                <Text style={[styles.extAuthor, { color: colors.text.muted }]}>{ext.author}</Text>
                <Text style={[styles.extDownloads, { color: colors.text.muted }]}>
                  ↓ {ext.downloads}
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.extActions}>
              {ext.installed ? (
                <>
                  <Switch
                    value={ext.enabled}
                    onValueChange={() => toggleEnable(ext.id)}
                    trackColor={{ false: colors.surface.border, true: colors.accent.blue }}
                    thumbColor="#fff"
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />
                  <TouchableOpacity
                    onPress={() => toggleInstall(ext.id)}
                    style={styles.uninstallBtn}
                  >
                    <Text style={[styles.uninstallText, { color: colors.status.error }]}>Uninstall</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.installBtn, { backgroundColor: colors.accent.blue }]}
                  onPress={() => toggleInstall(ext.id)}
                >
                  <Text style={styles.installBtnText}>Install</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderBottomWidth: 1 },
  title: { fontSize: 11, fontFamily: Typography.ui.fontFamily, fontWeight: '700', letterSpacing: 0.8 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: {
    flex: 1, paddingVertical: 8, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 12, fontFamily: Typography.ui.fontFamily, fontWeight: '600' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    marginHorizontal: Spacing.sm, marginVertical: Spacing.xs,
    borderRadius: BorderRadius.md, borderWidth: 1,
    paddingHorizontal: Spacing.sm, height: 32,
  },
  searchInput: { flex: 1, fontSize: 12, fontFamily: Typography.ui.fontFamily },
  categories: { maxHeight: 36, paddingHorizontal: Spacing.xs },
  catChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full,
    borderWidth: 1, marginHorizontal: 3, marginVertical: 4,
  },
  catText: { fontSize: 11, fontFamily: Typography.ui.fontFamily },
  list: { flex: 1, padding: Spacing.xs },
  extCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderRadius: BorderRadius.md, borderWidth: 1,
    padding: Spacing.sm, marginBottom: Spacing.xs, gap: Spacing.sm,
  },
  extIcon: {
    width: 40, height: 40, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  extInfo: { flex: 1 },
  extNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  extName: { fontSize: 13, fontFamily: Typography.ui.fontFamily, fontWeight: '600' },
  extVersion: { fontSize: 10, fontFamily: Typography.code.fontFamily },
  extDesc: { fontSize: 11, fontFamily: Typography.ui.fontFamily, lineHeight: 16, marginBottom: 4 },
  extMeta: { flexDirection: 'row', gap: 8 },
  extAuthor: { fontSize: 10, fontFamily: Typography.ui.fontFamily },
  extDownloads: { fontSize: 10, fontFamily: Typography.ui.fontFamily },
  extActions: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  installBtn: {
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderRadius: BorderRadius.md,
  },
  installBtnText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  uninstallBtn: { paddingVertical: 2 },
  uninstallText: { fontSize: 10, fontFamily: Typography.ui.fontFamily },
});

export default ExtensionsPanel;
