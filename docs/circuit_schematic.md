# Hardware/Electrical Schematic Reference (Wokwi ESP32 Setup)

This document provides instructions on how to design and wire the hardware control system in **Wokwi** or **Tinkercad**. To keep things simple and readable, you do not need to wire all 18 devices; a representative circuit for one room (e.g., Drawing Room: 2 fans, 3 lights) is sufficient.

## 1. System Overview

We will use an **ESP32 microcontroller** as our central controller. Since fans and lights run on mains AC voltages (e.g., 220V) in real life, a low-voltage microcontroller cannot power them directly. Instead, we use an **Active-Low or Active-High 5V Relay Module** acting as switches.
- **Microcontroller**: ESP32 (38-pin version).
- **Relay Modules**: 5-Channel Relay Board (or five separate Single-Channel Relays).
- **Actuators/Outputs**: 
  - **Fans**: Represented by **DC Motors** or **LEDs** (blue/green) in Wokwi.
  - **Lights**: Represented by **LEDs** (yellow) in Wokwi.
- **Power**: 
  - ESP32 is powered via Micro-USB (5V).
  - Relay module coils are powered from the ESP32's `VIN` (5V) pin.
  - LEDs/motors use external power or breadboard rails.

---

## 2. Pin Mapping Table

| Device Name | Device Type | ESP32 GPIO Pin | Relay Channel | Indicator Color (Wokwi LED) | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Fan 1** | Fan | **GPIO 12** | Channel 1 | Blue | Fan 1 toggle relay control |
| **Fan 2** | Fan | **GPIO 14** | Channel 2 | Blue | Fan 2 toggle relay control |
| **Light 1** | Light | **GPIO 27** | Channel 3 | Yellow | Light 1 toggle relay control |
| **Light 2** | Light | **GPIO 26** | Channel 4 | Yellow | Light 2 toggle relay control |
| **Light 3** | Light | **GPIO 25** | Channel 5 | Yellow | Light 3 toggle relay control |

---

## 3. Connection List (Step-by-Step Wiring)

### Power Connections
1. Connect ESP32 `GND` to the Breadboard `-` (GND) rail.
2. Connect ESP32 `VIN` (which outputs 5V from USB) to the Breadboard `+` (5V) rail.
3. Connect the Relay Module's `VCC` pin to the Breadboard `+` (5V) rail.
4. Connect the Relay Module's `GND` pin to the Breadboard `-` (GND) rail.

### Control Signals
1. Connect ESP32 pin `G12` to Relay Input `IN1`.
2. Connect ESP32 pin `G14` to Relay Input `IN2`.
3. Connect ESP32 pin `G27` to Relay Input `IN3`.
4. Connect ESP32 pin `G26` to Relay Input `IN4`.
5. Connect ESP32 pin `G25` to Relay Input `IN5`.

### Load (LED / Motor) Connections
For each of the 5 channels on the Relay:
1. Connect the Relay's **Common (COM)** terminal to the anode (longer leg) of the corresponding LED/Motor through a **220Ω Current Limiting Resistor**.
2. Connect the Relay's **Normally Open (NO)** terminal to the Breadboard `+` (5V) rail.
3. Connect the cathode (shorter leg) of each LED to the Breadboard `-` (GND) rail.

---

## 4. Electrical Reasoning

1. **Isolation**: Microcontrollers operate at 3.3V/5V logic, which is too low to drive relays directly if the coils draw too much current. Using opto-isolated relay boards prevents back-EMF (Electromagnetic Interference) spikes from damaging the ESP32 pins.
2. **Normally Open (NO) vs Normally Closed (NC)**: We wire the LEDs to the Normally Open terminal. This ensures that if the microcontroller loses power or restarts, the relays will default to open (OFF), ensuring safety (fail-safe status).
3. **Resistors**: Standard Wokwi LEDs will burn out if connected directly to 5V. The **220Ω resistor** limits the forward current to approximately 10–15mA, which is safe and provides good brightness.
