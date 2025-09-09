/**
 * Centralized Logging System for CircuitWiz
 * All logs are controlled through this service and can be toggled via DEV menu
 */

export interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  category: string
  message: string
  data?: any
}

export interface LoggingConfig {
  enabled: boolean
  categories: {
    electrical: boolean
    components: boolean
    wires: boolean
    physics: boolean
    circuit: boolean
    grid: boolean
    debug: boolean
    performance: boolean
  }
  captureSnippet: boolean
  snippetDuration: number // in milliseconds
}

class LoggerService {
  private config: LoggingConfig = {
    enabled: false, // Default OFF
    categories: {
      electrical: false,
      components: false,
      wires: false,
      physics: false,
      circuit: false,
      grid: false,
      debug: false,
      performance: false
    },
    captureSnippet: false,
    snippetDuration: 5000 // 5 seconds
  }

  private logBuffer: LogEntry[] = []
  private snippetBuffer: LogEntry[] = []
  private snippetTimer: NodeJS.Timeout | null = null
  private subscribers: Set<(logs: LogEntry[]) => void> = new Set()

  /**
   * Update logging configuration
   */
  updateConfig(newConfig: Partial<LoggingConfig>) {
    this.config = { ...this.config, ...newConfig }
    
    // Start snippet capture if enabled
    if (this.config.captureSnippet && !this.snippetTimer) {
      this.startSnippetCapture()
    } else if (!this.config.captureSnippet && this.snippetTimer) {
      this.stopSnippetCapture()
    }
  }

  /**
   * Get current logging configuration
   */
  getConfig(): LoggingConfig {
    return { ...this.config }
  }

  /**
   * Start capturing a snippet of logs
   */
  startSnippetCapture() {
    this.snippetBuffer = []
    this.snippetTimer = setTimeout(() => {
      this.stopSnippetCapture()
    }, this.config.snippetDuration)
  }

  /**
   * Stop capturing snippet and return the captured logs
   */
  stopSnippetCapture(): LogEntry[] {
    if (this.snippetTimer) {
      clearTimeout(this.snippetTimer)
      this.snippetTimer = null
    }
    const snippet = [...this.snippetBuffer]
    this.snippetBuffer = []
    return snippet
  }

  /**
   * Get recent logs from buffer
   */
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logBuffer.slice(-count)
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logBuffer = []
    this.snippetBuffer = []
    this.notifySubscribers()
  }

  /**
   * Subscribe to log updates
   */
  subscribe(callback: (logs: LogEntry[]) => void): () => void {
    this.subscribers.add(callback)
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback)
    }
  }

  /**
   * Notify all subscribers of log updates
   */
  private notifySubscribers() {
    this.subscribers.forEach(callback => {
      try {
        callback([...this.logBuffer])
      } catch (error) {
        console.error('Error in logger subscriber:', error)
      }
    })
  }

  /**
   * Internal logging method
   */
  private log(level: LogEntry['level'], category: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data
    }

    // Add to main buffer
    this.logBuffer.push(entry)
    
    // Add to snippet buffer if capturing
    if (this.config.captureSnippet && this.snippetTimer) {
      this.snippetBuffer.push(entry)
    }

    // Notify subscribers
    this.notifySubscribers()

    // Output to console if the specific category is enabled
    // The master 'enabled' flag is just for convenience - individual categories can be controlled independently
    if (this.config.categories[category as keyof typeof this.config.categories]) {
      const prefix = this.getLogPrefix(level, category)
      if (data) {
        console.log(prefix, message, data)
      } else {
        console.log(prefix, message)
      }
    }
  }

  /**
   * Get formatted log prefix
   */
  private getLogPrefix(level: LogEntry['level'], category: string): string {
    const timestamp = new Date().toLocaleTimeString()
    const levelEmoji = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌'
    }
    return `${levelEmoji[level]} [${timestamp}] [${category.toUpperCase()}]`
  }

  // Public logging methods for each category
  electrical(message: string, data?: any) {
    this.log('info', 'electrical', message, data)
  }

  electricalDebug(message: string, data?: any) {
    this.log('debug', 'electrical', message, data)
  }

  electricalWarn(message: string, data?: any) {
    this.log('warn', 'electrical', message, data)
  }

  electricalError(message: string, data?: any) {
    this.log('error', 'electrical', message, data)
  }

  components(message: string, data?: any) {
    this.log('info', 'components', message, data)
  }

  componentsDebug(message: string, data?: any) {
    this.log('debug', 'components', message, data)
  }

  componentsWarn(message: string, data?: any) {
    this.log('warn', 'components', message, data)
  }

  componentsError(message: string, data?: any) {
    this.log('error', 'components', message, data)
  }

  wires(message: string, data?: any) {
    this.log('info', 'wires', message, data)
  }

  wiresDebug(message: string, data?: any) {
    this.log('debug', 'wires', message, data)
  }

  physics(message: string, data?: any) {
    this.log('info', 'physics', message, data)
  }

  physicsDebug(message: string, data?: any) {
    this.log('debug', 'physics', message, data)
  }

  circuit(message: string, data?: any) {
    this.log('info', 'circuit', message, data)
  }

  circuitDebug(message: string, data?: any) {
    this.log('debug', 'circuit', message, data)
  }

  grid(message: string, data?: any) {
    this.log('info', 'grid', message, data)
  }

  gridDebug(message: string, data?: any) {
    this.log('debug', 'grid', message, data)
  }

  debug(message: string, data?: any) {
    this.log('debug', 'debug', message, data)
  }

  performance(message: string, data?: any) {
    this.log('info', 'performance', message, data)
  }

  // Generic logging methods
  info(message: string, data?: any) {
    this.log('info', 'debug', message, data)
  }

  warn(message: string, data?: any) {
    this.log('warn', 'debug', message, data)
  }

  error(message: string, data?: any) {
    this.log('error', 'debug', message, data)
  }
}

// Export singleton instance
export const logger = new LoggerService()

// Export types for use in other files
export type Logger = typeof logger