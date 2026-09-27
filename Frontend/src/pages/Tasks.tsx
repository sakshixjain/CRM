/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  CheckSquare,
  Plus,
  Search,
  CheckCircle2,
  Circle,
  X,
  RefreshCcw,
  Loader2,
  Trash2,
  Edit2,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api";

export type TaskType = "Call" | "Email" | "Meeting" | "Follow-up" | "Task" | "Other";
export type TaskPriority = "High" | "Medium" | "Low";
export type TaskStatus = "Pending" | "Completed" | "Overdue";

export type CRMTask = {
  id: string | number;
  title: string;
  type: TaskType;
  related_type: "Lead" | "Deal" | "Contact" | "Company" | "Payment";
  related_name: string;
  assigned_to: string;
  due_date: string;
  due_time?: string;
  priority: TaskPriority;
  status: TaskStatus;
  description?: string;
  created_at: string;
  isBackend?: boolean;
  followup_id?: number | string;
};

function unwrapList(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
}

export default function Tasks() {
  const [tasks, setTasks] = useState<CRMTask[]>([]);
  const [loading, setLoading] = useState(true);

  const [timeFilter, setTimeFilter] = useState<"Today" | "This Week" | "This Month" | "All">("All");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");
  const [agentsList, setAgentsList] = useState<any[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CRMTask | null>(null);
  const [formData, setFormData] = useState<Partial<CRMTask>>({
    type: "Call",
    priority: "Medium",
    status: "Pending",
    related_type: "Lead",
  });

  const loadTasksFromBackend = useCallback(async () => {
    setLoading(true);
    try {
      const [followupsRes, remindersRes, paymentRemindersRes, fieldWorksRes, agentsRes] =
        await Promise.allSettled([
          api.getAllFollowups({ page: 1, limit: 50000 }),
          api.getReminderAlerts(),
          api.getPaymentDurationReminderAlerts(),
          api.getAllFieldWorks({ limit: 5000 }),
          api.listAgents(),
        ]);

      const agents = agentsRes.status === "fulfilled" ? unwrapList(agentsRes.value) : [];
      setAgentsList(agents);

      const dynamicTasks: CRMTask[] = [];
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      // 1. Followups
      if (followupsRes.status === "fulfilled" && followupsRes.value) {
        const rawFollowups = unwrapList(followupsRes.value);
        rawFollowups.forEach((f: any) => {
          const rawDate = f?.followup_date || f?.date || f?.created_at;
          const leadName = f?.lead?.name || f?.lead?.lead_name || f?.lead_name || `Lead #${f?.lead_id || ""}`;
          const agentName = f?.changedBy?.name || f?.agent?.name || "Agent";

          let isOverdue = false;
          let dueDateFormatted = "Today";
          if (rawDate) {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
              dueDateFormatted = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
              const fDate = new Date(d);
              fDate.setHours(0, 0, 0, 0);
              if (fDate < todayDate) isOverdue = true;
            }
          }

          const isCompleted = String(f?.status?.name || "").toLowerCase().includes("done") || String(f?.status?.name || "").toLowerCase().includes("close");

          dynamicTasks.push({
            id: `followup-${f.id}`,
            title: `Follow-up with ${leadName}`,
            type: "Follow-up",
            related_type: "Lead",
            related_name: leadName,
            assigned_to: agentName,
            due_date: dueDateFormatted,
            due_time: f?.followup_time || "11:00 AM",
            priority: isOverdue ? "High" : "Medium",
            status: isCompleted ? "Completed" : isOverdue ? "Overdue" : "Pending",
            description: f?.remark || "Routine CRM Lead Followup",
            created_at: f?.created_at ? new Date(f.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Recent",
            isBackend: true,
            followup_id: f?.id,
          });
        });
      }

      // 2. Active Reminders
      if (remindersRes.status === "fulfilled" && remindersRes.value) {
        const rawReminders = unwrapList(remindersRes.value);
        rawReminders.forEach((r: any) => {
          const leadName = r?.lead?.name || `Lead #${r?.lead_id || ""}`;
          dynamicTasks.push({
            id: `reminder-${r.id}`,
            title: `Action Required: Contact ${leadName}`,
            type: "Call",
            related_type: "Lead",
            related_name: leadName,
            assigned_to: r?.changedBy?.name || "Assigned Rep",
            due_date: "Today",
            due_time: r?.followup_time || "02:00 PM",
            priority: "High",
            status: "Overdue",
            description: r?.remark || "Pending reminder trigger from CRM alert system",
            created_at: "Today",
            isBackend: true,
          });
        });
      }

      // 3. Payment Duration Reminders
      if (paymentRemindersRes.status === "fulfilled" && paymentRemindersRes.value) {
        const rawPayments = unwrapList(paymentRemindersRes.value);
        rawPayments.forEach((p: any) => {
          const name = p?.client_name || p?.company_name || `Payment #${p.id}`;
          dynamicTasks.push({
            id: `pay-rem-${p.id}`,
            title: `Payment Follow-up: ${name}`,
            type: "Task",
            related_type: "Payment",
            related_name: name,
            assigned_to: p?.agent?.name || "Accounts Rep",
            due_date: "Upcoming",
            priority: "High",
            status: "Pending",
            description: `Payment duration milestone reached. Amount: ₹ ${p.amount || "N/A"}`,
            created_at: "Recent",
            isBackend: true,
          });
        });
      }

      // 4. Field Works
      if (fieldWorksRes.status === "fulfilled" && fieldWorksRes.value) {
        const rawFw = unwrapList(fieldWorksRes.value);
        rawFw.forEach((fw: any) => {
          const leadName = fw?.lead?.name || fw?.number || `Field Visit #${fw.id}`;
          dynamicTasks.push({
            id: `fieldwork-${fw.id}`,
            title: `On-site Field Visit: ${leadName}`,
            type: "Meeting",
            related_type: "Company",
            related_name: leadName,
            assigned_to: "Field Executive",
            due_date: fw?.days ? `${fw.days} Days` : "Active",
            priority: "Medium",
            status: fw?.report_submit === "yes" ? "Completed" : "Pending",
            description: fw?.remarks || "On-site verification and physical client visit",
            created_at: "Recent",
            isBackend: true,
          });
        });
      }

      // 5. Custom Local Tasks
      try {
        const savedCustom = localStorage.getItem("crm_custom_tasks");
        if (savedCustom) {
          const customList = JSON.parse(savedCustom);
          if (Array.isArray(customList)) {
            dynamicTasks.unshift(...customList);
          }
        }
      } catch (e) {
        console.error(e);
      }

      setTasks(dynamicTasks);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasksFromBackend();
  }, [loadTasksFromBackend]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch =
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.related_name.toLowerCase().includes(search.toLowerCase()) ||
        t.assigned_to.toLowerCase().includes(search.toLowerCase());

      const matchType = typeFilter === "all" || t.type === typeFilter;
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      const matchAssigned = assignedFilter === "all" || t.assigned_to === assignedFilter;

      let matchTime = true;
      if (timeFilter === "Today") {
        matchTime = t.due_date.toLowerCase().includes("today") || t.created_at.toLowerCase().includes("today");
      }

      return matchSearch && matchType && matchStatus && matchAssigned && matchTime;
    });
  }, [tasks, search, typeFilter, statusFilter, assignedFilter, timeFilter]);

  const toggleTaskStatus = (id: string | number) => {
    const updated = tasks.map((t) =>
      t.id === id
        ? {
            ...t,
            status: (t.status === "Completed" ? "Pending" : "Completed") as TaskStatus,
          }
        : t
    );
    setTasks(updated);
    toast.success("Task status updated");
  };

  const handleDelete = (id: string | number) => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      const updated = tasks.filter((t) => t.id !== id);
      setTasks(updated);

      try {
        const savedCustom = localStorage.getItem("crm_custom_tasks");
        if (savedCustom) {
          const list = JSON.parse(savedCustom);
          const filtered = list.filter((x: any) => x.id !== id);
          localStorage.setItem("crm_custom_tasks", JSON.stringify(filtered));
        }
      } catch (e) {
        console.error(e);
      }

      toast.success("Task deleted");
    }
  };

  const handleOpenAdd = () => {
    setEditingTask(null);
    setFormData({
      title: "",
      type: "Call",
      related_type: "Lead",
      related_name: "",
      assigned_to: agentsList[0]?.name || "Sakshi",
      due_date: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      priority: "Medium",
      status: "Pending",
      description: "",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (t: CRMTask) => {
    setEditingTask(t);
    setFormData(t);
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
      toast.error("Please enter task title");
      return;
    }

    if (editingTask) {
      const updated = tasks.map((t) =>
        t.id === editingTask.id ? ({ ...t, ...formData } as CRMTask) : t
      );
      setTasks(updated);
      toast.success("Task updated");
    } else {
      const newTask: CRMTask = {
        id: `custom-${Date.now()}`,
        title: formData.title || "",
        type: (formData.type as any) || "Task",
        related_type: formData.related_type || "Lead",
        related_name: formData.related_name || "General",
        assigned_to: formData.assigned_to || "Admin",
        due_date: formData.due_date || "Today",
        due_time: formData.due_time || "11:00 AM",
        priority: (formData.priority as any) || "Medium",
        status: (formData.status as any) || "Pending",
        description: formData.description || "",
        created_at: new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
      };

      setTasks([newTask, ...tasks]);

      try {
        const savedCustom = localStorage.getItem("crm_custom_tasks");
        const list = savedCustom ? JSON.parse(savedCustom) : [];
        list.unshift(newTask);
        localStorage.setItem("crm_custom_tasks", JSON.stringify(list));
      } catch (e) {
        console.error(e);
      }

      toast.success("Task created");
    }
    setModalOpen(false);
  };

  // Status badge style helper
  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case "Completed":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
      case "Overdue":
        return "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800";
      default:
        return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800";
    }
  };

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case "High":
        return "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400";
      case "Medium":
        return "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1B2559] dark:text-white tracking-tight flex items-center gap-2.5">
            <CheckSquare className="text-blue-600" size={24} />
            Task Management & Follow-ups
          </h1>
          <p className="text-xs font-medium text-[#8F9CAE] mt-0.5">
            Dynamic live task assignments, customer follow-up calls, reminders, and pending activities.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadTasksFromBackend()}
            disabled={loading}
            className="p-2 rounded-md border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-[#1B2559] dark:text-white hover:bg-slate-50 transition"
            title="Refresh Tasks"
          >
            <RefreshCcw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
          </button>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 rounded-md bg-[#111C44] hover:bg-[#1E2E69] text-white px-4 py-2 text-xs font-bold shadow-md shadow-[#111C44]/20 transition"
          >
            <Plus size={16} />
            Add Task
          </button>
        </div>
      </div>

      {/* KPI Stats Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="text-xs font-bold text-[#8F9CAE]">Total Active Tasks</div>
          <div className="text-2xl font-black text-[#1B2559] dark:text-white mt-1">
            {tasks.length}
          </div>
          <div className="text-[11px] font-semibold text-blue-600 mt-1">
            Across all sales reps
          </div>
        </div>

        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="text-xs font-bold text-[#8F9CAE]">Pending Follow-ups</div>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {tasks.filter((t) => t.status === "Pending").length}
          </div>
          <div className="text-[11px] font-semibold text-amber-600 mt-1">
            Require customer contact
          </div>
        </div>

        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="text-xs font-bold text-[#8F9CAE]">Completed Actions</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {tasks.filter((t) => t.status === "Completed").length}
          </div>
          <div className="text-[11px] font-semibold text-emerald-600 mt-1">
            Successfully closed
          </div>
        </div>

        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="text-xs font-bold text-[#8F9CAE]">High Priority / Overdue</div>
          <div className="text-2xl font-black text-red-600 mt-1">
            {tasks.filter((t) => t.priority === "High" || t.status === "Overdue").length}
          </div>
          <div className="text-[11px] font-semibold text-red-600 mt-1">
            Immediate attention needed
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dynamic tasks..."
              className="w-full pl-9 pr-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-[#1B2559] dark:text-white focus:outline-none"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-[#1B2559] dark:text-white focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="Follow-up">Follow-up</option>
            <option value="Call">Call</option>
            <option value="Meeting">Meeting</option>
            <option value="Email">Email</option>
            <option value="Task">Task</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-[#1B2559] dark:text-white focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
            <option value="Overdue">Overdue</option>
          </select>

          <select
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
            className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-[#1B2559] dark:text-white focus:outline-none"
          >
            <option value="all">All Reps</option>
            {agentsList.map((a: any) => (
              <option key={a.id} value={a.name}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Time Tabs */}
        <div className="inline-flex rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1">
          {(["All", "Today", "This Week", "This Month"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setTimeFilter(mode)}
              className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                timeFilter === mode
                  ? "bg-[#111C44] text-white shadow-xs"
                  : "text-[#8F9CAE] hover:text-[#1B2559] dark:hover:text-white"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12 text-xs text-slate-500 font-semibold">
          <Loader2 size={18} className="animate-spin text-blue-600 mr-2" />
          Synchronizing dynamic CRM tasks and follow-up activities...
        </div>
      )}

      {/* Task List Table */}
      {!loading && (
        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-[11px] font-bold uppercase tracking-wider text-[#8F9CAE]">
                  <th className="py-3.5 px-4 w-12 text-center">Done</th>
                  <th className="py-3.5 px-5">Task Details</th>
                  <th className="py-3.5 px-5">Related To</th>
                  <th className="py-3.5 px-5">Assigned To</th>
                  <th className="py-3.5 px-5">Due Date</th>
                  <th className="py-3.5 px-5">Priority</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition ${
                      task.status === "Completed" ? "opacity-60 bg-slate-50/30" : ""
                    }`}
                  >
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => toggleTaskStatus(task.id)}
                        className="p-1 text-slate-400 hover:text-emerald-600 transition"
                      >
                        {task.status === "Completed" ? (
                          <CheckCircle2 size={18} className="text-emerald-600" />
                        ) : (
                          <Circle size={18} />
                        )}
                      </button>
                    </td>

                    <td className="py-3.5 px-5">
                      <div className={`font-bold text-[#1B2559] dark:text-white ${task.status === "Completed" ? "line-through text-slate-400" : ""}`}>
                        {task.title}
                      </div>
                      {task.description && (
                        <div className="text-[11px] text-[#8F9CAE] truncate max-w-sm mt-0.5">
                          {task.description}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-[#1B2559] dark:text-slate-200">
                        {task.related_name}
                      </div>
                      <div className="text-[10px] text-[#8F9CAE] uppercase font-bold">
                        {task.related_type}
                      </div>
                    </td>

                    <td className="py-3.5 px-5 font-medium text-[#1B2559] dark:text-slate-200">
                      {task.assigned_to}
                    </td>

                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-[#1B2559] dark:text-slate-200">
                        {task.due_date}
                      </div>
                      {task.due_time && (
                        <div className="text-[10px] text-[#8F9CAE]">{task.due_time}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold ${getPriorityBadge(task.priority)}`}>
                        {task.priority}
                      </span>
                    </td>

                    <td className="py-3.5 px-5">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${getStatusBadge(task.status)}`}>
                        {task.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-5 text-right space-x-1">
                      <button
                        onClick={() => handleOpenEdit(task)}
                        className="p-1.5 text-slate-400 hover:text-[#111C44] dark:hover:text-white transition"
                        title="Edit Task"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition"
                        title="Delete Task"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-slate-400 font-medium">
                      No tasks or follow-up activities found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-[#111C44] text-white">
              <h3 className="text-base font-extrabold tracking-tight">
                {editingTask ? "Edit Task" : "Create New Task"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title || ""}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Call Client for Contract Finalization"
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Task Type
                  </label>
                  <select
                    value={formData.type || "Call"}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as TaskType })}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-[#1B2559] dark:text-white focus:border-[#111C44] focus:outline-none"
                  >
                    <option value="Call">Call</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Email">Email</option>
                    <option value="Task">Task</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Priority
                  </label>
                  <select
                    value={formData.priority || "Medium"}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-[#1B2559] dark:text-white focus:border-[#111C44] focus:outline-none"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Related Name / Customer
                  </label>
                  <input
                    type="text"
                    value={formData.related_name || ""}
                    onChange={(e) => setFormData({ ...formData, related_name: e.target.value })}
                    placeholder="e.g. Priya Sharma"
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Assigned Agent
                  </label>
                  <select
                    value={formData.assigned_to || ""}
                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-[#1B2559] dark:text-white focus:border-[#111C44] focus:outline-none"
                  >
                    {agentsList.map((a: any) => (
                      <option key={a.id} value={a.name}>
                        {a.name}
                      </option>
                    ))}
                    {agentsList.length === 0 && <option value="Sakshi">Sakshi</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Due Date
                  </label>
                  <input
                    type="text"
                    value={formData.due_date || ""}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    placeholder="25 Sep 2026 / Tomorrow"
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status || "Pending"}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-[#1B2559] dark:text-white focus:border-[#111C44] focus:outline-none"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                  Notes / Instructions
                </label>
                <textarea
                  rows={2}
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Additional notes for the sales executive..."
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-[#1B2559] dark:text-slate-200 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-[#111C44] hover:bg-[#1E2E69] text-white px-5 py-2 text-xs font-bold shadow-md shadow-[#111C44]/20 transition"
                >
                  {editingTask ? "Save Changes" : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
