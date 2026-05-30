import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useThemeMode } from '../../context/ThemeContext';
import { trackEvent } from '../../utils/analytics';
import Logo from '../../components/Logo';

const RegisterScreen = ({ navigation }: any) => {
  const { colors } = useThemeMode();
  const styles = createStyles(colors);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  const handleRegister = async () => {
    if (!email || !username || !password) return Alert.alert('Error', 'Completa todos los campos');
    setLoading(true);
    try {
      await signUp(email, username, password);
      trackEvent('register', { email, username });
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Error al registrarse');
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
            <Text style={styles.tagline}>🔥 Únete a la comunidad</Text>

            <View style={styles.divider} />

            <Text style={styles.sectionLabel}>Crear cuenta</Text>

            <Input label="Email" placeholder="tu@email.com" value={email} onChangeText={setEmail} />
            <Input label="Usuario" placeholder="usuario123" value={username} onChangeText={setUsername} />
            <Input label="Contraseña" placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry />

            <Button title={loading ? '' : 'Registrarse'} onPress={handleRegister} loading={loading} />

            <TouchableOpacity
              style={styles.legalRow}
              onPress={() => navigation.navigate('Legal', { type: 'terms' })}
            >
              <Text style={styles.legalText}>
                Al registrarte aceptás los{' '}
                <Text style={{ color: colors.primary, fontWeight: '600' }}>Términos y Política de Privacidad</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkRow} onPress={() => navigation.goBack()}>
              <Text style={styles.linkText}>¿Ya tenés cuenta? </Text>
              <Text style={[styles.linkText, { color: colors.primary, fontWeight: '700' }]}>Iniciar sesión</Text>
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
  legalRow: {
    marginTop: 12,
  },
  legalText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
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

export default RegisterScreen;
