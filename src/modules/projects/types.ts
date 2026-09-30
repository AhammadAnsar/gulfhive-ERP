export interface BillingProfile {
  id: number;
  profileCode: string;
  profileName: string;
  isOperatingCompany: boolean;
  principalSupplierId?: number;
  principalClientId?: number;
  legalNameEn: string;
  legalNameAr: string;
  tradeNameEn?: string;
  tradeNameAr?: string;
  crNumber?: string;
  licenseNumber?: string;
  vatNumber?: string;
  phone?: string;
  email?: string;
  addressEn?: string;
  addressAr?: string;
  bankName?: string;
  iban?: string;
  swiftCode?: string;
  signatoryName?: string;
  signatoryTitle?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  effectiveFrom: string;
  effectiveTo?: string;
  authorizations?: any[];
}

export interface Project {
  id: number;
  projectCode: string;
  nameEn: string;
  nameAr: string;
  projectType: string;
  clientId: number;
  client?: any;
  principalSupplierId?: number;
  principalSupplier?: any;
  billingProfileId: number;
  billingProfile?: BillingProfile;
  contractReference?: string;
  principalReference?: string;
  primarySiteId?: number;
  branchId?: string;
  currency: string;
  contractValue: string;
  billingMethod: string;
  startDate: string;
  plannedEndDate?: string;
  actualEndDate?: string;
  projectManagerEmployeeId?: string;
  status: 'DRAFT' | 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED' | 'CLOSED';
  description?: string;
  contracts?: any[];
  sites?: any[];
  deploymentsCount?: number;
  createdAt?: string;
}

export interface ExternalWorker {
  id: number;
  workerCode: string;
  sourceSupplierId: number;
  supplier?: any;
  nameEn: string;
  nameAr?: string;
  nationalityId?: number;
  profession: string;
  phone?: string;
  identityDocumentType?: string;
  identityDocumentNumber?: string;
  defaultRate?: string;
  rateType: string;
  currency: string;
  availableFrom?: string;
  availableTo?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  deployments?: any[];
}

export interface WorkforceDeployment {
  id: number;
  projectId: number;
  project?: any;
  projectSiteId?: number;
  workforceType: 'INTERNAL_EMPLOYEE' | 'EXTERNAL_WORKER';
  employeeId?: string;
  employee?: any;
  externalWorkerId?: number;
  externalWorker?: any;
  workerName?: string;
  workerCode?: string;
  position?: string;
  shiftId?: string;
  startDate: string;
  endDate?: string;
  deploymentType: string;
  rateOverride?: string;
  rateType?: string;
  currency?: string;
  status: 'PLANNED' | 'ACTIVE' | 'TRANSFERRED' | 'COMPLETED' | 'CANCELLED';
  assignedBy?: string;
}

export interface ExternalLabourSettlement {
  id: number;
  settlementNumber: string;
  supplierId: number;
  supplier?: any;
  projectId: number;
  project?: any;
  periodStart: string;
  periodEnd: string;
  currency: string;
  totalApprovedHours: string;
  totalAmount: string;
  status: 'DRAFT' | 'APPROVED' | 'BILLED' | 'CANCELLED';
  supplierBillId?: number;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
}
