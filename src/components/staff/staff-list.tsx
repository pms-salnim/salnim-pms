
"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Icons } from "@/components/icons";
import type { StaffMember, StaffStatus } from "@/types/staff";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useTranslation } from "react-i18next";

interface StaffListProps {
  staffMembers: StaffMember[];
  onEditStaff: (staff: StaffMember) => void;
  onToggleStatus: (staffId: string, currentStatus: StaffStatus) => void;
  onResetPassword: (staffId: string) => void;
  onViewProfile: (staff: StaffMember) => void;
  onDeleteStaff: (staff: StaffMember) => void;
  canManage?: boolean;
  t: (key: string) => string;
}

export default function StaffList({
  staffMembers,
  onEditStaff,
  onToggleStatus,
  onResetPassword,
  onViewProfile,
  onDeleteStaff,
  canManage,
  t,
}: StaffListProps) {
  const { property } = useAuth();
  
  const getStatusClass = (status: StaffStatus) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'Active':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'on_break':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'busy':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'offline':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'Inactive':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  }

  return (
    <div className="rounded-lg border shadow-sm bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('list.headers.full_name')}</TableHead>
            <TableHead>{t('list.headers.email')}</TableHead>
            <TableHead>{t('list.headers.role')}</TableHead>
            <TableHead>{t('list.headers.status')}</TableHead>
            <TableHead>{t('list.headers.last_login')}</TableHead>
            <TableHead className="text-right">{t('list.headers.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {staffMembers.map((staff) => {
            const isOwner = property?.ownerUid === staff.id;
            const roleToDisplay = isOwner ? 'Admin' : t(`roles.${staff.role}`);

            return (
              <TableRow key={staff.id}>
                <TableCell className="font-medium">{staff.fullName}</TableCell>
                <TableCell>{staff.email}</TableCell>
                <TableCell className="capitalize">{roleToDisplay}</TableCell>
                <TableCell>
                  <Badge variant={"outline"} className={cn("capitalize", getStatusClass(staff.status))}>
                    {t(`statuses.${staff.status.toLowerCase().replace(/ /g, '_')}`)}
                  </Badge>
                </TableCell>
                <TableCell>{staff.lastLogin || "N/A"}</TableCell>
                <TableCell className="text-right">
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewProfile(staff)}>
                          <Icons.Eye className="mr-2 h-4 w-4" />
                          <span>{t('list.actions_menu.view_profile')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEditStaff(staff)}>
                          <Icons.Edit className="mr-2 h-4 w-4" />
                          <span>{t('list.actions_menu.edit_staff')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onToggleStatus(staff.id, staff.status)}>
                          <Icons.Power className="mr-2 h-4 w-4" />
                          <span>{staff.status === 'Active' ? t('list.actions_menu.toggle_status_deactivate') : t('list.actions_menu.toggle_status_activate')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onResetPassword(staff.id)}>
                          <Icons.KeyRound className="mr-2 h-4 w-4" />
                          <span>{t('list.actions_menu.reset_password')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive hover:!text-destructive-foreground focus:!text-destructive-foreground"
                          onClick={() => onDeleteStaff(staff)}
                        >
                          <Icons.Trash className="mr-2 h-4 w-4" />
                          <span>{t('list.actions_menu.delete_staff')}</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {staffMembers.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                {t('list.no_staff_message')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {staffMembers.length > 0 && (
        <div className="flex items-center justify-center space-x-2 p-4 border-t">
          <Button variant="outline" size="sm" onClick={() => alert("Previous page (Placeholder)")}>
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => alert("Next page (Placeholder)")}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
