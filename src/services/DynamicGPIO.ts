export interface DynamicGPIOState {
  pin: number
  state: 'HIGH' | 'LOW' | 'PULSING' | 'INPUT'
  value: number
  timestamp: number
  pattern?: 'BLINK' | 'FADE' | 'STATIC' | 'RANDOM'
  frequency?: number // Hz for blinking
  dutyCycle?: number // 0-1 for pulse width
  microcontrollerId?: string // Added for multi-microcontroller support
}

export interface GPIOAnimation {
  pin: number
  pattern: 'BLINK' | 'FADE' | 'STATIC' | 'RANDOM'
  frequency: number
  dutyCycle: number
  startTime: number
  duration?: number // ms, undefined = infinite
  /** Triangle ramp lower bound (0–1), used for for-loop analogWrite ramps */
  minDutyCycle?: number
  /** Triangle ramp upper bound (0–1), used for for-loop analogWrite ramps */
  maxDutyCycle?: number
}

const ARDUINO_BUILTIN_PINS: Record<string, number> = {
  LED_BUILTIN: 13,
}

/** Strip // and block comments so regex analysis matches real sketch style. */
function stripCppComments(code: string): string {
  return code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Resolve `#define`, `const int`, and Arduino built-ins like LED_BUILTIN. */
export function extractPinConstants(code: string): Map<string, number> {
  const constants = new Map<string, number>(Object.entries(ARDUINO_BUILTIN_PINS))
  const cleaned = stripCppComments(code)

  for (const match of cleaned.matchAll(/#\s*define\s+([A-Za-z_][A-Za-z0-9_]*)\s+(\d+)/g)) {
    constants.set(match[1], parseInt(match[2], 10))
  }

  for (const match of cleaned.matchAll(
    /const\s+(?:unsigned\s+)?(?:int|char|byte|uint8_t)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(\d+)/g
  )) {
    constants.set(match[1], parseInt(match[2], 10))
  }

  return constants
}

export function resolvePinArg(arg: string, constants: Map<string, number>): number | null {
  const trimmed = arg.trim()
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10)
  const resolved = constants.get(trimmed)
  return resolved !== undefined ? resolved : null
}

const DIGITAL_WRITE_RE = /digitalWrite\s*\(\s*([^,\s)]+)\s*,\s*(HIGH|LOW)\s*\)/
const ANALOG_WRITE_RE = /analogWrite\s*\(\s*([^,\s)]+)\s*,\s*([^)]+)\s*\)/
const DELAY_RE = /delay\s*\(\s*(\d+)\s*\)/
const FOR_RAMP_UP_RE =
  /for\s*\(\s*int\s+(\w+)\s*=\s*(\w+)\s*;\s*\1\s*<=\s*(\w+)\s*;\s*\1\+\+/

export class DynamicGPIO {
  private animations: Map<number, GPIOAnimation> = new Map()
  private currentStates: Map<number, DynamicGPIOState> = new Map()
  private animationId: number | null = null
  private isRunning: boolean = false
  private startTime: number = 0
  private passiveMode: boolean = false

  /**
   * Analyze Arduino code to detect GPIO patterns
   */
  analyzeCode(code: string): GPIOAnimation[] {
    const animations: GPIOAnimation[] = []
    const lines = code.split('\n')
    const pinConstants = extractPinConstants(code)
    
    // Look for common patterns
    const blinkPattern = this.detectBlinkPattern(lines, pinConstants)
    const fadePattern = this.detectFadePattern(lines, pinConstants)
    const rampPattern = this.detectRampPattern(lines, pinConstants)
    const staticPattern = this.detectStaticPattern(lines, pinConstants)
    
    console.log(`🔧 [PWM_DEBUG] Code analysis results:`, {
      blinkPattern: blinkPattern.length,
      fadePattern: fadePattern.length,
      rampPattern: rampPattern.length,
      staticPattern: staticPattern.length,
      total: blinkPattern.length + fadePattern.length + rampPattern.length + staticPattern.length
    })
    
    if (fadePattern.length > 0) {
      console.log(`🔧 [PWM_DEBUG] Fade patterns detected:`, fadePattern)
    }
    if (staticPattern.length > 0) {
      console.log(`🔧 [PWM_DEBUG] Static patterns detected:`, staticPattern)
    }
    
    animations.push(...blinkPattern, ...fadePattern, ...rampPattern, ...staticPattern)

    // Prefer animated patterns over static when the same pin appears more than once
    const byPin = new Map<number, GPIOAnimation>()
    const priority = { BLINK: 3, FADE: 2, STATIC: 1, RANDOM: 0 }
    animations.forEach((animation) => {
      const existing = byPin.get(animation.pin)
      if (!existing || priority[animation.pattern] >= priority[existing.pattern]) {
        byPin.set(animation.pin, animation)
      }
    })

    return Array.from(byPin.values())
  }

  /**
   * Detect blinking patterns (digitalWrite in loop)
   */
  private detectBlinkPattern(lines: string[], pinConstants: Map<string, number>): GPIOAnimation[] {
    const animations: GPIOAnimation[] = []
    let inLoop = false
    let loopStartLine = -1
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      if (line.includes('void loop()') || line.includes('void loop ()')) {
        inLoop = true
        loopStartLine = i
        if (line.includes('}')) inLoop = false
        continue
      }
      
      if (inLoop && line.includes('}') && i > loopStartLine) {
        inLoop = false
        continue
      }
      
      if (inLoop) {
        const digitalWriteMatch = line.match(DIGITAL_WRITE_RE)
        if (digitalWriteMatch) {
          const pin = resolvePinArg(digitalWriteMatch[1], pinConstants)
          if (pin === null) continue

          const delayMatch = lines[i + 1]?.match(DELAY_RE)
          if (delayMatch) {
            const delayMs = parseInt(delayMatch[1])
            const frequency = 1000 / (delayMs * 2)
            
            animations.push({
              pin,
              pattern: 'BLINK',
              frequency,
              dutyCycle: 0.5,
              startTime: 0
            })
          }
        }
      }
    }
    
    return animations
  }

  /**
   * Detect fade patterns (analogWrite in loop)
   */
  private detectFadePattern(lines: string[], pinConstants: Map<string, number>): GPIOAnimation[] {
    const animations: GPIOAnimation[] = []
    let inLoop = false
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      if (line.includes('void loop()')) {
        inLoop = true
        if (line.includes('}')) inLoop = false
        continue
      }
      
      if (inLoop && line.includes('}')) {
        inLoop = false
        continue
      }
      
      if (inLoop) {
        const analogWriteMatch = line.match(ANALOG_WRITE_RE)
        if (analogWriteMatch) {
          const pin = resolvePinArg(analogWriteMatch[1], pinConstants)
          if (pin === null) continue
          const value = resolvePinArg(analogWriteMatch[2].trim(), pinConstants)
          if (value === null) continue

          // Look for increment/decrement patterns
          const nextLine = lines[i + 1]?.trim()
          if (nextLine?.includes('delay')) {
            const delayMatch = nextLine.match(DELAY_RE)
            if (delayMatch) {
              const delayMs = parseInt(delayMatch[1])
              
              animations.push({
                pin,
                pattern: 'FADE',
                frequency: 1000 / delayMs,
                dutyCycle: value / 255, // PWM duty cycle
                startTime: 0
              })
            }
          } else {
            // Static PWM in loop - treat as constant PWM signal
            animations.push({
              pin,
              pattern: 'STATIC',
              frequency: 1000, // 1Hz for static
              dutyCycle: value / 255, // PWM duty cycle
              startTime: 0
            })
          }
        }
      }
    }
    
    return animations
  }

  /**
   * Detect throttle ramps: for (int t = MIN; t <= MAX; t++) { analogWrite(PIN, t); delay(...); }
   */
  private detectRampPattern(lines: string[], pinConstants: Map<string, number>): GPIOAnimation[] {
    const animations: GPIOAnimation[] = []
    let inLoop = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      if (line.includes('void loop()')) {
        inLoop = true
        if (line.includes('}')) inLoop = false
        continue
      }

      if (inLoop && line.includes('}')) {
        inLoop = false
        continue
      }

      if (!inLoop) continue

      const forMatch = line.match(FOR_RAMP_UP_RE)
      if (!forMatch) continue

      const loopVar = forMatch[1]
      const minVal = resolvePinArg(forMatch[2], pinConstants)
      const maxVal = resolvePinArg(forMatch[3], pinConstants)
      if (minVal === null || maxVal === null || maxVal <= minVal) continue

      const bodyLines = lines.slice(i + 1, i + 8).map((l) => l.trim())
      let delayMs = 20
      let pin: number | null = null

      for (const bodyLine of bodyLines) {
        const delayMatch = bodyLine.match(DELAY_RE)
        if (delayMatch) delayMs = parseInt(delayMatch[1])

        const analogWriteMatch = bodyLine.match(ANALOG_WRITE_RE)
        if (analogWriteMatch && analogWriteMatch[2].trim() === loopVar) {
          pin = resolvePinArg(analogWriteMatch[1], pinConstants)
        }
      }

      if (pin === null) continue

      const steps = maxVal - minVal + 1
      const rampMs = steps * delayMs * 2
      let pauseMs = 0
      for (const scanLine of lines.slice(i, i + 30)) {
        const delayMatch = scanLine.trim().match(DELAY_RE)
        if (delayMatch) pauseMs += parseInt(delayMatch[1])
      }
      pauseMs = Math.max(pauseMs - rampMs, 0)
      const periodMs = Math.max(rampMs + pauseMs, rampMs)

      animations.push({
        pin,
        pattern: 'FADE',
        frequency: 1000 / periodMs,
        dutyCycle: ((minVal + maxVal) / 2) / 255,
        minDutyCycle: minVal / 255,
        maxDutyCycle: maxVal / 255,
        startTime: 0,
      })
    }

    return animations
  }

  /**
   * Detect static patterns (digitalWrite in setup)
   */
  private detectStaticPattern(lines: string[], pinConstants: Map<string, number>): GPIOAnimation[] {
    const animations: GPIOAnimation[] = []
    let inSetup = false
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      if (line.includes('void loop()')) {
        inSetup = false
        continue
      }

      if (line.includes('void setup()')) {
        inSetup = true
        if (line.includes('}')) inSetup = false
        continue
      }
      
      if (inSetup && line.includes('}')) {
        inSetup = false
        continue
      }
      
      if (inSetup) {
        const digitalWriteMatch = line.match(DIGITAL_WRITE_RE)
        if (digitalWriteMatch) {
          const pin = resolvePinArg(digitalWriteMatch[1], pinConstants)
          if (pin === null) continue
          const state = digitalWriteMatch[2]
          
          animations.push({
            pin,
            pattern: 'STATIC',
            frequency: 0,
            dutyCycle: state === 'HIGH' ? 1 : 0,
            startTime: 0
          })
        }
        
        // Also detect analogWrite in setup (static PWM)
        const analogWriteMatch = line.match(ANALOG_WRITE_RE)
        if (analogWriteMatch) {
          const pin = resolvePinArg(analogWriteMatch[1], pinConstants)
          if (pin === null) continue
          const value = resolvePinArg(analogWriteMatch[2].trim(), pinConstants)
          if (value === null) continue

          animations.push({
            pin,
            pattern: 'STATIC',
            frequency: 0,
            dutyCycle: value / 255, // PWM duty cycle
            startTime: 0
          })
        }
      }
    }
    
    return animations
  }

  /**
   * Set passive mode (for use in multi-microcontroller context)
   */
  setPassiveMode(passive: boolean): void {
    this.passiveMode = passive
  }

  /**
   * Start dynamic GPIO simulation
   */
  startSimulation(animations: GPIOAnimation[]): void {
    this.animations.clear()
    this.currentStates.clear()
    
    // Initialize animations
    animations.forEach(animation => {
      this.animations.set(animation.pin, animation)
    })
    
    this.isRunning = true
    this.startTime = Date.now()
    
        // Only start animation loop if not in passive mode
    if (!this.passiveMode) {
      this.animate()
    } else {
      // Prime states immediately so the first electrical solve sees GPIO output
      this.updateStates(0)
    }
  }

  /**
   * Stop dynamic GPIO simulation
   */
  stopSimulation(): void {
    this.isRunning = false
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  /**
   * Get current GPIO states
   */
  getCurrentStates(): Map<number, DynamicGPIOState> {
    return new Map(this.currentStates)
  }

  /**
   * Test PWM detection with sample code
   */
  testPWMAnalysis(): void {
    const testCode = `void setup() {
  pinMode(9, OUTPUT);
}

void loop() {
  analogWrite(9, 168);
}`

    console.log(`🔧 [PWM_TEST] Testing PWM analysis with code:`)
    console.log(testCode)
    
    const animations = this.analyzeCode(testCode)
    console.log(`🔧 [PWM_TEST] Analysis result:`, animations)
    
    if (animations.length > 0) {
      this.startSimulation(animations)
      setTimeout(() => {
        const states = this.getCurrentStates()
        console.log(`🔧 [PWM_TEST] Current GPIO states:`, Array.from(states.entries()))
      }, 100)
    }
  }

  /**
   * Manually update states (for use in passive mode)
   */
  updateStates(currentTime: number): void {
    if (!this.isRunning) return
    
    // Update each animated pin
    this.animations.forEach((animation, pin) => {
      const state = this.calculatePinState(animation, currentTime)
      this.currentStates.set(pin, state)
    })
  }

  /**
   * Get start time for this GPIO instance
   */
  getStartTime(): number {
    return this.startTime
  }

  /**
   * Animation loop
   */
  private animate(): void {
    if (!this.isRunning) return
    
    const currentTime = Date.now() - this.startTime
    
    // Update each animated pin
    this.animations.forEach((animation, pin) => {
      const state = this.calculatePinState(animation, currentTime)
      this.currentStates.set(pin, state)
    })
    
    // Continue animation
    this.animationId = requestAnimationFrame(() => this.animate())
  }

  /**
   * Calculate pin state based on animation pattern
   */
  private calculatePinState(animation: GPIOAnimation, currentTime: number): DynamicGPIOState {
    switch (animation.pattern) {
      case 'BLINK':
        return this.calculateBlinkState(animation, currentTime)
      case 'FADE':
        return this.calculateFadeState(animation, currentTime)
      case 'STATIC':
        return this.calculateStaticState(animation)
      case 'RANDOM':
        return this.calculateRandomState(animation, currentTime)
      default:
        return {
          pin: animation.pin,
          state: 'LOW',
          value: 0,
          timestamp: currentTime
        }
    }
  }

  /**
   * Calculate blinking state
   */
  private calculateBlinkState(animation: GPIOAnimation, currentTime: number): DynamicGPIOState {
    const period = 1000 / animation.frequency // ms
    const cycleTime = currentTime % period
    const isHigh = cycleTime < (period * animation.dutyCycle)
    
    return {
      pin: animation.pin,
      state: isHigh ? 'HIGH' : 'LOW',
      value: isHigh ? 1 : 0,
      timestamp: currentTime,
      pattern: 'BLINK',
      frequency: animation.frequency,
      dutyCycle: animation.dutyCycle
    }
  }

  /**
   * Calculate fading state
   */
  private calculateFadeState(animation: GPIOAnimation, currentTime: number): DynamicGPIOState {
    const period = animation.frequency > 0 ? 1000 / animation.frequency : 2000
    const cycleTime = currentTime % period
    const normalizedTime = cycleTime / period

    const minDuty = animation.minDutyCycle ?? 0
    const maxDuty = animation.maxDutyCycle ?? 1

    let duty: number
    if (animation.minDutyCycle !== undefined && animation.maxDutyCycle !== undefined) {
      const tri = normalizedTime < 0.5 ? normalizedTime * 2 : 2 - normalizedTime * 2
      duty = minDuty + tri * (maxDuty - minDuty)
    } else {
      duty = (Math.sin(normalizedTime * Math.PI * 2) + 1) / 2
    }

    return {
      pin: animation.pin,
      state: duty > 0 ? 'PULSING' : 'LOW',
      value: duty,
      timestamp: currentTime,
      pattern: 'FADE',
      frequency: animation.frequency,
      dutyCycle: duty
    }
  }

  /**
   * Calculate static state
   */
  private calculateStaticState(animation: GPIOAnimation): DynamicGPIOState {
    // Determine state based on duty cycle
    let state: 'HIGH' | 'LOW' | 'PULSING' = 'LOW'
    if (animation.dutyCycle >= 1) {
      state = 'HIGH'
    } else if (animation.dutyCycle > 0) {
      state = 'PULSING' // PWM signal
    }
    
    const result: DynamicGPIOState = {
      pin: animation.pin,
      state,
      value: animation.dutyCycle,
      timestamp: Date.now() - this.startTime,
      pattern: 'STATIC',
      frequency: 0,
      dutyCycle: animation.dutyCycle
    }
    
    // Debug: Log PWM state creation
    if (state === 'PULSING') {
      console.log(`🔧 [PWM_DEBUG] Created PWM state for pin ${animation.pin}:`, {
        state,
        value: animation.dutyCycle,
        dutyCycle: animation.dutyCycle,
        percentage: (animation.dutyCycle * 100).toFixed(1) + '%'
      })
    }
    
    return result
  }

  /**
   * Calculate random state
   */
  private calculateRandomState(animation: GPIOAnimation, currentTime: number): DynamicGPIOState {
    const value = Math.random()
    
    return {
      pin: animation.pin,
      state: value > 0.5 ? 'HIGH' : 'LOW',
      value,
      timestamp: currentTime,
      pattern: 'RANDOM',
      frequency: animation.frequency,
      dutyCycle: value
    }
  }
}

