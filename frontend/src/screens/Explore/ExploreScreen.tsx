import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl, ScrollView, Platform } from 'react-native';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Search, UserPlus, UserMinus } from 'lucide-react-native';
import { useThemeMode } from '../../context/ThemeContext';

const ExploreScreen = () => {
  const { user } = useAuth();
  const { colors } = useThemeMode();
  const styles = createStyles(colors);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [resultsNextCursor, setResultsNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);

  const fetchSuggestions = async () => {
    try {
      const res = await api.get('/users/suggestions');
      setSuggestions(res.data);
    } catch (e) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSuggestions();
  };

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setResultsNextCursor(null);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get(`/users/search?q=${encodeURIComponent(trimmed)}`);
      setResults(res.data.users);
      setResultsNextCursor(res.data.nextCursor);
    } catch (e) {
    } finally {
      setSearching(false);
    }
  };

  const loadMore = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (!resultsNextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api.get(`/users/search?q=${encodeURIComponent(trimmed)}&cursor=${resultsNextCursor}`);
      setResults((prev) => [...prev, ...res.data.users]);
      setResultsNextCursor(res.data.nextCursor);
    } catch (e) {
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleFollow = async (targetId: string, isFollowing: boolean) => {
    try {
      if (isFollowing) await api.post(`/users/${targetId}/unfollow`);
      else await api.post(`/users/${targetId}/follow`);
      setResults((prev) =>
        prev.map((u) => (u.id === targetId ? { ...u, isFollowing: !isFollowing } : u))
      );
      setSuggestions((prev) =>
        prev.map((u) => (u.id === targetId ? { ...u, isFollowing: !isFollowing } : u))
      );
    } catch (e) {
    }
  };

  if (loading && !query) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔍 Explorar</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchBarWrap}>
        <View style={styles.searchBar}>
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar en Ember..."
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {suggestions.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Sugerencias para ti</Text>
            <View style={styles.suggestions}>
              {suggestions.map((item) => (
                <View key={item.id} style={styles.userCard}>
                  <Image source={{ uri: item.avatarUrl || 'https://via.placeholder.com/46' }} style={styles.avatar} />
                  <View style={styles.userInfo}>
                    <Text style={styles.username}>@{item.username}</Text>
                    {!!item.bio && <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text>}
                  </View>
                  <TouchableOpacity
                    style={[styles.followBtn, item.isFollowing && styles.followingBtn]}
                    onPress={() => toggleFollow(item.id, !!item.isFollowing)}
                  >
                    <Text style={[styles.followText, item.isFollowing && { color: colors.text }]}>
                      {item.isFollowing ? 'Siguiendo' : 'Seguir'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}

        {results.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Resultados de búsqueda</Text>
            <View style={styles.suggestions}>
              {results.map((item) => (
                <View key={item.id} style={styles.userCard}>
                  <Image source={{ uri: item.avatarUrl || 'https://via.placeholder.com/46' }} style={styles.avatar} />
                  <View style={styles.userInfo}>
                    <Text style={styles.username}>@{item.username}</Text>
                    {!!item.bio && <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text>}
                  </View>
                  <TouchableOpacity
                    style={[styles.followBtn, item.isFollowing && styles.followingBtn]}
                    onPress={() => toggleFollow(item.id, !!item.isFollowing)}
                  >
                    <Text style={[styles.followText, item.isFollowing && { color: colors.text }]}>
                      {item.isFollowing ? 'Siguiendo' : 'Seguir'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Tendencias populares</Text>
        <View style={styles.popularGrid}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <TouchableOpacity key={i} style={styles.gridItem}>
              <Image 
                source={{ uri: `https://picsum.photos/seed/${i + 10}/300/300` }} 
                style={styles.gridImage} 
              />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    width: '100%',
    maxWidth: 640,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.navBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...Platform.select({
      web: { position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(12px)' } as any
    })
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  searchBarWrap: {
    padding: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    width: '100%',
    maxWidth: 640,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: colors.text,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    padding: 16,
    paddingBottom: 8,
    color: colors.text,
  },
  suggestions: { paddingHorizontal: 16, paddingBottom: 16, width: '100%', maxWidth: 640 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as any,
    })
  },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: colors.primary },
  userInfo: { flex: 1, marginLeft: 12 },
  username: { fontSize: 15, fontWeight: '600', color: colors.text },
  bio: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  followBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  followingBtn: {
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  followText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  popularGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 1,
    width: '100%',
    maxWidth: 640,
  },
  gridItem: {
    width: '33.33%',
    aspectRatio: 1,
    padding: 1,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
});

export default ExploreScreen;
