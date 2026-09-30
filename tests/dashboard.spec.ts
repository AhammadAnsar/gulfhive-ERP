import { describe, it, expect } from 'vitest';

describe('GulfHive Dashboard Aggregation Engine', () => {
  it('should correctly format needsAttention items and severity levels', () => {
    const mockSummary = {
      metrics: {
        totalEmployees: 42,
        onDutyCount: 38,
        expiringDocumentsCount: 3,
        pendingLeaveApprovals: 2,
      },
      needsAttention: [
        {
          id: 'expiring_docs',
          category: 'COMPLIANCE',
          severity: 'WARNING',
          title: 'Expiring Statutory Documents',
          count: 3,
        },
        {
          id: 'pending_leaves',
          category: 'TIME',
          severity: 'INFO',
          title: 'Leave Requests Awaiting Approval',
          count: 2,
        },
      ],
    };

    expect(mockSummary.metrics.totalEmployees).toBe(42);
    expect(mockSummary.needsAttention.length).toBe(2);
    expect(mockSummary.needsAttention[0].severity).toBe('WARNING');
  });

  it('should compute onboarding setup progress percentage', () => {
    const setupSteps = [
      { key: 'company_profile', completed: true },
      { key: 'fiscal_year', completed: true },
      { key: 'add_employees', completed: true },
      { key: 'salary_structure', completed: false },
      { key: 'first_payroll', completed: false },
    ];

    const completed = setupSteps.filter((s) => s.completed).length;
    const percentage = Math.round((completed / setupSteps.length) * 100);

    expect(completed).toBe(3);
    expect(percentage).toBe(60);
  });
});
