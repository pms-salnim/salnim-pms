-- Salnim PMS - PostgreSQL Schema Creation
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/[project]/sql/new

-- ============================================================================
-- CORE PROPERTY & ACCOMMODATION
-- ============================================================================

CREATE TABLE "Property" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "website" TEXT,
  "currency" TEXT DEFAULT 'USD',
  "slug" TEXT UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "Property_slug_idx" ON "Property"("slug");

-- ============================================================================

CREATE TABLE "RoomType" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "maxGuests" INTEGER NOT NULL,
  "maxChildren" INTEGER,
  "squareMeters" DOUBLE PRECISION,
  "amenities" TEXT[] DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoomType_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE
);

CREATE INDEX "RoomType_propertyId_idx" ON "RoomType"("propertyId");

-- ============================================================================

CREATE TABLE "Room" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "roomTypeId" TEXT NOT NULL,
  "roomNumber" TEXT NOT NULL,
  "floor" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'available',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Room_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE,
  CONSTRAINT "Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType" ("id") ON DELETE CASCADE,
  CONSTRAINT "Room_propertyId_roomNumber_key" UNIQUE("propertyId", "roomNumber")
);

CREATE INDEX "Room_propertyId_idx" ON "Room"("propertyId");
CREATE INDEX "Room_roomTypeId_idx" ON "Room"("roomTypeId");
CREATE INDEX "Room_status_idx" ON "Room"("status");

-- ============================================================================

CREATE TABLE "RatePlan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "basePrice" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "breakfastIncluded" BOOLEAN NOT NULL DEFAULT false,
  "cancellationPolicy" TEXT,
  "minStay" INTEGER,
  "maxStay" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RatePlan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE
);

CREATE INDEX "RatePlan_propertyId_idx" ON "RatePlan"("propertyId");
CREATE INDEX "RatePlan_isActive_idx" ON "RatePlan"("isActive");

-- ============================================================================

CREATE TABLE "RatePlanRoomType" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ratePlanId" TEXT NOT NULL,
  "roomTypeId" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "seasonalPrice" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RatePlanRoomType_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan" ("id") ON DELETE CASCADE,
  CONSTRAINT "RatePlanRoomType_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType" ("id") ON DELETE CASCADE,
  CONSTRAINT "RatePlanRoomType_ratePlanId_roomTypeId_key" UNIQUE("ratePlanId", "roomTypeId")
);

CREATE INDEX "RatePlanRoomType_ratePlanId_idx" ON "RatePlanRoomType"("ratePlanId");
CREATE INDEX "RatePlanRoomType_roomTypeId_idx" ON "RatePlanRoomType"("roomTypeId");

-- ============================================================================
-- PROMOTIONS & PACKAGES
-- ============================================================================

CREATE TABLE "Promotion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "code" TEXT NOT NULL UNIQUE,
  "discountType" TEXT NOT NULL,
  "discountValue" DOUBLE PRECISION NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "maxUses" INTEGER,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Promotion_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE
);

CREATE INDEX "Promotion_propertyId_idx" ON "Promotion"("propertyId");
CREATE INDEX "Promotion_code_idx" ON "Promotion"("code");
CREATE INDEX "Promotion_isActive_idx" ON "Promotion"("isActive");

-- ============================================================================

CREATE TABLE "Package" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price" DOUBLE PRECISION NOT NULL,
  "duration" INTEGER NOT NULL,
  "includesBreakfast" BOOLEAN NOT NULL DEFAULT false,
  "includesParking" BOOLEAN NOT NULL DEFAULT false,
  "services" TEXT[] DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Package_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE
);

CREATE INDEX "Package_propertyId_idx" ON "Package"("propertyId");

-- ============================================================================
-- SERVICES & AMENITIES
-- ============================================================================

CREATE TABLE "Service" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price" DOUBLE PRECISION NOT NULL,
  "category" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Service_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE
);

CREATE INDEX "Service_propertyId_idx" ON "Service"("propertyId");
CREATE INDEX "Service_category_idx" ON "Service"("category");

-- ============================================================================

CREATE TABLE "Menu" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Menu_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE
);

CREATE INDEX "Menu_propertyId_idx" ON "Menu"("propertyId");

-- ============================================================================

CREATE TABLE "MenuItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "menuId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu" ("id") ON DELETE CASCADE
);

CREATE INDEX "MenuItem_menuId_idx" ON "MenuItem"("menuId");

-- ============================================================================

CREATE TABLE "MealPlan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL,
  "pricePerNight" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MealPlan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE
);

CREATE INDEX "MealPlan_propertyId_idx" ON "MealPlan"("propertyId");

-- ============================================================================
-- REVIEWS & RATINGS
-- ============================================================================

