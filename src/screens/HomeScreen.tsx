// src/screens/HomeScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, Modal, Alert, ActivityIndicator,
  SafeAreaView, StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { RootState } from '../store';
import { setCurrentProject, Project } from '../store/projectSlice';
import { setFileTree } from '../store/projectSlice';
import { Colors, Typography, Spacing, BorderRadius, LanguageColors } from '../theme';
import FileSystemService from '../services/FileSystemService';
import GitService from '../services/GitService';

type ProjectTemplate = {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  description: string;
  tags: string[];
  language: string;
};

const PROJECT_TEMPLATES: ProjectTemplate[] = [
  { id: 'mern', name: 'MERN Stack', icon: 'react', iconColor: '#61DAFB', description: 'MongoDB, Express, React, Node.js', tags: ['fullstack', 'js'], language: 'javascript' },
  { id: 'django', name: 'Django REST', icon: 'language-python', iconColor: '#3776AB', description: 'Django + DRF + PostgreSQL', tags: ['fullstack', 'python'], language: 'python' },
  { id: 'flask', name: 'Flask API', icon: 'language-python', iconColor: '#3776AB', description: 'Flask + SQLAlchemy + JWT', tags: ['backend', 'python'], language: 'python' },
  { id: 'spring-boot', name: 'Spring Boot', icon: 'language-java', iconColor: '#ED8B00', description: 'Java Spring Boot REST API', tags: ['backend', 'java'], language: 'java' },
  { id: 'express', name: 'Express API', icon: 'nodejs', iconColor: '#339933', description: 'Express.js REST API', tags: ['backend', 'js'], language: 'javascript' },
  { id: 'go-api', name: 'Go REST API', icon: 'language-go', iconColor: '#00ADD8', description: 'Go + Gorilla Mux REST API', tags: ['backend', 'go'], language: 'go' },
  { id: 'react-native', name: 'React Native', icon: 'react', iconColor: '#61DAFB', description: 'Mobile app with React Native', tags: ['mobile', 'js'], language: 'javascript' },
  { id: 'rust-cli', name: 'Rust CLI', icon: 'cog', iconColor: '#CE422B', description: 'Command-line app in Rust', tags: ['cli', 'rust'], language: 'rust' },
  { id: 'python-script', name: 'Python Script', icon: 'language-python', iconColor: '#3776AB', description: 'Python script with logging', tags: ['script', 'python'], language: 'python' },
  { id: 'blank', name: 'Blank Project', icon: 'file-outline', iconColor: '#8B949E', description: 'Start from scratch', tags: ['blank'], language: 'javascript' },
];

