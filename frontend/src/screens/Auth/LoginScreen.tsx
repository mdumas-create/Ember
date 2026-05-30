import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useThemeMode } from '../../context/ThemeContext';
import { trackEvent } from '../../utils/analytics';
import Logo from '../../components/Logo';

const LoginScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
  const { colors } = useThemeMode();
  const styles = createStyles(colors);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Error', 'Completa todos los campos');
    setLoading(true);
    try {
      await signIn(email, password);
      trackEvent('login', { email });
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            {/* Logo */}
            <View style={styles.logoWrap}>
              <Logo size={72} showText={false} />
            </View>
            <Text style={styles.appName}>Ember</Text>
            <Text style={styles.tagline}>🔥 Tu comunidad, tu energía</Text>

            <View style={styles.divider} />

            <Text style={styles.sectionLabel}>Iniciar sesión</Text>

            <Input
              label="Email"
              placeholder="tu@email.com"
              value={email}
              onChangeText={setEmail}
            />
            <Input
              label="Contraseña"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <Button
              title={loading ? '' : 'Entrar'}
              onPress={handleLogin}
              loading={loading}
            />

            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={styles.linkText}>¿No tenés cuenta? </Text>
              <Text style={[styles.linkText, { color: colors.primary, fontWeight: '700' }]}>Registrate</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 28,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
      },
      android: { elevation: 4 },
      web: { boxShadow: '0 8px 32px rgba(0,0,0,0.08)' } as any,
    }),
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  linkText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});

export default LoginScreen;
