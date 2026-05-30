import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import api from '../../services/api';
import { Bell, Heart, MessageCircle, MessageSquare, UserPlus, Flame, Check } from 'lucide-react-native';
import { useThemeMode } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

type NotificationItem = {
  id: string;
  type: 'like' | 'comment' | 'message' | 'follow' | 'fire' | string;
  content: string;
  referenceId: string;
  isRead: boolean;
  createdAt: string;
  actor?: {
    username: string;
    avatarUrl?: string;
  };
};

const NotificationsScreen = () => {
  const { colors } = useThemeMode();
  const styles = createStyles(colors);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchNotifications = async (cursor: string | null = null) => {
    try {
      const res = await api.get(`/users/me/notifications?cursor=${cursor || ''}`);
      const newItems: NotificationItem[] = res.data.notifications;
      if (cursor) setItems((prev) => [...prev, ...newItems]);
      else {
        setItems(newItems);
        await AsyncStorage.setItem('notifications:me', JSON.stringify(res.data));
      }
      setNextCursor(res.data.nextCursor);
    } catch (e) {
      if (!cursor) {
        const cached = await AsyncStorage.getItem('notifications:me');
        if (cached) {
          const parsed = JSON.parse(cached);
          setItems(parsed.notifications || []);
          setNextCursor(parsed.nextCursor || null);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const loadMore = () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    fetchNotifications(nextCursor);
  };

  const markRead = async (id: string) => {
    try {
      await api.post(`/users/me/notifications/${id}/read`);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch (e) {}
  };

  const markAllRead = async () => {
    try {
      await api.post('/users/me/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (e) {}
  };

  // Icon badge matching the HTML mockup (colored circle with icon)
  const badgeConfig = (type: string) => {
    switch (type) {
      case 'like':    return { color: colors.danger,       Icon: Heart };
      case 'fire':    return { color: colors.primary,      Icon: Flame };
      case 'follow':  return { color: colors.community,    Icon: UserPlus };
      case 'comment': return { color: colors.notification, Icon: MessageCircle };
      case 'message': return { color: colors.myBubble,     Icon: MessageSquare };
      default:        return { color: colors.textSecondary, Icon: Bell };
    }
  };

  if (loading) {
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
        <Text style={styles.title}>🔔 Notificaciones</Text>
        <TouchableOpacity onPress={markAllRead} style={styles.headerAction}>
          <Check size={16} color={colors.primary} />
          <Text style={styles.headerActionText}>Marcar todo</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={items.length ? undefined : styles.emptyContainer}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} /> : null}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Bell size={48} color={colors.border} />
            <Text style={styles.emptyText}>No tienes notificaciones</Text>
          </View>
        }
        renderItem={({ item }) => {
          const { color, Icon } = badgeConfig(item.type);
          return (
            <TouchableOpacity
              style={[styles.row, !item.isRead && styles.rowUnread]}
              onPress={() => markRead(item.id)}
            >
              {/* Avatar with icon badge */}
              <View style={styles.avatarWrap}>
                <ExpoImage
                  source={{ uri: item.actor?.avatarUrl || 'https://via.placeholder.com/44' }}
                  style={styles.avatar}
                  contentFit="cover"
                />
                <View style={[styles.iconBadge, { backgroundColor: color }]}>
                  <Icon size={10} color="#FFF" />
                </View>
              </View>

              {/* Content */}
              <View style={styles.body}>
                <Text style={[styles.content, !item.isRead && { fontWeight: '700' }]} numberOfLines={2}>
                  {item.content}
                </Text>
                <Text style={styles.date}>
                  {new Date(item.createdAt).toLocaleString([], {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </Text>
              </View>

              {/* Unread dot */}
              {!item.isRead && <View style={styles.unreadDot} />}
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
  list: {
    width: '100%',
    maxWidth: 640,
  },
  header: {
    width: '100%',
    maxWidth: 640,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.navBg,
    ...Platform.select({
      web: {
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(12px)',
      } as any
    })
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.cardBg,
  },
  headerActionText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
    gap: 12,
  },
  rowUnread: {
    backgroundColor: `rgba(59, 130, 246, 0.05)`,
  },
  avatarWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  iconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  body: {
    flex: 1,
  },
  content: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  date: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.notification,
    flexShrink: 0,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
    gap: 12,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
});

export default NotificationsScreen;
