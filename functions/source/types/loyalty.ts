
import type { Timestamp } from 'firebase/firestore';

export interface LoyaltyTier {
  name: string;
  minPoints: number;
  colorClass: string; // Tailwind CSS class for badge color
}

export interface LoyaltyHistoryEntry {
    id: string;
    date: Timestamp;
    change: number; // Positive for earned, negative for redeemed/deducted
    reason: string; // e.g., "Reservation Stay: RES-123", "Manual Adjustment by Staff", "Redemption on Invoice: INV-456"
    staffName?: string; // Name of staff who made manual adjustment
    
}

export const defaultLoyaltyTiers: LoyaltyTier[] = [
  { name: 'Bronze', minPoints: 0, colorClass: 'bg-green-100 text-green-800' },
  { name: 'Silver', minPoints: 5, colorClass: 'bg-blue-200 text-blue-800' },
  { name: 'Gold', minPoints: 15, colorClass: 'bg-yellow-200 text-yellow-800' },
  { name: 'Platinum', minPoints: 30, colorClass: 'bg-amber-300 text-amber-800' },
  { name: 'Diamond', minPoints: 60, colorClass: 'bg-violet-300 text-violet-800' },
];

export const getLoyaltyTier = (points: number, tiers: LoyaltyTier[] = defaultLoyaltyTiers): LoyaltyTier => {
  let currentTier: LoyaltyTier = tiers[0] || defaultLoyaltyTiers[0];
  const sortedTiers = [...tiers].sort((a, b) => a.minPoints - b.minPoints);

  for (const tier of sortedTiers) {
    if (points >= tier.minPoints) {
      currentTier = tier;
    } else {
      break; 
    }
  }
  return currentTier;
};
