import React, { Component, ErrorInfo, ReactNode } from 'react';
import { I } from './ui';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      errorInfo: errorInfo
    });

    // Логируем ошибку в localStorage для отладки
    const errorLog = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    };
    
    try {
      const existingLogs = JSON.parse(localStorage.getItem('smenalan-errors') || '[]');
      existingLogs.push(errorLog);
      // Храним только последние 50 ошибок
      if (existingLogs.length > 50) {
        existingLogs.shift();
      }
      localStorage.setItem('smenalan-errors', JSON.stringify(existingLogs));
    } catch (e) {
      console.error('Failed to save error log:', e);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Пользовательский fallback, если предоставлен
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Дефолтный UI для ошибки
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-paper via-paper to-[#e8ecf1] p-4">
          <div className="card max-w-2xl w-full p-8 anim-pop">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-bad-soft text-bad grid place-items-center shrink-0">
                <I n="warn" size={32} />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold text-ink">Произошла ошибка</h1>
                <p className="text-mute text-sm mt-1">
                  Приложение столкнулось с непредвиденной ошибкой
                </p>
              </div>
            </div>

            <div className="bg-bad-soft/50 border border-bad/20 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <I n="warn" size={20} className="text-bad shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <b className="text-sm text-bad block mb-1">
                    {this.state.error?.message || 'Неизвестная ошибка'}
                  </b>
                  {this.state.error?.stack && (
                    <details className="mt-2">
                      <summary className="text-xs text-mute cursor-pointer hover:text-ink transition">
                        Показать детали ошибки
                      </summary>
                      <pre className="mt-2 text-xs text-mute font-mono overflow-x-auto whitespace-pre-wrap">
                        {this.state.error.stack}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="bg-paper/50 border border-line rounded-xl p-4">
                <h3 className="text-sm font-bold text-ink mb-2 flex items-center gap-2">
                  <I n="info" size={16} className="text-night" />
                  Что можно сделать:
                </h3>
                <ul className="space-y-2 text-sm text-mute">
                  <li className="flex items-start gap-2">
                    <I n="check" size={16} className="text-ok shrink-0 mt-0.5" />
                    <span>Попробуйте перезагрузить страницу</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <I n="check" size={16} className="text-ok shrink-0 mt-0.5" />
                    <span>Очистите кэш браузера (Ctrl+Shift+Delete)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <I n="check" size={16} className="text-ok shrink-0 mt-0.5" />
                    <span>Проверьте подключение к интернету</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <I n="check" size={16} className="text-ok shrink-0 mt-0.5" />
                    <span>Если проблема повторяется, свяжитесь с поддержкой</span>
                  </li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={this.handleReset}
                  className="btn btn-ghost flex-1"
                >
                  <I n="refresh" size={16} />
                  Попробовать снова
                </button>
                <button
                  onClick={this.handleReload}
                  className="btn btn-pri flex-1"
                >
                  <I n="history" size={16} />
                  Перезагрузить страницу
                </button>
              </div>

              <div className="text-center pt-4 border-t border-line">
                <p className="text-xs text-mute">
                  Ошибка автоматически сохранена в журнале для анализа
                </p>
                <p className="text-xs text-mute mt-1">
                  Поддержка: <a href="mailto:smolyaninovchef@vk.com" className="text-accent hover:underline">smolyaninovchef@vk.com</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC для оборачивания компонентов
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
): React.FC<P> {
  return (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );
}
