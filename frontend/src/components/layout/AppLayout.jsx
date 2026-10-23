import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDemo } from '../../context/DemoContext';
import {
  LayoutDashboard,
  FileText,
  Users,
  CreditCard,
  Flame,
  Inbox,
  TrendingUp,
  Settings,
  Plus,
  Calendar,
  Building2,
  Menu,
  X
} from 'lucide-react';

import { useTranslation } from '../../utils/i18n';

export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { demoDate, business } = useDemo();
  const { t, language, setLanguage } = useTranslation();

  const toggleLanguage = () => {
    setLanguage(language === 'hi' ? 'en' : 'hi');
  };

  const navItems = [
    { name: t('dashboard', 'Dashboard'), path: '/dashboard', icon: LayoutDashboard },
    { name: t('invoices', 'Invoices'), path: '/invoices', icon: FileText },
    { name: t('customers', 'Customers'), path: '/customers', icon: Users },
    { name: t('payments', 'Payments'), path: '/payments', icon: CreditCard },
    { name: t('followups', 'Follow-ups'), path: '/followups', icon: Flame, badge: t('chase', 'Chase') },
    { name: t('inbox', 'Inbox'), path: '/inbox', icon: Inbox },
    { name: t('forecast', 'Cash Forecast'), path: '/forecast', icon: TrendingUp },
    { name: t('settings', 'Settings'), path: '/settings', icon: Settings },
  ];

  // 5 primary items for mobile bottom bar (min 48px touch targets)
  const mobileBottomItems = [
    { name: t('dashboard', 'Dashboard'), path: '/dashboard', icon: LayoutDashboard },
    { name: t('invoices', 'Invoices'), path: '/invoices', icon: FileText },
    { name: t('chase', 'Chase'), path: '/followups', icon: Flame },
    { name: t('forecast', 'Forecast'), path: '/forecast', icon: TrendingUp },
    { name: t('more', 'More'), path: '/settings', icon: Settings, isMenu: true }
  ];

  const pageTitles = {
    '/dashboard': t('dashboard.title', 'Overview Dashboard'),
    '/invoices': t('invoices.title', 'Invoices Ledger'),
    '/invoices/new': t('invoices.create_invoice_title', 'Create Tax Invoice'),
    '/customers': t('customers.title', 'Customers Directory'),
    '/payments': t('payments.title', 'Payments & Settlements'),
    '/followups': t('followups.title', 'Smart Follow-up Queue'),
    '/inbox': t('inbox.title', 'Inbox & Customer Actions'),
    '/forecast': t('forecast.title', '13-Week Cash Flow Forecast'),
    '/settings': t('settings.title', 'Business Settings & Demo Simulator')
  };

  const currentTitle = pageTitles[location.pathname] || (
    location.pathname.startsWith('/invoices/') ? t('invoices.invoice_detail', 'Invoice Details') :
    location.pathname.replace('/', '').replace(/-/g, ' ')
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row antialiased overflow-x-hidden">
      {/* Desktop Sidebar (>= 768px) */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-200 border-r border-slate-800 flex-shrink-0 fixed inset-y-0 left-0 z-30">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-500/20">
              ₹
            </div>
            <div>
              <div className="font-extrabold text-white text-lg tracking-tight">Baaki</div>
              <div className="text-[11px] text-slate-400 font-medium leading-none">{t('app_tagline', 'Smart Cash Flow Assistant')}</div>
            </div>
          </div>
        </div>

        {/* Business Profile Card */}
        <div className="px-4 py-3 mx-3 my-3 rounded-xl bg-slate-800/80 border border-slate-700/60">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span className="truncate">{business?.name || 'Sharma Packaging'}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {business?.city || 'Pune'}, {business?.state_code || 'MH'} • {business?.reg_type || 'Regular'} GST
          </div>
          <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-indigo-400" /> {t('simulated_date', 'Demo Date')}:
            </span>
            <NavLink
              to="/settings"
              className="font-mono font-medium text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50 hover:bg-emerald-900/60 transition-colors"
              title="Change Demo Date in Settings"
            >
              {demoDate}
            </NavLink>
          </div>
        </div>

        {/* Primary Action Button (48px min height) */}
        <div className="px-4 mb-2">
          <button
            type="button"
            onClick={() => navigate('/invoices/new')}
            className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20"
          >
            <Plus className="w-5 h-5" />
            <span>{t('create_invoice', 'Create Invoice')}</span>
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive: navActive }) => `
                  min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors
                  ${(navActive || isActive)
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-700 text-white px-2 py-0.5 rounded-full border border-rose-800 shadow-sm">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Safety buffer note */}
        <div className="p-4 border-t border-slate-800 text-xs text-slate-400 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">{t('safety_buffer', 'Safety Buffer')}</span>
            <span className="font-semibold text-white">₹5,00,000</span>
          </div>
        </div>
      </aside>

      {/* Main Content Layout */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0 max-w-full">
        {/* Mobile Top Header (< 768px) */}
        <header className="md:hidden bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-20 px-3 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center text-white font-black text-base flex-shrink-0">
              ₹
            </div>
            <div className="truncate">
              <h1 className="font-bold text-white text-sm leading-tight truncate">
                {business?.name || 'Sharma Packaging'}
              </h1>
              <NavLink to="/settings" className="text-[10px] text-emerald-400 font-mono hover:underline">
                Demo: {demoDate}
              </NavLink>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <select
              aria-label="Select Language / भाषा चुनें / மொழியைத் தேர்ந்தெடுக்கவும்"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="min-h-[44px] px-2 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-200 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="ta">தமிழ்</option>
            </select>

            <button
              type="button"
              onClick={() => navigate('/invoices/new')}
              className="min-h-[44px] min-w-[44px] px-2.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1 shadow-sm"
              aria-label="New Invoice"
            >
              <Plus className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="min-h-[44px] min-w-[44px] rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 active:bg-slate-800 flex items-center justify-center"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Mobile Fullscreen Slideout Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-slate-900/95 backdrop-blur-md pt-20 pb-28 px-4 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-semibold uppercase text-slate-400">{t('select_language', 'Language')}</span>
                <div className="flex items-center rounded-lg border border-slate-700 p-0.5 bg-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${language === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-300'}`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('hi')}
                    className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${language === 'hi' ? 'bg-indigo-600 text-white' : 'text-slate-300'}`}
                  >
                    हिन्दी
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('ta')}
                    className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${language === 'ta' ? 'bg-indigo-600 text-white' : 'text-slate-300'}`}
                  >
                    தமிழ்
                  </button>
                </div>
              </div>

              <div className="text-xs font-semibold uppercase text-slate-400 px-3 py-1">Navigation</div>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      min-h-[48px] flex items-center justify-between px-4 py-3 rounded-xl text-base font-medium
                      ${isActive ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-200 hover:bg-slate-800'}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="text-xs font-bold uppercase tracking-wider bg-rose-700 text-white px-2 py-0.5 rounded-full border border-rose-800 shadow-sm">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>

            <div className="pt-6 border-t border-slate-800 text-center space-y-2">
              <div className="text-sm font-semibold text-white">Sharma Packaging, Pune</div>
              <div className="text-xs text-slate-400">Baaki Smart Receivables Assistant</div>
            </div>
          </div>
        )}

        {/* Desktop Top Header Bar (Breadcrumb & Meta) */}
        <div className="hidden md:flex items-center justify-between px-8 py-4 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {currentTitle}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Trilingual Switcher (English | हिन्दी | தமிழ்) */}
            <div className="flex items-center rounded-xl border border-slate-300 dark:border-slate-700 p-1 bg-slate-100 dark:bg-slate-800 text-xs font-semibold shadow-sm">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  language === 'en'
                    ? 'bg-indigo-600 text-white font-extrabold shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Switch to English"
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage('hi')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  language === 'hi'
                    ? 'bg-indigo-600 text-white font-extrabold shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="हिन्दी में बदलें"
              >
                हिन्दी
              </button>
              <button
                type="button"
                onClick={() => setLanguage('ta')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  language === 'ta'
                    ? 'bg-indigo-600 text-white font-extrabold shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="தமிழுக்கு மாறவும்"
              >
                தமிழ்
              </button>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
              <Calendar className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" />
              <span>{t('simulated_date', 'Simulated Date')}: <strong className="text-slate-950 dark:text-white font-mono">{demoDate}</strong></span>
            </div>

            <button
              type="button"
              onClick={() => navigate('/invoices/new')}
              className="min-h-[48px] px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-sm flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('new_invoice', 'New Invoice')}</span>
            </button>
          </div>
        </div>

        {/* Main Routed Page Content */}
        <main className="flex-1 w-full max-w-full p-4 sm:p-6 lg:p-8 pb-28 md:pb-12 min-w-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Fixed, min-h-[56px], 48px touch targets) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 shadow-lg px-2 py-1 flex items-center justify-around"
      >
        {mobileBottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={`
                flex-1 min-h-[48px] py-1 px-1 flex flex-col items-center justify-center rounded-xl text-[11px] font-semibold transition-colors
                ${isActive ? 'text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}
              `}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`} />
              <span className="truncate max-w-[60px] text-center">{item.name}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

export default AppLayout;
