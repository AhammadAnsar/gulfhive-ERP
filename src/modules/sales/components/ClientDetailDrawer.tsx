import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Drawer, Button, Input, Select, useToast, LoadingState } from '../../../design-system/index.ts';
import {
  Users,
  Building,
  Phone,
  Mail,
  FileText,
  CreditCard,
  Plus,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download
} from 'lucide-react';

interface ClientDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: number | null;
  companyId: string;
  onEdit: (client: any) => void;
  onViewStatement: (clientId: number) => void;
}

export function ClientDetailDrawer({
  isOpen,
  onClose,
  clientId,
  companyId,
  onEdit,
  onViewStatement,
}: ClientDetailDrawerProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [client, setClient] = useState<any | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'contacts' | 'sites' | 'transactions'>('overview');

  // New Contact Sub-Form
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', jobTitle: '', email: '', phone: '', isPrimary: false });

  // New Site Sub-Form
  const [showAddSite, setShowAddSite] = useState(false);
  const [newSite, setNewSite] = useState({ nameEn: '', nameAr: '', address: '', city: '' });

  const loadClientDetails = async () => {
    if (!clientId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/sales/clients/${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setClient(data.client || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && clientId) {
      loadClientDetails();
      setShowAddContact(false);
      setShowAddSite(false);
      setActiveSubTab('overview');
    }
  }, [isOpen, clientId, companyId]);

  if (!isOpen || !clientId) return null;

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/companies/${companyId}/sales/clients/${clientId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact),
      });
      if (res.ok) {
        addToast({ type: 'success', title: 'Contact Added', message: 'New client contact registered.' });
        setNewContact({ name: '', jobTitle: '', email: '', phone: '', isPrimary: false });
        setShowAddContact(false);
        loadClientDetails();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/companies/${companyId}/sales/clients/${clientId}/sites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSite),
      });
      if (res.ok) {
        addToast({ type: 'success', title: 'Site Added', message: 'Operational location registered.' });
        setNewSite({ nameEn: '', nameAr: '', address: '', city: '' });
        setShowAddSite(false);
        loadClientDetails();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={client ? `${client.code} — ${language === 'ar' ? client.nameAr : client.nameEn}` : 'Client Profile'}
      subtitle={language === 'ar' ? 'ملف العميل المتكامل والعمليات' : 'Authoritative Client Master Record & Audit'}
      width="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onViewStatement(clientId);
              onClose();
            }}
            leftIcon={<FileText className="w-3.5 h-3.5" />}
          >
            {language === 'ar' ? 'عرض كشف الحساب' : 'Account Statement'}
          </Button>
          <div className="flex space-x-2 rtl:space-x-reverse">
            <Button variant="secondary" size="sm" onClick={onClose}>
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
            {client && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onEdit(client);
                  onClose();
                }}
              >
                {language === 'ar' ? 'تعديل البيانات' : 'Edit Profile'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      {isLoading || !client ? (
        <LoadingState label="Loading client ledger..." />
      ) : (
        <div className="space-y-4 text-xs">
          {/* Sub-tab navigation */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveSubTab('overview')}
              className={`px-3 py-2 text-xs font-bold border-b-2 transition ${
                activeSubTab === 'overview'
                  ? 'border-slate-900 text-slate-900 bg-slate-50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {language === 'ar' ? 'نظرة عامة' : 'Overview'}
            </button>
            <button
              onClick={() => setActiveSubTab('contacts')}
              className={`px-3 py-2 text-xs font-bold border-b-2 transition ${
                activeSubTab === 'contacts'
                  ? 'border-slate-900 text-slate-900 bg-slate-50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {language === 'ar' ? `جهات الاتصال (${client.contacts?.length || 0})` : `Contacts (${client.contacts?.length || 0})`}
            </button>
            <button
              onClick={() => setActiveSubTab('sites')}
              className={`px-3 py-2 text-xs font-bold border-b-2 transition ${
                activeSubTab === 'sites'
                  ? 'border-slate-900 text-slate-900 bg-slate-50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {language === 'ar' ? `المواقع والمشاريع (${client.sites?.length || 0})` : `Sites (${client.sites?.length || 0})`}
            </button>
          </div>

          {/* TAB: OVERVIEW */}
          {activeSubTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{language === 'ar' ? 'كود العميل' : 'Code'}</span>
                  <div className="font-mono font-bold text-slate-900">{client.code}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{language === 'ar' ? 'الحالة' : 'Status'}</span>
                  <div>
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                      {client.status}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{language === 'ar' ? 'الاسم بالإنجليزية' : 'Name (En)'}</span>
                  <div className="font-semibold text-slate-800">{client.nameEn}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{language === 'ar' ? 'الاسم بالعربية' : 'Name (Ar)'}</span>
                  <div className="font-semibold text-slate-800">{client.nameAr}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{language === 'ar' ? 'السجل التجاري' : 'CR Number'}</span>
                  <div className="font-mono text-slate-700">{client.crNumber || '—'}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{language === 'ar' ? 'شروط الدفع' : 'Payment Terms'}</span>
                  <div className="text-slate-700">{client.paymentTermsId || '30 Days'}</div>
                </div>
              </div>

              <div className="space-y-2 border border-slate-200 rounded p-3 bg-white">
                <div className="text-[10px] font-bold text-slate-500 uppercase">{language === 'ar' ? 'بيانات التواصل' : 'Contact Channels'}</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center space-x-1.5 rtl:space-x-reverse text-slate-700">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{client.email || '—'}</span>
                  </div>
                  <div className="flex items-center space-x-1.5 rtl:space-x-reverse text-slate-700">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{client.phone || '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: CONTACTS */}
          {activeSubTab === 'contacts' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900">{language === 'ar' ? 'جهات الاتصال المعتمدة' : 'Authorized Contacts'}</h4>
                <Button size="sm" variant="secondary" onClick={() => setShowAddContact(!showAddContact)}>
                  <Plus className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'إضافة جهة اتصال' : 'Add Contact'}</span>
                </Button>
              </div>

              {showAddContact && (
                <form onSubmit={handleAddContact} className="p-3 bg-slate-50 border rounded space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      required
                      placeholder="Contact Name"
                      value={newContact.name}
                      onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                    />
                    <Input
                      placeholder="Job Title"
                      value={newContact.jobTitle}
                      onChange={(e) => setNewContact({ ...newContact, jobTitle: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="email"
                      placeholder="Email"
                      value={newContact.email}
                      onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    />
                    <Input
                      placeholder="Phone"
                      value={newContact.phone}
                      onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end space-x-2 pt-1">
                    <Button size="sm" variant="secondary" type="button" onClick={() => setShowAddContact(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" variant="primary" type="submit">
                      Save Contact
                    </Button>
                  </div>
                </form>
              )}

              {client.contacts && client.contacts.length > 0 ? (
                <div className="space-y-2">
                  {client.contacts.map((ct: any) => (
                    <div key={ct.id} className="p-2.5 bg-white border border-slate-200 rounded flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-900">{ct.name}</div>
                        <div className="text-[11px] text-slate-500">{ct.jobTitle || 'Representative'}</div>
                      </div>
                      <div className="text-right text-[11px] text-slate-600 space-y-0.5">
                        {ct.email && <div>{ct.email}</div>}
                        {ct.phone && <div>{ct.phone}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs">{language === 'ar' ? 'لا توجد جهات اتصال مسجلة.' : 'No contacts added.'}</div>
              )}
            </div>
          )}

          {/* TAB: SITES */}
          {activeSubTab === 'sites' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900">{language === 'ar' ? 'مواقع العمل والمشاريع' : 'Operational Client Sites'}</h4>
                <Button size="sm" variant="secondary" onClick={() => setShowAddSite(!showAddSite)}>
                  <Plus className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'إضافة موقع' : 'Add Site'}</span>
                </Button>
              </div>

              {showAddSite && (
                <form onSubmit={handleAddSite} className="p-3 bg-slate-50 border rounded space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      required
                      placeholder="Site Name (En)"
                      value={newSite.nameEn}
                      onChange={(e) => setNewSite({ ...newSite, nameEn: e.target.value })}
                    />
                    <Input
                      required
                      placeholder="اسم الموقع (عربي)"
                      value={newSite.nameAr}
                      onChange={(e) => setNewSite({ ...newSite, nameAr: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="City / المنطقة"
                      value={newSite.city}
                      onChange={(e) => setNewSite({ ...newSite, city: e.target.value })}
                    />
                    <Input
                      placeholder="Address / العنوان"
                      value={newSite.address}
                      onChange={(e) => setNewSite({ ...newSite, address: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end space-x-2 pt-1">
                    <Button size="sm" variant="secondary" type="button" onClick={() => setShowAddSite(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" variant="primary" type="submit">
                      Save Site
                    </Button>
                  </div>
                </form>
              )}

              {client.sites && client.sites.length > 0 ? (
                <div className="space-y-2">
                  {client.sites.map((st: any) => (
                    <div key={st.id} className="p-2.5 bg-white border border-slate-200 rounded flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-900">{language === 'ar' ? st.nameAr : st.nameEn}</div>
                        <div className="text-[11px] text-slate-500">{st.city || 'Kuwait'}</div>
                      </div>
                      <div className="text-right text-[11px] text-slate-600">
                        <MapPin className="w-3.5 h-3.5 inline text-slate-400 mr-1" />
                        <span>{st.address || 'Standard Location'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs">{language === 'ar' ? 'لا توجد مواقع مسجلة.' : 'No sites registered.'}</div>
              )}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
