import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useOnboarding } from '../../contexts/OnboardingContext';

export default function SignUp() {
  const router = useRouter();
  const { onboardingData, clearOnboardingData } = useOnboarding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    // Validation
    if (!email || !password || !confirmPassword || !fullName) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (!onboardingData.commitment || onboardingData.main_goals.length === 0) {
      Alert.alert('Error', 'Please complete the onboarding quiz');
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create Auth User
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('User creation failed');
      }

      // Map first goal to legacy main_goal field
      const mapGoalToLegacy = (goalId: string): 'weight_loss' | 'better_energy' | 'health_detox' => {
        const mapping: Record<string, 'weight_loss' | 'better_energy' | 'health_detox'> = {
          'lose_weight': 'weight_loss',
          'boost_energy': 'better_energy',
          'stop_cravings': 'health_detox',
          'fix_brain_fog': 'health_detox',
        };
        return mapping[goalId] || 'health_detox';
      };

      // Step 2: Create Profile with Onboarding Data
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: authData.user.id,
            email: email.trim(),
            full_name: fullName.trim(),
            main_goal: mapGoalToLegacy(onboardingData.main_goals[0]),
            start_date: new Date().toISOString(),
            current_streak: 0,
            longest_streak: 0,
            cravings_count: 0,
            money_saved_weekly: 0,
          },
        ]);

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // Note: User auth account was created, but profile failed
        // You might want to handle this differently in production
        throw new Error('Profile creation failed: ' + profileError.message);
      }

      // Clear onboarding data after successful signup
      clearOnboardingData();

      Alert.alert(
        'Success!',
        'Account created successfully! Please check your email to verify your account.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to main app or login
              Alert.alert('Welcome!', 'You can now log in with your credentials');
              router.replace('/(auth)/login');
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Sign up error:', error);
      Alert.alert('Sign Up Failed', error.message || 'An error occurred during sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Complete your profile to get started
          </Text>

          {/* Show onboarding summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Your Profile:</Text>
            <Text style={styles.summaryText}>
              • Goals: {onboardingData.main_goals.map(goal =>
                goal.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
              ).join(', ')}
            </Text>
            {onboardingData.biggest_weakness && (
              <Text style={styles.summaryText}>
                • Weakness: {onboardingData.biggest_weakness.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Text>
            )}
            <Text style={styles.summaryText}>
              • Commitment: {onboardingData.commitment === 'ready' ? 'Ready for 14 days! 💪' : 'Still thinking'}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                value={fullName}
                onChangeText={setFullName}
                textContentType="name"
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="At least 6 characters"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="newPassword"
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                textContentType="newPassword"
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[styles.signUpButton, loading && styles.signUpButtonDisabled]}
              onPress={handleSignUp}
              disabled={loading}
            >
              <Text style={styles.signUpButtonText}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            <View style={styles.loginPrompt}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                <Text style={styles.loginLink}>Log in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#636E72',
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: '#E8F8F4',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00C897',
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00C897',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#2D3436',
    marginBottom: 4,
  },
  form: {
    gap: 20,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
  },
  input: {
    borderWidth: 2,
    borderColor: '#DFE6E9',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#F8F9FB',
  },
  signUpButton: {
    backgroundColor: '#00C897',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  signUpButtonDisabled: {
    backgroundColor: '#B2BEC3',
  },
  signUpButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 16,
    color: '#636E72',
  },
  loginLink: {
    fontSize: 16,
    color: '#00C897',
    fontWeight: 'bold',
  },
});
