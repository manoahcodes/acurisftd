import { mockSessionProvider } from "./mock";
import { mockDashboardRepository } from "./dashboard-mock";
import {
  mockAcademicYearRepository,
  mockSearchRepository,
} from "./directory-mock";
import {
  mockChildRepository,
  mockNotificationRepository,
} from "./topbar-mock";
import { mockCampusRepository } from "./campus-mock";
import { mockNavBadgeRepository } from "./sidebar-mock";
import { mockPlatformScreenRepository } from "./platform-mock";
import { mockTenantDirectory } from "./tenants-mock";
import { mockAuditLog } from "./audit-mock";
import { mockRecordStore } from "./records-mock";
import { mockThemeRepository } from "./theme-mock";
import { mockTeachingRepository } from "./teacher-mock";
import type { TeachingRepository } from "./teacher-types";
import type { ThemeRepository } from "./theme-types";
import type { AuditLog } from "./audit-types";
import type { RecordStore } from "./records-types";
import type {
  PlatformScreenRepository,
  TenantDirectory,
} from "./platform-types";
import type { DashboardRepository, SessionProvider } from "./types";
import type {
  AcademicYearRepository,
  SearchRepository,
} from "./directory-types";
import type {
  ChildRepository,
  NotificationRepository,
} from "./topbar-types";
import type { CampusRepository } from "./campus-types";
import type { NavBadgeRepository } from "./sidebar-types";

/**
 * SWAP POINT: replace these with implementations backed by your custom
 * database / API, e.g. `new StecaDashboardRepository(db)`.
 */
export const dashboards: DashboardRepository = mockDashboardRepository;
export const session: SessionProvider = mockSessionProvider;
export const academicYears: AcademicYearRepository = mockAcademicYearRepository;
export const searchIndex: SearchRepository = mockSearchRepository;
export const notifications: NotificationRepository = mockNotificationRepository;
export const guardianChildren: ChildRepository = mockChildRepository;
export const campuses: CampusRepository = mockCampusRepository;
export const navBadges: NavBadgeRepository = mockNavBadgeRepository;
export const tenantDirectory: TenantDirectory = mockTenantDirectory;
export const platformScreens: PlatformScreenRepository = mockPlatformScreenRepository;
export const records: RecordStore = mockRecordStore;
export const themes: ThemeRepository = mockThemeRepository;
export const audit: AuditLog = mockAuditLog;

export const teaching: TeachingRepository = mockTeachingRepository;