CREATE TABLE "Review" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "guestId" TEXT NOT NULL,
  "reservationId" TEXT,
  "rating" INTEGER NOT NULL,
  "title" TEXT,
  "comment" TEXT,
  "cleanliness" INTEGER,
  "comfort" INTEGER,
  "service" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Review_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE
);

CREATE INDEX "Review_propertyId_idx" ON "Review"("propertyId");

-- ============================================================================
-- GUESTS & RESERVATIONS
-- ============================================================================

CREATE TABLE "Guest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "dateOfBirth" TIMESTAMP(3),
  "nationality" TEXT,
  "identificationNumber" TEXT,
  "identificationType" TEXT,
  "address" TEXT,
  "city" TEXT,
  "postalCode" TEXT,
  "country" TEXT,
  "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
  "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes" TEXT,
  "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Guest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE
);

CREATE INDEX "Guest_propertyId_idx" ON "Guest"("propertyId");
CREATE INDEX "Guest_email_idx" ON "Guest"("email");
CREATE INDEX "Guest_phone_idx" ON "Guest"("phone");
CREATE INDEX "Guest_isBlacklisted_idx" ON "Guest"("isBlacklisted");

-- ============================================================================

CREATE TABLE "Reservation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "guestId" TEXT NOT NULL,
  "ratePlanId" TEXT NOT NULL,
  "promotionId" TEXT,
  "checkInDate" TIMESTAMP(3) NOT NULL,
  "checkOutDate" TIMESTAMP(3) NOT NULL,
  "numberOfNights" INTEGER NOT NULL,
  "numberOfGuests" INTEGER NOT NULL,
  "numberOfChildren" INTEGER,
  "totalPrice" DOUBLE PRECISION NOT NULL,
  "depositAmount" DOUBLE PRECISION,
  "depositPaid" BOOLEAN NOT NULL DEFAULT false,
  "specialRequests" TEXT,
  "estimatedArrival" TIMESTAMP(3),
  "actualArrivalTime" TIMESTAMP(3),
  "source" TEXT,
  "status" TEXT NOT NULL DEFAULT 'confirmed',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Reservation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE,
  CONSTRAINT "Reservation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest" ("id") ON DELETE CASCADE,
  CONSTRAINT "Reservation_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan" ("id"),
  CONSTRAINT "Reservation_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion" ("id")
);

CREATE INDEX "Reservation_propertyId_idx" ON "Reservation"("propertyId");
CREATE INDEX "Reservation_guestId_idx" ON "Reservation"("guestId");
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");
CREATE INDEX "Reservation_checkInDate_idx" ON "Reservation"("checkInDate");
CREATE INDEX "Reservation_checkOutDate_idx" ON "Reservation"("checkOutDate");

-- ============================================================================

CREATE TABLE "ReservationRoom" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reservationId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReservationRoom_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE CASCADE,
  CONSTRAINT "ReservationRoom_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id"),
  CONSTRAINT "ReservationRoom_reservationId_roomId_key" UNIQUE("reservationId", "roomId")
);

CREATE INDEX "ReservationRoom_reservationId_idx" ON "ReservationRoom"("reservationId");
CREATE INDEX "ReservationRoom_roomId_idx" ON "ReservationRoom"("roomId");

-- ============================================================================

CREATE TABLE "ReservationService" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reservationId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "price" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReservationService_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE CASCADE,
  CONSTRAINT "ReservationService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id")
);

CREATE INDEX "ReservationService_reservationId_idx" ON "ReservationService"("reservationId");
CREATE INDEX "ReservationService_serviceId_idx" ON "ReservationService"("serviceId");

-- ============================================================================
-- FINANCIAL MANAGEMENT
-- ============================================================================

CREATE TABLE "Folio" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reservationId" TEXT NOT NULL UNIQUE,
  "propertyId" TEXT NOT NULL,
  "totalCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalPayments" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Folio_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE CASCADE
);

CREATE INDEX "Folio_reservationId_idx" ON "Folio"("reservationId");
CREATE INDEX "Folio_status_idx" ON "Folio"("status");

-- ============================================================================

CREATE TABLE "FolioEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "folioId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "entryType" TEXT NOT NULL,
  "category" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  CONSTRAINT "FolioEntry_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio" ("id") ON DELETE CASCADE
);

CREATE INDEX "FolioEntry_folioId_idx" ON "FolioEntry"("folioId");

-- ============================================================================

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "reservationId" TEXT,
  "invoiceNumber" TEXT NOT NULL UNIQUE,
  "guestId" TEXT,
  "issueDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3),
  "totalAmount" DOUBLE PRECISION NOT NULL,
  "taxAmount" DOUBLE PRECISION,
  "discountAmount" DOUBLE PRECISION,
  "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "paymentTerms" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invoice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE,
  CONSTRAINT "Invoice_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id")
);

CREATE INDEX "Invoice_propertyId_idx" ON "Invoice"("propertyId");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");

