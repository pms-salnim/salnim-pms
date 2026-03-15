'use client';

import React, { useState, useEffect } from 'react';
import { PropertySettingsSubtabs } from '@/components/property-settings/property-settings-subtabs';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ChevronDown } from 'lucide-react';

const teamSubtabs = [
  { id: 'users', label: 'Users', href: '/property-settings/team/users' },
  { id: 'roles', label: 'Roles & Permissions', href: '/property-settings/team/roles-permissions' },
  { id: 'security', label: 'Security', href: '/property-settings/team/security' },
];

interface StaffMember {
  id: string;
  fullName: string;
  email: string;
  role: string;
  creditCardAccess?: boolean;
  propertyId: string;
}

export default function SecurityPage() {
  const { user: currentUser, isLoadingAuth } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [currentUserPropertyId, setCurrentUserPropertyId] = useState<string | null>(null);

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
    const staffColRef = collection(db, 'staff');
    const q = query(staffColRef, where('propertyId', '==', currentUserPropertyId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedStaff = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            fullName: data.fullName || '',
            email: data.email || '',
            role: data.role || '',
            creditCardAccess: data.creditCardAccess || false,
            propertyId: data.propertyId,
          } as StaffMember;
        });

        setStaffMembers(fetchedStaff);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching staff:', error);
        toast({ title: 'Error', description: 'Could not fetch staff members.', variant: 'destructive' });
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUserPropertyId]);

  const handleSendResetPasswordEmail = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement API call to send password reset email
      toast({ title: 'Success', description: 'Password reset email sent successfully.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Could not send reset password email.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableCreditCardViewing = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement API call to enable credit card viewing
      toast({ title: 'Success', description: 'Credit card viewing has been enabled.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Could not enable credit card viewing.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleCreditCardAccess = async (staffId: string, currentAccess: boolean) => {
    try {
      const staffDocRef = doc(db, 'staff', staffId);
      await updateDoc(staffDocRef, {
        creditCardAccess: !currentAccess,
        updatedAt: serverTimestamp(),
      });
      toast({
        title: 'Success',
        description: `Credit card access ${!currentAccess ? 'enabled' : 'disabled'}.`,
      });
    } catch (error: any) {
      console.error('Error updating credit card access:', error);
      toast({ title: 'Error', description: 'Could not update credit card access.', variant: 'destructive' });
    }
  };

  if (isLoading || isLoadingAuth) {
    return (
      <div className="flex h-full items-center justify-center">
        <Icons.Spinner className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Security</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage security settings and access logs</p>
          </div>
          <PropertySettingsSubtabs subtabs={teamSubtabs} />
        </div>
        <div className="flex justify-between items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isLoading}>
                Actions
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={handleSendResetPasswordEmail} disabled={isLoading}>
                <Icons.Mail className="mr-2 h-4 w-4" />
                Send Reset Password Email
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleEnableCreditCardViewing} disabled={isLoading}>
                <Icons.CreditCard className="mr-2 h-4 w-4" />
                Enable Credit Card Viewing
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {staffMembers.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
            <div className="text-center">
              <Icons.FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No staff members found</h3>
              <p className="text-sm text-muted-foreground mt-1">Add staff members to manage their security access</p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50/30">
                  <TableHead className="border-r border-slate-50 h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    User
                  </TableHead>
                  <TableHead className="border-r border-slate-50 h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Role
                  </TableHead>
                  <TableHead className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Credit Cards Details Access
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffMembers.map((staff) => (
                  <TableRow key={staff.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <TableCell className="border-r border-slate-50 px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{staff.fullName}</span>
                        <span className="text-xs text-muted-foreground">{staff.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="border-r border-slate-50 px-4 py-3">
                      <span className="text-sm">{staff.role}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Switch
                        checked={staff.creditCardAccess || false}
                        onCheckedChange={() => handleToggleCreditCardAccess(staff.id, staff.creditCardAccess || false)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
