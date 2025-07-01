# Dockerfile pour Scooty Bot Discord
FROM node:18-alpine

# Informations sur l'image
LABEL org.opencontainers.image.title="Scooty Bot MTG"
LABEL org.opencontainers.image.description="Bot Discord pour le scouting Magic: The Gathering"
LABEL org.opencontainers.image.version="1.0.0"

# Créer le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer toutes les dépendances (pour le build)
RUN npm ci && npm cache clean --force

# Copier le code source
COPY . .

# Construire le projet
RUN npm run build

# Nettoyer les devDependencies après le build
RUN npm ci --only=production && npm cache clean --force

# Créer un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs
RUN adduser -S scooty -u 1001

# Changer les permissions
RUN chown -R scooty:nodejs /app
USER scooty

# Exposer le port
EXPOSE 3000

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=3000

# Ajouter un health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Commande de démarrage
CMD ["npm", "start"] 