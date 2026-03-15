

export type StaffRole =
  | "admin"
  | "manager"
  | "frontDesk"
  | "housekeeping"
  | "maintenance"
  | "staff"; // Generic staff role

export const staffRoles: StaffRole[] = ["admin", "manager", "frontDesk", "housekeeping", "maintenance", "staff"];

// Standardized permission keys to match Firestore rules
export type AppModuleKey =
  | 'rooms'
  | 'reservations'
  | 'ratePlans'
  | 'guests'
  | 'finance'       // Corresponds to "Payments & Invoices"
  | 'availability'  // Corresponds to "Calendar & Availability"
  | 'reports'       // Corresponds to "Revenue"
  | 'settings'      // Corresponds to "Property Settings" part of Settings
  | 'staffManagement' // Corresponds to "Staff" page
  | 'housekeeping' // New key for Housekeeping section
  | 'extras'      // New key for Extras section
  | 'teamWorkspace'; // Consolidated permission for tasks and messages

export const appModules: { key: AppModuleKey; labelKey: string }[] = [
  { key: 'rooms', labelKey: 'permissions.rooms' },
  { key: 'reservations', labelKey: 'permissions.reservations' },
  { key: 'ratePlans', labelKey: 'permissions.rate_plans' },
  { key: 'guests', labelKey: 'permissions.guests' },
  { key: 'finance', labelKey: 'permissions.finance' },
  { key: 'availability', labelKey: 'permissions.availability' },
  { key: 'housekeeping', labelKey: 'permissions.housekeeping' },
  { key: 'extras', labelKey: 'permissions.extras' },
  { key: 'reports', labelKey: 'permissions.reports' },
  { key: 'settings', labelKey: 'permissions.settings' },
  { key: 'staffManagement', labelKey: 'permissions.staff_management' },
  { key: 'teamWorkspace', labelKey: 'permissions.team_workspace' },
];

export type Permissions = Record<AppModuleKey, boolean>;

export type StaffStatus = "Actif" | "Résilié";


export interface StaffMember {
  email: string;
  permissions(permissions: any): unknown;
  id: string; // Firestore document ID
  fullName: string;
  cin?: string;
  cnss?: string;
  address?: string;
  sex?: 'male' | 'female';
  phone?: string;
  role: string; // Position/Function
  department?: string; // New field for department
  contractType?: 'CDI' | 'CDD' | 'Journalier' | 'Stage';
  hireDate?: string; // Stored as ISO string "yyyy-MM-dd"
  status: StaffStatus;
  salary?: number;
  paymentMethod?: 'Espèces' | 'Virement';
  notes?: string;
  
  propertyId: string;
  
  createdAt?: any; // Firestore Timestamp
  updatedAt?: any; // Firestore Timestamp
}

export const defaultPermissions: Permissions = {
  rooms: false,
  reservations: false,
  ratePlans: false,
  guests: false,
  finance: false,
  availability: false,
  reports: false,
  settings: false,
  staffManagement: false,
  housekeeping: false,
  extras: false,
  teamWorkspace: false,
};

export const staffDepartments = {
    'direction_administration': {
        labelKey: 'departments.direction_administration',
        positions: ['general_manager', 'assistant_manager', 'admin_finance_manager', 'head_receptionist', 'booking_agent', 'cashier', 'hr_manager']
    },
    'entretien_menage': {
        labelKey: 'departments.entretien_menage',
        positions: ['head_housekeeper', 'chambermaid_man', 'cleaning_agent', 'laundry_staff', 'maintenance_technician']
    },
    'restauration_cuisine': {
        labelKey: 'departments.restauration_cuisine',
        positions: ['head_chef', 'cook', 'assistant_cook', 'waiter_waitress', 'head_waiter', 'dishwasher']
    },
    'accueil_service_client': {
        labelKey: 'departments.accueil_service_client',
        positions: ['receptionist', 'bellhop_porter', 'concierge', 'reception_reservations_manager', 'night_auditor']
    },
    'espaces_exterieurs_maintenance': {
        labelKey: 'departments.espaces_exterieurs_maintenance',
        positions: ['gardener_grounds_agent', 'technician_electrician_plumber', 'security_guard']
    },
    'commercial_communication': {
        labelKey: 'departments.commercial_communication',
        positions: ['sales_marketing_manager', 'community_manager', 'online_sales_reservations_agent', 'photographer_content_creator']
    },
    'bien_etre_loisirs': {
        labelKey: 'departments.bien_etre_loisirs',
        positions: ['masseur_masseuse', 'sports_coach_activity_leader', 'beautician_spa_manager']
    }
};

export type StaffDepartmentKey = keyof typeof staffDepartments;
