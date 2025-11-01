// app/(tabs)/home.tsx - Complete Dashboard with no external components
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContexts';
import { useAuth } from '../contexts/AuthContexts';
import { Theme } from '../types';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface Class {
  id: number;
  name: string;
  time: string;
  room: string;
  color: string;
}

interface Assignment {
  id: number;
  title: string;
  subject: string;
  due: string;
  priority: 'high' | 'medium' | 'low';
}

interface StudySession {
  id: number;
  subject: string;
  duration: string;
  time: string;
  type: string;
}

export default function Home() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [showPomodoro, setShowPomodoro] = useState(false);
  const [checkedAssignments, setCheckedAssignments] = useState<number[]>([]);

  const styles = createStyles(theme);

  const upcomingClasses: Class[] = [
    { id: 1, name: 'data structures', time: '10:00 am', room: 'cs-201', color: '#1a1a1a' },
    { id: 2, name: 'calculus ii', time: '2:00 pm', room: 'math-105', color: '#4a4a4a' },
    { id: 3, name: 'english literature', time: '4:30 pm', room: 'eng-302', color: '#6a6a6a' },
  ];

  const assignments: Assignment[] = [
    { id: 1, title: 'algorithm analysis essay', subject: 'data structures', due: 'tomorrow', priority: 'high' },
    { id: 2, title: 'chapter 5 practice problems', subject: 'calculus ii', due: '3 days', priority: 'medium' },
    { id: 3, title: 'book report draft', subject: 'english literature', due: '1 week', priority: 'low' },
  ];

  const studySessions: StudySession[] = [
    { id: 1, subject: 'data structures', duration: '45 min', time: '8:00 pm', type: 'review' },
    { id: 2, subject: 'calculus ii', duration: '60 min', time: '9:00 pm', type: 'practice' },
  ];

  const toggleAssignment = (id: number) => {
    if (checkedAssignments.includes(id)) {
      setCheckedAssignments(checkedAssignments.filter(item => item !== id));
    } else {
      setCheckedAssignments([...checkedAssignments, id]);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return theme.colors.error;
      case 'medium': return theme.colors.warning;
      case 'low': return theme.colors.text.secondary;
      default: return theme.colors.text.secondary;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Pomodoro Modal */}
      {showPomodoro && (
        <PomodoroTimer 
          theme={theme}
          onClose={() => setShowPomodoro(false)}
        />
      )}

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <LinearGradient
          colors={isDark ? ['#ffffff', '#f5f5f5'] : ['#1a1a1a', '#2d2d2d']}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <View>
              <Text style={[styles.welcomeText, { color: isDark ? '#000' : '#fff' }]}>
                welcome back, {user?.name?.split(' ')[0].toLowerCase() || 'alex'}!
              </Text>
              <Text style={[styles.dateText, { color: isDark ? '#666' : '#ccc' }]}>
                thursday, october 17, 2025
              </Text>
            </View>
          </View>

          {/* Today's Progress Card */}
          <View style={[styles.progressCard, { backgroundColor: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }]}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressTitle, { color: isDark ? '#000' : '#fff' }]}>
                today's progress
              </Text>
              <Text style={[styles.progressValue, { color: isDark ? '#000' : '#fff' }]}>
                2.5 / 4 hours
              </Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarBackground, { backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)' }]}>
                <View style={[styles.progressBarFill, { width: '62.5%' }]}>
                  <LinearGradient
                    colors={[theme.colors.primary, theme.colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.progressGradient}
                  />
                </View>
              </View>
            </View>
            <Text style={[styles.progressMessage, { color: isDark ? '#666' : '#ccc' }]}>
              great! you're on track 🎯
            </Text>
          </View>
        </LinearGradient>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Pomodoro Quick Access */}
          <TouchableOpacity 
            style={styles.pomodoroButton}
            onPress={() => setShowPomodoro(true)}
          >
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.secondary]}
              style={styles.pomodoroGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="timer-outline" size={20} color="#fff" />
              <Text style={styles.pomodoroText}>start pomodoro session</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Today's Classes Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleContainer}>
                <Ionicons name="calendar-outline" size={20} color={theme.colors.text.primary} />
                <Text style={styles.cardTitle}>Today's classes</Text>
              </View>
              <Text style={styles.viewAllText}>view all</Text>
            </View>
            <View style={styles.cardContent}>
              {upcomingClasses.map((cls, index) => (
                <View 
                  key={cls.id} 
                  style={[
                    styles.classItem,
                    index !== upcomingClasses.length - 1 && styles.itemMargin
                  ]}
                >
                  <View style={[styles.classIndicator, { backgroundColor: cls.color }]} />
                  <View style={styles.classInfo}>
                    <Text style={styles.className}>{cls.name}</Text>
                    <View style={styles.classDetails}>
                      <Ionicons name="time-outline" size={12} color={theme.colors.text.secondary} />
                      <Text style={styles.classTime}>{cls.time}</Text>
                      <Text style={styles.classSeparator}>•</Text>
                      <Text style={styles.classRoom}>{cls.room}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Assignments Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleContainer}>
                <Ionicons name="book-outline" size={20} color={theme.colors.text.primary} />
                <Text style={styles.cardTitle}>assignments</Text>
              </View>
              <Text style={styles.viewAllText}>view all</Text>
            </View>
            <View style={styles.cardContent}>
              {assignments.map((assignment, index) => (
                <View 
                  key={assignment.id} 
                  style={[
                    styles.assignmentItem,
                    index !== assignments.length - 1 && styles.itemMargin
                  ]}
                >
                  <TouchableOpacity 
                    style={styles.checkbox}
                    onPress={() => toggleAssignment(assignment.id)}
                  >
                    {checkedAssignments.includes(assignment.id) && (
                      <Ionicons name="checkmark" size={16} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                  <View style={styles.assignmentInfo}>
                    <Text style={[
                      styles.assignmentTitle,
                      checkedAssignments.includes(assignment.id) && styles.assignmentTitleChecked
                    ]}>
                      {assignment.title}
                    </Text>
                    <Text style={styles.assignmentSubject}>{assignment.subject}</Text>
                    <View style={[styles.badge, { backgroundColor: getPriorityColor(assignment.priority) + '20' }]}>
                      <Text style={[styles.badgeText, { color: getPriorityColor(assignment.priority) }]}>
                        due {assignment.due}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* AI Suggested Sessions Card */}
          <View style={[styles.card, styles.aiCard]}>
            <View style={styles.cardHeader}>
              <View>
                <View style={styles.cardTitleContainer}>
                  <Ionicons name="trending-up-outline" size={20} color={theme.colors.text.primary} />
                  <Text style={styles.cardTitle}>ai suggested sessions</Text>
                </View>
                <Text style={styles.aiSubtitle}>optimized for your learning style</Text>
              </View>
            </View>
            <View style={styles.cardContent}>
              {studySessions.map((session, index) => (
                <View 
                  key={session.id} 
                  style={[
                    styles.sessionItem,
                    index !== studySessions.length - 1 && styles.itemMargin
                  ]}
                >
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionSubject}>{session.subject}</Text>
                    <View style={styles.sessionDetails}>
                      <Ionicons name="time-outline" size={12} color={theme.colors.text.secondary} />
                      <Text style={styles.sessionTime}>{session.time}</Text>
                      <Text style={styles.sessionSeparator}>•</Text>
                      <Text style={styles.sessionDuration}>{session.duration}</Text>
                    </View>
                  </View>
                  <View style={styles.sessionBadge}>
                    <Text style={styles.sessionBadgeText}>{session.type}</Text>
                  </View>
                </View>
              ))}
              <TouchableOpacity style={styles.startSessionButton}>
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.secondary]}
                  style={styles.startSessionGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.startSessionText}>start study session</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Pomodoro Timer Component
interface PomodoroTimerProps {
  theme: Theme;
  onClose: () => void;
}

const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ theme, onClose }) => {
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  React.useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning) {
      interval = setInterval(() => {
        if (seconds === 0) {
          if (minutes === 0) {
            setIsRunning(false);
          } else {
            setMinutes(prev => prev - 1);
            setSeconds(59);
          }
        } else {
          setSeconds(prev => prev - 1);
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, minutes, seconds]);

  const timerStyles = StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    modal: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 30,
      width: width - 60,
      alignItems: 'center',
    },
    closeButton: {
      position: 'absolute',
      top: 15,
      right: 15,
    },
    title: {
      fontSize: 24,
      fontFamily: theme.fonts.bold,
      color: theme.colors.text.primary,
      marginBottom: 30,
    },
    timerDisplay: {
      fontSize: 72,
      fontFamily: theme.fonts.bold,
      color: theme.colors.primary,
      marginVertical: 30,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 15,
      marginTop: 20,
    },
    button: {
      paddingHorizontal: 30,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: theme.colors.primary,
    },
    buttonText: {
      color: '#fff',
      fontFamily: theme.fonts.semiBold,
      fontSize: 16,
    },
    resetButton: {
      backgroundColor: theme.colors.surface,
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    resetButtonText: {
      color: theme.colors.text.primary,
    },
  });

  return (
    <View style={timerStyles.overlay}>
      <View style={timerStyles.modal}>
        <TouchableOpacity style={timerStyles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color={theme.colors.text.secondary} />
        </TouchableOpacity>
        
        <Text style={timerStyles.title}>pomodoro timer</Text>
        
        <Text style={timerStyles.timerDisplay}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </Text>
        
        <View style={timerStyles.buttonContainer}>
          <TouchableOpacity 
            style={timerStyles.button}
            onPress={() => setIsRunning(!isRunning)}
          >
            <Text style={timerStyles.buttonText}>
              {isRunning ? 'pause' : 'start'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[timerStyles.button, timerStyles.resetButton]}
            onPress={() => {
              setMinutes(25);
              setSeconds(0);
              setIsRunning(false);
            }}
          >
            <Text style={[timerStyles.buttonText, timerStyles.resetButtonText]}>
              reset
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  headerGradient: {
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  welcomeText: {
    fontSize: 24,
    fontFamily: theme.fonts.bold,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 14,
    fontFamily: theme.fonts.regular,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCard: {
    marginHorizontal: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  progressTitle: {
    fontSize: 14,
    fontFamily: theme.fonts.medium,
  },
  progressValue: {
    fontSize: 14,
    fontFamily: theme.fonts.semiBold,
  },
  progressBarContainer: {
    marginBottom: theme.spacing.sm,
  },
  progressBarBackground: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressGradient: {
    flex: 1,
  },
  progressMessage: {
    fontSize: 12,
    fontFamily: theme.fonts.regular,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: 100,
  },
  pomodoroButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pomodoroGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    gap: 8,
  },
  pomodoroText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: theme.fonts.semiBold,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  aiCard: {
    backgroundColor: theme.colors.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: theme.fonts.semiBold,
    color: theme.colors.text.primary,
  },
  viewAllText: {
    fontSize: 14,
    fontFamily: theme.fonts.medium,
    color: theme.colors.primary,
  },
  aiSubtitle: {
    fontSize: 12,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text.secondary,
    marginTop: 2,
    marginLeft: 28,
  },
  cardContent: {
    gap: theme.spacing.sm,
  },
  classItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    gap: 12,
  },
  classIndicator: {
    width: 4,
    height: 48,
    borderRadius: 2,
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 16,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  classDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  classTime: {
    fontSize: 12,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text.secondary,
  },
  classSeparator: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  classRoom: {
    fontSize: 12,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text.secondary,
  },
  assignmentItem: {
    flexDirection: 'row',
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentTitle: {
    fontSize: 16,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  assignmentTitleChecked: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  assignmentSubject: {
    fontSize: 12,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text.secondary,
    marginBottom: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: theme.fonts.medium,
  },
  sessionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionSubject: {
    fontSize: 16,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  sessionDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionTime: {
    fontSize: 12,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text.secondary,
  },
  sessionSeparator: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  sessionDuration: {
    fontSize: 12,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text.secondary,
  },
  sessionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.border + '40',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sessionBadgeText: {
    fontSize: 12,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text.secondary,
  },
  startSessionButton: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: theme.spacing.sm,
  },
  startSessionGradient: {
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  startSessionText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: theme.fonts.semiBold,
  },
  itemMargin: {
    marginBottom: theme.spacing.sm,
  },
});