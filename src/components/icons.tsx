
"use client";

// This is a test comment to trigger a rebuild
import React from 'react'; // Added for custom SVG component
import {
  LayoutDashboard,
  Building2,
  Bell,
  LogOut,
  ChevronDown,
  Menu,
  Loader2,
  PanelLeft,
  Settings,
  Search,
  Moon, 
  Sun,
  Home,
  Users, // For "Guests" and general user icon (original)
  BedDouble, // For "Rooms"
  LogIn, // For "Check-in Guest" quick action
  CalendarDays, // For "View Calendar" quick action & "Calendar & Availability"
  History, // Example, might not be used
  CalendarCheck, // For "Bookings/Reservations" & "Bookings" metric
  DollarSign, // For "Total Revenue" metric & "Rate Plans"
  UsersRound, // For "Staff" & "Manage Staff" quick action
  CreditCard, // For "Payments & Invoices"
  Filter, // For filter controls
  Check, // For checkmarks/success indicators
  Edit2, // For edit actions
  Trash2, // For delete actions
  Copy, // For duplicate actions
  Eye, // For view actions
  PieChart, // For chart placeholders
  ListFilter, // For filter controls
  FilePlus2, // For "New Booking" quick action
  PlusCircle, // For "Add" type actions
  Clock, // For pending or time related
  Hourglass, // For pending or time sensitive
  CheckCircle2, // For "Completed" or success
  XCircle, // For "Canceled" or failure
  HelpCircle, // For unknown or help
  Tag, // For guest tags
  Cake, // For birthdate
  MapPin, // For address
  Star, // For VIP tag
  Repeat, // For repeat guest tag
  StickyNote, // For notes tag
  TrendingUp, // For "Revenue" nav & "Occupancy Rate" metric. Was missing from import but used in config.
  Power, // For activate/deactivate actions
  KeyRound, // For password related actions
  Download, // For Export button
  BarChart2, // For charts
  LineChart, // For charts
  Mail, // For resend receipt/email actions
  AlertCircle, // For Overdue status
  UploadCloud, // For image uploads
  Image as ImageIcon, // For gallery/image placeholders
  X, // For close/remove image
  Phone, // Added Phone icon
  User as UserIcon, // Explicitly alias User for clarity if needed (e.g., for single guest icon)
  ChevronRight, // Added ChevronRight
  ChevronLeft,
  Minus,
  Package, // Added Package icon
  ShieldCheck, // Added for security badges
  BookOpenCheck, // For Booking Page Settings
  Inbox, // Added Inbox icon
  Archive, // Added Archive icon
  MessageSquare, // Added MessageSquare for WhatsApp
  Bot, // Added Bot for Chatbot
  Code, // Added Code icon
  MessageCircle, // Added MessageCircle for Auto-Responses
  Paperclip, // Added for attachments
  Palette, // Exported Palette icon
  FileText, // Exported FileText icon
  Globe,
  Undo2, // For refunds
  RefreshCw, // For refresh actions
  Monitor, // For desktop preview
  Layout, // For visual editor
  Type, // For text/rich text editor
  MousePointer2, // For button/pointer tool
  Bold, // For bold formatting
  Italic, // For italic formatting
  Underline, // For underline formatting
  Strikethrough, // For strikethrough formatting
  AlignLeft, // For left alignment
  AlignCenter, // For center alignment
  AlignRight, // For right alignment
  List, // For unordered list
  ListOrdered, // For ordered list
  Indent, // For indent
  Outdent, // For outdent
  Link2, // For link insertion
  Redo2, // For redo
  Eraser, // For clear formatting
  Highlighter, // For highlight/background color
  Heading1, // For H1
  Heading2, // For H2
  Heading3, // For H3
  // Amenity Icons
  Wifi,
  AirVent,
  Thermometer,
  Tv2,
  GlassWater,
  Lock,
  Wind,
  Shirt,
  Coffee,
  Briefcase,
  Waves,
  Dumbbell,
  Sparkles,
  Croissant,
  Dog,
  BellRing,
  SprayCan,
  WashingMachine,
  Car,
  CigaretteOff,
  Accessibility,
  Mountain,
  Building,
  Utensils,
  Flame,
  Bath,
  ArrowRightLeft,
  ArrowRight,
  ShoppingBag,
  BatteryCharging,
  Plane,
  Map,
  Languages,
  Video,
  Refrigerator,
  PersonStanding,
  VolumeX,
  ShowerHead,
  Footprints,
  Martini,
  ShoppingBasket,
  Leaf,
  Gamepad2,
  Circle,
  Play,
  Sailboat,
  Flower2,
  Presentation,
  Printer,
  Baby,
  Grip,
  HelpingHand,
  Bus,
  Bike,
  Smartphone,
  Tablet,
  Usb,
  Square,
  MoreVertical, // For three-dots menu
  AlertTriangle, // For delete confirmation
  Layers, // For type filter
  Sliders, // For category filter
  Activity, // For status filter
  ArrowUpDown, // For sort filter
  Facebook, // For social media
  Instagram, // For social media
  Twitter, // For social media
  Linkedin, // For social media
  ZoomIn, // For zoom in
  ZoomOut, // For zoom out
  Maximize2, // For reset zoom
  GripVertical, // For draggable items
  Save, // For save actions
  type LucideIcon,
} from 'lucide-react';

