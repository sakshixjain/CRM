import { storage } from "./storage";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

function buildQS(params?: Record<string, any>) {
  if (!params) return "";
  const qs = new URLSearchParams();

  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    const val = String(v).trim();
    if (!val) return;
    qs.append(k, val);
  });

  const str = qs.toString();
  return str ? `?${str}` : "";
}

async function request<T>(path: string, method: Method, body?: any): Promise<T> {
  const token = storage.getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    // credentials: "include",
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new Error(
      data?.message || data?.error || res.statusText || "Request failed"
    );
  }

  return data as T;
}

export const api = {
  // Auth
  async login(payload: { email: string; password: string }) {
    const res = await request<any>("/login", "POST", {
      email: payload.email,
      password: payload.password,
    });

    return { token: res.accessToken || res.token, user: res.user };
  },

// ✅ Send OTP (same /login endpoint)
async sendOtp(payload: { email: string; password: string }) {
  return request<{ success: boolean; message: string }>(
    "/login",
    "POST",
    {
      action: "send_otp",
      email: payload.email,
      password: payload.password,
    }
  );
},

// ✅ Verify OTP (same /login endpoint)
async verifyOtp(payload: { email: string; otp: string }) {
  return request<{
    success: boolean;
    message: string;
    verification_expire_at?: string;
  }>(
    "/login",
    "POST",
    {
      action: "verify_otp",
      email: payload.email,
      otp: payload.otp,
    }
  );
},



  // ✅ NEW: Forgot Password (Send Reset OTP)
async forgotPassword(payload: { email: string }) {
  // route: POST /forgot-password
  return request<{ success: boolean; message: string }>(
    "/forgot-password",
    "POST",
    payload
  );
},
// ✅ NEW: Reset Password
async resetPassword(payload: {
   token: string; 
  newPassword: string;
  confirmPassword: string;
}) {
  // route: POST /reset-password
  return request<{ success: boolean; message: string }>(
    "/reset-password",
    "POST",
    payload
  );
},


async signup(payload: {
  name: string;
  email: string;
  contact_no: string;
  company_name: string;
}) {
  const res = await request<any>("/signup", "POST", payload);
  return {
    token: res.accessToken || res.token,
    user: res.user,
  };
},
    async logout(payload?: { allDevices: boolean }) {
    return request<{ success: boolean }>("/logout", "POST", payload);
  },
  
  me() {
    return request<{ user: any }>("/me", "GET");
  },

    // Global Search
  search(q: string) {
  return request<{ success: boolean; query: string; results: any }>(
    `/api/search?q=${encodeURIComponent(q)}`,
    "GET"
  );
},
changePassword(payload: { newPassword: string; confirmPassword: string }) {
  return request<{ success: boolean; message?: string }>(
    "/change-password",
    "PATCH",
    payload
  );
},

addLeadFollowup(
  leadId: number,
  payload: {
    followup_date: string; // "YYYY-MM-DD"
    followup_time: string; // "HH:mm" or "HH:mm:ss"
    status_id?: number | null;
    remark?: string;
  }
) {
  return request<{ success: boolean; followup: any; message?: string }>(
    `/api/leads/followup/${leadId}`,
    "POST",
    payload
  );
},
// ✅ fixed
getAllFollowups(params?: Record<string, any>) {
  const qs = params
    ? "?" +
      new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null && v !== "")
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : "";

  return request<{ success: boolean; data: any[] }>(
    `/api/lead/followup${qs}`,
    "GET"
  );
},
getReminderAlerts() {
  return request<{ success: boolean; data: any[] }>(
    "/api/lead/reminder-alerts",
    "GET"
  );
},
getPaymentDurationReminderAlerts() {
  return request<{ success: boolean; data: any[] }>(
    "/api/payment/duration-reminders",
    "GET"
  );
},
updateFollowup(followupId: number, payload: {
  followup_date?: string;
  followup_time?: string;
  status_id?: number | null;
  remark?: string;
}) {
  return request<{ success: boolean; followup: any; message?: string }>(
    `/api/lead/followup/${followupId}`,
    "PUT",
    payload
  );
},

deleteFollowup(followupId: number) {
  return request<{ success: boolean; message?: string }>(
    `/api/lead/followup/${followupId}`,
    "DELETE"
  );
},
getLeadFollowups(leadId: number) {
  return request<{ success: boolean; data: any[]; message?: string }>(
    `/api/leads/followup/${leadId}`,
    "GET"
  );
},

// GET ALL COMPANIES
getCompanies() {
  return request<{ success: boolean; data: any[]; message?: string }>(
    `/api/company-details`,
    "GET"
  );
},

