/**
 * Ledger Service
 * 
 * Frontend service for calling Cloud Functions
 * Handles ledger operations: charges, payments, refunds, allocations, balance
 * 
 * Usage in components:
 * const ledgerService = new LedgerService();
 * await ledgerService.createCharge(propertyId, reservationId, folioId, amount, description);
 */

import { httpsCallable, HttpsCallableResult } from "firebase/functions";
import { functionsEurope } from "@/lib/firebase";
import type {
  LedgerEntry,
  AllocationRecord,
  FolioBalance,
} from "@/types/folio";

/**
 * Response from ledger operations
 */
export interface LedgerOperationResult {
  success: boolean;
  entryId?: string;
  timestamp?: string;
  error?: string;
}

/**
 * Response from balance queries
 */
export interface LedgerBalanceResult {
  success: boolean;
  folioId?: string;
  entries?: LedgerEntry[];
  summary?: {
    totalDebits: number;
    totalCredits: number;
    balance: number;
    amountOwed: number;
    creditAmount: number;
    entryCount: number;
  };
  error?: string;
}

/**
 * Response from allocation operations
 */
export interface AllocationOperationResult {
  success: boolean;
  paymentEntryId?: string;
  allocationIds?: string[];
  totalAllocated?: number;
  timestamp?: string;
  error?: string;
}

/**
 * Response from getting allocations
 */
export interface GetAllocationsResult {
  success: boolean;
  allocations?: AllocationRecord[];
  byPayment?: Record<string, AllocationRecord[]>;
  totalRecords?: number;
  error?: string;
}

/**
 * Ledger Service - Frontend wrapper for Cloud Functions
 */
export class LedgerService {
  /**
   * Create a charge entry in the ledger
   */
  async createCharge(
    propertyId: string,
    reservationId: string,
    folioId: string,
    amount: number,
    description: string,
    category?: string,
    chargeOptions?: {
      postingDate?: string;
      taxStatus?: string;
      taxRate?: number;
      referenceId?: string;
      notes?: string;
      immutable?: boolean;
    }
  ): Promise<LedgerOperationResult> {
    try {
      const createLedgerCharge = httpsCallable(functionsEurope, "createLedgerCharge");
      const result = (await createLedgerCharge({
        propertyId,
        reservationId,
        folioId,
        amount,
        description,
        category,
        chargeOptions,
      })) as HttpsCallableResult<LedgerOperationResult>;

      return result.data;
    } catch (error: any) {
      console.error("Error creating charge:", error);
      return {
        success: false,
        error: error.message || "Failed to create charge",
      };
    }
  }

  /**
   * Create a payment entry in the ledger
   */
  async createPayment(
    propertyId: string,
    reservationId: string,
    folioId: string,
    amount: number,
    paymentMethod:
      | "CASH"
      | "CARD"
      | "BANK_TRANSFER"
      | "CHEQUE"
      | "OTHER",
    reference?: string
  ): Promise<LedgerOperationResult> {
    try {
      const createLedgerPayment = httpsCallable(
        functionsEurope,
        "createLedgerPayment"
      );
      const result = (await createLedgerPayment({
        propertyId,
        reservationId,
        folioId,
        amount,
        paymentMethod,
        reference,
      })) as HttpsCallableResult<LedgerOperationResult>;

      return result.data;
    } catch (error: any) {
      console.error("Error creating payment:", error);
      return {
        success: false,
        error: error.message || "Failed to create payment",
      };
    }
  }

  /**
   * Create a refund entry in the ledger
   */
  async createRefund(
    propertyId: string,
    reservationId: string,
    folioId: string,
    originalEntryId: string,
    amount: number,
    reason?: string
  ): Promise<LedgerOperationResult> {
    try {
      const createLedgerRefund = httpsCallable(
        functionsEurope,
        "createLedgerRefund"
      );
      const result = (await createLedgerRefund({
        propertyId,
        reservationId,
        folioId,
        originalEntryId,
        amount,
        reason,
      })) as HttpsCallableResult<LedgerOperationResult>;

      return result.data;
    } catch (error: any) {
      console.error("Error creating refund:", error);
      return {
        success: false,
        error: error.message || "Failed to create refund",
      };
    }
  }

  /**
   * Allocate a payment to specific charges
   */
  async allocatePayment(
    propertyId: string,
    reservationId: string,
    folioId: string,
    paymentEntryId: string,
    allocations: Array<{ chargeId: string; amount: number }>
  ): Promise<AllocationOperationResult> {
    try {
      const allocatePaymentFunc = httpsCallable(
        functionsEurope,
        "allocatePayment"
      );
      const result = (await allocatePaymentFunc({
        propertyId,
        reservationId,
        folioId,
        paymentEntryId,
        allocations,
      })) as HttpsCallableResult<AllocationOperationResult>;

      return result.data;
    } catch (error: any) {
      console.error("Error allocating payment:", error);
      return {
        success: false,
        error: error.message || "Failed to allocate payment",
      };
    }
  }

