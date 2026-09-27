/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Users,
  X,
  Trash2,
  RefreshCcw,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api";

export type CalendarEvent = {
  id: string | number;
  title: string;
  type: "Meeting" | "Call" | "Follow-up" | "Proposal" | "Task" | "Field Work";
  date: string; // YYYY-MM-DD
  time: string;
  duration?: string;
  participants: string;
  location?: string;
  color: string;
  isBackend?: boolean;
  leadId?: number | string;
};

function getEventTypeColor(type: string) {
  switch (type) {
    case "Meeting":
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800";
    case "Call":
      return "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800";
    case "Follow-up":
      return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800";
    case "Proposal":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
    case "Field Work":
      return "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800";
    default:
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
  }
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDateStr(y: number, m: number, d: number) {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

export default function Calendar() {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(today.getMonth());
  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(today.getDate());
  const [view, setView] = useState<"Day" | "Week" | "Month">("Month");

  const [loading, setLoading] = useState<boolean>(true);
  const [customEvents, setCustomEvents] = useState<CalendarEvent[]>(() => {
    try {
      const saved = localStorage.getItem("crm_calendar_custom_events");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [backendEvents, setBackendEvents] = useState<CalendarEvent[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const [formData, setFormData] = useState<Partial<CalendarEvent>>({
    type: "Meeting",
    date: formatDateStr(today.getFullYear(), today.getMonth(), today.getDate()),
    time: "10:00 AM",
  });

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Dynamic calculations for the calendar month
  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonthIndex + 1, 0).getDate();
  }, [currentYear, currentMonthIndex]);

  const startDayOffset = useMemo(() => {
    return new Date(currentYear, currentMonthIndex, 1).getDay();
  }, [currentYear, currentMonthIndex]);

  const prevMonthDays = useMemo(() => {
    return new Date(currentYear, currentMonthIndex, 0).getDate();
  }, [currentYear, currentMonthIndex]);

  // Load backend data (Follow-ups, Field-works, Reminders)
  const fetchBackendData = useCallback(async () => {
    setLoading(true);
    try {
      const [followupsRes, fieldWorksRes, remindersRes] = await Promise.allSettled([
        api.getAllFollowups({ page: 1, limit: 50000 }),
        api.getAllFieldWorks({ limit: 5000 }),
        api.getReminderAlerts(),
      ]);

      const eventsList: CalendarEvent[] = [];

      // 1. Followups
      if (followupsRes.status === "fulfilled" && followupsRes.value) {
        const raw = Array.isArray(followupsRes.value)
          ? followupsRes.value
          : (followupsRes.value as any)?.data || [];

        raw.forEach((f: any) => {
          const rawDate = f?.followup_date || f?.date || f?.created_at;
          if (!rawDate) return;
          const d = new Date(rawDate);
          if (isNaN(d.getTime())) return;

          const dateFormatted = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
          const leadName = f?.lead?.name || f?.lead?.lead_name || f?.lead_name || `Lead #${f?.lead_id || ""}`;
          const agentName = f?.changedBy?.name || f?.agent?.name || "Agent";

          eventsList.push({
            id: `followup-${f.id}`,
            title: `Follow-up: ${leadName}`,
            type: "Follow-up",
            date: dateFormatted,
            time: f?.followup_time || "11:00 AM",
            duration: "30 min",
            participants: `${leadName}, ${agentName}`,
            location: f?.remark || "Phone Call",
            color: getEventTypeColor("Follow-up"),
            isBackend: true,
            leadId: f?.lead_id,
          });
        });
      }

      // 2. Field Works
      if (fieldWorksRes.status === "fulfilled" && fieldWorksRes.value) {
        const raw = Array.isArray(fieldWorksRes.value)
          ? fieldWorksRes.value
          : (fieldWorksRes.value as any)?.data || [];

        raw.forEach((fw: any) => {
          const rawDate = fw?.createdAt || fw?.created_at || fw?.date;
          if (!rawDate) return;
          const d = new Date(rawDate);
          if (isNaN(d.getTime())) return;

          const dateFormatted = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
          const leadName = fw?.lead?.name || fw?.number || `Field Work #${fw.id}`;

          eventsList.push({
            id: `fw-${fw.id}`,
            title: `Field Work: ${leadName}`,
            type: "Field Work",
            date: dateFormatted,
            time: "10:00 AM",
            duration: fw?.days ? `${fw.days} Days` : "1 Day",
            participants: `${leadName}`,
            location: fw?.remarks || "On-site Visit",
            color: getEventTypeColor("Field Work"),
            isBackend: true,
            leadId: fw?.lead_id,
          });
        });
      }

      // 3. Reminders
      if (remindersRes.status === "fulfilled" && remindersRes.value) {
        const raw = Array.isArray(remindersRes.value)
          ? remindersRes.value
          : (remindersRes.value as any)?.data || [];

        raw.forEach((r: any) => {
          const rawDate = r?.followup_date || r?.created_at;
          if (!rawDate) return;
          const d = new Date(rawDate);
          if (isNaN(d.getTime())) return;

          const dateFormatted = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
          const leadName = r?.lead?.name || `Lead #${r?.lead_id || ""}`;

          eventsList.push({
            id: `reminder-${r.id}`,
            title: `Reminder: ${leadName}`,
            type: "Call",
            date: dateFormatted,
            time: r?.followup_time || "02:00 PM",
            duration: "15 min",
            participants: leadName,
            location: r?.remark || "Reminder Call",
            color: getEventTypeColor("Call"),
            isBackend: true,
            leadId: r?.lead_id,
          });
        });
      }

      setBackendEvents(eventsList);
    } catch (err: any) {
      console.error("Error fetching calendar data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackendData();
  }, [fetchBackendData]);

  // Combined all events
  const allEvents = useMemo(() => {
    return [...backendEvents, ...customEvents];
  }, [backendEvents, customEvents]);

  const saveCustomEvents = (updated: CalendarEvent[]) => {
    setCustomEvents(updated);
    try {
      localStorage.setItem("crm_calendar_custom_events", JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrevMonth = () => {
    if (currentMonthIndex === 0) {
      setCurrentMonthIndex(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonthIndex((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonthIndex === 11) {
      setCurrentMonthIndex(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonthIndex((prev) => prev + 1);
    }
  };

  const handleToday = () => {
    const n = new Date();
    setCurrentYear(n.getFullYear());
    setCurrentMonthIndex(n.getMonth());
    setSelectedDayNumber(n.getDate());
  };

  const handleOpenAdd = (dayNumber?: number) => {
    setSelectedEvent(null);
    const day = dayNumber || selectedDayNumber || today.getDate();
    const dateStr = formatDateStr(currentYear, currentMonthIndex, day);
    setFormData({
      title: "",
      type: "Meeting",
      date: dateStr,
      time: "10:00 AM",
      duration: "30 min",
      participants: "",
      location: "Google Meet",
    });
    setModalOpen(true);
  };

  const handleOpenEvent = (ev: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(ev);
    setFormData(ev);
    setModalOpen(true);
  };

  const handleDeleteEvent = () => {
    if (selectedEvent) {
      if (selectedEvent.isBackend) {
        toast.error("Backend synchronized records cannot be deleted from calendar view");
        return;
      }
      const updated = customEvents.filter((e) => e.id !== selectedEvent.id);
      saveCustomEvents(updated);
      toast.success("Event deleted");
      setModalOpen(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
      toast.error("Please enter event title");
      return;
    }

    const type = formData.type || "Meeting";
    const color = getEventTypeColor(type);

    if (selectedEvent) {
      if (selectedEvent.isBackend) {
        toast.error("This event is automatically synced from CRM followups/field-works");
        setModalOpen(false);
        return;
      }
      const updated = customEvents.map((ev) =>
        ev.id === selectedEvent.id
          ? ({
              ...ev,
              ...formData,
              color,
            } as CalendarEvent)
          : ev
      );
      saveCustomEvents(updated);
      toast.success("Event updated");
    } else {
      const newEv: CalendarEvent = {
        id: `custom-${Date.now()}`,
        title: formData.title || "",
        type: (formData.type as any) || "Meeting",
        date: formData.date || formatDateStr(currentYear, currentMonthIndex, selectedDayNumber),
        time: formData.time || "10:00 AM",
        duration: formData.duration || "30 min",
        participants: formData.participants || "Team",
        location: formData.location || "Online",
        color,
      };
      saveCustomEvents([...customEvents, newEv]);
      toast.success("Event scheduled successfully");
    }
    setModalOpen(false);
  };

  // Check if a date matches today's real date
  const isRealToday = (dayNum: number) => {
    const n = new Date();
    return (
      n.getFullYear() === currentYear &&
      n.getMonth() === currentMonthIndex &&
      n.getDate() === dayNum
    );
  };

  // Day View data
  const selectedDateStr = formatDateStr(currentYear, currentMonthIndex, selectedDayNumber);
  const dayEvents = useMemo(() => {
    return allEvents.filter((e) => e.date === selectedDateStr);
  }, [allEvents, selectedDateStr]);

  // Week View data
  const weekDays = useMemo(() => {
    const centerDate = new Date(currentYear, currentMonthIndex, selectedDayNumber);
    const dayOfWeek = centerDate.getDay();
    const startOfWeek = new Date(centerDate);
    startOfWeek.setDate(centerDate.getDate() - dayOfWeek);

    return Array.from({ length: 7 }).map((_, i) => {
      const cur = new Date(startOfWeek);
      cur.setDate(startOfWeek.getDate() + i);
      const dateKey = `${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}-${pad2(cur.getDate())}`;
      return {
        dateObj: cur,
        dayNum: cur.getDate(),
        monthName: months[cur.getMonth()],
        dayName: daysOfWeek[cur.getDay()],
        dateKey,
        isToday:
          cur.getFullYear() === today.getFullYear() &&
          cur.getMonth() === today.getMonth() &&
          cur.getDate() === today.getDate(),
        events: allEvents.filter((e) => e.date === dateKey),
      };
    });
  }, [currentYear, currentMonthIndex, selectedDayNumber, allEvents, months, daysOfWeek, today]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1B2559] dark:text-white tracking-tight flex items-center gap-2.5">
            <CalendarIcon className="text-blue-600" size={24} />
            Calendar & Schedules
          </h1>
          <p className="text-xs font-medium text-[#8F9CAE] mt-0.5">
            Dynamic live view of customer demos, follow-up calls, reminders, and field milestones.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchBackendData()}
            disabled={loading}
            className="p-2 rounded-md border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-[#1B2559] dark:text-white hover:bg-slate-50 transition"
            title="Refresh events from CRM"
          >
            <RefreshCcw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
          </button>

          {/* Day / Week / Month toggle */}
          <div className="inline-flex rounded-md border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 shadow-xs">
            {(["Day", "Week", "Month"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setView(mode)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                  view === mode
                    ? "bg-[#111C44] text-white shadow-xs"
                    : "text-[#8F9CAE] hover:text-[#1B2559] dark:hover:text-white"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <button
            onClick={() => handleOpenAdd(selectedDayNumber)}
            className="inline-flex items-center gap-2 rounded-md bg-[#111C44] hover:bg-[#1E2E69] text-white px-4 py-2 text-xs font-bold shadow-md shadow-[#111C44]/20 transition"
          >
            <Plus size={16} />
            Add Event
          </button>
        </div>
      </div>

      {/* Calendar Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-[#1B2559] dark:text-white hover:bg-slate-100 transition shadow-2xs"
          >
            Today
          </button>
          <div className="flex items-center rounded-md border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5 shadow-2xs">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-[#1B2559] dark:text-white transition"
              title="Previous Month"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-[#1B2559] dark:text-white transition"
              title="Next Month"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <h2 className="text-base sm:text-lg font-extrabold text-[#1B2559] dark:text-white tracking-tight">
          {months[currentMonthIndex]} {currentYear}
        </h2>

        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-[#8F9CAE]">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> Follow-up
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> Call
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" /> Field Work
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Meeting
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Proposal
          </span>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-8 rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-500">
          <Loader2 size={18} className="animate-spin text-blue-600 mr-2" />
          Loading dynamic schedules and follow-up activities...
        </div>
      )}

      {/* VIEW: MONTH */}
      {!loading && view === "Month" && (
        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-center text-xs font-bold text-[#8F9CAE] py-3">
            {daysOfWeek.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 dark:divide-slate-800">
            {/* Trailing days from previous month */}
            {Array.from({ length: startDayOffset }).map((_, i) => (
              <div
                key={`prev-${i}`}
                className="min-h-[110px] p-2 bg-slate-50/30 dark:bg-slate-900/20 text-slate-300 dark:text-slate-600 text-xs font-semibold"
              >
                {prevMonthDays - startDayOffset + i + 1}
              </div>
            ))}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = formatDateStr(currentYear, currentMonthIndex, dayNum);
              const dayEvs = allEvents.filter((e) => e.date === dateStr);
              const isToday = isRealToday(dayNum);
              const isSelected = selectedDayNumber === dayNum;

              return (
                <div
                  key={dayNum}
                  onClick={() => {
                    setSelectedDayNumber(dayNum);
                  }}
                  onDoubleClick={() => handleOpenAdd(dayNum)}
                  className={`min-h-[120px] p-2 transition cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 relative group ${
                    isToday
                      ? "bg-blue-50/30 dark:bg-blue-950/20"
                      : isSelected
                      ? "bg-slate-50/60 dark:bg-slate-800/30 ring-1 ring-blue-500/30 inset-0"
                      : "bg-white dark:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`inline-flex items-center justify-center h-6 w-6 text-xs font-extrabold rounded-full ${
                        isToday
                          ? "bg-[#111C44] text-white shadow-xs"
                          : "text-[#1B2559] dark:text-slate-300"
                      }`}
                    >
                      {dayNum}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenAdd(dayNum);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-[#111C44] dark:hover:text-white transition"
                      title="Schedule event on this day"
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  {/* Events list inside cell */}
                  <div className="space-y-1">
                    {dayEvs.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        onClick={(e) => handleOpenEvent(ev, e)}
                        className={`text-[11px] font-bold px-2 py-1 rounded-md border truncate transition hover:scale-[1.02] shadow-2xs cursor-pointer ${ev.color}`}
                        title={`${ev.time} - ${ev.title} (${ev.participants || ""})`}
                      >
                        <span className="font-extrabold mr-1">{ev.time}</span>
                        {ev.title}
                      </div>
                    ))}
                    {dayEvs.length > 3 && (
                      <div className="text-[10px] font-bold text-slate-400 px-1">
                        +{dayEvs.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Leading days into next month */}
            {Array.from({ length: (7 - ((daysInMonth + startDayOffset) % 7)) % 7 }).map((_, i) => (
              <div
                key={`next-${i}`}
                className="min-h-[110px] p-2 bg-slate-50/30 dark:bg-slate-900/20 text-slate-300 dark:text-slate-600 text-xs font-semibold"
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW: WEEK */}
      {!loading && view === "Week" && (
        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="grid grid-cols-7 divide-x divide-slate-200/80 dark:divide-slate-800">
            {weekDays.map((col) => (
              <div key={col.dateKey} className="min-h-[450px] flex flex-col">
                <div
                  className={`p-3 text-center border-b border-slate-200/80 dark:border-slate-800 ${
                    col.isToday
                      ? "bg-blue-50/60 dark:bg-blue-950/40"
                      : "bg-slate-50/75 dark:bg-slate-800/40"
                  }`}
                >
                  <div className="text-[11px] font-bold text-[#8F9CAE] uppercase">{col.dayName}</div>
                  <div
                    className={`inline-flex items-center justify-center h-7 w-7 text-xs font-extrabold rounded-full mt-1 ${
                      col.isToday
                        ? "bg-[#111C44] text-white shadow-xs"
                        : "text-[#1B2559] dark:text-white"
                    }`}
                  >
                    {col.dayNum}
                  </div>
                </div>

                <div className="flex-1 p-2 space-y-2 bg-white dark:bg-slate-900">
                  {col.events.map((ev) => (
                    <div
                      key={ev.id}
                      onClick={(e) => handleOpenEvent(ev, e)}
                      className={`p-2.5 rounded-md border text-xs font-semibold transition cursor-pointer hover:shadow-md ${ev.color}`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-extrabold mb-1">
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {ev.time}
                        </span>
                        <span>{ev.type}</span>
                      </div>
                      <div className="font-bold line-clamp-2">{ev.title}</div>
                      {ev.participants && (
                        <div className="text-[10px] opacity-80 mt-1 truncate">
                          {ev.participants}
                        </div>
                      )}
                    </div>
                  ))}

                  <button
                    onClick={() => handleOpenAdd(col.dayNum)}
                    className="w-full py-2 border border-dashed border-slate-200 dark:border-slate-700 rounded-md text-[11px] font-bold text-slate-400 hover:text-blue-600 hover:border-blue-400 transition flex items-center justify-center gap-1 mt-2"
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW: DAY */}
      {!loading && view === "Day" && (
        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs p-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
            <div>
              <h3 className="text-lg font-extrabold text-[#1B2559] dark:text-white">
                {selectedDayNumber} {months[currentMonthIndex]} {currentYear}
              </h3>
              <p className="text-xs text-[#8F9CAE] mt-0.5">
                {dayEvents.length} events and follow-up activities scheduled for this day.
              </p>
            </div>
            <button
              onClick={() => handleOpenAdd(selectedDayNumber)}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#111C44] text-white px-3.5 py-1.5 text-xs font-bold"
            >
              <Plus size={14} /> Add Event
            </button>
          </div>

          {dayEvents.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-medium">
              No tasks or events scheduled for this day.
            </div>
          ) : (
            <div className="space-y-3">
              {dayEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={(e) => handleOpenEvent(ev, e)}
                  className={`p-4 rounded-md border flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:shadow-md transition ${ev.color}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-white/60 dark:bg-black/30">
                        {ev.time}
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-wide">
                        {ev.type}
                      </span>
                    </div>
                    <div className="text-sm font-extrabold">{ev.title}</div>
                    {ev.participants && (
                      <div className="text-xs opacity-90 flex items-center gap-1">
                        <Users size={12} /> {ev.participants}
                      </div>
                    )}
                  </div>

                  <div className="text-xs font-semibold flex items-center gap-2">
                    {ev.location && (
                      <span className="inline-flex items-center gap-1 bg-white/60 dark:bg-black/20 px-2.5 py-1 rounded-md">
                        <MapPin size={12} /> {ev.location}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Event Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-[#111C44] text-white">
              <h3 className="text-base font-extrabold tracking-tight">
                {selectedEvent ? (selectedEvent.isBackend ? "Activity Details" : "Edit Event") : "Schedule New Event"}
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
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  disabled={selectedEvent?.isBackend}
                  value={formData.title || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="e.g. Demo Call with Client"
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none disabled:opacity-60"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Event Type
                  </label>
                  <select
                    disabled={selectedEvent?.isBackend}
                    value={formData.type || "Meeting"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        type: e.target.value as CalendarEvent["type"],
                      })
                    }
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-[#1B2559] dark:text-white focus:border-[#111C44] focus:outline-none disabled:opacity-60"
                  >
                    <option value="Meeting">Meeting</option>
                    <option value="Call">Call</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Proposal">Proposal</option>
                    <option value="Field Work">Field Work</option>
                    <option value="Task">Task</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    disabled={selectedEvent?.isBackend}
                    value={formData.date || formatDateStr(currentYear, currentMonthIndex, selectedDayNumber)}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Time
                  </label>
                  <input
                    type="text"
                    disabled={selectedEvent?.isBackend}
                    value={formData.time || "10:00 AM"}
                    onChange={(e) =>
                      setFormData({ ...formData, time: e.target.value })
                    }
                    placeholder="10:00 AM"
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    disabled={selectedEvent?.isBackend}
                    value={formData.duration || "30 min"}
                    onChange={(e) =>
                      setFormData({ ...formData, duration: e.target.value })
                    }
                    placeholder="30 min / 1 hr"
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                  Participants / Client
                </label>
                <input
                  type="text"
                  disabled={selectedEvent?.isBackend}
                  value={formData.participants || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, participants: e.target.value })
                  }
                  placeholder="e.g. Priya Sharma, Sakshi"
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                  Location / Conference Link / Note
                </label>
                <input
                  type="text"
                  disabled={selectedEvent?.isBackend}
                  value={formData.location || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  placeholder="https://meet.google.com/xyz or Office"
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none disabled:opacity-60"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                {selectedEvent && !selectedEvent.isBackend ? (
                  <button
                    type="button"
                    onClick={handleDeleteEvent}
                    className="inline-flex items-center gap-1.5 rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3.5 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-100 transition"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-[#1B2559] dark:text-slate-200 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  {!selectedEvent?.isBackend && (
                    <button
                      type="submit"
                      className="rounded-md bg-[#111C44] hover:bg-[#1E2E69] text-white px-5 py-2 text-xs font-bold shadow-md shadow-[#111C44]/20 transition"
                    >
                      {selectedEvent ? "Save Changes" : "Create Event"}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
