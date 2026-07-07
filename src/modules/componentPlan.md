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
  wireless/       Antenna, Bluetooth module + aliases
  organization/   Group Box
  types/          shared ModuleDefinition, ModuleType schemas
  componentPlan.md
```

**Disposition:** ✓ HAVE = anchor · ✓ alias = registered alias · → ADD = bottom section

---

## Current Inventory

**47 anchors** + **~90 aliases** (approx.; ESP32 disabled). Spec variants (cell count, mAh, amps, watts) use the **placement configurator** — not separate palette entries.

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
| Li Ion Battery Module | ✓ HAVE | — (configure **S/P** + per-cell **mAh** at placement) |
| Charger Protection | ✓ HAVE | — (configure **S** at placement) |

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
| Buck / Boost / Charging / Level Indicator / USB PD Decoy | ✓ HAVE | — |
| A4988 / DRV8825 / TMC2208 | ✓ alias | StepperDriver |
| L298N / DRV8833 / TB6612 | ✓ alias | BrushedDriver |
| BLDC ESC | ✓ HAVE | EscDriver (configure **A** + **S** at placement) |
| SSD1306 / ILI9341 / HD44780 | ✓ alias | DisplayDriver |
| Relay / ULN2003 / Solenoid | ✓ alias | RelayDriver |
| LDO Regulator | ✓ alias | PowerDriver |
| Buck Converter | ✓ HAVE | PowerDriver (configure **V** + **W** at placement) |
| Charging Module | ✓ HAVE | ChargerDriver (configure **W** + aux **V** at placement) |
| CP2102 / CH340 / Level Shifter | ✓ alias | SerialDriver |

Stepper: STEP/DIR/EN → A+/A−/B+/B−. ESC: PWM → U/V/W. Configurable modules open a placement dialog like passives (resistor value picker).

---

## Registered — Switches, Sensors, Processing, Org

| Item | Status | Anchor |
|---|---|---|
| Switch, Push Button, Limit Switch | ✓ HAVE | — |
| Reed Switch, Relay, DIP Switch, Jumper | ✓ alias | Switch |
| Miniature Relay | ✓ alias | Switch |
| Tilt Sensor | ✓ alias | Push Button |
| Temperature Sensor | ✓ HAVE | — |
| Arduino Uno R3, ESP32 (disabled) | ✓ HAVE | — |
| Group Box | ✓ HAVE | — |

---

## Registered — Wireless

| Item | Status | Anchor |
|---|---|---|
| Antenna, Bluetooth Module, Wireless Charger | ✓ HAVE | — |
| PCB / Whip / Dipole / LoRa / WiFi / SMA / U.FL Antenna | ✓ alias | Antenna |
| HC-05 / HC-06 / HM-10 / RN42 / nRF52840 | ✓ alias | BluetoothModule |

Wireless Charger: configure **W** at placement.

---

# Still To Build (→ ADD)

## Planned Categories

`modules` · `power-ics` · `test` (Jumper uses `test` category today)

**Ordering:** Needs are ranked by **usage flexibility** — items at the top reuse across the most project types; items at the bottom are single-purpose, deferred, or enhancement-only.

---

## Tier 1 — Universal building blocks

Reusable across analog, digital, power, and education projects. Highest leverage anchors.

| Item | Proposed anchor | Varying spec | Notes |
|---|---|---|---|
| Logic Gate | `LogicGate` | gate type (AND/OR/NOT/…) | Fundamental digital; education + glue logic |
| Comparator | `Comparator` | reference V, hysteresis | Thresholds, zero-cross, window detect |
| Timer 555 | `Timer555` | mode (astable/monostable) | Delays, oscillators, PWM, one-shots |
| Optocoupler | `Optocoupler` | CTR, Viso | Isolation for power, motor, and safety |
| Voltage Reference | `VoltageReference` | Vref | Comparators, ADC refs, precision dividers |

---

## Tier 2 — Domain staples

Common in portable, IoT, and maker power/HMI designs. Often paired (battery + charger + protection).

| Item | Proposed anchor | Varying spec | Notes |
|---|---|---|---|
| Rotary Encoder | `RotaryEncoder` | detents, PPR | Knobs, menus, motor feedback |
| ESP8266 / Pico / Blue Pill | board anchors | pin map | Extend microcontroller domain |

---

## Tier 3 — Application modules

Useful but tied to a product shape or interface. Build after Tier 1–2 anchors exist.

| Item | Proposed anchor | Varying spec | Notes |
|---|---|---|---|
| IR Receiver | `IRReceiver` | carrier freq | Remotes, beam-break modules |
| Seven Seg / Matrix / LCD modules | panel anchors | digit count, interface | Full panel sim; `DisplayDriver` block has dummy comm pins |
| Keypad, Joystick | HMI anchors | layout | Input modules |
| MEMS Oscillator, RTC | timing anchors | freq, I2C/SPI | Clock sources beyond `Crystal` alias |
| Humidity, IMU, GPS, … | sensor module anchors | bus, range | Module-style sensors (not bare `Resistor` shims) |
| WiFi / LoRa / nRF24 / ESP-01 | wireless module anchors | protocol | Extend `wireless/` beyond Antenna + Bluetooth |

---

## Tier 4 — Enhance, defer, or narrow

Existing anchors that need sim/UI work, or infrastructure deferred until Tier 1–3 land.

| Item | Target | Notes |
|---|---|---|
| Current Sense Resistor | `Resistor` alias | current-derived R in sim |
| Temperature Sensor | `Temperature Sensor` | finish chain + sim |
| PowerDriver DC-DC sim | `PowerDriver` | P3: regulated VIN→VOUT behavior, dropout, load limits |
| Module Block | generic wrapper | Deferred generic sensor/wireless shell |

---

## Priorities

**Next anchors:** `LogicGate` · `Comparator` · `Timer555` · `RotaryEncoder`  
**Deferred:** Module Block · full DC-DC/charge CC/CV sim (P3)

**Done:** ~~N-Pin connectors~~ · ~~PNP/P-MOSFET~~ · ~~RGB LED~~ · ~~Stepper shader~~ · ~~Wireless (Antenna + Bluetooth)~~ · ~~Power/charging stack (BoostDriver, ChargerDriver, LiIonPack, ChargerProtection, LevelIndicator, UsbPdDecoy, WirelessCharger)~~
