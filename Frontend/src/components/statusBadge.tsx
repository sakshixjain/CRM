import { cn } from "../lib/utils";
import { useStatuses } from "../store/statusStore";

export type LeadStatus = {
  id: number;
  name: string;
  color?: string | null;
};

type Props = {
  statusId: number | null;
};

export default function StatusBadge({ statusId }: Props) {
  const { statuses } = useStatuses();

  const status = statuses.find((s) => s.id === statusId);
  const color = status?.color || "#94a3b8";

  return (
    <span
      className={cn("inline-flex items-center px-3 py-1 text-xs font-semibold border rounded-full")}
      style={{
        backgroundColor: `${color}15`,
        borderColor: color,
        color: color,
      }}
    >
      <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: color }} />
      {status?.name || "Unassigned"}
    </span>
  );
}
