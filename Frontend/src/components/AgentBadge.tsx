
import { Users } from "lucide-react";
import { cn } from "../lib/utils";
import { useAgents } from "../store/agentStore";

type Props = {
  agentId: number | null;
};

export default function AgentBadge({ agentId }: Props) {
  const { agents } = useAgents();

  const agent = agents.find((a) => a.id === agentId);

  if (!agent) {
    return (
      <span
        className={cn(
          "inline-flex items-center px-3 py-1 text-xs font-semibold border rounded-full",
          "bg-slate-50 text-slate-700 border-slate-200"
        )}
      >
        <Users className="w-3.5 h-3.5 mr-2" />
        Unassigned
      </span>
    );
  }

  const label = agent.name || agent.email || "Agent";

  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 text-xs font-semibold border rounded-full",
        "bg-emerald-50 text-emerald-700 border-emerald-200"
      )}
      title={agent.email || label}
    >
      <span className="w-2 h-2 rounded-full mr-2 bg-emerald-600" />
      {label}
    </span>
  );
}
