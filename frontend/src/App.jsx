import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  Activity, 
  Lightbulb, 
  Wind, 
  AlertTriangle, 
  User, 
  Zap, 
  Clock, 
  MapPin, 
  CheckCircle,
  XCircle,
  HelpCircle,
  Settings
} from 'lucide-react';

export default function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  
  // Dashboard states
  const [devices, setDevices] = useState([]);
  const [totalPower, setTotalPower] = useState(0);
  const [roomBreakdown, setRoomBreakdown] = useState({
    "Drawing Room": 0,
    "Work Room 1": 0,
    "Work Room 2": 0
  });
  const [estimatedKWh, setEstimatedKWh] = useState(4.2);
  const [alerts, setAlerts] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState("All");
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  // Settings & Timers states
  const [settings, setSettings] = useState({
    officeStartTime: "09:00",
    officeEndTime: "17:00",
    roomAllOnTimeLimit: "02:00",
    roomTimerEnabled: true,
    discordOnlyDanger: false,
    autoSimulatorEnabled: true
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [roomTimers, setRoomTimers] = useState({
    "Drawing Room": 0,
    "Work Room 1": 0,
    "Work Room 2": 0
  });

  // Auth states (Default to demo credentials for judges)
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('isLoggedIn') === 'true');
  const [email, setEmail] = useState("admin@smartoffice.com");
  const [password, setPassword] = useState("adminpassword123");
  const [loginError, setLoginError] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    if (email === "admin@smartoffice.com" && password === "adminpassword123") {
      setIsLoggedIn(true);
      localStorage.setItem('isLoggedIn', 'true');
      setLoginError("");
    } else {
      setLoginError("Invalid credentials. Please use admin@smartoffice.com / adminpassword123.");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('isLoggedIn');
  };

  const allOnStartTimes = useRef({
    "Drawing Room": null,
    "Work Room 1": null,
    "Work Room 2": null
  });

  // Live clock setup
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Room All-On timer updates
  useEffect(() => {
    const interval = setInterval(() => {
      const roomsList = ["Drawing Room", "Work Room 1", "Work Room 2"];
      const newTimers = { ...roomTimers };
      let updated = false;

      roomsList.forEach(room => {
        const roomDevices = devices.filter(d => d.room === room);
        const allOn = roomDevices.length > 0 && roomDevices.every(d => d.status);

        if (allOn && settings.roomTimerEnabled) {
          if (!allOnStartTimes.current[room]) {
            allOnStartTimes.current[room] = Date.now();
          }
          const elapsedSecs = Math.floor((Date.now() - allOnStartTimes.current[room]) / 1000);
          if (newTimers[room] !== elapsedSecs) {
            newTimers[room] = elapsedSecs;
            updated = true;
          }
        } else {
          if (allOnStartTimes.current[room] !== null || newTimers[room] !== 0) {
            allOnStartTimes.current[room] = null;
            newTimers[room] = 0;
            updated = true;
          }
        }
      });

      if (updated) {
        setRoomTimers(newTimers);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [devices, settings.roomTimerEnabled, roomTimers]);

  // Socket setup
  useEffect(() => {
    // Connect to Backend (port 3001 in development, Render URL in production)
    const backendUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3001'
      : 'https://teckathon-backend.onrender.com';

    const socketInstance = io(backendUrl);
    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setConnected(true);
      console.log('Connected to backend via Socket.io');
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected from backend');
    });

    // Receive initial state snapshot
    socketInstance.on('init_state', (data) => {
      setDevices(data.devices || []);
      setTotalPower(data.totalPower || 0);
      setRoomBreakdown(data.roomBreakdown || {});
      setEstimatedKWh(data.estimatedKWh || 4.2);
      setAlerts(data.alerts || []);
      if (data.settings) {
        setSettings(data.settings);
      }
    });

    socketInstance.on('settings_updated', (updated) => {
      setSettings(updated);
    });

    // Receive incremental update broadcasts
    socketInstance.on('device_update', (data) => {
      setDevices(prevDevices => 
        prevDevices.map(d => d.id === data.device.id ? data.device : d)
      );
      setTotalPower(data.totalPower);
      setRoomBreakdown(data.roomBreakdown);
      setEstimatedKWh(data.estimatedKWh);
    });

    // Receive alert notifications
    socketInstance.on('alert_added', (alert) => {
      setAlerts(prev => [alert, ...prev].slice(0, 50));
    });

    // Receive alerts cleared event
    socketInstance.on('alerts_cleared', () => {
      setAlerts([]);
    });

    // Force synchronization of alerts lists across tabs
    socketInstance.on('alert_list_sync', (syncedAlerts) => {
      setAlerts(syncedAlerts);
    });

    // Listen for dynamic administrators updates
    socketInstance.on('users_updated', (updatedUsers) => {
      setUsers(updatedUsers);
    });

    // Fetch initial dummy users list
    fetch(`${backendUrl}/api/users`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUsers(data.users);
        }
      })
      .catch(err => console.error("Error fetching dummy users:", err));

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Handle manual toggle
  const handleToggle = (deviceId) => {
    if (socket) {
      socket.emit("toggle_device", deviceId);
    }
  };

  // Handle clear alerts with instant local feedback and REST fallback
  const handleClearAlerts = async () => {
    // 1. Instant local visual feedback
    setAlerts([]);

    // 2. Clear backend store via REST API
    try {
      await fetch(`${backendUrl}/api/alerts/clear`, { method: "POST" });
    } catch (err) {
      console.error("Error clearing alerts via REST:", err);
    }

    // 3. Emit socket event to clear other concurrent tabs
    if (socket) {
      socket.emit("clear_alerts");
    }
  };

  // Handle settings update
  const handleUpdateSettings = (newSettings) => {
    if (socket) {
      socket.emit("update_settings", newSettings);
    }
    setShowSettingsModal(false);
  };

  // Helper to format timers
  const formatTime = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const activeDevices = devices.filter(d => d.status);
  const rooms = ["All", "Drawing Room", "Work Room 1", "Work Room 2"];

  // Filtered devices for rendering lists
  const filteredDevices = selectedRoom === "All" 
    ? devices 
    : devices.filter(d => d.room === selectedRoom);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Background Glowing Orbs */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }}></div>

        <div className="w-full max-w-md bg-[#161F30]/60 backdrop-blur-xl border border-[#23354E] rounded-3xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-[#3B82F6] p-3 rounded-2xl text-white shadow-[0_0_20px_rgba(59,130,246,0.5)] mb-4">
              <Zap className="h-8 w-8 animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">SmartOffice Control Center</h1>
            <p className="text-xs text-gray-400 mt-1">Please enter administrator credentials to gain access</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1.5">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#0B0F19]/80 border border-[#23354E] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#3B82F6] transition-colors"
                placeholder="email@example.com"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1.5">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#0B0F19]/80 border border-[#23354E] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#3B82F6] transition-colors"
                placeholder="••••••••"
              />
            </div>

            {loginError && (
              <p className="text-xs text-red-400 font-semibold bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg">
                ⚠️ {loginError}
              </p>
            )}

            <button 
              type="submit"
              className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white py-3 rounded-xl font-bold text-sm transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] active:scale-[0.98]"
            >
              Access Control Room
            </button>
          </form>

          {/* Judge details card */}
          <div className="mt-8 p-3.5 bg-slate-900/40 border border-[#23354E]/40 rounded-xl">
            <h4 className="text-[10px] uppercase font-bold text-[#3B82F6] tracking-wider mb-1 flex items-center gap-1">
              ⭐ Judge Demonstration Details
            </h4>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              We have pre-filled the inputs above for you. Simply click the **"Access Control Room"** button to log in instantly.
            </p>
            <div className="text-[10px] text-gray-500 mt-2 font-mono">
              <span className="text-gray-400 font-semibold">Email:</span> admin@smartoffice.com<br />
              <span className="text-gray-400 font-semibold">Pass:</span> adminpassword123
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col font-sans">
      
      {/* STICKY MAIN HEADER */}
      <header className="border-b border-[#23354E] bg-[#161F30]/80 backdrop-blur-md sticky top-0 z-40 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-[#3B82F6] p-1.5 rounded-lg text-white shadow-[0_0_12px_rgba(59,130,246,0.5)]">
            <Zap className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold tracking-tight text-white">SmartOffice</h1>
            <p className="text-[10px] text-gray-400 hidden sm:block">Power & Device Monitoring Control Room</p>
          </div>
        </div>

        {/* CORE ACTIONS & CONNECTION */}
        <div className="flex items-center space-x-2 md:space-x-3">
          {/* Settings Button */}
          <button 
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center space-x-1.5 bg-[#23354E]/40 hover:bg-[#23354E]/80 text-gray-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-[#23354E]/60 text-xs font-semibold transition-all"
            title="Open Control Settings"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Settings</span>
          </button>

          {/* Logout Button */}
          <button 
            onClick={handleLogout}
            className="flex items-center space-x-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 px-2.5 py-1.5 rounded-lg border border-red-500/20 text-xs font-semibold transition-all"
            title="Log Out of Dashboard"
          >
            <XCircle className="h-3.5 w-3.5" />
            <span>Log Out</span>
          </button>

          {/* Connection Indicator */}
          <div className="flex items-center space-x-1.5 bg-[#23354E]/30 px-2.5 py-1.5 rounded-lg border border-[#23354E]/40 text-xs">
            <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse-glow shadow-[0_0_8px_#10b981]' : 'bg-red-500'}`}></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-300 hidden sm:inline">
              {connected ? 'Live Sync' : 'Offline'}
            </span>
          </div>
        </div>
      </header>

      {/* NON-STICKY METADATA SUB-HEADER (Scrolls away to save vertical space on mobile) */}
      <div className="bg-[#111827]/80 border-b border-[#23354E]/30 px-6 py-2.5 flex flex-wrap gap-2 justify-center items-center text-xs text-gray-400">
        <a 
          href="https://discord.gg/euFt99ETT" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center space-x-1.5 bg-[#5865F2]/10 hover:bg-[#5865F2]/20 text-[#5865F2] px-2.5 py-1.5 rounded-lg border border-[#5865F2]/30 text-xs font-semibold transition-all shadow-[0_0_10px_rgba(88,101,242,0.1)] hover:shadow-[0_0_15px_rgba(88,101,242,0.2)]"
        >
          <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 127.14 96.36">
            <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c.88-.65,1.72-1.34,2.51-2a75.58,75.58,0,0,0,73,0c.8.71,1.63,1.4,2.52,2a68.43,68.43,0,0,1-10.5,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31-18.83C129.87,50.75,124.15,27.8,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z"/>
          </svg>
          <span>Discord Server</span>
        </a>

        <div className="flex items-center space-x-2 bg-[#23354E]/40 px-2.5 py-1.5 rounded-lg border border-[#23354E]/60 text-xs">
          <Clock className="h-3.5 w-3.5 text-[#3B82F6] animate-pulse" />
          <span className="font-semibold text-white tracking-wider">{time}</span>
        </div>

        <div className="flex items-center space-x-2 bg-[#23354E]/40 px-2.5 py-1.5 rounded-lg border border-[#23354E]/60 text-xs">
          <Clock className="h-3.5 w-3.5 text-gray-400" />
          <span>Office Hours: {settings.officeStartTime} - {settings.officeEndTime}</span>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT & CENTER COLUMN: OVERVIEW STATS & VISUAL LAYOUT & CONTROL PANEL */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* POWER STATS CAROUSEL/GRID */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* Total Wattage */}
            <div className="glass-panel p-4 flex flex-col justify-between relative overflow-hidden group">
              <div className="flex justify-between items-center text-gray-400 mb-2">
                <span className="text-xs font-medium">Power Demand</span>
                <Zap className="h-4 w-4 text-[#3B82F6]" />
              </div>
              <div>
                <span className="text-2xl font-bold tracking-tight text-white">{totalPower}</span>
                <span className="text-sm font-semibold text-[#3B82F6] ml-1">Watts</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-2">Active now</div>
            </div>

            {/* Estimated Consumption */}
            <div className="glass-panel p-4 flex flex-col justify-between relative overflow-hidden group">
              <div className="flex justify-between items-center text-gray-400 mb-2">
                <span className="text-xs font-medium">Daily Energy</span>
                <Activity className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <span className="text-2xl font-bold tracking-tight text-white">{estimatedKWh}</span>
                <span className="text-sm font-semibold text-emerald-500 ml-1">kWh</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-2">Estimated consumption</div>
            </div>

            {/* Active Devices */}
            <div className="glass-panel p-4 flex flex-col justify-between relative overflow-hidden group">
              <div className="flex justify-between items-center text-gray-400 mb-2">
                <span className="text-xs font-medium">Active Devices</span>
                <Lightbulb className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <span className="text-2xl font-bold tracking-tight text-white">{activeDevices.length}</span>
                <span className="text-sm text-gray-400"> / 15</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-2">{15 - activeDevices.length} idle devices</div>
            </div>

            {/* Active Warnings */}
            <div className="glass-panel p-4 flex flex-col justify-between relative overflow-hidden group">
              <div className="flex justify-between items-center text-gray-400 mb-2">
                <span className="text-xs font-medium">Warnings</span>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <span className="text-2xl font-bold tracking-tight text-white">
                  {alerts.filter(a => a.severity === 'warning' || a.severity === 'danger').length}
                </span>
                <span className="text-sm text-gray-400"> Active</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-2">Requires inspection</div>
            </div>

          </section>

          {/* REAL-TIME LOAD ANALYSIS CHART */}
          <LoadAnalysisChart devices={devices} totalPower={totalPower} />

          {/* INTERACTIVE OFFICE FLOOR PLAN (SVG & ANIMATIONS) */}
          <section className="glass-panel p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-400" /> Live Office Floor Plan (Top View)
              </h2>
              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                Interactive Grid
              </span>
            </div>

            {/* Floor plan layout */}
            <div className="border border-[#23354E] rounded-xl overflow-hidden bg-slate-950 p-4 min-h-[300px] flex flex-col justify-center">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                
                {/* DRAWING ROOM */}
                <div className="border border-[#23354E]/60 bg-[#161F30]/30 rounded-lg p-3 flex flex-col justify-between min-h-[220px]">
                  <div className="border-b border-[#23354E]/40 pb-1.5 mb-2 flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      {roomTimers["Drawing Room"] > 0 && settings.roomTimerEnabled && (
                        <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-1 py-0.5 rounded animate-pulse font-mono font-bold">
                          ⏱️ {formatTime(roomTimers["Drawing Room"])}
                        </span>
                      )}
                      <span className="text-xs font-bold text-gray-300 uppercase tracking-wide">Drawing Room</span>
                    </div>
                    <div className="text-[10px] text-blue-400 font-semibold">{roomBreakdown["Drawing Room"] || 0}W draw</div>
                  </div>
                  
                  {/* Visual assets representing room layout */}
                  <div className="flex-1 flex flex-col justify-center items-center space-y-4">
                    {/* Fans */}
                    <div className="flex justify-center space-x-6">
                      {devices.filter(d => d.room === "Drawing Room" && d.type === "fan").map(d => (
                        <button 
                          key={d.id} 
                          onClick={() => handleToggle(d.id)}
                          className={`p-2.5 rounded-full border transition-all duration-300 flex flex-col items-center ${d.status ? 'bg-blue-500/15 border-blue-500/80 shadow-[0_0_12px_rgba(59,130,246,0.3)]' : 'bg-slate-900 border-[#23354E] hover:border-blue-500/40'}`}
                          title={`Click to toggle ${d.name}`}
                        >
                          <Wind className={`h-5 w-5 ${d.status ? 'text-blue-400 animate-spin-slow' : 'text-gray-600'}`} />
                          <span className="text-[9px] text-gray-400 mt-1">{d.name}</span>
                        </button>
                      ))}
                    </div>

                    {/* Lights */}
                    <div className="flex justify-center space-x-4">
                      {devices.filter(d => d.room === "Drawing Room" && d.type === "light").map(d => (
                        <button 
                          key={d.id} 
                          onClick={() => handleToggle(d.id)}
                          className={`p-2 rounded-full border transition-all duration-300 flex flex-col items-center ${d.status ? 'bg-amber-500/20 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.4)]' : 'bg-slate-900 border-[#23354E] hover:border-amber-500/40'}`}
                          title={`Click to toggle ${d.name}`}
                        >
                          <Lightbulb className={`h-4.5 w-4.5 ${d.status ? 'text-amber-400 fill-amber-400/20' : 'text-gray-600'}`} />
                          <span className="text-[9px] text-gray-400 mt-1">{d.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-2 text-[10px] text-gray-500 border-t border-[#23354E]/20 pt-1.5">
                    Waiting Area Sofa Setup
                  </div>
                </div>

                {/* WORK ROOM 1 */}
                <div className="border border-[#23354E]/60 bg-[#161F30]/30 rounded-lg p-3 flex flex-col justify-between min-h-[220px]">
                  <div className="border-b border-[#23354E]/40 pb-1.5 mb-2 flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      {roomTimers["Work Room 1"] > 0 && settings.roomTimerEnabled && (
                        <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-1 py-0.5 rounded animate-pulse font-mono font-bold">
                          ⏱️ {formatTime(roomTimers["Work Room 1"])}
                        </span>
                      )}
                      <span className="text-xs font-bold text-gray-300 uppercase tracking-wide">Work Room 1</span>
                    </div>
                    <div className="text-[10px] text-blue-400 font-semibold">{roomBreakdown["Work Room 1"] || 0}W draw</div>
                  </div>
                  
                  {/* Visual assets representing room layout */}
                  <div className="flex-1 flex flex-col justify-center items-center space-y-4">
                    {/* Fans */}
                    <div className="flex justify-center space-x-6">
                      {devices.filter(d => d.room === "Work Room 1" && d.type === "fan").map(d => (
                        <button 
                          key={d.id} 
                          onClick={() => handleToggle(d.id)}
                          className={`p-2.5 rounded-full border transition-all duration-300 flex flex-col items-center ${d.status ? 'bg-blue-500/15 border-blue-500/80 shadow-[0_0_12px_rgba(59,130,246,0.3)]' : 'bg-slate-900 border-[#23354E] hover:border-blue-500/40'}`}
                          title={`Click to toggle ${d.name}`}
                        >
                          <Wind className={`h-5 w-5 ${d.status ? 'text-blue-400 animate-spin-slow' : 'text-gray-600'}`} />
                          <span className="text-[9px] text-gray-400 mt-1">{d.name}</span>
                        </button>
                      ))}
                    </div>

                    {/* Lights */}
                    <div className="flex justify-center space-x-4">
                      {devices.filter(d => d.room === "Work Room 1" && d.type === "light").map(d => (
                        <button 
                          key={d.id} 
                          onClick={() => handleToggle(d.id)}
                          className={`p-2 rounded-full border transition-all duration-300 flex flex-col items-center ${d.status ? 'bg-amber-500/20 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.4)]' : 'bg-slate-900 border-[#23354E] hover:border-amber-500/40'}`}
                          title={`Click to toggle ${d.name}`}
                        >
                          <Lightbulb className={`h-4.5 w-4.5 ${d.status ? 'text-amber-400 fill-amber-400/20' : 'text-gray-600'}`} />
                          <span className="text-[9px] text-gray-400 mt-1">{d.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-2 text-[10px] text-gray-500 border-t border-[#23354E]/20 pt-1.5">
                    4x Workstations & Desks
                  </div>
                </div>

                {/* WORK ROOM 2 */}
                <div className="border border-[#23354E]/60 bg-[#161F30]/30 rounded-lg p-3 flex flex-col justify-between min-h-[220px]">
                  <div className="border-b border-[#23354E]/40 pb-1.5 mb-2 flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      {roomTimers["Work Room 2"] > 0 && settings.roomTimerEnabled && (
                        <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-1 py-0.5 rounded animate-pulse font-mono font-bold">
                          ⏱️ {formatTime(roomTimers["Work Room 2"])}
                        </span>
                      )}
                      <span className="text-xs font-bold text-gray-300 uppercase tracking-wide">Work Room 2</span>
                    </div>
                    <div className="text-[10px] text-blue-400 font-semibold">{roomBreakdown["Work Room 2"] || 0}W draw</div>
                  </div>
                  
                  {/* Visual assets representing room layout */}
                  <div className="flex-1 flex flex-col justify-center items-center space-y-4">
                    {/* Fans */}
                    <div className="flex justify-center space-x-6">
                      {devices.filter(d => d.room === "Work Room 2" && d.type === "fan").map(d => (
                        <button 
                          key={d.id} 
                          onClick={() => handleToggle(d.id)}
                          className={`p-2.5 rounded-full border transition-all duration-300 flex flex-col items-center ${d.status ? 'bg-blue-500/15 border-blue-500/80 shadow-[0_0_12px_rgba(59,130,246,0.3)]' : 'bg-slate-900 border-[#23354E] hover:border-blue-500/40'}`}
                          title={`Click to toggle ${d.name}`}
                        >
                          <Wind className={`h-5 w-5 ${d.status ? 'text-blue-400 animate-spin-slow' : 'text-gray-600'}`} />
                          <span className="text-[9px] text-gray-400 mt-1">{d.name}</span>
                        </button>
                      ))}
                    </div>

                    {/* Lights */}
                    <div className="flex justify-center space-x-4">
                      {devices.filter(d => d.room === "Work Room 2" && d.type === "light").map(d => (
                        <button 
                          key={d.id} 
                          onClick={() => handleToggle(d.id)}
                          className={`p-2 rounded-full border transition-all duration-300 flex flex-col items-center ${d.status ? 'bg-amber-500/20 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.4)]' : 'bg-slate-900 border-[#23354E] hover:border-amber-500/40'}`}
                          title={`Click to toggle ${d.name}`}
                        >
                          <Lightbulb className={`h-4.5 w-4.5 ${d.status ? 'text-amber-400 fill-amber-400/20' : 'text-gray-600'}`} />
                          <span className="text-[9px] text-gray-400 mt-1">{d.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-2 text-[10px] text-gray-500 border-t border-[#23354E]/20 pt-1.5">
                    4x Workstations & Water Dispenser
                  </div>
                </div>

              </div>

            </div>
          </section>

          {/* DEVICE CONTROL PANEL LIST */}
          <section className="glass-panel p-6">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h2 className="text-base font-semibold text-white">Device Overrides</h2>
                <p className="text-xs text-gray-400">List of all devices. Click on any item to manually override status</p>
              </div>

              {/* Room select filters */}
              <div className="flex flex-wrap bg-[#0B0F19] rounded-lg p-1 border border-[#23354E] gap-1">
                {rooms.map(room => (
                  <button 
                    key={room}
                    onClick={() => setSelectedRoom(room)}
                    className={`px-3 py-1 text-xs rounded-md transition-all font-medium ${selectedRoom === room ? 'bg-[#3B82F6] text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    {room === "All" ? "All Rooms" : room}
                  </button>
                ))}
              </div>
            </div>

            {/* Device Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredDevices.map(device => (
                <div 
                  key={device.id}
                  onClick={() => handleToggle(device.id)}
                  className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between ${device.status ? 'bg-[#161F30] border-[#3B82F6]/60 hover:border-[#3B82F6]' : 'bg-slate-900/60 border-[#23354E] hover:border-slate-700'}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2.5 rounded-lg ${device.status ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800 text-gray-500'}`}>
                      {device.type === 'fan' ? <Wind className="h-5 w-5" /> : <Lightbulb className="h-5 w-5" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{device.name}</h4>
                      <p className="text-[10px] text-gray-400">{device.room}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${device.status ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-gray-500 border border-slate-700'}`}>
                      {device.status ? 'ON' : 'OFF'}
                    </span>
                    <p className="text-[10px] text-gray-500 mt-1 font-semibold">{device.status ? device.powerDraw : 0} Watts</p>
                  </div>
                </div>
              ))}
              
              {filteredDevices.length === 0 && (
                <div className="col-span-full py-8 text-center text-gray-500 text-xs">
                  No devices matching filter found
                </div>
              )}
            </div>

          </section>

        </div>

        {/* RIGHT COLUMN: ALERTS & DATABASE USERS */}
        <div className="lg:col-span-4 space-y-6">

          {/* ACTIVE ALERTS LIST */}
          <section className="glass-panel p-6 flex flex-col max-h-[400px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" /> Active System Alerts
              </h2>
              {alerts.length > 0 && (
                <button 
                  onClick={handleClearAlerts}
                  className="text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-md font-semibold transition-all hover:border-red-500/40"
                >
                  Clear
                </button>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {alerts.map(alert => (
                <div 
                  key={alert.id}
                  className={`p-3 rounded-lg border text-xs flex items-start space-x-2.5 ${alert.severity === 'danger' ? 'bg-red-500/10 border-red-500/25 text-red-200' : 'bg-amber-500/10 border-amber-500/25 text-amber-200'}`}
                >
                  <AlertTriangle className={`h-4.5 w-4.5 shrink-0 mt-0.5 ${alert.severity === 'danger' ? 'text-red-400' : 'text-amber-400'}`} />
                  <div>
                    <p className="font-medium leading-relaxed">{alert.message}</p>
                    <span className="text-[10px] text-gray-400 block mt-1">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}

              {alerts.length === 0 && (
                <div className="text-center py-12 text-gray-500 text-xs">
                  <CheckCircle className="h-8 w-8 text-emerald-500/50 mx-auto mb-2" />
                  No anomalies active. All clear!
                </div>
              )}
            </div>
          </section>

          {/* SYSTEM ADMINISTRATORS (STRICT DUMMY DATA SET INTEGRATION) */}
          <section className="glass-panel p-6">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-blue-400" /> Office Administrators
            </h2>

            <div className="space-y-4">
              {users.map((user, idx) => (
                <div key={idx} className="p-3.5 bg-slate-900/50 border border-[#23354E]/60 rounded-xl flex items-center space-x-3">
                  <div className="bg-[#3B82F6]/10 text-[#3B82F6] p-2 rounded-lg">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="text-xs">
                    <h4 className="font-semibold text-white">{user.name}</h4>
                    <p className="text-gray-400 mt-0.5">{user.email}</p>
                    <p className="text-blue-400 font-semibold mt-0.5">{user.phone}</p>
                  </div>
                </div>
              ))}

              {users.length === 0 && (
                <div className="text-xs text-gray-500 py-2 italic">
                  Loading administrator information...
                </div>
              )}
            </div>
          </section>


        </div>

      </main>
      
      {/* FOOTER */}
      <footer className="border-t border-[#23354E] bg-slate-950 py-4 text-center text-xs text-gray-500">
        <p>&copy; {new Date().getFullYear()} SmartOffice Monitor. Built for Techathon.</p>
      </footer>

      {/* SETTINGS MODAL */}
      {showSettingsModal && (() => {
        const [durationHours, durationMinutes] = (settings.roomAllOnTimeLimit || "02:00").split(":").map(Number);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div 
              className="bg-[#161F30] border border-[#23354E] rounded-2xl w-full max-w-md flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
              style={{ maxHeight: "calc(100vh - 40px)" }}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-[#23354E]/60 flex justify-between items-center bg-slate-900/50">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Settings className="h-4.5 w-4.5 text-[#3B82F6]" /> Control Settings
                </h3>
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="text-gray-400 hover:text-white transition-colors text-lg"
                >
                  &times;
                </button>
              </div>

              {/* Content */}
              <div 
                className="p-6 space-y-5 text-sm text-gray-300 overflow-y-auto custom-scrollbar"
                style={{ flex: "1 1 auto", minHeight: 0 }}
              >
                {/* Rule 1: Office Hours */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Office Hours Schedule</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">Start Time</label>
                      <input 
                        type="time" 
                        defaultValue={settings.officeStartTime}
                        id="input_officeStartTime"
                        className="w-full bg-slate-900 border border-[#23354E] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#3B82F6]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">End Time</label>
                      <input 
                        type="time" 
                        defaultValue={settings.officeEndTime}
                        id="input_officeEndTime"
                        className="w-full bg-slate-900 border border-[#23354E] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#3B82F6]"
                      />
                    </div>
                  </div>
                </div>

                {/* Rule 2: Room Fully On Settings */}
                <div className="space-y-3 pt-2 border-t border-[#23354E]/20">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Room Vacancy Check (All ON)</label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        defaultChecked={settings.roomTimerEnabled}
                        id="input_roomTimerEnabled"
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#3B82F6] peer-checked:after:bg-white"></div>
                    </label>
                  </div>
                  
                  {/* Hours/Mins Dropdown Pickers */}
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 block">Alert Threshold (Duration)</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] text-gray-600 block mb-0.5">Hours</label>
                        <select 
                          id="input_durationHours"
                          defaultValue={durationHours}
                          className="w-full bg-slate-900 border border-[#23354E] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#3B82F6] text-xs"
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i}>{i} hr{i !== 1 ? 's' : ''}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-600 block mb-0.5">Minutes</label>
                        <select 
                          id="input_durationMinutes"
                          defaultValue={durationMinutes}
                          className="w-full bg-slate-900 border border-[#23354E] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#3B82F6] text-xs"
                        >
                          {Array.from({ length: 60 }, (_, i) => (
                            <option key={i} value={i}>{i} min{i !== 1 ? 's' : ''}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rule 3: Discord Alert Filters */}
                <div className="space-y-3 pt-2 border-t border-[#23354E]/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Discord Critical Filter</label>
                      <p className="text-[10px] text-gray-500 mt-0.5">Send only 'Danger' alerts to Discord, suppressing 'Warnings'.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        defaultChecked={settings.discordOnlyDanger}
                        id="input_discordOnlyDanger"
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#3B82F6] peer-checked:after:bg-white"></div>
                    </label>
                  </div>
                </div>

                {/* Rule 4: Auto Simulator Toggle */}
                <div className="space-y-3 pt-2 border-t border-[#23354E]/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Automated Demonstration</label>
                      <p className="text-[10px] text-yellow-500/80 mt-0.5">⚠️ Just for demonstration. Turn off to allow 100% manual control only.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        defaultChecked={settings.autoSimulatorEnabled !== false}
                        id="input_autoSimulatorEnabled"
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#3B82F6] peer-checked:after:bg-white"></div>
                    </label>
                  </div>
                </div>

                {/* Edit Office Administrators */}
                <div className="space-y-3 pt-3 border-t border-[#23354E]/20">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#3B82F6] block">🧑‍💼 Edit Office Administrators</label>
                  <p className="text-[10px] text-gray-500 mt-0.5">Customize administrator contact names and phone numbers used in warning alerts.</p>
                  
                  {/* Admin 1 */}
                  <div className="bg-[#0B1528]/50 p-2.5 rounded-lg border border-[#23354E]/30 space-y-2">
                    <span className="text-[9px] font-bold text-gray-400 block uppercase">Administrator 1</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[8px] text-gray-500 uppercase block mb-0.5">Name</label>
                        <input 
                          type="text" 
                          id="input_user1_name"
                          defaultValue={users[0]?.name || "Nafisa Rahman"}
                          className="w-full bg-[#0E1B30] border border-[#23354E] rounded px-1.5 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-[#3B82F6]"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] text-gray-500 uppercase block mb-0.5">Phone</label>
                        <input 
                          type="text" 
                          id="input_user1_phone"
                          defaultValue={users[0]?.phone || "+8801812345678"}
                          className="w-full bg-[#0E1B30] border border-[#23354E] rounded px-1.5 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-[#3B82F6]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Admin 2 */}
                  <div className="bg-[#0B1528]/50 p-2.5 rounded-lg border border-[#23354E]/30 space-y-2">
                    <span className="text-[9px] font-bold text-gray-400 block uppercase">Administrator 2</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[8px] text-gray-500 uppercase block mb-0.5">Name</label>
                        <input 
                          type="text" 
                          id="input_user2_name"
                          defaultValue={users[1]?.name || "Tanvir Hossain"}
                          className="w-full bg-[#0E1B30] border border-[#23354E] rounded px-1.5 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-[#3B82F6]"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] text-gray-500 uppercase block mb-0.5">Phone</label>
                        <input 
                          type="text" 
                          id="input_user2_phone"
                          defaultValue={users[1]?.phone || "+8801912345678"}
                          className="w-full bg-[#0E1B30] border border-[#23354E] rounded px-1.5 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-[#3B82F6]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="px-6 py-4 border-t border-[#23354E]/60 bg-slate-900/30 flex justify-end space-x-3">
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 rounded-lg bg-transparent border border-[#23354E] hover:bg-[#23354E]/50 text-gray-300 transition-colors text-xs font-semibold"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    const officeStartTime = document.getElementById("input_officeStartTime").value || "09:00";
                    const officeEndTime = document.getElementById("input_officeEndTime").value || "17:00";
                    const hrs = document.getElementById("input_durationHours").value.padStart(2, '0');
                    const mins = document.getElementById("input_durationMinutes").value.padStart(2, '0');
                    const roomAllOnTimeLimit = `${hrs}:${mins}`;
                    const roomTimerEnabled = document.getElementById("input_roomTimerEnabled").checked;
                    const discordOnlyDanger = document.getElementById("input_discordOnlyDanger").checked;
                    const autoSimulatorEnabled = document.getElementById("input_autoSimulatorEnabled").checked;
                    
                    // Save settings
                    handleUpdateSettings({
                      officeStartTime,
                      officeEndTime,
                      roomAllOnTimeLimit,
                      roomTimerEnabled,
                      discordOnlyDanger,
                      autoSimulatorEnabled
                    });

                    // Save custom administrators list
                    const user1_name = document.getElementById("input_user1_name").value || "Nafisa Rahman";
                    const user1_phone = document.getElementById("input_user1_phone").value || "+8801812345678";
                    const user2_name = document.getElementById("input_user2_name").value || "Tanvir Hossain";
                    const user2_phone = document.getElementById("input_user2_phone").value || "+8801912345678";

                    const updatedUsers = [
                      { name: user1_name, email: users[0]?.email || "nafisa.rahman@yahoo.com", phone: user1_phone },
                      { name: user2_name, email: users[1]?.email || "tanvir.hossain@yahoo.com", phone: user2_phone }
                    ];

                    fetch(`${backendUrl}/api/users`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ users: updatedUsers })
                    })
                    .then(res => res.json())
                    .then(data => {
                      if (data.success) {
                        setUsers(data.users);
                      }
                    })
                    .catch(err => console.error("Error saving updated users:", err));
                  }}
                  className="px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white transition-colors text-xs font-bold shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// Custom SVG Area Chart Component for Time-Series Load Analysis
function LoadAnalysisChart({ devices, totalPower }) {
  const [filterSource, setFilterSource] = useState('overall'); // 'overall', 'drawing', 'work1', 'work2', 'fans', 'lights'
  const [viewMode, setViewMode] = useState('live-15'); // 'live-10', 'live-15', 'live-25', 'live-50', '24h'
  
  // History logs state
  const [history, setHistory] = useState(() => {
    // Generate realistic starting history logs so the chart is populated on load
    const now = Date.now();
    const data = [];
    for (let i = 20; i >= 0; i--) {
      const timeStr = new Date(now - i * 30000).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      });
      // Generate some dummy load numbers
      const baseOverall = 60 + Math.floor(Math.random() * 90);
      data.push({
        time: timeStr,
        overall: baseOverall,
        drawing: Math.floor(baseOverall * 0.2),
        work1: Math.floor(baseOverall * 0.4),
        work2: Math.floor(baseOverall * 0.4),
        fans: Math.floor(baseOverall * 0.65),
        lights: Math.floor(baseOverall * 0.35)
      });
    }
    return data;
  });

  // Append new data point on updates
  useEffect(() => {
    const timeStr = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });

    const drawing = devices
      .filter(d => d.room === "Drawing Room" && d.status)
      .reduce((sum, d) => sum + d.powerDraw, 0);
    const work1 = devices
      .filter(d => d.room === "Work Room 1" && d.status)
      .reduce((sum, d) => sum + d.powerDraw, 0);
    const work2 = devices
      .filter(d => d.room === "Work Room 2" && d.status)
      .reduce((sum, d) => sum + d.powerDraw, 0);
      
    const fans = devices
      .filter(d => d.type === "fan" && d.status)
      .reduce((sum, d) => sum + d.powerDraw, 0);
    const lights = devices
      .filter(d => d.type === "light" && d.status)
      .reduce((sum, d) => sum + d.powerDraw, 0);

    const newPoint = {
      time: timeStr,
      overall: totalPower,
      drawing,
      work1,
      work2,
      fans,
      lights
    };

    setHistory(prev => {
      // Keep up to 50 points in memory
      const next = [...prev, newPoint];
      if (next.length > 55) next.shift();
      return next;
    });
  }, [devices, totalPower]);

  // Generate 24 hours report data dynamically
  const get24HourData = () => {
    const data = [];
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 3600000);
      const hour = d.getHours();
      const timeStr = `${hour.toString().padStart(2, '0')}:00`;
      
      // Office hours check (9 AM to 5 PM)
      const isOffice = hour >= 9 && hour < 17;
      let baseOverall = 0;
      if (isOffice) {
        // Peak load during office hours: 140W to 320W
        baseOverall = 140 + Math.floor(Math.sin((hour - 9) / 8 * Math.PI) * 150) + (i % 3) * 15;
      } else {
        // Low load: 20W to 50W
        baseOverall = 20 + (i % 4) * 10;
      }

      data.push({
        time: timeStr,
        overall: baseOverall,
        drawing: Math.floor(baseOverall * 0.2),
        work1: Math.floor(baseOverall * 0.4),
        work2: Math.floor(baseOverall * 0.4),
        fans: Math.floor(baseOverall * 0.65),
        lights: Math.floor(baseOverall * 0.35)
      });
    }
    return data;
  };

  // Slice history based on user selection or use 24h dynamic report
  const is24h = viewMode === '24h';
  const activeData = is24h ? get24HourData() : (() => {
    const limit = parseInt(viewMode.split('-')[1], 10) || 15;
    return history.slice(-limit);
  })();

  // Extract selected field based on filterSource
  const values = activeData.map(d => d[filterSource]);
  const maxValue = Math.max(...values, 100); // minimum scale height is 100W

  // Build SVG Path
  const width = 500;
  const height = 150;
  const paddingLeft = 40;
  const paddingRight = 10;
  const paddingTop = 15;
  const paddingBottom = 25;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Calculate coordinates
  const points = activeData.map((d, index) => {
    const val = d[filterSource];
    const x = paddingLeft + (index / (activeData.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (val / maxValue) * chartHeight;
    return { x, y, value: val, time: d.time };
  });

  // Path data string
  let pathD = "";
  let areaD = "";
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
    areaD = pathD + ` L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;
  }

  // Color scheme based on filterSource
  const getColor = () => {
    switch (filterSource) {
      case 'overall': return { line: '#3B82F6', area: 'url(#gradient-blue)', dot: '#3B82F6' };
      case 'drawing': return { line: '#A855F7', area: 'url(#gradient-purple)', dot: '#A855F7' };
      case 'work1': return { line: '#10B981', area: 'url(#gradient-emerald)', dot: '#10B981' };
      case 'work2': return { line: '#F59E0B', area: 'url(#gradient-amber)', dot: '#F59E0B' };
      case 'fans': return { line: '#06B6D4', area: 'url(#gradient-cyan)', dot: '#06B6D4' };
      case 'lights': return { line: '#EC4899', area: 'url(#gradient-pink)', dot: '#EC4899' };
      default: return { line: '#3B82F6', area: 'url(#gradient-blue)', dot: '#3B82F6' };
    }
  };

  const currentColors = getColor();

  return (
    <div className="glass-panel p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400" /> Power Load Analysis (Time-Series)
          </h2>
          <p className="text-xs text-gray-400">Analyze real-time power fluctuations across rooms & device groups</p>
        </div>

        {/* Filters and Limiters */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Source Filter Selector */}
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="bg-slate-900 border border-[#23354E] rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-[#3B82F6]"
          >
            <option value="overall">Overall Load</option>
            <option value="drawing">Drawing Room</option>
            <option value="work1">Work Room 1</option>
            <option value="work2">Work Room 2</option>
            <option value="fans">Fans Only</option>
            <option value="lights">Lights Only</option>
          </select>

          {/* Time Range Selector */}
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            className="bg-slate-900 border border-[#23354E] rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-[#3B82F6]"
          >
            <option value="live-10">Live: Last 10 updates</option>
            <option value="live-15">Live: Last 15 updates</option>
            <option value="live-25">Live: Last 25 updates</option>
            <option value="live-50">Live: Last 50 updates</option>
            <option value="24h">Analysis: Last 24 Hours</option>
          </select>
        </div>
      </div>

      {/* SVG Responsive Chart Viewport */}
      <div className="w-full bg-slate-950/80 rounded-xl p-3 border border-[#23354E]/60 relative overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
          <defs>
            {/* Gradients */}
            <linearGradient id="gradient-blue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gradient-purple" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A855F7" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gradient-emerald" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gradient-amber" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gradient-cyan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gradient-pink" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EC4899" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#EC4899" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid lines (horizontal) */}
          {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
            const y = paddingTop + chartHeight * r;
            const valLabel = Math.round(maxValue * (1 - r));
            return (
              <g key={i} className="opacity-20">
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#23354E"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#94A3B8"
                  className="text-[9px] font-mono"
                >
                  {valLabel}W
                </text>
              </g>
            );
          })}

          {/* Path Line and Filled Area */}
          {points.length > 0 && (
            <g key={filterSource}>
              <path
                d={areaD}
                fill={currentColors.area}
              />
              <path
                d={pathD}
                fill="none"
                stroke={currentColors.line}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-[0_2px_8px_rgba(59,130,246,0.3)]"
              />
            </g>
          )}

          {/* Dynamic Interactive Dots and Labels */}
          {points.map((p, index) => {
            // Show labels for endpoints and middle point
            const showLabel = index === points.length - 1 || index === 0 || (points.length > 10 && index === Math.floor(points.length / 2));
            return (
              <g key={`${index}-${p.value}`}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="3.5"
                  fill="#0B0F19"
                  stroke={currentColors.dot}
                  strokeWidth="2"
                  className="transition-all hover:r-5 cursor-pointer"
                />
                {showLabel && (
                  <g>
                    <text
                      x={p.x}
                      y={p.y - 8}
                      textAnchor="middle"
                      fill="#FFF"
                      className="text-[9px] font-bold font-mono"
                    >
                      {p.value}W
                    </text>
                    <text
                      x={p.x}
                      y={paddingTop + chartHeight + 14}
                      textAnchor="middle"
                      fill="#64748B"
                      className="text-[8px] font-mono"
                    >
                      {p.time}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
