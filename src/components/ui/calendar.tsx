"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { enUS, fr } from 'date-fns/locale';

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  locale_lang?: 'en' | 'fr'
}

const CalendarChevron = ({ orientation, ...props }: { orientation?: "left" | "right" | "up" | "down" } & React.SVGProps<SVGSVGElement>) => {
  if (orientation === "left") {
    return <ChevronLeft className="h-4 w-4" {...props} />
  }
  if (orientation === "right") {
    return <ChevronRight className="h-4 w-4" {...props} />
  }
  return null
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  locale_lang = 'en',
  ...props
}: CalendarProps) {
  const locale = locale_lang === 'fr' ? fr : enUS;

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center mb-2",
        caption_label: "text-sm font-semibold", // Bolder month label per screenshot
        nav: "space-x-1 flex items-center",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1 z-10 rounded-md"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1 z-10 rounded-md"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-9 font-medium text-[0.8rem] uppercase tracking-tighter", // Uppercase weekday headers
        weeks: "w-full mt-2",
        week: "flex w-full mt-1",
        day: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        
        // The interactive part of the day
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal transition-all duration-200",
          "hover:bg-primary/10 hover:text-primary rounded-full" // Circular hover effect
        ),
        
        // Range Selection Styling
        selected: "bg-primary text-primary-foreground hover:bg-primary/90 rounded-full", // Full circles for start/end
        range_start: "day-range-start rounded-l-full",
        range_end: "day-range-end rounded-r-full",
        range_middle: "aria-selected:bg-primary/10 aria-selected:text-primary rounded-none", // Subtle background for middle
        
        today: "bg-accent text-accent-foreground rounded-full font-bold underline decoration-2 underline-offset-4",
        outside: "day-outside text-muted-foreground opacity-30 aria-selected:bg-primary/5 aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-20",
        hidden: "invisible",
        ...classNames,
      }}
      locale={locale}
      components={{
        Chevron: CalendarChevron,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }