# Kreier ToDo

> Organize all things to do — recurring obligations (rent, maintenance, internet), active projects, email queues, and calming long-term productivity statistics with secure Google Drive integration.

**Live Web App:** [https://kreier.github.io/todo](https://kreier.github.io/todo)  
**Historical Inception:** `2018-03-07` (migrated from iCloud Notes)

---

## 🌟 Overview & Architecture

This application operates as a **secure, serverless, client-side dashboard** hosted on GitHub Pages with scheduled backend processing powered by Python and GitHub Actions.

```
┌────────────────────────────────────────────────────────────────────────┐
│             Frontend (Browser at kreier.github.io/todo)                │
├───────────────────────────────────┬────────────────────────────────────┤
│   Public View (Open to Anyone)    │   Private View (Google Authenticated)│
│  • Calming velocity statistics    │  • Monthly Recurring Checks:       │
│  • Monthly tasks (2018 - present) │     - Rent paid confirmation       │
│  • 215+ GitHub Repositories       │     - Building maintenance fee     │
│  • Email response counters        │     - High-speed internet          │
│  • Public milestone timeline      │  • Active priority to-do list      │
│                                   │  • Open email response queue       │
│                                   │  • Projects needing updates        │
│                                   │  • Google Drive subfolder explorer │
│                                   │  • Historical notes (from 2018)    │
└─────────────────▲─────────────────┴──────────────────▲─────────────────┘
                  │                                    │
                  │ Fetch public_stats.json            │ Direct Drive API v3
                  │                                    │ (Bearer Token)
┌─────────────────┴─────────────────┐ ┌────────────────┴─────────────────┐
│     GitHub Actions & Python       │ │       Google Drive Subfolder     │
│  • scripts/update_stats.py        │ │  • Folder: "Kreier-ToDo"         │
│  • Daily cron scheduled update    │ │  • kreier_todo_data.json         │
│  • Syncs GitHub repos & metrics   │ │  • Rent slips, invoices, receipts│
└───────────────────────────────────┘ └──────────────────────────────────┘
```

---

## 🚀 Key Features

### 1. 📅 Recurring Checks (Bills & Chores)
- Track monthly recurring obligations:
  - **Apartment Rent** (due day 1)
  - **Building Maintenance Fee** (due day 5)
  - **Internet & Fiber** (due day 15)
  - **Electricity & Utilities** (due day 20)
  - Add custom recurring tasks with custom categories, amounts, payees, and due dates.
- Interactive month-by-month picker (e.g., November 2026, October 2026, etc.).
- One-click toggle between **Paid** and **Pending**, with recorded payment dates, reference numbers, and receipt notes.
- Automatic overdue highlighting for current month obligations.

### 2. 📊 Calming Public Statistics
- **Monthly Tasks Finished Timeline**: Continuous interactive Chart.js visualization dating back to the first note on `2018-03-07`.
- **Velocity Metrics**: Total finished items, average tasks completed per month, public repositories, and monthly email response rate.
- **GitHub Projects Showcase**: Live cards for active repositories with star counts and update timestamps.
- **Category Breakdown**: Proportional distribution across bills, code projects, correspondence, and personal chores.

### 3. 📥 Email Queue & Projects Needing Updates
- **Email Response Queue**: Interactive counter of open emails currently waiting to be answered, with quick `+` / `−` adjustments and urgent reply notes.
- **Project Maintenance Flags**: Mark projects that need attention or dependency bumps with one-click `⚠️ Needs Update` / `✓ Up to date` status toggles.

### 4. 🔒 Google Drive Integration (Zero-Server Privacy)
- **Browser-Side Authentication**: Uses Google Identity Services (GIS) OAuth 2.0 with the privacy-friendly `https://www.googleapis.com/auth/drive.file` scope.
- **Dedicated Folder (`Kreier-ToDo`)**: Files are stored directly in your personal Google Drive and never touch external servers or public git trees.
- **Receipts & Documents Explorer**: Upload payment slips, PDF invoices, and photos directly to Google Drive and view them with one click.
- **Offline / Local Mode Fallback**: If not signed in, you can test and use the application immediately using browser LocalStorage, and sync seamlessly once signed in.

### 5. 📜 Historical Notes Archive (since 2018-03-07)
- Searchable timeline of notes, checklists, and retrospective records dating back to March 2018.
- Filter by tag (e.g. `#icloud`, `#recurring`, `#milestone`).
- Import exported iCloud notes using the included Python parser.

---

## ⚙️ Google Cloud OAuth Setup (For `kreier.github.io/todo`)

To sign in with your Google Account and connect your Google Drive:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create or select a Google Cloud project (e.g., `Kreier-Apps`).
3. Under **APIs & Services > Library**, enable:
   - **Google Drive API**
4. Under **APIs & Services > OAuth consent screen**:
   - Choose **External** (or Internal for Google Workspace).
   - Add scopes: `.../auth/drive.file`, `.../auth/userinfo.profile`, `.../auth/userinfo.email`.
5. Under **APIs & Services > Credentials > Create Credentials**:
   - Select **OAuth Client ID** -> Application type: **Web application**.
   - Under **Authorized JavaScript origins**, add:
     - `https://kreier.github.io`
     - `http://localhost:8000` (for local development)
6. Copy your **Client ID** (e.g., `xxxxxxxx.apps.googleusercontent.com`).
7. Click the **⚙️ Settings** icon in the website header, paste your Client ID, and click **Save Settings**!

---

## 🤖 Backend Automation (GitHub Actions)

- **Workflow**: [`.github/workflows/update-stats.yml`](.github/workflows/update-stats.yml)
- **Script**: [`scripts/update_stats.py`](scripts/update_stats.py)
  - Fetches repository data for `kreier` via GitHub REST API.
  - Recalculates all-time completed task counts and monthly averages.
  - Commits updated metrics to [`data/public_stats.json`](data/public_stats.json).
  - Runs automatically every night at `03:00 UTC` and whenever manually triggered via `workflow_dispatch`.

### Importing Apple iCloud Notes

If you have exported your iCloud notes as text, HTML, or Markdown:

```bash
# Parse exported notes into structured JSON
python3 scripts/import_icloud_notes.py /path/to/iCloudNotes notes_archive.json
```

Then in the web app under **Notes Archive**, click **Import JSON / Notes** to load them.

---

## 💻 Local Development

Run the app locally with Python's built-in HTTP server:

```bash
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