// Export singleton instance for backward compatibility
export const dynamicGPIO = new DynamicGPIO()

// Make test function and dynamicGPIO available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).testPWM = () => dynamicGPIO.testPWMAnalysis()
  (window as any).dynamicGPIO = dynamicGPIO
}

// Multi-microcontroller GPIO manager
export class MultiMicrocontrollerGPIO {
  private microcontrollers: Map<string, DynamicGPIO> = new Map()
  private globalStates: Map<number, DynamicGPIOState> = new Map()
  private animationId: number | null = null
  private isRunning: boolean = false

  /**
   * Start simulation for a specific microcontroller
   */
  startMicrocontrollerSimulation(microcontrollerId: string, code: string): void {
    console.log(`[MULTI_MCU_GPIO] Starting simulation for ${microcontrollerId}`)
    
    // Create or get existing GPIO instance for this microcontroller
    let mcuGPIO = this.microcontrollers.get(microcontrollerId)
    if (!mcuGPIO) {
      mcuGPIO = new DynamicGPIO()
      mcuGPIO.setPassiveMode(true) // Set to passive mode for multi-MCU context
      this.microcontrollers.set(microcontrollerId, mcuGPIO)
    }
    
    // Analyze code for GPIO patterns
    const animations = mcuGPIO.analyzeCode(code)
    console.log(`[MULTI_MCU_GPIO] Detected patterns for ${microcontrollerId}:`, animations)
    
    // Start simulation for this microcontroller
    mcuGPIO.startSimulation(animations)
    
    // Prime GPIO states before the animation loop's first frame
    mcuGPIO.updateStates(0)
    
    // Start global animation loop if not already running
    if (!this.isRunning) {
      this.startGlobalAnimationLoop()
    }
    
    // Update global states
    this.updateGlobalStates()
  }

