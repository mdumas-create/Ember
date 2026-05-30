import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Modal, SafeAreaView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { X, Send, Edit2, Trash2 } from 'lucide-react-native';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useThemeMode } from '../../context/ThemeContext';
import { trackEvent } from '../../utils/analytics';

interface Comment {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  user: {
    username: string;
    avatarUrl?: string;
  };
  replies?: Comment[];
}

interface CommentsModalProps {
  visible: boolean;
  postId: string;
  onClose: () => void;
}

const CommentsModal: React.FC<CommentsModalProps> = ({ visible, postId, onClose }) => {
  const { user } = useAuth();
  const { colors } = useThemeMode();
  const styles = createStyles(colors);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewPostComment] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchComments();
    }
  }, [visible, postId]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/posts/${postId}/comments`);
      setComments(response.data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendComment = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      if (editingComment) {
        await api.put(`/posts/comments/${editingComment.id}`, { content: newComment });
      } else {
        await api.post(`/posts/${postId}/comment`, {
          content: newComment,
          parentId: replyTo?.id || null,
        });
        trackEvent('post_commented', { 
          postId, 
          isReply: !!replyTo, 
          contentLength: newComment.length 
        });
      }
      setNewPostComment('');
      setReplyTo(null);
      setEditingComment(null);
      fetchComments();
    } catch (error) {
      console.error('Error sending/editing comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      Alert.alert('Eliminar comentario', '¿Seguro que quieres eliminar este comentario?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await api.delete(`/posts/comments/${commentId}`);
            fetchComments();
          }
        }
      ]);
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const renderCommentNode = (comment: Comment, depth: number) => {
    const isOwner = user?.id === comment.userId;

    return (
      <View key={comment.id} style={[styles.commentContainer, depth > 0 && styles.nestedContainer]}>
        <View style={styles.commentHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Text style={styles.username}>{comment.user.username}</Text>
            <Text style={styles.date}>{new Date(comment.createdAt).toLocaleDateString()}</Text>
          </View>
          {isOwner && (
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity onPress={() => {
                setEditingComment(comment);
                setNewPostComment(comment.content);
              }}>
                <Edit2 size={16} color={colors.gray} style={{ marginRight: 10 }} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteComment(comment.id)}>
                <Trash2 size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.content}>{comment.content}</Text>

        <TouchableOpacity onPress={() => setReplyTo(comment)}>
          <Text style={styles.replyButton}>Responder</Text>
        </TouchableOpacity>

        {!!comment.replies?.length && (
          <View style={styles.repliesWrapper}>
            {comment.replies.map((child) => (
              <View key={child.id} style={{ marginLeft: 14 }}>
                {renderCommentNode(child, depth + 1)}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.container}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Comentarios</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} />
          ) : (
            <FlatList
              data={comments}
              renderItem={({ item }) => renderCommentNode(item, 0)}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.list}
            />
          )}

          <View style={styles.inputWrapper}>
            {(replyTo || editingComment) && (
              <View style={styles.replyInfo}>
                <Text style={styles.replyText}>
                  {editingComment ? 'Editando comentario' : `Respondiendo a @${replyTo?.user.username}`}
                </Text>
                <TouchableOpacity onPress={() => {
                  setReplyTo(null);
                  setEditingComment(null);
                  setNewPostComment('');
                }}>
                  <X size={16} color={colors.gray} />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder={editingComment ? "Editar comentario..." : "Escribe un comentario..."}
                value={newComment}
                onChangeText={setNewPostComment}
                multiline
              />
              <TouchableOpacity 
                style={[styles.sendButton, !newComment.trim() && styles.disabledButton]} 
                onPress={handleSendComment}
                disabled={!newComment.trim() || submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Send size={20} color={colors.white} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border 
  },
  title: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  list: { padding: 16 },
  commentContainer: { marginBottom: 20 },
  nestedContainer: {
    marginBottom: 14,
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  username: { fontWeight: 'bold', color: colors.text, marginRight: 8 },
  date: { fontSize: 12, color: colors.gray },
  content: { color: colors.text, lineHeight: 18 },
  replyButton: { color: colors.primary, fontSize: 12, marginTop: 4, fontWeight: '600' },
  repliesWrapper: { marginTop: 12 },
  inputWrapper: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  replyInfo: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 8,
    backgroundColor: colors.lightGray,
    padding: 8,
    borderRadius: 8
  },
  replyText: { fontSize: 12, color: colors.gray },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end' },
  input: { 
    flex: 1, 
    backgroundColor: colors.lightGray, 
    borderRadius: 20, 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    maxHeight: 100,
    color: colors.text 
  },
  sendButton: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: colors.primary, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginLeft: 8 
  },
  disabledButton: { backgroundColor: colors.gray },
});

export default CommentsModal;
