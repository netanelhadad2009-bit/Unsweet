import { createContext, useContext, useState, ReactNode } from 'react';
import { LayoutAnimation, Platform, UIManager } from 'react-native';
import { OnboardingData } from '../types/onboarding';
import { ONBOARDING_QUESTIONS } from '../data/onboardingQuestions';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Define the screen order for the entire onboarding flow
export type OnboardingScreen =
  | 'gender'
  | 'age'
  | 'measurements'
  | 'projection'
  | 'wizard'
  | 'efficacy'
  | 'method'
  | 'reviews'
  | 'notifications'
  | 'analysis';

export const ONBOARDING_SCREEN_ORDER: OnboardingScreen[] = [
  'gender',
  'age',
  'measurements',
  'projection',
  'wizard',      // Wizard handles steps 0-3 internally, then goes to efficacy
  'efficacy',
  // After efficacy, wizard continues with steps 4-8
  'method',
  'reviews',
  'notifications',
  'analysis',
];

// Custom spring animation config for smooth transitions
const springAnimationConfig = {
  duration: 300,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

interface OnboardingContextType {
  onboardingData: OnboardingData;
  updateAnswer: (questionId: string, value: string | string[] | number | boolean | null) => void;
  updateBioData: (field: string, value: string | number | boolean | null) => void;
  setCurrentStep: (step: number) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  clearOnboardingData: () => void;
  isStepComplete: (step: number) => boolean;
  getProgressPercent: () => number;
  // New screen-level navigation
  currentScreen: OnboardingScreen;
  setCurrentScreen: (screen: OnboardingScreen, animate?: boolean) => void;
  goToNextScreen: () => void;
  goToPreviousScreen: () => void;
  getScreenProgress: () => number;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const initialData: OnboardingData = {
  // Bio-data
  gender: null,
  birthdate: null,
  age: null,
  height: null,
  weight: null,
  useImperial: false,

  // Behavioral questions
  main_goals: [],
  biggest_weakness: null,
  craving_time: null,
  sugar_frequency: null,
  post_binge_feeling: null,
  sleep_impact: null,
  quit_attempts: null,
  weekly_spending: null,
  commitment: null,

  // Progress tracking
  current_step: 0,
  completed_at: null,
};

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [onboardingData, setOnboardingData] = useState<OnboardingData>(initialData);
  const [currentScreen, setCurrentScreenState] = useState<OnboardingScreen>('gender');

  // Screen-level navigation with LayoutAnimation
  const setCurrentScreen = (screen: OnboardingScreen, animate: boolean = true) => {
    if (animate) {
      LayoutAnimation.configureNext(springAnimationConfig);
    }
    setCurrentScreenState(screen);
  };

  const goToNextScreen = () => {
    const currentIndex = ONBOARDING_SCREEN_ORDER.indexOf(currentScreen);
    if (currentIndex < ONBOARDING_SCREEN_ORDER.length - 1) {
      LayoutAnimation.configureNext(springAnimationConfig);
      setCurrentScreenState(ONBOARDING_SCREEN_ORDER[currentIndex + 1]);
    }
  };

  const goToPreviousScreen = () => {
    const currentIndex = ONBOARDING_SCREEN_ORDER.indexOf(currentScreen);
    if (currentIndex > 0) {
      LayoutAnimation.configureNext(springAnimationConfig);
      setCurrentScreenState(ONBOARDING_SCREEN_ORDER[currentIndex - 1]);
    }
  };

  const getScreenProgress = (): number => {
    const currentIndex = ONBOARDING_SCREEN_ORDER.indexOf(currentScreen);
    // Calculate progress: screens before wizard are 1-4, wizard handles 5-13, then method=14, reviews=15, notifications=16, analysis=17
    // Total ~18 screens conceptually
    const TOTAL_SCREENS = 18;

    switch (currentScreen) {
      case 'gender': return Math.round((1 / TOTAL_SCREENS) * 100); // 6%
      case 'age': return Math.round((2 / TOTAL_SCREENS) * 100); // 11%
      case 'measurements': return Math.round((3 / TOTAL_SCREENS) * 100); // 17%
      case 'projection': return Math.round((4 / TOTAL_SCREENS) * 100); // 22%
      case 'wizard': {
        // Wizard has steps 0-8, but efficacy is shown after step 3
        const wizardStep = onboardingData.current_step;
        if (wizardStep < 4) {
          // Steps 0-3 are screens 5-8
          return Math.round(((5 + wizardStep) / TOTAL_SCREENS) * 100);
        } else {
          // Steps 4-8 are screens 10-14 (after efficacy)
          return Math.round(((10 + (wizardStep - 4)) / TOTAL_SCREENS) * 100);
        }
      }
      case 'efficacy': return Math.round((9 / TOTAL_SCREENS) * 100); // 50%
      case 'method': return Math.round((15 / TOTAL_SCREENS) * 100); // 83%
      case 'reviews': return Math.round((16 / TOTAL_SCREENS) * 100); // 89%
      case 'notifications': return Math.round((17 / TOTAL_SCREENS) * 100); // 94%
      case 'analysis': return 100;
      default: return Math.round(((currentIndex + 1) / ONBOARDING_SCREEN_ORDER.length) * 100);
    }
  };

  const updateAnswer = (questionId: string, value: string | string[] | number | boolean | null) => {
    setOnboardingData((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const updateBioData = (field: string, value: string | number | boolean | null) => {
    setOnboardingData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const setCurrentStep = (step: number) => {
    const maxStep = ONBOARDING_QUESTIONS.length - 1;
    const validStep = Math.max(0, Math.min(step, maxStep));
    setOnboardingData((prev) => ({
      ...prev,
      current_step: validStep,
    }));
  };

  const goToNextStep = () => {
    setOnboardingData((prev) => {
      const nextStep = Math.min(prev.current_step + 1, ONBOARDING_QUESTIONS.length - 1);
      return {
        ...prev,
        current_step: nextStep,
      };
    });
  };

  const goToPreviousStep = () => {
    setOnboardingData((prev) => ({
      ...prev,
      current_step: Math.max(prev.current_step - 1, 0),
    }));
  };

  const clearOnboardingData = () => {
    setOnboardingData(initialData);
    setCurrentScreenState('gender'); // Reset screen to beginning
  };

  const isStepComplete = (step: number): boolean => {
    const question = ONBOARDING_QUESTIONS[step];
    if (!question) return false;

    switch (question.id) {
      case 'main_goals':
        return onboardingData.main_goals.length > 0;
      case 'biggest_weakness':
        return onboardingData.biggest_weakness !== null;
      case 'craving_time':
        return onboardingData.craving_time !== null;
      case 'sugar_frequency':
        return onboardingData.sugar_frequency !== null;
      case 'post_binge_feeling':
        return onboardingData.post_binge_feeling !== null;
      case 'sleep_impact':
        return onboardingData.sleep_impact !== null;
      case 'quit_attempts':
        return onboardingData.quit_attempts !== null;
      case 'weekly_spending':
        return onboardingData.weekly_spending !== null;
      case 'commitment':
        return onboardingData.commitment !== null;
      case 'analysis':
        return true; // Interstitial is always complete
      default:
        return false;
    }
  };

  const getProgressPercent = (): number => {
    if (onboardingData.current_step >= ONBOARDING_QUESTIONS.length) {
      return 100;
    }
    return ONBOARDING_QUESTIONS[onboardingData.current_step]?.progressPercent || 10;
  };

  return (
    <OnboardingContext.Provider
      value={{
        onboardingData,
        updateAnswer,
        updateBioData,
        setCurrentStep,
        goToNextStep,
        goToPreviousStep,
        clearOnboardingData,
        isStepComplete,
        getProgressPercent,
        // Screen-level navigation
        currentScreen,
        setCurrentScreen,
        goToNextScreen,
        goToPreviousScreen,
        getScreenProgress,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
