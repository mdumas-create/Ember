FROM node:20.19.4-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20.19.4-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy build and prisma files
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./

# Add a start script that runs migrations and then the app
RUN echo "npx prisma migrate deploy && node dist/index.js" > start.sh
RUN chmod +x start.sh

CMD ["sh", "start.sh"]
