"use client";

import React, { useState, useRef } from 'react';
import { Icons } from '@/components/icons';
import type { Menu } from '@/types/menu';

interface MenusListingProps {
  menus: Menu[];
  mealPlans: { id: string; name: string }[];
  onView: (menu: Menu) => void;
  onEdit: (menu: Menu) => void;
  onDuplicate: (menu: Menu) => void;
  onDelete: (menu: Menu) => void;
  onToggleStatus: (menu: Menu) => void;
  canManage: boolean;
}

export default function MenusListing({
  menus,
  mealPlans,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleStatus,
  canManage,
}: MenusListingProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const dropdownRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  const updateDropdownPosition = (menuId: string) => {
    const buttonEl = dropdownRefs.current[menuId];
    if (!buttonEl) return;

    const rect = buttonEl.getBoundingClientRect();
    setDropdownPosition({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
  };

  const toggleDropdown = (menuId: string) => {
    if (openDropdown === menuId) {
      setOpenDropdown(null);
      setDropdownPosition(null);
    } else {
      setOpenDropdown(menuId);
      updateDropdownPosition(menuId);
    }
  };

  const getMealPlanName = (mealPlanId: string) => {
    return mealPlans.find(mp => mp.id === mealPlanId)?.name || 'Unknown';
  };

  return (
    <div className="space-y-6">
      {/* Menus Grid */}
      {menus.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {menus.map(menu => (
            <div key={menu.id} className="bg-white rounded-2xl border-2 border-slate-200 hover:border-primary/30 transition-all overflow-hidden group">
              {/* Header */}
              <div className="p-6 bg-gradient-to-br from-slate-50 to-white border-b border-slate-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-900 mb-1 line-clamp-1">{menu.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                        {MEAL_TYPE_LABELS[menu.mealType]}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        menu.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {menu.status}
                      </span>
                    </div>
                  </div>

                  {canManage && (
                    <div className="relative">
                      <button
                        ref={(el) => { dropdownRefs.current[menu.id] = el; }}
                        onClick={() => toggleDropdown(menu.id)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Icons.MoreVertical className="w-5 h-5 text-slate-600" />
                      </button>

                      {openDropdown === menu.id && dropdownPosition && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setOpenDropdown(null)}
                          />
                          <div
                            className="fixed z-50 bg-white rounded-xl shadow-xl border border-slate-200 py-2 min-w-[180px]"
                            style={{ top: dropdownPosition.top, left: dropdownPosition.left - 140 }}
                          >
                            <button
                              onClick={() => { onView(menu); setOpenDropdown(null); }}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                            >
                              <Icons.Eye className="w-4 h-4" />
                              View Menu
                            </button>
                            <button
                              onClick={() => { onEdit(menu); setOpenDropdown(null); }}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                            >
                              <Icons.Edit className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => { onDuplicate(menu); setOpenDropdown(null); }}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                            >
                              <Icons.Copy className="w-4 h-4" />
                              Duplicate
                            </button>
                            <button
                              onClick={() => { onToggleStatus(menu); setOpenDropdown(null); }}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                            >
                              {menu.status === 'active' ? (
                                <>
                                  <Icons.Archive className="w-4 h-4" />
                                  Set to Draft
                                </>
                              ) : (
                                <>
                                  <Icons.CheckCircle2 className="w-4 h-4" />
                                  Activate
                                </>
                              )}
                            </button>
                            <div className="border-t border-slate-200 my-2" />
                            <button
                              onClick={() => { onDelete(menu); setOpenDropdown(null); }}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                            >
                              <Icons.Trash className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {menu.shortDescription && (
                  <p className="text-sm text-slate-600 line-clamp-2">{menu.shortDescription}</p>
                )}
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                {/* Linked Meal Plans */}
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Linked Meal Plans</div>
                  {menu.linkedMealPlans.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {menu.linkedMealPlans.slice(0, 2).map(mpId => (
                        <span key={mpId} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                          {getMealPlanName(mpId)}
                        </span>
                      ))}
                      {menu.linkedMealPlans.length > 2 && (
                        <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-medium">
                          +{menu.linkedMealPlans.length - 2} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">Not linked</span>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <div className="text-2xl font-bold text-slate-900">{menu.sections.length}</div>
                    <div className="text-xs text-slate-600">Sections</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <div className="text-2xl font-bold text-slate-900">
                      {menu.sections.reduce((sum, s) => sum + s.items.length, 0)}
                    </div>
                    <div className="text-xs text-slate-600">Items</div>
                  </div>
                </div>

                {/* Visibility */}
                <div className="flex items-center gap-3 text-xs">
                  {menu.visibleInGuestPortal && (
                    <div className="flex items-center gap-1 text-green-600">
                      <Icons.Eye className="w-3 h-3" />
                      <span>Guest Portal</span>
                    </div>
                  )}
                  {menu.visibleDuringBooking && (
                    <div className="flex items-center gap-1 text-blue-600">
                      <Icons.ShoppingBag className="w-3 h-3" />
                      <span>Booking</span>
                    </div>
                  )}
                  {menu.isSeasonal && (
                    <div className="flex items-center gap-1 text-orange-600">
                      <Icons.Calendar className="w-3 h-3" />
                      <span>Seasonal</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                <button
                  onClick={() => onView(menu)}
                  className="w-full py-2 px-4 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                >
                  <Icons.Eye className="w-4 h-4" />
                  View Menu
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center">
          <Icons.Menu className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No menus found</h3>
          <p className="text-slate-600 mb-6">Create your first menu to get started</p>
        </div>
      )}
    </div>
  );
}
