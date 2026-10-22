# Stella ✦

Hub privé à deux : compteur, constellation de souvenirs, bocal à raisons, wishlist et suivi du cycle.
React + Vite + Tailwind, données dans Supabase derrière un mot de passe unique.

## Architecture

```
Navigateur ──► Hébergement statique (code seul, aucune donnée perso)
          └──► Supabase : Auth (1 compte) · Postgres (RLS) · Storage privé (photos)
```

- **Aucun contenu perso dans le repo** : prénoms, dates, souvenirs, raisons, wishlist et cycle vivent dans Supabase.
- **Accès** : un seul compte Supabase, inscriptions désactivées, toutes les tables en RLS `to authenticated`.
- **Le mot de passe n'est jamais dans le code.** L'email du compte est public (bundle), c'est normal.

## Mise en place (une fois)

### 1. Supabase
1. **SQL Editor** → coller et exécuter `supabase/schema.sql`.
2. **SQL Editor** → exécuter `supabase/seed.sql` (fichier local, non commité : prénoms, date, 8 souvenirs).
3. **Authentication → Sign In / Providers** → désactiver *Allow new users to sign up*.
4. **Authentication → Users → Add user → Create new user** : email `stella.hub@example.com` (ou autre), ton mot de passe, cocher *Auto Confirm User*.
5. **Project Settings → API Keys** : noter l'URL du projet et la clé *publishable* (ou *anon*).

### 2. Variables
Copier `.env.example` en `.env.local` pour le dev, et définir les mêmes valeurs sur l'hébergeur :

| Variable | Valeur |
|---|---|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_KEY` | clé publishable / anon |
| `VITE_LOGIN_EMAIL` | email du compte créé à l'étape 4 |
| `VITE_BASE` | `/` (Vercel) ou `/stella/` (GitHub Pages) |

### 3. Déploiement
- **Vercel** : *Add New Project* → importer `NeatLovin/stella` → framework *Vite* → ajouter les 3 variables `VITE_SUPABASE_*` / `VITE_LOGIN_EMAIL` → *Deploy*. Chaque push sur `main` redéploie.
- **GitHub Pages** (repo public ou GitHub Pro) : *Settings → Pages → Source : GitHub Actions*, puis *Settings → Secrets and variables → Actions → Variables* : ajouter les 3 variables. Le workflow `.github/workflows/deploy.yml` fait le reste. Si tu passes par Vercel, supprime ce workflow.

## Ajouter du contenu

| Quoi | Où |
|---|---|
| Une raison du bocal | Supabase → Table Editor → `reasons` → *Insert row* (colonne `text`) |
| Un souvenir / modifier un texte | Table Editor → `timeline_events` (`icon` = un emoji, `highlight` = étoile dorée) |
| Prénoms, date de mise en couple | Table Editor → `settings` |
| Wishlist, cycle | Directement depuis le site |

Aucun redéploiement nécessaire : c'est visible au prochain chargement.

## Développement

```bash
npm install
npm run demo     # données fictives en mémoire, mot de passe : demo
npm run dev      # avec Supabase (.env.local requis)
npm test         # tests de l'algorithme du cycle
npm run build
```

## Cycle : comment c'est calculé
- Durée du cycle = moyenne des 6 derniers écarts entre débuts de règles (21 à 45 j), sinon 28 j.
- Durée des règles = moyenne des durées saisies, sinon 5 j.
- Ovulation = celle notée dans le cycle en cours, sinon 14 j avant les prochaines règles prévues.
- Phases : règles → folliculaire → ovulation (±1 j) → lutéale → retard.
- Indicatif, pas une méthode de contraception. Logique dans `src/lib/cycle.ts`, tests dans `src/lib/cycle.test.ts`.

## Structure

```
src/
├─ components/  StarrySky (ciel animé), TabBar, BottomSheet, Page, icons
├─ pages/       Login, Home, Timeline, Jar, Wishlist, Cycle
├─ lib/         api.ts (Supabase), demo.ts (données fictives), cycle.ts, dates.ts, image.ts
└─ hooks/       useLoad
supabase/       schema.sql (commité), seed.sql (local uniquement)
```
