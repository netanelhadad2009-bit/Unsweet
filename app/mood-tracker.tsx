/**
 * Mood Tracker Screen
 *
 * Allows users to log their daily mood and withdrawal symptoms
 * during their sugar detox journey.
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';

// Colors - Calm wellness aesthetic
const COLORS = {
  background: '#F8FAF9',
  cardBackground: '#FFFFFF',
  headingText: '#1C1C1E',
  bodyText: '#3C3C43',
  mutedText: '#8E8E93',
  primary: '#10B981',
  primaryLight: 'rgba(16, 185, 129, 0.1)',
  border: '#E5E5EA',
  // Mood colors
  terrible: '#EF4444',
  bad: '#F97316',
  okay: '#EAB308',
  good: '#22C55E',
  amazing: '#10B981',
  // Tag colors
  negativeTag: '#FEE2E2',
  negativeTagText: '#DC2626',
  positiveTag: '#D1FAE5',
  positiveTagText: '#059669',
};

// Mood options
const MOOD_OPTIONS = [
  { score: 1, emoji: '😣', label: 'Terrible', color: COLORS.terrible },
  { score: 2, emoji: '🙁', label: 'Bad', color: COLORS.bad },
  { score: 3, emoji: '😐', label: 'Okay', color: COLORS.okay },
  { score: 4, emoji: '🙂', label: 'Good', color: COLORS.good },
  { score: 5, emoji: '🤩', label: 'Amazing', color: COLORS.amazing },
];

// Tag options
const NEGATIVE_TAGS = ['Cravings', 'Headache', 'Tired', 'Irritable', 'Anxious', 'Brain Fog'];
const POSITIVE_TAGS = ['High Energy', 'Focused', 'Light', 'Proud', 'Calm', 'Motivated'];

interface MoodLog {
  id: string;
  score: number;
  tags: string[];
  note: string | null;
  created_at: string;
}

export default function MoodTrackerScreen() {
  const router = useRouter();
  const { title } = useLocalSearchParams<{ title?: string }>();
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [recentLogs, setRecentLogs] = useState<MoodLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch user and recent logs on mount
  useEffect(() => {
    fetchUserAndLogs();
  }, []);

  const fetchUserAndLogs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        await fetchRecentLogs(user.id);
      }
    } catch (error) {
      // Silently handle user fetch errors
    }
  };

  const fetchRecentLogs = async (uid: string) => {
    try {
      setLoadingLogs(true);
      const { data, error } = await supabase
        .from('mood_logs')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        // Silently handle fetch errors
      } else if (data) {
        setRecentLogs(data);
      }
    } catch (error) {
      // Silently handle errors
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleMoodSelect = (score: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMood(score);
  };

  const handleTagToggle = (tag: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleLogMood = async () => {
    if (!selectedMood) {
      Alert.alert('Select a Mood', 'Please select how you\'re feeling before logging.');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'Unable to identify user. Please try again.');
      return;
    }

    try {
      setSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { error } = await supabase
        .from('mood_logs')
        .insert({
          user_id: userId,
          score: selectedMood,
          tags: selectedTags.length > 0 ? selectedTags : null,
          note: note.trim() || null,
        });

      if (error) {
        Alert.alert('Error', 'Failed to log mood. Please try again.');
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Reset form
      setSelectedMood(null);
      setSelectedTags([]);
      setNote('');

      // Refresh logs
      await fetchRecentLogs(userId);

      Alert.alert(
        'Mood Logged! ✨',
        'Great job tracking your feelings. Keep it up!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getMoodInfo = (score: number) => {
    return MOOD_OPTIONS.find(m => m.score === score) || MOOD_OPTIONS[2];
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: (title as string) || 'Mood Tracker',
          headerShown: true,
          headerStyle: { backgroundColor: COLORS.background },
          headerShadowVisible: false,
          headerTintColor: COLORS.primary,
          headerBackTitle: 'Home',
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>How are you feeling?</Text>
            <Text style={styles.subtitle}>
              Track your mood to understand your sugar-free journey better
            </Text>
          </View>

          {/* Mood Selection */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Select your mood</Text>
            <View style={styles.moodGrid}>
              {MOOD_OPTIONS.map((mood) => (
                <TouchableOpacity
                  key={mood.score}
                  style={[
                    styles.moodOption,
                    selectedMood === mood.score && styles.moodOptionSelected,
                    selectedMood === mood.score && { borderColor: mood.color },
                  ]}
                  onPress={() => handleMoodSelect(mood.score)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.moodEmoji,
                    selectedMood === mood.score && styles.moodEmojiSelected,
                  ]}>
                    {mood.emoji}
                  </Text>
                  <Text style={[
                    styles.moodLabel,
                    selectedMood === mood.score && { color: mood.color, fontWeight: '600' },
                  ]}>
                    {mood.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Tags - What's happening? */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>What's happening?</Text>
            <Text style={styles.sectionSubtitle}>Select all that apply</Text>

            {/* Negative Tags */}
            <Text style={styles.tagGroupLabel}>Challenges</Text>
            <View style={styles.tagsContainer}>
              {NEGATIVE_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.tag,
                    styles.negativeTag,
                    selectedTags.includes(tag) && styles.negativeTagSelected,
                  ]}
                  onPress={() => handleTagToggle(tag)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.tagText,
                    styles.negativeTagText,
                    selectedTags.includes(tag) && styles.negativeTagTextSelected,
                  ]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Positive Tags */}
            <Text style={styles.tagGroupLabel}>Wins</Text>
            <View style={styles.tagsContainer}>
              {POSITIVE_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.tag,
                    styles.positiveTag,
                    selectedTags.includes(tag) && styles.positiveTagSelected,
                  ]}
                  onPress={() => handleTagToggle(tag)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.tagText,
                    styles.positiveTagText,
                    selectedTags.includes(tag) && styles.positiveTagTextSelected,
                  ]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Note */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Add a note (optional)</Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="How's your day going? Any thoughts..."
              placeholderTextColor={COLORS.mutedText}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={styles.charCount}>{note.length}/500</Text>
          </View>

          {/* Log Button */}
          <TouchableOpacity
            style={[styles.logButton, saving && styles.logButtonDisabled]}
            onPress={handleLogMood}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.logButtonText}>Log Mood</Text>
            )}
          </TouchableOpacity>

          {/* Recent History */}
          {recentLogs.length > 0 && (
            <View style={styles.historySection}>
              <Text style={styles.historyTitle}>Recent Logs</Text>
              {loadingLogs ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                recentLogs.slice(0, 3).map((log) => {
                  const moodInfo = getMoodInfo(log.score);
                  return (
                    <View key={log.id} style={styles.historyItem}>
                      <Text style={styles.historyEmoji}>{moodInfo.emoji}</Text>
                      <View style={styles.historyContent}>
                        <View style={styles.historyHeader}>
                          <Text style={styles.historyLabel}>{moodInfo.label}</Text>
                          <Text style={styles.historyDate}>{formatDate(log.created_at)}</Text>
                        </View>
                        {log.tags && log.tags.length > 0 && (
                          <View style={styles.historyTags}>
                            {log.tags.slice(0, 3).map((tag, idx) => (
                              <Text key={idx} style={styles.historyTag}>{tag}</Text>
                            ))}
                            {log.tags.length > 3 && (
                              <Text style={styles.historyTagMore}>+{log.tags.length - 3}</Text>
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Header
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.headingText,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.mutedText,
    lineHeight: 22,
  },

  // Card
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.headingText,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.mutedText,
    marginBottom: 16,
  },

  // Mood Selection
  moodGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  moodOption: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 58,
  },
  moodOptionSelected: {
    backgroundColor: COLORS.cardBackground,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  moodEmoji: {
    fontSize: 32,
    marginBottom: 6,
  },
  moodEmojiSelected: {
    fontSize: 38,
  },
  moodLabel: {
    fontSize: 11,
    color: COLORS.mutedText,
    fontWeight: '500',
  },

  // Tags
  tagGroupLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.bodyText,
    marginTop: 12,
    marginBottom: 10,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  negativeTag: {
    backgroundColor: '#FFF7F7',
    borderColor: '#FECACA',
  },
  negativeTagSelected: {
    backgroundColor: COLORS.negativeTag,
    borderColor: COLORS.negativeTagText,
  },
  positiveTag: {
    backgroundColor: '#F0FDF9',
    borderColor: '#A7F3D0',
  },
  positiveTagSelected: {
    backgroundColor: COLORS.positiveTag,
    borderColor: COLORS.positiveTagText,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
  },
  negativeTagText: {
    color: '#B91C1C',
  },
  negativeTagTextSelected: {
    color: COLORS.negativeTagText,
    fontWeight: '600',
  },
  positiveTagText: {
    color: '#047857',
  },
  positiveTagTextSelected: {
    color: COLORS.positiveTagText,
    fontWeight: '600',
  },

  // Note Input
  noteInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    fontSize: 15,
    color: COLORS.bodyText,
    minHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  charCount: {
    fontSize: 11,
    color: COLORS.mutedText,
    textAlign: 'right',
    marginTop: 6,
  },

  // Log Button
  logButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logButtonDisabled: {
    opacity: 0.7,
  },
  logButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // History Section
  historySection: {
    marginTop: 8,
  },
  historyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.headingText,
    marginBottom: 14,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  historyEmoji: {
    fontSize: 28,
    marginRight: 14,
  },
  historyContent: {
    flex: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.headingText,
  },
  historyDate: {
    fontSize: 12,
    color: COLORS.mutedText,
  },
  historyTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  historyTag: {
    fontSize: 11,
    color: COLORS.mutedText,
    backgroundColor: COLORS.background,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  historyTagMore: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '500',
  },
});
