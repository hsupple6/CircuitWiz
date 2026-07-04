# Component Catalog Plan

> **Audience:** Hobbyists and IoT makers.  
> **Layout:** Domain folders under `src/modules/` — each has `anchors.ts`, `aliases.ts`, `logic.ts`, `definitions/`.  
> **Traceability:** `core/logicIndex.ts` → `ANCHOR_LOGIC_INDEX` maps every anchor to chain/sim/shader files.

---

## Folder Layout

```
modules/
  core/           registry, logicModule, kicadSymbolMap, allAliases, logicIndex
  passives/       Resistor, Capacitor, Inductor + aliases
  power/          PowerSupply, ACSource + aliases
  semiconductors/ Diode, transistors, OpAmp, … + aliases
  switches/       Switch, Push Button, Limit Switch + aliases
  output/         LED, Motor, Buzzer, … + aliases + voltageFlow/
  drivers/        Motor/LED/Display/Relay/Audio/Power/Serial drivers + aliases
  sensors/        Temperature Sensor
  microcontrollers/ Arduino, ESP32 + voltageFlow/
  connectors/     N-Pin Terminal blocks + aliases
  organization/   Group Box
  types/          shared ModuleDefinition, ModuleType schemas
  componentPlan.md
```

**Disposition:** ✓ HAVE = anchor · ✓ alias = registered alias · → ADD = bottom section

---

## Current Inventory

**38 anchors** + **90 aliases** (approx.; ESP32 disabled)

Alias source: domain `aliases.ts` files aggregated in `core/allAliases.ts`.  
Logic trace: `core/logicIndex.ts` → `ANCHOR_LOGIC_INDEX[anchorId]`.

---

## Registered — Passives

| Item | Status | Anchor |
|---|---|---|
| Resistor | ✓ HAVE | — |
| Capacitor | ✓ HAVE | — |
| Inductor | ✓ HAVE | — |
| Current Sense Resistor | ✓ alias | Resistor |
| Ceramic / Electrolytic / Tantalum / Polymer / Film / Supercapacitor | ✓ alias | Capacitor |
| Power / RF Inductor | ✓ alias | Inductor |
| NTC / PTC Thermistor | ✓ alias | Resistor |
| Ferrite Bead | ✓ alias | Resistor |
| Fuse | ✓ alias | Resistor |
| MOV (Varistor) | ✓ alias | Resistor |
| Crystal | ✓ alias | Resistor |
| Photodiode | ✓ alias | Resistor |
| Photoresistor / Moisture / Rain | ✓ alias | Resistor |

---

## Registered — Semiconductors

| Item | Status | Anchor |
|---|---|---|
| Diode, Zener, NPN, PNP, NMOS, PMOS, OpAmp, Bridge | ✓ HAVE | — |
| Rectifier / Signal / Schottky / ESD / Reverse Polarity | ✓ alias | Diode |
| TVS / TVS Diode | ✓ alias | ZenerDiode |
| Darlington / Phototransistor | ✓ alias | NPNTransistor |
| 2N3906 / IRF9540 | ✓ alias | PNPTransistor / PMOSFET |
| Buffer Amplifier | ✓ alias | OpAmp |

---

## Registered — Connectors

| Item | Status | Anchor |
|---|---|---|
| N Pin Connector | ✓ HAVE | — (configure pins + plug/socket at placement) |

---

## Registered — Power

| Item | Status | Anchor |
|---|---|---|
| PowerSupply, AC Source | ✓ HAVE | — |
| Battery, Battery Holder, Coin Cell, Barrel Jack | ✓ alias | PowerSupply |

---

## Registered — Output

| Item | Status | Anchor |
|---|---|---|
| LED, RGB LED, Motor, Stepper Motor, Buzzer, Speaker, Servo, Potentiometer | ✓ HAVE | — |
| Variable / Trimmer Pot | ✓ alias | Potentiometer |
| IR / UV LED | ✓ alias | LED |
| Common Cathode RGB LED | ✓ alias | RGBLED |
| DC / Brushed / Brushless Motor | ✓ alias | Motor |
| NEMA 17 Stepper | ✓ alias | StepperMotor |
| Piezo Buzzer, Solenoid, Heater, Fan | ✓ alias | Buzzer |
| Vibration Sensor | ✓ alias | Buzzer |

---

## Registered — Drivers

| Item | Status | Anchor |
|---|---|---|
| Stepper Driver, Brushed Motor Driver, BLDC ESC, LED/Display/Relay/Audio/Power/Serial Driver | ✓ HAVE | — |
| A4988 / DRV8825 / TMC2208 | ✓ alias | StepperDriver |
| L298N / DRV8833 / TB6612 | ✓ alias | BrushedDriver |
| 20A 2S … 120A 12S ESC | ✓ alias | EscDriver |
| SSD1306 / ILI9341 / HD44780 | ✓ alias | DisplayDriver |
| Relay / ULN2003 / Solenoid | ✓ alias | RelayDriver |
| CP2102 / CH340 / Level Shifter | ✓ alias | SerialDriver |

Stepper: STEP/DIR/EN → A+/A−/B+/B−. ESC: PWM → U/V/W (wire to Motor IN1–IN3). Display/USB/BEC/audio SPK pins are **dummy**.

---

## Registered — Switches, Sensors, Processing, Org

| Item | Status | Anchor |
|---|---|---|
| Switch, Push Button, Limit Switch | ✓ HAVE | — |
| Reed Switch, Relay, DIP Switch, Jumper | ✓ alias | Switch |
| Tilt Sensor | ✓ alias | Push Button |
| Temperature Sensor | ✓ HAVE | — |
| Arduino Uno R3, ESP32 (disabled) | ✓ HAVE | — |
| Group Box | ✓ HAVE | — |

---

# Still To Build (→ ADD)

## Planned Categories

`modules` · `power-ics` · `test` (Jumper uses `test` category today)

## Needs New Symbol / Logic

| Item | Notes |
|---|---|
| Comparator, Voltage Reference | analog IC |
| Logic Gate, Timer 555 | education |
| Optocoupler, IR Receiver | isolation / module |
| LDO, DC-DC, Charger | power-ics (PowerDriver block exists as alias) |
| MEMS Oscillator, RTC | timing |
| ESP8266 / Pico / Blue Pill | board pin maps |
| Seven Seg / Matrix / LCD modules | Full panel sim (driver block exists with dummy pins) |
| Rotary Encoder, Keypad, Joystick | HMI |
| Humidity, IMU, GPS, … | Module Block |
| All wireless | Module Block |

## Review / Enhance

| Item | Notes |
|---|---|
| Current Sense Resistor | current-derived R in sim |
| Temperature Sensor | finish chain + sim |
| Module Block | generic sensor/wireless wrapper (deferred) |

## Priorities

P0 Module Block (deferred) · ~~P0 N-Pin connectors~~ · ~~P1 PNP/P-MOSFET~~ · ~~P1 RGB LED~~ · ~~P1 Stepper shader~~ · P2 Logic Gate · P3 DC-DC sim
