# Smart Office Monitoring System (Hackathon Project)

Welcome to the codebase for the Smart Office Power and Device Monitoring System. This project is structured as a monorepo using **npm workspaces**, allowing 3 team members to collaborate and run the backend, frontend, and Discord bot easily.

## Monorepo Folder Structure

```text
teckathon/
├── package.json               # Root config defining workspaces
├── README.md                  # Main developer guide (this file)
├── backend/                   # Backend Node.js + Express (Express Server, Socket.io, In-memory Store)
│   ├── package.json
│   └── src/
│       ├── index.js           # Server entry point
│       ├── store.js           # In-memory device status state (Single Source of Truth)
│       └── simulator.js       # Background simulation layer (setInterval status toggle)
├── frontend/                  # Web Dashboard React (Vite) + Tailwind CSS + Socket.io-client
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx           # App mounting
│       ├── index.css          # Tailwind base & custom styles
│       └── App.jsx            # Main interactive dashboard layout
├── bot/                       # Discord Bot (discord.js)
│   ├── package.json
│   └── src/
│       └── index.js           # Bot startup & command handlers
└── docs/                      # Schematics and System Diagrams
    ├── system_diagram.md      # High-level architecture and data flow diagram
    └── circuit_schematic.md   # Wokwi wiring guidelines & ESP32 pin mappings
```

## Setup & Running the Project

### Prerequisite
Make sure you have [Node.js (v18+)](https://nodejs.org/) installed.

### 1. Install Dependencies
Run this command from the root directory to install all packages for all workspaces automatically:
```bash
npm install
```

### 2. Run All Workspaces (Concurrent Development)
To start the Backend, React Frontend, and Discord Bot all at once, run:
```bash
npm run dev
```

### 3. Run Workspaces Individually
You can run any workspace by itself using its npm command:
- **Backend Only**: `npm run backend` (runs server on port 3001)
- **Frontend Only**: `npm run frontend` (runs React/Vite dev server on port 5173)
- **Discord Bot Only**: `npm run bot` (runs bot client)

---

## Technical Specifications (15 Devices Total)

The office has 3 rooms: **Drawing Room**, **Work Room 1**, and **Work Room 2**. Each room has **2 fans** and **3 lights** (5 devices per room, 15 devices total):
- **Drawing Room**: Fan 1, Fan 2, Light 1, Light 2, Light 3
- **Work Room 1**: Fan 1, Fan 2, Light 1, Light 2, Light 3
- **Work Room 2**: Fan 1, Fan 2, Light 1, Light 2, Light 3

### Core Components Summary

1. **Backend**: Node.js + Express + Socket.io. Includes a simulator running on a interval timer toggling device states and broadcasting to Socket.io clients.
2. **Frontend Dashboard**: React + Vite + Tailwind CSS. Connects to Backend's Socket.io instance for real-time live data updates, rendering a top-view floor plan showing active devices.
3. **Discord Bot**: discord.js integration to let users interactively run queries (`!status`, `!room <name>`, `!usage`) from a Discord server, reading data from the backend APIs.
