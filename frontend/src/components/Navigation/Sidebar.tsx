import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { Flame, Home, Compass, MessageCircle, Bell, User, Settings, LogOut } from 'lucide-react-native';
import { useThemeMode } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { navigationRef } from '../../utils/navigation';

const Sidebar = () => {
  const navigation = useNavigation<any>();
  const { colors, mode } = useThemeMode();
  const { user, signOut } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  
  // Extracción del nombre de la ruta activa de forma recursiva para manejar anidamiento
  const routeName = useNavigationState((state: any) => {
    const getActiveRouteName = (navState: any): string => {
      if (!navState || !navState.routes) return 'Feed';
      const route = navState.routes[navState.index ?? 0];
      if (route.state) {
        return getActiveRouteName(route.state);
      }
      return route.name;
    };
    return getActiveRouteName(state);
  }) as string;

  const styles = createStyles(colors, mode);

  const navItems = [
    { name: 'Feed', icon: Home, label: 'Feed' },
    { name: 'Explore', icon: Compass, label: 'Explorar' },
    { name: 'Chats', icon: MessageCircle, label: 'Chats' },
    { name: 'Notifications', icon: Bell, label: 'Notificaciones' },
    { name: 'Profile', icon: User, label: 'Perfil' },
  ] as { name: string; icon: any; label: string; badge?: any }[];

  return (
    <View style={styles.sidebar}>
      {/* Logo */}
      <View style={styles.logoContainer}>
        <Flame size={28} color="#F97316" fill="#F97316" />
        <Text style={styles.logoText}>Ember</Text>
      </View>

      <View style={styles.divider} />

      {/* Main Navigation */}
      <View style={styles.navContainer}>
        {navItems.map((item) => {
          const isActive = routeName === item.name || (item.name === 'Profile' && (routeName === 'Profile' || routeName === 'UserProfile'));
          const Icon = item.icon;
          
          return (
            <TouchableOpacity 
              key={item.name}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => {
                if (navigationRef.isReady()) {
                  // Navegamos a 'Main' y especificamos la pantalla interna
                  // Si es el perfil, pasamos el ID del usuario actual
                  const params = item.name === 'Profile' ? { userId: user?.id } : {};
                  (navigationRef as any).navigate('Main', { screen: item.name, params });
                }
              }}
            >
              <View style={styles.navItemContent}>
                <Icon 
                  size={24} 
                  color={isActive ? '#F59E0B' : colors.textSecondary} 
                  fill={isActive ? '#F59E0B' : 'transparent'}
                />
                <Text style={[styles.navItemText, isActive && styles.navItemTextActive]}>
                  {item.label}
                </Text>
              </View>
              
              {item.badge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.spacer} />

      {/* Settings / Logout floating card */}
      {showMenu && (
        <View style={styles.bottomCard}>
          <TouchableOpacity 
            style={styles.secondaryNavItem} 
            onPress={() => { 
              setShowMenu(false); 
              if (navigationRef.isReady()) {
                navigationRef.navigate('Settings' as any);
              }
            }}
          >
            <Settings size={20} color={colors.textSecondary} />
            <Text style={styles.secondaryNavText}>Configuración</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.secondaryNavItem} 
            onPress={() => { setShowMenu(false); signOut(); }}
          >
            <LogOut size={20} color="#EF4444" />
            <Text style={[styles.secondaryNavText, { color: '#EF4444' }]}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.divider, { marginBottom: 0 }]} />

      {/* User micro-profile */}
      <TouchableOpacity 
        style={styles.userProfileBtn} 
        onPress={() => setShowMenu(!showMenu)}
      >
        <Image 
          source={{ uri: user?.avatarUrl || 'https://ui-avatars.com/api/?name=User&background=F59E0B&color=fff' }}
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.username || 'Tu Perfil'}</Text>
          <Text style={styles.userHandle}>@{user?.username?.toLowerCase() || 'tuhandle'}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors: any, mode: any) => StyleSheet.create({
  sidebar: {
    width: 280,
    backgroundColor: colors.background,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    height: '100%',
    paddingVertical: 20,
    display: 'flex',
    flexDirection: 'column',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
    gap: 12,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#D97706', // Ember orange mock color
    letterSpacing: -0.5,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    width: '100%',
    marginBottom: 20,
  },
  navContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  navItemActive: {
    backgroundColor: mode === 'dark' ? '#FEF3C720' : '#FEF3C7', // Very pale orange/yellow background
  },
  navItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  navItemText: {
    fontSize: 18,
    color: colors.text,
    fontWeight: '500',
  },
  navItemTextActive: {
    color: '#D97706',
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#3B82F6', // Blue badge
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  spacer: {
    flex: 1,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 95,
    left: 16,
    right: 16,
    backgroundColor: mode === 'dark' ? '#1E1E1E' : colors.surface,
    zIndex: 50,
    borderRadius: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 14,
  },
  secondaryNavText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  userProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userInfo: {
    justifyContent: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  userHandle: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '400',
  },
});

export default Sidebar;
