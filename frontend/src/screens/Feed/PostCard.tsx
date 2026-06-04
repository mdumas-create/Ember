import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Share, FlatList, Platform } from 'react-native';
import { Heart, MessageCircle, Flame, MoreHorizontal, Edit2, Trash2, Check, X as XIcon, Share2 } from 'lucide-react-native';
import api from '../../services/api';
import CommentsModal from './CommentsModal';
import { useAuth } from '../../context/AuthContext';
import { TextInput, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import { useThemeMode } from '../../context/ThemeContext';
import { trackEvent } from '../../utils/analytics';
import { addToQueue } from '../../utils/offlineQueue';

// Constante simulada para el tiempo de publicación (puedes usar date-fns si existe)
const getRelativeTime = (dateStr: string) => {
  return "2h"; // dummy format to match screenshot until dynamic logic is added
};

const PostCard = ({ post, onRefresh }: any) => {
  const { user } = useAuth();
  const { colors } = useThemeMode();
  const styles = createStyles(colors);
  const navigation = useNavigation<any>();
  const [likes, setLikes] = useState(post._count?.likes || 0);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [saving, setSaving] = useState(false);

  const handleProfilePress = () => {
    navigation.navigate('UserProfile', { userId: post.authorId });
  };

  const handleReaction = async (type: string) => {
    if (type === 'like') setLikes(likes + 1);
    
    try {
      await api.post(`/posts/${post.id}/like`, { type });
      trackEvent('post_liked', { postId: post.id, type });
    } catch (error: any) {
      if (!error.response) {
        await addToQueue({ type: 'POST', url: `/posts/${post.id}/like`, data: { type } });
      } else {
        console.error(error);
      }
    }
  };

  const handleDelete = async () => {
    Alert.alert('Eliminar publicación', '¿Seguro que quieres eliminar esta publicación?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/posts/${post.id}`);
            setShowOptions(false);
            onRefresh();
          } catch (error) {
            console.error('Error deleting post:', error);
          }
        }
      }
    ]);
  };

  const handleUpdate = async () => {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      await api.put(`/posts/${post.id}`, { content: editContent });
      setIsEditing(false);
      setShowOptions(false);
      onRefresh();
    } catch (error) {
      console.error('Error updating post:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    try {
      const shareUrl = `ember://post/${post.id}`;
      const message = `¡Mira este post en Ember! 🔥\n\n"${post.content.substring(0, 100)}${post.content.length > 100 ? '...' : ''}"\n\nVer más: ${shareUrl}`;
      
      await Share.share({ 
        message,
        url: shareUrl,
        title: 'Compartir Post'
      });
      trackEvent('post_shared', { postId: post.id });
    } catch (e) {
      console.error('Error sharing post:', e);
    }
  };

  const renderContent = (content: string) => {
    const parts = content.split(/(\s+)/);
    return (
      <Text style={styles.content}>
        {parts.map((part, i) => {
          if (part.startsWith('@')) {
            return <Text key={i} style={{ color: colors.primary, fontWeight: '600' }}>{part}</Text>;
          }
          if (part.startsWith('#')) {
            return <Text key={i} style={{ color: colors.community, fontWeight: '600' }}>{part}</Text>;
          }
          return part;
        })}
      </Text>
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}
          onPress={handleProfilePress}
        >
          <View style={styles.avatarWrap}>
            <ExpoImage source={{ uri: post.author.avatarUrl || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100' }} style={styles.avatar} contentFit="cover" />
            <View style={styles.onlineDot} />
          </View>
          <View>
            <Text style={styles.username}>{post.author?.username || 'Usuario'}</Text>
            <Text style={styles.handleTime}>@{(post.author?.username || 'usuario').toLowerCase().split(' ').join('')} • {getRelativeTime(post.createdAt)}</Text>
          </View>
        </TouchableOpacity>
        
        {user?.id === post.authorId && !isEditing && (
          <TouchableOpacity onPress={() => setShowOptions(!showOptions)}>
            <MoreHorizontal size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {showOptions && !isEditing && (
        <View style={styles.optionsContainer}>
          <TouchableOpacity style={styles.option} onPress={() => setIsEditing(true)}>
            <Edit2 size={16} color={colors.text} />
            <Text style={styles.optionText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.option} onPress={handleDelete}>
            <Trash2 size={16} color={colors.danger} />
            <Text style={[styles.optionText, { color: colors.danger }]}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      )}

      {isEditing ? (
        <View style={styles.editContainer}>
          <TextInput
            style={styles.editInput}
            value={editContent}
            onChangeText={setEditContent}
            multiline
            autoFocus
          />
          <View style={styles.editButtons}>
            <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.editCancel}>
              <XIcon size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleUpdate} disabled={saving} style={styles.editSave}>
              {saving ? <ActivityIndicator size="small" color={colors.surface} /> : <Check size={20} color={colors.surface} />}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        renderContent(post.content)
      )}

      {!!post.media?.length ? (
        <View style={styles.carouselWrap}>
          <FlatList
            data={post.media}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(m: any) => m.id}
            renderItem={({ item }: any) => (
              <ExpoImage 
                source={{ uri: item.url }} 
                style={styles.image} 
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            )}
          />
        </View>
      ) : (
        post.imageUrl ? (
          <ExpoImage 
            source={{ uri: post.imageUrl }} 
            style={styles.image} 
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : null
      )}

      <View style={styles.footer}>
        <View style={styles.actionsLeft}>
          <TouchableOpacity 
            style={[styles.action, post.isLiked && styles.likeActive]} 
            onPress={() => handleReaction('like')}
          >
            <Heart size={18} color={post.isLiked ? colors.danger : colors.textSecondary} fill={post.isLiked ? colors.danger : 'none'} />
            <Text style={[styles.actionText, post.isLiked && styles.likeActiveText]}>{likes}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.action, post.isFired && styles.activeAction]} 
            onPress={() => handleReaction('fire')}
          >
            <Flame size={18} color={post.isFired ? colors.primary : colors.textSecondary} fill={post.isFired ? colors.primary : 'none'} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.action} onPress={() => setCommentsVisible(true)}>
            <MessageCircle size={18} color={colors.textSecondary} />
            <Text style={styles.actionText}>{post._count?.comments || 0}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.action} onPress={handleShare}>
          <Share2 size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <CommentsModal 
        visible={commentsVisible} 
        postId={post.id} 
        onClose={() => setCommentsVisible(false)} 
      />
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(0,0,0,0.04)',
      }
    })
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 10, 
    gap: 10 
  },
  avatarWrap: {
    position: 'relative'
  },
  avatar: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981', // Green dot
    borderWidth: 2,
    borderColor: colors.surface,
  },
  username: { 
    fontWeight: '700', 
    fontSize: 16, 
    color: colors.text 
  },
  handleTime: { 
    fontSize: 13, 
    color: colors.textSecondary, 
    marginTop: 2 
  },
  content: { 
    fontSize: 16, 
    color: colors.text, 
    marginBottom: 14, 
    lineHeight: 24 
  },
  image: { 
    width: '100%', 
    height: 380, 
    borderRadius: 12, 
    marginBottom: 10 
  },
  carouselWrap: { 
    marginBottom: 10, 
    borderRadius: 8, 
    overflow: 'hidden' 
  },
  footer: { 
    flexDirection: 'row', 
    marginTop: 6, 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingTop: 6,
  },
  actionsLeft: {
    flexDirection: 'row',
    gap: 4,
  },
  action: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  activeAction: {
    backgroundColor: `rgba(245, 158, 11, 0.1)`,
  },
  likeActive: {
    backgroundColor: `rgba(239, 68, 68, 0.08)`,
  },
  actionText: { 
    fontSize: 14, 
    fontWeight: '500', 
    color: colors.textSecondary 
  },
  activeActionText: { 
    color: colors.primary 
  },
  likeActiveText: { 
    color: colors.danger 
  },
  optionsContainer: {
    position: 'absolute',
    top: 44,
    right: 14,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    zIndex: 10,
    borderWidth: 1,
    borderColor: colors.border
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 10,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  editContainer: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 10,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editInput: {
    fontSize: 15,
    color: colors.text,
    minHeight: 60,
    textAlignVertical: 'top'
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 8,
  },
  editCancel: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.cardBg,
  },
  editSave: {
    backgroundColor: colors.primary,
    padding: 8,
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  }
});

export default PostCard;
