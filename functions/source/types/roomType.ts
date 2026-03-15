

import type { Timestamp } from 'firebase/firestore';

export interface Amenity {
  id: string;
  labelKey: string;
  icon?: string;
  category: AmenityCategory;
}

export type AmenityCategory = 'general' | 'room' | 'bathroom' | 'food' | 'recreation' | 'business' | 'family' | 'pet' | 'accessibility' | 'transportation' | 'cleaning' | 'tech';

export type BedType = 'king' | 'queen' | 'double' | 'single' | 'sofa_bed' | 'bunk_bed';

export const bedTypes: BedType[] = ['king', 'queen', 'double', 'single', 'sofa_bed', 'bunk_bed'];

export interface BedConfiguration {
  type: BedType;
  count: number;
}

export interface RoomType {
  id: string; // Firestore document ID
  name: string; // e.g., "Standard Double", "Deluxe Suite"
  maxGuests: number; // Maximum number of guests for this room type
  baseRate?: number; // Base price per night for this room type

  description?: string; // Brief description
  propertyId: string;
  
  // Details Tab
  numberOfRoomsAvailable?: number | null;
  assignedRoomNumbers?: string[]; // List of actual room numbers/names assigned to this type

  // Amenities Tab
  selectedAmenities?: string[]; // Array of amenity labels or IDs

  // Gallery Tab
  thumbnailImageUrl?: string;
  galleryImageUrls?: string[];

  // Beds Tab
  beds?: BedConfiguration[];

