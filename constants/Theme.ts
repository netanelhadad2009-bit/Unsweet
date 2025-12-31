import { Colors } from './Colors';

export const Theme = {
  colors: {
    ...Colors,
    text: {
      ...Colors.text,
      primary: Colors.text.main,      // Alias for consistency
      secondary: Colors.text.light,   // Alias for consistency
    },
  },

  // Using system fonts (SF Pro on iOS, Roboto on Android)
  fonts: {
    regular: undefined,
    medium: undefined,
    semiBold: undefined,
    bold: undefined,
    extraBold: undefined,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },

  typography: {
    title: {
      fontSize: 32,
      fontWeight: '700' as const,
      lineHeight: 40,
      color: Colors.text.main,
    },
    subtitle: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 24,
      color: Colors.text.light,
    },
    optionLabel: {
      fontSize: 18,
      fontWeight: '600' as const,
      color: Colors.text.main,
    },
    optionDescription: {
      fontSize: 14,
      fontWeight: '400' as const,
      color: Colors.text.light,
    },
    body: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 24,
      color: Colors.text.main,
    },
  },

  shadows: {
    small: {
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    medium: {
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    large: {
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
  },

  animation: {
    duration: {
      fast: 200,
      normal: 300,
      slow: 400,
    },
  },
} as const;

export type ThemeType = typeof Theme;
