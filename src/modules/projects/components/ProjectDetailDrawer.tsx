import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext.tsx';
import { Drawer, Button, Input, Select, useToast, LoadingState } from '../../../design-system/index.ts';
import {
  Building2,
  Building,
  Users,
  MapPin,
  FileText,
  CreditCard,
  Plus,
  ShieldCheck,
  Briefcase,
  Layers,
  ArrowRight
} from 'lucide-react';

interface ProjectDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number | null;
  companyId: string;
  onEdit: (project: any) => void;
  onDeployWorker: (project: any) => void;
}

export function ProjectDetailDrawer({
  isOpen,
  onClose,
  projectId,
  companyId,
  onEdit,
  onDeployWorker,
}: ProjectDetailDrawerProps) {
  const { language } = useI18n();
  const { addToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [project, setProject] = useState<any | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'commercial' | 'contracts' | 'sites' | 'workforce'>('overview');

  const loadDetails = async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && projectId) {
      loadDetails();
      setActiveSubTab('overview');
    }
  }, [isOpen, projectId, companyId]);

  if (!isOpen || !projectId) return null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={project ? `${project.projectCode} — ${language === 'ar' ? project.nameAr : project.nameEn}` : 'Project Master'}
      subtitle={language === 'ar' ? 'ملف المشروع المتكامل والعلاقات التجارية وهيكل العمالة' : 'Authoritative Project Record, Commercial Model & Workforce'}
      width="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (project) onDeployWorker(project);
              onClose();
            }}
            leftIcon={<Users className="w-3.5 h-3.5" />}
          >
            {language === 'ar' ? 'تشغيل / تعيين عمالة' : 'Deploy Workforce'}
          </Button>

          <div className="flex space-x-2 rtl:space-x-reverse">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
            {project && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onEdit(project);
                  onClose();
                }}
              >
                Edit Project
              </Button>
            )}
          </div>
        </div>
      }
    >
      {isLoading || !project ? (
        <LoadingState label="Loading project architecture..." />
      ) : (
        <div className="space-y-4 text-xs">
          {/* Sub-tab switcher */}
          <div className="flex border-b border-slate-200 overflow-x-auto">
            <button
              onClick={() => setActiveSubTab('overview')}
              className={`px-3 py-2 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                activeSubTab === 'overview' ? 'border-slate-900 text-slate-900 bg-slate-50' : 'border-transparent text-slate-500'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveSubTab('commercial')}
              className={`px-3 py-2 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                activeSubTab === 'commercial' ? 'border-slate-900 text-slate-900 bg-slate-50' : 'border-transparent text-slate-500'
              }`}
            >
              Commercial Hierarchy
            </button>
            <button
              onClick={() => setActiveSubTab('contracts')}
              className={`px-3 py-2 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                activeSubTab === 'contracts' ? 'border-slate-900 text-slate-900 bg-slate-50' : 'border-transparent text-slate-500'
              }`}
            >
              Contracts ({project.contracts?.length || 0})
            </button>
            <button
              onClick={() => setActiveSubTab('sites')}
              className={`px-3 py-2 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                activeSubTab === 'sites' ? 'border-slate-900 text-slate-900 bg-slate-50' : 'border-transparent text-slate-500'
              }`}
            >
              Sites ({project.sites?.length || 0})
            </button>
          </div>

          {/* TAB: OVERVIEW */}
          {activeSubTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Project Code</span>
                  <div className="font-mono font-bold text-slate-900">{project.projectCode}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Status</span>
                  <div>
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                      {project.status}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Project Type</span>
                  <div className="font-semibold text-slate-800">{project.projectType}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Billing Method</span>
                  <div className="font-semibold text-slate-800">{project.billingMethod}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Contract Value</span>
                  <div className="font-mono font-bold text-slate-900">
                    {parseFloat(project.contractValue || '0').toFixed(3)} {project.currency}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Timeline</span>
                  <div className="text-slate-700">{project.startDate} → {project.plannedEndDate || 'Ongoing'}</div>
                </div>
              </div>

              {project.description && (
                <div className="p-3 bg-white border rounded">
                  <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Scope of Work</div>
                  <p className="text-slate-700">{project.description}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB: COMMERCIAL HIERARCHY */}
          {activeSubTab === 'commercial' && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-900 text-white rounded-lg space-y-2">
                <div className="text-[10px] uppercase font-bold text-slate-400">Core Commercial Model Separation</div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-slate-400">End Client (المستفيد النهائي):</span>
                    <span className="font-bold">{language === 'ar' ? project.client?.nameAr : project.client?.nameEn}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-slate-400">Principal / Main Contractor:</span>
                    <span className="font-bold">
                      {project.principalSupplier
                        ? (language === 'ar' ? project.principalSupplier.nameAr : project.principalSupplier.nameEn)
                        : 'Direct Client Contract (No Principal)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-slate-400">Authorized Billing Entity (هوية الفاتورة):</span>
                    <span className="font-bold text-emerald-400">
                      {project.billingProfile?.profileName} ({project.billingProfile?.legalNameEn})
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-slate-400">Operating Company:</span>
                    <span className="font-bold">GulfHive Operating Tenant (ABC Contracting)</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border rounded text-[11px] text-slate-600 space-y-1">
                <div className="font-bold text-slate-800 flex items-center space-x-1 rtl:space-x-reverse">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Audit & Legal Compliance Note</span>
                </div>
                <p>
                  All commercial invoices generated from this project will accurately reflect the authorized Billing Entity's legal identity and CR, while internal accounting and workforce payroll ownership remain isolated to the Operating Company.
                </p>
              </div>
            </div>
          )}

          {/* TAB: CONTRACTS */}
          {activeSubTab === 'contracts' && (
            <div className="space-y-3">
              {project.contracts && project.contracts.length > 0 ? (
                <div className="space-y-2">
                  {project.contracts.map((ctr: any) => (
                    <div key={ctr.id} className="p-3 bg-white border rounded space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-bold text-slate-900">{ctr.contractNumber}</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                          {ctr.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                        <div>Type: <span className="font-semibold text-slate-800">{ctr.contractType}</span></div>
                        <div>Value: <span className="font-bold text-slate-900">{parseFloat(ctr.contractValue).toFixed(3)} {ctr.currency}</span></div>
                        <div>Effective: <span>{ctr.effectiveFrom} → {ctr.effectiveTo || 'End'}</span></div>
                        <div>Billing: <span>{ctr.billingMethod}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400">No contracts registered.</div>
              )}
            </div>
          )}

          {/* TAB: SITES */}
          {activeSubTab === 'sites' && (
            <div className="space-y-3">
              {project.sites && project.sites.length > 0 ? (
                <div className="space-y-2">
                  {project.sites.map((st: any) => (
                    <div key={st.id} className="p-3 bg-white border rounded flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-900">
                          {language === 'ar' ? st.siteDetails?.nameAr : st.siteDetails?.nameEn || st.siteCode}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          <MapPin className="w-3 h-3 inline text-slate-400 mr-1" />
                          <span>{st.siteDetails?.address || 'Site Area'}</span>
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                        {st.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400">No project sites assigned.</div>
              )}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