  // Optional fields for more details
  sizeSqMeters?: number;

  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export const defaultAmenities: Amenity[] = [
  // General Property Amenities
  { id: 'frontDesk247', labelKey: 'frontDesk247', icon: 'Clock', category: 'general' },
  { id: 'concierge', labelKey: 'concierge', icon: 'BellRing', category: 'general' },
  { id: 'luggageStorage', labelKey: 'luggageStorage', icon: 'Briefcase', category: 'general' },
  { id: 'elevator', labelKey: 'elevator', icon: 'ArrowRightLeft', category: 'general' },
  { id: 'freeWifiProperty', labelKey: 'freeWifiProperty', icon: 'Wifi', category: 'general' },
  { id: 'businessCenter', labelKey: 'businessCenter', icon: 'Briefcase', category: 'general' },
  { id: 'meetingRooms', labelKey: 'meetingRooms', icon: 'Users', category: 'general' },
  { id: 'commonLounge', labelKey: 'commonLounge', icon: 'Home', category: 'general' },
  { id: 'giftShop', labelKey: 'giftShop', icon: 'ShoppingBag', category: 'general' },
  { id: 'atm', labelKey: 'atm', icon: 'CreditCard', category: 'general' },
  { id: 'onSiteParking', labelKey: 'onSiteParking', icon: 'Car', category: 'general' },
  { id: 'evCharging', labelKey: 'evCharging', icon: 'BatteryCharging', category: 'general' },
  { id: 'airportShuttle', labelKey: 'airportShuttle', icon: 'Plane', category: 'general' },
  { id: 'carRental', labelKey: 'carRental', icon: 'Car', category: 'general' },
  { id: 'tourDesk', labelKey: 'tourDesk', icon: 'Map', category: 'general' },
  { id: 'multilingualStaff', labelKey: 'multilingualStaff', icon: 'Languages', category: 'general' },
  { id: 'securityCameras', labelKey: 'securityCameras', icon: 'Video', category: 'general' },
  { id: 'dailyHousekeepingProperty', labelKey: 'dailyHousekeepingProperty', icon: 'WashingMachine', category: 'general' },

  // Room Amenities
  { id: 'airConditioning', labelKey: 'airConditioning', icon: 'AirVent', category: 'room' },
  { id: 'heating', labelKey: 'heating', icon: 'Thermometer', category: 'room' },
  { id: 'smartTv', labelKey: 'smartTv', icon: 'Tv2', category: 'room' },
  { id: 'freeWifiRoom', labelKey: 'freeWifiRoom', icon: 'Wifi', category: 'room' },
  { id: 'workDesk', labelKey: 'workDesk', icon: 'Briefcase', category: 'room' },
  { id: 'miniFridge', labelKey: 'miniFridge', icon: 'Refrigerator', category: 'room' },
  { id: 'coffeeMaker', labelKey: 'coffeeMaker', icon: 'Coffee', category: 'room' },
  { id: 'bottledWater', labelKey: 'bottledWater', icon: 'GlassWater', category: 'room' },
  { id: 'safeBox', labelKey: 'safeBox', icon: 'Lock', category: 'room' },
  { id: 'iron', labelKey: 'iron', icon: 'Shirt', category: 'room' },
  { id: 'wardrobe', labelKey: 'wardrobe', icon: 'PersonStanding', category: 'room' },
  { id: 'soundproofing', labelKey: 'soundproofing', icon: 'VolumeX', category: 'room' },
  { id: 'balcony', labelKey: 'balcony', icon: 'Home', category: 'room' },
  { id: 'roomService', labelKey: 'roomService', icon: 'BellRing', category: 'room' },
  { id: 'blackoutCurtains', labelKey: 'blackoutCurtains', icon: 'Moon', category: 'room' },
  
  // Bathroom Amenities
  { id: 'privateBathroom', labelKey: 'privateBathroom', icon: 'ShowerHead', category: 'bathroom' },
  { id: 'shower', labelKey: 'shower', icon: 'ShowerHead', category: 'bathroom' },
  { id: 'bathtub', labelKey: 'bathtub', icon: 'Bath', category: 'bathroom' },
  { id: 'premiumTowels', labelKey: 'premiumTowels', icon: 'WashingMachine', category: 'bathroom' },
  { id: 'hairdryer', labelKey: 'hairdryer', icon: 'Wind', category: 'bathroom' },
  { id: 'toiletries', labelKey: 'toiletries', icon: 'SprayCan', category: 'bathroom' },
  { id: 'slippers', labelKey: 'slippers', icon: 'Footprints', category: 'bathroom' },
  { id: 'bathrobes', labelKey: 'bathrobes', icon: 'Shirt', category: 'bathroom' },
  { id: 'hotWater247', labelKey: 'hotWater247', icon: 'Thermometer', category: 'bathroom' },

  // Food & Beverage
  { id: 'onSiteRestaurant', labelKey: 'onSiteRestaurant', icon: 'Utensils', category: 'food' },
  { id: 'breakfastBuffet', labelKey: 'breakfastBuffet', icon: 'Croissant', category: 'food' },
  { id: 'roomServiceDining', labelKey: 'roomServiceDining', icon: 'BellRing', category: 'food' },
  { id: 'barLounge', labelKey: 'barLounge', icon: 'Martini', category: 'food' },
  { id: 'cafe', labelKey: 'cafe', icon: 'Coffee', category: 'food' },
  { id: 'poolBar', labelKey: 'poolBar', icon: 'Waves', category: 'food' },
  { id: 'miniMarket', labelKey: 'miniMarket', icon: 'ShoppingBasket', category: 'food' },
  { id: 'specialDietOptions', labelKey: 'specialDietOptions', icon: 'Leaf', category: 'food' },

  // Recreation & Activities
  { id: 'swimmingPool', labelKey: 'swimmingPool', icon: 'Waves', category: 'recreation' },
  { id: 'fitnessCenter', labelKey: 'fitnessCenter', icon: 'Dumbbell', category: 'recreation' },
  { id: 'spa', labelKey: 'spa', icon: 'Sparkles', category: 'recreation' },
  { id: 'sauna', labelKey: 'sauna', icon: 'Thermometer', category: 'recreation' },
  { id: 'hotTub', labelKey: 'hotTub', icon: 'Bath', category: 'recreation' },
  { id: 'fitnessClasses', labelKey: 'fitnessClasses', icon: 'Users', category: 'recreation' },
  { id: 'gameRoom', labelKey: 'gameRoom', icon: 'Gamepad2', category: 'recreation' },
  { id: 'tennisCourt', labelKey: 'tennisCourt', icon: 'Circle', category: 'recreation' },
  { id: 'playground', labelKey: 'playground', icon: 'Play', category: 'recreation' },
  { id: 'beachAccess', labelKey: 'beachAccess', icon: 'Waves', category: 'recreation' },
  { id: 'waterSports', labelKey: 'waterSports', icon: 'Sailboat', category: 'recreation' },
  { id: 'gardenArea', labelKey: 'gardenArea', icon: 'Flower2', category: 'recreation' },
  { id: 'roofTerrace', labelKey: 'roofTerrace', icon: 'Building', category: 'recreation' },
  
  // Business & Work Amenities
  { id: 'coWorkingSpace', labelKey: 'coWorkingSpace', icon: 'Briefcase', category: 'business' },
  { id: 'conferenceRooms', labelKey: 'conferenceRooms', icon: 'Users', category: 'business' },
  { id: 'projectorAV', labelKey: 'projectorAV', icon: 'Presentation', category: 'business' },
  { id: 'printingScanning', labelKey: 'printingScanning', icon: 'Printer', category: 'business' },

  // Family-Friendly Amenities
  { id: 'familyRooms', labelKey: 'familyRooms', icon: 'Users', category: 'family' },
  { id: 'connectingRooms', labelKey: 'connectingRooms', icon: 'ArrowRightLeft', category: 'family' },
  { id: 'babysitting', labelKey: 'babysitting', icon: 'Baby', category: 'family' },
  { id: 'highChairs', labelKey: 'highChairs', icon: 'PersonStanding', category: 'family' },
  { id: 'kidsClub', labelKey: 'kidsClub', icon: 'Play', category: 'family' },
  { id: 'kidsPool', labelKey: 'kidsPool', icon: 'Waves', category: 'family' },
  { id: 'babyCots', labelKey: 'babyCots', icon: 'Baby', category: 'family' },

  // Pet-Friendly Amenities
  { id: 'petFriendly', labelKey: 'petFriendly', icon: 'Dog', category: 'pet' },
  { id: 'petBowls', labelKey: 'petBowls', icon: 'GlassWater', category: 'pet' },
  { id: 'petBed', labelKey: 'petBed', icon: 'BedDouble', category: 'pet' },
  { id: 'petWalkingArea', labelKey: 'petWalkingArea', icon: 'Footprints', category: 'pet' },

  // Accessibility Amenities
  { id: 'wheelchairAccessible', labelKey: 'wheelchairAccessible', icon: 'Accessibility', category: 'accessibility' },
  { id: 'accessibleBathroom', labelKey: 'accessibleBathroom', icon: 'Bath', category: 'accessibility' },
  { id: 'grabBars', labelKey: 'grabBars', icon: 'Grip', category: 'accessibility' },
  { id: 'elevatorAccess', labelKey: 'elevatorAccess', icon: 'ArrowRightLeft', category: 'accessibility' },
  { id: 'ramps', labelKey: 'ramps', icon: 'Accessibility', category: 'accessibility' },
  { id: 'brailleSignage', labelKey: 'brailleSignage', icon: 'HelpingHand', category: 'accessibility' },

  // Transportation Amenities
  { id: 'airportShuttleTrans', labelKey: 'airportShuttleTrans', icon: 'Plane', category: 'transportation' },
  { id: 'cityShuttle', labelKey: 'cityShuttle', icon: 'Bus', category: 'transportation' },
  { id: 'carRentalTrans', labelKey: 'carRentalTrans', icon: 'Car', category: 'transportation' },
  { id: 'bicycleRental', labelKey: 'bicycleRental', icon: 'Bike', category: 'transportation' },
  { id: 'valetParking', labelKey: 'valetParking', icon: 'Car', category: 'transportation' },
  { id: 'secureParking', labelKey: 'secureParking', icon: 'Lock', category: 'transportation' },

  // Cleaning & Laundry
  { id: 'dailyHousekeeping', labelKey: 'dailyHousekeeping', icon: 'WashingMachine', category: 'cleaning' },
  { id: 'laundryService', labelKey: 'laundryService', icon: 'Shirt', category: 'cleaning' },
  { id: 'dryCleaning', labelKey: 'dryCleaning', icon: 'Shirt', category: 'cleaning' },
  { id: 'selfServiceLaundry', labelKey: 'selfServiceLaundry', icon: 'WashingMachine', category: 'cleaning' },

  // Technology & Smart Hotel Features
  { id: 'smartLocks', labelKey: 'smartLocks', icon: 'KeyRound', category: 'tech' },
  { id: 'mobileCheckIn', labelKey: 'mobileCheckIn', icon: 'Smartphone', category: 'tech' },
  { id: 'inRoomTablets', labelKey: 'inRoomTablets', icon: 'Tablet', category: 'tech' },
  { id: 'usbChargingPorts', labelKey: 'usbChargingPorts', icon: 'Usb', category: 'tech' },
  { id: 'highSpeedFiber', labelKey: 'highSpeedFiber', icon: 'Wifi', category: 'tech' },
];

export const amenityCategories: { key: AmenityCategory; labelKey: string }[] = [
  { key: 'general', labelKey: 'general' },
  { key: 'room', labelKey: 'room' },
  { key: 'bathroom', labelKey: 'bathroom' },
  { key: 'food', labelKey: 'food' },
  { key: 'recreation', labelKey: 'recreation' },
  { key: 'business', labelKey: 'business' },
  { key: 'family', labelKey: 'family' },
  { key: 'pet', labelKey: 'pet' },
  { key: 'accessibility', labelKey: 'accessibility' },
  { key: 'transportation', labelKey: 'transportation' },
  { key: 'cleaning', labelKey: 'cleaning' },
  { key: 'tech', labelKey: 'tech' },
];
    
