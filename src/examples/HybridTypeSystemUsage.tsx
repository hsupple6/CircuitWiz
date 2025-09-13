/**
 * Example usage of the Hybrid Type System
 * 
 * This file demonstrates how to integrate the new type system
 * with your existing CircuitWiz components.
 */

import React, { useState } from 'react'
import { getModuleWithType, getModuleType } from '../modules/registry'
import { validateConnection } from '../utils/connectionValidator'
import ComponentConfigModal from '../components/ComponentConfigModal'

// Example: How to use the enhanced registry
export const ExampleRegistryUsage = () => {
  // Get module with both definition and type
  const esp32Data = getModuleWithType('ESP32')
  console.log('ESP32 Definition:', esp32Data?.definition)
  console.log('ESP32 Type:', esp32Data?.type)
  console.log('ESP32 Category:', esp32Data?.category)

  // Get just the type definition
  const motorType = getModuleType('Motor')
  console.log('Motor Parameters:', motorType?.parameters)
  console.log('Motor Connection Rules:', motorType?.connectionRules)

  return <div>Check console for registry data</div>
}

// Example: How to validate connections
export const ExampleConnectionValidation = () => {
  const validateExampleConnection = () => {
    const fromPin = {
      type: 'VCC',
      componentId: 'battery-1',
      componentModule: 'Battery',
      position: { x: 10, y: 10 }
    }

    const toPin = {
      type: 'GPIO',
      componentId: 'esp32-1',
      componentModule: 'ESP32',
      position: { x: 15, y: 10 }
    }

    const result = validateConnection(fromPin, toPin)
    console.log('Connection validation result:', result)
    
    if (!result.isValid) {
      console.error('Connection error:', result.error)
    } else if (result.warning) {
      console.warn('Connection warning:', result.warning)
    } else {
      console.log('Connection is valid!')
    }
  }

  return (
    <div>
      <button onClick={validateExampleConnection}>
        Test Connection Validation
      </button>
    </div>
  )
}

// Example: How to use component configuration
export const ExampleComponentConfiguration = () => {
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [component, setComponent] = useState({
    id: 'motor-1',
    module: 'Motor',
    parameters: {
      inputVoltage: 12.0,
      kv: 1000,
      width: 63,
      height: 84
    },
    position: { x: 20, y: 20 }
  })

  const handleParameterChange = (componentId: string, parameterName: string, value: any) => {
    setComponent(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [parameterName]: value
      }
    }))
    console.log(`Updated ${componentId}.${parameterName} = ${value}`)
  }

  return (
    <div>
      <button onClick={() => setIsConfigOpen(true)}>
        Configure Motor
      </button>
      
      <ComponentConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        componentId={component.id}
        component={component}
        onParameterChange={handleParameterChange}
      />
      
      <div className="mt-4">
        <h3>Current Parameters:</h3>
        <pre>{JSON.stringify(component.parameters, null, 2)}</pre>
      </div>
    </div>
  )
}

// Example: How to integrate with electrical calculations
export const ExampleElectricalIntegration = () => {
  const calculateMotorProperties = (component: any) => {
    const typeDef = getModuleType(component.module)
    
    if (component.module === 'Motor' && typeDef) {
      // Use type parameters for calculations
      const voltage = component.parameters?.inputVoltage || 
        typeDef.parameters.find(p => p.name === 'inputVoltage')?.defaultValue
      
      const kv = component.parameters?.kv || 
        typeDef.parameters.find(p => p.name === 'kv')?.defaultValue
      
      const resistance = component.parameters?.resistance || 
        typeDef.parameters.find(p => p.name === 'resistance')?.defaultValue
      
      // Calculate motor properties
      const theoreticalRPM = voltage * kv
      const backEMF = (theoreticalRPM / kv) * 0.85 // 85% efficiency
      const current = (voltage - backEMF) / resistance
      
      return {
        theoreticalRPM,
        backEMF,
        current,
        power: voltage * current
      }
    }
    
    return null
  }

  const motor = {
    module: 'Motor',
    parameters: {
      inputVoltage: 12.0,
      kv: 1000,
      resistance: 0.1
    }
  }

  const motorCalc = calculateMotorProperties(motor)
  
  return (
    <div>
      <h3>Motor Calculations:</h3>
      {motorCalc ? (
        <div>
          <p>Theoretical RPM: {motorCalc.theoreticalRPM.toFixed(0)}</p>
          <p>Back EMF: {motorCalc.backEMF.toFixed(2)}V</p>
          <p>Current: {(motorCalc.current * 1000).toFixed(1)}mA</p>
          <p>Power: {motorCalc.power.toFixed(2)}W</p>
        </div>
      ) : (
        <p>No calculations available</p>
      )}
    </div>
  )
}

// Main example component
export const HybridTypeSystemExample = () => {
  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Hybrid Type System Examples</h1>
      
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">1. Registry Usage</h2>
        <ExampleRegistryUsage />
      </div>
      
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">2. Connection Validation</h2>
        <ExampleConnectionValidation />
      </div>
      
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">3. Component Configuration</h2>
        <ExampleComponentConfiguration />
      </div>
      
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">4. Electrical Integration</h2>
        <ExampleElectricalIntegration />
      </div>
    </div>
  )
}

export default HybridTypeSystemExample
