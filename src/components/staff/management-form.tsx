
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import type { StaffMember, StaffRole, Permissions, StaffDepartmentKey, StaffStatus } from '@/types/staff';
import { staffRoles, defaultPermissions, staffDepartments } from '@/types/staff';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, User, Briefcase, DollarSign } from 'lucide-react';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';
import { useAuth } from '@/contexts/auth-context';
import { db, app } from '@/lib/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Icons } from '../icons';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface ManagementFormProps {
  initialData: StaffMember | null;
  onClose: () => void;
  currentUserRole: StaffRole;
  currentUserPermissions: Permissions;
}

export default function ManagementForm({ initialData, onClose, currentUserRole, currentUserPermissions }: ManagementFormProps) {
  const { t } = useTranslation('pages/staff/management');
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  // State for form fields
  const [fullName, setFullName] = useState('');
  const [cin, setCin] = useState('');
  const [cnss, setCnss] = useState('');
  const [address, setAddress] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | ''>('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState<StaffDepartmentKey | ''>('');
  const [position, setPosition] = useState('');
  const [contractType, setContractType] = useState<'CDI' | 'CDD' | 'Journalier' | 'Stage'>('CDI');
  const [hireDate, setHireDate] = useState<Date | undefined>(new Date());
  const [status, setStatus] = useState<'Actif' | 'Résilié'>('Actif');
  const [monthlySalary, setMonthlySalary] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Espèces' | 'Virement'>('Virement');

  useEffect(() => {
    if (initialData) {
      setFullName(initialData.fullName);
      setCin(initialData.cin || '');
      setCnss(initialData.cnss || '');
      setAddress(initialData.address || '');
      setSex(initialData.sex || '');
      setPhone(initialData.phone || '');
      setDepartment(initialData.department as StaffDepartmentKey || '');
      setPosition(initialData.role);
      setContractType(initialData.contractType || 'CDI');
      setHireDate(initialData.hireDate ? parseISO(initialData.hireDate) : undefined);
      setStatus(initialData.status === 'Actif' ? 'Actif' : 'Résilié');
      setMonthlySalary(initialData.salary ? String(initialData.salary) : '');
      setPaymentMethod(initialData.paymentMethod || 'Virement');
    } else {
        // Reset for new entry
        setFullName('');
        setCin('');
        setCnss('');
        setAddress('');
        setSex('');
        setPhone('');
        setDepartment('');
        setPosition('');
        setContractType('CDI');
        setHireDate(new Date());
        setStatus('Actif');
        setMonthlySalary('');
        setPaymentMethod('Virement');
    }
  }, [initialData]);

  const handleDepartmentChange = (value: string) => {
    const newDepartment = value as StaffDepartmentKey;
    setDepartment(newDepartment);
    if (department !== newDepartment) {
        setPosition('');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.propertyId) {
      toast({ title: "Error", description: "Cannot save staff member. Property not identified.", variant: "destructive" });
      return;
    }
    if (!fullName || !cin || !cnss || !position || !hireDate || !monthlySalary || !department) {
      toast({ title: t('form.validation_error.title'), description: t('form.validation_error.required_fields'), variant: "destructive" });
      return;
    }
    
    setIsLoading(true);

    const staffDataToSave = {
      fullName,
      cin,
      cnss,
      address,
      sex: sex || null,
      phone,
      department,
      role: position,
      contractType,
      hireDate: format(hireDate, 'yyyy-MM-dd'),
      status,
      salary: Number(monthlySalary),
      paymentMethod,
      propertyId: user.propertyId,
    };
    
    try {
        const functions = getFunctions(app, 'europe-west1');
        const saveStaffMember = httpsCallable(functions, 'saveStaffMember');
        
        await saveStaffMember({ staffData: staffDataToSave, staffId: initialData?.id });

        if (initialData) {
            toast({ title: t('toasts.update_success.title'), description: t('toasts.update_success.description', { name: fullName }) });
        } else {
            toast({ title: t('toasts.create_success.title'), description: t('toasts.create_success.description', { name: fullName }) });
        }
      onClose();
    } catch (error: any) {
        console.error("Error saving staff member:", error);
        toast({ title: "Error", description: error.message || t('toasts.save_error'), variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-4 max-h-[75vh] overflow-y-auto pr-2">
      
      {/* Informations de base */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">{t('form.sections.base_info')}</h3>
        </div>
        <div className="space-y-1">
          <Label htmlFor="fullName">{t('form.full_name_label')} <span className="text-destructive">*</span></Label>
          <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="cin">{t('form.cin_label')} <span className="text-destructive">*</span></Label>
            <Input id="cin" value={cin} onChange={(e) => setCin(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone">{t('form.phone_label')}</Label>
            <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
                <Label htmlFor="sex">{t('form.sex_label')}</Label>
                <Select value={sex} onValueChange={(v) => setSex(v as any)}>
                    <SelectTrigger id="sex"><SelectValue placeholder={t('form.sex_placeholder')} /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="male">{t('form.sexes.male')}</SelectItem>
                        <SelectItem value="female">{t('form.sexes.female')}</SelectItem>
                    </SelectContent>
                </Select>
            </div>
             <div className="space-y-1">
                <Label htmlFor="address">{t('form.address_label')}</Label>
                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
        </div>
      </section>

      <Separator />

      {/* Informations professionnelles */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <Briefcase className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">{t('form.sections.professional_info')}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
              <Label htmlFor="department">{t('form.department_label')} <span className="text-destructive">*</span></Label>
              <Select value={department} onValueChange={handleDepartmentChange} required>
                  <SelectTrigger id="department"><SelectValue placeholder={t('form.department_placeholder')} /></SelectTrigger>
                  <SelectContent>
                      {Object.keys(staffDepartments).map(key => (
                          <SelectItem key={key} value={key}>{t(staffDepartments[key as StaffDepartmentKey].labelKey)}</SelectItem>
                      ))}
                  </SelectContent>
              </Select>
          </div>
          <div className="space-y-1">
              <Label htmlFor="position">{t('form.position_label')} <span className="text-destructive">*</span></Label>
              <Select value={position} onValueChange={setPosition} required disabled={!department}>
                  <SelectTrigger id="position"><SelectValue placeholder={t('form.position_placeholder')} /></SelectTrigger>
                  <SelectContent>
                      {department && staffDepartments[department as StaffDepartmentKey]?.positions.map(posKey => (
                          <SelectItem key={posKey} value={posKey}>{t(`positions.${posKey}`)}</SelectItem>
                      ))}
                  </SelectContent>
              </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="contractType">{t('form.contract_type_label')}</Label>
            <Select value={contractType} onValueChange={(v) => setContractType(v as any)}>
              <SelectTrigger id="contractType"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CDI">{t('form.contract_types.cdi')}</SelectItem>
                <SelectItem value="CDD">{t('form.contract_types.cdd')}</SelectItem>
                <SelectItem value="Journalier">{t('form.contract_types.daily')}</SelectItem>
                <SelectItem value="Stage">{t('form.contract_types.internship')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
              <Label htmlFor="hireDate">{t('form.hire_date_label')} <span className="text-destructive">*</span></Label>
              <Popover>
                  <PopoverTrigger asChild>
                      <Button id="hireDate" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !hireDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {hireDate ? format(hireDate, "PPP") : <span>{t('form.date_placeholder')}</span>}
                      </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={hireDate} onSelect={setHireDate} initialFocus /></PopoverContent>
              </Popover>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="status">{t('form.status_label')}</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger id="status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Actif">{t('form.statuses.active')}</SelectItem>
              <SelectItem value="Résilié">{t('form.statuses.terminated')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <Separator />

      {/* Informations salariales */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">{t('form.sections.salary_info')}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="monthlySalary">{t('form.salary_label')} <span className="text-destructive">*</span></Label>
            <Input id="monthlySalary" type="number" value={monthlySalary} onChange={(e) => setMonthlySalary(e.target.value)} placeholder="0.00" min="0" step="0.01" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cnss">{t('form.cnss_label')} <span className="text-destructive">*</span></Label>
            <Input id="cnss" value={cnss} onChange={(e) => setCnss(e.target.value)} required />
          </div>
        </div>
        <div className="space-y-1">
            <Label htmlFor="paymentMethod">{t('form.payment_method_label')}</Label>
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
              <SelectTrigger id="paymentMethod"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Espèces">{t('form.payment_methods.cash')}</SelectItem>
                <SelectItem value="Virement">{t('form.payment_methods.transfer')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
      </section>

      <DialogFooter className="pt-4 border-t">
        <DialogClose asChild><Button type="button" variant="outline" onClick={onClose}>{t('buttons.cancel')}</Button></DialogClose>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
          {t('buttons.save')}
        </Button>
      </DialogFooter>
    </form>
  );
}
