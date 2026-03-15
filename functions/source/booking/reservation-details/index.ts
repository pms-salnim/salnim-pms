/**
 * Reservation Details - Folio & Ledger Operations
 * 
 * Cloud Functions for:
 * - Ledger entry creation (charges, payments, refunds)
 * - Allocation tracking
 * - Balance calculations
 * - Payment processing
 */

export {
  createLedgerCharge,
  createLedgerPayment,
  createLedgerRefund,
  getFolioLedger,
} from "./ledgerOperations";

export {
  allocatePayment,
  getAllocations,
  getFolioBalance,
  getReservationBalance,
} from "./allocationOperations";

export {
  splitTransaction,
  getSplitTransactionDetails,
} from "./splitOperations";

export {
  voidTransaction,
  getVoidTransactionDetails,
} from "./voidOperations";

export {
  moveTransaction,
  getMoveTransactionDetails,
} from "./moveOperations";

export {
  generateLedgerReport,
  getFolioTransactionHistory,
} from "./reportingOperations";

export {
  processPayment,
  capturePreAuthorizedPayment,
  voidPreAuthorizedPayment,
} from "./paymentOperations";
