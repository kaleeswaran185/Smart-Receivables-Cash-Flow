import React, { useState, useEffect } from 'react';
import { Server, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import api from '../../services/api';

export function ServerWakeupGuard({ children }) {
  const [isServerReady, setIsServerReady] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  const checkServerHealth = async () => {
    try {
      const res = await api.get('/health');
      if (res && res.status === 'ok') {
        setIsServerReady(true);
        return true;
      }
    } catch (e) {
      // Server still sleeping or starting up
    }
    return false;
  };

  useEffect(() => {
    let timer = null;
    let pollInterval = null;
    let seconds = 0;

    // Immediate check
    checkServerHealth().then((ready) => {
      if (ready) return;

      // Elapsed seconds counter
      timer = setInterval(() => {
        seconds += 1;
        setElapsedSeconds(seconds);
        if (seconds >= 60) {
          setHasTimedOut(true);
          clearInterval(timer);
          clearInterval(pollInterval);
        }
      }, 1000);

      // Retry every 2.5 seconds
      pollInterval = setInterval(async () => {
        setIsRetrying(true);
        const ok = await checkServerHealth();
        setIsRetrying(false);
        if (ok) {
          clearInterval(timer);
          clearInterval(pollInterval);
        }
      }, 2500);
    });

    return () => {
      if (timer) clearInterval(timer);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  const handleManualRetry = async () => {
    setHasTimedOut(false);
    setElapsedSeconds(0);
    setIsRetrying(true);
    const ok = await checkServerHealth();
    setIsRetrying(false);
    if (!ok) {
      setHasTimedOut(true);
    }
  };

  if (isServerReady) {
    return children;
  }

  const progressPercent = Math.min(100, Math.round((elapsedSeconds / 60) * 100));

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-2xl p-6 sm:p-8 text-center space-y-6 animate-fade-in text-white backdrop-blur-xl">
        <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping" />
          <div className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Server className="w-8 h-8 text-white animate-pulse" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-300 text-xs font-semibold tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Spinning Up Backend</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Waking up the server...
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
            Free-tier hosting instances pause during periods of inactivity. Please wait a moment while the server boots up.
          </p>
        </div>

        {/* Progress Bar & Timer */}
        <div className="space-y-2 bg-slate-900/60 p-4 rounded-xl border border-slate-700/50">
          <div className="flex justify-between text-xs text-slate-400 font-mono">
            <span>Elapsed: {elapsedSeconds}s / 60s</span>
            <span>{isRetrying ? 'Pinging /health...' : `${progressPercent}%`}</span>
          </div>
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 via-indigo-400 to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {hasTimedOut && (
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/40 text-amber-200 text-xs space-y-3">
            <div className="flex items-center justify-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Still starting up...</span>
            </div>
            <p className="text-slate-300">
              The server is taking longer than expected. Click below to re-ping or check your internet connection.
            </p>
            <button
              type="button"
              onClick={handleManualRetry}
              disabled={isRetrying}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>Retry Connection</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ServerWakeupGuard;
