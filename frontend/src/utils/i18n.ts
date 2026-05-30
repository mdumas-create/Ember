import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

const resources = {
  en: {
    translation: {
      welcome: 'Connect with your community',
      login: 'Login',
      register: 'Register',
      email: 'Email',
      password: 'Password',
      username: 'Username',
      dont_have_account: "Don't have an account? Sign up",
      already_have_account: 'Already have an account? Log in',
      create_post: 'Create my first post',
      no_posts: 'No posts yet.',
      be_first: 'Be the first to share something!',
      thinking: 'What are you thinking?',
      publish: 'Publish',
      cancel: 'Cancel',
      comments: 'Comments',
      reply: 'Reply',
      logout: 'Logout',
    },
  },
  es: {
    translation: {
      welcome: 'Conéctate con tu comunidad',
      login: 'Entrar',
      register: 'Registrarse',
      email: 'Email',
      password: 'Contraseña',
      username: 'Usuario',
      dont_have_account: '¿No tienes cuenta? Regístrate',
      already_have_account: '¿Ya tienes cuenta? Inicia sesión',
      create_post: 'Crear mi primer post',
      no_posts: 'Todavía no hay publicaciones.',
      be_first: '¡Sé el primero en compartir algo!',
      thinking: '¿Qué estás pensando?',
      publish: 'Publicar',
      cancel: 'Cancelar',
      comments: 'Comentarios',
      reply: 'Responder',
      logout: 'Cerrar Sesión',
    },
  },
};

const getLanguage = async () => {
  const savedLanguage = await AsyncStorage.getItem('user-language');
  if (savedLanguage) {
    return savedLanguage;
  }
  return Localization.getLocales()[0].languageCode || 'en';
};

const initI18n = async () => {
  const lang = await getLanguage();
  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: lang,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
    });
};

initI18n();

export default i18n;
