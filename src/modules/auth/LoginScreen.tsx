/**
 * GulfHive ERP - Clean Professional Login Screen
 * Minimal, enterprise sign-in interface supporting English & Arabic RTL.
 */

import React, { useState } from 'react';
import { useAuth } from '../../core/security/AuthContext.tsx';
import { useI18n } from '../../shared/i18n/I18nContext.tsx';
import { Lock, User, Globe, AlertCircle, ArrowRight, ArrowLeft, KeyRound, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { apiClient } from '../../lib/api-client.ts';

export function LoginScreen() {
  const { login, setAuthSession } = useAuth();
  const { language, setLanguage } = useI18n();

  const [mode, setMode] = useState<'LOGIN' | 'ESTABLISH'>('LOGIN');
  const [usernameInput, setUsernameInput] = useState<string>('admin@gulfhive.internal');
  const [passwordInput, setPasswordInput] = useState<string>('admin123456');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('');
  const [rememberDevice, setRememberDevice] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fillAdminCredentials = () => {
    setMode('LOGIN');
    setUsernameInput('admin@gulfhive.internal');
    setPasswordInput('admin123456');
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === 'LOGIN') {
        await login(usernameInput.trim(), passwordInput);
      } else {
        if (!passwordInput || passwordInput.length < 8) {
          throw new Error(language === 'ar' ? 'كلمة المرور يجب أن لا تقل عن 8 خانات' : 'Password must be at least 8 characters long (min 8 chars)');
        }
        if (passwordInput !== confirmPasswordInput) {
          throw new Error(language === 'ar' ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
        }
        const data = await apiClient.post('/api/auth/establish-password', {
          usernameOrEmail: usernameInput.trim(),
          password: passwordInput,
        });
        if (data && data.token && data.user) {
          setSuccessMessage(language === 'ar' ? 'تم تأسيس كلمة المرور بنجاح' : 'Password established successfully');
          setAuthSession(data.user, data.token);
        } else {
          throw new Error('Establishment completed but session could not be verified.');
        }
      }
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
      <div className="w-full max-w-md mx-auto bg-slate-950/90 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-5">
        <div className="text-center space-y-1">
          <div className="w-10 h-10 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 mb-3">
            {mode === 'LOGIN' ? <Lock className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            {mode === 'LOGIN'
              ? (language === 'ar' ? 'تسجيل الدخول إلى النظام' : 'Sign in to GulfHive ERP')
              : (language === 'ar' ? 'تأسيس كلمة مرور المسؤول' : 'Establish Admin Password')}
          </h2>
          <p className="text-xs text-slate-400">
            {mode === 'LOGIN'
              ? (language === 'ar' ? 'أدخل اسم المستخدم وكلمة المرور للمتابعة' : 'Enter your organizational credentials to continue')
              : (language === 'ar' ? 'قم بتعيين كلمة مرور مشفرة لحساب المسؤول' : 'Set a cryptographic password for administrative access')}
          </p>
        </div>

        {/* Ready-to-use Credentials Quick Action Card */}
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs space-y-2">
          <div className="flex items-center justify-between text-amber-300 font-semibold">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              {language === 'ar' ? 'بيانات الدخول الافتراضية (جاهزة)' : 'Initial Default Credentials:'}
            </span>
            <button
              type="button"
              onClick={fillAdminCredentials}
              className="px-2 py-0.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold rounded flex items-center gap-1 transition cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              {language === 'ar' ? 'تعبئة تلقائية' : 'Quick Fill'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300 bg-slate-900/80 p-2 rounded border border-slate-800">
            <div>
              <span className="text-slate-500 block text-[10px]">Email / User:</span>
              <span className="text-amber-200 select-all font-bold">admin@gulfhive.internal</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Password:</span>
              <span className="text-amber-200 select-all font-bold">admin123456</span>
            </div>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 p-1 bg-slate-900 border border-slate-800 rounded text-xs text-center font-medium">
          <button
            type="button"
            onClick={() => { setMode('LOGIN'); setErrorMessage(null); setSuccessMessage(null); }}
            className={`py-1.5 rounded transition cursor-pointer ${mode === 'LOGIN' ? 'bg-slate-800 text-white shadow-2xs font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {language === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={() => { setMode('ESTABLISH'); setErrorMessage(null); setSuccessMessage(null); }}
            className={`py-1.5 rounded transition cursor-pointer ${mode === 'ESTABLISH' ? 'bg-slate-800 text-white shadow-2xs font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {language === 'ar' ? 'تأسيس الحساب' : 'First-time Setup'}
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-rose-300 text-xs flex flex-col gap-1.5">
            <div className="flex items-start space-x-2 rtl:space-x-reverse">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
            {errorMessage.includes('already established') && (
              <button
                type="button"
                onClick={fillAdminCredentials}
                className="self-start mt-1 px-2.5 py-1 bg-amber-500 text-slate-950 text-xs font-bold rounded hover:bg-amber-400 transition cursor-pointer"
              >
                {language === 'ar' ? 'تسجيل الدخول بـ admin123456' : 'Sign in with admin123456'}
              </button>
            )}
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-300 text-xs flex items-start space-x-2 rtl:space-x-reverse">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
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
                placeholder="admin@gulfhive.internal"
                required
                className="w-full bg-slate-900 border border-slate-800 rounded text-white text-xs pl-9 rtl:pr-9 pr-3 py-2 focus:outline-none focus:border-amber-500 transition font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              {mode === 'LOGIN'
                ? (language === 'ar' ? 'كلمة المرور' : 'Password')
                : (language === 'ar' ? 'كلمة المرور الجديدة (8 خانات كحد أدنى)' : 'New Password (min 8 chars)')}
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

          {mode === 'ESTABLISH' && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-300">
                {language === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 rtl:right-3 rtl:left-auto" />
                <input
                  type="password"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded text-white text-xs pl-9 rtl:pr-9 pr-3 py-2 focus:outline-none focus:border-amber-500 transition font-mono"
                />
              </div>
            </div>
          )}

          {mode === 'LOGIN' && (
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
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded transition flex items-center justify-center space-x-2 rtl:space-x-reverse cursor-pointer shadow-lg shadow-amber-500/10"
          >
            <span>
              {isSubmitting
                ? (language === 'ar' ? 'جاري المعالجة...' : 'Processing...')
                : mode === 'LOGIN'
                ? (language === 'ar' ? 'تسجيل الدخول' : 'Sign In')
                : (language === 'ar' ? 'تأسيس كلمة المرور' : 'Establish Password')}
            </span>
            {language === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="pt-2 border-t border-slate-900 text-center space-y-1">
          <span className="text-[11px] font-mono text-slate-500 block">
            Authorized Personnel Only · Immutable Security
          </span>
          <span className="text-[10px] text-slate-500 font-mono block">
            Admin User: admin@gulfhive.internal · Password: admin123456
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
