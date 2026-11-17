/**
 * Synthetic accounts and rooms the T1 role cases need (docs/qa/t1-test-cases.md §C).
 * global-setup.ts creates them (idempotent), signs each one in through the real screens, and
 * writes the ids to .auth/world.json. `ra1` is the Room Administrator that dev already has.
 * Names are ASCII on purpose: a Thai string through `docker exec psql` arrives as "????" on Windows.
 */
export interface Account { key: string; email: string; fullName: string; role: 'GENERAL_USER' | 'ROOM_ADMINISTRATOR' | 'SYSTEM_ADMINISTRATOR'; active: boolean; signIn: boolean; seed: boolean }

export const ACCOUNTS: Account[] = [
  { key: 'u1', email: 'tester@mrr.local', fullName: 'tester', role: 'GENERAL_USER', active: true, signIn: false, seed: false }, // signed in by the original setup → .auth/tester.json
  { key: 'ra1', email: 'admin@mrr.local', fullName: 'admin', role: 'ROOM_ADMINISTRATOR', active: true, signIn: true, seed: false },
  { key: 'u2', email: 'e2e.u2@mrr.local', fullName: 'E2E User Two', role: 'GENERAL_USER', active: true, signIn: true, seed: true },
  { key: 'u3', email: 'e2e.u3@mrr.local', fullName: 'E2E User Three', role: 'GENERAL_USER', active: true, signIn: true, seed: true },
  { key: 'u4', email: 'e2e.u4@mrr.local', fullName: 'E2E User Four', role: 'GENERAL_USER', active: true, signIn: true, seed: true },
  { key: 'ra2', email: 'e2e.ra2@mrr.local', fullName: 'E2E Room Admin Two', role: 'ROOM_ADMINISTRATOR', active: true, signIn: true, seed: true },
  { key: 'sa', email: 'e2e.sa@mrr.local', fullName: 'E2E System Admin', role: 'SYSTEM_ADMINISTRATOR', active: true, signIn: true, seed: true },
  // Books the report fixture's past bookings (support/report-fixture.ts): any mail the api's timers send about them goes here, not to u1.
  { key: 'rpt', email: 'e2e.rptbooker@mrr.local', fullName: 'E2E Report Booker', role: 'GENERAL_USER', active: true, signIn: false, seed: true },
  { key: 'u5', email: 'e2e.u5.inactive@mrr.local', fullName: 'E2E Inactive', role: 'GENERAL_USER', active: false, signIn: false, seed: true },
];

/** Rooms made through the admin API. Capacity 99 keeps them after R-A / R-B in the specs that pick "the first room". */
export const ROOMS = [
  { key: 'open', code: 'E2E-OPEN', name: 'E2E Open Room', requiresApproval: false, approver: null as string | null },
  { key: 'appr', code: 'E2E-APPR', name: 'E2E Approval Room', requiresApproval: true, approver: null },
  { key: 'appr1', code: 'E2E-APPR1', name: 'E2E Approval Room RA1', requiresApproval: true, approver: 'ra1' },
  { key: 'setapr', code: 'E2E-SETAPR', name: 'E2E Set Approver Room', requiresApproval: true, approver: null },
  { key: 'flip', code: 'E2E-FLIP', name: 'E2E Settings Room', requiresApproval: false, approver: null },
  { key: 'maint', code: 'E2E-MAINT', name: 'E2E Maintenance Room', requiresApproval: false, approver: null },
  // Report fixture rooms (support/report-fixture.ts): the "rooms A–E" of GD-mrr-001 / EX-mrr-084–087.
  { key: 'rptA', code: 'E2E-RPT-A', name: 'E2E Rpt A', requiresApproval: false, approver: null },
  { key: 'rptB', code: 'E2E-RPT-B', name: 'E2E Rpt B', requiresApproval: false, approver: null },
  { key: 'rptC', code: 'E2E-RPT-C', name: 'E2E Rpt C', requiresApproval: false, approver: null },
  { key: 'rptD', code: 'E2E-RPT-D', name: 'E2E Rpt D', requiresApproval: false, approver: null },
  { key: 'rptE', code: 'E2E-RPT-E', name: 'E2E Rpt E', requiresApproval: false, approver: null },
] as const;
