// src/screens/SettingsScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Switch, TextInput, Alert, SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { RootState } from '../store';
import { updateSettings, toggleTheme, setAIApiKey } from '../store/settingsSlice';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';

const SettingsScreen: React.FC = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const settings = useSelector((s: RootState) => s.settings);
  const theme = settings.theme;
  const colors = Colors[theme];

  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(settings.aiApiKey);
  const [tempGitName, setTempGitName] = useState(settings.gitUserName);
  const [tempGitEmail, setTempGitEmail] = useState(settings.gitUserEmail);
  const [tempServerUrl, setTempServerUrl] = useState(settings.executionServer);

  const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text.muted }]}>{title.toUpperCase()}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.bg.secondary, borderColor: colors.surface.border }]}>
        {children}
      </View>
    </View>
  );

  const SettingRow: React.FC<{
    icon: string;
    iconColor?: string;
    label: string;
    description?: string;
    right?: React.ReactNode;
    onPress?: () => void;
  }> = ({ icon, iconColor, label, description, right, onPress }) => (
    <TouchableOpacity
      style={[styles.settingRow, { borderBottomColor: colors.surface.border }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.rowIcon, { backgroundColor: (iconColor || colors.accent.blue) + '20' }]}>
        <Icon name={icon} size={18} color={iconColor || colors.accent.blue} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: colors.text.primary }]}>{label}</Text>
        {description && (
          <Text style={[styles.rowDesc, { color: colors.text.muted }]}>{description}</Text>
        )}
      </View>
      {right || (onPress && (
        <Icon name="chevron-right" size={16} color={colors.text.muted} />
      ))}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bg.secondary, borderBottomColor: colors.surface.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Appearance */}
        <Section title="Appearance">
          <SettingRow
            icon={theme === 'dark' ? 'weather-night' : 'weather-sunny'}
            iconColor={theme === 'dark' ? '#BC8CFF' : '#F2CC60'}
            label="Theme"
            description={theme === 'dark' ? 'Dark mode' : 'Light mode'}
            right={
              <Switch
                value={theme === 'dark'}
                onValueChange={() => dispatch(toggleTheme())}
                trackColor={{ false: colors.surface.border, true: colors.accent.blue }}
                thumbColor="#fff"
              />
            }
          />
          <SettingRow
            icon="format-size"
            iconColor={colors.accent.blue}
            label="Font Size"
            description={`${settings.fontSize}px`}
            right={
              <View style={styles.stepRow}>
                <TouchableOpacity
                  style={[styles.stepBtn, { backgroundColor: colors.surface.default }]}
                  onPress={() => dispatch(updateSettings({ fontSize: Math.max(8, settings.fontSize - 1) }))}
                >
                  <Icon name="minus" size={14} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={[styles.stepValue, { color: colors.text.primary }]}>{settings.fontSize}</Text>
                <TouchableOpacity
                  style={[styles.stepBtn, { backgroundColor: colors.surface.default }]}
                  onPress={() => dispatch(updateSettings({ fontSize: Math.min(32, settings.fontSize + 1) }))}
                >
                  <Icon name="plus" size={14} color={colors.text.primary} />
                </TouchableOpacity>
              </View>
            }
          />
          <SettingRow
            icon="wrap"
            label="Word Wrap"
            right={
              <Switch
                value={settings.wordWrap}
                onValueChange={(v) => dispatch(updateSettings({ wordWrap: v }))}
                trackColor={{ false: colors.surface.border, true: colors.accent.blue }}
                thumbColor="#fff"
              />
            }
          />
          <SettingRow
            icon="format-list-numbered"
            label="Line Numbers"
            right={
              <Switch
                value={settings.showLineNumbers}
                onValueChange={(v) => dispatch(updateSettings({ showLineNumbers: v }))}
                trackColor={{ false: colors.surface.border, true: colors.accent.blue }}
                thumbColor="#fff"
              />
            }
          />
          <SettingRow
            icon="map-outline"
            label="Minimap"
            right={
              <Switch
                value={settings.showMinimap}
                onValueChange={(v) => dispatch(updateSettings({ showMinimap: v }))}
                trackColor={{ false: colors.surface.border, true: colors.accent.blue }}
                thumbColor="#fff"
              />
            }
          />
        </Section>

        {/* Editor */}
        <Section title="Editor">
          <SettingRow
            icon="content-save-outline"
            iconColor={colors.accent.green}
            label="Auto Save"
            right={
              <Switch
                value={settings.autoSave}
                onValueChange={(v) => dispatch(updateSettings({ autoSave: v }))}
                trackColor={{ false: colors.surface.border, true: colors.accent.blue }}
                thumbColor="#fff"
              />
            }
          />
          <SettingRow
            icon="format-indent-increase"
            label="Tab Size"
            description={`${settings.tabSize} spaces`}
            right={
              <View style={styles.stepRow}>
                {[2, 4, 8].map(size => (
                  <TouchableOpacity
                    key={size}
                    style={[
                      styles.tabSizeBtn,
                      { backgroundColor: settings.tabSize === size ? colors.accent.blue : colors.surface.default },
                    ]}
                    onPress={() => dispatch(updateSettings({ tabSize: size }))}
                  >
                    <Text style={[styles.tabSizeText, { color: settings.tabSize === size ? '#fff' : colors.text.secondary }]}>
                      {size}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            }
          />
          <SettingRow
            icon="flash-outline"
            label="Format on Save"
            right={
              <Switch
                value={settings.formatOnSave}
                onValueChange={(v) => dispatch(updateSettings({ formatOnSave: v }))}
                trackColor={{ false: colors.surface.border, true: colors.accent.blue }}
                thumbColor="#fff"
              />
            }
          />
        </Section>

        {/* AI Settings */}
        <Section title="AI Assistant">
          <SettingRow
            icon="robot-outline"
            iconColor="#BC8CFF"
            label="AI Suggestions"
            right={
              <Switch
                value={settings.aiEnabled}
                onValueChange={(v) => dispatch(updateSettings({ aiEnabled: v }))}
                trackColor={{ false: colors.surface.border, true: colors.accent.blue }}
                thumbColor="#fff"
              />
            }
          />
          <View style={styles.settingRow}>
            <View style={[styles.rowIcon, { backgroundColor: '#BC8CFF20' }]}>
              <Icon name="key-outline" size={18} color="#BC8CFF" />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowLabel, { color: colors.text.primary }]}>Anthropic API Key</Text>
              <TextInput
                value={tempApiKey}
                onChangeText={setTempApiKey}
                onBlur={() => dispatch(setAIApiKey(tempApiKey))}
                placeholder="sk-ant-..."
                placeholderTextColor={colors.text.muted}
                secureTextEntry={!apiKeyVisible}
                style={[styles.inlineInput, { color: colors.text.primary }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <TouchableOpacity onPress={() => setApiKeyVisible(!apiKeyVisible)}>
              <Icon name={apiKeyVisible ? 'eye-off' : 'eye'} size={18} color={colors.text.muted} />
            </TouchableOpacity>
          </View>
          <SettingRow
            icon="brain"
            iconColor="#BC8CFF"
            label="AI Model"
            description={settings.aiModel}
            onPress={() => Alert.alert('Model Selection', 'Choose AI model', [
              { text: 'Claude Sonnet 4', onPress: () => dispatch(updateSettings({ aiModel: 'claude-sonnet-4-20250514' })) },
              { text: 'Claude Opus 4', onPress: () => dispatch(updateSettings({ aiModel: 'claude-opus-4-20250514' })) },
              { text: 'Cancel', style: 'cancel' },
            ])}
          />
        </Section>

        {/* Git Config */}
        <Section title="Git">
          <View style={styles.settingRow}>
            <View style={[styles.rowIcon, { backgroundColor: '#F0583320' }]}>
              <Icon name="account-outline" size={18} color="#F05833" />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowLabel, { color: colors.text.primary }]}>Git Username</Text>
              <TextInput
                value={tempGitName}
                onChangeText={setTempGitName}
                onBlur={() => dispatch(updateSettings({ gitUserName: tempGitName }))}
                placeholder="Your Name"
                placeholderTextColor={colors.text.muted}
                style={[styles.inlineInput, { color: colors.text.primary }]}
              />
            </View>
          </View>
          <View style={styles.settingRow}>
            <View style={[styles.rowIcon, { backgroundColor: '#F0583320' }]}>
              <Icon name="email-outline" size={18} color="#F05833" />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowLabel, { color: colors.text.primary }]}>Git Email</Text>
              <TextInput
                value={tempGitEmail}
                onChangeText={setTempGitEmail}
                onBlur={() => dispatch(updateSettings({ gitUserEmail: tempGitEmail }))}
                placeholder="you@example.com"
                placeholderTextColor={colors.text.muted}
                keyboardType="email-address"
                style={[styles.inlineInput, { color: colors.text.primary }]}
                autoCapitalize="none"
              />
            </View>
          </View>
        </Section>

        {/* Execution */}
        <Section title="Execution">
          <View style={styles.settingRow}>
            <View style={[styles.rowIcon, { backgroundColor: colors.accent.green + '20' }]}>
              <Icon name="server-outline" size={18} color={colors.accent.green} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowLabel, { color: colors.text.primary }]}>Execution Server</Text>
              <TextInput
                value={tempServerUrl}
                onChangeText={setTempServerUrl}
                onBlur={() => dispatch(updateSettings({ executionServer: tempServerUrl }))}
                placeholder="https://api.pocketdev.io/v1"
                placeholderTextColor={colors.text.muted}
                style={[styles.inlineInput, { color: colors.text.primary }]}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>
          </View>
          <SettingRow
            icon="wifi-off"
            iconColor={colors.accent.yellow}
            label="Offline Mode"
            right={
              <Switch
                value={settings.offlineMode}
                onValueChange={(v) => dispatch(updateSettings({ offlineMode: v }))}
                trackColor={{ false: colors.surface.border, true: colors.accent.blue }}
                thumbColor="#fff"
              />
            }
          />
        </Section>

        {/* UX */}
        <Section title="Experience">
          <SettingRow
            icon="vibrate"
            label="Haptic Feedback"
            right={
              <Switch
                value={settings.hapticFeedback}
                onValueChange={(v) => dispatch(updateSettings({ hapticFeedback: v }))}
                trackColor={{ false: colors.surface.border, true: colors.accent.blue }}
                thumbColor="#fff"
              />
            }
          />
          <SettingRow
            icon="bell-outline"
            label="Notifications"
            right={
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={(v) => dispatch(updateSettings({ notificationsEnabled: v }))}
                trackColor={{ false: colors.surface.border, true: colors.accent.blue }}
                thumbColor="#fff"
              />
            }
          />
        </Section>

        {/* About */}
        <Section title="About">
          <SettingRow icon="information-outline" label="Version" description="PocketDev IDE 1.0.0" />
          <SettingRow icon="code-braces" label="Monaco Editor" description="v0.45.0" />
          <SettingRow
            icon="github"
            iconColor={colors.text.primary}
            label="GitHub"
            description="github.com/pocketdev/ide"
            onPress={() => {}}
          />
          <SettingRow
            icon="bug-outline"
            iconColor={colors.status.error}
            label="Report a Bug"
            onPress={() => Alert.alert('Bug Report', 'Please open an issue on GitHub')}
          />
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.md, borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: Typography.ui.fontFamily, fontWeight: '700' },
  scroll: { flex: 1 },
  section: { marginTop: Spacing.xl, paddingHorizontal: Spacing.lg },
  sectionTitle: {
    fontSize: 11, fontFamily: Typography.ui.fontFamily,
    fontWeight: '700', letterSpacing: 0.8, marginBottom: Spacing.xs,
  },
  sectionCard: { borderRadius: BorderRadius.xl, borderWidth: 1, overflow: 'hidden' },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderBottomWidth: 1,
  },
  rowIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 14, fontFamily: Typography.ui.fontFamily, fontWeight: '500' },
  rowDesc: { fontSize: 11, fontFamily: Typography.ui.fontFamily, marginTop: 2 },
  inlineInput: { fontSize: 12, fontFamily: Typography.code.fontFamily, marginTop: 2 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: 14, fontFamily: Typography.ui.fontFamily, fontWeight: '600', minWidth: 24, textAlign: 'center' },
  tabSizeBtn: { width: 32, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  tabSizeText: { fontSize: 12, fontFamily: Typography.code.fontFamily, fontWeight: '600' },
});

export default SettingsScreen;