// GET COMPANY BY ID
getCompany(id: number | string) {
  return request<{ success: boolean; data: any; message?: string }>(
    `/api/company-details/${id}`,
    "GET"
  );
},

// CREATE COMPANY
createCompany(data: {
  company_name: string;
  email: string;
  phone?: string;
  db_name: string;
  is_active?: boolean;
}) {
  return request<{ success: boolean; data: any; message?: string }>(
    `/api/company-details`,
    "POST",
    data
  );
},

// UPDATE COMPANY
updateCompany(
  id: number | string,
  data: {
    company_name?: string;
    email?: string;
    phone?: string;
    db_name?: string;
    is_active?: boolean;
  }
) {
  return request<{ success: boolean; data: any; message?: string }>(
    `/api/company-details/${id}`,
    "PUT",
    data
  );
},

// DELETE COMPANY
deleteCompany(id: number | string) {
  return request<{ success: boolean; message?: string }>(
    `/api/company-details/${id}`,
    "DELETE"
  );
},

  // LeLads API
  leads: {
    create(payload: any) {
      return request<{ success: boolean; data: any; message?: string }>(
        "/api/leads",
        "POST",
        payload
      );
    },

    list(params?: Record<string, any>) {
      return request<{ success: boolean; data: any[]; pagination?: any }>(
        `/api/leads${buildQS(params)}`,
        "GET"
      );
    },

    changedByOptions() {
      return request<{ success: boolean; data: any[] }>(
        "/api/leads/changed-by",
        "GET"
      ).catch(() =>
        request<{ success: boolean; data: any[] }>(
          "/api/leads/changed-by-options",
          "GET"
        )
      );
    },

    get(id: number | string) {
      return request<{ success: boolean; data: any }>(`/api/leads/${id}`, "GET");
    },

    update(id: number | string, payload: any) {
      return request<{ success: boolean; data: any; message?: string }>(
        `/api/leads/${id}`,
        "PUT",
        payload
      );
    },

    remove(id: number | string) {
      return request<{ success: boolean; message?: string }>(
        `/api/leads/${id}`,
        "DELETE"
      );
    },

    deactivate(id: number | string) {
      return request<{ success: boolean; data?: any; message?: string }>(
        `/api/leads/${id}/deactivate`,
        "PATCH"
      );
    },


    bulkDelete(body: { leadIds: Array<number | string> }) {
      return request<{ success: boolean; deletedCount?: number; message?: string }>(
        `/api/leads/bulk/delete`,
        "DELETE",
        body
      );
    },

    stats() {
      return request<{ success: boolean; data: any }>(`/api/leads/stats`, "GET");
    },
  },

  // Lead Source API
  leadSource: {
    list(params?: Record<string, any>) {
      return request<{ success: boolean; data: any[]; pagination?: any }>(
        `/api/lead-source${buildQS(params)}`,
        "GET"
      );
    },
    update(id: number | string, payload: any) {
      return request<{ success: boolean; data: any; message?: string }>(
        `/api/lead-source/${id}`,
        "PUT",
        payload
      );
    },
    create(payload: any) {
      return request<{ success: boolean; data: any; message?: string }>(
        `/api/lead-source`,
        "POST",
        payload
      );
    },
    remove(id: number | string) {
      return request<{ success: boolean; message?: string }>(
        `/api/lead-source/${id}`,
        "DELETE"
      );
    },
  },

  leadPayment: {
    list(params?: Record<string, any>) {
      return request<{ success: boolean; data: any[]; pagination?: any }>(
        `/api/payment${buildQS(params)}`,
        "GET"
      );
    },
    create(payload: any) {
      return request<{ success: boolean; data: any; message?: string }>(
        `/api/payment`,
        "POST",
        payload
      );
    },
    remove(id: number | string) {
      return request<{ success: boolean; message?: string }>(
        `/api/payment/${id}`,
        "DELETE"
      );
    },
    update(id: number | string, payload: any) {
      return request<{ success: boolean; data: any; message?: string }>(
        `/api/payment/${id}`,
        "PUT",
        payload
      );
    },
  },

  listLeadPayments(params?: Record<string, any>) {
    return this.leadPayment.list(params).then((r) => r.data || []);
  },
  createLeadPayment(payload: any) {
    return this.leadPayment.create(payload);
  },
  removeLeadPayment(id: number | string) {
    return this.leadPayment.remove(id);
  },
  updateLeadPayment(id: number | string, payload: any) {
    return this.leadPayment.update(id, payload);
  },

  listLeadSource() {
    return this.leadSource.list().then((r) => r.data || []);
  },
  createLeadSource(payload: any) {
    return this.leadSource.create(payload);
  },
  updateLeadSource(id: number | string, payload: any) {
    return this.leadSource.update(id, payload);
  },
  removeLeadSource(id: number | string) {
    return this.leadSource.remove(id);
  },

  // Lead Status API
  leadStatus: {
    list(params?: Record<string, any>) {
      return request<{ success: boolean; data: any[]; pagination?: any }>(
        `/api/lead-status${buildQS(params)}`,
        "GET"
      );
    },
    create(payload: any) {
      return request<{ success: boolean; data: any; message?: string }>(
        `/api/lead-status`,
        "POST",
        payload
      );
    },

    update(id: number | string, payload: any) {
      return request<{ success: boolean; data: any; message?: string }>(
        `/api/lead-status/${id}`,
        "PUT",
        payload
      );
    },
    remove(id: number | string) {
      return request<{ success: boolean; message?: string }>(
        `/api/lead-status/${id}`,
        "DELETE"
      );
    },
  },

  listLeadStatus() {
    return this.leadStatus.list().then((r) => r.data || []);
  },
  createLeadStatus(payload: any) {
    return this.leadStatus.create(payload);
  },
  removeLeadStatus(id: number | string) {
    return this.leadStatus.remove(id);
  },
  updateLeadStatus(id: number | string, payload: any) {
    return this.leadStatus.update(id, payload);
  },

  quotationServices: {
    list(params?: Record<string, any>) {
      return request<{ success: boolean; data: any[]; pagination?: any }>(
        `/api/quotation-services${buildQS(params)}`,
        "GET"
      );
    },
    get(id: number | string) {
      return request<{ success: boolean; data: any }>(
        `/api/quotation-services/${id}`,
        "GET"
      );
    },
    create(payload: any) {
      return request<{ success: boolean; data: any; message?: string }>(
        `/api/quotation-services`,
        "POST",
        payload
      );
    },
    update(id: number | string, payload: any) {
      return request<{ success: boolean; data: any; message?: string }>(
        `/api/quotation-services/${id}`,
        "PUT",
        payload
      );
    },
    remove(id: number | string) {
      return request<{ success: boolean; message?: string }>(
        `/api/quotation-services/${id}`,
        "DELETE"
      );
    },
  },

  listQuotationServices(params?: Record<string, any>) {
    return this.quotationServices.list(params).then((r) => r.data || []);
  },

  quotations: {
    list(params?: Record<string, any>) {
      return request<{ success: boolean; data: any[]; pagination?: any }>(
        `/api/quotations${buildQS(params)}`,
        "GET"
      );
    },
    get(id: number | string) {
      return request<{ success: boolean; data: any }>(
        `/api/quotations/${id}`,
        "GET"
      );
    },
    create(payload: any) {
      return request<{ success: boolean; data: any; message?: string }>(
        `/api/quotations`,
        "POST",
        payload
      );
    },
    update(id: number | string, payload: any) {
      return request<{ success: boolean; data: any; message?: string }>(
        `/api/quotations/${id}`,
        "PUT",
        payload
      );
    },
  },

  listQuotations(params?: Record<string, any>) {
    return this.quotations.list(params);
  },
  getQuotation(id: number | string) {
    return this.quotations.get(id).then((r) => r.data);
  },
  createQuotation(payload: any) {
    return this.quotations.create(payload);
  },
  updateQuotation(id: number | string, payload: any) {
    return this.quotations.update(id, payload);
  },

