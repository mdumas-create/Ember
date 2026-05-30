import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, TouchableOpacity, Text, Platform, ScrollView } from 'react-native';
import api from '../../services/api';
import PostCard from './PostCard';
import { useThemeMode } from '../../context/ThemeContext';
import { ChevronLeft } from 'lucide-react-native';

const PostDetailScreen = ({ route, navigation }: any) => {
  const { colors } = useThemeMode();
  const styles = createStyles(colors);
  const postId: string = route.params?.postId;

  const [post, setPost] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/posts/${postId}`);
        setPost(res.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [postId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  if (!post) return <View style={styles.center} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={'#1F2937'} />
        </TouchableOpacity>
        <Text style={styles.title}>Publicación</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <PostCard post={post} onRefresh={() => {}} />
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FDF4E3' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF4E3' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: '#FDF4E3',
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
      ...Platform.select({
        web: {
          maxWidth: 640,
          alignSelf: 'center',
          width: '100%',
        } as any
      })
    },
    backBtn: {
      marginRight: 12,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#FFFFFF',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    title: { fontSize: 18, fontWeight: '800', color: '#1F2937' },
    scrollContent: {
      paddingBottom: 40,
      ...Platform.select({
        web: {
          maxWidth: 640,
          alignSelf: 'center',
          width: '100%',
        } as any
      })
    }
  });

export default PostDetailScreen;
