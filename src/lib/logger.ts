// Модуль структурированного логирования
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 4,
  ERROR = 8,
  FATAL = 16
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  levelName: string;
  message: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  module?: string;
  action?: string;
  userId?: string;
  duration?: number;
}

export class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private minLevel: LogLevel = LogLevel.INFO;
  private enableConsole: boolean = true;
  private enableStorage: boolean = true;
  
  private constructor() {
    this.loadFromStorage();
  }
  
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  
  // Установка минимального уровня логирования
  setLevel(level: LogLevel) {
    this.minLevel = level;
  }
  
  // Включение/отключение вывода в консоль
  setConsole(enabled: boolean) {
    this.enableConsole = enabled;
  }
  
  // Включение/отключение сохранения в localStorage
  setStorage(enabled: boolean) {
    this.enableStorage = enabled;
  }
  
  // Логирование
  log(level: LogLevel, message: string, context?: Record<string, any>) {
    if (level < this.minLevel) return;
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      levelName: LogLevel[level],
      message,
      context,
      module: context?.module,
      action: context?.action,
      userId: context?.userId,
      duration: context?.duration
    };
    
    this.logs.push(entry);
    
    // Ограничение размера
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    // Вывод в консоль
    if (this.enableConsole) {
      this.printToConsole(entry);
    }
    
    // Сохранение в localStorage
    if (this.enableStorage) {
      this.saveToStorage();
    }
  }
  
  // TRACE уровень
  trace(message: string, context?: Record<string, any>) {
    this.log(LogLevel.TRACE, message, context);
  }
  
  // DEBUG уровень
  debug(message: string, context?: Record<string, any>) {
    this.log(LogLevel.DEBUG, message, context);
  }
  
  // INFO уровень
  info(message: string, context?: Record<string, any>) {
    this.log(LogLevel.INFO, message, context);
  }
  
  // WARN уровень
  warn(message: string, context?: Record<string, any>) {
    this.log(LogLevel.WARN, message, context);
  }
  
  // ERROR уровень
  error(message: string, error?: Error, context?: Record<string, any>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      levelName: 'ERROR',
      message,
      context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined,
      module: context?.module,
      action: context?.action,
      userId: context?.userId,
      duration: context?.duration
    };
    
    this.logs.push(entry);
    
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    if (this.enableConsole) {
      console.error(`[ERROR] ${message}`, error, context);
    }
    
    if (this.enableStorage) {
      this.saveToStorage();
    }
  }
  
  // FATAL уровень
  fatal(message: string, error?: Error, context?: Record<string, any>) {
    this.error(message, error, context);
    
    // Критическая ошибка - дополнительная обработка
    if (this.enableConsole) {
      console.error(`[FATAL] ${message}`, error, context);
    }
  }
  
  // Получить все логи
  getLogs(): LogEntry[] {
    return this.logs;
  }
  
  // Получить логи по уровню
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }
  
  // Получить логи по модулю
  getLogsByModule(module: string): LogEntry[] {
    return this.logs.filter(log => log.module === module);
  }
  
  // Получить логи по пользователю
  getLogsByUser(userId: string): LogEntry[] {
    return this.logs.filter(log => log.userId === userId);
  }
  
  // Очистка логов
  clearLogs() {
    this.logs = [];
    if (this.enableStorage) {
      localStorage.removeItem('smenalan.logs');
    }
  }
  
  // Экспорт в JSON
  exportJSON(): string {
    return JSON.stringify(this.logs, null, 2);
  }
  
  // Экспорт в CSV
  exportCSV(): string {
    const headers = ['timestamp', 'level', 'message', 'module', 'action', 'userId', 'duration'];
    const rows = this.logs.map(log => [
      log.timestamp,
      log.levelName,
      log.message,
      log.module || '',
      log.action || '',
      log.userId || '',
      log.duration?.toString() || ''
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }
  
  // Загрузка из localStorage
  private loadFromStorage() {
    try {
      const stored = localStorage.getItem('smenalan.logs');
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load logs from storage:', error);
    }
  }
  
  // Сохранение в localStorage
  private saveToStorage() {
    try {
      localStorage.setItem('smenalan.logs', JSON.stringify(this.logs));
    } catch (error) {
      console.error('Failed to save logs to storage:', error);
    }
  }
  
  // Вывод в консоль
  private printToConsole(entry: LogEntry) {
    const prefix = `[${entry.levelName}]`;
    const message = `${prefix} ${entry.message}`;
    
    switch (entry.level) {
      case LogLevel.TRACE:
        console.log(message, entry.context);
        break;
      case LogLevel.DEBUG:
        console.debug(message, entry.context);
        break;
      case LogLevel.INFO:
        console.info(message, entry.context);
        break;
      case LogLevel.WARN:
        console.warn(message, entry.context);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(message, entry.context, entry.error);
        break;
    }
  }
  
  // Статистика логов
  getStats(): { total: number; byLevel: Record<string, number>; byModule: Record<string, number> } {
    const byLevel: Record<string, number> = {};
    const byModule: Record<string, number> = {};
    
    this.logs.forEach(log => {
      byLevel[log.levelName] = (byLevel[log.levelName] || 0) + 1;
      if (log.module) {
        byModule[log.module] = (byModule[log.module] || 0) + 1;
      }
    });
    
    return {
      total: this.logs.length,
      byLevel,
      byModule
    };
  }
}

// Глобальный экземпляр логгера
export const logger = Logger.getInstance();
