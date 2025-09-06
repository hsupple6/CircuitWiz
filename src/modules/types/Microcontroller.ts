import { ModuleType } from './index'

export const MicrocontrollerType: ModuleType = {
  name: 'Microcontroller',
  description: 'Programmable microcontroller with GPIO pins',
  parameters: [
    {
      name: 'voltage',
      type: 'select',
      label: 'Operating Voltage',
      description: 'The voltage at which the microcontroller operates',
      required: true,
      options: ['3.3V', '5V', '1.8V'],
      defaultValue: '3.3V'
    },
    {
      name: 'frequency',
      type: 'number',
      label: 'Clock Frequency',
      description: 'CPU clock frequency in MHz',
      defaultValue: 80,
      min: 1,
      max: 1000,
      unit: 'MHz'
    },
    {
      name: 'flash',
      type: 'number',
      label: 'Flash Memory',
      description: 'Flash memory size in MB',
      defaultValue: 4,
      min: 0.5,
      max: 32,
      unit: 'MB'
    },
    {
      name: 'ram',
      type: 'number',
      label: 'RAM',
      description: 'Random Access Memory in KB',
      defaultValue: 520,
      min: 8,
      max: 8192,
      unit: 'KB'
    },
    {
      name: 'wifi',
      type: 'boolean',
      label: 'WiFi Support',
      description: 'Built-in WiFi capability',
      defaultValue: true
    },
    {
      name: 'bluetooth',
      type: 'boolean',
      label: 'Bluetooth Support',
      description: 'Built-in Bluetooth capability',
      defaultValue: false
    }
  ],
  electricalProperties: {
    voltage: {
      min: 1.8,
      max: 5.0,
      unit: 'V'
    },
    current: {
      min: 10,
      max: 500,
      unit: 'mA'
    }
  },
  connectionRules: [
    {
      fromType: 'GPIO',
      toType: 'GPIO',
      allowed: true,
      description: 'GPIO pins can connect to other GPIO pins'
    },
    {
      fromType: 'VCC',
      toType: 'VCC',
      allowed: true,
      description: 'Power pins can connect to power pins'
    },
    {
      fromType: 'GND',
      toType: 'GND',
      allowed: true,
      description: 'Ground pins can connect to ground pins'
    },
    {
      fromType: 'VCC',
      toType: 'GPIO',
      allowed: false,
      description: 'Power pins should not connect directly to GPIO'
    }
  ]
}
