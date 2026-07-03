const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const axios = require("axios");
const io = require("socket.io-client");
require("dotenv").config();

// Configuration from environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "PLACEHOLDER_TOKEN";
const BACKEND_URL = process.env.BACKEND_URL || "https://teckathon-backend.onrender.com";
const ALERTS_CHANNEL_ID = process.env.ALERTS_CHANNEL_ID || "PLACEHOLDER_CHANNEL_ID";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const PREFIX = "!";

// Initialize Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Helper to query Gemini 2.5 Flash and humanize responses
async function humanizeResponse(systemContext, rawDataText) {
  if (!GEMINI_API_KEY) {
    // Fallback friendly formatting
    return `👋 **SmartOffice Update**\n${systemContext}\n\n${rawDataText}`;
  }

  try {
    const prompt = `You are a helpful, extremely polite, and professional Smart Office monitoring assistant. 
Explain the following status details to the office manager/boss in a natural, friendly, human conversational tone.
Do not reference prompt structures, raw arrays, or template instructions.
You can write in English, Bengali, or Banglish depending on how you are addressed. Keep it concise, tidy, and accurate.

Context: ${systemContext}
Status Details:
${rawDataText}`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }]
      },
      { timeout: 5000 }
    );

    const candidateText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (candidateText) {
      return candidateText.trim();
    }
  } catch (err) {
    console.error("[Gemini] API error, using friendly fallback:", err.message);
  }

  return `👋 **SmartOffice Update**\n${systemContext}\n\n${rawDataText}`;
}

// Generate the 5-button shortcut menu row
function getShortcutButtons() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("btn_status")
      .setLabel("📋 Office Status")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("btn_usage")
      .setLabel("⚡ Energy Usage")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("btn_drawing")
      .setLabel("🛋️ Drawing Room")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("btn_work1")
      .setLabel("💻 Work Room 1")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("btn_work2")
      .setLabel("🛠️ Work Room 2")
      .setStyle(ButtonStyle.Secondary)
  );
  return [row];
}

// Live listener for proactive alerts using Socket.io-client
let socket;
let botSettings = {
  discordOnlyDanger: false
};

