import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { OnboardingNavBar } from '../../components/onboarding/OnboardingNavBar';
import { Theme } from '../../constants/Theme';
import { trackOnboardingStart, trackOnboardingComplete } from '../../services/AnalyticsService';

// Import screen content components
import GenderContent from '../../components/onboarding/screens/GenderContent';
import AgeContent from '../../components/onboarding/screens/AgeContent';
import MeasurementsContent from '../../components/onboarding/screens/MeasurementsContent';
import ProjectionContent from '../../components/onboarding/screens/ProjectionContent';
import WizardContent from '../../components/onboarding/screens/WizardContent';
import EfficacyContent from '../../components/onboarding/screens/EfficacyContent';
import MethodContent from '../../components/onboarding/screens/MethodContent';
import ReviewsContent from '../../components/onboarding/screens/ReviewsContent';
import NotificationsContent from '../../components/onboarding/screens/NotificationsContent';
import AnalysisContent from '../../components/onboarding/screens/AnalysisContent';

export default function OnboardingFlow() {
  const router = useRouter();
  const { currentScreen, getScreenProgress, goToPreviousScreen } = useOnboarding();

  // Track onboarding start (only once per session)
  const hasTrackedStart = useRef(false);
  useEffect(() => {
    if (!hasTrackedStart.current) {
      hasTrackedStart.current = true;
      trackOnboardingStart();
    }
  }, []);

  const handleBack = () => {
    if (currentScreen === 'gender') {
      // Go back to index/home
      router.back();
    } else {
      goToPreviousScreen();
    }
  };

  const handleComplete = () => {
    // Track onboarding completion
    trackOnboardingComplete();
    // Navigate to signup after onboarding is complete
    router.push('/signup');
  };

  const renderContent = () => {
    switch (currentScreen) {
      case 'gender':
        return <GenderContent />;
      case 'age':
        return <AgeContent />;
      case 'measurements':
        return <MeasurementsContent />;
      case 'projection':
        return <ProjectionContent />;
      case 'wizard':
        return <WizardContent />;
      case 'efficacy':
        return <EfficacyContent />;
      case 'method':
        return <MethodContent />;
      case 'reviews':
        return <ReviewsContent />;
      case 'notifications':
        return <NotificationsContent />;
      case 'analysis':
        return <AnalysisContent onComplete={handleComplete} />;
      default:
        return null;
    }
  };

  // Determine if back button should be shown (show on all screens except analysis)
  const showBackButton = currentScreen !== 'analysis';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <OnboardingNavBar
        progress={getScreenProgress()}
        showBackButton={showBackButton}
        onBack={handleBack}
      />
      <View style={styles.content}>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    flex: 1,
  },
});
