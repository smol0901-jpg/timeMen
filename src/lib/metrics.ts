// Модуль метрик и телеметрии
export class MetricsEngine {
  private metrics: Map<string, Metric> = new Map();
  private startTime: number = Date.now();
  
  constructor() {
    // Инициализация базовых метрик
    this.registerMetric('app.uptime', 'gauge', 'Время работы приложения (мс)');
    this.registerMetric('app.requests.total', 'counter', 'Общее количество запросов');
    this.registerMetric('app.errors.total', 'counter', 'Общее количество ошибок');
    this.registerMetric('db.size.bytes', 'gauge', 'Размер базы данных (байты)');
    this.registerMetric('db.records.total', 'gauge', 'Общее количество записей в БД');
    this.registerMetric('api.latency.avg', 'gauge', 'Средняя задержка API (мс)');
    this.registerMetric('api.requests.per_minute', 'gauge', 'Запросов в минуту');
    this.registerMetric('cache.hit_rate', 'gauge', 'Процент попаданий в кэш');
    this.registerMetric('users.active', 'gauge', 'Количество активных пользователей');
    this.registerMetric('sync.last_success', 'gauge', 'Время последней успешной синхронизации');
  }
  
  // Регистрация метрики
  registerMetric(name: string, type: 'counter' | 'gauge' | 'histogram', description: string) {
    this.metrics.set(name, {
      name,
      type,
      description,
      value: 0,
      labels: {},
      timestamp: Date.now()
    });
  }
  
  // Установка значения метрики
  setMetric(name: string, value: number, labels: Record<string, string> = {}) {
    const metric = this.metrics.get(name);
    if (metric) {
      metric.value = value;
      metric.labels = labels;
      metric.timestamp = Date.now();
    }
  }
  
  // Инкремент счётчика
  incrementMetric(name: string, increment: number = 1, labels: Record<string, string> = {}) {
    const metric = this.metrics.get(name);
    if (metric && metric.type === 'counter') {
      metric.value += increment;
      metric.labels = labels;
      metric.timestamp = Date.now();
    }
  }
  
  // Получить значение метрики
  getMetric(name: string): number {
    return this.metrics.get(name)?.value || 0;
  }
  
  // Получить все метрики
  getAllMetrics(): Metric[] {
    return Array.from(this.metrics.values());
  }
  
  // Экспорт в Prometheus формат
  exportPrometheus(): string {
    const lines: string[] = [];
    
    this.metrics.forEach((metric) => {
      lines.push(`# HELP ${metric.name} ${metric.description}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);
      
      const labels = Object.entries(metric.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      
      if (labels) {
        lines.push(`${metric.name}{${labels}} ${metric.value} ${metric.timestamp}`);
      } else {
        lines.push(`${metric.name} ${metric.value} ${metric.timestamp}`);
      }
    });
    
    return lines.join('\n');
  }
  
  // Экспорт в JSON
  exportJSON(): string {
    return JSON.stringify({
      timestamp: Date.now(),
      metrics: this.getAllMetrics()
    }, null, 2);
  }
  
  // Обновление метрик приложения
  updateAppMetrics() {
    this.setMetric('app.uptime', Date.now() - this.startTime);
  }
  
  // Обновление метрик базы данных
  updateDbMetrics(dbSize: number, recordCount: number) {
    this.setMetric('db.size.bytes', dbSize);
    this.setMetric('db.records.total', recordCount);
  }
  
  // Обновление метрик API
  updateApiMetrics(latency: number, requestsPerMinute: number) {
    this.setMetric('api.latency.avg', latency);
    this.setMetric('api.requests.per_minute', requestsPerMinute);
  }
  
  // Обновление метрик пользователей
  updateUserMetrics(activeUsers: number) {
    this.setMetric('users.active', activeUsers);
  }
  
  // Обновление метрик синхронизации
  updateSyncMetrics(lastSuccess: number) {
    this.setMetric('sync.last_success', lastSuccess);
  }
  
  // Запись ошибки
  recordError(errorType: string, errorMessage: string) {
    this.incrementMetric('app.errors.total');
    this.incrementMetric('app.errors.total', 1, { type: errorType });
    
    // Логирование ошибки
    console.error(`[Metrics] Error: ${errorType} - ${errorMessage}`);
  }
  
  // Запись запроса
  recordRequest(endpoint: string, latency: number, status: number) {
    this.incrementMetric('app.requests.total');
    this.incrementMetric('app.requests.total', 1, { endpoint, status: status.toString() });
    
    // Обновление средней задержки
    const currentLatency = this.getMetric('api.latency.avg');
    const totalRequests = this.getMetric('app.requests.total');
    const newLatency = (currentLatency * (totalRequests - 1) + latency) / totalRequests;
    this.setMetric('api.latency.avg', newLatency);
  }
  
  // Очистка метрик
  clearMetrics() {
    this.metrics.forEach((metric) => {
      if (metric.type === 'counter') {
        metric.value = 0;
      }
    });
  }
  
  // Получить статистику по метрикам
  getStats(): MetricStats {
    const metrics = this.getAllMetrics();
    const counters = metrics.filter(m => m.type === 'counter');
    const gauges = metrics.filter(m => m.type === 'gauge');
    const histograms = metrics.filter(m => m.type === 'histogram');
    
    return {
      total: metrics.length,
      counters: counters.length,
      gauges: gauges.length,
      histograms: histograms.length,
      lastUpdate: Math.max(...metrics.map(m => m.timestamp))
    };
  }
}

// Интерфейс метрики
export interface Metric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  description: string;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

// Интерфейс статистики метрик
export interface MetricStats {
  total: number;
  counters: number;
  gauges: number;
  histograms: number;
  lastUpdate: number;
}

// Глобальный экземпляр метрик
export const metrics = new MetricsEngine();