function connectToBackendSockets() {
  console.log(`[Bot] Connecting to Backend WebSockets at ${BACKEND_URL}...`);
  socket = io(BACKEND_URL);

  socket.on("connect", () => {
    console.log("[Bot] Socket.io connection established to backend.");
  });

  socket.on("init_state", (data) => {
    if (data.settings) {
      botSettings = data.settings;
      console.log("[Bot] Synchronized initial settings:", botSettings);
    }
  });

  socket.on("settings_updated", (newSettings) => {
    botSettings = newSettings;
    console.log("[Bot] Synchronized updated settings:", botSettings);
  });

  socket.on("alert_added", async (alert) => {
    console.log(`[Bot] Received active alert from backend: ${alert.message}`);
    
    // Check setting: if discordOnlyDanger is enabled, skip warning alerts
    if (botSettings.discordOnlyDanger && alert.severity !== "danger") {
      console.log(`[Bot] Skipping alert: Only sending 'danger' severity alerts to Discord (setting is active).`);
      return;
    }
    
    // Proactively post alerts to the designated Discord channel
    if (ALERTS_CHANNEL_ID !== "PLACEHOLDER_CHANNEL_ID") {
      try {
        const channel = await client.channels.fetch(ALERTS_CHANNEL_ID);
        if (channel && channel.isTextBased()) {
          // Humanize proactive alert details
          const friendlyAlert = await humanizeResponse("Proactive anomaly warning alert.", alert.message);

          const alertEmbed = new EmbedBuilder()
            .setTitle(alert.severity === 'danger' ? "⚠️ CRITICAL EFFICIENCY WARNING" : "🔔 SYSTEM ALERT")
            .setDescription(friendlyAlert)
            .setColor(alert.severity === 'danger' ? 0xEF4444 : 0xF59E0B)
            .setTimestamp(new Date(alert.timestamp));
            
          await channel.send({ embeds: [alertEmbed], components: getShortcutButtons() });
          console.log("[Bot] Proactive alert dispatched to channel with shortcut controls.");
        }
      } catch (err) {
        console.error("[Bot] Failed to dispatch alert to Discord channel:", err.message);
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("[Bot] Socket.io disconnected from backend.");
  });
}

client.once("ready", () => {
  console.log(`[Bot] Logged in successfully as ${client.user.tag}!`);
  connectToBackendSockets();
});

// Interactive Button Clicks listener
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const customId = interaction.customId;
  await interaction.deferReply(); // Notify Discord we are loading details

  try {
    if (customId === "btn_status") {
      const response = await axios.get(`${BACKEND_URL}/api/devices`);
      const { devices } = response.data;
      const rooms = ["Drawing Room", "Work Room 1", "Work Room 2"];
      const summaryList = rooms.map(room => {
        const roomDevices = devices.filter(d => d.room === room);
        const activeFans = roomDevices.filter(d => d.type === "fan" && d.status).length;
        const activeLights = roomDevices.filter(d => d.type === "light" && d.status).length;
        if (activeFans === 0 && activeLights === 0) return `**${room}**: all off`;
        const details = [];
        if (activeFans > 0) details.push(`${activeFans} fan${activeFans > 1 ? "s" : ""} ON`);
        if (activeLights > 0) details.push(`${activeLights} light${activeLights > 1 ? "s" : ""} ON`);
        return `**${room}**: ${details.join(" and ")}`;
      });

      const rawText = summaryList.join("\n");
      const friendlyText = await humanizeResponse("Overall status overview of all rooms", rawText);
      await interaction.editReply({ content: friendlyText, components: getShortcutButtons() });
    } 
    
    else if (customId === "btn_usage") {
      const response = await axios.get(`${BACKEND_URL}/api/usage`);
      const { metrics } = response.data;
      const breakdownLines = Object.entries(metrics.roomBreakdown)
        .map(([room, power]) => `• ${room}: ${power} W`)
        .join("\n");
      
      const rawText = `Total load: ${metrics.totalPowerNow} Watts\nBreakdown:\n${breakdownLines}\nToday's kWh: ${metrics.estimatedKWh} kWh`;
      const friendlyText = await humanizeResponse("Energy consumption summary of the office.", rawText);
      await interaction.editReply({ content: friendlyText, components: getShortcutButtons() });
    } 
    
    else {
      let targetRoom = "";
      if (customId === "btn_drawing") targetRoom = "Drawing Room";
      else if (customId === "btn_work1") targetRoom = "Work Room 1";
      else if (customId === "btn_work2") targetRoom = "Work Room 2";

      if (targetRoom) {
        const response = await axios.get(`${BACKEND_URL}/api/devices`);
        const { devices } = response.data;
        const roomDevices = devices.filter(d => d.room === targetRoom);
        const deviceLines = roomDevices.map(d => {
          const icon = d.status ? "🟢" : "⚫";
          const stateStr = d.status ? `**ON** (${d.powerDraw}W)` : "OFF";
          return `${icon} ${d.name}: ${stateStr}`;
        });
        const totalPower = roomDevices.reduce((sum, d) => sum + (d.status ? d.powerDraw : 0), 0);

        const rawText = `${deviceLines.join("\n")}\nTotal Room Power: ${totalPower} W`;
        const friendlyText = await humanizeResponse(`Status check for ${targetRoom}.`, rawText);
        await interaction.editReply({ content: friendlyText, components: getShortcutButtons() });
      }
    }
  } catch (err) {
    console.error("[Bot Interaction] Error executing button response:", err.message);
    await interaction.editReply({
      content: "⚠️ Failed to execute query. Backend API is currently offline.",
      components: getShortcutButtons()
    });
  }
});

