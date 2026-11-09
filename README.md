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
- **Dedicated Folder Selection**:
  - **Google Drive Folder Picker**: Select any folder inside your Drive interactively.
  - **Folder ID / URL Entry**: Alternatively, paste the Google Drive URL (e.g. `https://drive.google.com/drive/folders/1aBcDe...`) or folder ID directly.
  - **Single Folder Isolation**: The app operates **strictly inside this selected folder**. Google blocks the app from reading or listing any other folders or documents in your Google Drive.
- **Receipts & Documents Explorer**: Upload payment slips, PDF invoices, and photos directly to the folder.
- **Offline / Local Mode Fallback**: If not signed in, test and use the application immediately using browser LocalStorage, and sync seamlessly once signed in.

### 5. 📜 Historical Notes Archive & Batch Markdown Importer (since 2018-03-07)
- **Batch Apple Notes Importer**: Import batches of notes (e.g. 171 Apple Notes converted to markdown):
  - Automatically parses note titles, dates (dating back to `2018-03-07`), checklist items, and tags.
  - Extracts open checklists (`- [ ]`) into your active To-Do list.
  - Optionally uploads the markdown files into an `import/` subfolder in your Google Drive.
- **Searchable Timeline**: Instant search across notes by keywords, tags (`#living`, `#milestone`), and chronological order.

---

## ⚙️ Google Cloud OAuth Setup (For `kreier.github.io/todo`)

To sign in with your Google Account and connect your Google Drive:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create or select a Google Cloud project (e.g., `Kreier-Apps`).
3. Under **APIs & Services > Library**, enable:
   - **Google Drive API**
4. Under **APIs & Services > OAuth consent screen**:
   - Choose **External** (or Internal for Google Workspace).
   - Click **Add or remove scopes**:
     - ❌ **DO NOT select `.../auth/drive`** (that requests full access to your whole Google Drive!).
     - ✅ **DO select `https://www.googleapis.com/auth/drive.file`**: This restricts the app so Google grants access **ONLY to files and folders created by this app** (e.g. its dedicated `Kreier-ToDo` folder). Google blocks the app from accessing, listing, or viewing any of your other Drive files, personal folders, or documents!
     - Add `.../auth/userinfo.profile` and `.../auth/userinfo.email`.
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
