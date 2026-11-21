import { Award, BookOpen, Building2, CalendarDays, Globe, GraduationCap, Heart, Users, type LucideIcon } from "lucide-react";
import type { PortalIcon } from "@/lib/portal/icons";

const ICONS: Record<PortalIcon, LucideIcon> = {
  book: BookOpen,
  users: Users,
  calendar: CalendarDays,
  graduation: GraduationCap,
  building: Building2,
  globe: Globe,
  heart: Heart,
  award: Award,
};

export function PortalIconView({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name as PortalIcon] ?? GraduationCap;
  return <Icon aria-hidden className={className} />;
}
