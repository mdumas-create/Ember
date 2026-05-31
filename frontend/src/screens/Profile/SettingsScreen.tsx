import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, TextInput, Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { ChevronRight, ChevronLeft, Bell, Lock, Shield, Trash2, LogOut, Moon } from 'lucide-react-native';
import api from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/Button';
import { useThemeMode } from '../../context/ThemeContext';

const SettingsScreen = () => {
  const { user, signOut, updateUser } = useAuth();
  const navigation = useNavigation<any>();
  const { mode, toggle, colors } = useThemeMode();
  const styles = createStyles(colors);
  const [isPublic, setIsPublic] = useState(user?.isPublic ?? true);
  const [notifyPush, setNotifyPush] = useState(user?.notifyPush ?? true);
  const [notifyMessages, setNotifyMessages] = useState(user?.notifyMessages ?? true);
  const [notifyLikes, setNotifyLikes] = useState(user?.notifyLikes ?? true);
  const [notifyComments, setNotifyComments] = useState(user?.notifyComments ?? true);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const togglePublic = async (value: boolean) => {
    setIsPublic(value);
    try {
      const response = await api.put('users/me', { isPublic: value });
      updateUser(response.data);
    } catch (error) {
      setIsPublic(!value);
      Alert.alert('Error', 'No se pudo actualizar la privacidad');
    }
  };

  const updateNotificationPrefs = async (data: any, rollback: () => void) => {
    try {
      const response = await api.put('users/me', data);
      updateUser(response.data);
    } catch (error) {
      rollback();
      Alert.alert('Error', 'No se pudieron actualizar las notificaciones');
    }
  };

  const toggleNotifyPush = (value: boolean) => {
    setNotifyPush(value);
    updateNotificationPrefs({ notifyPush: value }, () => setNotifyPush(!value));
  };
  const toggleNotifyMessages = (value: boolean) => {
    setNotifyMessages(value);
    updateNotificationPrefs({ notifyMessages: value }, () => setNotifyMessages(!value));
  };
  const toggleNotifyLikes = (value: boolean) => {
    setNotifyLikes(value);
    updateNotificationPrefs({ notifyLikes: value }, () => setNotifyLikes(!value));
  };
  const toggleNotifyComments = (value: boolean) => {
    setNotifyComments(value);
    updateNotificationPrefs({ notifyComments: value }, () => setNotifyComments(!value));
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) return;
    setChangingPassword(true);
    try {
      await api.post('users/me/change-password', { oldPassword, newPassword });
      Alert.alert('Éxito', 'Contraseña actualizada');
      setShowPasswordChange(false);
      setOldPassword('');
      setNewPassword('');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'No se pudo cambiar la contraseña');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Eliminar cuenta',
      '¿Seguro que quieres eliminar tu cuenta? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('users/me');
              await signOut();
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar la cuenta');
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Configuración</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Notificaciones</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingLabel}>
              <View style={styles.iconBox}><Bell size={18} color={colors.primary} /></View>
              <Text style={styles.settingText}>Notificaciones Push</Text>
            </View>
            <Switch value={notifyPush} onValueChange={toggleNotifyPush} trackColor={{ false: colors.border, true: colors.primary }} />
          </View>

          <View style={[styles.settingRow, !notifyPush && { opacity: 0.5 }]}>
            <View style={styles.settingLabel}>
              <View style={styles.iconBox}><Bell size={18} color={colors.textSecondary} /></View>
              <Text style={styles.settingText}>Mensajes</Text>
            </View>
            <Switch value={notifyMessages} onValueChange={toggleNotifyMessages} disabled={!notifyPush} trackColor={{ false: colors.border, true: colors.primary }} />
          </View>

          <View style={[styles.settingRow, !notifyPush && { opacity: 0.5 }]}>
            <View style={styles.settingLabel}>
              <View style={styles.iconBox}><Bell size={18} color={colors.textSecondary} /></View>
              <Text style={styles.settingText}>Likes</Text>
            </View>
            <Switch value={notifyLikes} onValueChange={toggleNotifyLikes} disabled={!notifyPush} trackColor={{ false: colors.border, true: colors.primary }} />
          </View>

          <View style={[styles.settingRow, !notifyPush && { opacity: 0.5, borderBottomWidth: 0 }]}>
            <View style={styles.settingLabel}>
              <View style={styles.iconBox}><Bell size={18} color={colors.textSecondary} /></View>
              <Text style={styles.settingText}>Comentarios</Text>
            </View>
            <Switch value={notifyComments} onValueChange={toggleNotifyComments} disabled={!notifyPush} trackColor={{ false: colors.border, true: colors.primary }} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Privacidad</Text>
          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <View style={styles.settingLabel}>
              <View style={styles.iconBox}><Shield size={18} color={colors.community} /></View>
              <View>
                <Text style={styles.settingText}>Perfil Público</Text>
                <Text style={styles.settingSubtext}>Otros usuarios pueden seguirte</Text>
              </View>
            </View>
            <Switch value={isPublic} onValueChange={togglePublic} trackColor={{ false: colors.border, true: colors.community }} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Apariencia</Text>
          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <View style={styles.settingLabel}>
              <View style={styles.iconBox}><Moon size={18} color={colors.primary} /></View>
              <Text style={styles.settingText}>Modo oscuro</Text>
            </View>
            <Switch value={mode === 'dark'} onValueChange={() => toggle()} trackColor={{ false: colors.border, true: colors.primary }} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Seguridad</Text>
          <TouchableOpacity 
            style={[styles.settingRow, showPasswordChange ? { borderBottomWidth: 1 } : { borderBottomWidth: 0 }]} 
            onPress={() => setShowPasswordChange(!showPasswordChange)}
          >
            <View style={styles.settingLabel}>
              <View style={styles.iconBox}><Lock size={18} color={colors.textSecondary} /></View>
              <Text style={styles.settingText}>Cambiar Contraseña</Text>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} style={{ transform: [{ rotate: showPasswordChange ? '90deg' : '0deg' }] }} />
          </TouchableOpacity>

          {showPasswordChange && (
            <View style={styles.passwordForm}>
              <TextInput
                style={styles.input}
                placeholder="Contraseña actual"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                value={oldPassword}
                onChangeText={setOldPassword}
              />
              <TextInput
                style={styles.input}
                placeholder="Nueva contraseña"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <Button 
                title="Actualizar contraseña" 
                onPress={handleChangePassword} 
                loading={changingPassword}
                style={{ marginTop: 10, width: '100%' }}
              />
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <TouchableOpacity 
            style={styles.settingRow} 
            onPress={() => navigation.navigate('Legal', { type: 'terms' })}
          >
            <View style={styles.settingLabel}>
              <View style={styles.iconBox}><Shield size={18} color={colors.textSecondary} /></View>
              <Text style={styles.settingText}>Términos de Servicio</Text>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.settingRow, { borderBottomWidth: 0 }]} 
            onPress={() => navigation.navigate('Legal', { type: 'privacy' })}
          >
            <View style={styles.settingLabel}>
              <View style={styles.iconBox}><Shield size={18} color={colors.textSecondary} /></View>
              <Text style={styles.settingText}>Política de Privacidad</Text>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Cuenta</Text>
          
          {(user?.role === 'ADMIN' || user?.role === 'MODERATOR') && (
            <TouchableOpacity 
              style={styles.settingRow} 
              onPress={() => navigation.navigate('Admin')}
            >
              <View style={styles.settingLabel}>
                <View style={[styles.iconBox, { backgroundColor: `${colors.primary}22` }]}>
                  <Shield size={18} color={colors.primary} />
                </View>
                <Text style={[styles.settingText, { color: colors.primary, fontWeight: 'bold' }]}>
                  Panel de Moderación
                </Text>
              </View>
              <ChevronRight size={20} color={colors.primary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.settingRow} onPress={signOut}>
            <View style={styles.settingLabel}>
              <View style={styles.iconBox}><LogOut size={18} color={colors.textSecondary} /></View>
              <Text style={styles.settingText}>Cerrar Sesión</Text>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.settingRow, { borderBottomWidth: 0 }]} onPress={handleDeleteAccount}>
            <View style={styles.settingLabel}>
              <View style={[styles.iconBox, { backgroundColor: `${colors.danger}15` }]}>
                <Trash2 size={18} color={colors.danger} />
              </View>
              <Text style={[styles.settingText, { color: colors.danger, fontWeight: '600' }]}>Eliminar cuenta</Text>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.navBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...Platform.select({
      web: {
        maxWidth: 640,
        alignSelf: 'center',
        width: '100%',
      } as any
    })
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 10px rgba(0,0,0,0.03)' } as any,
    })
  },
  sectionTitle: { 
    paddingHorizontal: 18, 
    paddingTop: 18, 
    paddingBottom: 8, 
    fontSize: 12, 
    fontWeight: '800', 
    color: colors.textSecondary, 
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  settingRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 14, 
    paddingHorizontal: 18, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border 
  },
  settingLabel: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 14 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingText: { fontSize: 15, fontWeight: '500', color: colors.text },
  settingSubtext: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  passwordForm: { 
    padding: 18, 
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: { 
    backgroundColor: colors.surface, 
    padding: 14, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: colors.border, 
    marginBottom: 12, 
    color: colors.text,
    fontSize: 15,
  },
});

export default SettingsScreen;

