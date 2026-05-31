import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Text, Modal, TouchableOpacity, Image, Platform, ScrollView, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus, Image as ImageIcon, Video, X, Search, Moon, Sun } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import api from '../../services/api';
import PostCard from './PostCard';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useThemeMode } from '../../context/ThemeContext';
import { Image as ExpoImage } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useVideoPlayer, VideoView } from 'expo-video';
import { trackEvent } from '../../utils/analytics';
import { addToQueue } from '../../utils/offlineQueue';
import Logo from '../../components/Logo';

const StoryVideo = ({ url }: { url: string }) => {
  const player = useVideoPlayer(url, (p: any) => {
    p.loop = false;
    p.play();
  });
  return <VideoView style={{ width: '100%', height: '100%' }} player={player} contentFit="contain" />;
};

interface Post {
  id: string;
  content: string;
  imageUrl?: string;
  media?: { id: string; url: string; type: string }[];
  author: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  _count: {
    likes: number;
    comments: number;
  };
  createdAt: string;
}

const FeedScreen = () => {
  const { t } = useTranslation();
  const { colors, mode, toggle } = useThemeMode();
  const styles = createStyles(colors);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [creating, setCreating] = useState(false);
  const [media, setMedia] = useState<{ uri: string; type: string }[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [feedType, setFeedType] = useState<'global' | 'following'>('global');
  const [stories, setStories] = useState<any[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [activeStoryUser, setActiveStoryUser] = useState<any | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);
  const [storyReaction, setStoryReaction] = useState<string | null>(null);
  const [storyReply, setStoryReply] = useState('');

  const fetchPosts = async (cursor: string | null = null) => {
    try {
      const response = await api.get(`/posts?cursor=${cursor || ''}&type=${feedType}`);
      if (cursor) {
        setPosts(prev => {
          const combined = [...prev, ...response.data.posts];
          const seen = new Set<string>();
          return combined.filter((p: Post) => {
            if (seen.has(p.id)) return false;
            seen.add(p.id);
            return true;
          });
        });
      } else {
        setPosts(response.data.posts);
        await AsyncStorage.setItem(`feed:${feedType}`, JSON.stringify(response.data));
      }
      setNextCursor(response.data.nextCursor);
    } catch (error) {
      console.error('Error fetching posts:', error);
      if (!cursor) {
        const cached = await AsyncStorage.getItem(`feed:${feedType}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          setPosts(parsed.posts || []);
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
    fetchPosts();
    fetchStories();
  }, [feedType]);

  const fetchStories = async () => {
    setStoriesLoading(true);
    try {
      const res = await api.get('stories');
      setStories(res.data);
      await AsyncStorage.setItem('stories:feed', JSON.stringify(res.data));
    } catch (e) {
      const cached = await AsyncStorage.getItem('stories:feed');
      if (cached) setStories(JSON.parse(cached));
    } finally {
      setStoriesLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts();
    fetchStories();
  };

  const loadMore = () => {
    if (refreshing || loadingMore) return;
    if (nextCursor) {
      setLoadingMore(true);
      fetchPosts(nextCursor);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && media.length === 0) return;
    setCreating(true);
    setUploadProgress(0);
    try {
      let imageUrl: string | null = null;
      let uploadedMedia: { url: string; type: string }[] = [];
      
      if (media.length) {
        const total = media.length;
        for (let i = 0; i < media.length; i++) {
          const item = media[i];
          const formData = new FormData();
          let uriToUpload = item.uri;

          if (Platform.OS !== 'web' && item.type !== 'video') {
            const manipulated = await ImageManipulator.manipulateAsync(
              item.uri,
              [{ resize: { width: 1280 } }],
              { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
            );
            uriToUpload = manipulated.uri;
          }

          if (Platform.OS === 'web') {
            const response = await fetch(item.uri);
            const blob = await response.blob();
            formData.append('file', blob, item.type === 'video' ? 'upload.mp4' : 'upload.jpg');
          } else {
            formData.append('file', {
              uri: uriToUpload,
              type: item.type === 'video' ? 'video/mp4' : 'image/jpeg',
              name: item.type === 'video' ? 'upload.mp4' : 'upload.jpg',
            } as any);
          }

          const uploadRes = await api.post('upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (evt: any) => {
              if (!evt.total) return;
              const part = Math.max(0, Math.min(1, evt.loaded / evt.total));
              const p = Math.max(0, Math.min(1, (i + part) / total));
              setUploadProgress(p);
            },
          });

          const type = item.type === 'video' ? 'video' : 'image';
          const url = uploadRes.data.url as string;
          uploadedMedia.push({ url, type });
          if (!imageUrl) imageUrl = url;
        }
      }

      await api.post('posts', { content: newPostContent, imageUrl, media: uploadedMedia });
      trackEvent('post_created', { 
        hasMedia: uploadedMedia.length > 0, 
        mediaCount: uploadedMedia.length,
        contentLength: newPostContent.length 
      });
      setNewPostContent('');
      setMedia([]);
      setModalVisible(false);
      fetchPosts();
    } catch (error: any) {
      if (!error.response) {
        await addToQueue({ 
          type: 'POST', 
          url: '/posts', 
          data: { content: newPostContent, imageUrl: null, media: [] } 
        });
        setNewPostContent('');
        setMedia([]);
        setModalVisible(false);
        alert('No se pudo conectar con el servidor. El post se guardó y se publicará automáticamente cuando recuperes la conexión.');
      } else {
        console.error('Error creating post:', error);
        if (error.response?.status === 403) {
          alert('Sesión expirada o no autorizada. Por favor, vuelve a iniciar sesión.');
        } else {
          alert('Error al crear el post: ' + (error.response?.data?.error || 'Intenta de nuevo'));
        }
      }
    } finally {
      setCreating(false);
    }
  };

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.8,
    } as any);

    if (!result.canceled) {
      const picked = result.assets.slice(0, 5).map((a: any) => ({ uri: a.uri, type: a.type || 'image' }));
      setMedia(picked);
    }
  };

  const captureMedia = async (type: 'image' | 'video') => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: type === 'video' ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
      allowsEditing: type === 'image',
      quality: type === 'image' ? 0.7 : undefined,
      videoMaxDuration: type === 'video' ? 30 : undefined,
    });

    if (!result.canceled) {
      setMedia((prev) => {
        const next = [...prev, { uri: result.assets[0].uri, type: result.assets[0].type || type }];
        return next.slice(0, 5);
      });
    }
  };

  const createStory = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const pickedType = asset.type === 'video' ? 'video' : 'image';
    const formData = new FormData();

    if (Platform.OS === 'web') {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      formData.append('file', blob, pickedType === 'video' ? 'story.mp4' : 'story.jpg');
    } else {
      formData.append('file', {
        uri: asset.uri,
        type: pickedType === 'video' ? 'video/mp4' : 'image/jpeg',
        name: pickedType === 'video' ? 'story.mp4' : 'story.jpg',
      } as any);
    }

    const uploadRes = await api.post('upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    await api.post('stories', { mediaUrl: uploadRes.data.url, mediaType: pickedType });
    fetchStories();
  };

  const openStory = (storyUser: any) => {
    setActiveStoryUser(storyUser);
    setActiveStoryIndex(0);
    setStoryViewerOpen(true);
  };

  const nextStory = () => {
    setActiveStoryIndex((prev) => {
      const total = activeStoryUser?.stories?.length || 0;
      const next = prev + 1;
      if (!total || next >= total) {
        setStoryViewerOpen(false);
        return prev;
      }
      return next;
    });
    setStoryReaction(null);
  };

  const reactToStory = async (emoji: string) => {
    setStoryReaction(emoji);
    const story = activeStoryUser?.stories?.[activeStoryIndex];
    if (story) {
      api.post(`/stories/${story.id}/react`, { emoji }).catch(console.error);
      api.post('analytics/event', { 
        event: 'story_reaction', 
        properties: { storyId: story.id, authorId: activeStoryUser?.authorId, emoji } 
      }).catch(() => {});
    }
    setTimeout(() => setStoryReaction(null), 1000);
  };

  const replyToStory = async () => {
    if (!storyReply.trim()) return;
    const story = activeStoryUser?.stories?.[activeStoryIndex];
    if (story) {
      try {
        await api.post(`/stories/${story.id}/reply`, { content: storyReply });
        setStoryReply('');
        alert('Respuesta enviada');
      } catch (error) {
        console.error('Error replying to story:', error);
        alert('Error al enviar la respuesta');
      }
    }
  };

  useEffect(() => {
    if (!storyViewerOpen) return;
    const story = activeStoryUser?.stories?.[activeStoryIndex];
    if (!story) return;

    setStoryProgress(0);
    api
      .post('/analytics/event', { event: 'story_viewed', properties: { storyId: story.id, authorId: activeStoryUser?.authorId } })
      .catch(() => {});

    const durationMs = story.mediaType === 'video' ? 10000 : 6000;
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const p = Math.min(1, (Date.now() - startedAt) / durationMs);
      setStoryProgress(p);
      if (p >= 1) {
        clearInterval(interval);
        nextStory();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [storyViewerOpen, activeStoryIndex, activeStoryUser?.authorId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Feed</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={toggle}>
            {mode === 'dark' ? <Sun size={20} color={colors.text} /> : <Moon size={20} color={colors.text} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.createBtn} onPress={() => setModalVisible(true)}>
            <Plus size={16} color="#FFF" />
            <Text style={styles.createBtnText}>Crear post</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        style={styles.flatList}
        renderItem={({ item }) => <PostCard post={item} onRefresh={() => fetchPosts()} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchPosts()} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <>
            <View style={styles.storiesSection}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.storiesRow}
              >
                <TouchableOpacity style={styles.storyAdd} onPress={createStory}>
                  <View style={styles.storyRingAdd}>
                    <Plus size={24} color={colors.textSecondary} />
                  </View>
                  <Text style={styles.storyName}>Tu historia</Text>
                </TouchableOpacity>
                {stories.map((s: any) => (
                  <TouchableOpacity 
                    key={s.authorId} 
                    style={styles.storyItem}
                    onPress={() => openStory(s)}
                  >
                    <View style={styles.storyRing}>
                      <ExpoImage source={{ uri: s.author?.avatarUrl || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100' }} style={styles.storyAvatar} contentFit="cover" />
                    </View>
                    <Text style={styles.storyName} numberOfLines={1}>{s.author?.username?.split(' ')[0]}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </>
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 20 }} color={colors.primary} /> : null}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('no_posts')}</Text>
            <Text style={styles.emptySubtext}>{t('be_first')}</Text>
            <Button title={t('create_post')} onPress={() => setModalVisible(true)} type="outline" />
          </View>
        }
        contentContainerStyle={{ paddingBottom: 80 }}
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('thinking')}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalClose}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Input 
              placeholder="Escribe algo cálido..." 
              value={newPostContent} 
              onChangeText={setNewPostContent}
              label=""
            />

            {media.length > 0 && (
              <View style={styles.mediaPreviewList}>
                <FlatList
                  data={media}
                  horizontal
                  keyExtractor={(m) => m.uri}
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <View style={{ marginRight: 10, position: 'relative' }}>
                      <Image source={{ uri: item.uri }} style={styles.mediaPreview} />
                      <TouchableOpacity
                        style={styles.removeMedia}
                        onPress={() => setMedia((prev) => prev.filter((x) => x.uri !== item.uri))}
                      >
                        <X color={'#FFFFFF'} size={20} />
                      </TouchableOpacity>
                    </View>
                  )}
                />
              </View>
            )}

            <View style={styles.mediaButtons}>
              <TouchableOpacity style={styles.mediaButton} onPress={pickMedia}>
                <ImageIcon color={colors.primary} size={24} />
                <Text style={styles.mediaButtonText}>Galería</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mediaButton} onPress={() => captureMedia('image')}>
                <ImageIcon color={colors.primary} size={24} />
                <Text style={styles.mediaButtonText}>Cámara</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mediaButton} onPress={() => captureMedia('video')}>
                <Video color={colors.community} size={24} />
                <Text style={styles.mediaButtonText}>Grabar</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <Button title={t('cancel')} onPress={() => setModalVisible(false)} type="outline" />
              <Button title={t('publish')} onPress={handleCreatePost} loading={creating} />
            </View>

            {creating && media.length > 0 && (
              <View style={styles.progressWrap}>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${Math.round(uploadProgress * 100)}%` }]} />
                </View>
                <Text style={styles.progressText}>{Math.round(uploadProgress * 100)}%</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={storyViewerOpen} transparent animationType="fade" onRequestClose={() => setStoryViewerOpen(false)}>
        <View style={styles.storyModal}>
          <View style={styles.storyProgressRow}>
            {(activeStoryUser?.stories || []).map((_: any, idx: number) => {
              const pct = idx < activeStoryIndex ? 1 : idx === activeStoryIndex ? storyProgress : 0;
              return (
                <View key={`${activeStoryUser?.authorId}-${idx}`} style={styles.storyProgressSegmentBg}>
                  <View style={[styles.storyProgressSegmentFill, { width: `${Math.round(pct * 100)}%` }]} />
                </View>
              );
            })}
          </View>
          
          <View style={styles.storyHeader}>
            <ExpoImage 
              source={{ uri: activeStoryUser?.author?.avatarUrl || 'https://via.placeholder.com/32' }} 
              style={styles.storyHeaderAvatar} 
            />
            <Text style={styles.storyHeaderName}>@{activeStoryUser?.author?.username}</Text>
            <TouchableOpacity style={styles.storyClose} onPress={() => setStoryViewerOpen(false)}>
              <X size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={{ flex: 1, width: '100%' }} 
            onPress={nextStory} 
            activeOpacity={1}
          >
            {activeStoryUser?.stories?.[activeStoryIndex]?.mediaType === 'image' ? (
              <ExpoImage
                source={{ uri: activeStoryUser?.stories?.[activeStoryIndex]?.mediaUrl }}
                style={styles.storyMedia}
                contentFit="contain"
              />
            ) : (
              <StoryVideo url={activeStoryUser?.stories?.[activeStoryIndex]?.mediaUrl} />
            )}

            {storyReaction && (
              <View style={styles.storyReactionPopup}>
                <Text style={{ fontSize: 80 }}>{storyReaction}</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.storyFooter}>
            <View style={styles.storyReplyRow}>
              <TextInput
                style={styles.storyReplyInput}
                placeholder="Responder historia..."
                placeholderTextColor="rgba(255,255,255,0.7)"
                value={storyReply}
                onChangeText={setStoryReply}
                onSubmitEditing={replyToStory}
              />
            </View>
            <View style={styles.storyReactionRow}>
              {['❤️', '🔥', '😂', '😮', '😢', '👏'].map((emoji) => (
                <TouchableOpacity 
                  key={emoji} 
                  style={styles.storyReactionBtn} 
                  onPress={() => reactToStory(emoji)}
                >
                  <Text style={{ fontSize: 24 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  flatList: {
    width: '100%',
    maxWidth: 640,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 0,
    width: '100%',
    maxWidth: 680,
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
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  headerActions: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  iconBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    gap: 6
  },
  createBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700'
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  storiesSection: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  storiesRow: { paddingLeft: 16 },
  storyItem: { alignItems: 'center', marginRight: 16, gap: 5 },
  storyRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    padding: 3,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyRingAdd: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.background,
  },
  storyName: { 
    fontSize: 11, 
    color: colors.textSecondary, 
    width: 66, 
    textAlign: 'center', 
    marginTop: 4, 
    fontWeight: '500' 
  },
  storyAdd: {
    alignItems: 'center',
    marginRight: 16,
  },
  feedHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 24,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  feedTab: {
    paddingVertical: 14,
    position: 'relative',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: colors.primary,
    marginBottom: -1,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.text,
  },
  storyModal: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  storyHeader: { 
    position: 'absolute', 
    top: 55, 
    left: 18, 
    right: 18, 
    flexDirection: 'row', 
    alignItems: 'center', 
    zIndex: 12 
  },
  storyHeaderAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  storyHeaderName: { color: '#FFF', fontWeight: '700', fontSize: 14, flex: 1 },
  storyClose: { padding: 5 },
  storyMedia: { width: '100%', height: '100%' },
  storyProgressRow: { position: 'absolute', top: 44, left: 12, right: 12, flexDirection: 'row', gap: 6, zIndex: 11 },
  storyProgressSegmentBg: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  storyProgressSegmentFill: { height: 2, backgroundColor: '#FFF' },
  storyFooter: { 
    position: 'absolute', 
    bottom: 40, 
    left: 0, 
    right: 0, 
    alignItems: 'center', 
    zIndex: 10 
  },
  storyReactionRow: { 
    flexDirection: 'row', 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    borderRadius: 30, 
    paddingHorizontal: 15, 
    paddingVertical: 10,
    gap: 15
  },
  storyReactionBtn: { 
    padding: 2
  },
  storyReactionPopup: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    zIndex: 20
  },
  storyReplyRow: {
    width: '90%',
    marginBottom: 15,
  },
  storyReplyInput: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 100 },
  emptyText: { fontSize: 20, fontWeight: 'bold', color: colors.text, textAlign: 'center' },
  emptySubtext: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginBottom: 20, marginTop: 5 },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    zIndex: 1000,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 16,
  },
  mediaButton: {
    alignItems: 'center',
    gap: 8,
  },
  mediaButtonText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  mediaPreviewList: { marginVertical: 10 },
  mediaPreview: { width: 100, height: 100, borderRadius: 12 },
  removeMedia: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.text,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtons: { flexDirection: 'row', gap: 10 },
  progressWrap: { marginTop: 12, alignItems: 'center', gap: 8 },
  progressBarBg: { width: '100%', height: 6, borderRadius: 3, backgroundColor: colors.border },
  progressBarFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  progressText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
});

export default FeedScreen;

