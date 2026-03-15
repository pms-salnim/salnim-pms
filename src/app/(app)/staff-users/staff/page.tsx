
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import type { StaffMember, StaffRole, Permissions, StaffDepartmentKey, StaffStatus } from '@/types/staff';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from '@/contexts/auth-context';
import { db, app } from '@/lib/firebase';
import { getFunctions, httpsCallable } from "firebase/functions";
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import type { FirestoreUser } from '@/types/firestoreUser';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { defaultPermissions } from '@/types/staff';
import { useTranslation } from 'react-i18next';
import ManagementList from '@/components/staff/management-list';
import ManagementForm from '@/components/staff/management-form';
import SalaryCertificateModal from '@/components/staff/salary-certificate-modal';
import WorkCertificateModal from '@/components/staff/work-certificate-modal';
import EndOfContractCertificateModal from '@/components/staff/end-of-contract-certificate-modal';
import PayslipModal from '@/components/staff/payslip-modal';
import InternshipCertificateModal from '@/components/staff/internship-certificate-modal'; // New import
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const StaffManagementPage = () => {
  const { user: currentUser, isLoadingAuth, property } = useAuth();
  const { t } = useTranslation('pages/staff/management');
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserPropertyId, setCurrentUserPropertyId] = useState<string | null>(null);
  const canManageStaff = currentUser?.permissions?.staffManagement;

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [staffForCertificate, setStaffForCertificate] = useState<StaffMember | null>(null);

  const [isWorkCertificateModalOpen, setIsWorkCertificateModalOpen] = useState(false);
  const [staffForWorkCertificate, setStaffForWorkCertificate] = useState<StaffMember | null>(null);

  const [isEndContractModalOpen, setIsEndContractModalOpen] = useState(false);
  const [staffForEndContract, setStaffForEndContract] = useState<StaffMember | null>(null);

  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  const [staffForPayslip, setStaffForPayslip] = useState<StaffMember | null>(null);
  
  const [isInternshipCertificateModalOpen, setIsInternshipCertificateModalOpen] = useState(false);
  const [staffForInternshipCertificate, setStaffForInternshipCertificate] = useState<StaffMember | null>(null);
  
  const currencySymbol = property?.currency || '$';

  const stats = useMemo(() => {
    const totalEmployees = staffMembers.length;
    const totalSalaries = staffMembers.reduce((acc, member) => acc + (member.salary || 0), 0);
    return { totalEmployees, totalSalaries };
  }, [staffMembers]);

  useEffect(() => {
    if (currentUser?.propertyId) {
        setCurrentUserPropertyId(currentUser.propertyId);
    }
  }, [currentUser?.propertyId]);

  useEffect(() => {
    if (!currentUserPropertyId) {
      setStaffMembers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const staffColRef = collection(db, "staff");
    const q = query(staffColRef, where("propertyId", "==", currentUserPropertyId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedStaff = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        // This check ensures we only show non-login staff members on this page.
        if (data.permissions) {
          return null;
        }
        return {
          id: docSnap.id,
          fullName: data.fullName,
          cin: data.cin,
          cnss: data.cnss,
          address: data.address,
          sex: data.sex,
          phone: data.phone,
          role: data.role,
          department: data.department,
          contractType: data.contractType,
          hireDate: data.hireDate,
          status: data.status || 'Actif',
          salary: data.salary,
          paymentMethod: data.paymentMethod,
          notes: data.notes,
          propertyId: data.propertyId,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        } as StaffMember;
      }).filter((item): item is StaffMember => item !== null);
      setStaffMembers(fetchedStaff);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching staff:", error);
      toast({ title: "Error", description: "Could not fetch staff members.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUserPropertyId]);


  const handleAddStaff = () => {
    setEditingStaff(null);
    setIsFormModalOpen(true);
  };

  const handleEditStaff = (staff: StaffMember) => {
    setEditingStaff(staff);
    setIsFormModalOpen(true);
  };

  const handleFormClose = () => {
    setIsFormModalOpen(false);
    setEditingStaff(null);
  };
  
  const handleToggleStatusStaff = async (staffId: string, currentStatus: StaffStatus) => {
     try {
        const staffDocRef = doc(db, "staff", staffId);
        const newStatus: StaffStatus = currentStatus === 'Actif' ? 'Résilié' : 'Actif';
        await updateDoc(staffDocRef, { status: newStatus, updatedAt: serverTimestamp() });
        toast({ title: "Success", description: 'Staff member status updated to ' + newStatus + '.' });
     } catch (error) {
        toast({ title: "Error", description: "Could not update staff status.", variant: "destructive" });
     }
  };
  
  const handleOpenCertificateModal = (staff: StaffMember) => {
    setStaffForCertificate(staff);
    setIsCertificateModalOpen(true);
  }

  const handleOpenWorkCertificateModal = (staff: StaffMember) => {
    setStaffForWorkCertificate(staff);
    setIsWorkCertificateModalOpen(true);
  }
  
  const handleOpenEndContractModal = (staff: StaffMember) => {
    setStaffForEndContract(staff);
    setIsEndContractModalOpen(true);
  };

  const handleOpenPayslipModal = (staff: StaffMember) => {
    setStaffForPayslip(staff);
    setIsPayslipModalOpen(true);
  };
  
  const handleOpenInternshipCertificateModal = (staff: StaffMember) => {
    setStaffForInternshipCertificate(staff);
    setIsInternshipCertificateModalOpen(true);
  };


  const handleDeleteStaff = (staff: StaffMember) => {
    if (staff.id === currentUser?.id) {
      toast({ title: "Error", description: "You cannot delete your own account.", variant: "destructive" });
      return;
    }
    setStaffToDelete(staff);
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDeleteStaff = async () => {
    if (!staffToDelete || !canManageStaff) return;
    setIsLoading(true);
    try {
        const functions = getFunctions(app, 'europe-west1');
        const saveStaffMember = httpsCallable(functions, 'saveStaffMember');
        await deleteDoc(doc(db, 'staff', staffToDelete.id));
        toast({ title: t('toasts.success_title'), description: t('toasts.delete_success') });
    } catch (error: any) {
        toast({ title: "Deletion Failed", description: error.message || t('toasts.delete_error'), variant: "destructive" });
    } finally {
        setIsLoading(false);
        setIsDeleteDialogOpen(false);
        setStaffToDelete(null);
    }
  };

  if (isLoadingAuth || isLoading) {
    return <div className="flex h-full items-center justify-center"><Icons.Spinner className="h-8 w-8 animate-spin" /></div>;
  }
  
  if (!canManageStaff) {
     return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">{t('title')}</h1>
            <Alert variant="destructive" className="mt-4">
              <Icons.AlertCircle className="h-4 w-4" />
              <AlertTitle>Access Denied</AlertTitle>
              <AlertDescription>
                You do not have permission to manage staff. Please contact an administrator.
              </AlertDescription>
            </Alert>
        </div>
     )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-headline">
            {t('title')}
          </h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Button onClick={handleAddStaff} disabled={!canManageStaff}>
          <Icons.PlusCircle className="mr-2 h-4 w-4" /> {t('add_staff_button')}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('metric_cards.total_employees')}</CardTitle>
                <Icons.Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stats.totalEmployees}</div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('metric_cards.total_salaries')}</CardTitle>
                <Icons.DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{currencySymbol}{stats.totalSalaries.toFixed(2)}</div>
            </CardContent>
        </Card>
      </div>

      <ManagementList
        staffMembers={staffMembers}
        onEditStaff={handleEditStaff}
        onToggleStatus={handleToggleStatusStaff}
        onDeleteStaff={handleDeleteStaff}
        onGenerateCertificate={handleOpenCertificateModal}
        onGenerateWorkCertificate={handleOpenWorkCertificateModal}
        onGenerateEndContractCertificate={handleOpenEndContractModal}
        onGeneratePayslip={handleOpenPayslipModal}
        onGenerateInternshipCertificate={handleOpenInternshipCertificateModal}
        canManage={canManageStaff}
      />

      <Dialog open={isFormModalOpen} onOpenChange={setIsFormModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingStaff ? t('edit_modal.title') : t('add_modal.title')}</DialogTitle>
            <DialogDescription>
              {editingStaff ? t('edit_modal.description') : t('add_modal.description')}
            </DialogDescription>
          </DialogHeader>
          <ManagementForm
            initialData={editingStaff}
            onClose={handleFormClose}
            currentUserRole={currentUser?.role || 'staff'}
            currentUserPermissions={currentUser?.permissions || defaultPermissions}
          />
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_dialog.description', { name: staffToDelete?.fullName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setStaffToDelete(null)}>{t('delete_dialog.cancel_button')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteStaff}>{t('delete_dialog.continue_button')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {staffForCertificate && (
        <SalaryCertificateModal
          isOpen={isCertificateModalOpen}
          onClose={() => { setIsCertificateModalOpen(false); setStaffForCertificate(null); }}
          staffMember={staffForCertificate}
        />
      )}

      {staffForWorkCertificate && (
        <WorkCertificateModal
          isOpen={isWorkCertificateModalOpen}
          onClose={() => { setIsWorkCertificateModalOpen(false); setStaffForWorkCertificate(null); }}
          staffMember={staffForWorkCertificate}
        />
      )}

      {staffForEndContract && (
        <EndOfContractCertificateModal
          isOpen={isEndContractModalOpen}
          onClose={() => { setIsEndContractModalOpen(false); setStaffForEndContract(null); }}
          staffMember={staffForEndContract}
        />
      )}

      {staffForPayslip && (
        <PayslipModal
          isOpen={isPayslipModalOpen}
          onClose={() => { setIsPayslipModalOpen(false); setStaffForPayslip(null); }}
          staffMember={staffForPayslip}
        />
      )}
      
      {staffForInternshipCertificate && (
        <InternshipCertificateModal
          isOpen={isInternshipCertificateModalOpen}
          onClose={() => { setIsInternshipCertificateModalOpen(false); setStaffForInternshipCertificate(null); }}
          staffMember={staffForInternshipCertificate}
        />
      )}
    </div>
  );
};

export default StaffManagementPage;