  /**
   * Get folio balance with all entries
   */
  async getFolioBalance(
    propertyId: string,
    reservationId: string,
    folioId: string
  ): Promise<LedgerBalanceResult> {
    try {
      const getFolioBal = httpsCallable(functionsEurope, "getFolioBalance");
      const result = (await getFolioBal({
        propertyId,
        reservationId,
        folioId,
      })) as HttpsCallableResult<LedgerBalanceResult>;

      return result.data;
    } catch (error: any) {
      console.error("Error fetching folio balance:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch folio balance",
      };
    }
  }

  /**
   * Get balance summary across all folios for a reservation
   */
  async getReservationBalance(
    propertyId: string,
    reservationId: string
  ): Promise<LedgerBalanceResult> {
    try {
      const getResBal = httpsCallable(functionsEurope, "getReservationBalance");
      const result = (await getResBal({
        propertyId,
        reservationId,
      })) as HttpsCallableResult<LedgerBalanceResult>;

      return result.data;
    } catch (error: any) {
      console.error("Error fetching reservation balance:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch reservation balance",
      };
    }
  }

  /**
   * Get all allocations for a folio
   */
  async getAllocations(
    propertyId: string,
    reservationId: string,
    folioId: string
  ): Promise<GetAllocationsResult> {
    try {
      const getAllocs = httpsCallable(functionsEurope, "getAllocations");
      const result = (await getAllocs({
        propertyId,
        reservationId,
        folioId,
      })) as HttpsCallableResult<GetAllocationsResult>;

      return result.data;
    } catch (error: any) {
      console.error("Error fetching allocations:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch allocations",
      };
    }
  }

  /**
   * Get folio ledger entries
   */
  async getFolioLedger(
    propertyId: string,
    reservationId: string,
    folioId: string
  ): Promise<LedgerBalanceResult> {
    try {
      const getLedger = httpsCallable(functionsEurope, "getFolioLedger");
      const result = (await getLedger({
        propertyId,
        reservationId,
        folioId,
      })) as HttpsCallableResult<LedgerBalanceResult>;

      return result.data;
    } catch (error: any) {
      console.error("Error fetching folio ledger:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch folio ledger",
      };
    }
  }

  /**
   * Split a transaction across multiple folios
   */
  async splitTransaction(
    propertyId: string,
    reservationId: string,
    originalFolioId: string,
    originalEntryId: string,
    allocations: Array<{ folioId: string; percentage: number }>
  ): Promise<any> {
    try {
      const split = httpsCallable(functionsEurope, "splitTransaction");
      const result = (await split({
        propertyId,
        reservationId,
        originalFolioId,
        originalEntryId,
        allocations,
      })) as HttpsCallableResult<any>;

      return result.data;
    } catch (error: any) {
      console.error("Error splitting transaction:", error);
      return {
        success: false,
        error: error.message || "Failed to split transaction",
      };
    }
  }

  /**
   * Get split transaction details
   */
  async getSplitTransactionDetails(
    propertyId: string,
    reservationId: string,
    splitGroupId: string
  ): Promise<any> {
    try {
      const getDetails = httpsCallable(functionsEurope, "getSplitTransactionDetails");
      const result = (await getDetails({
        propertyId,
        reservationId,
        splitGroupId,
      })) as HttpsCallableResult<any>;

      return result.data;
    } catch (error: any) {
      console.error("Error fetching split details:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch split details",
      };
    }
  }

  /**
   * Void a transaction (create compensating entry)
   */
  async voidTransaction(
    propertyId: string,
    reservationId: string,
    folioId: string,
    entryId: string,
    voidReason: string
  ): Promise<any> {
    try {
      const voidTxn = httpsCallable(functionsEurope, "voidTransaction");
      const result = (await voidTxn({
        propertyId,
        reservationId,
        folioId,
        entryId,
        voidReason,
      })) as HttpsCallableResult<any>;

      return result.data;
    } catch (error: any) {
      console.error("Error voiding transaction:", error);
      return {
        success: false,
        error: error.message || "Failed to void transaction",
      };
    }
  }

  /**
   * Get void transaction details
   */
  async getVoidTransactionDetails(
    propertyId: string,
    reservationId: string,
    folioId: string,
    voidEntryId: string
  ): Promise<any> {
    try {
      const getVoidDetails = httpsCallable(functionsEurope, "getVoidTransactionDetails");
      const result = (await getVoidDetails({
        propertyId,
        reservationId,
        folioId,
        voidEntryId,
      })) as HttpsCallableResult<any>;

      return result.data;
    } catch (error: any) {
      console.error("Error fetching void details:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch void details",
      };
    }
  }

