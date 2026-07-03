# High-Level System Architecture Diagram

As requested by the problem statement rules, **do not use Mermaid** to render system diagrams in the final delivery. You can draw the diagram manually or compile it in diagramming tools like Figma, Excalidraw, or draw.io. 

Below is the ASCII block mapping and detailed description of the architecture and data flow to help you draft your system diagram.

---

## 1. System Architecture Layout

```text
+-------------------------------------------------------------------------+
|                         Simulated Device Layer                          |
|             (15 Devices: 2 Fans & 3 Lights per room across 3 rooms)      |
+-------------------------------------------------------------------------+
                                     |
                                     | Status toggles / readings
                                     v
+-------------------------------------------------------------------------+
|                            Backend Node.js                              |
|   +-----------------------------------------------------------------+   |
|   |                   In-Memory Data Store                          |   |
|   |         - Current Device States (ON/OFF, Wattage)               |   |
|   |         - Active System Alerts (Anomaly Log)                    |   |
|   |         - Strict Users Dataset (Tanvir, Nafisa)                 |   |
|   +-----------------------------------------------------------------+   |
|                                    |                                    |
|             +----------------------+----------------------+             |
|             |                                             |             |
|             v                                             v             |
|     Express REST API                               Socket.io Server     |
|   (GET /api, POST override)                    (Real-time broadcasts)   |
+-------------+---------------------------------------------+-------------+
              |                                             |
     HTTP     |                                   WS        |
     Request  |                                   Protocol  |
              v                                             v
+----------------------------+              +-----------------------------+
|        Discord Bot         |              |        Web Dashboard        |
|    - User queries commands |              |        React / Vite         |
|      (!status, !usage, etc)|              |   - Live Floor Plan view    |
|    - Listens to WS alerts  |              |   - Real-time power charts  |
|      and pushes warnings   |              |   - Device manual toggle    |
+----------------------------+              +-----------------------------+
              ^                                             ^
              | Read/Write                                  | Control/View
              |                                             |
      Discord User/Admin                            Office Admin Web User
```

---

## 2. Information Data Flow Steps

### Flow A: Real-Time State Change & Web Update
1. **Trigger**: The **Simulated Device Layer** inside the backend (via a `setInterval` cron) changes a device state (e.g. Work Room 1 Light 2 goes from `OFF` to `ON`).
2. **Store Update**: The backend updates the database/in-memory store with the new state, wattage, and new `lastChanged` timestamp.
3. **Socket Broadcast**: The Socket.io server instantly broadcasts a `"device_update"` event payload containing the updated device object and total power consumption.
4. **UI Render**: The React Web Dashboard (connected via `socket.io-client`) receives the event, updates its React state, and triggers a re-render. The floor plan immediately updates (the fan begins spinning, or the light glows) without page refresh.

### Flow B: Proactive Alerting
1. **Trigger**: A device is turned ON outside office hours (before 9:00 AM or after 5:00 PM).
2. **Alert Logged**: The backend simulator identifies the anomaly, writes an alert record to the store, and dispatches an `"alert_added"` socket broadcast.
3. **Push to Discord**: The Discord Bot, which keeps a live WebSocket connection to the backend, receives `"alert_added"`.
4. **Notification**: The bot parses the message and posts a warning embed directly into the designated Discord admin channel.

### Flow C: Discord On-Demand Query
1. **Trigger**: An administrator posts a command like `!status` or `!usage` in Discord.
2. **Fetch**: The Discord bot catches the command and executes a REST call (`GET /api/devices` or `/api/usage`) to the backend.
3. **Format**: The bot extracts raw JSON and formats a friendly, conversational reply (e.g., mentioning which room has active loads).
4. **Response**: The bot replies to the Discord user.
