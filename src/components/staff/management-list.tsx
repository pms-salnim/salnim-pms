
"use client";

import React from 'react';
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, Power, FileText } from "lucide-react"; 
import { Icons } from "@/components/icons";
import type { StaffMember, StaffStatus } from '@/types/staff';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface ManagementListProps {
  staffMembers: StaffMember[];
  onEditStaff: (staff: StaffMember) => void;
  onToggleStatus: (staffId: string, currentStatus: StaffStatus) => void;
  onDeleteStaff: (staff: StaffMember) => void;
  onGenerateCertificate: (staff: StaffMember) => void;
  onGenerateWorkCertificate: (staff: StaffMember) => void;
  onGenerateEndContractCertificate: (staff: StaffMember) => void;
  onGeneratePayslip: (staff: StaffMember) => void;
  onGenerateInternshipCertificate: (staff: StaffMember) => void; // New prop
  canManage?: boolean;
}

export default function ManagementList({
  staffMembers,
  onEditStaff,
  onToggleStatus,
  onDeleteStaff,
  onGenerateCertificate,
  onGenerateWorkCertificate,
  onGenerateEndContractCertificate,
  onGeneratePayslip,
  onGenerateInternshipCertificate, // New prop
  canManage,
}: ManagementListProps) {
  const { property } = useAuth();
  const { t } = useTranslation('pages/staff/management');
  const currencySymbol = property?.currency || '$';

  const getStatusClass = (status: StaffStatus) => {
    switch (status) {
      case 'Actif':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'Résilié':
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
            <TableHead>{t('list.headers.role')}</TableHead>
            <TableHead>{t('list.headers.cin')}</TableHead>
            <TableHead>{t('list.headers.hire_date')}</TableHead>
            <TableHead className="text-right">{t('list.headers.salary')}</TableHead>
            <TableHead>{t('list.headers.status')}</TableHead>
            <TableHead className="text-right">{t('list.headers.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {staffMembers.map((staff) => (
            <TableRow key={staff.id}>
              <TableCell className="font-medium">{staff.fullName}</TableCell>
              <TableCell className="capitalize">{t(`positions.${staff.role}`)}</TableCell>
              <TableCell>{staff.cin || 'N/A'}</TableCell>
              <TableCell>
                {staff.hireDate ? format(new Date(staff.hireDate), 'PP') : 'N/A'}
              </TableCell>
              <TableCell className="text-right">
                {staff.salary ? `${currencySymbol}${staff.salary.toFixed(2)}` : 'N/A'}
              </TableCell>
              <TableCell>
                 <Badge variant={"outline"} className={cn("capitalize", getStatusClass(staff.status))}>
                   {t(`statuses.${staff.status.toLowerCase()}`)}
                </Badge>
              </TableCell>
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
                      <DropdownMenuItem onClick={() => onEditStaff(staff)}>
                        <Edit className="mr-2 h-4 w-4" />
                        <span>{t('list.actions_menu.edit')}</span>
                      </DropdownMenuItem>
                       <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <FileText className="mr-2 h-4 w-4" />
                          <span>{t('list.actions_menu.documents')}</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem onClick={() => onGenerateCertificate(staff)}>
                               {t('list.actions_menu.certificate')}
                            </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => onGenerateWorkCertificate(staff)}>
                              {t('list.actions_menu.work_certificate')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onGenerateEndContractCertificate(staff)}>
                              {t('list.actions_menu.end_contract_certificate')}
                            </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => onGeneratePayslip(staff)}>
                              {t('list.actions_menu.payslip')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onGenerateInternshipCertificate(staff)}>
                              {t('list.actions_menu.internship_certificate')}
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                      </DropdownMenuSub>
                      <DropdownMenuItem onClick={() => onToggleStatus(staff.id, staff.status)}>
                        <Power className="mr-2 h-4 w-4" />
                        <span>{staff.status === 'Actif' ? t('list.actions_menu.deactivate') : t('list.actions_menu.activate')}</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive hover:!text-destructive-foreground focus:!text-destructive-foreground"
                        onClick={() => onDeleteStaff(staff)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>{t('list.actions_menu.delete')}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
          ))}
          {staffMembers.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center">
                {t('list.no_staff_message')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
