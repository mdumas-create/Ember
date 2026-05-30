import React, { useState } from 'react';
import { TextInput, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useThemeMode } from '../context/ThemeContext';

interface InputProps {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ placeholder, value, onChangeText, secureTextEntry, label, error }) => {
  const { colors } = useThemeMode();
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const styles = StyleSheet.create({
    container: {
      marginVertical: 8,
    },
    label: {
      color: colors.text,
      fontSize: 14,
      marginBottom: 6,
      fontWeight: '600',
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 50,
      backgroundColor: colors.cardBg,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: focused ? colors.primary : error ? colors.danger : colors.border,
    },
    input: {
      flex: 1,
      paddingHorizontal: 14,
      fontSize: 15,
      color: colors.text,
    },
    eyeBtn: {
      paddingHorizontal: 14,
    },
    errorText: {
      color: colors.danger,
      fontSize: 12,
      marginTop: 4,
      marginLeft: 2,
    },
  });

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !showPassword}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secureTextEntry && (
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
            {showPassword
              ? <EyeOff size={18} color={colors.textSecondary} />
              : <Eye size={18} color={colors.textSecondary} />
            }
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};
