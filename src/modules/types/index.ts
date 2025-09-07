// Module System Type Definitions

export interface ModuleGridCell {
  x: number
  y: number
  css?: string // Custom CSS for styling this specific cell
  background?: string // Background color
  isConnectable: boolean
  type: string // GPIO, VCC, GND, ANALOG, DIGITAL, etc.
  pin?: string // Pin identifier/name
  properties?: Record<string, any> // Additional properties specific to this cell
  isPowered?: boolean // Power state for this cell
  isClickable?: boolean // Whether this cell can be clicked for interaction
  isPowerable?: boolean // Whether this cell can provide power
  isGroundable?: boolean // Whether this cell can be grounded
  voltage?: number // Voltage level for this cell
  current?: number // Current capacity for this cell
}

export interface ModuleDefinition {
  module: string
  gridX: number
  gridY: number
  grid: ModuleGridCell[]
  background?: string // Overall module background
  css?: string // Overall module CSS
  category: string // microcontrollers, sensors, power, connectors, etc.
  description?: string
  manufacturer?: string
  datasheet?: string
  behavior?: ComponentBehavior // JavaScript behavior for interactive components
}

export interface ComponentBehavior {
  onClick?: string // JavaScript code to execute when component is clicked
  onPowerChange?: string // JavaScript code to execute when power state changes
  customFunctions?: Record<string, string> // Additional custom JavaScript functions
}

export interface ModuleType {
  name: string
  description: string
  parameters: ModuleParameter[]
  electricalProperties?: ElectricalProperties
  connectionRules?: ConnectionRule[]
}

export interface ModuleParameter {
  name: string
  type: 'number' | 'string' | 'boolean' | 'select' | 'range'
  label: string
  description?: string
  defaultValue?: any
  required?: boolean
  options?: string[] // For select type
  min?: number // For range/number type
  max?: number // For range/number type
  unit?: string // volts, amps, watts, etc.
}

export interface ElectricalProperties {
  voltage?: {
    min: number
    max: number
    unit: string
  }
  current?: {
    min: number
    max: number
    unit: string
  }
  power?: {
    min: number
    max: number
    unit: string
  }
  resistance?: {
    min: number
    max: number
    unit: string
  }
  frequency?: {
    min: number
    max: number
    unit: string
  }
}

export interface ConnectionRule {
  fromType: string
  toType: string
  allowed: boolean
  description?: string
}

export interface ModuleInstance {
  id: string
  definition: ModuleDefinition
  position: { x: number; y: number }
  parameters: Record<string, any>
  connections: ModuleConnection[]
}

export interface ModuleConnection {
  id: string
  from: {
    moduleId: string
    cellX: number
    cellY: number
  }
  to: {
    moduleId: string
    cellX: number
    cellY: number
  }
  properties?: Record<string, any>
}

export interface WireSegment {
  id: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  isPowered: boolean
  isGrounded: boolean
  isPowerable: boolean
  isGroundable: boolean
  voltage: number
  current: number
  power: number
  color: string
  thickness: number
  gauge: number
  maxCurrent: number
  maxPower: number
}

export interface WireConnection {
  id: string
  segments: WireSegment[]
  isPowered: boolean
  isGrounded: boolean
  isPowerable: boolean
  isGroundable: boolean
  voltage: number
  current: number
  power: number
  color: string
  thickness: number
  gauge: number
  maxCurrent: number
  maxPower: number
  parentId?: string // ID of the parent wire if this is a child wire
  childIds?: string[] // Array of child wire IDs
}

export interface WiringState {
  isWiring: boolean
  currentConnection: {
    startX: number
    startY: number
    segments: Array<{ x: number; y: number }>
  } | null
}
