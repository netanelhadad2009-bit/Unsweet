export type QuestionType = 'multi-select' | 'single-select' | 'interstitial' | 'commitment';

export interface Option {
  id: string;
  label: string;
  icon?: string; // Emoji or icon identifier (deprecated)
  iconComponent?: string; // Name of custom icon component
  description?: string; // Optional subtitle
}

export interface InterstitialConfig {
  duration: number; // Auto-advance duration in ms
  animationType: 'pulse' | 'spinner' | 'dots';
  message: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  subtitle?: string;
  options?: Option[];
  autoAdvanceDelay?: number; // Milliseconds to wait before auto-advancing (single-select)
  interstitialConfig?: InterstitialConfig;
  progressPercent: number; // Progress bar value at this step
}

// Bio-data collected at the start of onboarding
export interface BioData {
  gender: 'male' | 'female' | 'other' | null;
  birthdate: string | null; // ISO date string (YYYY-MM-DD)
  age: number | null; // Calculated from birthdate
  height: number | null; // In cm (metric)
  weight: number | null; // In kg (metric)
  useImperial: boolean; // If true, display in ft/lbs
}

export interface OnboardingAnswers {
  // Bio-data (collected first)
  gender: 'male' | 'female' | 'other' | null;
  birthdate: string | null; // ISO date string
  age: number | null; // Calculated from birthdate
  height: number | null; // In cm
  weight: number | null; // In kg
  useImperial: boolean;

  // Behavioral questions
  main_goals: string[]; // Array of goal IDs
  biggest_weakness: string | null;
  craving_time: string | null; // When they crave sugar most
  sugar_frequency: string | null;
  post_binge_feeling: string | null;
  sleep_impact: string | null; // How sugar affects sleep
  quit_attempts: string | null; // Previous quit attempts
  weekly_spending: string | null;
  commitment: string | null;
}

export interface OnboardingData extends OnboardingAnswers {
  current_step: number;
  completed_at: string | null;
}