-- ============================================================================

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "reservationId" TEXT,
  "invoiceId" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
  "transactionId" TEXT UNIQUE,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE,
  CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id"),
  CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id")
);

CREATE INDEX "Payment_propertyId_idx" ON "Payment"("propertyId");
CREATE INDEX "Payment_paymentStatus_idx" ON "Payment"("paymentStatus");
CREATE INDEX "Payment_transactionId_idx" ON "Payment"("transactionId");

-- ============================================================================

CREATE TABLE "Expense" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "category" TEXT NOT NULL,
  "vendor" TEXT,
  "paymentMethod" TEXT,
  "receiptUrl" TEXT,
  "approvalStatus" TEXT NOT NULL DEFAULT 'pending',
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Expense_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE
);

CREATE INDEX "Expense_propertyId_idx" ON "Expense"("propertyId");
CREATE INDEX "Expense_category_idx" ON "Expense"("category");
CREATE INDEX "Expense_approvalStatus_idx" ON "Expense"("approvalStatus");

-- ============================================================================
-- STAFF & PERMISSIONS
-- ============================================================================

CREATE TABLE "Staff" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "phone" TEXT,
  "position" TEXT NOT NULL,
  "department" TEXT,
  "hireDate" TIMESTAMP(3) NOT NULL,
  "salary" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'active',
  "permissions" TEXT[] DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Staff_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE
);

CREATE INDEX "Staff_propertyId_idx" ON "Staff"("propertyId");
CREATE INDEX "Staff_email_idx" ON "Staff"("email");
CREATE INDEX "Staff_status_idx" ON "Staff"("status");

-- ============================================================================
-- TASKS & MANAGEMENT
-- ============================================================================

CREATE TABLE "Task" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "reservationId" TEXT,
  "assignedToId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "dueDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Task_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE,
  CONSTRAINT "Task_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id"),
  CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Staff" ("id")
);

CREATE INDEX "Task_propertyId_idx" ON "Task"("propertyId");
CREATE INDEX "Task_status_idx" ON "Task"("status");
CREATE INDEX "Task_priority_idx" ON "Task"("priority");

-- ============================================================================
-- COMMUNICATIONS
-- ============================================================================

CREATE TABLE "Conversation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "subject" TEXT,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Conversation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE
);

CREATE INDEX "Conversation_propertyId_idx" ON "Conversation"("propertyId");
CREATE INDEX "Conversation_status_idx" ON "Conversation"("status");

-- ============================================================================

CREATE TABLE "ConversationParticipant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "guestId" TEXT,
  "staffId" TEXT,
  "role" TEXT NOT NULL DEFAULT 'participant',
  CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE,
  CONSTRAINT "ConversationParticipant_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest" ("id"),
  CONSTRAINT "ConversationParticipant_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id")
);

CREATE INDEX "ConversationParticipant_conversationId_idx" ON "ConversationParticipant"("conversationId");
CREATE INDEX "ConversationParticipant_guestId_idx" ON "ConversationParticipant"("guestId");
CREATE INDEX "ConversationParticipant_staffId_idx" ON "ConversationParticipant"("staffId");

-- ============================================================================

CREATE TABLE "Message" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "senderType" TEXT NOT NULL,
  "senderId" TEXT,
  "content" TEXT NOT NULL,
  "attachments" TEXT[] DEFAULT '{}',
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE
);

CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");
CREATE INDEX "Message_senderType_idx" ON "Message"("senderType");

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "recipientType" TEXT,
  "recipientId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE
);

CREATE INDEX "Notification_propertyId_idx" ON "Notification"("propertyId");
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- ============================================================================
-- SETTINGS & CONFIGURATION
-- ============================================================================

CREATE TABLE "Preferences" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL UNIQUE,
  "language" TEXT NOT NULL DEFAULT 'en',
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
  "timeFormat" TEXT NOT NULL DEFAULT '24h',
  "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
  "smsNotifications" BOOLEAN NOT NULL DEFAULT false,
  "theme" TEXT NOT NULL DEFAULT 'light',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Preferences_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE
);

-- ============================================================================

CREATE TABLE "Integration" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "credentials" JSON NOT NULL,
  "lastSyncAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Integration_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE,
  CONSTRAINT "Integration_propertyId_provider_key" UNIQUE("propertyId", "provider")
);

CREATE INDEX "Integration_propertyId_idx" ON "Integration"("propertyId");

-- ============================================================================
-- AUDIT & LOGGING
-- ============================================================================

CREATE TABLE "ActivityLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "changes" JSON,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityLog_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE
);

CREATE INDEX "ActivityLog_propertyId_idx" ON "ActivityLog"("propertyId");
CREATE INDEX "ActivityLog_action_idx" ON "ActivityLog"("action");
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- ============================================================================

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "description" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE
);

CREATE INDEX "AuditLog_propertyId_idx" ON "AuditLog"("propertyId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
