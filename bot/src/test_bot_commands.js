const axios = require("axios");
const readline = require("readline");

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";
const PREFIX = "!";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("\n=======================================================");
console.log("🤖 Smart Office Discord Bot Local Command CLI Tester");
console.log("Querying backend at: " + BACKEND_URL);
console.log("Commands: !status, !room <name>, !usage, !help");
console.log("Type 'exit' to quit.");
console.log("=======================================================\n");

async function runCommand(text) {
  if (!text.startsWith(PREFIX)) {
    console.log("⚠️ Input must start with '!' prefix. Type '!help' for commands.");
    return;
  }
  
  const args = text.slice(PREFIX.length).trim().split(/ +/);
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

      console.log(`\n👋 Hello Boss! Here is the live status report of the office devices:\n`);
      summaryList.forEach(line => console.log(` • ${line}`));
      console.log(`\n*Everything is running live, and the systems are stable! Let me know if you need to turn anything off.*`);
    } catch (err) {
      console.error("\n⚠️ Error: Failed to contact backend at " + BACKEND_URL + ". Is the backend server running?");
    }
  }

  // COMMAND: !room <name>
  else if (command === "room") {
    const inputRoom = args.join(" ").toLowerCase();
    
    if (!inputRoom) {
      console.log("⚠️ Error: Please specify a room name! Example: `!room drawing` or `!room work 1`.");
      return;
    }

    let targetRoom = "";
    if (inputRoom.includes("drawing") || inputRoom.includes("wait")) {
      targetRoom = "Drawing Room";
    } else if (inputRoom.includes("work") && inputRoom.includes("1")) {
      targetRoom = "Work Room 1";
    } else if (inputRoom.includes("work") && inputRoom.includes("2")) {
      targetRoom = "Work Room 2";
    } else {
      console.log(`⚠️ Error: I couldn't recognize "${args.join(" ")}". Try using \`drawing\`, \`work 1\`, or \`work 2\`.`);
      return;
    }

    try {
      const response = await axios.get(`${BACKEND_URL}/api/devices`);
      const { devices } = response.data;
      
      const roomDevices = devices.filter(d => d.room === targetRoom);
      
      const deviceLines = roomDevices.map(d => {
        const icon = d.status ? "🟢" : "⚫";
        const stateStr = d.status ? `ON (${d.powerDraw}W)` : "OFF";
        return `  ${icon} ${d.name}: ${stateStr}`;
      });

      const totalPower = roomDevices.reduce((sum, d) => sum + (d.status ? d.powerDraw : 0), 0);

      console.log(`\n🏢 **${targetRoom} Status Report**`);
      deviceLines.forEach(line => console.log(line));
      console.log(`⚡ Total room consumption: **${totalPower} Watts**.`);
    } catch (err) {
      console.error("\n⚠️ Error: Failed to contact backend. Is the server running?");
    }
  }

  // COMMAND: !usage
  else if (command === "usage") {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/usage`);
      const { metrics } = response.data;

      console.log(`\n⚡ **Office Energy Consumption Summary**`);
      console.log(` • Total power draw right now: **${metrics.totalPowerNow} Watts**`);
      Object.entries(metrics.roomBreakdown).forEach(([room, power]) => {
        console.log(`   - ${room}: **${power} W**`);
      });
      console.log(` • Today's estimated consumption: **${metrics.estimatedKWh} kWh**`);
      console.log(`\n*Energy efficiency tips: Turn off lights/fans in Work Room 2 if the room is empty!*`);
    } catch (err) {
      console.error("\n⚠️ Error: Failed to contact backend. Is the server running?");
    }
  }
  
  // COMMAND: !help
  else if (command === "help") {
    console.log(`\n🤖 **SmartOffice Command Center**`);
    console.log(` • '!status' - Get a quick conversational overview of all 3 rooms.`);
    console.log(` • '!room <drawing|work 1|work 2>' - Review detailed device statuses for a specific room.`);
    console.log(` • '!usage' - See current load breakdowns (Watts) and today's accumulated kWh.`);
  } else {
    console.log(`⚠️ Unknown command: '!${command}'. Type '!help' for a list of commands.`);
  }
}

function promptCommand() {
  rl.question("bot-cli > ", async (input) => {
    const text = input.trim();
    if (text.toLowerCase() === "exit") {
      rl.close();
      return;
    }
    if (text) {
      await runCommand(text);
    }
    promptCommand();
  });
}

promptCommand();
