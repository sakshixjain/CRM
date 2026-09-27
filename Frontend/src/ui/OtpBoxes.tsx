import { useRef } from "react";

type OtpBoxesProps = {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  disabled?: boolean;
  onEnter?: () => void;
};

export function OtpBoxes({
  value,
  onChange,
  length = 6,
  disabled = false,
  onEnter,
}: OtpBoxesProps) {
  const inputsRef = useRef<HTMLInputElement[]>([]);

  const handleChange = (index: number, val: string) => {
    if (!/^\d?$/.test(val)) return; // allow only single digit

    const newValue =
      value.substring(0, index) +
      val +
      value.substring(index + 1);

    onChange(newValue);

    // move to next box
    if (val && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (e.key === "Enter" && onEnter) {
      e.preventDefault();
      onEnter();
    }
  };

  return (
    <div className="flex gap-2.5 justify-center">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            if (el) inputsRef.current[i] = el;
          }}
          type="text"
          maxLength={1}
          value={value[i] || ""}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="h-12 w-12 text-center text-lg font-bold rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:ring-indigo-400/30 dark:focus:border-indigo-400 outline-none transition-all shadow-xs"
        />
      ))}
    </div>
  );
}
export default OtpBoxes;
