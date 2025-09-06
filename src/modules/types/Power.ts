import { ModuleType } from './index'

export const PowerType: ModuleType = {
  name: 'Power Supply',
  description: 'Power source for circuits',
  parameters: [
    {
      name: 'voltage',
      type: 'number',
      label: 'Output Voltage',
      description: 'The voltage provided by this power source',
      required: true,
      defaultValue: 5.0,
      min: 1.0,
      max: 24.0,
      unit: 'V'
    },
    {
      name: 'current',
      type: 'number',
      label: 'Maximum Current',
      description: 'Maximum current this power source can provide',
      defaultValue: 1000,
      min: 100,
      max: 10000,
      unit: 'mA'
    },
    {
      name: 'type',
      type: 'select',
      label: 'Power Type',
      description: 'Type of power source',
      required: true,
      options: ['Battery', 'AC Adapter', 'USB', 'Solar', 'Generator'],
      defaultValue: 'Battery'
    },
    {
      name: 'capacity',
      type: 'number',
      label: 'Capacity',
      description: 'Battery capacity or power rating',
      defaultValue: 2000,
      min: 100,
      max: 50000,
      unit: 'mAh'
    },
    {
      name: 'rechargeable',
      type: 'boolean',
      label: 'Rechargeable',
      description: 'Whether this power source can be recharged',
      defaultValue: true
    }
  ],
  electricalProperties: {
    voltage: {
      min: 1.0,
      max: 24.0,
      unit: 'V'
    },
    current: {
      min: 100,
      max: 10000,
      unit: 'mA'
    },
    power: {
      min: 0.1,
      max: 240,
      unit: 'W'
    }
  },
  connectionRules: [
    {
      fromType: 'POSITIVE',
      toType: 'VCC',
      allowed: true,
      description: 'Positive terminal can connect to VCC pins'
    },
    {
      fromType: 'NEGATIVE',
      toType: 'GND',
      allowed: true,
      description: 'Negative terminal can connect to ground pins'
    },
    {
      fromType: 'POSITIVE',
      toType: 'POSITIVE',
      allowed: false,
      description: 'Positive terminals should not connect directly'
    },
    {
      fromType: 'NEGATIVE',
      toType: 'NEGATIVE',
      allowed: true,
      description: 'Negative terminals can be connected together'
    }
  ]
}
