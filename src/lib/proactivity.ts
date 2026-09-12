import { DB } from './types';

// Модуль проактивности - анализ поведения и рекомендации
export class ProactivityEngine {
  private db: DB;
  private recommendations: Recommendation[] = [];
  
  constructor(db: DB) {
    this.db = db;
  }
  
  // Анализ и генерация рекомендаций
  analyze(): Recommendation[] {
    this.recommendations = [];
    
    this.analyzeAttendance();
    this.analyzeOvertime();
    this.analyzeBottlenecks();
    this.analyzePerformance();
    this.analyzeSecurity();
    this.analyzeOptimization();
    
    return this.recommendations;
  }
  
  // Анализ посещаемости
  private analyzeAttendance() {
    const tk = new Date().toISOString().slice(0, 10);
    const lateEmployees = this.db.punches.filter(p => {
      if (p.date !== tk || !p.tout) return false;
      const cell = this.db.schedule.find(s => s.userId === p.userId && s.date === tk);
      if (!cell || (cell.type !== 'day' && cell.type !== 'night')) return false;
      const start = cell.type === 'day' ? 480 : 1200;
      return p.tin > start + 5; // Опоздание более 5 минут
    });
    
    if (lateEmployees.length > 0) {
      const uniqueUsers = [...new Set(lateEmployees.map(p => p.userId))];
      this.recommendations.push({
        id: 'attendance-' + Date.now(),
        type: 'warning',
        priority: 'medium',
        title: 'Обнаружены опоздания',
        description: `${uniqueUsers.length} сотрудников опоздали сегодня`,
        details: uniqueUsers.map(uid => {
          const user = this.db.users.find(u => u.id === uid);
          return user?.name || 'Неизвестный';
        }).join(', '),
        action: 'review_attendance',
        impact: 'productivity',
        createdAt: new Date().toISOString()
      });
    }
  }
  
  // Анализ переработок
  private analyzeOvertime() {
    const tk = new Date().toISOString().slice(0, 10);
    const overtimeEmployees = this.db.punches.filter(p => {
      if (p.date !== tk || !p.tout) return false;
      const cell = this.db.schedule.find(s => s.userId === p.userId && s.date === tk);
      if (!cell) return false;
      const planned = cell.type === 'day' ? 480 : 690;
      const actual = p.tout - p.tin;
      return actual > planned + 60; // Переработка более 1 часа
    });
    
    if (overtimeEmployees.length > 0) {
      this.recommendations.push({
        id: 'overtime-' + Date.now(),
        type: 'warning',
        priority: 'high',
        title: 'Обнаружены переработки',
        description: `${overtimeEmployees.length} сотрудников работают сверхурочно`,
        details: 'Риск выгорания и снижения производительности',
        action: 'review_overtime',
        impact: 'health',
        createdAt: new Date().toISOString()
      });
    }
  }
  
  // Анализ узких мест
  private analyzeBottlenecks() {
    const today = new Date().toISOString().slice(0, 10);
    const workshops = this.db.workshops.map(w => {
      const employees = this.db.users.filter(u => u.workshopId === w.id && u.active);
      const onShift = this.db.punches.filter(p => 
        p.date === today && 
        p.tout === null && 
        employees.some(e => e.id === p.userId)
      ).length;
      return { ...w, onShift, total: employees.length };
    });
    
    const bottlenecks = workshops.filter(w => w.total > 0 && w.onShift / w.total < 0.5);
    
    if (bottlenecks.length > 0) {
      this.recommendations.push({
        id: 'bottleneck-' + Date.now(),
        type: 'info',
        priority: 'medium',
        title: 'Обнаружены узкие места',
        description: `${bottlenecks.length} цехов работают с низкой загрузкой`,
        details: bottlenecks.map(w => `${w.name}: ${w.onShift}/${w.total}`).join(', '),
        action: 'reallocate_resources',
        impact: 'efficiency',
        createdAt: new Date().toISOString()
      });
    }
  }
  
  // Анализ производительности
  private analyzePerformance() {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().slice(0, 10);
    });
    
    const production = this.db.production.filter(p => last7Days.includes(p.date));
    const avgDaily = production.reduce((sum, p) => sum + p.qty, 0) / 7;
    
    if (avgDaily < 100) { // Порог низкой производительности
      this.recommendations.push({
        id: 'performance-' + Date.now(),
        type: 'warning',
        priority: 'high',
        title: 'Низкая производительность',
        description: `Средняя выработка за неделю: ${avgDaily.toFixed(1)} кг/день`,
        details: 'Рекомендуется анализ причин снижения',
        action: 'analyze_production',
        impact: 'productivity',
        createdAt: new Date().toISOString()
      });
    }
  }
  
  // Анализ безопасности
  private analyzeSecurity() {
    const oldCamshots = this.db.camshots.filter(c => {
      const age = (Date.now() - new Date(c.ts).getTime()) / (1000 * 60 * 60 * 24);
      return age > 100; // Старше 100 дней
    });
    
    if (oldCamshots.length > 0) {
      this.recommendations.push({
        id: 'security-' + Date.now(),
        type: 'info',
        priority: 'low',
        title: 'Старые снимки камер',
        description: `${oldCamshots.length} снимков старше 100 дней`,
        details: 'Рекомендуется очистка для освобождения места',
        action: 'cleanup_camshots',
        impact: 'storage',
        createdAt: new Date().toISOString()
      });
    }
  }
  
  // Анализ оптимизации
  private analyzeOptimization() {
    const dbSize = JSON.stringify(this.db).length;
    const dbSizeMB = dbSize / (1024 * 1024);
    
    if (dbSizeMB > 50) { // Более 50 МБ
      this.recommendations.push({
        id: 'optimization-' + Date.now(),
        type: 'info',
        priority: 'medium',
        title: 'Большой размер базы данных',
        description: `Размер БД: ${dbSizeMB.toFixed(1)} МБ`,
        details: 'Рекомендуется архивация старых данных',
        action: 'archive_data',
        impact: 'performance',
        createdAt: new Date().toISOString()
      });
    }
  }
  
  // Получить все рекомендации
  getRecommendations(): Recommendation[] {
    return this.recommendations;
  }
  
  // Получить рекомендации по приоритету
  getRecommendationsByPriority(priority: 'low' | 'medium' | 'high'): Recommendation[] {
    return this.recommendations.filter(r => r.priority === priority);
  }
  
  // Применить рекомендацию
  applyRecommendation(recommendationId: string): boolean {
    const rec = this.recommendations.find(r => r.id === recommendationId);
    if (!rec) return false;
    
    switch (rec.action) {
      case 'cleanup_camshots':
        this.cleanupOldCamshots();
        return true;
      case 'archive_data':
        this.archiveOldData();
        return true;
      default:
        return false;
    }
  }
  
  // Очистка старых снимков
  private cleanupOldCamshots() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 120); // 120 дней
    
    this.db.camshots = this.db.camshots.filter(c => new Date(c.ts) > cutoff);
  }
  
  // Архивация старых данных
  private archiveOldData() {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1); // 1 год
    
    // Архивация старых записей
    this.db.punches = this.db.punches.filter(p => new Date(p.date) > cutoff);
    this.db.production = this.db.production.filter(p => new Date(p.date) > cutoff);
  }
}

// Интерфейс рекомендации
export interface Recommendation {
  id: string;
  type: 'info' | 'warning' | 'error';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  details: string;
  action: string;
  impact: string;
  createdAt: string;
}
