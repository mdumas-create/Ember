# Ember Social Network - Operations Runbook

Este documento contiene los pasos operativos para mantener y escalar Ember en producción.

## 🚀 Despliegue y Escalado

### 1. Iniciar servicios con Docker
Para un despliegue rápido en una nueva instancia:
```bash
docker-compose up -d --build
```

### 2. Escalar el Backend
Si el tráfico aumenta, puedes escalar el servicio de backend:
```bash
docker-compose up -d --scale backend=3
```
*Nota: Asegúrate de tener configurado NGINX como balanceador de carga delante de estas instancias.*

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
