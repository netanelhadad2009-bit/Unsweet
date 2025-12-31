export const Colors = {
  primary: '#00C897',       // Mint Teal
  background: '#FFFFFF',    // Clean White
  surface: '#F8F9FB',       // Off-White
  text: {
    main: '#2D3436',        // Charcoal
    light: '#636E72',       // Lighter text
    muted: '#B2BEC3',       // Muted text
  },
  danger: '#FF7675',        // Soft Coral (Relapse)
  success: '#FDCB6E',       // Golden Sun
  border: '#DFE6E9',        // Border color
  shadow: 'rgba(0, 0, 0, 0.1)',
} as const;

export type ColorScheme = typeof Colors;
