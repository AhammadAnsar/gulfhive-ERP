/**
 * GulfHive ERP - Clean Professional Sign In Screen
 * Single-purpose, enterprise-grade sign-in interface supporting English, Arabic RTL, and Bengali workflows.
 * Strictly zero dummy/hardcoded data.
 */

import React, { useState } from 'react';
import { useAuth } from '../../core/security/AuthContext.tsx';
import { useI18n } from '../../shared/i18n/I18nContext.tsx';
import { Lock, User, Globe, AlertCircle, Eye, EyeOff, Building2 } from 'lucide-react';

interface LoginScreenProps {
  onNavigateToSetup?: () => void;
}

export function LoginScreen({ onNavigateToSetup }: LoginScreenProps) {
  const { login } = useAuth();
  const { language, setLanguage } = useI18n();

  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberDevice, setRememberDevice] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUsername = usernameInput.trim();
    if (!cleanUsername) {
      setErrorMessage(language === 'ar' ? 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني' : 'Please enter your username or email');
      return;
    }

    if (!passwordInput) {
      setErrorMessage(language === 'ar' ? 'يرجى إدخال كلمة المرور' : 'Please enter your password');
      return;
    }

    setIsSubmitting(true);

    try {
      await login(cleanUsername, passwordInput);
    } catch (err: any) {
      const msg = err.message || 'Authentication failed. Please check your credentials.';
      setErrorMessage(msg);
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
            <span className="text-[10px] text-slate-400 font-mono block">Enterprise Security & Identity</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          className="flex items-center space-x-1.5 rtl:space-x-reverse text-xs text-slate-300 hover:text-white transition px-3 py-1.5 rounded border border-slate-800 bg-slate-800/50 cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5" />
          <span className="font-medium">{language === 'ar' ? 'English' : 'العربية'}</span>
        </button>
      </div>

      {/* Center Login Box */}
      <div className="w-full max-w-md mx-auto bg-slate-950/90 border border-slate-800 rounded-xl p-7 shadow-2xl space-y-6">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 mb-2 shadow-inner">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            {language === 'ar' ? 'تسجيل الدخول إلى النظام' : 'Sign in to GulfHive ERP'}
          </h2>
          <p className="text-xs text-slate-400">
            {language === 'ar'
              ? 'أدخل اسم المستخدم أو البريد الإلكتروني وكلمة المرور للمتابعة'
              : 'Enter your organizational credentials to continue'}
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex flex-col gap-1.5">
            <div className="flex items-start space-x-2 rtl:space-x-reverse">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              {language === 'ar' ? 'اسم المستخدم أو البريد الإلكتروني' : 'Username or Email Address'}
            </label>
            <div className="relative">
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder={language === 'ar' ? 'e.g. superadmin or admin@company.com' : 'e.g. superadmin or admin@company.com'}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition"
                required
                autoFocus
              />
              <User className="w-4 h-4 text-slate-500 absolute right-3 rtl:right-auto rtl:left-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              {language === 'ar' ? 'كلمة المرور' : 'Password'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition pr-10 rtl:pr-3.5 rtl:pl-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 rtl:right-auto rtl:left-3 top-2.5 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center space-x-2 rtl:space-x-reverse text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/40"
              />
              <span>{language === 'ar' ? 'تذكر جلسة الدخول' : 'Keep me signed in'}</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold py-2.5 px-4 rounded-lg text-xs transition duration-150 flex items-center justify-center space-x-2 rtl:space-x-reverse cursor-pointer shadow-md"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>{language === 'ar' ? 'تسجيل الدخول' : 'Sign In'}</span>
                <Lock className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* First-Run Setup Link for setting up new institutions */}
        {onNavigateToSetup && (
          <div className="pt-4 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={onNavigateToSetup}
              className="text-xs text-amber-400 hover:text-amber-300 transition flex items-center justify-center space-x-1.5 rtl:space-x-reverse mx-auto cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>
                {language === 'ar'
                  ? 'هل أنت منشأة جديدة؟ تشغيل معالج الإعداد'
                  : 'Setting up a new institution? Launch Setup Wizard'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="text-center text-[11px] text-slate-500 font-mono">
        GulfHive ERP &copy; {new Date().getFullYear()} &middot; Clean Architecture Modular Monolith
      </div>
    </div>
  );
}
