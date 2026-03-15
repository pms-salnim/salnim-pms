"use client";

import React from 'react';
import { createPortal } from 'react-dom';
import { Icons } from '@/components/icons';
import type { Package, IncludedService } from '@/types/package';

interface PackageDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  package: Package;
  roomTypes: { id: string; name: string }[];
  services: { id: string; name: string }[];
  mealPlans: { id: string; name: string }[];
}

export default function PackageDetailsModal({
  isOpen,
  onClose,
  package: pkg,
  roomTypes,
  services,
  mealPlans,
}: PackageDetailsModalProps) {
  if (!isOpen) return null;

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'stay_package': return 'Stay Package';
      case 'experience_package': return 'Experience Package';
      case 'seasonal_offer': return 'Seasonal Offer';
      case 'custom': return 'Custom';
      default: return category;
    }
  };

  const getPricingTypeLabel = (type: string) => {
    switch (type) {
      case 'fixed_price': return 'Fixed Package Price';
      case 'discounted_bundle': return 'Discounted Bundle';
      case 'per_night_surcharge': return 'Per Night Surcharge';
      default: return type;
    }
  };

  const getPricingLogicLabel = (logic: string) => {
    switch (logic) {
      case 'per_guest': return 'Per Guest';
      case 'per_room': return 'Per Room';
      default: return logic;
    }
  };

  const getRoomTypeName = (id: string) => {
    return roomTypes.find((rt) => rt.id === id)?.name || 'Unknown';
  };

  const getServiceName = (id: string) => {
    return services.find((svc) => svc.id === id)?.name || 'Unknown';
  };

  const getMealPlanName = (id: string) => {
    return mealPlans.find((mp) => mp.id === id)?.name || 'Unknown';
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-lg bg-background shadow-xl">
        {/* Header */}
        <div className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {pkg.images && pkg.images.length > 0 ? (
                <img
                  src={pkg.images[0]}
                  alt={pkg.name}
                  className="h-16 w-16 rounded object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded bg-muted">
                  <Icons.Package className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-semibold">{pkg.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                    {getCategoryLabel(pkg.packageCategory)}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      pkg.status === 'Active'
                        ? 'bg-green-50 text-green-700'
                        : pkg.status === 'Draft'
                        ? 'bg-yellow-50 text-yellow-700'
                        : 'bg-gray-50 text-gray-700'
                    }`}
                  >
                    {pkg.status}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="rounded p-1 hover:bg-accent">
              <Icons.X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            {/* Image Gallery */}
            {pkg.images && pkg.images.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Images</h3>
                <div className="grid grid-cols-4 gap-3">
                  {pkg.images.map((img, index) => (
                    <img
                      key={index}
                      src={img}
                      alt={`${pkg.name} - ${index + 1}`}
                      className="h-32 w-full rounded object-cover"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Descriptions */}
            {(pkg.shortDescription || pkg.fullDescription) && (
              <div className="space-y-4">
                {pkg.shortDescription && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Short Description</h3>
                    <p className="text-sm text-muted-foreground">{pkg.shortDescription}</p>
                  </div>
                )}
                {pkg.fullDescription && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Full Description</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {pkg.fullDescription}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Pricing */}
            <div className="rounded-lg border p-4 bg-muted/30">
              <h3 className="text-sm font-semibold mb-3">Pricing</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Package Price</div>
                  <div className="text-2xl font-bold">${pkg.packagePrice}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Pricing Type</div>
                  <div className="text-sm font-medium">{getPricingTypeLabel(pkg.pricingType)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Pricing Logic</div>
                  <div className="text-sm font-medium">{getPricingLogicLabel(pkg.pricingLogic)}</div>
                </div>
                {pkg.discountDisplay && (
                  <div>
                    <div className="text-xs text-muted-foreground">Discount</div>
                    <div className="text-sm font-medium text-green-600">{pkg.discountDisplay}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Room Rules */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Room Rules</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Applicable Room Types</div>
                  <div className="flex flex-wrap gap-2">
                    {pkg.applicableRoomTypes.map((rtId) => (
                      <span
                        key={rtId}
                        className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                      >
                        {getRoomTypeName(rtId)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Minimum Nights</div>
                    <div className="text-sm font-medium">{pkg.minimumNights}</div>
                  </div>
                  {pkg.maximumNights && (
                    <div>
                      <div className="text-xs text-muted-foreground">Maximum Nights</div>
                      <div className="text-sm font-medium">{pkg.maximumNights}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Meal Plans */}
            {pkg.includedMealPlanId && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Meal Plan</h3>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icons.Utensils className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {getMealPlanName(pkg.includedMealPlanId)}
                      </span>
                    </div>
                    {pkg.allowMealPlanUpgrade && (
                      <span className="text-xs text-muted-foreground">Upgrade allowed</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Services */}
            {pkg.includedServices.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Included Services</h3>
                <div className="space-y-2">
                  {pkg.includedServices.map((service, index) => (
                    <div key={index} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icons.Sparkles className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {getServiceName(service.serviceId)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>Qty: {service.quantity}</span>
                          {service.mandatory && (
                            <span className="rounded-full bg-orange-50 px-2 py-1 text-orange-700">
                              Mandatory
                            </span>
                          )}
                          {!service.mandatory && (
                            <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                              Optional
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Availability */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Availability & Booking Rules</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Valid From</div>
                    <div className="text-sm font-medium">
                      {pkg.validFrom ? pkg.validFrom.toDate().toLocaleDateString() : 'Not set'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Valid To</div>
                    <div className="text-sm font-medium">
                      {pkg.validTo ? pkg.validTo.toDate().toLocaleDateString() : 'Not set'}
                    </div>
                  </div>
                </div>

                {pkg.blackoutDates && pkg.blackoutDates.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Blackout Dates</div>
                    <div className="flex flex-wrap gap-2">
                      {pkg.blackoutDates.map((date, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs text-red-700"
                        >
                          {date}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {pkg.advanceBookingDays !== undefined && pkg.advanceBookingDays > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground">Advance Booking</div>
                    <div className="text-sm font-medium">{pkg.advanceBookingDays} days required</div>
                  </div>
                )}

                {pkg.cancellationPolicy && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Cancellation Policy</div>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap rounded-lg border p-3 bg-muted/30">
                      {pkg.cancellationPolicy}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {pkg.stackableWithOffers ? (
                    <>
                      <Icons.CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-muted-foreground">
                        Can be stacked with other offers
                      </span>
                    </>
                  ) : (
                    <>
                      <Icons.X className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-muted-foreground">
                        Cannot be combined with other offers
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Visibility */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Visibility & Channels</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    {pkg.visibleOnBooking ? (
                      <Icons.CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Icons.X className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm">Booking Page</span>
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    {pkg.visibleInGuestPortal ? (
                      <Icons.CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Icons.X className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm">Guest Portal</span>
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    {pkg.autoApply ? (
                      <Icons.CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Icons.X className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm">Auto-Apply</span>
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    {pkg.featured ? (
                      <Icons.Star className="h-4 w-4 text-yellow-600 fill-yellow-600" />
                    ) : (
                      <Icons.Star className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="text-sm">Featured Package</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div className="rounded-lg bg-muted/30 p-4 text-xs text-muted-foreground">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium">Created:</span>{' '}
                  {pkg.createdAt?.toDate?.().toLocaleString() || 'N/A'}
                </div>
                {pkg.updatedAt && (
                  <div>
                    <span className="font-medium">Updated:</span>{' '}
                    {pkg.updatedAt.toDate().toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
