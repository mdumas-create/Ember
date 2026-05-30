# Ember Social Network - Operations Runbook

Este documento contiene los pasos operativos para mantener y escalar Ember en producción.

## 🚀 Despliegue en la Nube (Recomendado)

Para un despliegue rápido y escalable sin gestionar servidores (VPS), se recomienda la siguiente combinación:

### 1. Base de Datos (Supabase)
- Crea un proyecto en [Supabase](https://supabase.com/).
- En la configuración del proyecto, obtén la **Connection String** de PostgreSQL.
- Usa el modo "Transaction" (puerto 6543) para `DATABASE_URL` y el modo "Session" (puerto 5432) para `DIRECT_URL` en Prisma.

### 2. Redis & Colas (Upstash)
- Crea una base de datos Redis en [Upstash](https://upstash.com/).
- Copia la URL de conexión (`rediss://...`) para la variable `REDIS_URL`. Esto es crítico para que los WebSockets y las notificaciones funcionen.

### 3. Backend (Railway o Render)
- **Por qué no Vercel**: El backend de Ember usa **Socket.io** (WebSockets) para el chat y presencia. Vercel (Serverless) no soporta conexiones persistentes.
- Conecta tu repositorio a [Railway](https://railway.app/).
- Railway detectará automáticamente el `backend/Dockerfile`.
- Configura las variables de entorno: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `CLOUDINARY_*`, etc.

### 4. Frontend (Vercel)
- Conecta la carpeta `frontend/` a [Vercel](https://vercel.com/).
- Configura la variable de entorno `EXPO_PUBLIC_API_URL` con la URL que te asigne Railway (ej: `https://ember-api.up.railway.app/api`).
- Vercel construirá la versión web de la app automáticamente.

## 🚀 Despliegue con Docker (Alternativo)

## 💾 Base de Datos y Backups

### 1. Backup Automático (pg_dump)
El script de backup diario debe configurarse como un cronjob:
```bash
# Ejemplo de comando para backup manual
docker exec ember-db pg_dump -U user ember_db > backup_$(date +%F).sql
```
Para subir a S3, usa el AWS CLI:
```bash
aws ss3 cp backup_*.sql s3://tu-bucket-backups/ember/
```

### 2. Restauración de Datos
```bash
cat backup_archivo.sql | docker exec -i ember-db psql -U user -d ember_db
```

## 🛠️ Feature Flags
Puedes activar o desactivar funcionalidades sin desplegar código nuevo editando el archivo `backend/src/modules/config/config.routes.ts` o conectándolo a una tabla de base de datos.
Endpoints: `GET /api/config/flags`

## 🚨 Monitoreo y Alertas
- **Health Check**: `https://api.ember.com/health`
- **Logs**:
  - Backend: `docker logs -f ember-backend`
  - DB: `docker logs -f ember-db`
- **Métricas**: CPU y Memoria deben monitorearse mediante CloudWatch, Grafana o el panel de tu proveedor de VPS.

## 📱 Mobile (EAS Build)
Para generar una nueva versión de producción para las tiendas:
```bash
cd frontend
eas build --profile production --platform all
```

## 🤝 Onboarding para Desarrolladores
1. Clonar el repositorio.
2. Copiar `.env.example` a `.env` tanto en `backend/` como en `frontend/`.
3. Instalar dependencias: `npm install` en ambas carpetas.
4. Iniciar infra local: `docker-compose up -d db redis`.
5. Iniciar backend: `npm run dev`.
6. Iniciar frontend: `npx expo start`.
