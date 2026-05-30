import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '../../context/ThemeContext';
import { ChevronLeft } from 'lucide-react-native';

const LegalScreen = ({ navigation, route }: any) => {
  const { t } = useTranslation();
  const { colors } = useThemeMode();
  const styles = createStyles(colors);
  const type = route.params?.type || 'terms'; // 'terms' or 'privacy'

  const content = {
    terms: {
      title: 'Términos de Servicio',
      text: `Bienvenido a Ember. Al usar nuestra aplicación, aceptas los siguientes términos:\n\n1. Respeto mutuo: No se permite el acoso ni el contenido de odio.\n2. Propiedad del contenido: Eres responsable de lo que publicas.\n3. Edad mínima: Debes tener al menos 13 años.\n4. Moderación: Nos reservamos el derecho de eliminar contenido inapropiado.\n\nEmber es una comunidad segura y cálida para todos.`
    },
    privacy: {
      title: 'Política de Privacidad',
      text: `En Ember valoramos tu privacidad:\n\n1. Datos recolectados: Email, nombre de usuario y actividad básica.\n2. Uso de datos: Mejorar tu experiencia y enviarte notificaciones push.\n3. Compartición: No vendemos tus datos a terceros.\n4. Control: Puedes eliminar tu cuenta y datos en cualquier momento desde Configuración.`
    }
  }[type as 'terms' | 'privacy'];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{content.title}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.text}>{content.text}</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border,
    backgroundColor: colors.white
  },
  backBtn: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  content: { padding: 20 },
  text: { fontSize: 16, color: colors.text, lineHeight: 24 }
});

export default LegalScreen;
