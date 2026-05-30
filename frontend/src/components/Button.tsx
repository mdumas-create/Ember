import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, View } from 'react-native';
import { useThemeMode } from '../context/ThemeContext';

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  type?: 'primary' | 'secondary' | 'outline';
  style?: ViewStyle | ViewStyle[];
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ title, onPress, loading, type = 'primary', style, icon }) => {
  const { colors } = useThemeMode();

  const styles = StyleSheet.create({
    button: {
      height: 50,
      borderRadius: 25,          // Pill shape matching mockup
      justifyContent: 'center',
      alignItems: 'center',
      marginVertical: 8,
      paddingHorizontal: 24,
      flexDirection: 'row',
      gap: 8,
    },
    primary: {
      backgroundColor: colors.primary,
    },
    secondary: {
      backgroundColor: colors.community,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    text: {
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    textPrimary: {
      color: '#FFFFFF',
    },
    textSecondary: {
      color: '#FFFFFF',
    },
    textOutline: {
      color: colors.text,
    },
  });

  const textStyle = type === 'outline' ? styles.textOutline
    : type === 'secondary' ? styles.textSecondary
    : styles.textPrimary;

  return (
    <TouchableOpacity
      style={[styles.button, styles[type], style]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.82}
    >
      {loading ? (
        <ActivityIndicator color={type === 'outline' ? colors.primary : '#FFFFFF'} />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};
