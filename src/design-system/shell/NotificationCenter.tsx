/**
 * GulfHive ERP - Notification Center Drawer
 * Real-time operational alerts, compliance reminders, and audit notices.
 */

import React, { useState } from 'react';
import { Drawer } from '../components/Drawer.tsx';
import { Bell, CheckCircle2, AlertTriangle, ShieldCheck, Clock, Check } from 'lucide-react';
import { useI18n } from '../../shared/i18n/I18nContext.tsx';
import { Button } from '../components/Button.tsx';

export interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NotificationEntry {
  id: string;
  title: string;
  category: 'audit' | 'compliance' | 'system';
  message: string;
  timestamp: string;
  read: boolean;
}

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const { language } = useI18n();

  const [notifications, setNotifications] = useState<NotificationEntry[]>([
    {
      id: 'notif_1',
      title: language === 'ar' ? 'تحديث نظام حماية الأجور (WPS)' : 'WPS Compliance Engine Updated',
      category: 'compliance',
      message: language === 'ar' ? 'تم تفعيل النسخة المحدثة للوائح حماية الأجور لدول مجلس التعاون.' : 'Statutory WPS rule definitions synchronized with central compliance registry.',
      timestamp: '10 mins ago',
      read: false,
    },
    {
      id: 'notif_2',
      title: language === 'ar' ? 'عملية تدقيق مسجلة' : 'Immutable Audit Log Recorded',
      category: 'audit',
      message: language === 'ar' ? 'تم توثيق تأسيس الفرع الرئيسي في سجل التدقيق غير القابل للتعديل.' : 'Headquarters establishment committed with state differential hash.',
      timestamp: '45 mins ago',
      read: false,
    },
    {
      id: 'notif_3',
      title: language === 'ar' ? 'جاهزية النسخ الاحتياطي للمنشأة' : 'Enterprise Backup Service Ready',
      category: 'system',
      message: language === 'ar' ? 'تم التحقق من مسار التخزين وتشفير قاعدة بيانات المنشأة بنجاح.' : 'Storage adapter validated with SHA-256 integrity checks.',
      timestamp: '2 hours ago',
      read: true,
    },
  ]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const getIcon = (cat: string) => {
    switch (cat) {
      case 'compliance':
        return <ShieldCheck className="w-4 h-4 text-purple-600" />;
      case 'audit':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'system':
      default:
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={language === 'ar' ? 'مركز التنبيهات والتدقيق' : 'Notifications & Audit Alerts'}
      subtitle={language === 'ar' ? 'سجل الإشعارات الإدارية والتنبيهات النظامية' : 'System updates and statutory compliance triggers'}
      footer={
        <div className="w-full flex items-center justify-between text-xs">
          <Button variant="ghost" size="sm" onClick={markAllRead} leftIcon={<Check className="w-3.5 h-3.5" />}>
            {language === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all as read'}
          </Button>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {language === 'ar' ? 'إغلاق' : 'Close'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            {language === 'ar' ? 'لا توجد تنبيهات حالية' : 'No notifications present.'}
          </div>
        ) : (
          notifications.map((item) => (
            <div
              key={item.id}
              onClick={() => markAsRead(item.id)}
              className={`p-3.5 rounded-lg border transition-colors cursor-pointer ${
                item.read
                  ? 'border-slate-100 bg-white text-slate-500'
                  : 'border-slate-200 bg-slate-50/70 text-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  {getIcon(item.category)}
                  <h4 className={`text-xs font-semibold ${item.read ? 'text-slate-700' : 'text-slate-900'}`}>
                    {item.title}
                  </h4>
                </div>
                {!item.read && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1" />
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-2">{item.message}</p>
              <div className="flex items-center space-x-1 rtl:space-x-reverse text-[10px] text-slate-400 font-mono">
                <Clock className="w-3 h-3" />
                <span>{item.timestamp}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </Drawer>
  );
}
