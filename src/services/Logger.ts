/**
 * Centralized logging service for CircuitWiz
 * Provides structured logging with different levels and dev menu integration
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LogEntry {
  id: string
  timestamp: Date
  level: LogLevel
  message: string
  data?: any
}

class LoggerService {
  private logs: LogEntry[] = []
  private maxLogs = 100 // Keep only last 100 logs
  private listeners: ((logs: LogEntry[]) => void)[] = []

  private generateId(): string {
    return `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private addLog(level: LogLevel, message: string, data?: any): void {
    const log: LogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      level,
      message,
      data
    }

    this.logs.unshift(log) // Add to beginning for newest first

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs)
    }

    // Notify listeners
    this.listeners.forEach(listener => listener([...this.logs]))

  }

  // Public logging methods
  info(message: string, data?: any): void {
    this.addLog('info', message, data)
  }

  warn(message: string, data?: any): void {
    this.addLog('warn', message, data)
  }

  error(message: string, data?: any): void {
    this.addLog('error', message, data)
  }

  debug(message: string, data?: any): void {
    this.addLog('debug', message, data)
  }

  // Circuit-specific logging methods
  circuitAnalysis(voltage: number, current: number, resistance: number): void {
    this.info(`Circuit Analysis: ${voltage.toFixed(2)}V, ${(current * 1000).toFixed(1)}mA, ${resistance.toFixed(0)}Ω`)
  }

  componentState(componentType: string, componentId: string, voltage: number, current: number, status: string): void {
    this.debug(`${componentType} (${componentId}): ${voltage.toFixed(2)}V, ${(current * 1000).toFixed(1)}mA, ${status}`)
  }

  pathwayDetected(components: string[], voltage: number, current: number): void {
    this.info(`Pathway detected: ${components.length} components, ${voltage.toFixed(2)}V, ${(current * 1000).toFixed(1)}mA`)
  }

  parallelBranch(branchCount: number, totalResistance: number): void {
    this.info(`Parallel branch: ${branchCount} resistors, ${totalResistance.toFixed(0)}Ω total`)
  }

  // Log management
  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  clearLogs(): void {
    this.logs = []
    this.listeners.forEach(listener => listener([]))
  }

  // Subscribe to log updates
  subscribe(listener: (logs: LogEntry[]) => void): () => void {
    this.listeners.push(listener)
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }
}

// Export singleton instance
export const logger = new LoggerService()

// Export types for use in components
export type { LogEntry, LogLevel }
