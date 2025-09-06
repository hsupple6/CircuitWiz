import { ModuleType } from './index'

export const SensorType: ModuleType = {
  name: 'Sensor',
  description: 'Environmental or physical sensor',
  parameters: [
    {
      name: 'type',
      type: 'select',
      label: 'Sensor Type',
      description: 'Type of sensor',
      required: true,
      options: [
        'Temperature',
        'Humidity',
        'Pressure',
        'Light',
        'Motion',
        'Sound',
        'Proximity',
        'Gas',
        'Accelerometer',
        'Gyroscope'
      ],
      defaultValue: 'Temperature'
    },
    {
      name: 'voltage',
      type: 'select',
      label: 'Operating Voltage',
      description: 'Required voltage for sensor operation',
      required: true,
      options: ['3.3V', '5V', '1.8V'],
      defaultValue: '3.3V'
    },
    {
      name: 'range',
      type: 'string',
      label: 'Measurement Range',
      description: 'Range of values this sensor can measure',
      defaultValue: '0-100'
    },
    {
      name: 'accuracy',
      type: 'number',
      label: 'Accuracy',
      description: 'Sensor accuracy percentage',
      defaultValue: 95,
      min: 50,
      max: 100,
      unit: '%'
    },
    {
      name: 'resolution',
      type: 'number',
      label: 'Resolution',
      description: 'Minimum detectable change',
      defaultValue: 0.1,
      min: 0.001,
      max: 10
    },
    {
      name: 'interface',
      type: 'select',
      label: 'Communication Interface',
      description: 'How the sensor communicates',
      options: ['I2C', 'SPI', 'UART', 'Analog', 'Digital'],
      defaultValue: 'I2C'
    },
    {
      name: 'samplingRate',
      type: 'number',
      label: 'Sampling Rate',
      description: 'Maximum samples per second',
      defaultValue: 10,
      min: 0.1,
      max: 1000,
      unit: 'Hz'
    }
  ],
  electricalProperties: {
    voltage: {
      min: 1.8,
      max: 5.0,
      unit: 'V'
    },
    current: {
      min: 1,
      max: 100,
      unit: 'mA'
    }
  },
  connectionRules: [
    {
      fromType: 'VCC',
      toType: 'VCC',
      allowed: true,
      description: 'Power pins can connect to power'
    },
    {
      fromType: 'GND',
      toType: 'GND',
      allowed: true,
      description: 'Ground pins can connect to ground'
    },
    {
      fromType: 'SDA',
      toType: 'SDA',
      allowed: true,
      description: 'I2C data pins can connect together'
    },
    {
      fromType: 'SCL',
      toType: 'SCL',
      allowed: true,
      description: 'I2C clock pins can connect together'
    },
    {
      fromType: 'SIGNAL',
      toType: 'GPIO',
      allowed: true,
      description: 'Sensor signal can connect to GPIO'
    }
  ]
}