// Message commands listener
client.on("messageCreate", async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // If message doesn't start with prefix, output help buttons menu for ease of use
  if (!message.content.startsWith(PREFIX)) {
    // If the boss sends a random conversational text, we can use Gemini to converse with them back!
    if (GEMINI_API_KEY) {
      try {
        // Fetch all live state
        const devicesRes = await axios.get(`${BACKEND_URL}/api/devices`);
        const usageRes = await axios.get(`${BACKEND_URL}/api/usage`);
        const settingsRes = await axios.get(`${BACKEND_URL}/api/settings`);
        
        const devices = devicesRes.data.devices;
        const metrics = usageRes.data.metrics;
        const settings = settingsRes.data.settings;
        
        const systemStateText = `
Devices list:
${devices.map(d => `• [${d.room}] ${d.name}: ${d.status ? "ON" : "OFF"} (${d.powerDraw}W)`).join("\n")}
Total current load: ${metrics.totalPowerNow}W
Daily usage estimation: ${metrics.estimatedKWh} kWh
Office Hours range: ${settings.officeStartTime || "09:00"} to ${settings.officeEndTime || "17:00"}
All Devices ON time limit: ${settings.roomAllOnTimeLimit || "02:00"}
`;

        const prompt = `You are the Smart Office Monitoring Assistant bot. The office manager/boss just sent this message: "${message.content}".
Answer their message in a natural, polite, and professional conversational tone, using the live office data provided below.
Be concise, clear, and extremely accurate. Do not hallucinate devices or features that do not exist in the data.
You can respond in English, Bengali, or Banglish depending on how the boss addresses you.

Live System Data:
${systemStateText}

Instructions:
1. Directly answer the boss's query. If they ask about a specific room (e.g. "room 1", "drawing room", or "room number 1"), look at the devices list for that room and summarize it.
2. If they speak in Bengali or Banglish (e.g., "room 1 er status ki?"), reply back in friendly Bengali or Banglish.
3. Be concise, clear, and professional.
4. Note that they can also click the quick buttons below to get instant structured status reports.`;

        // Send this directly to Gemini!
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            contents: [{
              parts: [{ text: prompt }]
            }]
          },
          { timeout: 8000 }
        );

        const candidateText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText) {
          await message.reply({ content: candidateText.trim(), components: getShortcutButtons() });
          return;
        }
      } catch (err) {
        console.error("[Bot Conversational] Error:", err.message);
      }
    }
    
    // Fallback if Gemini key is missing or failed
    await message.reply({ content: `🤖 Hello! You can type commands like \`!status\` or simply click the shortcut buttons below:`, components: getShortcutButtons() });
    return;
  }

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // COMMAND: !status
  if (command === "status") {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/devices`);
      const { devices } = response.data;
      
      const rooms = ["Drawing Room", "Work Room 1", "Work Room 2"];
      const summaryList = rooms.map(room => {
        const roomDevices = devices.filter(d => d.room === room);
        const activeFans = roomDevices.filter(d => d.type === "fan" && d.status).length;
        const activeLights = roomDevices.filter(d => d.type === "light" && d.status).length;
        if (activeFans === 0 && activeLights === 0) return `**${room}**: all off`;
        const details = [];
        if (activeFans > 0) details.push(`${activeFans} fan${activeFans > 1 ? "s" : ""} ON`);
        if (activeLights > 0) details.push(`${activeLights} light${activeLights > 1 ? "s" : ""} ON`);
        return `**${room}**: ${details.join(" and ")}`;
      });

      const rawText = summaryList.join("\n");
      const friendlyText = await humanizeResponse("Overall status overview of all rooms", rawText);

      await message.reply({ content: friendlyText, components: getShortcutButtons() });
    } catch (err) {
      console.error("[Bot] Error status command:", err.message);
      await message.reply("⚠️ Sorry, I had trouble communicating with the backend API. Please make sure the server is online!");
    }
  }

  // COMMAND: !room <name>
  else if (command === "room") {
    const inputRoom = args.join(" ").toLowerCase();
    
    if (!inputRoom) {
      return message.reply("Please specify a room name! Example: `!room drawing` or `!room work 1`.");
    }

    // Resolve room query
    let targetRoom = "";
    if (inputRoom.includes("drawing") || inputRoom.includes("wait")) {
      targetRoom = "Drawing Room";
    } else if (inputRoom.includes("work") && inputRoom.includes("1")) {
      targetRoom = "Work Room 1";
    } else if (inputRoom.includes("work") && inputRoom.includes("2")) {
      targetRoom = "Work Room 2";
    } else {
      return message.reply(`I couldn't recognize "${args.join(" ")}". Try using \`drawing\`, \`work 1\`, or \`work 2\`.`);
    }

    try {
      const response = await axios.get(`${BACKEND_URL}/api/devices`);
      const { devices } = response.data;
      
      const roomDevices = devices.filter(d => d.room === targetRoom);
      const deviceLines = roomDevices.map(d => {
        const icon = d.status ? "🟢" : "⚫";
        const stateStr = d.status ? `**ON** (${d.powerDraw}W)` : "OFF";
        return `${icon} ${d.name}: ${stateStr}`;
      });

      const totalPower = roomDevices.reduce((sum, d) => sum + (d.status ? d.powerDraw : 0), 0);
      const rawText = `${deviceLines.join("\n")}\nTotal draw: ${totalPower} Watts`;
      const friendlyText = await humanizeResponse(`Status check for ${targetRoom}.`, rawText);

      await message.reply({ content: friendlyText, components: getShortcutButtons() });
    } catch (err) {
      console.error("[Bot] Error fetching room details:", err.message);
      await message.reply("⚠️ Sorry, I failed to fetch the room state from the backend.");
    }
  }

  // COMMAND: !usage
  else if (command === "usage") {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/usage`);
      const { metrics } = response.data;

      const breakdownLines = Object.entries(metrics.roomBreakdown)
        .map(([room, power]) => `• ${room}: **${power} W**`)
        .join("\n");

      const rawText = `Total load: ${metrics.totalPowerNow} Watts\nBreakdown:\n${breakdownLines}\nAccumulated: ${metrics.estimatedKWh} kWh`;
      const friendlyText = await humanizeResponse("Energy consumption summary of the office.", rawText);

      await message.reply({ content: friendlyText, components: getShortcutButtons() });
    } catch (err) {
      console.error("[Bot] Error fetching power usage:", err.message);
      await message.reply("⚠️ Sorry, I could not load power usage parameters from the server.");
    }
  }
  
  // COMMAND: !help
  else if (command === "help") {
    const helpMsg = `🤖 **SmartOffice Command Center**\nClick the shortcut buttons below or type any commands:\n• \`!status\`\n• \`!room <drawing|work 1|work 2>\`\n• \`!usage\``;
    await message.reply({ content: helpMsg, components: getShortcutButtons() });
  }
});

// Token check & Login
if (DISCORD_TOKEN === "PLACEHOLDER_TOKEN") {
  console.warn("\n[Warning] DISCORD_TOKEN is set to PLACEHOLDER_TOKEN. Bot will not connect to Discord.");
  console.warn("To run, please define DISCORD_TOKEN in a .env file inside the 'bot' folder.\n");
} else {
  client.login(DISCORD_TOKEN).catch(err => {
    console.error("[Bot] Login failure:", err.message);
  });
}

// Render Web Service HTTP port-binding workaround (Free Tier support)
const http = require("http");
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("SmartOffice Discord Bot is active!");
}).listen(PORT, () => {
  console.log(`[Bot] Dummy HTTP health-check listening on port ${PORT}`);
});
