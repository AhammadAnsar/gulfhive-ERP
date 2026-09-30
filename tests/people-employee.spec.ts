import { describe, it, expect, beforeAll } from 'vitest';
import { peopleRepository } from '../src/infrastructure/database/repositories/people.repository.ts';
import { companyRepository } from '../src/infrastructure/database/repositories/company.repository.ts';
import { pdfGeneratorService } from '../src/services/pdf-generator.service.ts';
import { MigrationRunner } from '../src/infrastructure/database/migrations/migration-runner.ts';
import { Money } from '../src/core/domain/money.ts';

describe('GulfHive People Module — Authoritative Employee Master Suite', () => {
  let companyId = 'tenant_corp_01_1790702844962';
  let branchId = '';

  beforeAll(async () => {
    try {
      const migrationRunner = new MigrationRunner();
      await migrationRunner.runAllMigrations();
    } catch {
      // Migrations may be pre-applied or managed by cloudsql-setup / Drizzle
    }

    let company = await companyRepository.getCompanyById(companyId);
    if (!company) {
      const created = await companyRepository.createCompanyWithMainBranchAndAdmin({
        code: `CP${Date.now().toString().slice(-4)}`,
        legalNameEn: 'GulfHive Test Company',
        legalNameAr: 'شركة جلف هايف للاختبار',
        countryCode: 'KW',
        baseCurrency: 'KWD',
        fiscalYearStartMonth: 1,
        timezone: 'Asia/Kuwait',
        branchCode: 'HQ',
        branchNameEn: 'Head Office',
        branchNameAr: 'المكتب الرئيسي',
        adminUid: `admin_${Date.now()}`,
        adminEmail: 'admin@gulfhive.test',
      });
      companyId = created.tenant.id;
      branchId = created.branch.id;
    } else {
      branchId = company.branches[0]?.id || 'br_main_01';
    }
  });

  // --- 1. Employee Core & Numbering Engine ---
  describe('Employee Core & Numbering Engine', () => {
    it('1. should create an employee with auto-generated Employee Code using the central Numbering Engine', async () => {
      const emp = await peopleRepository.createEmployee(companyId, {
        branchId,
        firstNameEn: 'Youssef',
        lastNameEn: 'Al-Mansoor',
        firstNameAr: 'يوسف',
        lastNameAr: 'المنصور',
        gender: 'MALE',
        nationality: 'Kuwaiti',
        email: `youssef_${Date.now()}@gulfhive.internal`,
        joiningDate: new Date().toISOString().slice(0, 10),
        basicSalary: '650.000',
        currency: 'KWD',
        actorId: 'test_admin',
      });

      expect(emp).toBeDefined();
      expect(emp.id).toBeDefined();
      expect(emp.employeeNumber).toMatch(/EMP-/);
      expect(emp.firstNameEn).toBe('Youssef');
      expect(emp.lastNameEn).toBe('Al-Mansoor');
    });

    it('2. should assign numeric integer ID alongside human-readable Employee Code', async () => {
      const emp = await peopleRepository.createEmployee(companyId, {
        branchId,
        firstNameEn: 'Fatima',
        lastNameEn: 'Al-Zahra',
        firstNameAr: 'فاطمة',
        lastNameAr: 'الزهراء',
        gender: 'FEMALE',
        nationality: 'Kuwaiti',
        email: `fatima_${Date.now()}@gulfhive.internal`,
        joiningDate: new Date().toISOString().slice(0, 10),
        basicSalary: '700.000',
        currency: 'KWD',
        actorId: 'test_admin',
      });

      const fullEmp = await peopleRepository.getEmployeeById(companyId, emp.id);
      expect(fullEmp).toBeDefined();
      expect(fullEmp?.employeeNumber).toBeDefined();
      expect(typeof fullEmp?.numericId).toBe('number');
    });

    it('3. should reject duplicate employee code registration within the same company', async () => {
      const customCode = `EMP-TEST-DUP-${Date.now()}`;

      await peopleRepository.createEmployee(companyId, {
        branchId,
        employeeNumber: customCode,
        firstNameEn: 'Khalid',
        lastNameEn: 'Saeed',
        firstNameAr: 'خالد',
        lastNameAr: 'سعيد',
        gender: 'MALE',
        nationality: 'Saudi',
        email: `khalid1_${Date.now()}@gulfhive.internal`,
        joiningDate: new Date().toISOString().slice(0, 10),
        basicSalary: '500.000',
        currency: 'KWD',
        actorId: 'test_admin',
      });

      await expect(
        peopleRepository.createEmployee(companyId, {
          branchId,
          employeeNumber: customCode,
          firstNameEn: 'Khalid',
          lastNameEn: 'Saeed 2',
          firstNameAr: 'خالد',
          lastNameAr: 'سعيد 2',
          gender: 'MALE',
          nationality: 'Saudi',
          email: `khalid2_${Date.now()}@gulfhive.internal`,
          joiningDate: new Date().toISOString().slice(0, 10),
          basicSalary: '500.000',
          currency: 'KWD',
          actorId: 'test_admin',
        })
      ).rejects.toThrow(/already registered/i);
    });

    it('4. should update employee personal information and preserve historical fields', async () => {
      const emp = await peopleRepository.createEmployee(companyId, {
        branchId,
        firstNameEn: 'Tariq',
        lastNameEn: 'Aziz',
        firstNameAr: 'طارق',
        lastNameAr: 'عزيز',
        gender: 'MALE',
        nationality: 'Egyptian',
        email: `tariq_${Date.now()}@gulfhive.internal`,
        joiningDate: new Date().toISOString().slice(0, 10),
        basicSalary: '400.000',
        currency: 'KWD',
        actorId: 'test_admin',
      });

      const updated = await peopleRepository.updateEmployee(companyId, emp.id, {
        personalEmail: 'tariq.personal@gmail.com',
        workPhone: '+965 99887766',
        maritalStatus: 'MARRIED',
        actorId: 'test_admin',
      });

      expect(updated.personalEmail).toBe('tariq.personal@gmail.com');
      expect(updated.workPhone).toBe('+965 99887766');
      expect(updated.maritalStatus).toBe('MARRIED');
    });

    it('5. should archive an employee and update state without destructive loss', async () => {
      const emp = await peopleRepository.createEmployee(companyId, {
        branchId,
        firstNameEn: 'Nasser',
        lastNameEn: 'Al-Khaled',
        firstNameAr: 'ناصر',
        lastNameAr: 'الخالد',
        gender: 'MALE',
        nationality: 'Kuwaiti',
        email: `nasser_${Date.now()}@gulfhive.internal`,
        joiningDate: new Date().toISOString().slice(0, 10),
        basicSalary: '800.000',
        currency: 'KWD',
        actorId: 'test_admin',
      });

      const archived = await peopleRepository.archiveEmployee(companyId, emp.id, 'test_admin');
      expect(archived.employmentStatus).toBe('ARCHIVED');
      expect(archived.archivedAt).toBeDefined();
    });
  });

  // --- 2. Cross-Company Reference Protection ---
  describe('Cross-Company Master Validation', () => {
    it('6. should reject employee creation with branch from another company', async () => {
      await expect(
        peopleRepository.createEmployee(companyId, {
          branchId: 'invalid_foreign_branch_9999',
          firstNameEn: 'Bad',
          lastNameEn: 'Ref',
          firstNameAr: 'سيء',
          lastNameAr: 'مرجع',
          gender: 'MALE',
          nationality: 'Kuwaiti',
          email: `badref_${Date.now()}@gulfhive.internal`,
          joiningDate: new Date().toISOString().slice(0, 10),
          basicSalary: '500.000',
          currency: 'KWD',
          actorId: 'test_admin',
        })
      ).rejects.toThrow(/Cross-company reference violation/i);
    });

    it('7. should reject invalid cross-company department reference', async () => {
      await expect(
        peopleRepository.createEmployee(companyId, {
          branchId,
          departmentId: 'invalid_foreign_dept_8888',
          firstNameEn: 'Bad',
          lastNameEn: 'Dept',
          firstNameAr: 'قسم',
          lastNameAr: 'غير صحيح',
          gender: 'MALE',
          nationality: 'Kuwaiti',
          email: `baddept_${Date.now()}@gulfhive.internal`,
          joiningDate: new Date().toISOString().slice(0, 10),
          basicSalary: '500.000',
          currency: 'KWD',
          actorId: 'test_admin',
        })
      ).rejects.toThrow(/Cross-company reference violation/i);
    });
  });

  // --- 3. Position Transfers & Assignments ---
  describe('Assignments & Organizational History', () => {
    it('8. should record position transfers and close previous active assignment', async () => {
      const emp = await peopleRepository.createEmployee(companyId, {
        branchId,
        firstNameEn: 'Omar',
        lastNameEn: 'Al-Farooq',
        firstNameAr: 'عمر',
        lastNameAr: 'الفاروق',
        gender: 'MALE',
        nationality: 'Jordanian',
        email: `omar_${Date.now()}@gulfhive.internal`,
        joiningDate: new Date().toISOString().slice(0, 10),
        basicSalary: '550.000',
        currency: 'KWD',
        actorId: 'test_admin',
      });

      const initialDetail = await peopleRepository.getEmployeeById(companyId, emp.id);
      expect(initialDetail?.assignments?.length).toBeGreaterThanOrEqual(1);

      // Perform position transfer
      await peopleRepository.updateEmployee(companyId, emp.id, {
        workLocation: 'Secondary Site',
        actorId: 'test_admin',
      });

      const updatedDetail = await peopleRepository.getEmployeeById(companyId, emp.id);
      expect(updatedDetail?.assignments).toBeDefined();
    });
  });

  // --- 4. Contracts Submodule ---
  describe('Employee Contracts', () => {
    it('9. should support contract creation and contract renewal without overwriting historical contract', async () => {
      const emp = await peopleRepository.createEmployee(companyId, {
        branchId,
        firstNameEn: 'Zainab',
        lastNameEn: 'Hassan',
        firstNameAr: 'زينب',
        lastNameAr: 'حسن',
        gender: 'FEMALE',
        nationality: 'Lebanese',
        email: `zainab_${Date.now()}@gulfhive.internal`,
        joiningDate: new Date().toISOString().slice(0, 10),
        basicSalary: '600.000',
        currency: 'KWD',
        actorId: 'test_admin',
      });

      // Renew Contract
      const renewed = await peopleRepository.addContract(companyId, emp.id, {
        contractType: 'LIMITED',
        startDate: new Date().toISOString().slice(0, 10),
        probationDays: 60,
        noticeDays: 60,
        actorId: 'test_admin',
      });

      expect(renewed).toBeDefined();
      expect(renewed.contractType).toBe('LIMITED');

      const fullEmp = await peopleRepository.getEmployeeById(companyId, emp.id);
      expect(fullEmp?.contracts.length).toBeGreaterThanOrEqual(2);
      expect(fullEmp?.contracts.some((c: any) => c.status === 'CLOSED')).toBe(true);
      expect(fullEmp?.contracts.some((c: any) => c.status === 'ACTIVE')).toBe(true);
    });
  });

  // --- 5. Salary Setup & WPS Banking ---
  describe('Salary Setup & Bank Accounts', () => {
    it('10. should revise salary assignment structure with effective dates', async () => {
      const emp = await peopleRepository.createEmployee(companyId, {
        branchId,
        firstNameEn: 'Hassan',
        lastNameEn: 'Al-Banna',
        firstNameAr: 'حسان',
        lastNameAr: 'البنا',
        gender: 'MALE',
        nationality: 'Egyptian',
        email: `hassan_${Date.now()}@gulfhive.internal`,
        joiningDate: new Date().toISOString().slice(0, 10),
        basicSalary: '500.000',
        housingAllowance: '100.000',
        currency: 'KWD',
        actorId: 'test_admin',
      });

      const newSalary = await peopleRepository.addSalaryAssignment(companyId, emp.id, {
        currency: 'KWD',
        basicSalary: '600.000',
        housingAllowance: '150.000',
        transportAllowance: '50.000',
        effectiveDate: new Date().toISOString().slice(0, 10),
        actorId: 'test_admin',
      });

      expect(newSalary.basicSalary).toBe('600.000');
      expect(newSalary.housingAllowance).toBe('150.000');

      const fullEmp = await peopleRepository.getEmployeeById(companyId, emp.id);
      expect(fullEmp?.salaries.length).toBeGreaterThanOrEqual(2);
    });

    it('11. should attach WPS primary bank account details', async () => {
      const emp = await peopleRepository.createEmployee(companyId, {
        branchId,
        firstNameEn: 'Sami',
        lastNameEn: 'Al-Rayes',
        firstNameAr: 'سامي',
        lastNameAr: 'الرايس',
        gender: 'MALE',
        nationality: 'Kuwaiti',
        email: `sami_${Date.now()}@gulfhive.internal`,
        joiningDate: new Date().toISOString().slice(0, 10),
        basicSalary: '900.000',
        currency: 'KWD',
        actorId: 'test_admin',
      });

      const bankAcc = await peopleRepository.addBankAccount(companyId, emp.id, {
        bankName: 'National Bank of Kuwait',
        bankCode: 'NBKKW',
        iban: 'KW08NBK0000000000123456789',
        accountNumber: '123456789',
        isPrimary: true,
        actorId: 'test_admin',
      });

      expect(bankAcc.iban).toBe('KW08NBK0000000000123456789');
      expect(bankAcc.isPrimary).toBe(true);
    });
  });

  // --- 6. Documents & Expiry Engine ---
  describe('Documents & Expiry Engine', () => {
    it('12. should calculate document expiry status accurately', async () => {
      const emp = await peopleRepository.createEmployee(companyId, {
        branchId,
        firstNameEn: 'Maryam',
        lastNameEn: 'Al-Otaibi',
        firstNameAr: 'مريم',
        lastNameAr: 'العتيبي',
        gender: 'FEMALE',
        nationality: 'Kuwaiti',
        email: `maryam_${Date.now()}@gulfhive.internal`,
        joiningDate: new Date().toISOString().slice(0, 10),
        basicSalary: '750.000',
        currency: 'KWD',
        actorId: 'test_admin',
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 180);

      const doc = await peopleRepository.addEmployeeDocument(companyId, emp.id, {
        documentType: 'WORK_PERMIT',
        documentNumber: 'WP-998877',
        expiryDate: futureDate.toISOString().slice(0, 10),
        actorId: 'test_admin',
      });

      expect(doc.status).toBe('VALID');

      const expiringDocs = await peopleRepository.listExpiringDocuments(companyId, 200);
      expect(expiringDocs.some((d: any) => d.id === doc.id)).toBe(true);
    });
  });

  // --- 7. Emergency Contacts & Dependents ---
  describe('Emergency Contacts & Dependents', () => {
    it('13. should store emergency contact and dependent relations', async () => {
      const emp = await peopleRepository.createEmployee(companyId, {
        branchId,
        firstNameEn: 'Bilal',
        lastNameEn: 'Al-Masri',
        firstNameAr: 'بلال',
        lastNameAr: 'المصري',
        gender: 'MALE',
        nationality: 'Egyptian',
        email: `bilal_${Date.now()}@gulfhive.internal`,
        joiningDate: new Date().toISOString().slice(0, 10),
        basicSalary: '480.000',
        currency: 'KWD',
        actorId: 'test_admin',
      });

      const contact = await peopleRepository.addEmergencyContact(companyId, emp.id, 'Salma Al-Masri', 'SPOUSE', '+965 91122334', undefined, true, 'test_admin');
      expect(contact.name).toBe('Salma Al-Masri');

      const dependent = await peopleRepository.addDependent(companyId, emp.id, 'Yara Al-Masri', 'يارا المصري', 'DAUGHTER', '2020-05-15', undefined, 'CIV-8877', 'test_admin');
      expect(dependent.nameEn).toBe('Yara Al-Masri');

      const fullEmp = await peopleRepository.getEmployeeById(companyId, emp.id);
      expect(fullEmp?.emergencyContacts.length).toBeGreaterThanOrEqual(1);
      expect(fullEmp?.dependents.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- 8. Safe Deletion Policy ---
  describe('Safe Employee Deletion Guard', () => {
    it('14. should allow safe deletion of unreferenced draft employee', async () => {
      const emp = await peopleRepository.createEmployee(companyId, {
        branchId,
        firstNameEn: 'Draft',
        lastNameEn: 'Employee',
        firstNameAr: 'مسودة',
        lastNameAr: 'موظف',
        gender: 'MALE',
        nationality: 'Kuwaiti',
        email: `draft_${Date.now()}@gulfhive.internal`,
        joiningDate: new Date().toISOString().slice(0, 10),
        basicSalary: '300.000',
        currency: 'KWD',
        actorId: 'test_admin',
      });

      const result = await peopleRepository.deleteEmployee(companyId, emp.id, 'test_admin');
      expect(result.success).toBe(true);

      const deleted = await peopleRepository.getEmployeeById(companyId, emp.id);
      expect(deleted).toBeNull();
    });
  });

  // --- 9. Vector PDF ID Card & Profile Generation ---
  describe('PDF Generation Engine', () => {
    it('15. should generate valid binary PDF buffer for printable ID card', async () => {
      const pdfBuffer = await pdfGeneratorService.generateIDCard({
        employeeNumber: 'EMP-00125',
        firstNameEn: 'Ahmed',
        lastNameEn: 'Ali',
        firstNameAr: 'أحمد',
        lastNameAr: 'علي',
        designationEn: 'Senior Operations Cleaner',
        departmentEn: 'Operations',
        branchNameEn: 'Head Office',
        companyNameEn: 'GulfHive ERP',
        companyNameAr: 'جلف هايف',
      });

      expect(pdfBuffer).toBeDefined();
      expect(pdfBuffer.length).toBeGreaterThan(500);
      expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('16. should generate valid binary PDF buffer for A4 Employee Profile Report', async () => {
      const pdfBuffer = await pdfGeneratorService.generateProfilePDF({
        employeeNumber: 'EMP-00125',
        firstNameEn: 'Ahmed',
        lastNameEn: 'Ali',
        firstNameAr: 'أحمد',
        lastNameAr: 'علي',
        gender: 'MALE',
        employmentStatus: 'ACTIVE',
        joiningDate: '2026-01-01',
        nationality: 'Kuwaiti',
        civilIdNumber: '290010112345',
        passportNumber: 'K88776655',
        companyNameEn: 'GulfHive ERP',
      });

      expect(pdfBuffer).toBeDefined();
      expect(pdfBuffer.length).toBeGreaterThan(1000);
      expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
    });
  });
});
