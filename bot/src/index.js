const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const axios = require("axios");
const io = require("socket.io-client");
require("dotenv").config();

// Configuration from environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "PLACEHOLDER_TOKEN";
const BACKEND_URL = process.env.BACKEND_URL || "https://teckathon-backend.onrender.com";
const ALERTS_CHANNEL_ID = process.env.ALERTS_CHANNEL_ID || "PLACEHOLDER_CHANNEL_ID";
const PREFIX = "!";

// Initialize Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Live listener for proactive alerts using Socket.io-client
let socket;
function connectToBackendSockets() {
  console.log(`[Bot] Connecting to Backend WebSockets at ${BACKEND_URL}...`);
  socket = io(BACKEND_URL);

  socket.on("connect", () => {
    console.log("[Bot] Socket.io connection established to backend.");
  });

  socket.on("alert_added", async (alert) => {
    console.log(`[Bot] Received active alert from backend: ${alert.message}`);
    
    // Proactively post alerts to the designated Discord channel
    if (ALERTS_CHANNEL_ID !== "PLACEHOLDER_CHANNEL_ID") {
      try {
        const channel = await client.channels.fetch(ALERTS_CHANNEL_ID);
        if (channel && channel.isTextBased()) {
          const alertEmbed = new EmbedBuilder()
            .setTitle(alert.severity === 'danger' ? "⚠️ CRITICAL EFFICIENCY WARNING" : "🔔 SYSTEM ALERT")
            .setDescription(alert.message)
            .setColor(alert.severity === 'danger' ? 0xEF4444 : 0xF59E0B)
            .setTimestamp(new Date(alert.timestamp));
            
          await channel.send({ embeds: [alertEmbed] });
          console.log("[Bot] Proactive alert dispatched to channel.");
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

// Message commands listener
client.on("messageCreate", async (message) => {
  // Ignore messages from bots or without prefix
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

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
        
        if (activeFans === 0 && activeLights === 0) {
          return `**${room}**: all off`;
        }
        
        const details = [];
        if (activeFans > 0) details.push(`${activeFans} fan${activeFans > 1 ? "s" : ""} ON`);
        if (activeLights > 0) details.push(`${activeLights} light${activeLights > 1 ? "s" : ""} ON`);
        return `**${room}**: ${details.join(" and ")}`;
      });

      // Conversational formatting matching the boss's preferences
      const reply = `👋 Hello Boss! Here is the live status report of the office devices:
\n• ${summaryList.join("\n• ")}
\n*Everything is running live, and the systems are stable! Let me know if you need to turn anything off.*`;

      await message.reply(reply);
    } catch (err) {
      console.error("[Bot] Error fetching devices status:", err.message);
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

      const reply = `🏢 **${targetRoom} Status Report**
\n${deviceLines.join("\n")}
\n⚡ Total room consumption: **${totalPower} Watts**.`;

      await message.reply(reply);
    } catch (err) {
      console.error("[Bot] Error fetching room details:", err.message);
      await message.reply("⚠️ Sorry, I failed to fetch the room state from the backend API.");
    }
  }

  // COMMAND: !usage
  else if (command === "usage") {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/usage`);
      const { metrics } = response.data;

      // Build room breakdowns
      const breakdownLines = Object.entries(metrics.roomBreakdown)
        .map(([room, power]) => `• ${room}: **${power} W**`)
        .join("\n");

      const reply = `⚡ **Office Energy Consumption Summary**
\n• Total power draw right now: **${metrics.totalPowerNow} Watts**
${breakdownLines}
\n📈 Today's estimated consumption: **${metrics.estimatedKWh} kWh**
\n*Energy efficiency tips: Turn off lights/fans in Work Room 2 if the room is empty!*`;

      await message.reply(reply);
    } catch (err) {
      console.error("[Bot] Error fetching power usage:", err.message);
      await message.reply("⚠️ Sorry, I could not load power usage parameters from the server.");
    }
  }
  
  // COMMAND: !help
  else if (command === "help") {
    const helpMsg = `🤖 **SmartOffice Command Center**
Here are the commands you can use:
• \`!status\` - Get a quick conversational overview of all 3 rooms.
• \`!room <drawing|work 1|work 2>\` - Review detailed device statuses for a specific room.
• \`!usage\` - See current load breakdowns (Watts) and today's accumulated kWh.`;
    await message.reply(helpMsg);
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
