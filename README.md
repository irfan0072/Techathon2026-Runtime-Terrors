# ⚡ Smart Office Power & Device Monitoring System
### 🏆 Techathon Nationals 2026 Submission by Team **Runtime Terrors**

Welcome to the codebase for the **Smart Office Power and Device Monitoring System**. This project is structured as a monorepo using **npm workspaces**, integrating a real-time responsive web dashboard, a background simulator layer, a Node.js API server, and a grounded AI Discord Bot.

---

## 🔗 Live Project Deployments & Deliverables

* **Live Web Dashboard (Frontend)**: [teckathon-dashboard.onrender.com](https://teckathon-dashboard.onrender.com)
* **Live Socket.io API (Backend)**: [teckathon-backend.onrender.com](https://teckathon-backend.onrender.com)
* **Discord Bot Service**: [teckathon-bot.onrender.com](https://teckathon-bot.onrender.com)
* **Discord Server Invite Link**: [discord.gg/euFt99ETT](https://discord.gg/euFt99ETT)
* **Tinkercad Circuits Link**: [Tinkercad Hardware Board Simulation](https://www.tinkercad.com/things/einAtGABmEy/editel?returnTo=%2Fdashboard&sharecode=9LEbM-ddvtuEevOx3uDI34FDEFHuSLfaDcYNqvMKAhw)

---

## 👥 Meet Team Runtime Terrors
* **Irfan** (Team Lead) – Web Dashboard, Real-time APIs, & Database Engineering
* **Farhad** – Hardware Circuit Schematics & Tinkercad Simulation
* **Tanjimul** – Discord Bot, Gemini NLU Logic, & AI Systems
* **Shanto** – Software Quality Assurance (SQA) & System Verification

---

## 📖 Project Documentation

For in-depth explanations of the system design, hardware schematics, and codebase models, refer to the following guides:
* **[System Diagram & Data Flows](docs/system_diagram.md)**: Visual architecture flow charts and information mappings.
* **[Circuit Wiring Schematic](docs/circuit_schematic.md)**: Physical Arduino pins, relay boards, slide switch overrides, and safety transistor driver schematics.
* **[Software Architecture & Schemas](docs/architecture.md)**: Codebase modules, Express REST API routes, and in-memory store models.

---

## 📦 Monorepo Folder Structure

```text
teckathon/
├── package.json                 # Monorepo configuration defining workspaces
├── README.md                    # Main documentation & setup guide (this file)
├── backend/                     # Express API Server, Socket.io, & In-Memory Store
│   ├── package.json
│   └── src/
│       ├── index.js             # HTTP/WS Server endpoints & controllers
│       ├── store.js             # State storage (single source of truth)
│       └── simulator.js         # Background rule-engine & state drift simulator
├── frontend/                    # Web Dashboard (React, Tailwind CSS, Vite)
│   ├── package.json
│   ├── vite.config.js
│   ├── src/
│   │   ├── main.jsx             # Mounting script
│   │   ├── index.css            # Base design tokens & animations
│   │   └── App.jsx              # Responsive visual panels & dashboard controls
├── bot/                         # Discord Bot Workspace (discord.js)
│   ├── package.json
│   └── src/
│       └── index.js             # Bot client, prefix commands, & AI controllers
└── docs/                        # Specifications & Engineering References
    ├── system_diagram.md        # Data flow mapping and ASCII conceptual diagram
    └── circuit_schematic.md     # ESP32 pin mappings, relay safety, & wiring list
```

---

## 🌟 Core Project Features

### 1. Web Dashboard
* **Dynamic Analytics Grid**: Cards monitoring real-time power demand (Watts), average daily usage (kWh), active devices count, and warning logs.
* **Interactive Floor Plan (Top View)**: Responsive glassmorphic layout displaying 15 devices across 3 rooms. Spins fan SVGs when active, glows lights neon-yellow, and supports click-to-toggle manual overrides.
* **Custom SVG Load Analysis Chart**: Interactive time-series area chart with glowing gradients. Enables filtering by room/device group (fans vs. lights) and supports viewing a **Last 24 Hours** hourly peak-trough curve.
* **Simulator Control Switch**: Enable/disable the background simulator in settings to allow 100% manual control during presentations.
* **Secure Login Gateway**: Lock screen overlay preventing random access. Demo credentials are pre-filled (`admin@smartoffice.com` / `adminpassword123`) for grading ease. *(Note: Storing credentials in frontend client source is done intentionally to simplify grading access for the Techathon evaluation team, and would be moved to secure backend cookies/sessions in a production deploy).*
* **Multi-Client State Sync & Cooldowns**: Forces alerts lists to sync across tabs via socket signals, incorporating a 20-second clear cooldown to prevent instant notification spam.

### 2. Grounded Discord Bot
* **Command Queries**: Prefix controls for `!status` (overall status), `!room <room_name>` (room diagnostics), and `!usage` (power consumption analytics).
* **Grounded Natural Language Assistant**: Users can chat naturally with the bot (supports Banglish and Bengali). The bot resolves room/device mappings and queries live backend statistics without hallucinating.
* **Conversational Overrides**: Chatting naturally (e.g. *"turn off work room 1 lights"*) parses commands via Gemini, updates device states, and returns the modified room's live status.
* **Humanized Warnings**: Dynamic alerts (e.g. after-hours device left ON) are rephrased conversationally (e.g. *"⚠️ Hey! Work Room 2 still has 2 fans and 3 lights ON and it's 10 PM. Did someone forget to leave?"*).

---

## 🛠️ Setup & Local Installation

### Prerequisites
Make sure you have [Node.js (v18+)](https://nodejs.org/) and `npm` installed.

### 1. Install Workspace Dependencies
From the monorepo root directory, run the following to install dependencies for all workspaces concurrently:
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the `bot/` directory:
```env
DISCORD_TOKEN=your_discord_bot_token
ALERTS_CHANNEL_ID=your_discord_alerts_channel_id
GEMINI_API_KEY=your_google_gemini_api_key
```

### 3. Run the Monorepo Concurrently
Start the Express Backend, React Frontend, and Discord Bot all at once:
```bash
npm run dev
```

### 4. Direct Command Proxies
Alternatively, run individual services from the root:
* **Backend API**: `npm run backend` (Ports: `3001` REST/WebSocket)
* **Vite Dashboard**: `npm run frontend` (Port: `5173` Local Web)
* **Discord Bot client**: `npm run bot`

---

## 🎬 Video Demonstration
* **Project Walkthrough Video (3 Min Max)**: [Watch our Live Demo on YouTube](https://youtu.be/your_placeholder_link) *(Ensure this is updated before submission)*

---

## 🚀 Render Cloud Deployment Guidelines

This monorepo is fully configured for deployment on [Render](https://render.com). Deploy the services using the following parameters:

### 1. Backend Web Service (`teckathon-backend`)
* **Service Type**: Web Service
* **Build Command**: `npm install`
* **Start Command**: `npm run backend`
* **Environment Variables**:
  * `PORT` = `3001`
  * `NODE_ENV` = `production`

### 2. Frontend React Dashboard (`teckathon-dashboard`)
* **Service Type**: Static Site (or Web Service if running with server-side proxy)
* **Build Command**: `cd frontend && npm install && npm run build`
* **Publish Directory**: `frontend/dist`
* **Environment Variables**:
  * `VITE_BACKEND_URL` = `https://teckathon-backend.onrender.com`

### 3. Discord Bot Worker (`teckathon-bot`)
* **Service Type**: Background Worker (or Web Service if keeping port listener active)
* **Build Command**: `npm install`
* **Start Command**: `npm run bot`
* **Environment Variables**:
  * `DISCORD_TOKEN` = `[Your Discord Bot Token]`
  * `ALERTS_CHANNEL_ID` = `[Your Discord Alerts Channel ID]`
  * `GEMINI_API_KEY` = `[Your Google Gemini API Key]`
  * `BACKEND_URL` = `https://teckathon-backend.onrender.com`