import { siX, siTripadvisor } from 'simple-icons';

// Wrapper components for simple-icons
const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="currentColor"
    {...props}
    dangerouslySetInnerHTML={{ __html: siX.svg }}
  />
);

const TripadvisorIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="currentColor"
    {...props}
    dangerouslySetInnerHTML={{ __html: siTripadvisor.svg }}
  />
);

// Custom SVG component provided by the user
const UsersCustomSvg = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <path d="M16 3.128a4 4 0 0 1 0 7.744" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <circle cx="9" cy="7" r="4" />
  </svg>
);

export type Icon = LucideIcon | React.FC<React.SVGProps<SVGSVGElement>>; // Updated to include custom SVG type

export const Icons = {
  Logo: LayoutDashboard, // Main logo can be simple text or a more specific brand icon later
  Dashboard: LayoutDashboard,
  Properties: Building2, // Can be used for "Properties" if a dedicated properties page is made
  Notification: Bell,
  LogOut: LogOut,
  DropdownArrow: ChevronDown,
  Menu: Menu, // For mobile menu toggle if needed outside sidebar trigger
  Spinner: Loader2,
  SidebarToggle: PanelLeft, // Sidebar trigger icon
  Settings: Settings,
  Search: Search,
  Moon: Moon, // For theme toggle
  Sun: Sun, // For theme toggle
  Home: Home, // General home icon
  User: UserIcon, // Generic user icon (single person icon from lucide)
  Users: Users, // Group of users icon from lucide
  UsersCustom: UsersCustomSvg, // Custom icon for "Guests"
  BedDouble: BedDouble, // For "Rooms" nav & "Available Rooms" metric
  LogIn: LogIn, // For quick action "Check-in Guest" & "In-House" status
  CalendarDays: CalendarDays, // For "Calendar & Availability" nav & "View Calendar" quick action
  Calendar: CalendarDays, // Alias for CalendarDays
  History: History, // Example, might remove if not used
  CalendarCheck: CalendarCheck, // For "Bookings/Reservations" & "Bookings" metric
  DollarSign: DollarSign, // For "Total Revenue" metric & "Rate Plans"
  UsersRound: UsersRound, // For "Staff" nav & "Manage Staff" quick action
  TrendingUp: TrendingUp, // For "Revenue" nav & "Occupancy Rate" metric
  CreditCard: CreditCard, // For "Payments & Invoices" nav
  Filter: Filter, // For filter controls
  Edit: Edit2, // For edit actions
  Trash: Trash2, // For delete actions
  Copy: Copy, // For duplicate actions
  Eye: Eye, // For view actions
  PieChart: PieChart, // For chart placeholders
  BarChart: BarChart2, // Added BarChart2 as BarChart
  LineChart: LineChart, // Added LineChart
  ListFilter: ListFilter,
  FilePlus2: FilePlus2, // For "New Booking" quick action
  PlusCircle: PlusCircle,
  Clock: Clock,
  Hourglass: Hourglass,
  CheckCircle2: CheckCircle2,
  Check: Check, // For checkmarks/success indicators
  XCircle: XCircle,
  HelpCircle: HelpCircle,
  Tag: Tag,
  Cake: Cake,
  MapPin: MapPin,
  Star: Star,
  Repeat: Repeat,
  StickyNote: StickyNote,
  Power: Power,
  KeyRound: KeyRound,
  Download: Download,
  Mail: Mail, // Added for email actions
  AlertCircle: AlertCircle, // Added for overdue/alert status
  AlertTriangle: AlertTriangle, // For delete confirmation
  MoreVertical: MoreVertical, // For three-dots menu
  UploadCloud: UploadCloud,
  ImageIcon: ImageIcon,
  X: X,
  Close: X,
  Phone: Phone, // Added Phone icon
  ChevronRight: ChevronRight, // Exported ChevronRight
  ChevronLeft: ChevronLeft, // Added ChevronLeft for calendar
  Minus: Minus,
  Package: Package, // Added Package icon
  ShieldCheck: ShieldCheck, // Added for security badges
  BookOpenCheck: BookOpenCheck, // For Booking Page Settings
  Inbox: Inbox, // Added Inbox icon
  Archive: Archive,
  MessageSquare: MessageSquare,
  Bot: Bot,
  Code: Code, // Exported Code icon
  MessageCircle: MessageCircle,
  Paperclip: Paperclip,
  Palette: Palette, // Exported Palette icon
  FileText: FileText, // Exported FileText icon
  Globe: Globe,
  Undo2: Undo2, // For refunds
  RefreshCw: RefreshCw, // For refresh actions
  Monitor: Monitor, // For desktop preview
  Layout: Layout, // For visual editor mode
  Type: Type, // For text/rich text editor mode
  MousePointer2: MousePointer2, // For button/pointer tool in visual editor
  Bold: Bold, // For bold formatting
  Italic: Italic, // For italic formatting
  Underline: Underline, // For underline formatting
  Strikethrough: Strikethrough, // For strikethrough formatting
  AlignLeft: AlignLeft, // For left alignment
  AlignCenter: AlignCenter, // For center alignment
  AlignRight: AlignRight, // For right alignment
  List: List, // For unordered list
  ListOrdered: ListOrdered, // For ordered list
  Indent: Indent, // For indent
  Outdent: Outdent, // For outdent
  Link2: Link2, // For link insertion
  Redo2: Redo2, // For redo formatting action
  Eraser: Eraser, // For clear formatting
  Highlighter: Highlighter, // For highlight/background color
  Heading1: Heading1, // For H1 heading
  Heading2: Heading2, // For H2 heading
  Heading3: Heading3, // For H3 heading
  // Amenity Icons
  Wifi,
  AirVent,
  Thermometer,
  Tv2,
  GlassWater,
  Lock,
  Wind,
  Shirt,
  Coffee,
  Briefcase,
  Waves,
  Dumbbell,
  Sparkles,
  Croissant,
  Dog,
  BellRing,
  SprayCan,
  WashingMachine,
  Car,
  CigaretteOff,
  Accessibility,
  Mountain,
  Building,
  Utensils,
  Flame,
  Bath,
  ArrowRightLeft,
  ArrowRight,
  ShoppingBag,
  BatteryCharging,
  Plane,
  Map,
  Languages,
  Video,
  Refrigerator,
  PersonStanding,
  VolumeX,
  ShowerHead,
  Footprints,
  Martini,
  ShoppingBasket,
  Leaf,
  Gamepad2,
  Circle,
  Play,
  Sailboat,
  Flower2,
  Presentation,
  Printer,
  Baby,
  Grip,
  HelpingHand,
  Bus,
  Bike,
  Smartphone,
  Tablet,
  Usb,
  Square,
  Layers, // For type filter
  Sliders, // For category filter
  Activity, // For status filter
  ArrowUpDown, // For sort filter
  Facebook, // For social media
  Instagram, // For social media
  Twitter, // For social media
  Linkedin, // For social media
  TwitterX: XIcon, // For X (formerly Twitter) social media logo from simple-icons
  Tripadvisor: TripadvisorIcon, // For TripAdvisor from simple-icons
  ZoomIn: ZoomIn,
  ZoomOut: ZoomOut,
  Maximize2: Maximize2,
  GripVertical: GripVertical, // For draggable items
  Save: Save, // For save actions
};
