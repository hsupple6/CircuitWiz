import { ModuleType } from './index'

export const ConnectorType: ModuleType = {
  name: 'Connector',
  description: 'Physical connector for wiring',
  parameters: [
    {
      name: 'type',
      type: 'select',
      label: 'Connector Type',
      description: 'Type of connector',
      required: true,
      options: [
        'Header',
        'JST',
        'USB',
        'RJ45',
        'Terminal Block',
        'Banana Jack',
        'Alligator Clip',
        'Wire'
      ],
      defaultValue: 'Header'
    },
    {
      name: 'pins',
      type: 'number',
      label: 'Number of Pins',
      description: 'Total number of connection points',
      required: true,
      defaultValue: 2,
      min: 1,
      max: 64
    },
    {
      name: 'pitch',
      type: 'number',
      label: 'Pin Pitch',
      description: 'Distance between pins',
      defaultValue: 2.54,
      min: 0.5,
      max: 10,
      unit: 'mm'
    },
    {
      name: 'gender',
      type: 'select',
      label: 'Gender',
      description: 'Male or female connector',
      options: ['Male', 'Female', 'Both'],
      defaultValue: 'Male'
    },
    {
      name: 'currentRating',
      type: 'number',
      label: 'Current Rating',
      description: 'Maximum current per pin',
      defaultValue: 1000,
      min: 100,
      max: 10000,
      unit: 'mA'
    },
    {
      name: 'voltageRating',
      type: 'number',
      label: 'Voltage Rating',
      description: 'Maximum voltage rating',
      defaultValue: 12,
      min: 1,
      max: 1000,
      unit: 'V'
    }
  ],
  electricalProperties: {
    current: {
      min: 100,
      max: 10000,
      unit: 'mA'
    },
    voltage: {
      min: 1,
      max: 1000,
      unit: 'V'
    },
    resistance: {
      min: 0.001,
      max: 1,
      unit: 'Ω'
    }
  },
  connectionRules: [
    {
      fromType: 'PIN',
      toType: 'PIN',
      allowed: true,
      description: 'Connector pins can connect to other pins'
    },
    {
      fromType: 'PIN',
      toType: 'GPIO',
      allowed: true,
      description: 'Connector pins can connect to GPIO'
    },
    {
      fromType: 'PIN',
      toType: 'VCC',
      allowed: true,
      description: 'Connector pins can carry power'
    },
    {
      fromType: 'PIN',
      toType: 'GND',
      allowed: true,
      description: 'Connector pins can carry ground'
    }
  ]
}
