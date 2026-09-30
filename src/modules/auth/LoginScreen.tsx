/**
 * GulfHive ERP - Clean Professional Login Screen
 * Minimal, enterprise sign-in interface supporting English & Arabic RTL.
 */

import React, { useState } from 'react';
import { useAuth } from '../../core/security/AuthContext.tsx';
import { useI18n } from '../../shared/i18n/I18nContext.tsx';
import { ShieldCheck, Lock, User, Globe, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button, Input } from '../../design-system/index.ts';

export function LoginScreen() {
  const { login } = useAuth();
  const { t, language, setLanguage } = useI18n();

  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [rememberDevice, setRememberDevice] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await login(usernameInput, passwordInput);
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-between p-6 select-none font-sans" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Top Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5 rtl:space-x-reverse">
          <div className="w-8 h-8 rounded bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-sm font-bold text-sm font-mono">
            GH
          </div>
          <div>
            <span className="text-white font-bold tracking-tight text-sm block">GulfHive ERP</span>
            <span className="text-[10px] text-slate-400 font-mono block">Enterprise Identity & Security</span>
          </div>
        </div>

        <button
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          className="flex items-center space-x-1.5 rtl:space-x-reverse text-xs text-slate-300 hover:text-white transition px-3 py-1.5 rounded border border-slate-800 bg-slate-800/50 cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5" />
          <span className="font-medium">{language === 'ar' ? 'English' : 'العربية'}</span>
        </button>
      </div>

      {/* Center Login Box */}
      <div className="w-full max-w-sm mx-auto bg-slate-950/80 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-6">
        <div className="text-center space-y-1">
          <div className="w-10 h-10 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 mb-3">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            {language === 'ar' ? 'تسجيل الدخول إلى النظام' : 'Sign in to GulfHive ERP'}
          </h2>
          <p className="text-xs text-slate-400">
            {language === 'ar' ? 'أدخل اسم المستخدم وكلمة المرور للمتابعة' : 'Enter your organizational credentials to continue'}
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-rose-300 text-xs flex items-start space-x-2 rtl:space-x-reverse">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              {language === 'ar' ? 'اسم المستخدم / البريد الإلكتروني' : 'Username or Email'}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 rtl:right-3 rtl:left-auto" />
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="username@gulfhive.com"
                required
                className="w-full bg-slate-900 border border-slate-800 rounded text-white text-xs pl-9 rtl:pr-9 pr-3 py-2 focus:outline-none focus:border-amber-500 transition font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              {language === 'ar' ? 'كلمة المرور' : 'Password'}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 rtl:right-3 rtl:left-auto" />
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-slate-900 border border-slate-800 rounded text-white text-xs pl-9 rtl:pr-9 pr-3 py-2 focus:outline-none focus:border-amber-500 transition font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center space-x-2 rtl:space-x-reverse text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
              />
              <span>{language === 'ar' ? 'تذكر هذا الجهاز' : 'Remember this device'}</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded transition flex items-center justify-center space-x-2 rtl:space-x-reverse cursor-pointer shadow-lg shadow-amber-500/10"
          >
            <span>{isSubmitting ? (language === 'ar' ? 'جاري الدخول...' : 'Signing in...') : (language === 'ar' ? 'تسجيل الدخول' : 'Sign In')}</span>
            {language === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="pt-2 border-t border-slate-900 text-center">
          <span className="text-[11px] font-mono text-slate-500">
            Authorized Personnel Only · Immutable Security
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] font-mono text-slate-500">
        GulfHive ERP v2.4.0 · GCC Multi-Tenant Legal & Security Framework
      </div>
    </div>
  );
}
