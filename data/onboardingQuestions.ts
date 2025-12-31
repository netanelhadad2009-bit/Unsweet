import { Question } from '../types/onboarding';

export const ONBOARDING_QUESTIONS: Question[] = [
  // Step 1: Multi-select goals (10%)
  {
    id: 'main_goals',
    type: 'multi-select',
    title: 'What are your main goals?',
    subtitle: 'Select all that apply',
    progressPercent: 10,
    options: [
      {
        id: 'stop_cravings',
        label: 'Stop Cravings',
        description: 'Break free from sugar dependency',
      },
      {
        id: 'boost_energy',
        label: 'Boost Energy',
        description: 'Feel energized throughout the day',
      },
      {
        id: 'lose_weight',
        label: 'Lose Weight',
        description: 'Shed pounds naturally',
      },
      {
        id: 'fix_brain_fog',
        label: 'Fix Brain Fog',
        description: 'Improve mental clarity',
      },
    ],
  },

  // Step 2: Single-select weakness (20%)
  {
    id: 'biggest_weakness',
    type: 'single-select',
    title: 'What is your biggest weakness?',
    subtitle: 'The one you reach for most',
    progressPercent: 20,
    autoAdvanceDelay: 300,
    options: [
      { id: 'chocolate', label: 'Chocolate & Sweets' },
      { id: 'drinks', label: 'Sugary Drinks / Soda' },
      { id: 'pastries', label: 'Pastries & Carbs' },
      { id: 'ice_cream', label: 'Ice Cream & Desserts' },
    ],
  },

  // Step 3: NEW - Timing Trigger (30%)
  {
    id: 'craving_time',
    type: 'single-select',
    title: 'When do you crave sugar the most?',
    subtitle: 'Pinpoint your personal risk zone',
    progressPercent: 30,
    autoAdvanceDelay: 300,
    options: [
      { id: 'morning', label: 'Morning (To start the day)', iconComponent: 'MorningIcon' },
      { id: 'afternoon', label: 'Afternoon Slump (Around 3 PM)', iconComponent: 'AfternoonIcon' },
      { id: 'evening', label: 'Evening (After dinner)', iconComponent: 'EveningIcon' },
      { id: 'late_night', label: 'Late Night (Before bed)', iconComponent: 'LateNightIcon' },
    ],
  },

  // Step 4: Frequency (40%)
  {
    id: 'sugar_frequency',
    type: 'single-select',
    title: 'Be honest, how often do you consume sugar?',
    subtitle: 'This helps us personalize your plan',
    progressPercent: 40,
    autoAdvanceDelay: 300,
    options: [
      { id: 'every_day', label: 'Every single day (I need it)' },
      { id: 'few_times_week', label: 'A few times a week' },
      { id: 'weekends', label: 'Only on weekends' },
      { id: 'when_stressed', label: "When I'm stressed" },
    ],
  },

  // Step 5: Emotional response (50%)
  {
    id: 'post_binge_feeling',
    type: 'single-select',
    title: 'How do you feel after a sugar binge?',
    subtitle: 'Understanding this helps break the cycle',
    progressPercent: 50,
    autoAdvanceDelay: 300,
    options: [
      { id: 'low_energy', label: 'Low Energy & Crash' },
      { id: 'bloated', label: 'Bloated & Heavy' },
      { id: 'guilty', label: 'Guilty & Disappointed' },
      { id: 'anxious', label: 'Anxious & Jittery' },
    ],
  },

  // Step 6: NEW - Sleep Quality (60%)
  {
    id: 'sleep_impact',
    type: 'single-select',
    title: 'How does sugar affect your sleep?',
    subtitle: 'Poor sleep prevents true recovery',
    progressPercent: 60,
    autoAdvanceDelay: 300,
    options: [
      { id: 'wake_middle', label: 'I often wake up in the middle of the night', iconComponent: 'WakeMiddleIcon' },
      { id: 'struggle_fall_asleep', label: 'I struggle to fall asleep', iconComponent: 'SleepIcon' },
      { id: 'wake_exhausted', label: 'I wake up feeling exhausted', iconComponent: 'ExhaustedIcon' },
      { id: 'no_difference', label: 'No noticeable difference', iconComponent: 'SleepIcon' },
    ],
  },

  // Step 7: NEW - Relapse History (70%)
  {
    id: 'quit_attempts',
    type: 'single-select',
    title: 'Have you tried to quit sugar before?',
    subtitle: 'Why a structured plan is necessary',
    progressPercent: 70,
    autoAdvanceDelay: 300,
    options: [
      { id: 'multiple_failed', label: 'Yes, multiple times (and failed)', iconComponent: 'MultipleFailedIcon' },
      { id: 'once_twice', label: "Yes, once or twice (but it didn't last)", iconComponent: 'OnceIcon' },
      { id: 'first_attempt', label: 'No, this is my first attempt', iconComponent: 'FirstAttemptIcon' },
      { id: 'currently_struggling', label: "I'm currently trying to quit (but struggling)", iconComponent: 'StruggleIcon' },
    ],
  },

  // Step 8: Money anchor (80%)
  {
    id: 'weekly_spending',
    type: 'single-select',
    title: 'How much do you spend on snacks weekly?',
    subtitle: 'You could save hundreds per year',
    progressPercent: 80,
    autoAdvanceDelay: 300,
    options: [
      { id: 'range_0_10', label: '$0 - $10', iconComponent: 'Money1Icon' },
      { id: 'range_10_30', label: '$10 - $30', iconComponent: 'Money2Icon' },
      { id: 'range_30_50', label: '$30 - $50', iconComponent: 'Money3Icon' },
      { id: 'range_50_plus', label: '$50+ (Shocking!)', iconComponent: 'MoneyShockIcon' },
    ],
  },

  // Step 9: Commitment (90%)
  {
    id: 'commitment',
    type: 'commitment',
    title: 'Are you ready to dedicate 14 days?',
    subtitle: 'Just 2 weeks to transform your relationship with sugar',
    progressPercent: 100,
    options: [
      {
        id: 'ready',
        label: "YES, I'm ready!",
        description: "Let's do this together",
      },
      {
        id: 'thinking',
        label: 'Still thinking',
        description: 'I need more time',
      },
    ],
  },
];
