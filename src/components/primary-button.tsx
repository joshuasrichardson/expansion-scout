import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The four button treatments from the design system:
 *   • primary   — solid forest green, white label
 *   • secondary — subtle neutral fill, primary label
 *   • inverted  — solid charcoal, white label
 *   • outlined  — transparent with border
 */
export type ButtonVariant = 'primary' | 'secondary' | 'inverted' | 'outlined';

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Optional leading icon (e.g. an Expo Symbol / Ionicon element). */
  icon?: React.ReactNode;
  style?: ViewStyle;
}) {
  const theme = useTheme();

  const surface: Record<ButtonVariant, ViewStyle> = {
    primary: { backgroundColor: theme.accent },
    secondary: { backgroundColor: theme.backgroundElement, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth },
    inverted: { backgroundColor: theme.text },
    outlined: { backgroundColor: 'transparent', borderColor: theme.border, borderWidth: 1 },
  };

  const labelColor: Record<ButtonVariant, string> = {
    primary: theme.onAccent,
    secondary: theme.text,
    inverted: theme.background,
    outlined: theme.text,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        surface[variant],
        { opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <View style={styles.content}>
        {icon}
        <ThemedText type="bodyBold" style={{ color: labelColor[variant] }}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
