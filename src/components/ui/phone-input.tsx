
"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { countries, type Country } from "@/lib/countries"
import { useTranslation } from "react-i18next"

interface PhoneInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onChange: (value: string) => void;
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const { t } = useTranslation(['country-code', 'country']);
    const [open, setOpen] = React.useState(false)
    
    // Split the value into country code and phone number
    const [countryCode, phoneNumber] = React.useMemo(() => {
        const parts = value?.split(' ') || ['+212', ''];
        if (parts.length > 1 && parts[0].startsWith('+')) {
            return [parts[0], parts.slice(1).join(' ')];
        }
        return ['+212', value || '']; // Default to Morocco
    }, [value]);

    const selectedCountry = React.useMemo(() => {
        return countries.find(c => `+${c.phone}` === countryCode) || countries.find(c => c.code === 'MA');
    }, [countryCode]);

    const handleCountryChange = (country: Country) => {
        const newCountryCode = `+${country.phone}`;
        onChange(`${newCountryCode} ${phoneNumber}`);
        setOpen(false);
    };

    const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(`${countryCode} ${e.target.value}`);
    };

    return (
      <div className={cn("flex items-center", className)}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-[150px] justify-start rounded-r-none pl-3 pr-2 transition-colors hover:bg-[var(--booking-primary-hover)] hover:text-primary-foreground hover:border-[var(--booking-primary-hover)]"
            >
              <div className="flex items-center gap-2">
                    {selectedCountry ? (
                        <img
                            src={`https://flagcdn.com/w20/${selectedCountry.code.toLowerCase()}.png`}
                            alt={selectedCountry.name}
                            className="h-4"
                        />
                    ) : null}
                    <div className="flex items-center gap-2">
                        <span>{selectedCountry ? `+${selectedCountry.phone}`: 'Select'}</span>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </div>
                </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0">
            <Command>
              <CommandInput placeholder={t('country-code:search_placeholder')} />
              <CommandList>
                <CommandEmpty>{t('country-code:no_country_found')}</CommandEmpty>
                <CommandGroup>
                  {countries.map((country) => (
                    <CommandItem
                      key={country.code}
                      value={`${t(`country:countries.${country.code}`)} (+${country.phone})`}
                      onSelect={() => handleCountryChange(country)}
                      className="aria-selected:bg-[var(--booking-primary-hover)] aria-selected:text-primary-foreground"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedCountry?.code === country.code ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <img
                        src={`https://flagcdn.com/w20/${country.code.toLowerCase()}.png`}
                        alt={country.name}
                        className="h-4 mr-2"
                      />
                      <span className="flex-1">{t(`country:countries.${country.code}`)}</span>
                      <span className="text-muted-foreground">+{country.phone}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Input
          type="tel"
          className="rounded-l-none"
          placeholder="ex: +212 6 12 34 56 78"
          value={phoneNumber}
          onChange={handlePhoneNumberChange}
          ref={ref}
          {...props}
        />
      </div>
    );
  }
);
PhoneInput.displayName = "PhoneInput";