// Field Work APIs

searchLeadsForFieldWork(search: string) {
  return request<{ success: boolean; data: any[]; pagination?: any }>(
    `/api/leads${buildQS({ search, limit: 10 })}`,
    "GET"
  );
},

getAllFieldWorks(params?: Record<string, any>) {
  return request<{ success: boolean; data: any[] }>(
    `/api/field-works${buildQS(params)}`,
    "GET"
  );
},

getFieldWorkById(id: number | string) {
  return request<{ success: boolean; data: any }>(
    `/api/field-works/${id}`,
    "GET"
  );
},

createFieldWork(payload: any) {
  return request<{ success: boolean; data: any; message?: string }>(
    "/api/field-works",
    "POST",
    payload
  );
},

updateFieldWork(id: number | string, payload: any) {
  return request<{ success: boolean; data: any; message?: string }>(
    `/api/field-works/${id}`,
    "PUT",
    payload
  );
},

deleteFieldWork(id: number | string) {
  return request<{ success: boolean; message?: string }>(
    `/api/field-works/${id}`,
    "DELETE"
  );
},

  // Agent API
  listAgents() {
    return request<{ success: boolean; data: any[] }>(`/api/user-agent`, "GET").then(
      (r) => r.data || []
    );
  },

// Agent API
listAgentById(id: number | string) {
  return request<any>(`/api/user-agent/${id}`, "GET")
    .then((r) => r.data || []);
},
  createAgent(payload: {
    name: string;
    contact_no: string;
    email: string;
  
    role_id: number;
    is_active:boolean;
  }) {
    return request<any>(`/api/user-agent`, "POST", payload);
  },
  updateAgent(id: number | string, payload: any) {
    return request<any>(`/api/user-agent/${id}`, "PUT", payload);
  },



  removeAgent(
    id: number | string,
    payload?: { reassign_to?: number }
  ) {
    return request<{ 
      success: boolean; 
      message?: string; 
      leadsCount?: number 
    }>(
      payload?.reassign_to
        ? `/api/user-agent/${id}?reassign_to=${payload.reassign_to}` // ✅ safest way
        : `/api/user-agent/${id}`,
      "DELETE"
    );
  },
  // User Role API
  listUserRoles() {
    return request<{ success: boolean; data: any[] }>(`/api/user-role`, "GET").then(
      (r) => r.data || []
    );
  },
  createUserRole(payload: { role: string }) {
    return request<any>(`/api/user-role`, "POST", payload);
  },
  deleteUserRole(id: number | string) {
    return request<any>(`/api/user-role/${id}`, "DELETE");
  },

  activity: {
    startSession(payload: {
      userId?: number | string;
      sessionId: string;
      loginAt: string;
      currentPath?: string;
      userAgent?: string;
      openTabs?: number;
      meta?: Record<string, any>;
    }) {
      return request<{ success: boolean; data: any; message?: string }>(
        `/api/activity/session/start`,
        "POST",
        payload
      );
    },
    heartbeat(payload: {
      userId?: number | string;
      sessionId: string;
      tabId: string;
      sentAt: string;
      isFinal?: boolean;
      payload: Record<string, any>;
    }) {
      return request<{ success: boolean; data: any; message?: string }>(
        `/api/activity/heartbeat`,
        "POST",
        payload
      );
    },
    endSession(payload: {
      userId?: number | string;
      sessionId: string;
      logoutAt?: string;
    }) {
      return request<{ success: boolean; data: any; message?: string }>(
        `/api/activity/session/end`,
        "POST",
        payload
      );
    },
    live(params?: { minutes?: number }) {
      return request<{ success: boolean; data: any[]; message?: string }>(
        `/api/activity/live${buildQS(params)}`,
        "GET"
      );
    },
    userSessions(userId: number | string, params?: { limit?: number }) {
      return request<{ success: boolean; data: any[]; message?: string }>(
        `/api/activity/user/${userId}/sessions${buildQS(params)}`,
        "GET"
      );
    },
    sessionDetails(sessionId: string) {
      return request<{
        success: boolean;
        data: {
          session: any;
          pageStats: any[];
          eventBatches: any[];
        };
        message?: string;
      }>(`/api/activity/session/${sessionId}`, "GET");
    },
    closeStaleSessions(payload?: { staleMinutes?: number }) {
      return request<{
        success: boolean;
        affectedCount?: number;
        message?: string;
      }>(`/api/activity/mark-stale-closed`, "POST", payload);
    },
  },

  // Generic CRUD
  list<T>(resource: string) {
    return request<T[]>(`/api/${resource}`, "GET");
  },
  create<T>(resource: string, payload: any) {
    return request<T>(`/api/${resource}`, "POST", payload);
  },
  update<T>(resource: string, id: number | string, payload: any) {
    return request<T>(`/api/${resource}/${id}`, "PUT", payload);
  },
  remove(resource: string, id: number | string) {
    return request<{ success: boolean }>(`/api/${resource}/${id}`, "DELETE");
  },

  // ✅ Correct download + import urls (matches your backend routes)
  urls: {
    leadDummySheet: "/api/import/dummy-sheet",
  },

  // ✅ Multipart upload for file import
  async postMultipart(path: string, formData: FormData) {
    const token = storage.getToken();

    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    // ❗ Do NOT set Content-Type for FormData

    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: formData,
    });

    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }

    if (!res.ok) {
      throw new Error(
        data?.message || data?.error || res.statusText || "Request failed"
      );
    }

    return data;
  },
};


