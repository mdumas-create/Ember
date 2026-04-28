# Ember Social Network 🌟

Ember es una red social moderna, cálida y profesional diseñada para fomentar conexiones reales y seguras. Construida con un stack tecnológico de vanguardia, Ember ofrece una experiencia de usuario fluida tanto en dispositivos móviles como en la web.

## 🚀 Características Principales

### 📱 Experiencia Móvil (React Native + Expo)
- **Offline-first**: Sigue interactuando, publicando y chateando incluso sin conexión. Tus acciones se sincronizan automáticamente cuando vuelves a estar online.
- **Historias Avanzadas**: Comparte momentos efímeros con autoplay, barras de progreso y reacciones animadas.
- **Chat en Tiempo Real**: Mensajes de texto, voz, video e imágenes con indicadores de presencia y lectura.
- **Gamificación**: Gana reputación y mantén tus rachas (streaks) activas publicando diariamente.
- **Push Notifications**: Recibe alertas instantáneas sobre likes, comentarios y mensajes (FCM nativo).

### ⚙️ Backend Robusto (Node.js + Express + TypeScript)
- **Escalabilidad**: Preparado para el crecimiento con Redis Adapter para WebSockets y soporte para balanceo de carga.
- **Seguridad**: Protección contra ataques XSS, rate limiting inteligente y validación de datos estricta con Zod.
- **Moderación Inteligente**: Filtros automáticos de profanidad y un panel administrativo completo para gestionar reportes.
- **Webhooks**: Integra Ember con otros servicios (Discord, Slack, etc.) mediante disparadores de eventos automáticos.

## 🛠️ Stack Tecnológico

- **Frontend**: React Native, Expo, Lucide Icons, Axios, Context API.
- **Backend**: Node.js, TypeScript, Express, Prisma ORM.
- **Base de Datos**: PostgreSQL, Redis (Caching & Sockets).
- **Infraestructura**: Docker, NGINX, Cloudinary (Multimedia), Firebase (Push).
- **Calidad**: Jest, Supertest, K6 (Load Testing), Sentry (Error Tracking).

## 🚦 Inicio Rápido

### Prerrequisitos
- Node.js (v18+)
- Docker y Docker Compose

### Instalación
1. **Clonar el repositorio**
2. **Configurar variables de entorno**
   - Copia `backend/.env.example` a `backend/.env`
   - Copia `frontend/.env.example` a `frontend/.env`
3. **Iniciar Infraestructura (DB & Redis)**
   ```bash
   docker-compose up -d postgres redis
   ```
4. **Instalar dependencias e iniciar**
   - **Backend**:
     ```bash
     cd backend && npm install && npm run dev
     ```
   - **Frontend**:
     ```bash
     cd frontend && npm install && npx expo start
     ```

## 📜 Documentación Adicional
- [Operations Runbook](./RUNBOOK.md): Guía para despliegue, backups y escalado en producción.
- [MVP Summary](./MVP_Ember_Resumen.txt): Registro histórico de funcionalidades implementadas.

---
Hecho con ❤️ para la comunidad de Ember.
