
"use client";

import React, { useRef, useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Icons } from "@/components/icons";
import { PlusCircle, Trash2 } from "lucide-react";
import type { StaffMember } from '@/types/staff';
import { useAuth } from '@/contexts/auth-context';
import { format, subMonths } from 'date-fns';
import type { Property } from '@/types/property';
import { generatePayslipPdf, type PayslipData, type RemunerationItem, type DeductionItem } from '@/lib/payslipGenerator';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PayslipModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffMember: StaffMember | null;
}

const PayslipDocumentPreview = React.forwardRef<HTMLDivElement, { data: PayslipData, property: Property | null }>(({ data, property }, ref) => {
    const currency = property?.currency || 'MAD';

    const renderTableRows = (items: (RemunerationItem | DeductionItem)[]) => (
        items.map((item, index) => (
            <tr key={index}>
                <td className="px-2 py-1 border-r">{item.label}</td>
                <td className="px-2 py-1 border-r text-center">{item.base ?? ' '}</td>
                <td className="px-2 py-1 border-r text-center">{item.rate ?? ' '}</td>
                <td className="px-2 py-1 border-r text-right">{'gain' in item ? `${(Number(item.gain) || 0).toFixed(2)} ${currency}` : ''}</td>
                <td className="px-2 py-1 text-right">{'deduction' in item ? `${(Number(item.deduction) || 0).toFixed(2)} ${currency}` : ''}</td>
            </tr>
        ))
    );

    return (
        <div ref={ref} className="p-8 bg-white text-black font-sans text-xs">
            <div className="text-center mb-4">
                <p className="font-bold">{data.companyName}</p>
                <p>{data.companyAddress}</p>
                <p>{data.companyCity}</p>
            </div>
            <Separator className="my-4 bg-black" />
            <div>
                <p><span className="font-bold">BULLETIN DE PAIE</span></p>
                <p>N° CNSS : {data.companyCnss}</p>
                <p>Période de paie du : {data.periodStart}</p>
                <p>Période de paie au : {data.periodEnd}</p>
            </div>
            <Separator className="my-4 bg-black" />
            <div>
                <p className="font-bold">Informations du salarié</p>
                <div className="grid grid-cols-2 gap-x-4">
                    <p>Nom et prénom : {data.employeeName}</p>
                    <p>CIN : {data.employeeCin}</p>
                    <p>Département / Service : {data.employeeDepartment}</p>
                    <p>Qualification : {data.employeePosition}</p>
                    <p>Date d'embauche : {data.employeeHireDate}</p>
                    <p>N° CNSS : {data.employeeCnss}</p>
                    <p className="col-span-2">Salaire de base : {data.baseSalary.toFixed(2)} {currency}</p>
                    <p className="col-span-2">Adresse : {data.employeeAddress}</p>
                </div>
            </div>
            <Separator className="my-4 bg-black" />
            <div>
                <p className="font-bold mb-2">Détails de la paie</p>
                <table className="w-full border-collapse border">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="px-2 py-1 border-r text-left font-semibold">Description</th>
                            <th className="px-2 py-1 border-r font-semibold">Base / Nombre</th>
                            <th className="px-2 py-1 border-r font-semibold">Taux %</th>
                            <th className="px-2 py-1 border-r font-semibold">À Payer ({currency})</th>
                            <th className="px-2 py-1 font-semibold">À Déduire ({currency})</th>
                        </tr>
                    </thead>
                    <tbody>
                        {renderTableRows(data.remunerationItems)}
                        <tr className="font-bold bg-gray-50">
                            <td colSpan={3} className="px-2 py-1 text-right border-r">Salaire brut</td>
                            <td className="px-2 py-1 text-right border-r">{data.grossSalary.toFixed(2)} {currency}</td>
                            <td></td>
                        </tr>
                        {renderTableRows(data.deductionItems)}
                        <tr className="font-bold bg-gray-50">
                            <td colSpan={4} className="px-2 py-1 text-right border-r">Salaire net à payer</td>
                            <td className="px-2 py-1 text-right">{data.netSalary.toFixed(2)} {currency}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div className="mt-8">
              <p>Mode de paiement : {data.paymentMethod}</p>
            </div>
            <div className="mt-16 flex justify-between items-end">
                <div className="text-sm">
                    <p>Fait à {data.companyCity}, le {format(new Date(), 'dd/MM/yyyy')}</p>
                </div>
                <div className="text-center">
                    <div className="w-48 h-16"></div> {/* Placeholder for stamp */}
                    <p className="mt-2 text-sm">Signature et cachet de l’entreprise</p>
                </div>
            </div>
        </div>
    );
});
PayslipDocumentPreview.displayName = "PayslipDocumentPreview";


