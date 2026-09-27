type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
};

export default function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
}: Props) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
        {label}
      </span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 dark:focus:ring-indigo-400/30 dark:focus:border-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed shadow-xs"
      />
    </label>
  );
}
