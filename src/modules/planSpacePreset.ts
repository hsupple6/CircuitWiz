import { PlanSpace, PlanBubble, PlanConnection } from '../types/workspace'

const P = 'preset'

function bubble(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  shape: PlanBubble['shape'],
  color: string,
  extra: Partial<PlanBubble> = {}
): PlanBubble {
  return { id: `${P}-${id}`, x, y, width, height, text, shape, color, ...extra }
}

function conn(from: string, to: string, extra: Partial<PlanConnection> = {}): PlanConnection {
  return { id: `${P}-c-${from}-${to}`, fromBubbleId: `${P}-${from}`, toBubbleId: `${P}-${to}`, ...extra }
}

/** Curated electronics project workflow — idea through prototyping to ship */
export function createDefaultPlanSpacePreset(): Pick<PlanSpace, 'bubbles' | 'connections' | 'arrows' | 'metadata'> {
  const cx = 420

  const bubbles: PlanBubble[] = [
    bubble('title', cx - 200, 0, 400, 56, 'Project Roadmap', 'phase', 'transparent', {
      textColor: '#4f46e5',
      borderColor: 'transparent',
      subtitle: 'From idea to working prototype',
    }),

    bubble('idea', cx - 130, 100, 260, 72, 'Define the Idea', 'pill', '#ede9fe', {
      subtitle: 'What problem? Who benefits?',
      textColor: '#5b21b6',
      borderColor: '#c4b5fd',
    }),

    bubble('research', cx - 150, 210, 300, 88, 'Research & Requirements', 'card', '#ffffff', {
      subtitle: 'Specs, constraints, budget, timeline',
      textColor: '#1e293b',
      borderColor: '#e2e8f0',
      shadow: true,
    }),

    bubble('sketch', cx - 150, 340, 300, 88, 'Sketch & Plan', 'card', '#ffffff', {
      subtitle: 'Block diagram, signal flow, pin map',
      textColor: '#1e293b',
      borderColor: '#e2e8f0',
      shadow: true,
    }),

    bubble('components', cx - 150, 470, 300, 88, 'Select Components', 'card', '#ffffff', {
      subtitle: 'MCU, sensors, passives, connectors',
      textColor: '#1e293b',
      borderColor: '#e2e8f0',
      shadow: true,
    }),

    bubble('schematic', cx - 160, 600, 320, 96, 'Schematic Design', 'card', '#eff6ff', {
      subtitle: 'Build your circuit in CircuitWiz',
      textColor: '#1e40af',
      borderColor: '#93c5fd',
      shadow: true,
    }),

    bubble('breadboard', cx - 150, 740, 300, 88, 'Breadboard Prototype', 'card', '#ffffff', {
      subtitle: 'Wire it up, verify basics',
      textColor: '#1e293b',
      borderColor: '#e2e8f0',
      shadow: true,
    }),

    bubble('firmware', cx - 150, 870, 300, 88, 'Write Firmware', 'card', '#ffffff', {
      subtitle: 'Code, upload, serial debug',
      textColor: '#1e293b',
      borderColor: '#e2e8f0',
      shadow: true,
    }),

    bubble('test', cx - 100, 1000, 200, 100, 'Test &\nDebug', 'diamond', '#fef3c7', {
      subtitle: 'Works?',
      textColor: '#92400e',
      borderColor: '#fcd34d',
    }),

    bubble('iterate', cx - 340, 1160, 240, 72, 'Iterate', 'pill', '#fce7f3', {
      subtitle: 'Fix issues, refine design',
      textColor: '#9d174d',
      borderColor: '#f9a8d4',
    }),

    bubble('finalize', cx + 100, 1160, 240, 72, 'Finalize Build', 'pill', '#dcfce7', {
      subtitle: 'PCB, enclosure, polish',
      textColor: '#166534',
      borderColor: '#86efac',
    }),

    bubble('document', cx - 150, 1300, 300, 80, 'Document & Share', 'ellipse', '#f0fdf4', {
      subtitle: 'Notes, BOM, lessons learned',
      textColor: '#15803d',
      borderColor: '#bbf7d0',
    }),
  ]

  const connections: PlanConnection[] = [
    conn('idea', 'research', { color: '#a78bfa', curve: 'arc' }),
    conn('research', 'sketch', { color: '#94a3b8' }),
    conn('sketch', 'components', { color: '#94a3b8' }),
    conn('components', 'schematic', { color: '#60a5fa', curve: 'arc' }),
    conn('schematic', 'breadboard', { color: '#94a3b8' }),
    conn('breadboard', 'firmware', { color: '#94a3b8' }),
    conn('firmware', 'test', { color: '#fbbf24', curve: 'arc' }),
    conn('test', 'iterate', { color: '#f472b6', curve: 'arc', dashed: true }),
    conn('test', 'finalize', { color: '#4ade80', curve: 'arc' }),
    conn('iterate', 'schematic', { color: '#f472b6', curve: 'elbow', dashed: true }),
    conn('finalize', 'document', { color: '#4ade80', curve: 'arc' }),
  ]

  return {
    bubbles,
    connections,
    arrows: [],
    metadata: { zoom: 0.85, offset: { x: 80, y: 40 } },
  }
}
