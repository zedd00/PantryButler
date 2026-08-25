# 🍽️ PantryButler

**Your comprehensive kitchen management companion.**

PantryButler is a self-hosted kitchen management application that brings together recipe management, pantry inventory, meal planning, grocery lists, and nutrition tracking in one clean, modern web app. Plan meals, shop smarter, and never lose a recipe again.

🌐 **Public instance:** a hosted instance is available at [https://pantrybutler.mythologic.al](https://pantrybutler.mythologic.al) — try it instantly without installing anything, or self-host your own using the steps below.

---

## ✨ Highlights

- 🧑‍🍳 **Recipes** — Create, edit, tag, and organize recipes in folders. Import from URLs or [Cooklang](https://cooklang.org/) files, export to Cooklang, and share via public links.
- 🦊 **Browser Extension** — The Firefox add-on **PantryButler Cooklang Export** captures recipes from any website and pushes them to your Pantry Butler instance, or downloads them as Cooklang `.cook` files. See [`firefox-cook-export/`](firefox-cook-export/).
- 🥫 **Pantry & Inventory** — Track quantities, locations, expiration dates, and prices. Build a visual 2D kitchen layout with drag-and-drop cabinets, appliances, and shelves.
- 🗓️ **Meal Planning** — Plan meals across 7, 14, or 30-day calendars. Schedule breakfast, lunch, dinner, and snacks; link recipes to meal slots.
- 🛒 **Grocery Lists** — Generate shopping lists from meals and recipes, categorize items, convert units, and push purchases back into your pantry.
- 🥗 **Nutrition** — 5,302-ingredient database, automatic matching, FDA-style nutrition facts labels, and per-meal/per-serving costs.
- 💶 **Cost Tracking** — Record prices, compute per-ingredient, per-serving, and per-meal costs, and see grocery list totals.
- 🌍 **7 Languages** — English, Spanish, French, Italian, Chinese, Hindi, and Albanian.
- 👨‍👩‍👧 **Multi-instance & Sharing** — Family, team, or personal kitchens with role-based permissions (admin / member / viewer) and recipe sharing between instances.

---

## 🚀 Quick Start (Docker — recommended)

The fastest way to run PantryButler is the one-command Docker setup. It builds the app and database containers, generates secure secrets, waits for readiness, and handles first-run setup automatically (on first boot it seeds the nutrition data and creates the initial admin account).

> **Prerequisites:**
> - **Docker** — Engine + Compose v2. On desktop, [Docker Desktop](https://www.docker.com/products/docker-desktop/) includes both; on Linux install the `docker` engine and the `docker-compose` plugin.
> - **Git** — used to clone the repo and by the launchers' automatic update (`git pull --ff-only`) on each run.
> - **curl** — used by the launchers for health checks and first-run admin creation.
> - **openssl** — used on macOS/Linux to generate secure secrets (JWT/DB). Windows PowerShell generates these natively, so openssl isn't required there.

### 🍎 macOS

```bash
# Download or clone the project, then from the project root:
./start-mac.sh
```

### 🐧 Linux

```bash
# Download or clone the project, then from the project root:
./docker/start-standalone.sh
```

### 🪟 Windows

```powershell
# In PowerShell, from the project root:
.\start-windows.ps1
```

Or double-click **`start-windows.bat`**.

### What happens on first run

1. A `docker/.env.2container` environment file is created (from the committed `docker/.env.2container.example` template) with a freshly generated `JWT_SECRET`. The file is gitignored — never commit it.
2. Containers are built and started (project **`PantryButler`**: `PantryButler-db-1`, `PantryButler-pantrybutler-1`).
3. The app waits until `http://localhost:3000/api/health` responds, then prints the setup summary.
4. Open **http://localhost:3000** and sign in. All three launchers automatically seed the nutrition data and create the initial admin account on first boot (email `admin@pantrybutler.local`); a secure random password is generated and printed in the terminal.

### Handy options

| Option | macOS | Linux | Windows |
|---|---|---|---|
| Enable admin pages (superadmin-only) | `./start-mac.sh --enable-admin-features` | `./docker/start-standalone.sh --enable-admin-features` | `.\start-windows.ps1 -EnableAdminFeatures` |
| Wipe database volume (destructive) | `./start-mac.sh --reset-db` | `docker compose -p PantryButler down -v` | `.\start-windows.ps1 -ResetDb` |
| Container status | `docker compose -p PantryButler ps` | same | same |
| Stream logs | `docker compose -p PantryButler logs -f` | same | same |
| Skip GitHub auto-update (local testing) | `./start-mac.sh --noupdate` | `./docker/start-standalone.sh --noupdate` | `.\start-windows.ps1 -NoUpdate` |
| Set public URL for email links | `./start-mac.sh --url https://mythologic.al` | `./docker/start-standalone.sh --url https://mythologic.al` | `.\start-windows.ps1 -Url https://mythologic.al` |

> **Auto-update:** on every run the launchers run `git pull --ff-only` to fetch the latest version from [github.com/zedd00/PantryButler](https://github.com/zedd00/PantryButler). Pass `--noupdate` (macOS/Linux) or `-NoUpdate` (Windows) to skip the pull — handy when testing local changes before pushing.

> **Admin features & email verification:** with `--enable-admin-features`, new instance creators must verify their email before signing in (override with `REQUIRE_EMAIL_VERIFICATION=false`). Emails are sent via SMTP — configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM` and `SMTP_SECURE` in `docker/.env.2container`, or set them later from the Admin → Configuration page. Without an SMTP host, verification links are logged to the server console instead of being delivered.

> **Public URL:** on a deployment reached from outside localhost, set this to your domain (e.g. `https://pantrybutler.example.com`) so verification/notification emails and the **browser-extension OAuth flow** use absolute links instead of `http://localhost:3000`. It is also used as the **CORS origin** — the login/consent redirects the Firefox extension opens must point here, not localhost. Three equivalent ways:
> - Launcher flag (prompted interactively when run in a terminal): `./start-mac.sh --url https://pantrybutler.mythologic.al`, `./docker/start-standalone.sh --url https://pantrybutler.mythologic.al`, or `.\start-windows.ps1 -Url https://pantrybutler.mythologic.al`. The value is saved to `docker/.env.2container` as `APP_URL`.
> - Set `APP_URL=https://pantrybutler.mythologic.al` directly in `docker/.env.2container`.
> - Any time after first boot, from **Admin → Configuration → Public URL** (this value overrides `APP_URL`).
>
> If unset, the server falls back to `CORS_ORIGIN`, then `localhost`. When testing locally, if a verification email doesn't arrive, check the server console for the logged link.

> **Production note:** change `POSTGRES_PASSWORD` in `docker/.env.2container` before exposing PantryButler beyond localhost, and set strong credentials in the setup wizard.
---

## 🧑‍💻 Development Setup

### Requirements

- **Node.js ≥ 20** and **npm ≥ 10** (verify: `node -v`, `npm -v`)
- **PostgreSQL 16** for local backend development

### Install

| Step | Command |
|---|---|
| Frontend dependencies (root) | `npm install` |
| Backend dependencies | `npm run install:server` |
| Start backend dev server | `npm run dev:server` |
| Type-check + lint + rule checks | `npm run lint` |
| Validate SQL queries offline | `npm run test:db` |

The backend runs on Hono (TypeScript) against PostgreSQL. See `docker-compose.yml` for the full production stack configuration.

### Nutrition data on new deployments

The `nutrition_foods` table contains **5,302 food items**. For new deployments the data is seeded automatically from `setup/nutrition_foods.json`:

- **Local dev**: complete the `/setup` wizard — it reads `setup/nutrition_foods.json` and seeds via `POST /api/setup/seed-nutrition`.
- **Docker**: the startup scripts seed automatically on first boot (the `setup/` folder is baked into the image by `docker/Dockerfile`).

The server locates the seed file through the `SETUP_DIR` environment variable, which defaults to the repo-root `setup/` directory (resolved from the server build output as `server/dist/utils/../../../setup`). Docker deployments set it explicitly to `/app/setup`.

> ⚠️ **Security**: the Setup page and `/api/setup/*` bootstrap endpoints are only meant for initial deployment. Once the first superadmin exists they lock themselves down (`create-admin` refuses, seeding requires superadmin), but keep the instance unreachable from untrusted networks during first boot.

See [docs/NUTRITION.md](docs/NUTRITION.md) for details on the database and calculation logic.

---

## 🔐 Security

This project takes security seriously.

- All secrets flow through environment variables — no hardcoded credentials in source.
- The startup scripts generate a random 64-char `JWT_SECRET` and refuse to run with the placeholder.
- The server refuses to boot with an unset or known-insecure `JWT_SECRET`.
- Cross-instance access is enforced with `canAccessInstance` / `canEditInstance` checks; API tokens are scoped per resource; rate limiting is keyed on the socket peer (spoofed `X-Forwarded-For` is ignored unless `TRUSTED_PROXIES` is configured).
- File uploads are content-validated (magic bytes); the image proxy blocks private/loopback ranges and serves raster-only content.
- External embeds sanitize every field.

**Before deploying or contributing:**
```bash
npm run lint       # Type-check (tsgo), lint (biome), and rule checks
npm run test:db    # Validate SQL queries against schema (offline)
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + TypeScript + Vite |
| **UI** | shadcn/ui + Tailwind CSS |
| **Backend** | Hono (TypeScript) |
| **Database** | PostgreSQL 16 |
| **State** | React Context + Hooks |
| **Routing** | React Router v7 |
| **i18n** | i18next (7 languages) |
| **Icons** | Lucide React |
| **Dates** | date-fns |
| **Toasts** | Sonner |

---

## 📦 Project Structure

```
├── start-mac.sh              # macOS one-command launcher (setup wizard)
├── start-windows.ps1         # Windows (PowerShell) launcher
├── start-windows.bat         # Windows double-click wrapper
├── docker-compose.yml        # 2-container deployment (db + app), project "PantryButler"
├── docker/
│   ├── Dockerfile            # Multi-stage container build
│   ├── start-standalone.sh   # Linux standalone launcher (auto setup)
│   └── .env.2container.example # Committed env template (placeholder JWT_SECRET)
├── src/                      # Frontend (React + Vite)
│   ├── components/           # Reusable UI, kitchen, recipe, nutrition components
│   ├── contexts/             # React Context providers (Auth, …)
│   ├── pages/                # Route pages + in-app docs (src/pages/docs)
│   ├── api/                  # API client wrappers
│   ├── locales/              # i18next resources (en, es, fr, it, zh, hi, sq)
│   └── i18n/                 # i18next configuration
├── server/                   # Backend (Hono + PostgreSQL)
│   └── src/
│       ├── index.ts          # Server entry point
│       ├── routes/           # API route handlers
│       ├── middleware/       # Auth & other middleware
│       ├── db/               # Schema, migrations, pool
│       └── utils/            # Server utilities
├── public/
│   ├── embed.js              # Standalone public recipe embed widget
│   └── images/
├── setup/                    # Seed data (nutrition_foods.json)
├── docs/                     # NUTRITION, ACCESSIBILITY, …
├── firefox-cook-export/      # Firefox add-on (PantryButler Cooklang Export)
└── tests/                    # SQL query validation, server tests
```

---

## 🦊 Browser Extension

[`firefox-cook-export/`](firefox-cook-export/) is a Firefox (desktop + Android) add-on, **PantryButler Cooklang Export**, that lets you save recipes you find on the web directly into Pantry Butler:

- Click the toolbar icon on any recipe page to auto-extract the title, ingredients, steps, servings, and times.
- Review and edit in the popup, then push to your Pantry Butler instance via a secure OAuth sign-in, or download the recipe as a Cooklang `.cook` file / copy it to your clipboard.
 - Built with `web-ext`; the AMO-listed package is produced by `web-ext build` (output in `firefox-cook-export/web-ext-artifacts/`, gitignored).

 Install it from Firefox Add-ons: [PantryButler Cooklang Export](https://addons.mozilla.org/en-US/firefox/addon/pantrybutler-cooklang-export/).

---

## 📚 Documentation

| Doc | What it covers |
|---|---|
| [docs/NUTRITION.md](docs/NUTRITION.md) | Nutrition database & calculation |
| [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) | Accessibility features |

Full in-app help is also available under the **/docs** routes (Getting Started, Recipes, Meal Planning, Grocery Lists, Pantry & Equipment, Sharing, Instances).

---

## 🤝 Contributing

1. Fork and clone the repository.
2. Install prerequisites (Node.js ≥ 20, PostgreSQL 16).
3. `npm install` and `npm run install:server`.
4. Make your changes and verify with `npm run lint` and `npm run test:db`.
5. Keep every UI string keyed in **all 7 locales** (`src/locales/<lang>/*.json`).

---

## 💖 Support

If PantryButler helps you cook, plan meals, and waste less food, consider supporting its development — it keeps the project self-hosted, ad-free, and open source:

- ☕ **Buy me a coffee:** https://buymeacoffee.com/pantrybutler
- 🌟 **Patreon:** https://www.patreon.com/zedd00/

Thank you! 💛

---

## 📄 License

PantryButler is licensed under the [MIT License](LICENSE).

The bundled nutrition database (`setup/nutrition_foods.json`) remains under the
[Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/) +
Modified Database Contents License (DbCL), as provided by
[OpenNutrition](https://www.opennutrition.app). See the
[Attribution](/attribution) page for full credits.

---

## ❤️ Credits

PantryButler is built on the shoulders of giants — several open-source projects and open data sources power the experience. Full attribution and license details are also on the in-app [Attribution](/attribution) page.

- **[Cooklang](https://cooklang.org)** — *Recipe Markup Language.* A markup language for cooking recipes that provides a simple, human-readable format for writing recipes that can be easily parsed and displayed in various formats. PantryButler uses Cooklang-inspired syntax for ingredient parsing and recipe formatting.

- **[Grid Recipe](https://github.com/mossblaser/recipe_grid)** — *Grid-based Recipe Visualization.* Renders recipes as a grid of steps, with arrows showing the flow of ingredients through each step. PantryButler's grid recipe feature is inspired by this open-source project.

- **[Open Food Facts](https://world.openfoodfacts.org)** — *Open Food Database.* A free, open, collaborative database of food products from around the world, containing information about ingredients, nutrition facts, labels, and more. PantryButler may use Open Food Facts data for ingredient information and nutritional data.
  - License: Open Database License (ODbL)
  - Attribution: © Open Food Facts contributors

- **[OpenNutrition](https://www.opennutrition.app)** — *Comprehensive Nutrition Database.* Provides a comprehensive, open database of food and nutrition information, including detailed nutritional information for thousands of foods (macronutrients, micronutrients, vitamins, and minerals). PantryButler uses OpenNutrition data to display nutritional information for recipes when this feature is enabled.
  - License: Open Database License (ODbL) + Modified Database Contents License (DbCL)
  - Attribution: Data provided by OpenNutrition. Portions of this data incorporate information from Open Food Facts.
  - Requirements: Attribution must be provided on every interface where nutrition data is displayed, in application store listings, on the website, and in legal/about sections.

### License Compliance

PantryButler is committed to complying with all open data licenses. We provide proper attribution to all data sources and respect the terms of their respective licenses.

If you have questions about our use of these data sources or believe we are not in compliance with any license terms, please contact us.