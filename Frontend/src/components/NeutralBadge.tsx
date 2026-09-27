import { cn } from "../lib/utils";

type Props = {
  label: string;
  className?: string;
};

export default function NeutralBadge({ label, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 text-xs font-medium rounded-full border",
        "bg-slate-50 text-slate-700 border-slate-200",
        className
      )}
    >
      {label}
    </span>
  );
}
