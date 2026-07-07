import {
  formatLiIonCapacityMah,
  formatLiIonPackTopology,
  liIonPackNominalVoltage,
  liIonPackTotalCapacityMah,
} from '../modules/moduleConfigKind'

interface LiIonPackBodyLabelProps {
  seriesCells: number
  parallelCount: number
  cellCapacityMah: number
  compact?: boolean
}

export function LiIonPackBodyLabel({
  seriesCells,
  parallelCount,
  cellCapacityMah,
  compact = false,
}: LiIonPackBodyLabelProps) {
  const topology = formatLiIonPackTopology(seriesCells, parallelCount)
  const voltage = liIonPackNominalVoltage(seriesCells)
  const totalMah = liIonPackTotalCapacityMah(cellCapacityMah, parallelCount)

  if (compact) {
    return (
      <div className="pointer-events-none flex flex-col items-center justify-center px-0.5 text-center leading-tight">
        <span className="text-[8px] font-bold text-[#BBF7D0]">{topology}</span>
        <span className="text-[7px] font-medium text-[#86EFAC]">{voltage.toFixed(1)}V</span>
        <span className="text-[7px] text-[#4ADE80]">{formatLiIonCapacityMah(totalMah)}</span>
      </div>
    )
  }

  return (
    <div className="pointer-events-none text-center text-xs text-[#BBF7D0]">
      <div className="font-bold">{topology}</div>
      <div>{voltage.toFixed(1)} V</div>
      <div>{formatLiIonCapacityMah(totalMah)}</div>
    </div>
  )
}
