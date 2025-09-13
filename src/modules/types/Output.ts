import { ModuleType } from './index'

export const OutputType: ModuleType = {
  name: 'Output Device',
  description: 'Output devices like motors, servos, actuators, etc.',
  parameters: [
    {
      name: 'inputVoltage',
      type: 'number',
      label: 'Input Voltage',
      description: 'Required input voltage for the device',
      required: true,
      defaultValue: 12.0,
      min: 1.0,
      max: 48.0,
      unit: 'V'
    },
    {
      name: 'outputVoltage',
      type: 'number',
      label: 'Output Voltage',
      description: 'Output voltage (for devices that provide output)',
      defaultValue: 0.0,
      min: 0.0,
      max: 48.0,
      unit: 'V'
    },
    {
      name: 'current',
      type: 'number',
      label: 'Operating Current',
      description: 'Typical operating current',
      required: true,
      defaultValue: 1000,
      min: 10,
      max: 50000,
      unit: 'mA'
    },
    {
      name: 'power',
      type: 'number',
      label: 'Power Rating',
      description: 'Power consumption or output rating',
      defaultValue: 12.0,
      min: 0.1,
      max: 1000.0,
      unit: 'W'
    },
    {
      name: 'deviceType',
      type: 'select',
      label: 'Device Type',
      description: 'Type of output device',
      required: true,
      options: ['Motor', 'Servo', 'Actuator', 'Solenoid', 'Relay', 'Speaker', 'Display', 'Other'],
      defaultValue: 'Motor'
    },
    {
      name: 'efficiency',
      type: 'number',
      label: 'Efficiency',
      description: 'Device efficiency percentage',
      defaultValue: 85.0,
      min: 0.0,
      max: 100.0,
      unit: '%'
    },
    {
      name: 'operatingTemp',
      type: 'number',
      label: 'Operating Temperature',
      description: 'Maximum operating temperature',
      defaultValue: 60.0,
      min: -40.0,
      max: 150.0,
      unit: '°C'
    }
  ],
  electricalProperties: {
    voltage: {
      min: 1.0,
      max: 48.0,
      unit: 'V'
    },
    current: {
      min: 10,
      max: 50000,
      unit: 'mA'
    },
    power: {
      min: 0.1,
      max: 1000.0,
      unit: 'W'
    }
  },
  connectionRules: [
    {
      fromType: 'VCC',
      toType: 'VCC',
      allowed: true,
      description: 'Power input can connect to VCC'
    },
    {
      fromType: 'GND',
      toType: 'GND',
      allowed: true,
      description: 'Ground can connect to GND'
    },
    {
      fromType: 'GPIO',
      toType: 'GPIO',
      allowed: true,
      description: 'Control signals can connect to GPIO pins'
    },
    {
      fromType: 'PWM',
      toType: 'PWM',
      allowed: true,
      description: 'PWM signals can connect to PWM pins'
    }
  ]
}

// Specific motor type for brushless motors
export const MotorType: ModuleType = {
  name: 'Brushless Motor',
  description: 'Brushless DC motor (BLDC) with kV rating and specifications',
  parameters: [
    {
      name: 'inputVoltage',
      type: 'number',
      label: 'Input Voltage',
      description: 'Operating voltage for the motor',
      required: true,
      defaultValue: 12.0,
      min: 3.0,
      max: 48.0,
      unit: 'V'
    },
    {
      name: 'outputVoltage',
      type: 'number',
      label: 'Back EMF',
      description: 'Back EMF voltage (calculated from kV and RPM)',
      defaultValue: 0.0,
      min: 0.0,
      max: 48.0,
      unit: 'V'
    },
    {
      name: 'current',
      type: 'number',
      label: 'Stall Current',
      description: 'Maximum stall current',
      required: true,
      defaultValue: 2000,
      min: 100,
      max: 100000,
      unit: 'mA'
    },
    {
      name: 'power',
      type: 'number',
      label: 'Power Rating',
      description: 'Maximum power rating',
      defaultValue: 200.0,
      min: 1.0,
      max: 2000.0,
      unit: 'W'
    },
    {
      name: 'kv',
      type: 'number',
      label: 'kV Rating',
      description: 'Motor kV rating (RPM per volt)',
      required: true,
      defaultValue: 1000,
      min: 100,
      max: 10000,
      unit: 'RPM/V'
    },
    {
      name: 'width',
      type: 'number',
      label: 'Motor Width',
      description: 'Motor stator width in mm',
      required: true,
      defaultValue: 63,
      min: 10,
      max: 200,
      unit: 'mm'
    },
    {
      name: 'height',
      type: 'number',
      label: 'Motor Height',
      description: 'Motor stator height in mm',
      required: true,
      defaultValue: 84,
      min: 10,
      max: 200,
      unit: 'mm'
    },
    {
      name: 'poles',
      type: 'number',
      label: 'Pole Count',
      description: 'Number of magnetic poles',
      defaultValue: 14,
      min: 2,
      max: 50,
      unit: 'poles'
    },
    {
      name: 'resistance',
      type: 'number',
      label: 'Phase Resistance',
      description: 'Motor phase resistance',
      defaultValue: 0.1,
      min: 0.01,
      max: 10.0,
      unit: 'Ω'
    },
    {
      name: 'maxRPM',
      type: 'number',
      label: 'Maximum RPM',
      description: 'Maximum safe RPM',
      defaultValue: 20000,
      min: 1000,
      max: 100000,
      unit: 'RPM'
    },
    {
      name: 'weight',
      type: 'number',
      label: 'Weight',
      description: 'Motor weight',
      defaultValue: 150,
      min: 10,
      max: 2000,
      unit: 'g'
    },
    {
      name: 'shaftDiameter',
      type: 'number',
      label: 'Shaft Diameter',
      description: 'Motor shaft diameter',
      defaultValue: 5.0,
      min: 1.0,
      max: 20.0,
      unit: 'mm'
    },
    {
      name: 'mountingHoles',
      type: 'number',
      label: 'Mounting Holes',
      description: 'Number of mounting holes',
      defaultValue: 4,
      min: 2,
      max: 8,
      unit: 'holes'
    },
    {
      name: 'efficiency',
      type: 'number',
      label: 'Efficiency',
      description: 'Motor efficiency at optimal load',
      defaultValue: 85.0,
      min: 50.0,
      max: 95.0,
      unit: '%'
    },
    {
      name: 'operatingTemp',
      type: 'number',
      label: 'Operating Temperature',
      description: 'Maximum operating temperature',
      defaultValue: 80.0,
      min: -20.0,
      max: 150.0,
      unit: '°C'
    }
  ],
  electricalProperties: {
    voltage: {
      min: 3.0,
      max: 48.0,
      unit: 'V'
    },
    current: {
      min: 100,
      max: 100000,
      unit: 'mA'
    },
    power: {
      min: 1.0,
      max: 2000.0,
      unit: 'W'
    },
    frequency: {
      min: 1000,
      max: 100000,
      unit: 'Hz'
    }
  },
  connectionRules: [
    {
      fromType: 'VCC',
      toType: 'VCC',
      allowed: true,
      description: 'Power input can connect to VCC'
    },
    {
      fromType: 'GND',
      toType: 'GND',
      allowed: true,
      description: 'Ground can connect to GND'
    },
    {
      fromType: 'PWM',
      toType: 'PWM',
      allowed: true,
      description: 'ESC control signals can connect to PWM pins'
    },
    {
      fromType: 'GPIO',
      toType: 'GPIO',
      allowed: true,
      description: 'Control signals can connect to GPIO pins'
    }
  ]
}
