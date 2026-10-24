import React, { useState, useEffect } from 'react';
import { Server, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import api from '../../services/api';

export function ServerWakeupGuard({ children }) {
  const isProd = import.meta.env.PROD;
  const rawApiUrl = import.meta.env.VITE_API_URL;
  const isMissingApiUrl = isProd && (!rawApiUrl || !rawApiUrl.trim());

  if (isMissingApiUrl) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/40 rounded-2xl p-6 sm:p-8 space-y-4 shadow-2xl text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Missing VITE_API_URL Configuration</h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            This production build was deployed without the <code className="bg-slate-800 text-rose-300 px-1.5 py-0.5 rounded font-mono">VITE_API_URL</code> environment variable.
          </p>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-left text-xs font-mono text-slate-300 space-y-1">
            <div className="text-slate-500 text-[11px]">// Required Vercel Environment Variable:</div>
            <div className="text-emerald-400 font-bold">VITE_API_URL=https://smart-receivables-cash-flow.onrender.com/api</div>
          </div>
          <p className="text-[11px] text-amber-300">
            Vite bakes environment variables into the bundle at build time. After setting the variable, trigger a redeploy on Vercel.
          </p>
        </div>
      </div>
    );
  }

  const [isServerReady, setIsServerReady] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [lastError, setLastError] = useState(null);

  const checkServerHealth = async () => {
    try {
      const res = await api.get('/health');
      if (res && res.status === 'ok') {
        setIsServerReady(true);
        return true;
      }
    } catch (e) {
      setLastError(e.message || 'Server still starting up or CORS blocked');
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
            <p className="text-slate-300 text-left text-[11px]">
              If your backend is already running on Render, set <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300 font-mono">FRONTEND_URL=*</code> in your Render Environment Variables so browser requests are allowed by CORS.
            </p>
            {lastError && (
              <div className="p-2 rounded bg-slate-900/80 border border-slate-700/60 text-slate-400 font-mono text-[10px] text-left break-all">
                {lastError}
              </div>
            )}
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={handleManualRetry}
                disabled={isRetrying}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>Retry Connection</span>
              </button>
              <button
                type="button"
                onClick={() => setIsServerReady(true)}
                className="w-full py-2 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Proceed to App Anyway
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ServerWakeupGuard;
