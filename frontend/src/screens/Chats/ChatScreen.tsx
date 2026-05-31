import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Image, ActivityIndicator, Platform } from 'react-native';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { Image as ImageIcon, Video, Send, X, Search, Smile, Mic, Square, ChevronLeft, Flame } from 'lucide-react-native';
import { getSocket } from '../../services/socket';
import * as ImageManipulator from 'expo-image-manipulator';
import { useThemeMode } from '../../context/ThemeContext';
import { useAudioRecorder, RecordingPresets, setAudioModeAsync, useAudioRecorderState } from 'expo-audio';
import { addToQueue } from '../../utils/offlineQueue';
import { trackEvent } from '../../utils/analytics';
import { useConfig } from '../../context/ConfigContext';

type MessageReaction = {
  id: string;
  emoji: string;
  userId: string;
};

type Message = {
  id: string;
  content: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  senderId: string;
  receiverId: string;
  isRead?: string | null;
  createdAt: string;
  reactions?: MessageReaction[];
};

const REACTIONS = ['👍', '❤️', '😂'] as const;

const ChatScreen = ({ route, navigation }: any) => {
  const { user } = useAuth();
  const { colors } = useThemeMode();
  const { isFeatureEnabled } = useConfig();
  const styles = createStyles(colors);
  const conversationId: string = route.params?.conversationId;
  const participant = route.params?.participant;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [picked, setPicked] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY as any);
  const recorderState: any = useAudioRecorderState(audioRecorder as any);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Message[] | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [streak, setStreak] = useState(0);

  const listRef = useRef<FlatList>(null);
  const socketRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);

  const receiverId = useMemo(() => {
    if (participant?.id) return participant.id;
    const first = messages.find((m: Message) => m.senderId !== user?.id);
    return first?.senderId || '';
  }, [participant?.id, messages, user?.id]);

  const fetchMessages = async (nextCursor?: string | null) => {
    try {
      const res = await api.get(`/chat/conversations/${conversationId}/messages?cursor=${nextCursor || ''}`);
      const { messages: newItems, streak: currentStreak } = res.data;
      
      if (currentStreak !== undefined) setStreak(currentStreak);

      if (nextCursor) {
        setMessages((prev) => [...newItems, ...prev]);
      } else {
        setMessages(newItems);
      }
      if (newItems.length) setCursor(newItems[0].id);

      if (!nextCursor && socketRef.current && user?.id) {
        newItems
          .filter((m: Message) => m.senderId !== user.id && m.receiverId === user.id && !m.isRead)
          .forEach((m: Message) => {
            socketRef.current.emit('mark_read', { messageId: m.id, userId: user.id, senderId: m.senderId });
          });
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [conversationId]);

  useEffect(() => {
    if (!user?.id) return;
    const socket = getSocket(user.id);
    socketRef.current = socket;

    const onTyping = (data: any) => {
      if (data.conversationId !== conversationId) return;
      if (data.userId === user.id) return;
      setOtherTyping(true);
    };
    const onStopTyping = (data: any) => {
      if (data.conversationId !== conversationId) return;
      if (data.userId === user.id) return;
      setOtherTyping(false);
    };
    const onMessageRead = (msg: any) => {
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isRead: msg.isRead } : m)));
    };
    const onUserOnline = (data: any) => {
      if (data.userId === participant?.id) setOtherOnline(true);
    };
    const onUserOffline = (data: any) => {
      if (data.userId === participant?.id) setOtherOnline(false);
    };
    const onNewMessage = (msg: any) => {
      if (msg.conversationId !== conversationId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (msg.senderId !== user.id && msg.receiverId === user.id) {
        socket.emit('mark_read', { messageId: msg.id, userId: user.id, senderId: msg.senderId });
      }
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    };

    socket.on('user_typing', onTyping);
    socket.on('user_stop_typing', onStopTyping);
    socket.on('message_read', onMessageRead);
    socket.on('user_online', onUserOnline);
    socket.on('user_offline', onUserOffline);
    socket.on('new_message', onNewMessage);

    if (participant?.id) {
      socket.emit('is_online', { userId: participant.id }, (res: any) => {
        setOtherOnline(!!res?.online);
      });
    }

    return () => {
      socket.off('user_typing', onTyping);
      socket.off('user_stop_typing', onStopTyping);
      socket.off('message_read', onMessageRead);
      socket.off('user_online', onUserOnline);
      socket.off('user_offline', onUserOffline);
      socket.off('new_message', onNewMessage);
    };
  }, [conversationId, participant?.id, user?.id]);

  useEffect(() => {
    if (!loading && listRef.current) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
    }
  }, [loading]);

  const pickMedia = async (kind: 'image' | 'video') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === 'image' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
      quality: kind === 'image' ? 0.8 : undefined,
    });

    if (!result.canceled) {
      setPicked({ uri: result.assets[0].uri, type: kind });
      setAudioUri(null);
    }
  };

  const startRecording = async () => {
    try {
      await setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true } as any);
      await (audioRecorder as any).prepareToRecordAsync();
      if ((audioRecorder as any).record) (audioRecorder as any).record();
      else if ((audioRecorder as any).start) (audioRecorder as any).start();
    } catch (e) {
    }
  };

  const stopRecording = async () => {
    try {
      if ((audioRecorder as any).stop) await (audioRecorder as any).stop();
      else if ((audioRecorder as any).stopAsync) await (audioRecorder as any).stopAsync();
      setAudioUri((audioRecorder as any).uri || null);
      setPicked(null);
    } catch (e) {
    }
  };

  const uploadAttachment = async () => {
    if (!picked && !audioUri) return null;
    const formData = new FormData();
    setUploadProgress(0);
    let uriToUpload = picked?.uri || audioUri!;

    if (Platform.OS === 'web') {
      const response = await fetch(uriToUpload);
      const blob = await response.blob();
      const filename = audioUri
        ? 'upload.m4a'
        : picked?.type === 'video'
          ? 'upload.mp4'
          : 'upload.jpg';
      formData.append('file', blob, filename);
    } else {
      if (picked?.type === 'image') {
        const manipulated = await ImageManipulator.manipulateAsync(
          uriToUpload,
          [{ resize: { width: 1280 } }],
          { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
        );
        uriToUpload = manipulated.uri;
      }
      formData.append('file', {
        uri: uriToUpload,
        type: audioUri ? 'audio/m4a' : picked?.type === 'video' ? 'video/mp4' : 'image/jpeg',
        name: audioUri ? 'upload.m4a' : picked?.type === 'video' ? 'upload.mp4' : 'upload.jpg',
      } as any);
    }

    const uploadRes = await api.post('upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evt: any) => {
        if (!evt.total) return;
        const p = Math.max(0, Math.min(1, evt.loaded / evt.total));
        setUploadProgress(p);
      },
    });
    return { url: uploadRes.data.url as string, mediaType: audioUri ? 'audio' : picked?.type };
  };

  const handleSend = async () => {
    const hasText = !!text.trim();
    if (!hasText && !picked && !audioUri) return;
    if (!receiverId) return;

    setSending(true);
    try {
      const uploaded = await uploadAttachment();

      const body = {
        content: hasText ? text.trim() : '',
        receiverId,
        mediaUrl: uploaded?.url || null,
        mediaType: uploaded?.mediaType || null,
      };

      const res = await api.post(`/chat/conversations/${conversationId}/messages`, body);
        
        trackEvent('message_sent', { 
          conversationId, 
          receiverId, 
          hasMedia: !!uploaded?.url,
          contentLength: body.content.length 
        });

        const { streak: newStreak, ...created } = res.data;
        if (newStreak !== undefined) setStreak(newStreak);
        
        const createdMsg: Message = created as Message;
        setMessages((prev) => [...prev, createdMsg]);
      setText('');
      setPicked(null);
      setAudioUri(null);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (error: any) {
      if (!error.response) {
        // Network error - Optimistic Update + Queue
        const localId = `local-${Date.now()}`;
        const localMsg: Message = {
          id: localId,
          content: hasText ? text.trim() : '',
          senderId: user?.id || '',
          receiverId,
          createdAt: new Date().toISOString(),
          mediaUrl: null, // Attachments are harder offline
          mediaType: null,
        };
        setMessages((prev) => [...prev, localMsg]);
        await addToQueue({ 
          type: 'POST', 
          url: `/chat/conversations/${conversationId}/messages`, 
          data: {
            content: hasText ? text.trim() : '',
            receiverId,
            mediaUrl: null,
            mediaType: null,
          } 
        });
        setText('');
        setPicked(null);
        setAudioUri(null);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
      } else {
        console.error('Error sending message:', error);
      }
    } finally {
      setSending(false);
    }
  };

  const reactToMessage = async (messageId: string, emoji: string) => {
    try {
      await api.post(`/chat/conversations/messages/${messageId}/react`, { emoji });
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const existing = m.reactions || [];
          const withoutMe = existing.filter((r) => r.userId !== user?.id);
          return { ...m, reactions: [...withoutMe, { id: `local-${messageId}`, emoji, userId: user?.id }] };
        })
      );
    } catch (e) {
    }
  };

  const loadMore = () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    fetchMessages(cursor);
  };

  const groupedReactions = (m: Message) => {
    const map = new Map<string, number>();
    (m.reactions || []).forEach((r) => map.set(r.emoji, (map.get(r.emoji) || 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  };

  const runSearch = async () => {
    const q = searchQ.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get(`/chat/conversations/${conversationId}/search?q=${encodeURIComponent(q)}`);
      setSearchResults(res.data);
    } finally {
      setSearching(false);
    }
  };

  const dataToRender = searchResults ?? messages;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Image source={{ uri: participant?.avatarUrl || 'https://via.placeholder.com/40' }} style={styles.topAvatar} />
          <View>
            <View style={styles.nameRow}>
              <Text style={styles.title}>{participant?.username || 'Chat'}</Text>
              {streak > 0 && (
                <View style={styles.streakBadge}>
                  <Flame size={12} color={colors.primary} fill={colors.primary} />
                  <Text style={styles.streakText}>{streak}</Text>
                </View>
              )}
            </View>
            {!!searchResults ? (
              <Text style={styles.subtitle}>Resultados: {searchResults.length}</Text>
            ) : (
              <Text style={styles.subtitle}>
                {otherTyping ? 'escribiendo...' : (otherOnline ? 'En línea' : 'Desconectado')}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={() => setSearchOpen((v) => !v)}>
          <Search size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {searchOpen && (
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={searchQ}
            onChangeText={setSearchQ}
            placeholder="Buscar mensajes..."
            placeholderTextColor={colors.gray}
            onSubmitEditing={runSearch}
            returnKeyType="search"
          />
          <TouchableOpacity onPress={runSearch} style={styles.searchAction} disabled={searching}>
            {searching ? <ActivityIndicator /> : <Search size={18} color={colors.primary} />}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setSearchQ('');
              setSearchResults(null);
              setSearchOpen(false);
            }}
            style={styles.searchAction}
          >
            <X size={18} color={colors.gray} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        ref={listRef}
        data={dataToRender}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onEndReached={searchResults ? undefined : loadMore}
        onEndReachedThreshold={0.2}
        ListHeaderComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 10 }} /> : null}
        renderItem={({ item, index }) => {
          const mine = item.senderId === user?.id;
          const isLastMine = mine && index === dataToRender.length - 1 && !searchResults;
          const reactions = groupedReactions(item);
          return (
            <View style={[styles.bubbleRow, mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                {!!item.mediaUrl && item.mediaType === 'image' && (
                  <Image source={{ uri: item.mediaUrl }} style={styles.media} />
                )}
                {!!item.mediaUrl && item.mediaType === 'video' && (
                  <View style={styles.videoPlaceholder}>
                    <Video size={20} color={colors.white} />
                    <Text style={styles.videoText}>Video</Text>
                  </View>
                )}
                {!!item.mediaUrl && item.mediaType === 'audio' && (
                  <View style={styles.audioPlaceholder}>
                    <Mic size={20} color={colors.white} />
                    <Text style={styles.videoText}>Audio</Text>
                  </View>
                )}
                {!!item.content && (
                  <Text style={[
                    styles.messageText, 
                    mine ? { color: '#FFFFFF' } : { color: colors.text }
                  ]}>
                    {item.content}
                  </Text>
                )}

                {isLastMine && (
                  <Text style={[
                    styles.readText, 
                    mine ? { color: 'rgba(255,255,255,0.8)' } : { color: colors.textSecondary }
                  ]}>
                    {item.isRead ? 'Visto' : 'Enviado'}
                  </Text>
                )}

                {!!reactions.length && (
                  <View style={styles.reactionsRow}>
                    {reactions.slice(0, 3).map(([emoji, count]) => (
                      <View key={emoji} style={styles.reactionPill}>
                        <Text style={styles.reactionText}>{emoji}</Text>
                        <Text style={styles.reactionCount}>{count}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={[
                  styles.reactionActions, 
                  { borderTopColor: mine ? 'rgba(255,255,255,0.2)' : colors.border }
                ]}>
                  <Smile size={14} color={mine ? '#FFFFFF' : colors.textSecondary} />
                  {REACTIONS.map((emoji) => (
                    <TouchableOpacity key={emoji} onPress={() => reactToMessage(item.id, emoji)} style={styles.reactionBtn}>
                      <Text style={styles.reactionBtnText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          );
        }}
      />

      {!!picked && (
        <View style={styles.preview}>
          <View style={styles.previewInner}>
            {picked.type === 'image' ? (
              <Image source={{ uri: picked.uri }} style={styles.previewImage} />
            ) : (
              <View style={styles.previewVideo}>
                <Video size={20} color={colors.white} />
                <Text style={styles.videoText}>Video listo</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => setPicked(null)} style={styles.previewRemove}>
              <X size={16} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!!audioUri && (
        <View style={styles.preview}>
          <View style={styles.previewInner}>
            <View style={styles.previewAudio}>
              <Mic size={20} color={colors.white} />
              <Text style={styles.videoText}>Audio listo</Text>
            </View>
            <TouchableOpacity onPress={() => setAudioUri(null)} style={styles.previewRemove}>
              <X size={16} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.composer}>
        <TouchableOpacity onPress={() => pickMedia('image')} style={styles.attachBtn}>
          <ImageIcon size={18} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => pickMedia('video')} style={styles.attachBtn}>
          <Video size={18} color={colors.text} />
        </TouchableOpacity>
        
        {isFeatureEnabled('voice-messages') && (
          <TouchableOpacity
            onPress={() => (recorderState?.isRecording ? stopRecording() : startRecording())}
            style={styles.attachBtn}
          >
            {recorderState?.isRecording ? <Square size={18} color={colors.text} /> : <Mic size={18} color={colors.text} />}
          </TouchableOpacity>
        )}

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={(v) => {
            setText(v);
            if (!socketRef.current || !user?.id || !receiverId) return;
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

            if (v.trim().length) {
              socketRef.current.emit('typing', { conversationId, userId: user.id, receiverId });
              typingTimeoutRef.current = setTimeout(() => {
                socketRef.current?.emit('stop_typing', { conversationId, userId: user.id, receiverId });
              }, 800);
            } else {
              socketRef.current.emit('stop_typing', { conversationId, userId: user.id, receiverId });
            }
          }}
          placeholder="Escribe un mensaje..."
          placeholderTextColor={colors.gray}
          multiline
        />

        <TouchableOpacity onPress={handleSend} style={styles.sendBtn} disabled={sending}>
          {sending ? <ActivityIndicator color={colors.white} /> : <Send size={18} color={colors.white} />}
        </TouchableOpacity>
      </View>

      {sending && (picked || audioUri) && (
        <View style={styles.uploadProgressWrap}>
          <View style={styles.uploadProgressBg}>
            <View style={[styles.uploadProgressFill, { width: `${Math.round(uploadProgress * 100)}%` }]} />
          </View>
          <Text style={styles.uploadProgressText}>{Math.round(uploadProgress * 100)}%</Text>
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.navBg,
    ...Platform.select({
      web: {
        maxWidth: 640,
        alignSelf: 'center',
        width: '100%',
      } as any
    })
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  topAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backBtn: {
    padding: 4,
  },
  nameRow: {
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
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  iconButton: { 
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: colors.navBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: colors.text,
    backgroundColor: colors.cardBg,
    fontSize: 14,
  },
  searchAction: { padding: 8 },
  list: { 
    paddingHorizontal: 16, 
    paddingVertical: 20,
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
  },
  bubbleRow: { flexDirection: 'row', marginVertical: 4 },
  bubble: { 
    maxWidth: '85%', 
    borderRadius: 20, 
    paddingHorizontal: 14, 
    paddingVertical: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }
    })
  },
  bubbleMine: { 
    backgroundColor: colors.myBubble,
    borderBottomRightRadius: 4,
  },
  bubbleOther: { 
    backgroundColor: colors.surface, 
    borderWidth: 1, 
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  messageText: { fontSize: 15, lineHeight: 22 },
  readText: { fontSize: 10, marginTop: 4, opacity: 0.9, fontWeight: '700', textAlign: 'right' },
  media: { width: 240, height: 240, borderRadius: 16, marginBottom: 8 },
  videoPlaceholder: {
    width: 240,
    height: 160,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  audioPlaceholder: {
    width: 240,
    height: 60,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  videoText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  reactionsRow: { 
    flexDirection: 'row', 
    gap: 4, 
    marginTop: 8, 
    flexWrap: 'wrap',
    position: 'absolute',
    bottom: -15,
    right: 10,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reactionText: { fontSize: 11 },
  reactionCount: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  reactionActions: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  reactionBtn: { padding: 4 },
  reactionBtnText: { fontSize: 16 },
  preview: { 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    backgroundColor: colors.background,
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
  },
  previewInner: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewImage: { width: 60, height: 60, borderRadius: 12 },
  previewVideo: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewAudio: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.navBg,
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: colors.cardBg,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.myBubble,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.myBubble,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  uploadProgressWrap: { 
    paddingHorizontal: 16, 
    paddingBottom: 16, 
    backgroundColor: colors.navBg,
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
  },
  uploadProgressBg: { 
    height: 6, 
    borderRadius: 3, 
    backgroundColor: colors.cardBg, 
    overflow: 'hidden',
  },
  uploadProgressFill: { height: 6, backgroundColor: colors.primary },
  uploadProgressText: { marginTop: 6, color: colors.textSecondary, fontWeight: '700', fontSize: 12, textAlign: 'center' },
});

export default ChatScreen;

