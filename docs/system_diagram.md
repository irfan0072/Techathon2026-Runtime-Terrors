# 🌐 High-Level System Architecture & Data Flow

This document details the software architecture, data flow paths, and communication protocols for the **Smart Office Monitoring System**.

---

## 🔗 Live Deployments Reference
* **Frontend Application**: [teckathon-dashboard.onrender.com](https://teckathon-dashboard.onrender.com)
* **Backend WebSocket/REST Server**: [teckathon-backend.onrender.com](https://teckathon-backend.onrender.com)
* **Discord Bot Instance**: [teckathon-bot.onrender.com](https://teckathon-bot.onrender.com)

---

## 1. System Block Architecture

```text
+-------------------------------------------------------------------------------+
|                           Simulated Device Layer                              |
|           - 15 Devices: 2 Fans and 3 Lights per room across 3 rooms.           |
|           - Modifies status on server triggers and periodic state drifts.     |
+-------------------------------------------------------------------------------+
                                        |
                                        | Status modifications
                                        v
+-------------------------------------------------------------------------------+
|                            Backend Node.js Server                             |
|   +-----------------------------------------------------------------------+   |
|   |                       In-Memory Data Store                            |   |
|   |         - Current Device States (ON/OFF, Wattage)                     |   |
|   |         - Active System Alerts (Anomaly Log)                          |   |
|   |         - Strict Users Dataset (Tanvir, Nafisa)                       |   |
|   +-----------------------------------------------------------------------+   |
|                                       |                                       |
|             +-------------------------+-------------------------+             |
|             |                                                   |             |
|             v                                                   v             |
|     Express REST API                                     Socket.io Server     |
|   (GET /api/devices, /api/usage)                     (Real-time event sync)   |
+-------------+---------------------------------------------------+-------------+
              |                                                   |
              | HTTP (Axios)                                      | WebSocket
              | Requests                                          | Protocol (WS)
              v                                                   v
+------------------------------+                  +-----------------------------+
|         Discord Bot          |                  |        Web Dashboard        |
|       (Node.js Client)       |                  |        (React / Vite)       |
|  - Listens to WS alerts.     |                  |  - Live Floor Plan view.    |
|  - Feeds state to Gemini.    |                  |  - Real-time power charts.  |
|  - Executes user overrides.  |                  |  - Device manual toggle.    |
+------------------------------+                  +-----------------------------+
              ^                                                   ^
              | Read/Write                                        | Control/View
              |                                                   |
      Discord User (Chat)                                 Office Administrator
```

---

## 2. Dynamic Communication Flows

### Flow A: Real-Time State Change & Web Update
1. **Trigger**: An administrator clicks on a light icon in the React floor plan dashboard or a state drift occurs in the simulator.
2. **Socket Emit**: If manually toggled, the React client emits a `toggle_device` event containing the device ID via Socket.io.
3. **Database Write**: The backend store receives the event, verifies status shifts, recalculates the total active power demand, and logs the timestamp.
4. **Socket Broadcast**: The Socket.io server broadcasts a `device_update` event with the updated device payload to **all connected browser instances**.
5. **UI Rendering**: The dashboard on all open browsers catches the event, updates the React state, spins/stops the fan animations, glows/dims the yellow lightbulbs, and plots the new power load coordinates on the time-series chart.

### Flow B: Proactive Alert & Discord Dispatch
1. **Trigger**: A device is turned ON outside office hours (BST: 9 AM to 5 PM) or all 5 devices in a room have been ON simultaneously longer than the configured vacancy timer limit.
2. **Alert Logged**: The backend checks rules, logs a warning/danger alert inside the store, and dispatches an `alert_added` socket event.
3. **Multi-Tab Sync**: All dashboards capture `alert_added`, adding it to the Alerts feed. Clearing alerts logs a sync event `alert_list_sync` to empty out all feeds concurrently.
4. **Discord Broadcast**: The Discord Bot catches `alert_added` over its persistent WebSocket client.
5. **AI Conversationalization**: The bot sends the raw alert message to Gemini 2.5 Flash. Gemini converts it into a highly friendly warning (e.g. *“⚠️ Hey! Drawing Room still has 2 fans ON and it's 11 PM. Did someone forget to leave?”*).
6. **Discord Dispatch**: The bot logs this embed directly into the designated Discord admin channel.

### Flow C: Conversational Commands & Device Controls
1. **Trigger**: The boss types a query or override in the Discord server (e.g., *"turn on drawing room light 1 and turn off work room 1 fan 2"*).
2. **NLU Classification**: The Discord Bot feeds the message to a custom classifier prompt in Gemini 2.5 Flash to parse command actions.
3. **Command Extraction**: Gemini parses the message and returns a standardized JSON action array (e.g. `[{"room": "Drawing Room", "type": "light", "index": 1, "action": "ON"}]`).
4. **Backend REST Call**: The bot iterates through the array, maps the room/device details, and sends a REST `POST /api/devices/:id/toggle` request to the backend.
5. **State Broadcast**: The backend executes the toggle, emits `device_update` to sync the React dashboard, and updates the store.
6. **Conversational Feedback**: The bot fetches the fresh state of the room, asks Gemini to format a friendly summary of the action, and replies back to the Discord user in real-time.