  /**
   * Move a transaction to a different folio
   */
  async moveTransaction(
    propertyId: string,
    reservationId: string,
    sourceFolioId: string,
    targetFolioId: string,
    entryId: string,
    moveReason: string
  ): Promise<any> {
    try {
      const moveTxn = httpsCallable(functionsEurope, "moveTransaction");
      const result = (await moveTxn({
        propertyId,
        reservationId,
        sourceFolioId,
        targetFolioId,
        entryId,
        moveReason,
      })) as HttpsCallableResult<any>;

      return result.data;
    } catch (error: any) {
      console.error("Error moving transaction:", error);
      return {
        success: false,
        error: error.message || "Failed to move transaction",
      };
    }
  }

  /**
   * Get move transaction details
   */
  async getMoveTransactionDetails(
    propertyId: string,
    reservationId: string,
    moveGroupId: string
  ): Promise<any> {
    try {
      const getMoveDetails = httpsCallable(functionsEurope, "getMoveTransactionDetails");
      const result = (await getMoveDetails({
        propertyId,
        reservationId,
        moveGroupId,
      })) as HttpsCallableResult<any>;

      return result.data;
    } catch (error: any) {
      console.error("Error fetching move details:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch move details",
      };
    }
  }

  /**
   * Generate comprehensive ledger report
   */
  async generateLedgerReport(
    propertyId: string,
    reservationId: string,
    reportType: 'settlement' | 'analytics' | 'full_export' = 'settlement',
    startDate?: string,
    endDate?: string
  ): Promise<any> {
    try {
      const genReport = httpsCallable(functionsEurope, "generateLedgerReport");
      const result = (await genReport({
        propertyId,
        reservationId,
        reportType,
        startDate,
        endDate,
      })) as HttpsCallableResult<any>;

      return result.data;
    } catch (error: any) {
      console.error("Error generating report:", error);
      return {
        success: false,
        error: error.message || "Failed to generate report",
      };
    }
  }

  /**
   * Get folio transaction history with breakdown
   */
  async getFolioTransactionHistory(
    propertyId: string,
    reservationId: string,
    folioId: string
  ): Promise<any> {
    try {
      const getHistory = httpsCallable(functionsEurope, "getFolioTransactionHistory");
      const result = (await getHistory({
        propertyId,
        reservationId,
        folioId,
      })) as HttpsCallableResult<any>;

      return result.data;
    } catch (error: any) {
      console.error("Error fetching transaction history:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch transaction history",
      };
    }
  }

  /**
   * Process payment for reservation
   * Handles charge, pre-authorize, and paid-previously payments
   * Creates ledger entries and handles payment gateway integration
   */
  async processPayment(
    propertyId: string,
    reservationId: string,
    folioIds: string[],
    amounts: number[],
    paymentMethod: 'Cash' | 'Credit Card' | 'Bank Transfer' | 'Online Payment' | 'Other',
    collectPayment: 'charge' | 'pre-authorize' | 'paid-previously',
    paymentDate: string,
    creditCardToken?: string,
    creditCardType?: string,
    creditCardLast4?: string,
    notes?: string,
    guestName?: string,
    useCurrentDate?: boolean
  ): Promise<any> {
    try {
      const processPaymentFn = httpsCallable(functionsEurope, "processPayment");
      const result = (await processPaymentFn({
        propertyId,
        reservationId,
        folioIds,
        amounts,
        paymentMethod,
        collectPayment,
        paymentDate,
        creditCardToken,
        creditCardType,
        creditCardLast4,
        notes,
        guestName,
        useCurrentDate,
      })) as HttpsCallableResult<any>;

      return result.data;
    } catch (error: any) {
      console.error("Error processing payment:", error);
      return {
        success: false,
        error: error.message || "Failed to process payment",
      };
    }
  }

  /**
   * Capture a pre-authorized payment
   */
  async capturePreAuthorizedPayment(
    propertyId: string,
    reservationId: string,
    transactionId: string
  ): Promise<any> {
    try {
      const captureFn = httpsCallable(functionsEurope, "capturePreAuthorizedPayment");
      const result = (await captureFn({
        propertyId,
        reservationId,
        transactionId,
      })) as HttpsCallableResult<any>;

      return result.data;
    } catch (error: any) {
      console.error("Error capturing pre-authorized payment:", error);
      return {
        success: false,
        error: error.message || "Failed to capture payment",
      };
    }
  }

  /**
   * Void a pre-authorized payment
   */
  async voidPreAuthorizedPayment(
    propertyId: string,
    reservationId: string,
    transactionId: string,
    reason?: string
  ): Promise<any> {
    try {
      const voidFn = httpsCallable(functionsEurope, "voidPreAuthorizedPayment");
      const result = (await voidFn({
        propertyId,
        reservationId,
        transactionId,
        reason,
      })) as HttpsCallableResult<any>;

      return result.data;
    } catch (error: any) {
      console.error("Error voiding pre-authorized payment:", error);
      return {
        success: false,
        error: error.message || "Failed to void payment",
      };
    }
  }
}

/**
 * Singleton instance for use throughout the app
 */
export const ledgerService = new LedgerService();