  /**
   * Stop simulation for a specific microcontroller
   */
  stopMicrocontrollerSimulation(microcontrollerId: string): void {
    console.log(`[MULTI_MCU_GPIO] Stopping simulation for ${microcontrollerId}`)
    
    const mcuGPIO = this.microcontrollers.get(microcontrollerId)
    if (mcuGPIO) {
      mcuGPIO.stopSimulation()
      this.microcontrollers.delete(microcontrollerId)
    }
    
    // Stop global animation loop if no microcontrollers are running
    if (this.microcontrollers.size === 0) {
      this.stopGlobalAnimationLoop()
    }
    
    // Update global states
    this.updateGlobalStates()
  }

  /**
   * Stop all simulations
   */
  stopAllSimulations(): void {
    console.log('[MULTI_MCU_GPIO] Stopping all simulations')
    
    this.microcontrollers.forEach((mcuGPIO, microcontrollerId) => {
      mcuGPIO.stopSimulation()
    })
    
    this.microcontrollers.clear()
    this.globalStates.clear()
    this.stopGlobalAnimationLoop()
  }

  /**
   * Get GPIO states for a specific microcontroller
   */
  getMicrocontrollerStates(microcontrollerId: string): Map<number, DynamicGPIOState> {
    const mcuGPIO = this.microcontrollers.get(microcontrollerId)
    return mcuGPIO ? mcuGPIO.getCurrentStates() : new Map()
  }

