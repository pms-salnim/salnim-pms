import type { AppModuleKey } from "@/types/staff";

interface NavItem {
  title: string;
  href: string;
  icon: string;
  permissionKey?: AppModuleKey;
  children?: NavItem[];
  section?: string;
}

export const siteConfig = {
  name: "Salnim Pms",
  description: "Manage your properties with ease.",
  mainNav: [
    // 🔹 DAILY OPERATIONS
    {
      title: "nav.dashboard",
      href: "/dashboard",
      icon: "Dashboard",
      section: "nav.sections.daily_operations",
    },
    {
      title: "nav.calendar",
      href: "/calendar-availability/calendar",
      icon: "CalendarDays",
      permissionKey: "availability",
      section: "nav.sections.daily_operations",
    },
    {
      title: "nav.reservations",
      href: "/reservations/all",
      icon: "CalendarCheck",
      permissionKey: "reservations",
      section: "nav.sections.daily_operations",
    },
    {
      title: "nav.groups_corporate",
      href: "/reservations/groups",
      icon: "UsersRound",
      permissionKey: "reservations",
      section: "nav.sections.daily_operations",
    },
    {
      title: "nav.crm",
      href: "/guests",
      icon: "UsersCustom",
      permissionKey: "guests",
      section: "nav.sections.daily_operations",
      children: [
        { title: "nav.children.all_guests", href: "/guests/all", icon: "Users" },
        { title: "nav.children.inbox", href: "/guests/communication", icon: "Mail" },
        { title: "nav.children.reputation_management", href: "/guests/reputation-management", icon: "MessageSquare" },
      ],
    },
    {
      title: "nav.housekeeping",
      href: "/housekeeping",
      icon: "SprayCan",
      permissionKey: "housekeeping",
      section: "nav.sections.daily_operations",
      children: [
        { title: "nav.children.operations_dashboard", href: "/housekeeping/operations-dashboard", icon: "LayoutDashboard" },
        { title: "nav.children.attendant_worksheets", href: "/housekeeping/attendant-worksheets", icon: "Clipboard" },
        { title: "nav.children.maintenance_engineering", href: "/housekeeping/maintenance-requests", icon: "Wrench" },
        { title: "nav.children.inventory_management", href: "/housekeeping/inventory-management", icon: "Box" },
        { title: "nav.children.lost_found", href: "/housekeeping/lost-and-found", icon: "Search" },
      ],
    },
    {
      title: "nav.team_workspace",
      href: "/team-workspace",
      icon: "Users",
      permissionKey: "teamWorkspace",
      section: "nav.sections.daily_operations",
      children: [
        { title: "nav.children.messages", href: "/team-workspace/messages", icon: "Mail" },
        { title: "nav.children.tasks", href: "/team-workspace/tasks", icon: "CheckCircle2" },
      ],
    },
    {
      title: "nav.staff",
      href: "/staff-users/staff",
      icon: "UsersRound",
      permissionKey: "staffManagement",
      section: "nav.sections.daily_operations",
    },
    {
      title: "nav.payments_invoices",
      href: "/payments",
      icon: "CreditCard",
      permissionKey: "finance",
      section: "nav.sections.daily_operations",
      children: [
        { title: "nav.children.dashboard", href: "/payments/dashboard", icon: "LayoutDashboard" },
        { title: "nav.children.payments", href: "/payments/list", icon: "CreditCard" },
        { title: "nav.children.invoices", href: "/payments/invoices", icon: "FilePlus2" },
        { title: "nav.children.refunds", href: "/payments/refunds", icon: "Undo2" },
      ],
    },
    {
      title: "nav.revenue_reports",
      href: "/revenue",
      icon: "TrendingUp",
      permissionKey: "reports",
      section: "nav.sections.daily_operations",
      children: [
        { title: "nav.children.overview", href: "/revenue/overview", icon: "PieChart" },
        { title: "nav.children.performance_reports", href: "/revenue/performance-reports", icon: "BarChart" },
        { title: "nav.children.revenue_log", href: "/revenue/revenue-log", icon: "DollarSign" },
        { title: "nav.children.expenses", href: "/revenue/expenses", icon: "DollarSign" },
      ],
    },
    {
      title: "nav.settings",
      href: "/settings",
      icon: "Settings",
      permissionKey: "settings",
    },
  ] as NavItem[],
};

export type SiteConfig = typeof siteConfig;
