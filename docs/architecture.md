# 🏗️ Codebase Architecture & Data Models

This document details the monorepo design, database schemas, and architectural patterns of the **Smart Office Monitoring System**.

---

## 1. Monorepo Architecture Overview
The project is built as a unified monorepo using **npm workspaces**. This setup isolates dependencies for each tier while allowing sharing of configuration and facilitating unified development scripts.

* **Frontend Layer**: Built using **Vite + React**. Operates purely client-side, communicating with the backend via Socket.io for real-time telemetry and Axios for manual configuration overrides.
* **Backend Layer**: A **Node.js Express** app acting as the database coordinator, REST API provider, WebSocket server, and logic checker.
* **Discord Bot**: An independent **discord.js** process connected via Socket.io to receive telemetry warnings and Axios to perform REST commands.

---

## 2. In-Memory Data Models & Schema (Single Source of Truth)

Because the project runs as a lightweight, low-latency microservice, all states are maintained in a secure, thread-safe in-memory store in `backend/src/store.js`.

### A. Device Schema (`devices`)
Maintains status for all 15 office devices.
```json
{
  "id": "string (unique ID, e.g. drawing_fan_1)",
  "name": "string (readable name, e.g. Fan 1)",
  "type": "string ('fan' | 'light')",
  "room": "string ('Drawing Room' | 'Work Room 1' | 'Work Room 2')",
  "status": "boolean (true = ON, false = OFF)",
  "powerDraw": "number (active wattage draw, e.g. 60 for fan, 15 for light)",
  "lastChanged": "string (ISO 8601 timestamp)"
}
```

### B. Active Alert Schema (`alerts`)
Holds the log of current system anomalies.
```json
{
  "id": "string (unique ID, e.g. alert_17831315)",
  "timestamp": "string (ISO 8601 timestamp)",
  "message": "string (friendly text describing the alert)",
  "severity": "string ('warning' | 'danger')"
}
```

### C. System Settings Schema (`settings`)
Configures threshold variables for rule matching.
```json
{
  "officeStartTime": "string (24h time, default '09:00')",
  "officeEndTime": "string (24h time, default '17:00')",
  "roomAllOnTimeLimit": "string (hh:mm format, default '02:00')",
  "roomTimerEnabled": "boolean (true = check vacancy, false = ignore)",
  "discordOnlyDanger": "boolean (default false)",
  "autoSimulatorEnabled": "boolean (true = simulate drifts, false = manual only)"
}
```

### D. User Schema (Strict Dummy Dataset)
Adheres strictly to the problem statement requirement:
```json
[
  { "name": "Nafisa Rahman", "email": "nafisa.rahman@yahoo.com", "phone": "+8801812345678" },
  { "name": "Tanvir Hossain", "email": "tanvir.hossain@yahoo.com", "phone": "+8801912345678" }
]
```

---

## 3. API Route Design

### REST Endpoints (HTTP)
* `GET /api/devices`: Returns the full JSON array of the 15 devices.
* `POST /api/devices/:id/toggle`: Toggles status of a device. Returns success and the updated device object.
* `GET /api/usage`: Returns live power breakdown (total current Watts, per-room Watt draw, and accumulated daily kWh).
* `GET /api/alerts`: Returns active alert records.
* `POST /api/alerts/clear`: Clears the alerts list and triggers a synchronization event across socket clients.
* `GET /api/users`: Returns the hardcoded Nafisa/Tanvir dataset.
* `GET /api/settings`: Returns current configuration thresholds.
* `POST /api/settings`: Overrides settings variables.
