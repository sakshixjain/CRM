const KEY = "crm_token";
const COMPANY_KEY = "company_id";

export const storage = {
  getToken(): string | null {
    return localStorage.getItem(KEY);
  },
  setToken(token: string) {
    localStorage.setItem(KEY, token);
  },
  clearToken() {
    localStorage.removeItem(KEY);
  },
  getCompanyId(): string | null {
    return localStorage.getItem(COMPANY_KEY);
  },

  setCompanyId(companyId: string | number) {
    localStorage.setItem(COMPANY_KEY, String(companyId));
  },

  clearCompanyId() {
    localStorage.removeItem(COMPANY_KEY);
  },
};
