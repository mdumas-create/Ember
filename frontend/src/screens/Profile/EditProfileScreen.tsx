import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import { Button } from '../../components/Button';
import api from '../../services/api';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Camera, X, Check } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { useThemeMode } from '../../context/ThemeContext';

const EditProfileScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { user: authUser, updateUser } = useAuth();
  
  // Usamos los datos de la ruta si existen (viniendo de Profile), 
  // si no, usamos los del contexto de autenticación (viniendo de Sidebar)
  const initialUser = route.params?.user || authUser;
  
  const { colors } = useThemeMode();
  const styles = createStyles(colors);

  const [username, setUsername] = useState(initialUser?.username || '');
  const [displayName, setDisplayName] = useState(initialUser?.displayName || '');
  const [bio, setBio] = useState(initialUser?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(initialUser?.avatarUrl || '');
  const [coverUrl, setCoverUrl] = useState(initialUser?.coverUrl || '');
  const [interestsText, setInterestsText] = useState((initialUser?.interests || []).join(', '));
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const pickImage = async (type: 'avatar' | 'cover') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'avatar' ? [1, 1] : [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      uploadImage(result.assets[0].uri, type);
    }
  };

  const uploadImage = async (uri: string, type: 'avatar' | 'cover') => {
    if (type === 'avatar') setUploading(true);
    else setUploadingCover(true);
    
    const formData = new FormData();

    try {
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('file', blob, 'upload.jpg');
      } else {
        const filename = uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image`;
        formData.append('file', {
          uri,
          name: filename,
          type,
        } as any);
      }

      formData.append('upload_preset', 'ember_preset'); 

      const cloudName = 'dvoas1kmw';
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      
      if (data.secure_url) {
        if (type === 'avatar') setAvatarUrl(data.secure_url);
        else setCoverUrl(data.secure_url);
        Alert.alert('Imagen subida', 'Presiona "Guardar cambios" para finalizar.');
      } else {
        console.error('Cloudinary Error:', data);
        Alert.alert('Error Cloudinary', data.error?.message || 'Error desconocido al subir.');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'No se pudo subir la imagen');
    } finally {
      if (type === 'avatar') setUploading(false);
      else setUploadingCover(false);
    }
  };

  const handleSave = async () => {
    if (!username.trim()) return;
    setLoading(true);
    try {
      const response = await api.put('/users/me', {
        username,
        displayName,
        bio,
        avatarUrl,
        coverUrl,
        interests: (interestsText || '')
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean),
      });
      updateUser(response.data);
      
      // Pequeño retardo para asegurar que el usuario vea el estado de carga y la persistencia se complete
      setTimeout(() => {
        setLoading(false);
        if (Platform.OS === 'web') {
          window.alert('¡Éxito! Perfil actualizado correctamente');
        } else {
          Alert.alert('Éxito', 'Perfil actualizado correctamente');
        }
        navigation.goBack();
      }, 800);
    } catch (error: any) {
      setLoading(false);
      const errorMsg = error.response?.data?.error || 'No se pudo actualizar el perfil';
      if (Platform.OS === 'web') {
        window.alert('Error: ' + errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <X size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Editar Perfil</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Check size={24} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.mediaSection}>
        {/* Banner Editor */}
        <TouchableOpacity onPress={() => pickImage('cover')} style={styles.coverWrapper}>
          <Image 
            source={{ uri: coverUrl || 'https://images.unsplash.com/photo-1542224566-6e85f2e6772f?q=80&w=2000&auto=format&fit=crop' }} 
            style={styles.coverImage} 
          />
          <View style={styles.coverOverlay}>
            {uploadingCover ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Camera size={24} color={colors.white} />
                <Text style={styles.coverActionText}>Cambiar banner</Text>
              </>
            )}
          </View>
        </TouchableOpacity>

        {/* Avatar Editor */}
        <View style={styles.avatarPositioner}>
          <TouchableOpacity onPress={() => pickImage('avatar')} style={styles.avatarWrapper}>
            <Image 
              source={{ uri: avatarUrl || 'https://ui-avatars.com/api/?name=User&background=F59E0B&color=fff' }} 
              style={styles.avatar} 
            />
            <View style={styles.cameraIcon}>
              {uploading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Camera size={18} color={colors.white} />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre de usuario</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Username"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre para mostrar</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Nombre para mostrar"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Biografía</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholder="Cuéntanos algo sobre ti..."
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Intereses</Text>
          <TextInput
            style={styles.input}
            value={interestsText}
            onChangeText={setInterestsText}
            placeholder="ej: música, deportes, cocina"
          />
        </View>

        <Button 
          title="Guardar cambios" 
          onPress={handleSave} 
          loading={loading}
          style={{ marginTop: 20 }}
        />
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...Platform.select({
      web: {
        maxWidth: 640,
        alignSelf: 'center',
        width: '100%',
      } as any
    })
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  mediaSection: {
    height: 220,
    width: '100%',
    position: 'relative',
    marginBottom: 40,
    maxWidth: 640,
    alignSelf: 'center',
  },
  coverWrapper: {
    width: '100%',
    height: 180,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  coverActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  avatarPositioner: {
    position: 'absolute',
    bottom: 0,
    left: 24,
    zIndex: 10,
  },
  avatarWrapper: { 
    position: 'relative',
  },
  avatar: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    borderWidth: 4, 
    borderColor: '#FFFFFF',
    backgroundColor: '#F3F4F6',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#F59E0B',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  form: { 
    padding: 24,
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
  },
  inputGroup: { marginBottom: 24 },
  label: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#6B7280', 
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: { 
    backgroundColor: '#FFFFFF', 
    borderWidth: 1, 
    borderColor: '#E5E7EB',
    borderRadius: 16, 
    padding: 14,
    fontSize: 15,
    color: '#1F2937'
  },
  textArea: { 
    minHeight: 100, 
    textAlignVertical: 'top' 
  },
});

export default EditProfileScreen;
