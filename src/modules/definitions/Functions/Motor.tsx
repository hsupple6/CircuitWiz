import React from 'react'
import { ComponentState } from '../../../systems/ElectricalSystem'

interface MotorVoltageFlowProps {
  componentState: ComponentState
  inputVoltage: number
  inputCurrent: number
  motorProperties: {
    inputVoltage: number
    kv: number
    resistance: number
    maxRPM: number
    efficiency: number
    poles: number
  }
}

export const MotorVoltageFlow: React.FC<MotorVoltageFlowProps> = ({
  componentState,
  inputVoltage,
  inputCurrent,
  motorProperties
}) => {
  // Calculate motor electrical properties
  const calculateMotorProperties = () => {
    const { inputVoltage: motorVoltage, kv, resistance, maxRPM, efficiency, poles } = motorProperties
    
    // Calculate back EMF based on RPM and kV
    // Back EMF = (RPM / kV) * efficiency factor
    const theoreticalRPM = motorVoltage * kv
    const actualRPM = Math.min(theoreticalRPM, maxRPM)
    const backEMF = (actualRPM / kv) * (efficiency / 100)
    
    // Calculate current draw based on load
    // I = (V_input - V_backEMF) / R_phase
    const voltageDrop = motorVoltage - backEMF
    const motorCurrent = Math.max(0, voltageDrop / resistance)
    
    // Calculate power consumption
    const inputPower = motorVoltage * motorCurrent
    const outputPower = inputPower * (efficiency / 100)
    const powerLoss = inputPower - outputPower
    
    // Calculate torque (simplified)
    // Torque = (Power * 60) / (2 * π * RPM)
    const torque = actualRPM > 0 ? (outputPower * 60) / (2 * Math.PI * actualRPM) : 0
    
    return {
      backEMF,
      motorCurrent,
      inputPower,
      outputPower,
      powerLoss,
      actualRPM,
      torque,
      voltageDrop
    }
  }

  const motorCalc = calculateMotorProperties()
  
  // Update component state with calculated values
  React.useEffect(() => {
    if (componentState) {
      componentState.outputVoltage = motorCalc.backEMF
      componentState.outputCurrent = motorCalc.motorCurrent
      componentState.power = motorCalc.inputPower
      componentState.status = motorCalc.actualRPM > 0 ? 'on' : 'off'
      
      // Add motor-specific properties
      componentState.motorRPM = motorCalc.actualRPM
      componentState.motorTorque = motorCalc.torque
      componentState.motorEfficiency = motorProperties.efficiency
      componentState.backEMF = motorCalc.backEMF
      componentState.powerLoss = motorCalc.powerLoss
    }
  }, [componentState, motorCalc, motorProperties.efficiency])

  return (
    <div className="motor-voltage-flow">
      <div className="motor-calculations">
        <h4>Motor Calculations</h4>
        <div className="calculation-grid">
          <div className="calc-item">
            <span className="label">Input Voltage:</span>
            <span className="value">{inputVoltage.toFixed(2)}V</span>
          </div>
          <div className="calc-item">
            <span className="label">Back EMF:</span>
            <span className="value">{motorCalc.backEMF.toFixed(2)}V</span>
          </div>
          <div className="calc-item">
            <span className="label">Motor Current:</span>
            <span className="value">{(motorCalc.motorCurrent * 1000).toFixed(1)}mA</span>
          </div>
          <div className="calc-item">
            <span className="label">RPM:</span>
            <span className="value">{motorCalc.actualRPM.toFixed(0)} RPM</span>
          </div>
          <div className="calc-item">
            <span className="label">Torque:</span>
            <span className="value">{motorCalc.torque.toFixed(3)} N⋅m</span>
          </div>
          <div className="calc-item">
            <span className="label">Input Power:</span>
            <span className="value">{motorCalc.inputPower.toFixed(2)}W</span>
          </div>
          <div className="calc-item">
            <span className="label">Output Power:</span>
            <span className="value">{motorCalc.outputPower.toFixed(2)}W</span>
          </div>
          <div className="calc-item">
            <span className="label">Efficiency:</span>
            <span className="value">{motorProperties.efficiency.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper function to calculate motor properties for electrical system
export const calculateMotorElectricalProperties = (
  inputVoltage: number,
  motorProperties: {
    inputVoltage: number
    kv: number
    resistance: number
    maxRPM: number
    efficiency: number
    poles: number
  }
) => {
  const { kv, resistance, maxRPM, efficiency } = motorProperties
  
  // Calculate back EMF based on RPM and kV
  const theoreticalRPM = inputVoltage * kv
  const actualRPM = Math.min(theoreticalRPM, maxRPM)
  const backEMF = (actualRPM / kv) * (efficiency / 100)
  
  // Calculate current draw
  const voltageDrop = inputVoltage - backEMF
  const motorCurrent = Math.max(0, voltageDrop / resistance)
  
  // Calculate power
  const inputPower = inputVoltage * motorCurrent
  const outputPower = inputPower * (efficiency / 100)
  
  return {
    outputVoltage: backEMF,
    outputCurrent: motorCurrent,
    power: inputPower,
    actualRPM,
    backEMF,
    voltageDrop,
    efficiency: efficiency
  }
}

export default MotorVoltageFlow
