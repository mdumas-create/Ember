import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/Button';
import api from '../../services/api';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Settings, Edit2, LogOut, Trash2, Lock, Flame, Star, MapPin, Link2, Calendar } from 'lucide-react-native';
import PostCard from '../Feed/PostCard';
import { useThemeMode } from '../../context/ThemeContext';
import { trackEvent } from '../../utils/analytics';

const ProfileScreen = () => {
  const { user: currentUser, signOut } = useAuth();
  const { colors, mode } = useThemeMode();
  const styles = createStyles(colors, mode);
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  
  // Priorizar siempre el usuario actual si no hay un ID específico o si el ID coincide
  const userId = route.params?.userId || currentUser?.id;
  const isOwnProfile = userId === currentUser?.id;

  const [user, setUser] = useState<any>(isOwnProfile ? currentUser : null);
  const [loading, setLoading] = useState(!isOwnProfile); // No mostrar loading si ya tenemos los datos localmente
  const [following, setFollowing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'stories' | 'saved'>('posts');

  useEffect(() => {
    if (isOwnProfile && currentUser) {
      setUser(currentUser);
      setLoading(false);
    }
    fetchProfile();
  }, [userId, currentUser]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/users/${userId}`);
      setUser(response.data);
      setFollowing(response.data.isFollowing);
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'No se pudo cargar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    setActionLoading(true);
    try {
      if (following) {
        await api.post(`/users/${userId}/unfollow`);
      } else {
        await api.post(`/users/${userId}/follow`);
      }
      trackEvent(following ? 'unfollow' : 'follow', { targetUserId: userId });
      setFollowing(!following);
      fetchProfile();
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Eliminar cuenta',
      '¿Estás seguro de que quieres eliminar tu cuenta? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('users/me');
              signOut();
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar la cuenta');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const joinDate = user?.createdAt 
    ? `Se unió en ${new Date(user.createdAt).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}` 
    : 'Se unió en abril 2026';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
      {/* Cover photo area */}
      <View style={styles.coverArea}>
        <Image 
          source={{ uri: user?.coverUrl || 'https://images.unsplash.com/photo-1542224566-6e85f2e6772f?q=80&w=2000&auto=format&fit=crop' }} 
          style={StyleSheet.absoluteFillObject}
        />
      </View>

      {/* Profile header block */}
      <View style={styles.profileHeader}>
        <View style={styles.headerTopRow}>
          {/* Avatar floating */}
          <View style={styles.avatarWrap}>
            <Image
              source={{ uri: user?.avatarUrl || 'https://ui-avatars.com/api/?name=User&background=F59E0B&color=fff' }}
              style={styles.avatar}
            />
            <View style={styles.onlineDot} />
          </View>

          {/* Action buttons at top right */}
          <View style={styles.actionsTop}>
            {isOwnProfile ? (
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => navigation.navigate('EditProfile', { user })}
              >
                <Settings size={14} color={colors.textSecondary} />
                <Text style={styles.editBtnText}>Editar perfil</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.followBtn, following && styles.followingBtn]}
                onPress={handleFollowToggle}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={following ? colors.text : colors.surface} />
                ) : (
                  <Text style={[styles.followBtnText, following && { color: colors.text }]}>
                    {following ? 'Siguiendo' : 'Seguir'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <Text style={styles.username}>{user?.username || 'Tu Perfil'}</Text>
          <Text style={styles.handle}>@{user?.username?.toLowerCase() || 'tuhandle'}</Text>
          <Text style={styles.bio}>
            {user?.bio || 'Amante de las aventuras y la fotografía 📷 ✨'}
          </Text>
        </View>

        {/* Metadata row */}
        <View style={styles.metadataRow}>
          <View style={styles.metadataItem}>
            <MapPin size={14} color={colors.textSecondary} />
            <Text style={styles.metadataText}>{user?.location || 'España'}</Text>
          </View>
          <TouchableOpacity style={styles.metadataItem}>
            <Link2 size={14} color={colors.textSecondary} />
            <Text style={[styles.metadataText, { color: colors.primary }]}>{user?.website || 'ember.app'}</Text>
          </TouchableOpacity>
          <View style={styles.metadataItem}>
            <Calendar size={14} color={colors.textSecondary} />
            <Text style={styles.metadataText}>{joinDate}</Text>
          </View>
        </View>

        {/* Stats inline row */}
        <View style={styles.statsInlineRow}>
          <TouchableOpacity style={styles.statInline}>
            <Text style={styles.statInlineNum}>{user?._count?.posts || 0}</Text>
            <Text style={styles.statInlineLabel}>Publicaciones</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statInline}>
            <Text style={styles.statInlineNum}>{user?._count?.followers || 0}</Text>
            <Text style={styles.statInlineLabel}>Seguidores</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statInline}>
            <Text style={styles.statInlineNum}>{user?._count?.following || 0}</Text>
            <Text style={styles.statInlineLabel}>Siguiendo</Text>
          </TouchableOpacity>
        </View>

        {/* Gamification badges */}
        <View style={styles.badgesRow}>
          <View style={styles.badgePillLight}>
            <Flame size={14} color={colors.primary} />
            <Text style={[styles.badgeTextLight, { color: colors.primary }]}>Racha: {user?.streak || 0} días</Text>
          </View>
          <View style={styles.badgePillLight}>
            <Star size={14} color={colors.primary} />
            <Text style={[styles.badgeTextLight, { color: colors.primary }]}>Nivel {Math.floor((user?.reputation || 0) / 100) + 1}</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
          onPress={() => setActiveTab('posts')}
        >
          <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>Publicaciones</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stories' && styles.tabActive]}
          onPress={() => setActiveTab('stories')}
        >
          <Text style={[styles.tabText, activeTab === 'stories' && styles.tabTextActive]}>Historias</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'saved' && styles.tabActive]}
          onPress={() => setActiveTab('saved')}
        >
          <Text style={[styles.tabText, activeTab === 'saved' && styles.tabTextActive]}>Guardados</Text>
        </TouchableOpacity>
      </View>

      {/* Tab content */}
      <View style={styles.contentArea}>
        {user?.isPrivate && !isOwnProfile ? (
          <View style={styles.privateContainer}>
            <Lock size={48} color={colors.border} />
            <Text style={styles.privateTitle}>Esta cuenta es privada</Text>
            <Text style={styles.privateText}>Síguela para ver sus publicaciones.</Text>
          </View>
        ) : (
          <View>
            {activeTab === 'posts' && (
              user?.posts?.length > 0 ? (
                user.posts.map((post: any) => (
                  <PostCard key={post.id} post={post} onRefresh={fetchProfile} />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No hay publicaciones aún.</Text>
                </View>
              )
            )}
            {activeTab === 'stories' && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No hay historias disponibles.</Text>
              </View>
            )}
            {activeTab === 'saved' && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No hay publicaciones guardadas.</Text>
              </View>
            )}
          </View>
        )}

        {/* Danger zone removed to match screenshot and because it exists in Settings now */}
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: any, mode: 'light' | 'dark') => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

  /* Cover */
  coverArea: {
    height: 180,
    backgroundColor: `${colors.primary}28`,
    width: '100%',
    position: 'relative',
  },

  /* Profile header wrapper */
  profileHeader: {
    backgroundColor: colors.background,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
  },

  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 8,
  },
  
  avatarWrap: {
    marginTop: -50,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: colors.background,
    backgroundColor: colors.background,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: mode === 'dark' ? '#000' : '#FFF',
    borderWidth: 3,
    borderColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  actionsTop: {
    marginTop: 16,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  editBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },

  followBtn: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  followingBtn: {
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  followBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  userInfo: {
    marginBottom: 16,
  },
  username: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  handle: { 
    fontSize: 15, 
    color: colors.textSecondary, 
    marginBottom: 12, 
    fontWeight: '400' 
  },
  bio: { 
    fontSize: 15, 
    color: colors.text, 
    lineHeight: 22,
    fontWeight: '400'
  },

  metadataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metadataText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  statsInlineRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
  },
  statInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statInlineNum: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.text,
  },
  statInlineLabel: {
    fontSize: 15,
    color: colors.textSecondary,
  },

  badgesRow: { 
    flexDirection: 'row', 
    gap: 12, 
    marginBottom: 28 
  },
  badgePillLight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: mode === 'light' ? '#FEEFDD' : `${colors.primary}15`,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  badgeTextLight: { 
    fontSize: 13, 
    fontWeight: '600', 
  },

  /* Tabs */
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { 
    borderBottomColor: colors.primary 
  },
  tabText: { 
    fontSize: 15, 
    fontWeight: '600', 
    color: colors.textSecondary 
  },
  tabTextActive: { 
    color: colors.primary 
  },

  /* Content */
  contentArea: {
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
    paddingTop: 10,
  },

  emptyState: { padding: 48, alignItems: 'center' },
  emptyText: { fontSize: 15, color: colors.textSecondary },
  privateContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, padding: 20, gap: 10 },
  privateTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  privateText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },

});

export default ProfileScreen;

