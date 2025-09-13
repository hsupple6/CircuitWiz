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
  // Calculate motor electrical properties with instantaneous values
  const calculateMotorProperties = () => {
    const { inputVoltage: motorVoltage, kv, resistance, maxRPM, efficiency, poles } = motorProperties
    
    // Calculate instantaneous RPM based on current input voltage
    // RPM = (V_input * kV) - load effects
    const theoreticalRPM = motorVoltage * kv
    const actualRPM = Math.min(theoreticalRPM, maxRPM)
    
    // Calculate back EMF (instantaneous)
    // Back EMF = RPM / kV (this is the voltage the motor generates)
    const backEMF = actualRPM / kv
    
    // Calculate instantaneous current draw
    // I = (V_input - V_backEMF) / R_phase
    const voltageDrop = motorVoltage - backEMF
    const motorCurrent = Math.max(0, voltageDrop / resistance)
    
    // Calculate instantaneous power consumption
    const inputPower = motorVoltage * motorCurrent
    const outputPower = inputPower * (efficiency / 100)
    const powerLoss = inputPower - outputPower
    
    // Calculate instantaneous torque using multiple methods
    // Method 1: Power-based torque
    const powerBasedTorque = actualRPM > 0 ? (outputPower * 60) / (2 * Math.PI * actualRPM) : 0
    
    // Method 2: Current-based torque (for BLDC motors)
    // Torque = (Kt * I) where Kt ≈ 9.549 / kV (for SI units)
    const torqueConstant = 9.549 / kv // N⋅m/A
    const currentBasedTorque = motorCurrent * torqueConstant
    
    // Method 3: Combined approach (more accurate for BLDC)
    const instantaneousTorque = Math.max(powerBasedTorque, currentBasedTorque)
    
    // Calculate additional motor characteristics
    const angularVelocity = (actualRPM * 2 * Math.PI) / 60 // rad/s
    const mechanicalPower = instantaneousTorque * angularVelocity // W
    
    // Calculate motor constants
    const speedConstant = kv // RPM/V
    const torqueConstantSI = 9.549 / kv // N⋅m/A
    
    return {
      backEMF,
      motorCurrent,
      inputPower,
      outputPower,
      powerLoss,
      actualRPM,
      instantaneousRPM: actualRPM, // Explicit instantaneous RPM
      instantaneousTorque, // Explicit instantaneous torque
      powerBasedTorque,
      currentBasedTorque,
      angularVelocity,
      mechanicalPower,
      voltageDrop,
      speedConstant,
      torqueConstant: torqueConstantSI,
      efficiency: efficiency
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
      componentState.instantaneousRPM = motorCalc.instantaneousRPM
      componentState.motorTorque = motorCalc.instantaneousTorque
      componentState.instantaneousTorque = motorCalc.instantaneousTorque
      componentState.powerBasedTorque = motorCalc.powerBasedTorque
      componentState.currentBasedTorque = motorCalc.currentBasedTorque
      componentState.motorEfficiency = motorProperties.efficiency
      componentState.backEMF = motorCalc.backEMF
      componentState.powerLoss = motorCalc.powerLoss
      componentState.angularVelocity = motorCalc.angularVelocity
      componentState.mechanicalPower = motorCalc.mechanicalPower
      componentState.speedConstant = motorCalc.speedConstant
      componentState.torqueConstant = motorCalc.torqueConstant
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
            <span className="label">Instantaneous RPM:</span>
            <span className="value">{motorCalc.instantaneousRPM.toFixed(0)} RPM</span>
          </div>
          <div className="calc-item">
            <span className="label">Instantaneous Torque:</span>
            <span className="value">{motorCalc.instantaneousTorque.toFixed(3)} N⋅m</span>
          </div>
          <div className="calc-item">
            <span className="label">Power-based Torque:</span>
            <span className="value">{motorCalc.powerBasedTorque.toFixed(3)} N⋅m</span>
          </div>
          <div className="calc-item">
            <span className="label">Current-based Torque:</span>
            <span className="value">{motorCalc.currentBasedTorque.toFixed(3)} N⋅m</span>
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
          <div className="calc-item">
            <span className="label">Angular Velocity:</span>
            <span className="value">{motorCalc.angularVelocity.toFixed(1)} rad/s</span>
          </div>
          <div className="calc-item">
            <span className="label">Mechanical Power:</span>
            <span className="value">{motorCalc.mechanicalPower.toFixed(2)}W</span>
          </div>
          <div className="calc-item">
            <span className="label">Speed Constant (kV):</span>
            <span className="value">{motorCalc.speedConstant.toFixed(0)} RPM/V</span>
          </div>
          <div className="calc-item">
            <span className="label">Torque Constant (Kt):</span>
            <span className="value">{motorCalc.torqueConstant.toFixed(3)} N⋅m/A</span>
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
  
  // Calculate instantaneous RPM
  const theoreticalRPM = inputVoltage * kv
  const actualRPM = Math.min(theoreticalRPM, maxRPM)
  
  // Calculate back EMF (instantaneous)
  const backEMF = actualRPM / kv
  
  // Calculate instantaneous current draw
  const voltageDrop = inputVoltage - backEMF
  const motorCurrent = Math.max(0, voltageDrop / resistance)
  
  // Calculate instantaneous power
  const inputPower = inputVoltage * motorCurrent
  const outputPower = inputPower * (efficiency / 100)
  
  // Calculate instantaneous torque
  const powerBasedTorque = actualRPM > 0 ? (outputPower * 60) / (2 * Math.PI * actualRPM) : 0
  const torqueConstant = 9.549 / kv // N⋅m/A
  const currentBasedTorque = motorCurrent * torqueConstant
  const instantaneousTorque = Math.max(powerBasedTorque, currentBasedTorque)
  
  // Calculate additional characteristics
  const angularVelocity = (actualRPM * 2 * Math.PI) / 60 // rad/s
  const mechanicalPower = instantaneousTorque * angularVelocity // W
  
  return {
    outputVoltage: backEMF,
    outputCurrent: motorCurrent,
    power: inputPower,
    actualRPM,
    instantaneousRPM: actualRPM,
    instantaneousTorque,
    powerBasedTorque,
    currentBasedTorque,
    angularVelocity,
    mechanicalPower,
    backEMF,
    voltageDrop,
    efficiency: efficiency,
    speedConstant: kv,
    torqueConstant: torqueConstant
  }
}

export default MotorVoltageFlow