  /**
   * Get all GPIO states from all microcontrollers
   */
  getAllGPIOStates(): Map<number, DynamicGPIOState> {
    return new Map(this.globalStates)
  }

  /**
   * Update global states by merging all microcontroller states
   */
  private updateGlobalStates(): void {
    this.globalStates.clear()
    
    this.microcontrollers.forEach((mcuGPIO, microcontrollerId) => {
      const mcuStates = mcuGPIO.getCurrentStates()
      mcuStates.forEach((state, pin) => {
        // Add microcontroller ID to the state for debugging
        const enhancedState = {
          ...state,
          microcontrollerId
        }
        this.globalStates.set(pin, enhancedState)
      })
    })
    
    console.log(`[MULTI_MCU_GPIO] Updated global states:`, Array.from(this.globalStates.entries()))
  }

  /**
   * Get list of running microcontrollers
   */
  getRunningMicrocontrollers(): string[] {
    return Array.from(this.microcontrollers.keys())
  }

  /**
   * Check if a microcontroller is running
   */
  isMicrocontrollerRunning(microcontrollerId: string): boolean {
    return this.microcontrollers.has(microcontrollerId)
  }

  /**
   * Start the global animation loop
   */
  private startGlobalAnimationLoop(): void {
    if (this.isRunning) return
    
    this.isRunning = true
    console.log('[MULTI_MCU_GPIO] Starting global animation loop')
    this.globalAnimationLoop()
  }

  /**
   * Stop the global animation loop
   */
  private stopGlobalAnimationLoop(): void {
    this.isRunning = false
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    console.log('[MULTI_MCU_GPIO] Stopped global animation loop')
  }

  /**
   * Global animation loop that continuously updates states from all microcontrollers
   */
  private globalAnimationLoop(): void {
    if (!this.isRunning) return
    
    const currentTime = Date.now()
    
    // Manually update each microcontroller's states
    this.microcontrollers.forEach((mcuGPIO, microcontrollerId) => {
      // Calculate time since this microcontroller started
      const mcuStartTime = mcuGPIO.getStartTime()
      const relativeTime = currentTime - mcuStartTime
      mcuGPIO.updateStates(relativeTime)
    })
    
    // Update global states from all microcontrollers
    this.updateGlobalStates()
    
    // Continue animation
    this.animationId = requestAnimationFrame(() => this.globalAnimationLoop())
  }
}

// Export singleton instance for multi-microcontroller support
export const multiMCUGPIO = new MultiMicrocontrollerGPIO()
