// src/components/ai/AIAssistant.tsx
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import AIService, { AIMessage } from '../../services/AIService';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isLoading?: boolean;
  codeBlocks?: { language: string; code: string }[];
}

interface AIAssistantProps {
  onInsertCode?: (code: string) => void;
  onClose?: () => void;
}

// ---- CODE BLOCK RENDERER ----
const CodeBlock: React.FC<{
  code: string;
  language: string;
  theme: 'dark' | 'light';
  onInsert?: () => void;
  onCopy?: () => void;
}> = ({ code, language, theme, onInsert, onCopy }) => {
  const colors = Colors[theme];
  return (
    <View style={[styles.codeBlock, { backgroundColor: colors.bg.primary, borderColor: colors.surface.border }]}>
      <View style={[styles.codeHeader, { borderBottomColor: colors.surface.border }]}>
        <Text style={[styles.codeLang, { color: colors.text.secondary }]}>{language}</Text>
        <View style={styles.codeActions}>
          {onCopy && (
            <TouchableOpacity onPress={onCopy} style={styles.codeAction}>
              <Icon name="content-copy" size={14} color={colors.text.secondary} />
            </TouchableOpacity>
          )}
          {onInsert && (
            <TouchableOpacity onPress={onInsert} style={styles.codeAction}>
              <Icon name="code-tags" size={14} color={colors.accent.blue} />
              <Text style={[styles.insertText, { color: colors.accent.blue }]}>Insert</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text style={[styles.code, { color: colors.text.primary }]}>{code}</Text>
      </ScrollView>
    </View>
  );
};

// ---- CHAT MESSAGE RENDERER ----
const ChatBubble: React.FC<{
  message: ChatMessage;
  theme: 'dark' | 'light';
  onInsertCode?: (code: string) => void;
}> = ({ message, theme, onInsertCode }) => {
  const colors = Colors[theme];
  const isUser = message.role === 'user';

  // Parse content to extract code blocks
  const parsedContent = React.useMemo(() => {
    const parts: { type: 'text' | 'code'; content: string; language?: string }[] = [];
    const codeRegex = /```(\w*)\n?([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeRegex.exec(message.content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: message.content.slice(lastIndex, match.index) });
      }
      parts.push({ type: 'code', content: match[2].trim(), language: match[1] || 'text' });
      lastIndex = codeRegex.lastIndex;
    }

    if (lastIndex < message.content.length) {
      parts.push({ type: 'text', content: message.content.slice(lastIndex) });
    }

    return parts.length > 0 ? parts : [{ type: 'text' as const, content: message.content }];
  }, [message.content]);

  return (
    <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
      {/* Avatar */}
      <View style={[
        styles.avatar,
        { backgroundColor: isUser ? colors.accent.blue : '#7B61FF' }
      ]}>
        <Icon name={isUser ? 'account' : 'robot'} size={14} color="#fff" />
      </View>

      {/* Content */}
      <View style={styles.bubbleContent}>
        <Text style={[styles.bubbleRole, { color: colors.text.secondary }]}>
          {isUser ? 'You' : 'Claude AI'}
        </Text>

        {message.isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.accent.blue} />
            <Text style={[styles.loadingText, { color: colors.text.muted }]}>Thinking...</Text>
          </View>
        ) : (
          parsedContent.map((part, i) =>
            part.type === 'code' ? (
              <CodeBlock
                key={i}
                code={part.content}
                language={part.language || 'text'}
                theme={theme}
                onInsert={() => onInsertCode?.(part.content)}
              />
            ) : (
              <Text key={i} style={[styles.bubbleText, { color: colors.text.primary }]}>
                {part.content.trim()}
              </Text>
            )
          )
        )}

        <Text style={[styles.timestamp, { color: colors.text.muted }]}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
};

// ---- QUICK PROMPTS ----
const QUICK_PROMPTS = [
  { icon: 'bug', label: 'Fix bug', prompt: 'Please identify and fix the bug in this code:' },
  { icon: 'comment-text-outline', label: 'Explain', prompt: 'Please explain what this code does:' },
  { icon: 'lightning-bolt', label: 'Optimize', prompt: 'Please optimize this code for better performance:' },
  { icon: 'shield-check', label: 'Review', prompt: 'Please review this code for security issues and best practices:' },
  { icon: 'file-document', label: 'Document', prompt: 'Please add documentation comments to this code:' },
  { icon: 'test-tube', label: 'Write tests', prompt: 'Please write unit tests for this code:' },
  { icon: 'translate', label: 'Convert', prompt: 'Please convert this code to:' },
  { icon: 'code-braces', label: 'Refactor', prompt: 'Please refactor this code to improve readability:' },
];

// ---- MAIN COMPONENT ----
const AIAssistant: React.FC<AIAssistantProps> = ({ onInsertCode, onClose }) => {
  const theme = useSelector((s: RootState) => s.settings.theme);
  const { aiApiKey, aiModel } = useSelector((s: RootState) => s.settings);
  const { tabs, activeTabId } = useSelector((s: RootState) => s.editor);
  const colors = Colors[theme];

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content: "👋 Hi! I'm your AI coding assistant powered by Claude. I can help you write, debug, explain, and optimize code.\n\nPaste your code or ask me anything!",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contextCode, setContextCode] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const activeTab = tabs.find(t => t.id === activeTabId);

  const sendMessage = useCallback(async (text?: string) => {
    const messageText = (text || input).trim();
    if (!messageText || isLoading) return;

    setInput('');

    // Add user message
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
    };

    // Add loading AI message
    const loadingId = `msg_${Date.now() + 1}`;
    const loadingMsg: ChatMessage = {
      id: loadingId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isLoading: true,
    };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setIsLoading(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      // Build context from current file
      const codeContext = activeTab?.content
        ? `\n\nCurrent file: ${activeTab.fileName} (${activeTab.language})\n\`\`\`${activeTab.language}\n${activeTab.content.slice(0, 4000)}\n\`\`\``
        : '';

      const systemPrompt = `You are an expert programming assistant integrated into PocketDev IDE. 
You help developers write, debug, explain, and optimize code.
Be concise but thorough. When showing code, always specify the language in code blocks.
Current project context: ${activeTab ? `Working on ${activeTab.fileName}` : 'No file open'}`;

      const conversationHistory: AIMessage[] = messages
        .filter(m => !m.isLoading)
        .map(m => ({ role: m.role, content: m.content }));

      const fullMessage = messageText + codeContext;

      const response = await AIService.chat(
        [...conversationHistory, { role: 'user', content: fullMessage }],
        systemPrompt,
        aiApiKey,
        aiModel
      );

      setMessages(prev =>
        prev.map(m =>
          m.id === loadingId
            ? { ...m, content: response, isLoading: false }
            : m
        )
      );
    } catch (err: any) {
      setMessages(prev =>
        prev.map(m =>
          m.id === loadingId
            ? {
                ...m,
                content: `⚠️ Error: ${err.message || 'Failed to get response. Check your API key in Settings.'}`,
                isLoading: false,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [input, isLoading, messages, activeTab, aiApiKey, aiModel]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg.secondary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bg.tertiary, borderBottomColor: colors.surface.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.aiAvatar, { backgroundColor: '#7B61FF' }]}>
            <Icon name="robot" size={16} color="#fff" />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Claude AI</Text>
            <Text style={[styles.headerSub, { color: colors.text.muted }]}>
              {aiModel.includes('opus') ? 'claude-opus' : 'claude-sonnet'}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setMessages(prev => [prev[0]])}>
            <Icon name="trash-can-outline" size={18} color={colors.text.secondary} />
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map(msg => (
          <ChatBubble
            key={msg.id}
            message={msg}
            theme={theme}
            onInsertCode={onInsertCode}
          />
        ))}
      </ScrollView>

      {/* Quick prompts */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.quickPrompts, { backgroundColor: colors.bg.tertiary }]}
        contentContainerStyle={styles.quickPromptsContent}
      >
        {QUICK_PROMPTS.map(qp => (
          <TouchableOpacity
            key={qp.label}
            style={[styles.quickChip, { backgroundColor: colors.surface.default, borderColor: colors.surface.border }]}
            onPress={() => sendMessage(qp.prompt)}
          >
            <Icon name={qp.icon} size={13} color={colors.accent.blue} />
            <Text style={[styles.quickChipText, { color: colors.text.secondary }]}>{qp.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Input */}
      <View style={[
        styles.inputArea,
        { backgroundColor: colors.bg.tertiary, borderTopColor: colors.surface.border }
      ]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask AI anything about your code..."
          placeholderTextColor={colors.text.muted}
          style={[
            styles.textInput,
            {
              color: colors.text.primary,
              backgroundColor: colors.bg.elevated,
              borderColor: colors.surface.border,
            },
          ]}
          multiline
          maxLength={2000}
          returnKeyType="default"
        />
        <TouchableOpacity
          onPress={() => sendMessage()}
          disabled={isLoading || !input.trim()}
          style={[
            styles.sendBtn,
            {
              backgroundColor: (isLoading || !input.trim())
                ? colors.surface.default
                : colors.accent.blue,
            },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Icon name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  aiAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 15, fontFamily: Typography.ui.fontFamily, fontWeight: '600' },
  headerSub: { fontSize: 11, fontFamily: Typography.code.fontFamily },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  messages: { flex: 1 },
  messagesContent: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  bubble: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  userBubble: { flexDirection: 'row-reverse' },
  aiBubble: {},
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bubbleContent: { flex: 1, gap: Spacing.xs },
  bubbleRole: { fontSize: 11, fontFamily: Typography.ui.fontFamily, fontWeight: '600' },
  bubbleText: { fontSize: 14, fontFamily: Typography.ui.fontFamily, lineHeight: 22 },
  timestamp: { fontSize: 10, fontFamily: Typography.ui.fontFamily },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  loadingText: { fontSize: 13, fontFamily: Typography.ui.fontFamily },
  codeBlock: { borderRadius: BorderRadius.md, borderWidth: 1, overflow: 'hidden', marginVertical: Spacing.xs },
  codeHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderBottomWidth: 1,
  },
  codeLang: { fontSize: 11, fontFamily: Typography.code.fontFamily },
  codeActions: { flexDirection: 'row', gap: Spacing.sm },
  codeAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  insertText: { fontSize: 12, fontFamily: Typography.ui.fontFamily },
  code: { fontFamily: Typography.code.fontFamily, fontSize: 13, padding: Spacing.sm, lineHeight: 20 },
  quickPrompts: { maxHeight: 40, borderTopWidth: 1 },
  quickPromptsContent: { paddingHorizontal: Spacing.sm, paddingVertical: 4, gap: Spacing.xs, flexDirection: 'row' },
  quickChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderRadius: BorderRadius.full, borderWidth: 1,
  },
  quickChipText: { fontSize: 12, fontFamily: Typography.ui.fontFamily },
  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
    padding: Spacing.sm, borderTopWidth: 1,
  },
  textInput: {
    flex: 1, borderRadius: BorderRadius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: 14, fontFamily: Typography.ui.fontFamily,
    maxHeight: 120, lineHeight: 20,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
});

export default AIAssistant;
