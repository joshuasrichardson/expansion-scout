import { Text, type TextProps, type TextStyle } from 'react-native';

import { ThemeColor, Typography, type TypographyVariant } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * `type` selects a style from the `Typography` scale in constants/theme.ts.
 * `'default'` is an alias for `'body'`; `link` / `linkPrimary` are inline-link
 * treatments layered on the `small` style. Every variant carries its own font
 * family (Hanken Grotesk for display/titles, Inter for body, Geist for labels).
 */
export type ThemedTextType = TypographyVariant | 'default' | 'link' | 'linkPrimary';

export type ThemedTextProps = TextProps & {
  type?: ThemedTextType;
  themeColor?: ThemeColor;
};

function styleFor(type: ThemedTextType): TextStyle {
  const key: TypographyVariant = type === 'default' ? 'body' : type === 'link' || type === 'linkPrimary' ? 'small' : type;
  const t = Typography[key];
  return { fontFamily: t.family, fontSize: t.fontSize, lineHeight: t.lineHeight, fontWeight: t.fontWeight as TextStyle['fontWeight'] };
}

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const linkColor =
    type === 'linkPrimary' ? theme.accent : type === 'link' ? theme.info : undefined;

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        styleFor(type),
        linkColor && { color: linkColor },
        style,
      ]}
      {...rest}
    />
  );
}
