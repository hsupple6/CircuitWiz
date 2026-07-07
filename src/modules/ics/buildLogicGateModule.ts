import type { ModuleDefinition } from '../types'
import type { LogicGateChipSpec } from './logicGateChips'

function pinCss(label: string): { type: string; css: string; isConnectable: boolean } {
  if (label === 'VCC') {
    return {
      type: 'DRIVER_PWR',
      css: 'background:#DC2626;color:white;font-size:9px;font-weight:bold;display:flex;align-items:center;justify-content:center;',
      isConnectable: true,
    }
  }
  if (label === 'GND') {
    return {
      type: 'GND',
      css: 'background:#4C1D95;color:white;font-size:9px;font-weight:bold;display:flex;align-items:center;justify-content:center;',
      isConnectable: true,
    }
  }
  if (label.startsWith('NC')) {
    return {
      type: 'DUMMY',
      css: 'background:#27272A;color:#71717A;font-size:8px;font-weight:bold;display:flex;align-items:center;justify-content:center;border:1px dashed #52525B;',
      isConnectable: false,
    }
  }
  if (label.endsWith('Y')) {
    return {
      type: 'DRIVER_OUT',
      css: 'background:#059669;color:white;font-size:9px;font-weight:bold;display:flex;align-items:center;justify-content:center;',
      isConnectable: true,
    }
  }
  return {
    type: 'INPUT',
    css: 'background:#2563EB;color:white;font-size:9px;font-weight:bold;display:flex;align-items:center;justify-content:center;',
    isConnectable: true,
  }
}

/** 14-pin DIP: left column pins 1–7, right column pins 14–8 (top to bottom). */
export function buildLogicGateModule(chip: LogicGateChipSpec): ModuleDefinition {
  const grid: ModuleDefinition['grid'] = []

  for (let row = 0; row < 7; row++) {
    const leftPin = row + 1
    const rightPin = 14 - row
    const leftLabel = chip.pinout[leftPin] ?? `P${leftPin}`
    const rightLabel = chip.pinout[rightPin] ?? `P${rightPin}`
    const leftStyle = pinCss(leftLabel)
    const rightStyle = pinCss(rightLabel)

    grid.push({
      x: 0,
      y: row,
      type: leftStyle.type,
      pin: leftLabel,
      isConnectable: leftStyle.isConnectable,
      isPowerable: leftLabel === 'VCC',
      isGroundable: leftLabel === 'GND',
      css: `${leftStyle.css}${row === 0 ? 'border-radius:6px 0 0 0;' : ''}${row === 6 ? 'border-radius:0 0 0 6px;' : ''}`,
    })

    grid.push({
      x: 1,
      y: row,
      type: rightStyle.type,
      pin: rightLabel,
      isConnectable: rightStyle.isConnectable,
      isPowerable: rightLabel === 'VCC',
      isGroundable: rightLabel === 'GND',
      css: `${rightStyle.css}${row === 0 ? 'border-radius:0 6px 0 0;' : ''}${row === 6 ? 'border-radius:0 0 6px 0;' : ''}`,
    })
  }

  return {
    module: chip.id,
    logicModule: 'LogicGateIC',
    gridX: 2,
    gridY: 7,
    background: '#0F172A',
    css: 'border-radius: 6px; border: 2px solid #475569;',
    category: 'ics',
    description: chip.description,
    grid,
    properties: {
      chipId: { default: chip.id, description: 'Logic gate IC part number' },
      vth: { default: 2.5, unit: 'V', description: 'Input logic threshold (HC family)' },
      idleCurrent: { default: 0.00001, unit: 'A', description: 'Quiescent supply current' },
    },
  }
}
