import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Platform, RefreshControl } from 'react-native';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Check, CheckCheck, Search, MessageSquare, Edit, Flame } from 'lucide-react-native';
import { useThemeMode } from '../../context/ThemeContext';

const ChatListScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const { colors } = useThemeMode();
  const styles = createStyles(colors);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const response = await api.get('/chat/conversations');
      setConversations(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💬 Mensajes</Text>
        <TouchableOpacity style={styles.iconBtn}>
          <Edit size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item: any) => item.id}
        style={styles.listStyle}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={conversations.length === 0 && { flex: 1 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <MessageSquare size={40} color={colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>No hay mensajes aún</Text>
            <Text style={styles.emptySub}>Las respuestas a tus historias aparecerán aquí.</Text>
          </View>
        }
        renderItem={({ item }: any) => {
          const lastMsg = item.messages[0];
          const other = item.participants?.find((p: any) => p.id !== user?.id);
          const mine = lastMsg?.senderId === user?.id;
          const isRead = !!lastMsg?.isRead;
          return (
            <TouchableOpacity
              style={styles.convItem}
              onPress={() => navigation.navigate('Chat', { conversationId: item.id, participant: other })}
            >
              <View style={styles.avatarWrap}>
                <Image source={{ uri: other?.avatarUrl || 'https://via.placeholder.com/50' }} style={styles.avatar} />
                {/* Online dot (static for now) */}
              </View>
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <View style={styles.nameStreakRow}>
                    <Text style={styles.convName}>{other?.username || 'Usuario de Ember'}</Text>
                    {item.streak > 0 && (
                      <View style={styles.streakBadge}>
                        <Flame size={12} color={colors.primary} fill={colors.primary} />
                        <Text style={styles.streakText}>{item.streak}</Text>
                      </View>
                    )}
                  </View>
                  {lastMsg?.createdAt && (
                    <Text style={styles.timeText}>
                      {new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  )}
                </View>
                <View style={styles.lastRow}>
                  {mine && (
                    isRead ? <CheckCheck size={14} color={colors.primary} /> : <Check size={14} color={colors.textSecondary} />
                  )}
                  <Text style={styles.convMsg} numberOfLines={1}>
                    {lastMsg?.content || 'Sin mensajes'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  listStyle: {
    width: '100%',
    maxWidth: 640,
  },
  header: {
    width: '100%',
    maxWidth: 640,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.navBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...Platform.select({
      web: {
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(12px)',
      } as any
    })
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  convItem: { 
    width: '100%',
    flexDirection: 'row', 
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    borderWidth: 1,
    borderColor: colors.border,
  },
  info: { flex: 1 },
  nameStreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  streakText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  convName: { 
    fontWeight: '600', 
    fontSize: 15, 
    color: colors.text 
  },
  timeText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  convMsg: { 
    color: colors.textSecondary, 
    fontSize: 13,
    flex: 1,
  },
  lastRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 80,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ChatListScreen;
