import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
              Something went wrong
            </h1>
            
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              An unexpected interface error occurred. Your financial records and business data remain safely recorded in the system.
            </p>

            {this.state.error?.message && (
              <div className="mb-6 p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-left overflow-x-auto text-xs font-mono text-rose-300">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 min-h-[48px] px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-600/20"
              >
                <RefreshCw className="w-5 h-5" />
                <span>Reload Application</span>
              </button>

              <a
                href="/dashboard"
                className="flex-1 min-h-[48px] px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-750 text-slate-200 font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Home className="w-5 h-5" />
                <span>Back to Dashboard</span>
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
