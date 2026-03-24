// src/components/common/index.tsx
import React from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Modal as RNModal, TouchableWithoutFeedback,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../hooks/useTheme';
import { Typography, Spacing, BorderRadius } from '../../theme';

// ============================================================
// BUTTON
// ============================================================
interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  label, onPress, variant = 'primary', size = 'md',
  icon, loading, disabled, fullWidth,
}) => {
  const { colors } = useTheme();

  const bgColors: Record<string, string> = {
    primary: colors.accent.blue,
    secondary: colors.surface.default,
    danger: colors.status.error,
    ghost: 'transparent',
  };

  const textColors: Record<string, string> = {
    primary: '#fff',
    secondary: colors.text.primary,
    danger: '#fff',
    ghost: colors.accent.blue,
  };

  const heights: Record<string, number> = { sm: 30, md: 40, lg: 48 };
  const fontSizes: Record<string, number> = { sm: 12, md: 14, lg: 15 };
  const paddings: Record<string, number> = { sm: 10, md: 14, lg: 18 };

  return (
    <TouchableOpacity
      style={[
        btnStyles.btn,
        {
          backgroundColor: bgColors[variant],
          height: heights[size],
          paddingHorizontal: paddings[size],
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: colors.surface.border,
          opacity: disabled || loading ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColors[variant]} />
      ) : (
        <>
          {icon && <Icon name={icon} size={fontSizes[size] + 2} color={textColors[variant]} />}
          <Text style={[btnStyles.label, { color: textColors[variant], fontSize: fontSizes[size] }]}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const btnStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  label: {
    fontFamily: Typography.ui.fontFamily,
    fontWeight: '600',
  },
});


// ============================================================
// LOADING OVERLAY
// ============================================================
interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ visible, message }) => {
  const { colors } = useTheme();
  if (!visible) return null;
  return (
    <View style={loaderStyles.overlay}>
      <View style={[loaderStyles.box, { backgroundColor: colors.bg.elevated }]}>
        <ActivityIndicator size="large" color={colors.accent.blue} />
        {message && (
          <Text style={[loaderStyles.message, { color: colors.text.primary }]}>{message}</Text>
        )}
      </View>
    </View>
  );
};

const loaderStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  box: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    gap: Spacing.md,
    minWidth: 140,
  },
  message: {
    fontSize: 14,
    fontFamily: Typography.ui.fontFamily,
    textAlign: 'center',
  },
});


// ============================================================
// EMPTY STATE
// ============================================================
interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => {
  const { colors } = useTheme();
  return (
    <View style={emptyStyles.container}>
      <View style={[emptyStyles.iconCircle, { backgroundColor: colors.surface.default }]}>
        <Icon name={icon} size={40} color={colors.text.muted} />
      </View>
      <Text style={[emptyStyles.title, { color: colors.text.secondary }]}>{title}</Text>
      {description && (
        <Text style={[emptyStyles.desc, { color: colors.text.muted }]}>{description}</Text>
      )}
      {action && (
        <Button label={action.label} onPress={action.onPress} variant="primary" size="sm" />
      )}
    </View>
  );
};

const emptyStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxl,
    gap: Spacing.md,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 16,
    fontFamily: Typography.ui.fontFamily,
    fontWeight: '600',
    textAlign: 'center',
  },
  desc: {
    fontSize: 13,
    fontFamily: Typography.ui.fontFamily,
    textAlign: 'center',
    lineHeight: 20,
  },
});


// ============================================================
// MODAL
// ============================================================
interface PocketModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
}

export const PocketModal: React.FC<PocketModalProps> = ({
  visible, onClose, title, children, footer, size = 'md',
}) => {
  const { colors } = useTheme();

  const widths: Record<string, string | number> = {
    sm: 320,
    md: 400,
    lg: 560,
    full: '100%',
  };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={modalStyles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <View style={[
          modalStyles.container,
          {
            backgroundColor: colors.bg.elevated,
            borderColor: colors.surface.border,
            maxWidth: widths[size] as any,
            width: size === 'full' ? '100%' : undefined,
          },
        ]}>
          {/* Header */}
          <View style={[modalStyles.header, { borderBottomColor: colors.surface.border }]}>
            <Text style={[modalStyles.title, { color: colors.text.primary }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <Icon name="close" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View style={modalStyles.body}>{children}</View>

          {/* Footer */}
          {footer && (
            <View style={[modalStyles.footer, { borderTopColor: colors.surface.border }]}>
              {footer}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
};

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  container: {
    width: '100%',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 17,
    fontFamily: Typography.ui.fontFamily,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    padding: Spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderTopWidth: 1,
  },
});


// ============================================================
// TAG / BADGE
// ============================================================
interface TagProps {
  label: string;
  color?: string;
  size?: 'xs' | 'sm';
}

export const Tag: React.FC<TagProps> = ({ label, color, size = 'sm' }) => {
  const { colors } = useTheme();
  const bgColor = color || colors.accent.blue;

  return (
    <View style={[
      tagStyles.tag,
      { backgroundColor: bgColor + '25', borderColor: bgColor + '50' },
      size === 'xs' && tagStyles.tagXs,
    ]}>
      <Text style={[
        tagStyles.label,
        { color: bgColor },
        size === 'xs' && tagStyles.labelXs,
      ]}>
        {label}
      </Text>
    </View>
  );
};

const tagStyles = StyleSheet.create({
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  tagXs: {
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  label: {
    fontSize: 11,
    fontFamily: Typography.ui.fontFamily,
    fontWeight: '600',
  },
  labelXs: {
    fontSize: 9,
  },
});


// ============================================================
// DIVIDER
// ============================================================
export const Divider: React.FC<{ label?: string }> = ({ label }) => {
  const { colors } = useTheme();
  if (!label) {
    return <View style={[dividerStyles.line, { backgroundColor: colors.surface.border }]} />;
  }
  return (
    <View style={dividerStyles.labeled}>
      <View style={[dividerStyles.line, { flex: 1, backgroundColor: colors.surface.border }]} />
      <Text style={[dividerStyles.text, { color: colors.text.muted }]}>{label}</Text>
      <View style={[dividerStyles.line, { flex: 1, backgroundColor: colors.surface.border }]} />
    </View>
  );
};

const dividerStyles = StyleSheet.create({
  line: { height: 1, marginVertical: Spacing.md },
  labeled: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.md },
  text: { fontSize: 11, fontFamily: Typography.ui.fontFamily },
});


// ============================================================
// KEYBOARD SHORTCUT HINT
// ============================================================
export const KeyHint: React.FC<{ keys: string[] }> = ({ keys }) => {
  const { colors } = useTheme();
  return (
    <View style={keyStyles.row}>
      {keys.map((key, i) => (
        <View key={i} style={[keyStyles.key, { backgroundColor: colors.surface.default, borderColor: colors.surface.border }]}>
          <Text style={[keyStyles.label, { color: colors.text.muted }]}>{key}</Text>
        </View>
      ))}
    </View>
  );
};

const keyStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3 },
  key: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  label: { fontSize: 10, fontFamily: Typography.code.fontFamily },
});
