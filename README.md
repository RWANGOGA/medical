# Steward AMR — Antimicrobial Stewardship for Uganda

[![Deploy Web](https://github.com/RWANGOGA/medical/actions/workflows/deploy-web.yml/badge.svg)](https://github.com/RWANGOGA/medical/actions/workflows/deploy-web.yml)
[![Build APK](https://github.com/RWANGOGA/medical/actions/workflows/build-apk.yml/badge.svg)](https://github.com/RWANGOGA/medical/actions/workflows/build-apk.yml)
[![Deploy API](https://github.com/RWANGOGA/medical/actions/workflows/deploy-api.yml/badge.svg)](https://github.com/RWANGOGA/medical/actions/workflows/deploy-api.yml)

**Steward AMR** is an antimicrobial-resistance (AMR) surveillance and stewardship
platform built for Ugandan hospitals. It runs on the web, as an installable PWA,
and as a native Android app, and it keeps working offline so clinicians in
low-connectivity settings are never blocked.

- 🌐 Web app: https://rwangoga.github.io/medical/
- 📱 Android APK: https://github.com/RWANGOGA/medical/releases/download/apk-latest/medical.apk
- 🔌 API: https://medical-sbit.onrender.com/api/v1
- 📥 Install help: https://rwangoga.github.io/medical/download.html

## Highlights

- **Uganda-first content** — Uganda Clinical Guidelines 2023 first-line therapy,
  WHO priority pathogens, national referral hospitals, districts, common brand
  names, specimen/diagnosis quick-picks, `Africa/Kampala` date formatting.
- **Offline-first** — AsyncStorage response cache, queued writes replayed on
  reconnect, live offline/queue indicators, service worker caching only the app
  shell (never authenticated API traffic).
- **Install anywhere** — persistent "Install app" + direct APK download on every
  page; PWA install prompt; Android APK built in CI via `expo prebuild` +
  Gradle (device ABIs only).
- **Benchmarks** — WHO GLASS, WHONET and EARS-Net alignment; GLASS first-isolate
  rule; AWaRe (Access/Watch/Reserve) stratification; AMC consumption (DDD) and
  age/sex/ward/origin stratification.
- **Clinical decision support** — CDS engine, global AMR model, treatment
  recommendations, audit trail.
- **Stewardship reports** — in-app report (workload, AWaRe, GLASS data quality,
  antibiogram, high-resistance alerts) plus CSV export.
- **Multi-language** — English, Luganda, Swahili via an in-app language switcher.
- **Privacy** — patient/lab data scoped to the caller's hospital plus own records;
  admins see all; per-user offline cache/queue so a second user on a shared
  device can never read the previous user's data.
- **First-run onboarding tour** and friendly empty states throughout.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Expo 57 / React Native, Expo Router, React Query, AsyncStorage |
| Backend | FastAPI, SQLModel, Pydantic, uvicorn |
| Database | Neon (serverless Postgres), psycopg2 |
| CI/CD | GitHub Actions (APK via Gradle, Pages web export, Render API deploy) |
| Hosting | GitHub Pages (web), Render (API), GitHub Releases (APK) |

## Repository layout

```
medical/
├── backend/            # FastAPI app (routers, models, services)
│   ├── app/
│   ├── tests/
│   ├── .env.example
│   └── requirements.txt
├── mobile/             # Expo app (web + Android + iOS)
│   ├── src/
│   │   ├── app/        # file-based routes
│   │   ├── components/ # shared UI (top bar, nav, footer, empty state, tour)
│   │   ├── context/    # auth, theme, assistant, i18n
│   │   ├── features/   # home, publications
│   │   ├── hooks/      # offline, PWA install
│   │   ├── i18n/       # en / lg / sw dictionaries
│   │   ├── services/   # API client, offline cache/queue
│   │   └── constants/  # branding, downloads, Uganda reference data
│   ├── public/         # manifest, service worker, icons, download.html
│   └── app.json
├── .github/workflows/  # build-apk, deploy-web, deploy-api
├── .env.example
└── README.md
```

## Local development

### Backend

```bash
cd backend
cp ../.env.example .env   # then edit DATABASE_URL / JWT_SECRET
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8010
```

Environment variables (see `.env.example`):

- `DATABASE_URL` — Neon (or any Postgres) connection string
- `JWT_SECRET` — required in production
- `CORS_ORIGINS` — comma-separated browser origins
- `GROQ_API_KEY` — optional, for the clinical assistant
- `SEED_DEMO_USERS` / `SEED_*_PASSWORD` — optional demo accounts

### Mobile / web

```bash
cd mobile
npm install
EXPO_PUBLIC_API_URL=http://localhost:8010/api/v1 npx expo start --web --port 8081
```

### Tests

```bash
cd mobile && npx tsc --noEmit && npx jest
cd backend && python -m pytest -q
```

## Deployment

- **Web (GitHub Pages)** — `.github/workflows/deploy-web.yml` runs `expo export --platform web`
  and publishes `dist/` to Pages on every push to `main` touching `mobile/**`.
- **Android APK** — `.github/workflows/build-apk.yml` runs `expo prebuild` + `./gradlew
  assembleRelease` (device ABIs only), uploads an artifact and publishes `medical.apk`
  to the `apk-latest` release. Optional signing via `ANDROID_KEYSTORE_*` secrets.
- **API (Render)** — `.github/workflows/deploy-api.yml` deploys on push to `main`.

## Offline behaviour

- GET responses are cached in AsyncStorage and served when offline.
- Writes made offline are queued and replayed on reconnect (`flushPendingMutations`).
- The service worker caches only the app shell; authenticated API traffic is never
  cached at the HTTP layer.
- A live "Offline · saved data / N queued" indicator is shown in the top bar
  (web) and navigation bar (native).

## Internationalisation

Languages: English (`en`), Luganda (`lg`), Swahili (`sw`). Dictionaries live in
`mobile/src/i18n/`. Add a new locale by creating a dictionary file and registering
it in `mobile/src/i18n/index.ts` and `LOCALES`.

## Security notes

- `.env` / `.env.local` are git-ignored; only `.env.example` (with a placeholder
  password) is committed.
- Rotate the Neon password if it is ever exposed.
- Patient data is scoped to the caller's hospital plus own records; admins see all.

## Licence

Internal project — all rights reserved.