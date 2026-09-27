import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import PageHeader from "../pages/Header";
import toast from "react-hot-toast";
import { useParams } from "react-router-dom";

import {
  X,
  Loader2,
  RefreshCcw,
  Building2,
  Pencil,
  Mail,
  Phone,
  Globe,
  MapPin,
  Image as ImageIcon,
  BadgeCheck,
  BadgeX,
} from "lucide-react";

type Company = {
  id?: number | string;
  company_name: string;
  email: string;
  contact_no?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  logo_url?: string;
  db_name: string;
  is_active?: boolean;
  createdAt?: string;
};

function cn(...cls: Array<string | boolean | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

function Modal({
  open,
  title,
  subtitle,
  children,
  onClose,
  onSubmit,
  submitText,
  busy,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  submitText: string;
  busy?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative flex max-h-[calc(100vh-32px)] w-full max-w-2xl flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl">
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <div className="text-xl font-semibold tracking-tight text-slate-900">
              {title}
            </div>
            {subtitle && (
              <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
            )}
          </div>

          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            title="Close"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>

        <div className="shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            type="button"
          >
            Cancel
          </button>

          <button
            disabled={busy}
            onClick={onSubmit}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {submitText}
          </button>
        </div>
      </div>
    </div>
  );
}



function InfoCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-md border flex border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-slate-100 text-slate-700">
        {icon}
      </div>

      <div className="pl-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </div>

      <div className="mt-2 break-words text-[15px] font-medium leading-6 text-slate-900">
        {value || "-"}
      </div>
      </div>
    </div>
  );
}

export default function CompanyDetailsPage() {
  const { id } = useParams();

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [country, setCountry] = useState("");
  const [pincode, setPincode] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [dbName, setDbName] = useState("");
  const [isActive, setIsActive] = useState(true);

  async function loadCompanyById() {
    if (!id) {
      setErr("Company id is missing");
      setLoading(false);
      return;
    }

    setErr(null);
    setLoading(true);

    try {
      const res = await (api as any).getCompany(id);
      const row = res?.data?.data ?? res?.data ?? null;
      setCompany(row);
    } catch (e: any) {
      setCompany(null);
      setErr(
        e?.response?.data?.message || e?.message || "Failed to load company details"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCompanyById();
  }, [id]);

  function openEdit() {
    if (!company) return;

    setErr(null);
    setCompanyName(company.company_name || "");
    setEmail(company.email || "");
    setContactNo(company.contact_no || "");
    setWebsite(company.website || "");
    setAddress(company.address || "");
    setCity(company.city || "");
    setStateName(company.state || "");
    setCountry(company.country || "");
    setPincode(company.pincode || "");
    setLogoUrl(company.logo_url || "");
    setDbName(company.db_name || "");
    setIsActive(Boolean(company.is_active));
    setOpen(true);
  }

  function closeModal() {
    if (busy) return;
    setOpen(false);
  }

  async function onSubmit() {
    if (!company?.id) return;

    setErr(null);

    if (!companyName.trim()) return setErr("Company name is required");
    if (!email.trim()) return setErr("Email is required");

    const payload = {
      company_name: companyName.trim(),
      email: email.trim(),
      contact_no: contactNo.trim(),
      website: website.trim(),
      address: address.trim(),
      city: city.trim(),
      state: stateName.trim(),
      country: country.trim(),
      pincode: pincode.trim(),
      logo_url: logoUrl.trim(),
      db_name: dbName.trim(),
      is_active: isActive,
    };

    setBusy(true);
    try {
      await (api as any).updateCompany(company.id, payload);
      toast.success("Company updated successfully");
      setOpen(false);
      await loadCompanyById();
    } catch (e: any) {
      const message =
        e?.response?.data?.message || e?.message || "Failed to save company";
      setErr(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Company Profile"
        subtitle="View and manage company information"
        total={company ? 1 : 0}
        icon={<Building2 size={18} />}
        rightActions={
          <button
            onClick={loadCompanyById}
            className="inline-flex items-center gap-2 rounded-md border border-[#233a47] bg-[#233a47] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#1c303b]"
            type="button"
          >
            <RefreshCcw size={16} />
            Refresh
          </button>
        }
      />

      {err && !open && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50 shadow-sm">
        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <div className="flex items-center gap-3 text-slate-600">
              <Loader2 className="animate-spin" size={20} />
              Loading company details...
            </div>
          </div>
        ) : !company ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-md border border-slate-200 bg-white shadow-sm">
              <Building2 size={24} className="text-slate-600" />
            </div>
            <div className="mt-4 text-xl font-semibold text-slate-900">
              Company not found
            </div>
            <div className="mt-2 text-sm text-slate-500">
              The requested company profile could not be found.
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white shadow-sm">
                    <Building2 size={28} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
                        {company.company_name}
                      </h2>

                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ring-1",
                          company.is_active
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-rose-50 text-rose-700 ring-rose-200"
                        )}
                      >
                        {company.is_active ? (
                          <BadgeCheck size={14} />
                        ) : (
                          <BadgeX size={14} />
                        )}
                        {company.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="mt-2 max-w-2xl text-sm text-slate-500">
                      Manage the primary business contact information, branding,
                      and location details for this company profile.
                    </div>

                  
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
            

                  <button
                    onClick={openEdit}
                    className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                    type="button"
                  >
                    <Pencil size={16} />
                    Edit Profile
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <InfoCard
                icon={<Mail size={20} />}
                title="Email Address"
                value={company.email || "-"}
              />

              <InfoCard
                icon={<Phone size={20} />}
                title="Contact Number"
                value={company.contact_no || "-"}
              />

              <InfoCard
                icon={<Globe size={20} />}
                title="Website"
                value={
                  company.website ? (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {company.website}
                    </a>
                  ) : (
                    "-"
                  )
                }
              />

              <InfoCard
                icon={<MapPin size={20} />}
                title="Office Address"
                value={company.address || "-"}
              />

              <InfoCard
                icon={<MapPin size={20} />}
                title="Location"
                value={
                  [company.city, company.state, company.country, company.pincode]
                    .filter(Boolean)
                    .join(", ") || "-"
                }
              />

              <InfoCard
                icon={<ImageIcon size={20} />}
                title="Brand Logo"
                value={
                  company.logo_url ? (
                    <a
                      href={company.logo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View logo
                    </a>
                  ) : (
                    "-"
                  )
                }
              />
            </div>

            {company.logo_url && (
              <div className="mt-6 rounded-md border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 text-lg font-semibold text-slate-900">
                  Company Logo
                </div>
                <div className="flex min-h-[180px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 p-6">
                  <img
                    src={company.logo_url}
                    alt={company.company_name}
                    className="max-h-40 w-auto object-contain"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        open={open}
        title="Edit Company Profile"
        subtitle="Update company information"
        onClose={closeModal}
        onSubmit={onSubmit}
        submitText="Save Changes"
        busy={busy}
      >
        {err && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Company Name
            </label>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="ION LLA"
              className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="info@company.com"
              className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Contact Number
            </label>
            <input
              value={contactNo}
              onChange={(e) => setContactNo(e.target.value)}
              placeholder="9876543210"
              className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Website
            </label>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              City
            </label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Delhi"
              className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              State
            </label>
            <input
              value={stateName}
              onChange={(e) => setStateName(e.target.value)}
              placeholder="Delhi"
              className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Country
            </label>
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="India"
              className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Pincode
            </label>
            <input
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              placeholder="110001"
              className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Office Address
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter office address"
              rows={3}
              className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Logo URL
            </label>
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
