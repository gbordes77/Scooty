# Scooty — Runbook Opérationnel

## Environnements
- Dev: `npm run dev` (ts-node)
- Prod: Fly.io (Node 18+, build `npm run build`, start `node dist/bot.js`)

## Démarrage local (dev)
```bash
cp .env.example .env # renseigner secrets
npm ci
npm run build
npm run dev
```
Checklist démarrage:
- ✅ `DISCORD_TOKEN` valide et permissions bot OK
- ✅ Connexions Redis/Supabase opérationnelles
- ✅ Commandes slash visibles dans le serveur cible

## Déploiement (Fly.io)
```bash
npm ci && npm run build
fly deploy --build-arg NODE_VERSION=18
fly secrets set \
  DISCORD_TOKEN=... DISCORD_CLIENT_ID=... DISCORD_GUILD_ID=... \
  SUPABASE_URL=... SUPABASE_ANON_KEY=... \
  REDIS_URL=...
```
Post-déploiement:
- `fly status`, `fly logs` sans erreurs
- Bot en ligne, commandes répondent

## Gestion des secrets
- Stockage: `fly secrets`
- Rotation: planifier tous les 90 jours
- Jamais committer `.env`

## Healthchecks & Observabilité
- Health: commande interne `ping` (latence < 1s)
- Logs: Winston JSON → stdout (`fly logs`)
- Métriques (optionnel): exporter compteurs dans Redis/Prometheus gateway

## Rollback
- Identifier version stable: `fly releases`
- Revenir en arrière: `fly deploy --image <image_id>`
- Vérifier commandes et événements Discord

## Incidents & Playbooks
- Rate limiting Discord (HTTP 429)
  - Activer backoff exponentiel + jitter
  - Token bucket Redis par user/commande
  - Baisser concurrence et regrouper appels
- Panne Redis
  - Basculer en mode dégradé sans cache
  - Alertes: reconnections exponentielles
- Erreurs Supabase
  - Retry idempotent (3 tentatives)
  - Circuit breaker si taux d’échec élevé
- Permissions Discord invalides
  - Revalider intents et scopes de l’application
  - Réenregistrer les commandes slash

## SLO / SLI (cibles)
- Dispo bot: ≥ 99.5%
- Temps de réponse commandes: p95 < 1.5s
- Taux d’échec commandes: < 1%

## Vérification après réinstallation
1. `npm ci` + `npm run build`
2. Redis accessible et authentifié
3. Supabase URL/clé active (requête simple OK)
4. `DISCORD_TOKEN` valide (login sans erreur)
5. Commandes slash enregistrées (visible en 5-10 min)
6. Test commandes: `ping`, 1 commande métier
7. Logs sans erreurs

## Tâches planifiées (cron)
- Vérifier déclenchements et idempotence
- Logger début/fin + durée + erreurs

## Contacts & On-call
- Owner: @Guillaume
- Escalade: redéploiement puis rollback si non résolu en 30 min
