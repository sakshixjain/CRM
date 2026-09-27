import React from "react";

type Props = {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "outline" | "ghost";
  className?: string;
};

export default function Button({
  children,
  onClick,
  type = "button",
  disabled = false,
  variant = "primary",
  className = "",
}: Props) {
  const baseStyles =
    "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md font-semibold text-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs active:scale-[0.98]";

  const variantStyles = {
    primary:
      "bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500 shadow-indigo-600/20 dark:bg-indigo-500 dark:hover:bg-indigo-600 dark:focus:ring-offset-slate-900",
    secondary:
      "bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 focus:ring-slate-400 dark:focus:ring-offset-slate-900",
    danger:
      "bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500 dark:bg-rose-500 dark:hover:bg-rose-600 dark:focus:ring-offset-slate-900",
    outline:
      "border border-slate-300 dark:border-slate-700 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 focus:ring-indigo-500 dark:focus:ring-offset-slate-900",
    ghost:
      "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 focus:ring-slate-400 dark:focus:ring-offset-slate-900 shadow-none",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
