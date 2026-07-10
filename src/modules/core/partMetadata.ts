/** Manufacturer ordering / catalog part number for BOM and datasheet export. */
export interface PartMetadata {
  partNumber: string
  manufacturer?: string
  datasheet?: string
}

/**
 * Canonical part numbers keyed by module registry name.
 * Generic anchors use a common reference part; aliases use specific orderable PNs.
 */
export const PART_METADATA: Record<string, PartMetadata> = {
  // ── Microcontrollers ──────────────────────────────────────────────────────
  'Arduino Uno R3': {
    partNumber: 'A000066',
    manufacturer: 'Arduino',
    datasheet: 'https://docs.arduino.cc/resources/datasheets/A000066-datasheet.pdf',
  },
  ESP32: {
    partNumber: 'ESP32-WROOM-32E-N8',
    manufacturer: 'Espressif',
    datasheet: 'https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32e_esp32-wroom-32ue_datasheet_en.pdf',
  },

  // ── Power anchors ─────────────────────────────────────────────────────────
  PowerSupply: {
    partNumber: 'RS-15-5',
    manufacturer: 'MEAN WELL',
    datasheet: 'https://www.meanwell.com/webapp/product/search.aspx?prod=RS-15',
  },
  ACSource: {
    partNumber: '17301055000',
    manufacturer: 'Würth Elektronik',
    datasheet: 'https://www.we-online.com/components/products/17301055000',
  },
  LiIonPack: {
    partNumber: 'INR18650-35E',
    manufacturer: 'Samsung SDI',
    datasheet: 'https://www.samsung.com/global/business/energy/sdi/product/product-info.html',
  },
  ChargerProtection: {
    partNumber: 'S-8254AAFTT-G1',
    manufacturer: 'ABLIC',
    datasheet: 'https://www.ablic.com/en/doc/datasheet/battery_protection/S8254A_E.pdf',
  },

  // ── Power aliases ─────────────────────────────────────────────────────────
  Battery: {
    partNumber: '522',
    manufacturer: 'Energizer',
    datasheet: 'https://data.energizer.com/pdfs/522.pdf',
  },
  'Battery Holder': {
    partNumber: '2462',
    manufacturer: 'Keystone Electronics',
    datasheet: 'https://www.keyelco.com/product-pdf.cfm?p=2462',
  },
  'Coin Cell Holder': {
    partNumber: '103',
    manufacturer: 'Keystone Electronics',
    datasheet: 'https://www.keyelco.com/product-pdf.cfm?p=103',
  },
  'Barrel Jack': {
    partNumber: 'PJ-002A',
    manufacturer: 'CUI Devices',
    datasheet: 'https://www.cuidevices.com/product/resource/pj-002a.pdf',
  },

  // ── Passives anchors ──────────────────────────────────────────────────────
  Resistor: {
    partNumber: 'RC0603FR-0710KL',
    manufacturer: 'Yageo',
    datasheet: 'https://www.yageogroup.com/content/datasheet/asset/file/PYU-RC_GROUP_51_ROHS_L',
  },
  Capacitor: {
    partNumber: 'CL10B104KB8NNNC',
    manufacturer: 'Samsung Electro-Mechanics',
    datasheet: 'https://product.samsungsem.com/product/ceramic-capacitor/mlcc.do',
  },
  Inductor: {
    partNumber: 'LPS4018-103MRB',
    manufacturer: 'Coilcraft',
    datasheet: 'https://www.coilcraft.com/getmedia/2ede8c69-7e41-4b5c-9f0e-8c8e8e8e8e8e/doc0694.pdf',
  },
  Potentiometer: {
    partNumber: 'EVU-F2MFL3D14',
    manufacturer: 'Panasonic',
    datasheet: 'https://industrial.panasonic.com/products/pt/evu-f2mfl3d14',
  },

  // ── Passives aliases ──────────────────────────────────────────────────────
  'Current Sense Resistor': {
    partNumber: 'WSL2512R1000FEA',
    manufacturer: 'Vishay',
    datasheet: 'https://www.vishay.com/docs/30100/wsl.pdf',
  },
  'Ceramic Capacitor': {
    partNumber: 'CL10B104KB8NNNC',
    manufacturer: 'Samsung Electro-Mechanics',
  },
  'Electrolytic Capacitor': {
    partNumber: 'EEE-FK1C101P',
    manufacturer: 'Panasonic',
    datasheet: 'https://industrial.panasonic.com/products/pt/eee-fk1c101p',
  },
  'Tantalum Capacitor': {
    partNumber: 'T491A106K010AT',
    manufacturer: 'KEMET',
    datasheet: 'https://www.kemet.com/en/us/technical-resources/datasheets/t491-series.html',
  },
  'Polymer Capacitor': {
    partNumber: '16SVP100M',
    manufacturer: 'Panasonic',
    datasheet: 'https://industrial.panasonic.com/products/pt/16svp100m',
  },
  'Film Capacitor': {
    partNumber: 'ECQ-E2104KF',
    manufacturer: 'Panasonic',
    datasheet: 'https://industrial.panasonic.com/products/pt/ecq-e2104kf',
  },
  Supercapacitor: {
    partNumber: 'BCAP0350 E270 T11',
    manufacturer: 'Maxwell Technologies',
    datasheet: 'https://www.maxwell.com/products/ultracapacitors/k2-series',
  },
  'Power Inductor': {
    partNumber: 'SRP1038A-100M',
    manufacturer: 'Bourns',
    datasheet: 'https://www.bourns.com/docs/Product-Datasheets/SRP1038A.pdf',
  },
  'RF Inductor': {
    partNumber: 'LQW15AN2N2B00D',
    manufacturer: 'Murata',
    datasheet: 'https://www.murata.com/en-us/products/productdetail?partno=LQW15AN2N2B00%23',
  },
  'Variable Resistor': {
    partNumber: 'EVU-F2MFL3D14',
    manufacturer: 'Panasonic',
  },
  'Trimmer Potentiometer': {
    partNumber: '3362P-1-103LF',
    manufacturer: 'Bourns',
    datasheet: 'https://www.bourns.com/docs/Product-Datasheets/3362.pdf',
  },
  'NTC Thermistor': {
    partNumber: 'NTCG163JF103FT1',
    manufacturer: 'TDK',
    datasheet: 'https://product.tdk.com/info/en/documents/data_sheet/ntc_thermistor_ntcg_e.pdf',
  },
  'PTC Thermistor': {
    partNumber: 'MF-R110-2',
    manufacturer: 'Bourns',
    datasheet: 'https://www.bourns.com/docs/Product-Datasheets/MF-R.pdf',
  },
  'Ferrite Bead': {
    partNumber: 'BLM18PG121SN1D',
    manufacturer: 'Murata',
    datasheet: 'https://www.murata.com/en-us/products/productdetail?partno=BLM18PG121SN1%23',
  },
  Fuse: {
    partNumber: '0251005.MRT',
    manufacturer: 'Littelfuse',
    datasheet: 'https://www.littelfuse.com/products/fuses-overcurrent-protection/fuses/surface-mount-fuses/0251-series',
  },
  'MOV (Varistor)': {
    partNumber: 'V14MLA1210H',
    manufacturer: 'Littelfuse',
    datasheet: 'https://www.littelfuse.com/products/varistors-metal-oxide-varistors-movs/mla-series',
  },
  Crystal: {
    partNumber: 'ABM3-16.000MHZ-B2-T',
    manufacturer: 'Abracon',
    datasheet: 'https://abracon.com/Resonators/ABM3.pdf',
  },
  Photodiode: {
    partNumber: 'BPW34',
    manufacturer: 'Vishay',
    datasheet: 'https://www.vishay.com/docs/81521/bpw34.pdf',
  },
  Photoresistor: {
    partNumber: 'GL5528',
    manufacturer: 'Advanced Photonix',
    datasheet: 'https://www.mouser.com/datasheet/2/307/GL5528-1194445.pdf',
  },
  'Moisture Sensor': {
    partNumber: 'FC-28',
    manufacturer: 'Generic',
  },
  'Rain Sensor': {
    partNumber: 'YL-83',
    manufacturer: 'Generic',
  },

  // ── Semiconductors anchors ────────────────────────────────────────────────
  Diode: {
    partNumber: '1N4148W-TP',
    manufacturer: 'Micro Commercial Components',
    datasheet: 'https://www.mccsemi.com/products/diodes/signal-diodes/1N4148W-TP',
  },
  ZenerDiode: {
    partNumber: '1N4733A',
    manufacturer: 'Micro Commercial Components',
    datasheet: 'https://www.mccsemi.com/products/diodes/zener-diodes/1N4733A',
  },
  NPNTransistor: {
    partNumber: '2N3904-AP',
    manufacturer: 'Micro Commercial Components',
    datasheet: 'https://www.mccsemi.com/products/transistors/bipolar-transistors/2N3904-AP',
  },
  PNPTransistor: {
    partNumber: '2N3906-AP',
    manufacturer: 'Micro Commercial Components',
    datasheet: 'https://www.mccsemi.com/products/transistors/bipolar-transistors/2N3906-AP',
  },
  MOSFET: {
    partNumber: 'IRFZ44NPBF',
    manufacturer: 'Infineon',
    datasheet: 'https://www.infineon.com/cms/en/product/power/mosfet/20v-800v-silicon-carbide-sic-mosfet/irfz44n/',
  },
  PMOSFET: {
    partNumber: 'IRF9540NPBF',
    manufacturer: 'Infineon',
    datasheet: 'https://www.infineon.com/cms/en/product/power/mosfet/20v-800v-silicon-carbide-sic-mosfet/irf9540/',
  },
  OpAmp: {
    partNumber: 'LM358DR',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/LM358',
  },
  BridgeRectifier: {
    partNumber: 'DB107',
    manufacturer: 'Diodes Incorporated',
    datasheet: 'https://www.diodes.com/part/view/DB107',
  },

  // ── Semiconductors aliases ────────────────────────────────────────────────
  'Rectifier Diode': {
    partNumber: '1N4007-TP',
    manufacturer: 'Micro Commercial Components',
    datasheet: 'https://www.mccsemi.com/products/diodes/rectifier-diodes/1N4007-TP',
  },
  'Small Signal Diode': {
    partNumber: '1N4148W-TP',
    manufacturer: 'Micro Commercial Components',
  },
  'Schottky Diode': {
    partNumber: '1N5819-TP',
    manufacturer: 'Micro Commercial Components',
    datasheet: 'https://www.mccsemi.com/products/diodes/schottky-diodes/1N5819-TP',
  },
  'Fast Recovery Diode': {
    partNumber: 'FR107-TP',
    manufacturer: 'Micro Commercial Components',
    datasheet: 'https://www.mccsemi.com/products/diodes/fast-recovery-diodes/FR107-TP',
  },
  'ESD Protection Diode': {
    partNumber: 'PESD5V0S1BA',
    manufacturer: 'Nexperia',
    datasheet: 'https://www.nexperia.com/product/PESD5V0S1BA',
  },
  'Reverse Polarity Protection': {
    partNumber: 'SS34',
    manufacturer: 'Vishay',
    datasheet: 'https://www.vishay.com/docs/88503/ss34.pdf',
  },
  TVS: {
    partNumber: 'SMAJ5.0A',
    manufacturer: 'Littelfuse',
    datasheet: 'https://www.littelfuse.com/products/tvs-diodes/smaj-series',
  },
  'TVS Diode': {
    partNumber: 'SMAJ5.0A',
    manufacturer: 'Littelfuse',
  },
  'Darlington Pair': {
    partNumber: 'ULN2003AN',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/ULN2003A',
  },
  Phototransistor: {
    partNumber: 'LTR-3208E',
    manufacturer: 'Lite-On',
    datasheet: 'https://www.liteon.com/en-global/product/detail?productId=123',
  },
  '2N3906 PNP Transistor': {
    partNumber: '2N3906-AP',
    manufacturer: 'Micro Commercial Components',
  },
  'IRF9540 P-Channel MOSFET': {
    partNumber: 'IRF9540NPBF',
    manufacturer: 'Infineon',
  },
  'Buffer Amplifier': {
    partNumber: '74HC125N',
    manufacturer: 'Nexperia',
    datasheet: 'https://www.nexperia.com/product/74HC125N',
  },

  // ── Switches anchors ──────────────────────────────────────────────────────
  Switch: {
    partNumber: 'JS202011CQN',
    manufacturer: 'C&K',
    datasheet: 'https://www.ckswitches.com/media/1316/js.pdf',
  },
  'Push Button': {
    partNumber: 'EVQQ2KA04W',
    manufacturer: 'Panasonic',
    datasheet: 'https://industrial.panasonic.com/products/pt/evqq2ka04w',
  },
  'Limit Switch': {
    partNumber: 'V15W22-D24-K',
    manufacturer: 'Honeywell',
    datasheet: 'https://sensing.honeywell.com/honeywell-sensing-microswitch-basic-switch-v15-series-datasheet-32314408-e-en.pdf',
  },

  // ── Switches aliases ──────────────────────────────────────────────────────
  'Reed Switch': {
    partNumber: '59140-1-S-00-A',
    manufacturer: 'Littelfuse',
    datasheet: 'https://www.littelfuse.com/products/magnetic-sensors-reed-switches/reed-switches',
  },
  Relay: {
    partNumber: 'G5LE-1-DC5',
    manufacturer: 'Omron',
    datasheet: 'https://components.omron.com/us-en/products/relays/g5le',
  },
  'Miniature Relay': {
    partNumber: 'G5V-2-DC5',
    manufacturer: 'Omron',
    datasheet: 'https://components.omron.com/us-en/products/relays/g5v-2',
  },
  'DIP Switch': {
    partNumber: '219-4MS',
    manufacturer: 'CTS',
    datasheet: 'https://www.ctscorp.com/Products/DIP-Switches',
  },
  Jumper: {
    partNumber: 'TSW-103-07-G-S',
    manufacturer: 'Samtec',
    datasheet: 'https://suddendocs.samtec.com/catalog_english/tsw.pdf',
  },

  // ── Output anchors ────────────────────────────────────────────────────────
  LED: {
    partNumber: 'LTL-4233',
    manufacturer: 'Lite-On',
    datasheet: 'https://www.liteon.com/en-global/product/detail?productId=123',
  },
  RGBLED: {
    partNumber: 'WP154A4SEJ3VBDZGC/CA',
    manufacturer: 'Kingbright',
    datasheet: 'https://www.kingbrightusa.com/images/catalog/spec/WP154A4SEJ3VBDZGC_CA.pdf',
  },
  Motor: {
    partNumber: 'FA-130RA-22750',
    manufacturer: 'Mabuchi',
    datasheet: 'https://www.mabuchi-motor.co.jp/en-US/product/detail/FA-130RA-22750',
  },
  StepperMotor: {
    partNumber: '17HS13-0404S',
    manufacturer: 'OMC Stepperonline',
    datasheet: 'https://www.omc-stepperonline.com/nema-17-bipolar-40mm-stepper-1a-13ncm-17hs13-0404s-p-268.html',
  },
  Buzzer: {
    partNumber: 'CPT-9019A-SMT-TR',
    manufacturer: 'CUI Devices',
    datasheet: 'https://www.cuidevices.com/product/resource/cpt-9019a-smt-tr.pdf',
  },
  Speaker: {
    partNumber: 'AS01508MR-R',
    manufacturer: 'PUI Audio',
    datasheet: 'https://www.puiaudio.com/product-detail/as01508mr-r',
  },
  Servo: {
    partNumber: 'S3003',
    manufacturer: 'Futaba',
    datasheet: 'https://www.futabarc.com/servos/standard-servos/s3003/',
  },

  // ── Output aliases ────────────────────────────────────────────────────────
  'Infrared LED': {
    partNumber: 'TSAL6400',
    manufacturer: 'Vishay',
    datasheet: 'https://www.vishay.com/docs/81315/tsal6400.pdf',
  },
  'UV LED': {
    partNumber: 'LZ1-00UV00',
    manufacturer: 'LED Engin',
    datasheet: 'https://www.ledengin.com/products/lz1/',
  },
  'Common Cathode RGB LED': {
    partNumber: 'WP154A4SEJ3VBDZGC/CA',
    manufacturer: 'Kingbright',
  },
  'DC Motor': {
    partNumber: 'FA-130RA-22750',
    manufacturer: 'Mabuchi',
  },
  'Brushed Motor': {
    partNumber: 'FA-130RA-22750',
    manufacturer: 'Mabuchi',
  },
  'Brushless Motor': {
    partNumber: 'A2212/13T',
    manufacturer: 'DYS',
    datasheet: 'https://www.hobbywing.com/en/products/xrotor-micro-30a--40a-blheli_32-dshot1200179',
  },
  'NEMA 17 Stepper': {
    partNumber: '17HS13-0404S',
    manufacturer: 'OMC Stepperonline',
  },
  'Stepper Motor': {
    partNumber: '17HS13-0404S',
    manufacturer: 'OMC Stepperonline',
  },
  'Piezo Buzzer': {
    partNumber: 'ABT-408-RC',
    manufacturer: 'Mallory Sonalert',
    datasheet: 'https://www.mspindy.com/products/piezo-buzzers-transducers/abt-408-rc',
  },
  Solenoid: {
    partNumber: 'DS-132-9',
    manufacturer: 'Deltrol Controls',
    datasheet: 'https://www.deltrolcontrols.com/products/solenoids',
  },
  Heater: {
    partNumber: 'R50D2-11',
    manufacturer: 'Watlow',
    datasheet: 'https://www.watlow.com/en/products/heaters',
  },
  Fan: {
    partNumber: 'MF40101V2-1000U-A99',
    manufacturer: 'Sunon',
    datasheet: 'https://www.sunon.com/us/M/productdetail/DC_Fans/MF40101V2-1000U-A99',
  },
  'Vibration Sensor': {
    partNumber: 'SW-420',
    manufacturer: 'Generic',
  },

  // ── Driver anchors ────────────────────────────────────────────────────────
  StepperDriver: {
    partNumber: 'A4988SETTR-T',
    manufacturer: 'Allegro MicroSystems',
    datasheet: 'https://www.allegromicro.com/en/products/motor-drivers-gate-drivers/brush-dc-motor-drivers/a4988',
  },
  BrushedDriver: {
    partNumber: 'DRV8833PWPR',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/DRV8833',
  },
  EscDriver: {
    partNumber: '30901077',
    manufacturer: 'Hobbywing',
    datasheet: 'https://www.hobbywing.com/en/products/xrotor-micro-30a--40a-blheli_32-dshot1200179',
  },
  LEDDriver: {
    partNumber: 'TLC5940NT',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/TLC5940',
  },
  DisplayDriver: {
    partNumber: 'SSD1306',
    manufacturer: 'Solomon Systech',
    datasheet: 'https://www.solomon-systech.com/product/ssd1306/',
  },
  RelayDriver: {
    partNumber: 'ULN2003AN',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/ULN2003A',
  },
  AudioDriver: {
    partNumber: 'LM386N-1/NOPB',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/LM386',
  },
  PowerDriver: {
    partNumber: 'LM2596S-5.0',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/LM2596',
  },
  SerialDriver: {
    partNumber: 'CP2102N-A02-GQFN24',
    manufacturer: 'Silicon Labs',
    datasheet: 'https://www.silabs.com/interface/usb-bridges/classic/device.cp2102n',
  },
  BoostDriver: {
    partNumber: 'MT3608',
    manufacturer: 'Aerosemi',
    datasheet: 'https://www.aerosemi.com/MT3608.html',
  },
  ChargerDriver: {
    partNumber: 'TP4056',
    manufacturer: 'NanJing Top Power',
    datasheet: 'https://www.analog.com/media/en/technical-documentation/data-sheets/TP4056.pdf',
  },
  LevelIndicator: {
    partNumber: 'LM3914N-1/NOPB',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/LM3914',
  },
  UsbPdDecoy: {
    partNumber: 'IP2721',
    manufacturer: 'Injoinic',
    datasheet: 'http://www.injoinic.com/product_detail.php?id=36',
  },

  // ── Driver aliases ────────────────────────────────────────────────────────
  'A4988 Stepper Driver': {
    partNumber: 'A4988SETTR-T',
    manufacturer: 'Allegro MicroSystems',
    datasheet: 'https://www.allegromicro.com/en/products/motor-drivers-gate-drivers/brush-dc-motor-drivers/a4988',
  },
  'DRV8825 Stepper Driver': {
    partNumber: 'DRV8825PWP',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/DRV8825',
  },
  'TMC2208 Stepper Driver': {
    partNumber: 'TMC2208-LA-T',
    manufacturer: 'Trinamic',
    datasheet: 'https://www.analog.com/media/en/dsp-documentation/data-sheets/tmc2208_datasheet_rev1.09.pdf',
  },
  'L298N Motor Driver': {
    partNumber: 'L298N',
    manufacturer: 'STMicroelectronics',
    datasheet: 'https://www.st.com/resource/en/datasheet/l298.pdf',
  },
  'DRV8833 Motor Driver': {
    partNumber: 'DRV8833PWPR',
    manufacturer: 'Texas Instruments',
  },
  'TB6612 Motor Driver': {
    partNumber: 'TB6612FNG,C,EL',
    manufacturer: 'Toshiba',
    datasheet: 'https://www.toshiba.semicon-storage.com/us/semiconductor/product/motor-driver-ics/brush-motor-driver-ics/detail.TB6612FNG.html',
  },
  'BLDC ESC': {
    partNumber: '30901077',
    manufacturer: 'Hobbywing',
    datasheet: 'https://www.hobbywing.com/en/products/xrotor-micro-30a--40a-blheli_32-dshot1200179',
  },
  '30A 3S ESC': {
    partNumber: '30901075',
    manufacturer: 'Hobbywing',
    datasheet: 'https://www.hobbywing.com/en/products/xrotor-micro-blheli-s-30a-dshot600185',
  },
  'Constant Current LED Driver': {
    partNumber: 'AL8805W5-7',
    manufacturer: 'Diodes Incorporated',
    datasheet: 'https://www.diodes.com/part/view/AL8805',
  },
  'PWM LED Driver': {
    partNumber: 'TLC5940NT',
    manufacturer: 'Texas Instruments',
  },
  'SSD1306 OLED Driver': {
    partNumber: 'SSD1306',
    manufacturer: 'Solomon Systech',
    datasheet: 'https://www.solomon-systech.com/product/ssd1306/',
  },
  'ILI9341 TFT Driver': {
    partNumber: 'ILI9341',
    manufacturer: 'Ilitek',
    datasheet: 'https://www.displayfuture.com/Display/datasheet/controller/ILI9341.pdf',
  },
  'HD44780 LCD Driver': {
    partNumber: 'HD44780U',
    manufacturer: 'Hitachi',
    datasheet: 'https://www.sparkfun.com/datasheets/LCD/HD44780.pdf',
  },
  'Relay Driver Module': {
    partNumber: 'ULN2003AN',
    manufacturer: 'Texas Instruments',
  },
  'Solenoid Driver': {
    partNumber: 'TIP120',
    manufacturer: 'STMicroelectronics',
    datasheet: 'https://www.st.com/resource/en/datasheet/tip120.pdf',
  },
  'ULN2003 Driver': {
    partNumber: 'ULN2003AN',
    manufacturer: 'Texas Instruments',
  },
  'LM386 Audio Amplifier': {
    partNumber: 'LM386N-1/NOPB',
    manufacturer: 'Texas Instruments',
  },
  'Class-D Audio Amplifier': {
    partNumber: 'PAM8403',
    manufacturer: 'Diodes Incorporated',
    datasheet: 'https://www.diodes.com/part/view/PAM8403',
  },
  'LDO Regulator': {
    partNumber: 'AMS1117-3.3',
    manufacturer: 'Advanced Monolithic Systems',
  },
  'Logic Level Shifter': {
    partNumber: 'TXB0104PWR',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/TXB0104',
  },
  'CH340 USB-Serial Driver': {
    partNumber: 'CH340G',
    manufacturer: 'WCH',
    datasheet: 'http://www.wch-ic.com/products/CH340.html',
  },
  'CP2102 USB-Serial Driver': {
    partNumber: 'CP2102N-A02-GQFN24',
    manufacturer: 'Silicon Labs',
    datasheet: 'https://www.silabs.com/interface/usb-bridges/classic/device.cp2102n',
  },

  // ── IC anchors ────────────────────────────────────────────────────────────
  LinearRegulator: {
    partNumber: 'LM317M',
    manufacturer: 'STMicroelectronics',
    datasheet: 'https://www.st.com/resource/en/datasheet/lm317m.pdf',
  },
  FixedRegulator: {
    partNumber: 'AMS1117-3.3',
    manufacturer: 'Advanced Monolithic Systems',
    datasheet: 'https://www.advanced-monolithic.com/pdf/ds1117.pdf',
  },

  // ── IC aliases (regulators) ───────────────────────────────────────────────
  LM317M: {
    partNumber: 'LM317M',
    manufacturer: 'STMicroelectronics',
    datasheet: 'https://www.st.com/resource/en/datasheet/lm317m.pdf',
  },
  'AMS1117-3.3': {
    partNumber: 'AMS1117-3.3',
    manufacturer: 'Advanced Monolithic Systems',
  },
  'AMS1117-5.0': {
    partNumber: 'AMS1117-5.0',
    manufacturer: 'Advanced Monolithic Systems',
  },
  'LM1117-3.3': {
    partNumber: 'LM1117-3.3',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/LM1117',
  },
  'LM1117-5.0': {
    partNumber: 'LM1117-5.0',
    manufacturer: 'Texas Instruments',
  },
  LM7805: {
    partNumber: 'LM7805CT',
    manufacturer: 'STMicroelectronics',
    datasheet: 'https://www.st.com/resource/en/datasheet/l78.pdf',
  },
  LM7809: {
    partNumber: 'LM7809CT',
    manufacturer: 'STMicroelectronics',
    datasheet: 'https://www.st.com/resource/en/datasheet/l78.pdf',
  },
  LM7812: {
    partNumber: 'LM7812CT',
    manufacturer: 'STMicroelectronics',
    datasheet: 'https://www.st.com/resource/en/datasheet/l78.pdf',
  },
  'AP2112K-3.3': {
    partNumber: 'AP2112K-3.3TRG1',
    manufacturer: 'Diodes Incorporated',
    datasheet: 'https://www.diodes.com/part/view/AP2112K-3.3',
  },

  // ── Logic gate ICs (74HC family) ──────────────────────────────────────────
  '74HC00': {
    partNumber: 'SN74HC00N',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/SN74HC00',
  },
  '74HC02': {
    partNumber: 'SN74HC02N',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/SN74HC02',
  },
  '74HC04': {
    partNumber: 'SN74HC04N',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/SN74HC04',
  },
  '74HC08': {
    partNumber: 'SN74HC08N',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/SN74HC08',
  },
  '74HC10': {
    partNumber: 'SN74HC10N',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/SN74HC10',
  },
  '74HC11': {
    partNumber: 'SN74HC11N',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/SN74HC11',
  },
  '74HC14': {
    partNumber: 'SN74HC14N',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/SN74HC14',
  },
  '74HC20': {
    partNumber: 'SN74HC20N',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/SN74HC20',
  },
  '74HC21': {
    partNumber: 'SN74HC21N',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/SN74HC21',
  },
  '74HC27': {
    partNumber: 'SN74HC27N',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/SN74HC27',
  },
  '74HC30': {
    partNumber: 'SN74HC30N',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/SN74HC30',
  },
  '74HC32': {
    partNumber: 'SN74HC32N',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/SN74HC32',
  },
  '74HC86': {
    partNumber: 'SN74HC86N',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/SN74HC86',
  },

  // ── Sensors ─────────────────────────────────────────────────────────────
  'Temperature Sensor': {
    partNumber: 'DS18B20+',
    manufacturer: 'Maxim Integrated',
    datasheet: 'https://datasheets.maximintegrated.com/en/ds/DS18B20.pdf',
  },
  'Tilt Sensor': {
    partNumber: 'SW-520D',
    manufacturer: 'Generic',
  },

  // ── Wireless anchors ──────────────────────────────────────────────────────
  Antenna: {
    partNumber: 'FXP410.07.0100C',
    manufacturer: 'Taoglas',
    datasheet: 'https://www.taoglas.com/product/fxp410-07-0100c/',
  },
  BluetoothModule: {
    partNumber: 'HC-05',
    manufacturer: 'Guangzhou HC Information Technology',
    datasheet: 'https://components101.com/wireless/hc-05-bluetooth-module-pinout-datasheet',
  },
  WirelessCharger: {
    partNumber: 'BQ51013BRHLR',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/BQ51013B',
  },

  // ── Wireless aliases ──────────────────────────────────────────────────────
  'PCB Antenna': {
    partNumber: 'FXP410.07.0100C',
    manufacturer: 'Taoglas',
  },
  'Whip Antenna': {
    partNumber: 'RF316-174',
    manufacturer: 'TE Connectivity',
    datasheet: 'https://www.te.com/usa-en/product-RF316-174.html',
  },
  'Dipole Antenna': {
    partNumber: 'ANT-2.4-CER-HETH',
    manufacturer: 'Linx Technologies',
    datasheet: 'https://linxtechnologies.com/product/ant-2-4-cer-heth/',
  },
  'LoRa Antenna': {
    partNumber: 'ANT-915-CER-HETH',
    manufacturer: 'Linx Technologies',
    datasheet: 'https://linxtechnologies.com/product/ant-915-cer-heth/',
  },
  'WiFi Antenna': {
    partNumber: 'W1030',
    manufacturer: 'Pulse Electronics',
    datasheet: 'https://www.te.com/usa-en/product-W1030.html',
  },
  'SMA Antenna': {
    partNumber: 'RF316-174',
    manufacturer: 'TE Connectivity',
  },
  'U.FL Antenna Port': {
    partNumber: 'U.FL-R-SMT-1(10)',
    manufacturer: 'Hirose',
    datasheet: 'https://www.hirose.com/product/series/U_FL-R-SMT-1%2810%29',
  },
  'HC-05 Bluetooth Module': {
    partNumber: 'HC-05',
    manufacturer: 'Guangzhou HC Information Technology',
  },
  'HC-06 Bluetooth Module': {
    partNumber: 'HC-06',
    manufacturer: 'Guangzhou HC Information Technology',
  },
  'HM-10 BLE Module': {
    partNumber: 'CC2541',
    manufacturer: 'Texas Instruments',
    datasheet: 'https://www.ti.com/product/CC2541',
  },
  'RN42 Bluetooth Module': {
    partNumber: 'RN42-I/RM',
    manufacturer: 'Microchip',
    datasheet: 'https://www.microchip.com/en-us/product/rn42',
  },
  'nRF52840 BLE Module': {
    partNumber: 'nRF52840',
    manufacturer: 'Nordic Semiconductor',
    datasheet: 'https://www.nordicsemi.com/Products/nRF52840',
  },

  // ── Connectors ────────────────────────────────────────────────────────────
  NPinConnector: {
    partNumber: '1729128',
    manufacturer: 'Phoenix Contact',
    datasheet: 'https://www.phoenixcontact.com/en-us/products/pluggable-terminal-blocks-mkds-15-1729128',
  },

  // ── Organization ──────────────────────────────────────────────────────────
  'Group Box': {
    partNumber: 'CW-ORG-BOX',
    manufacturer: 'CircuitWiz',
  },
}

export function getPartMetadata(registryKey: string): PartMetadata | undefined {
  return PART_METADATA[registryKey]
}
