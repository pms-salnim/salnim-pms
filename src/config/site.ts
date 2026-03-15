
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
      href: "/calendar-availability", 
      icon: "CalendarDays", 
      permissionKey: "availability",
      section: "nav.sections.daily_operations",
      children: [
        {
          title: "nav.children.calendar_view",
          href: "/calendar-availability/calendar",
          icon: "CalendarDays"
        },
        {
          title: "nav.children.set_availability",
          href: "/calendar-availability/set-availability",
          icon: "Edit"
        },
        {
          title: "nav.children.blocked_dates",
          href: "/calendar-availability/blocked-dates",
          icon: "XCircle"
        }
      ]
    },
    {
      title: "nav.reservations",
      href: "/reservations", 
      icon: "CalendarCheck", 
      permissionKey: "reservations",
      section: "nav.sections.daily_operations",
      children: [
        {
          title: "nav.children.all_reservations",
          href: "/reservations/all",
          icon: "ListFilter"
        },
        {
          title: "nav.children.todays_activity",
          href: "/reservations/activity",
          icon: "History"
        },
        {
          title: "nav.children.cancelled_noshow",
          href: "/reservations/cancelled",
          icon: "XCircle"
        },
        {
          title: "nav.children.groups_corporate",
          href: "/reservations/groups",
          icon: "Users"
        }
      ]
    },
    {
      title: "nav.guest_relationships",
      href: "/guests", 
      icon: "UsersCustom", 
      permissionKey: "guests",
      section: "nav.sections.daily_operations",
      children: [
        { title: "nav.children.all_guests", href: "/guests/all", icon: "Users" },
        { title: "nav.children.communication_hub", href: "/guests/communication", icon: "Mail" },
        { title: "nav.children.reputation_management", href: "/guests/reputation-management", icon: "MessageSquare" },
      ]
    },
    // 🔹 ON-PROPERTY OPERATIONS
    {
      title: "nav.rooms",
      href: "/rooms",
      icon: "BedDouble", 
      permissionKey: "rooms",
      section: "nav.sections.on_property",
      children: [
        { title: "nav.children.overview", href: "/rooms/overview", icon: "PieChart" },
        { title: "nav.children.all_rooms", href: "/rooms/list", icon: "BedDouble" },
        { title: "nav.children.room_types", href: "/rooms/types", icon: "Home" },
      ]
    },
    {
      title: "nav.housekeeping",
      href: "/housekeeping",
      icon: "SprayCan",
      permissionKey: 'housekeeping',
      section: "nav.sections.on_property",
      children: [
        { title: "nav.children.operations_dashboard", href: "/housekeeping/operations-dashboard", icon: "LayoutDashboard" },
        { title: "nav.children.attendant_worksheets", href: "/housekeeping/attendant-worksheets", icon: "Clipboard" },
        { title: "nav.children.maintenance_engineering", href: "/housekeeping/maintenance-requests", icon: "Wrench" },
        { title: "nav.children.inventory_management", href: "/housekeeping/inventory-management", icon: "Box" },
        { title: "nav.children.lost_found", href: "/housekeeping/lost-and-found", icon: "Search" },
      ],
    },
    {
      title: "nav.extra",
      href: "/extra",
      icon: "PlusCircle",
      permissionKey: "extras",
      section: "nav.sections.on_property",
      children: [
        { title: "nav.children.service", href: "/extra/service", icon: "BellRing" },
        { title: "nav.children.meal_plans", href: "/extra/meal-plan", icon: "Utensils" },
        { title: "nav.children.packages", href: "/extra/packages", icon: "Package" },
      ]
    },
    // 🔹 TEAM & INTERNAL MANAGEMENT
    {
      title: "nav.team_workspace",
      href: "/team-workspace",
      icon: "Users",
      permissionKey: "teamWorkspace",
      section: "nav.sections.team_management",
      children: [
        { title: "nav.children.messages", href: "/team-workspace/messages", icon: "Mail" },
        { title: "nav.children.tasks", href: "/team-workspace/tasks", icon: "CheckCircle2" },
      ]
    },
    {
      title: "nav.staff",
      href: "/staff-users", 
      icon: "UsersRound", 
      permissionKey: "staffManagement",
      section: "nav.sections.team_management",
      children: [
        { title: "nav.children.user_management", href: "/staff-users/users", icon: "Users" },
        { title: "nav.children.staff_management", href: "/staff-users/staff", icon: "Briefcase" },
      ]
    },
    // 🔹 COMMERCIAL & FINANCIAL
    {
      title: "nav.rate_plans",
      href: "/rate-plans",
      icon: "DollarSign",
      permissionKey: "ratePlans",
      section: "nav.sections.commercial_financial",
      children: [
        { title: "nav.children.all_rate_plans", href: "/rate-plans/all", icon: "ListFilter" },
        { title: "nav.children.seasonal_pricing", href: "/rate-plans/seasonal", icon: "CalendarDays" },
        { title: "nav.children.promotions", href: "/rate-plans/promotions", icon: "Tag" },
      ]
    },
    {
      title: "nav.payments_invoices",
      href: "/payments",
      icon: "CreditCard", 
      permissionKey: "finance",
      section: "nav.sections.commercial_financial",
      children: [
        { title: "nav.children.dashboard", href: "/payments/dashboard", icon: "LayoutDashboard" },
        { title: "nav.children.payments", href: "/payments/list", icon: "CreditCard" },
        { title: "nav.children.invoices", href: "/payments/invoices", icon: "FilePlus2" },
        { title: "nav.children.refunds", href: "/payments/refunds", icon: "Undo2" },
      ]
    },
    {
      title: "nav.revenue_reports",
      href: "/revenue",
      icon: "TrendingUp", 
      permissionKey: "reports",
      section: "nav.sections.commercial_financial",
      children: [
        { title: "nav.children.overview", href: "/revenue/overview", icon: "PieChart" },
        { title: "nav.children.performance_reports", href: "/revenue/performance-reports", icon: "BarChart" },
        { title: "nav.children.revenue_log", href: "/revenue/revenue-log", icon: "DollarSign" },
        { title: "nav.children.expenses", href: "/revenue/expenses", icon: "DollarSign" },
      ]
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
