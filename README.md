# 🟣 Scooty

> Bot Discord pour le scouting compétitif Magic: The Gathering

[![CI/CD](https://github.com/gbordes77/Scooty/actions/workflows/ci.yml/badge.svg)](https://github.com/gbordes77/Scooty/actions/workflows/ci.yml)
[![Deploy](https://img.shields.io/badge/Deploy-Fly.io-blue)](https://fly.io)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## 📋 Vue d'ensemble

**Scooty** est un bot Discord conçu pour optimiser la collecte et le partage d'informations sur les decks adverses durant les tournois Magic: The Gathering. Il remplace un processus manuel chaotique par un système structuré, instantané et sans friction.

### 🎯 Problème résolu
- **Avant** : Les joueurs écrivent "Opponent X joue Jeskai" dans un channel Discord → information noyée, doublons, pas de recherche
- **Après** : Commande `/scout` avec auto-complétion, dédoublonnage automatique, visualisation temps réel

## 🚀 Fonctionnalités

### ✅ Commandes Principales
- **`/scout`** - Reporter les informations deck d'un adversaire
- **`/check`** - Rechercher les scouts existants sur un adversaire
- **`/stats`** - Afficher les statistiques du tournoi
- **`/help`** - Afficher l'aide et les commandes

### 🎨 Interface Utilisateur
- **Auto-complétion** intelligente pour les noms d'adversaires
- **Embeds Discord** colorés et informatifs
- **Feed temps réel** mis à jour automatiquement
- **Détection de doublons** avec alertes

### 📊 Statistiques Avancées
- Répartition des archétypes
- Top contributeurs
- Métriques de performance
- Historique des scouts

## 🏗️ Architecture Technique

### Stack Technologique
```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│  Discord Users  │────▶│  Scooty      │────▶│   Supabase   │
│   /scout cmd    │     │  (Node.js)   │     │  (Postgres)  │
└─────────────────┘     └──────┬───────┘     └──────┬───────┘
                               │                      │
                               ▼                      ▼
                        ┌──────────────┐      ┌──────────────┐
                        │ Live Embed   │      │   Redis      │
                        │ (in Discord) │      │   (Cache)    │
                        └──────────────┘      └──────────────┘
```

### Composants
- **Bot** : Discord.js v14 + TypeScript
- **Base de données** : Supabase (PostgreSQL + Realtime)
- **Cache** : Redis pour auto-complétion rapide
- **Hébergement** : Fly.io (gratuit au départ)
- **Monitoring** : UptimeRobot + logs Discord

## 🛠️ Installation & Déploiement

### Prérequis
- Node.js 18+
- Compte Discord Developer
- Compte Supabase (gratuit)
- Compte Fly.io (gratuit)

### 1. Cloner le Repository
```bash
git clone https://github.com/gbordes77/Scooty.git
cd Scooty
```

### 2. Installer les Dépendances
```bash
npm install
```

### 3. Configuration Discord
1. Aller sur [Discord Developer Portal](https://discord.com/developers/applications)
2. Créer une nouvelle application "MTG Scout Bot"
3. Dans l'onglet "Bot", créer un bot et copier le token
4. Dans "OAuth2 > URL Generator" :
   - Scopes: `bot`, `applications.commands`
   - Permissions: `Send Messages`, `Embed Links`, `Read Message History`
5. Utiliser l'URL générée pour inviter le bot

### 4. Configuration Supabase
1. Créer un projet sur [Supabase](https://supabase.com)
2. Exécuter le script SQL dans `supabase/schema.sql`
3. Copier l'URL et la clé anonyme

### 5. Variables d'Environnement
Créer un fichier `.env` basé sur `env.example` :
```bash
# Discord
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
GUILD_ID=your_guild_id
LIVE_CHANNEL_ID=channel_id_for_live_feed
LIVE_MESSAGE_ID=message_id_to_edit

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key

# Redis (optionnel)
REDIS_URL=redis://localhost:6379
```

### 6. Déploiement Automatique
```bash
# Rendre le script exécutable
chmod +x deploy.sh

# Déployer
./deploy.sh
```

### 7. Déploiement Manuel
```bash
# Build
npm run build

# Tests
npm test

# Déployer sur Fly.io
flyctl launch --name mtg-scout-bot --region cdg
flyctl secrets set DISCORD_TOKEN=your_token
flyctl secrets set SUPABASE_URL=your_url
flyctl secrets set SUPABASE_ANON_KEY=your_key
flyctl deploy
```

## 📖 Guide d'Utilisation

### Pour les Joueurs

#### 🎯 Commande `/scout`
```
/scout opponent:Jace123 archetype:Jeskai Control comment:4 teferi, 2 narset
```

**Ce qui se passe :**
1. En tapant "Jace", vous verrez si déjà scouté
2. Si oui : "⚠️ Jace123 - VU: Jeskai (par Loupy)"
3. Votre scout est ajouté instantanément
4. L'équipe voit l'info dans #scout-live

#### 🔍 Vérifier un Adversaire
```
/check name:KB
```
Affiche tous les scouts sur les adversaires commençant par "KB"

#### 📊 Voir les Statistiques
```
/stats
```
Affiche la répartition des archétypes du tournoi

### Pour l'Équipe

#### Workflow Type en Tournoi
1. **Round 1 - Discovery** : Chacun scout son adversaire R1
2. **Round 2+ - Intelligence** : Check ton prochain adversaire avant la ronde
3. **Between rounds** : Consulter #scout-live pour les trends

### Tips & Tricks
- **Soyez précis** : "4 Teferi, 2 Narset, pas vu de Dovin"
- **Utilisez les archétypes standards** : Facilite les stats
- **Scout même les re-matchs** : L'adversaire peut avoir changé de deck
- **Profitez de l'auto-complétion** : 3-4 lettres suffisent généralement

## 🔧 Configuration Discord

### Channels Recommandés
```
📁 TOURNAMENT TOOLS
├── 📢 scout-announcements
├── 🔴 scout-live         # Message épinglé ici
├── 📊 scout-stats
└── 🔧 scout-admin        # Logs/debug
```

### Rôles
- `@Scout Master` : Peut gérer les archétypes
- `@Competitor` : Peut utiliser /scout
- `@Scout Veteran` : Badge après 50 scouts

## 📊 Métriques de Performance

### Objectifs SMART
- ✅ **Bot Discord live ≤ 14 jours** : 6 slash cmd stables, p95 latence < 250 ms
- ✅ **BDD Supabase prête ≤ 7 jours** : 3 tables, RLS active
- ✅ **CI/CD GitHub Actions → Fly.io** : build < 5 min, rollback instant, uptime ≥ 99%
- ✅ **Observabilité ≤ 30 jours** : logs JSON + métriques CPU/RAM affichées Grafana

### KPIs Cibles
- Temps moyen /scout : <5 secondes
- Taux de doublons : <5%
- Scouts par tournoi : >100
- Satisfaction utilisateur : >4.5/5

## 🧪 Tests

### Exécuter les Tests
```bash
# Tests unitaires
npm test

# Tests avec coverage
npm run test:coverage

# Tests en mode watch
npm run test:watch
```

### Structure des Tests
```
src/__tests__/
├── scout.test.ts      # Tests commande scout
├── database.test.ts   # Tests service DB
├── cache.test.ts      # Tests service cache
└── setup.ts          # Configuration tests
```

## 🔍 Monitoring & Observabilité

### Logs
- **Format** : JSON structuré avec Winston
- **Niveaux** : error, warn, info, debug
- **Rotation** : Automatique par taille/date

### Métriques
- **Uptime** : UptimeRobot monitoring
- **Performance** : Latence des commandes
- **Utilisation** : Nombre de scouts/jour

### Alertes
- Bot offline → Discord webhook
- Erreurs critiques → Admin channel
- Performance dégradée → Métriques

## 🚀 Roadmap

### Version 1.1 (Q2 2024)
- [ ] Intégration MTGMelee pour pairings auto
- [ ] Prédictions matchup via ML
- [ ] Dashboard web avec graphiques

### Version 1.2 (Q3 2024)
- [ ] Multi-serveur pour plusieurs teams
- [ ] API REST pour intégrations externes
- [ ] Export données avancé (CSV, JSON)

### Version 2.0 (Q4 2024)
- [ ] Application mobile React Native
- [ ] Intégration avec d'autres jeux de cartes
- [ ] Système de récompenses et gamification

## 🤝 Contribution

### Comment Contribuer
1. Fork le repository
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

### Standards de Code
- **TypeScript** strict mode
- **ESLint** pour le linting
- **Prettier** pour le formatting
- **Tests unitaires** obligatoires
- **Documentation** en français

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 📞 Support

- **Bug report** : [GitHub Issues](https://github.com/gbordes77/Scooty/issues)
- **Feature request** : [GitHub Discussions](https://github.com/gbordes77/Scooty/discussions)
- **Documentation** : [Wiki](https://github.com/gbordes77/Scooty/wiki)
- **Contact** : guillaume.bordes@example.com

## 🙏 Remerciements

- **Discord.js** pour l'API Discord
- **Supabase** pour la base de données
- **Fly.io** pour l'hébergement
- **La communauté MTG** pour les retours et suggestions

---

**🎯 Scooty** - Optimisez votre scouting, maximisez vos chances de victoire ! 