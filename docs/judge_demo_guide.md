# 👨‍⚖️ Judge Demonstration Guide & Q&A Notes

This document provides a structured walkthrough guide for presenting the **Smart Office Monitoring System** during judging, along with reference answers for potential Q&A questions.

---

## 🔑 Demonstration Credentials
For grading convenience, the frontend dashboard uses a secure gateway overlay pre-configured with the following credentials (also pre-filled automatically on load):
* **Demo Email**: `admin@smartoffice.com`
* **Demo Password**: `adminpassword123`

*Note: In the final presentation, mention to the judges that these credentials are hardcoded and pre-filled solely for their testing convenience.*

---

## 📈 Step-by-Step Demo Script (3-Minute Walkthrough)

### Step 1: Login & Dashboard Overview (45 Seconds)
1. Open [teckathon-dashboard.onrender.com](https://teckathon-dashboard.onrender.com).
2. Click **Log In** (credentials are pre-filled).
3. Point out the top 4 status cards (Power Demand, Average Daily Usage, Active Devices, Warnings).
4. Point out the **Power Load Analysis** time-series chart. Show that it updates dynamically in real-time. Switch the view filter to **Analysis: Last 24 Hours** to show the sinusoidal daily office consumption curve.

### Step 2: Manual Control & Floor Plan (45 Seconds)
1. Scroll down to the **Live Office Floor Plan (Top View)**.
2. Toggle a device ON or OFF by clicking its node on the map (e.g., Drawing Room Fan 1).
3. Show that the fan icon instantly starts spinning (or light icon glows) and the top **Power Demand** card updates immediately without page reload.
4. Go to **Settings** in the header and toggle off **Automated Simulation Mode** to show that you have 100% manual command over all hardware states.

### Step 3: Alerts & Rule-Engine Checks (45 Seconds)
1. Go to settings and set the **All Devices ON time limit** to `00:01` (1 minute).
2. Manually turn ON all 5 devices in Work Room 1 (Fan 1, Fan 2, Light 1, Light 2, Light 3).
3. Wait 1 minute.
4. Point out that a critical **Danger Alert** is generated in the **Active System Alerts** panel.
5. Open your Discord server in the `#alerts` channel. Show the judges the beautiful, conversational warning posted automatically by the bot!
6. Click the **Clear** button on the dashboard alerts panel and show that it clears the feed instantly across all connected browsers.

### Step 4: AI Bot Conversational Interaction (45 Seconds)
1. Type a command like `!status` or click the shortcut buttons under the bot's response in Discord.
2. Ask the bot a natural query in Bengali or Banglish (e.g. *"work room 1 er light active ache?"* or *"room 1 status ki?"*).
3. Show that the bot replies instantly with a conversational, friendly text (no dry raw JSON outputs).
4. Give a voice/text override command (e.g. *"turn off work room 1 light 2"*). Show that the light turns off immediately on the web dashboard map, and the bot replies with the live status of the room!

---

## 💬 Live Q&A Notes & Technical Defenses

### Q1: "Why did you use an in-memory store instead of a database like PostgreSQL or MongoDB?"
* **Answer**: *"For the scope of this real-time IoT demonstration, low latency is critical. Storing states in an in-memory store in `store.js` guarantees 0ms read/write latency. In a production environment, we would back this up by syncing state changes asynchronously to a Redis cache and a PostgreSQL database for persistent historical logs."*

### Q2: "We noticed your Tinkercad schematic connects the DC motor directly to the output pins. Can we build this in real life?"
* **Answer**: *"No, that is unsafe for real hardware. We included a detailed schematic warning note in `docs/circuit_schematic.md`. In a real-world assembly, connecting the DC motor directly draws too much current (~100mA+) and creates inductive flyback spikes that would fry the Arduino microcontroller. We would instead use an NPN transistor (like PN2222) as a electronic switch and put a flyback diode (like 1N4007) in parallel to protect the digital pins."*

### Q3: "How does the bot parse complex commands like 'turn on drawing room light 2 and fan 1'?"
* **Answer**: *"We utilize the Gemini 2.5 Flash API with a custom system prompt classifier. The prompt standardizes room and device types into structured JSON actions: `[{"room": "Drawing Room", "type": "light", "index": 2, "action": "ON"}]`. The bot then loops through these actions and issues REST calls to the backend."*