const HomeScreen: React.FC = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();
  const theme = useSelector((s: RootState) => s.settings.theme);
  const recentProjects = useSelector((s: RootState) => s.project.recentProjects);
  const colors = Colors[theme];

  const [recentOnDisk, setRecentOnDisk] = useState<string[]>([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showCloneProject, setShowCloneProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('blank');
  const [cloneUrl, setCloneUrl] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    loadRecentProjects();
  }, []);

  const loadRecentProjects = async () => {
    try {
      const projects = await FileSystemService.listProjects();
      setRecentOnDisk(projects);
    } catch {}
  };

  const openProject = async (projectName: string) => {
    const projectPath = FileSystemService.getProjectPath(projectName);
    setIsCreating(true);
    try {
      const fileTree = await FileSystemService.buildFileTree(projectPath);
      const project: Project = {
        id: `proj_${projectName}`,
        name: projectName,
        path: projectPath,
        template: 'blank',
        createdAt: Date.now(),
        lastOpened: Date.now(),
        gitEnabled: false,
        language: 'javascript',
        tags: [],
      };
      dispatch(setCurrentProject(project));
      dispatch(setFileTree(fileTree));
      navigation.navigate('Editor');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const createProject = async () => {
    const name = newProjectName.trim();
    if (!name) {
      Alert.alert('Error', 'Please enter a project name');
      return;
    }
    setIsCreating(true);
    try {
      const projectPath = await FileSystemService.createProjectFromTemplate(
        name,
        selectedTemplate,
        (msg) => console.log(msg)
      );
      const fileTree = await FileSystemService.buildFileTree(projectPath);
      const project: Project = {
        id: `proj_${Date.now()}`,
        name,
        path: projectPath,
        template: selectedTemplate as any,
        createdAt: Date.now(),
        lastOpened: Date.now(),
        gitEnabled: false,
        language: PROJECT_TEMPLATES.find(t => t.id === selectedTemplate)?.language || 'javascript',
        tags: [],
      };
      dispatch(setCurrentProject(project));
      dispatch(setFileTree(fileTree));
      setShowNewProject(false);
      setNewProjectName('');
      await loadRecentProjects();
      navigation.navigate('Editor');
    } catch (err: any) {
      Alert.alert('Create Failed', err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const cloneProject = async () => {
    if (!cloneUrl.trim()) {
      Alert.alert('Error', 'Please enter a repository URL');
      return;
    }
    setIsCreating(true);
    try {
      const repoName = cloneUrl.split('/').pop()?.replace('.git', '') || 'cloned-repo';
      const destPath = FileSystemService.getProjectPath(repoName);
      await FileSystemService.createDirectory(destPath);
      await GitService.clone(cloneUrl, destPath, (progress) => {
        console.log('Clone progress:', progress.phase);
      });
      await openProject(repoName);
      setShowCloneProject(false);
      setCloneUrl('');
    } catch (err: any) {
      Alert.alert('Clone Failed', err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const filteredTemplates = PROJECT_TEMPLATES.filter(t =>
    !searchFilter ||
    t.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    t.tags.some(tag => tag.includes(searchFilter.toLowerCase()))
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg.primary }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logo}>
            <View style={[styles.logoIcon, { backgroundColor: colors.accent.blue }]}>
              <Icon name="code-braces" size={28} color="#fff" />
            </View>
            <View>
              <Text style={[styles.logoTitle, { color: colors.text.primary }]}>PocketDev IDE</Text>
              <Text style={[styles.logoSub, { color: colors.text.muted }]}>
                VS Code power · Mobile freedom
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.surface.default }]}
              onPress={() => navigation.navigate('Settings')}
            >
              <Icon name="cog-outline" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.accent.blue }]}
              onPress={() => setShowNewProject(true)}
            >
              <Icon name="plus-circle-outline" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>New Project</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: colors.surface.default, borderColor: colors.surface.border }]}
              onPress={() => setShowCloneProject(true)}
            >
              <Icon name="source-branch" size={18} color={colors.accent.blue} />
              <Text style={[styles.secondaryBtnText, { color: colors.text.primary }]}>Clone Repo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Projects */}
        {recentOnDisk.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
              RECENT PROJECTS
            </Text>
            <View style={styles.recentList}>
              {recentOnDisk.slice(0, 8).map(name => (
                <TouchableOpacity
                  key={name}
                  style={[styles.recentCard, { backgroundColor: colors.bg.secondary, borderColor: colors.surface.border }]}
                  onPress={() => openProject(name)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.recentIcon, { backgroundColor: colors.surface.default }]}>
                    <Icon name="folder" size={20} color={colors.accent.blue} />
                  </View>
                  <Text style={[styles.recentName, { color: colors.text.primary }]} numberOfLines={1}>
                    {name}
                  </Text>
                  <Icon name="chevron-right" size={14} color={colors.text.muted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Language Stats / Feature highlights */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            SUPPORTED LANGUAGES
          </Text>
          <View style={styles.langGrid}>
            {Object.entries(LanguageColors).slice(0, 12).map(([lang, color]) => (
              <View key={lang} style={[styles.langChip, { backgroundColor: color + '20', borderColor: color + '40' }]}>
                <View style={[styles.langDot, { backgroundColor: color }]} />
                <Text style={[styles.langName, { color: colors.text.primary }]}>
                  {lang.charAt(0).toUpperCase() + lang.slice(1)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Feature cards */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>FEATURES</Text>
          <View style={styles.featureGrid}>
            {FEATURES.map(feature => (
              <View
                key={feature.title}
                style={[styles.featureCard, { backgroundColor: colors.bg.secondary, borderColor: colors.surface.border }]}
              >
                <View style={[styles.featureIcon, { backgroundColor: feature.color + '20' }]}>
                  <Icon name={feature.icon} size={20} color={feature.color} />
                </View>
                <Text style={[styles.featureTitle, { color: colors.text.primary }]}>{feature.title}</Text>
                <Text style={[styles.featureDesc, { color: colors.text.muted }]}>{feature.desc}</Text>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>

      {/* ---- NEW PROJECT MODAL ---- */}
      <Modal
        visible={showNewProject}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNewProject(false)}
      >
        <View style={[styles.modal, { backgroundColor: colors.bg.primary }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.surface.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text.primary }]}>New Project</Text>
            <TouchableOpacity onPress={() => setShowNewProject(false)}>
              <Icon name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Project name */}
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Project Name</Text>
            <TextInput
              value={newProjectName}
              onChangeText={setNewProjectName}
              placeholder="my-awesome-project"
              placeholderTextColor={colors.text.muted}
              style={[styles.fieldInput, { color: colors.text.primary, backgroundColor: colors.bg.elevated, borderColor: colors.surface.border }]}
              autoCapitalize="none"
            />

            {/* Template search */}
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Template</Text>
            <View style={[styles.templateSearch, { backgroundColor: colors.bg.elevated, borderColor: colors.surface.border }]}>
              <Icon name="magnify" size={14} color={colors.text.muted} />
              <TextInput
                value={searchFilter}
                onChangeText={setSearchFilter}
                placeholder="Search templates..."
                placeholderTextColor={colors.text.muted}
                style={[styles.templateSearchInput, { color: colors.text.primary }]}
              />
            </View>

            {/* Template grid */}
            <View style={styles.templateGrid}>
              {filteredTemplates.map(template => (
                <TouchableOpacity
                  key={template.id}
                  style={[
                    styles.templateCard,
                    {
                      backgroundColor: selectedTemplate === template.id
                        ? colors.surface.selected
                        : colors.bg.secondary,
                      borderColor: selectedTemplate === template.id
                        ? colors.accent.blue
                        : colors.surface.border,
                    },
                  ]}
                  onPress={() => setSelectedTemplate(template.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.templateIcon, { backgroundColor: template.iconColor + '20' }]}>
                    <Icon name={template.icon} size={22} color={template.iconColor} />
                  </View>
                  <Text style={[styles.templateName, { color: colors.text.primary }]}>{template.name}</Text>
                  <Text style={[styles.templateDesc, { color: colors.text.muted }]} numberOfLines={2}>
                    {template.description}
                  </Text>
                  {selectedTemplate === template.id && (
                    <View style={[styles.templateCheck, { backgroundColor: colors.accent.blue }]}>
                      <Icon name="check" size={10} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: colors.surface.border }]}>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.surface.border }]}
              onPress={() => setShowNewProject(false)}
            >
              <Text style={[styles.cancelBtnText, { color: colors.text.secondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: colors.accent.blue }]}
              onPress={createProject}
              disabled={isCreating}
            >
              {isCreating
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.createBtnText}>Create Project</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ---- CLONE MODAL ---- */}
      <Modal
        visible={showCloneProject}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowCloneProject(false)}
      >
        <View style={[styles.modal, { backgroundColor: colors.bg.primary }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.surface.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text.primary }]}>Clone Repository</Text>
            <TouchableOpacity onPress={() => setShowCloneProject(false)}>
              <Icon name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Repository URL</Text>
            <TextInput
              value={cloneUrl}
              onChangeText={setCloneUrl}
              placeholder="https://github.com/user/repo.git"
              placeholderTextColor={colors.text.muted}
              style={[styles.fieldInput, { color: colors.text.primary, backgroundColor: colors.bg.elevated, borderColor: colors.surface.border }]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            {/* Popular platforms */}
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Quick Pick</Text>
            {[
              { name: 'GitHub', icon: 'github', color: '#24292E', prefix: 'https://github.com/' },
              { name: 'GitLab', icon: 'gitlab', color: '#FC6D26', prefix: 'https://gitlab.com/' },
              { name: 'Bitbucket', icon: 'bitbucket', color: '#0052CC', prefix: 'https://bitbucket.org/' },
            ].map(platform => (
              <TouchableOpacity
                key={platform.name}
                style={[styles.platformBtn, { backgroundColor: colors.bg.secondary, borderColor: colors.surface.border }]}
                onPress={() => setCloneUrl(platform.prefix)}
              >
                <Icon name={platform.icon} size={18} color={platform.color} />
                <Text style={[styles.platformName, { color: colors.text.primary }]}>{platform.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.modalFooter, { borderTopColor: colors.surface.border }]}>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.surface.border }]}
              onPress={() => setShowCloneProject(false)}
            >
              <Text style={[styles.cancelBtnText, { color: colors.text.secondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: colors.accent.blue }]}
              onPress={cloneProject}
              disabled={isCreating}
            >
              {isCreating
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.createBtnText}>Clone</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Loading overlay */}
      {isCreating && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.accent.blue} />
          <Text style={[styles.loadingText, { color: colors.text.primary }]}>Setting up project...</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const FEATURES = [
  { icon: 'lightning-bolt', color: '#F2CC60', title: 'Monaco Editor', desc: 'Same engine as VS Code' },
  { icon: 'robot-outline', color: '#BC8CFF', title: 'AI Assistant', desc: 'Claude-powered code help' },
  { icon: 'console', color: '#3FB950', title: 'Live Terminal', desc: 'Full shell environment' },
  { icon: 'source-branch', color: '#F05133', title: 'Git Built-In', desc: 'Commit, push, pull, clone' },
  { icon: 'puzzle-outline', color: '#58A6FF', title: 'Extensions', desc: 'Linters, formatters & more' },
  { icon: 'cloud-upload-outline', color: '#79C0FF', title: 'Cloud Sync', desc: 'Firebase / Supabase / AWS' },
];

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  logo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  logoIcon: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  logoTitle: { fontSize: 22, fontFamily: Typography.ui.fontFamily, fontWeight: '700' },
  logoSub: { fontSize: 12, fontFamily: Typography.ui.fontFamily, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  section: { marginBottom: Spacing.xl },
  sectionTitle: {
    fontSize: 11, fontFamily: Typography.ui.fontFamily,
    fontWeight: '700', letterSpacing: 0.8, marginBottom: Spacing.md,
  },
  quickActions: { flexDirection: 'row', gap: Spacing.sm },
  primaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.xs, height: 48, borderRadius: BorderRadius.lg,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600', fontFamily: Typography.ui.fontFamily },
  secondaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.xs, height: 48, borderRadius: BorderRadius.lg, borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', fontFamily: Typography.ui.fontFamily },
  recentList: { gap: Spacing.xs },
  recentCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1,
  },
  recentIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  recentName: { flex: 1, fontSize: 14, fontFamily: Typography.ui.fontFamily, fontWeight: '500' },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: BorderRadius.full, borderWidth: 1,
  },
  langDot: { width: 8, height: 8, borderRadius: 4 },
  langName: { fontSize: 12, fontFamily: Typography.ui.fontFamily },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  featureCard: {
    width: '47%', padding: Spacing.md,
    borderRadius: BorderRadius.lg, borderWidth: 1, gap: Spacing.xs,
  },
  featureIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { fontSize: 13, fontFamily: Typography.ui.fontFamily, fontWeight: '600' },
  featureDesc: { fontSize: 11, fontFamily: Typography.ui.fontFamily, lineHeight: 16 },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.lg, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 20, fontFamily: Typography.ui.fontFamily, fontWeight: '700' },
  modalContent: { flex: 1, padding: Spacing.lg },
  modalFooter: {
    flexDirection: 'row', gap: Spacing.sm,
    padding: Spacing.lg, borderTopWidth: 1,
  },
  fieldLabel: { fontSize: 12, fontFamily: Typography.ui.fontFamily, fontWeight: '600', marginBottom: Spacing.xs, marginTop: Spacing.md },
  fieldInput: {
    height: 44, borderRadius: BorderRadius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, fontSize: 14, fontFamily: Typography.ui.fontFamily,
  },
  templateSearch: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    height: 36, borderRadius: BorderRadius.md, borderWidth: 1,
    paddingHorizontal: Spacing.sm, marginBottom: Spacing.md,
  },
  templateSearchInput: { flex: 1, fontSize: 13, fontFamily: Typography.ui.fontFamily },
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  templateCard: {
    width: '47%', padding: Spacing.md,
    borderRadius: BorderRadius.lg, borderWidth: 1,
    gap: 6, position: 'relative',
  },
  templateIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  templateName: { fontSize: 13, fontFamily: Typography.ui.fontFamily, fontWeight: '600' },
  templateDesc: { fontSize: 11, fontFamily: Typography.ui.fontFamily, lineHeight: 16 },
  templateCheck: {
    position: 'absolute', top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: BorderRadius.lg, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 15, fontFamily: Typography.ui.fontFamily, fontWeight: '600' },
  createBtn: {
    flex: 2, height: 48, borderRadius: BorderRadius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  createBtnText: { color: '#fff', fontSize: 15, fontFamily: Typography.ui.fontFamily, fontWeight: '600' },
  platformBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.xs,
  },
  platformName: { fontSize: 14, fontFamily: Typography.ui.fontFamily },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: { fontSize: 16, fontFamily: Typography.ui.fontFamily },
});

export default HomeScreen;
