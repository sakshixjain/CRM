import { Tag } from "lucide-react";
import { cn } from "../lib/utils";
import { useSources } from "../store/sourceStore";

type Props = {
  sourceId: number | null;
};

export default function SourceBadge({ sourceId }: Props) {
  const { sources } = useSources();

  const source = sources.find((s) => s.id === sourceId);

  if (!source) {
    return (
      <span
        className={cn(
          "inline-flex items-center px-3 py-1 text-xs font-semibold border rounded-full",
          "bg-slate-50 text-slate-700 border-slate-200"
        )}
      >
        <Tag className="w-3.5 h-3.5 mr-2" />
        Unknown
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 text-xs font-semibold border rounded-full",
        "bg-purple-50 text-purple-700 border-purple-200"
      )}
    >
      <span className="w-2 h-2 rounded-full mr-2 bg-purple-600" />
      {source.name}
    </span>
  );
}