export default function PayslipModal({ isOpen, onClose, staffMember }: PayslipModalProps) {
    const { property } = useAuth();
    const [language, setLanguage] = useState<'en' | 'fr'>('fr');
    const [isGenerating, setIsGenerating] = useState(false);
    const [months, setMonths] = useState<{ value: string; label: string }[]>([]);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'Virement' | 'Chèque' | 'Espèces'>('Virement');

    const [remunerationItems, setRemunerationItems] = useState<RemunerationItem[]>([
        { label: 'Salaire de base', base: '', rate: '', gain: staffMember?.salary || 0 }
    ]);
    const [deductionItems, setDeductionItems] = useState<DeductionItem[]>([
        { label: 'Retenue CNSS', base: '', rate: '', deduction: 0 }
    ]);

    const [formState, setFormState] = useState<Partial<PayslipData>>({});

    useEffect(() => {
        const now = new Date();
        const last12Months = Array.from({ length: 12 }, (_, i) => {
            const date = subMonths(now, i);
            return { value: format(date, 'yyyy-MM'), label: format(date, 'MMMM yyyy') };
        });
        setMonths(last12Months);
        setSelectedMonth(last12Months[0].value);
    }, []);

    useEffect(() => {
        if (staffMember && property) {
            const periodDate = selectedMonth ? new Date(selectedMonth) : new Date();
            setPaymentMethod(staffMember.paymentMethod || 'Virement');
            setFormState({
                companyName: property.legalInformation?.companyName || property.name,
                companyAddress: property.legalInformation?.businessAddress || property.address,
                companyCity: property.city,
                companyCnss: property.legalInformation?.patenteNumber,
                periodStart: format(new Date(periodDate.getFullYear(), periodDate.getMonth(), 1), 'dd/MM/yyyy'),
                periodEnd: format(new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0), 'dd/MM/yyyy'),
                employeeName: staffMember.fullName,
                employeeCin: staffMember.cin,
                employeeDepartment: staffMember.department,
                employeePosition: staffMember.role,
                employeeHireDate: staffMember.hireDate ? format(new Date(staffMember.hireDate), 'dd/MM/yyyy') : '',
                employeeCnss: 'N/A', // Assuming not stored on staff member directly
                baseSalary: staffMember.salary,
                employeeAddress: 'N/A', // Assuming not stored on staff member directly
            });
            setRemunerationItems([{ label: 'Salaire de base', base: '', rate: '', gain: staffMember.salary || 0 }]);
        }
    }, [staffMember, property, selectedMonth]);
    
    const handleItemChange = <T extends RemunerationItem | DeductionItem>(
        index: number,
        field: keyof T,
        value: string,
        itemType: 'remuneration' | 'deduction'
    ) => {
        const setItems = itemType === 'remuneration' ? setRemunerationItems : setDeductionItems;
        setItems(prevItems => {
            const newItems = [...prevItems] as T[];
            const updatedItem = { ...newItems[index], [field]: value };

            const base = parseFloat(updatedItem.base as string) || 0;
            const rate = parseFloat(updatedItem.rate as string) || 0;

            if (field === 'base' || field === 'rate') {
                const calculatedValue = base * rate; // No division by 100
                if (itemType === 'remuneration') {
                    (updatedItem as RemunerationItem).gain = calculatedValue;
                } else {
                    (updatedItem as DeductionItem).deduction = calculatedValue;
                }
            }
            
            newItems[index] = updatedItem;
            return newItems;
        });
    };

    const addItem = (itemType: 'remuneration' | 'deduction') => {
        if (itemType === 'remuneration') {
            setRemunerationItems(prev => [...prev, { label: '', base: '', rate: '', gain: 0 }]);
        } else {
            setDeductionItems(prev => [...prev, { label: '', base: '', rate: '', deduction: 0 }]);
        }
    };
    
    const removeItem = (index: number, itemType: 'remuneration' | 'deduction') => {
        const setItems = itemType === 'remuneration' ? setRemunerationItems : setDeductionItems;
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleDownload = async () => {
        if (!staffMember || !property) return;
        
        const finalRemunerationItems = remunerationItems.map(item => ({
            ...item,
            base: item.base ? parseFloat(item.base as string) : undefined,
            rate: item.rate ? parseFloat(item.rate as string) : undefined,
            gain: parseFloat(String(item.gain || 0))
        }));

        const finalDeductionItems = deductionItems.map(item => ({
            ...item,
            base: item.base ? parseFloat(item.base as string) : undefined,
            rate: item.rate ? parseFloat(item.rate as string) : undefined,
            deduction: parseFloat(String(item.deduction || 0))
        }));

        const grossSalary = finalRemunerationItems.reduce((sum, item) => sum + (item.gain || 0), 0);
        const totalDeductions = finalDeductionItems.reduce((sum, item) => sum + (item.deduction || 0), 0);
        const netSalary = grossSalary - totalDeductions;
        
        const payslipData: PayslipData = {
            ...formState,
            paymentMethod,
            remunerationItems: finalRemunerationItems,
            deductionItems: finalDeductionItems,
            grossSalary,
            netSalary
        } as PayslipData;

        setIsGenerating(true);
        try {
            const pdf = await generatePayslipPdf(payslipData, property, language);
            pdf.save(`bulletin-de-paie-${staffMember.fullName.replace(/\s/g, '-')}-${selectedMonth}.pdf`);
        } catch (error) {
            console.error("Error generating payslip PDF:", error);
            toast({ title: "PDF Generation Failed", description: "An error occurred.", variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };

    if (!staffMember || !property) return null;

    const previewData: PayslipData = {
        ...formState,
        paymentMethod,
        remunerationItems,
        deductionItems,
        grossSalary: remunerationItems.reduce((acc, item) => acc + (parseFloat(String(item.gain)) || 0), 0),
        netSalary: remunerationItems.reduce((acc, item) => acc + (parseFloat(String(item.gain)) || 0), 0) - deductionItems.reduce((acc, item) => acc + (parseFloat(String(item.deduction)) || 0), 0),
    } as PayslipData;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl h-[95vh]">
                <DialogHeader>
                    <DialogTitle>Bulletin de Paie: {staffMember.fullName}</DialogTitle>
                    <DialogDescription>Générez un bulletin de paie pour le mois sélectionné.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(95vh-150px)]">
                    <ScrollArea className="h-full pr-4">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label>Mois</Label>
                                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-end gap-2">
                                     <Label className="self-end mb-2">Langue:</Label>
                                    <Button variant={language === 'en' ? 'default' : 'outline'} size="sm" onClick={() => setLanguage('en')}>English</Button>
                                    <Button variant={language === 'fr' ? 'default' : 'outline'} size="sm" onClick={() => setLanguage('fr')}>Français</Button>
                                </div>
                            </div>
                            <Separator />
                            <h3 className="font-semibold">Rémunération</h3>
                            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
                                <Label className="col-span-4">Description</Label>
                                <Label className="col-span-2">Base</Label>
                                <Label className="col-span-2">Taux %</Label>
                                <Label className="col-span-3">Gain</Label>
                            </div>
                            {remunerationItems.map((item, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                                    <Input className="col-span-4" placeholder="Libellé" value={item.label} onChange={e => handleItemChange(index, 'label', e.target.value, 'remuneration')} />
                                    <Input className="col-span-2" placeholder="Base" type="number" value={item.base as string} onChange={e => handleItemChange(index, 'base', e.target.value, 'remuneration')} />
                                    <Input className="col-span-2" placeholder="Taux %" type="number" value={item.rate as string} onChange={e => handleItemChange(index, 'rate', e.target.value, 'remuneration')} />
                                    <Input className="col-span-3" placeholder="Gain" type="number" value={item.gain as number} onChange={e => handleItemChange(index, 'gain', e.target.value, 'remuneration')} />
                                    <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => removeItem(index, 'remuneration')}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={() => addItem('remuneration')}><PlusCircle className="mr-2 h-4 w-4" /> Ajouter une ligne</Button>

                            <Separator />
                            <h3 className="font-semibold">Retenues</h3>
                            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
                                <Label className="col-span-4">Description</Label>
                                <Label className="col-span-2">Base</Label>
                                <Label className="col-span-2">Taux %</Label>
                                <Label className="col-span-3">Retenue</Label>
                            </div>
                            {deductionItems.map((item, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                                    <Input className="col-span-4" placeholder="Libellé" value={item.label} onChange={e => handleItemChange(index, 'label', e.target.value, 'deduction')} />
                                    <Input className="col-span-2" placeholder="Base" type="number" value={item.base as string} onChange={e => handleItemChange(index, 'base', e.target.value, 'deduction')} />
                                    <Input className="col-span-2" placeholder="Taux %" type="number" value={item.rate as string} onChange={e => handleItemChange(index, 'rate', e.target.value, 'deduction')} />
                                    <Input className="col-span-3" placeholder="Retenue" type="number" value={item.deduction as number} onChange={e => handleItemChange(index, 'deduction', e.target.value, 'deduction')} />
                                    <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => removeItem(index, 'deduction')}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={() => addItem('deduction')}><PlusCircle className="mr-2 h-4 w-4" /> Ajouter une ligne</Button>
                            
                            <Separator />

                            <div className="space-y-1">
                                <Label htmlFor="paymentMethod">Mode de paiement</Label>
                                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                                    <SelectTrigger id="paymentMethod"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Virement">Virement bancaire</SelectItem>
                                        <SelectItem value="Chèque">Chèque</SelectItem>
                                        <SelectItem value="Espèces">Espèces</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </ScrollArea>
                    <div className="border rounded-md bg-gray-50 h-full overflow-auto">
                        <PayslipDocumentPreview data={previewData} property={property} />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary">Fermer</Button></DialogClose>
                    <Button onClick={handleDownload} disabled={isGenerating}>
                        {isGenerating && <Icons.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                        <Icons.Download className="mr-2 h-4 w-4" />
                        Télécharger PDF
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
