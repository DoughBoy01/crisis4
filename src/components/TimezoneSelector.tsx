import { useState, useRef, useEffect } from "react";
import { Globe, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { TIMEZONE_OPTIONS, getTzAbbreviation } from "@/lib/timezone";

interface TimezoneSelectorProps {
  value: string;
  onChange: (tz: string) => void;
}

export default function TimezoneSelector({ value, onChange }: TimezoneSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = TIMEZONE_OPTIONS.find(t => t.value === value);
  const abbr = getTzAbbreviation(value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors",
          "border border-border/50 bg-slate-800/60 hover:bg-slate-700/60 hover:border-border",
          "text-muted-foreground hover:text-slate-200"
        )}
        title="Change your timezone"
      >
        <Globe size={11} className="shrink-0" />
        <span className="font-mono font-medium">{abbr}</span>
        {current && (
          <span className="hidden sm:inline text-muted-foreground/60 text-[10px]">
            {current.label}
          </span>
        )}
        <ChevronDown size={10} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className={cn(
          "absolute right-0 top-full mt-1.5 z-50 w-[min(256px,calc(100vw-2rem))]",
          "bg-slate-900 border border-border rounded-lg shadow-xl overflow-hidden"
        )}>
          <div className="px-3 py-2 border-b border-border/50">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Your Timezone
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
              All times shown in your local time
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {TIMEZONE_OPTIONS.map(tz => (
              <button
                key={tz.value}
                onClick={() => { onChange(tz.value); setOpen(false); }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-800/80 transition-colors",
                  value === tz.value ? "bg-sky-950/40" : ""
                )}
              >
                <div>
                  <p className={cn(
                    "text-xs font-medium",
                    value === tz.value ? "text-sky-300" : "text-slate-300"
                  )}>
                    {tz.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">{tz.offset}</p>
                </div>
                {value === tz.value && (
                  <Check size={12} className="text-sky-400 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
