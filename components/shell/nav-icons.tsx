import {
  ArrowLeftRight, Award, Baby, BadgeCheck, Banknote, BedDouble, Bell, BookCheck, BookMarked, BookOpen,
  Briefcase, Building2, CalendarCheck, CalendarClock, CalendarDays, CalendarRange, Calculator, ChartColumn,
  ChartPie, Circle, CircleDollarSign, ClipboardCheck, ClipboardList, ClipboardPen, Coins,
  CreditCard, FileCheck2, FileText, FolderOpen, Gauge, GitCompare, Globe, GraduationCap,
  DoorOpen, HandCoins, History, House, IdCard, KeyRound, Landmark, Layers, LayoutDashboard, Library,
  LifeBuoy, ListChecks, ListOrdered, ListTree, MapPin, Megaphone, MessageSquare, Network,
  NotebookPen, PenLine, Presentation, Printer, ReceiptText, Scale, School, ScrollText, Search,
  Settings, ShieldCheck, Store, Table2, Ticket, TrendingUp, Trophy, Upload, UserCheck, UserCog,
  UserRound, Users, UserX, Wallet, WalletCards,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/format";

/** Every icon the sidebar can show, by name. Names (strings) can cross the server/client boundary. */
const ICONS = {
  ArrowLeftRight, Award, Baby, BadgeCheck, Banknote, BedDouble, Bell, BookCheck, BookMarked, BookOpen,
  Briefcase, Building2, CalendarCheck, CalendarClock, CalendarDays, CalendarRange, Calculator, ChartColumn,
  ChartPie, Circle, CircleDollarSign, ClipboardCheck, ClipboardList, ClipboardPen, Coins,
  CreditCard, FileCheck2, FileText, FolderOpen, Gauge, GitCompare, Globe, GraduationCap,
  DoorOpen, HandCoins, History, House, IdCard, KeyRound, Landmark, Layers, LayoutDashboard, Library,
  LifeBuoy, ListChecks, ListOrdered, ListTree, MapPin, Megaphone, MessageSquare, Network,
  NotebookPen, PenLine, Presentation, Printer, ReceiptText, Scale, School, ScrollText, Search,
  Settings, ShieldCheck, Store, Table2, Ticket, TrendingUp, Trophy, Upload, UserCheck, UserCog,
  UserRound, Users, UserX, Wallet, WalletCards,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/**
 * Icon for each sidebar entry, keyed by the raw label in config/navigation.ts
 * (including {tokens}). Sections and their pages share one table so a new page
 * only needs a line here. Unknown labels get a plain dot instead of breaking.
 */
const LABEL_ICONS: Record<string, IconName> = {
  // ---- Platform Admin: overview and groups
  Overview: "LayoutDashboard",
  Platform: "Globe",
  Institution: "Landmark",
  Finances: "Wallet",
  Users: "Users",
  Registrations: "ClipboardPen",
  Academics: "Library",
  Examinations: "ClipboardCheck",
  Hostels: "House",
  Reports: "ChartColumn",
  Administration: "ShieldCheck",

  // Platform
  "Tenants & schools": "School",
  Subscriptions: "CreditCard",
  "Platform users": "UserCog",
  "Usage & capacity": "Gauge",
  "Support queue": "LifeBuoy",
  // Institution
  Campuses: "MapPin",
  Schools: "Building2",
  Departments: "Network",
  // Finances
  "Bursary management": "HandCoins",
  "Tuition fees": "Banknote",
  "Other fees": "ReceiptText",
  "Student payments": "Coins",
  // Users
  Students: "GraduationCap",
  Staff: "Briefcase",
  "{educators}": "Presentation",
  // Registrations
  "{period} registration": "CalendarCheck",
  "{course} registration": "BookCheck",
  "Exam registration": "PenLine",
  "Exam receipts": "FileCheck2",
  "Exam docket": "Ticket",
  // Academics
  "{programmes}": "Layers",
  "{courses}": "BookOpen",
  Exemptions: "BadgeCheck",
  "Assessments & assignments": "ClipboardList",
  // Examinations
  "Upload exam results": "Upload",
  "Result transcripts": "ScrollText",
  "Final results": "Trophy",
  "Exam register": "ListChecks",
  // Hostels
  "Hostels & rooms": "BedDouble",
  "Room allocations": "DoorOpen",
  // Reports
  "Academic reports": "FileText",
  "Admitted students": "UserCheck",
  "{period} registrations": "CalendarRange",
  "Finance reports": "ChartPie",
  "Bank transactions": "ArrowLeftRight",
  "Payments report": "ListOrdered",
  "Student balances": "Scale",
  "Total receivables": "CircleDollarSign",
  "Receivables analysis": "TrendingUp",
  "Audit trail": "History",
  // Administration
  "Access control": "KeyRound",
  "Platform settings": "Settings",
  "School settings": "Settings",
  "Data export & backup": "FolderOpen",

  // ---- Teacher
  "My dashboard": "LayoutDashboard",
  "My classes": "Presentation",
  "Class register": "ClipboardCheck",
  "Lesson planner": "NotebookPen",
  Assignments: "ClipboardList",
  Assessments: "FileCheck2",
  Gradebook: "BookMarked",
  "Learning resources": "Library",

  // ---- Bursar
  "Finance overview": "LayoutDashboard",
  "Fee structures": "ListTree",
  "Student accounts": "WalletCards",
  "Record payment": "HandCoins",
  Invoices: "FileText",
  Debtors: "UserX",
  Reconciliation: "GitCompare",
  "Financial reports": "ChartPie",

  // ---- Cashier
  "Cashier home": "Store",
  "Collect payment": "HandCoins",
  "Find student": "Search",
  "Print receipt": "Printer",
  "Today's transactions": "ListOrdered",
  "Cash-up": "Calculator",
  "Payment methods": "CreditCard",

  // ---- Parent
  "Family overview": "House",
  "My children": "Baby",
  Attendance: "CalendarCheck",
  "Academic progress": "TrendingUp",
  "Fee statements": "FileText",
  "School calendar": "CalendarDays",
  Messages: "MessageSquare",
  Profile: "UserRound",

  // ---- Student
  "My home": "House",
  "My timetable": "CalendarClock",
  "Results & grades": "Award",
  "School notices": "Megaphone",
  "My profile": "UserRound",
};

/** Name of the icon for a sidebar label. Returns "Circle" for labels that have none yet. */
export function iconNameFor(label: string): IconName {
  return LABEL_ICONS[label] ?? "Circle";
}

export function NavIcon({
  name,
  size = 18,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const Icon = ICONS[name];
  return <Icon size={size} strokeWidth={1.75} aria-hidden className={cn("shrink-0", className)} />;
}
