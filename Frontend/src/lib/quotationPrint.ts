function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value?: string) {
  if (!value) return "N/A";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function escapeHtml(value?: string | number | null) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createClientIdHash(id: number | string) {
  const input = `${id}ION`;
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, "0").slice(0, 8);
}

export function openQuotationPrintWindow(input: {
  id?: number | string;
  client_name?: string;
  client_mobile?: string;
  service_name?: string;
  created_at?: string;
  service_desc?: string;
  base_amount?: number;
  gst_rate?: number;
  gst_amount?: number;
  total_amount?: number;
  advance_amount?: number;
  remaining_amount?: number;
  duration?: string;
}) {
  const logoUrl = `${window.location.origin}/logo.png`;
  const id = input.id ?? "";
  const amount = Number(input.base_amount || 0);
  const gstRate = Number(input.gst_rate || 0);
  const gstAmount = Number(input.gst_amount || 0);
  const totalAmount = Number(input.total_amount || amount + gstAmount);
  const advanceAmount = Number(input.advance_amount || 0);
  const remainingAmount = Number(input.remaining_amount || totalAmount - advanceAmount);
  const advancePercent =
    totalAmount > 0 ? Math.max(0, Math.min(100, Math.round((advanceAmount / totalAmount) * 100))) : 0;
  const remainPercent = 100 - advancePercent;
  const popup = window.open("", "_blank");

  if (!popup) {
    return false;
  }

  const serviceDesc = String(input.service_desc || "")
    .replace(/\\r\\n|\\n|\\r/g, "\n")
    .trim();

  popup.document.open();
  popup.document.write(`
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Quotation #${escapeHtml(id)} - Ion Detective</title>
        <style>
          body {
            padding: 40px;
            font-family: 'Segoe UI', sans-serif;
            font-size: 14px;
            background: #fff;
            color: #111827;
          }
          .service-desc-content { line-height: 1.5; margin: 0; }
          .service-desc-content p { margin: 4px 0; }
          .service-desc-content ul, .service-desc-content ol {
            margin: 6px 0;
            padding-left: 20px;
          }
          .invoice-box {
            max-width: 700px;
            margin: auto;
            padding: 20px;
            border: 1px solid #ccc;
            border-radius: 6px;
          }
          .header-line {
            padding: 10px 15px;
            border-bottom: 1px solid #ccc;
          }
          .top-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
          }
          .top-actions {
            max-width: 700px;
            margin: 0 auto 16px;
            display: flex;
            justify-content: flex-end;
          }
          .print-btn {
            border: 1px solid #d1d5db;
            background: #111827;
            color: #fff;
            border-radius: 6px;
            padding: 10px 14px;
            font-size: 13px;
            cursor: pointer;
          }
          .print-btn:hover {
            background: #1f2937;
          }
          .text-end {
            text-align: right;
          }
          .logo-box img {
            max-width: 150px;
            height: auto;
            display: block;
          }
          .footer-note {
            font-size: 12px;
            margin-top: 30px;
            border-top: 1px dashed #aaa;
            padding-top: 15px;
            color: #555;
          }
          .footer-note small {
            display: block;
            margin-bottom: 8px;
          }
          @media (max-width: 576px) {
            .top-bar { flex-direction: column; align-items: flex-start; gap: 5px; }
            .text-end { align-self: flex-end; text-align: right; }
          }
          @media print {
            body { padding: 0; }
            .top-actions { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="top-actions">
          <button type="button" class="print-btn" onclick="window.print()">Print Quotation</button>
        </div>
        <div class="invoice-box">
          <div class="header-line">
            <div class="top-bar">
              <div class="logo-box">
                <img src="${logoUrl}" alt="Ion Detective Logo" />
              </div>
              <div class="text-end">
                <small style="color:#6b7280;">Client ID: <strong>${createClientIdHash(id)}</strong></small>
              </div>
            </div>
            <div style="text-align:center; margin-top: 10px;">
              <h5 style="margin-bottom:4px;">INFOACE EXPERTS PRIVATE LIMITED</h5>
              <small style="color:#6b7280; display:block;">
                GSTIN: 09AAHCI3766K1Z1 | info@iondetective.com | +91 9151211555
              </small>
            </div>
          </div>

          <div style="text-align:center; margin-top: 12px;">
            <small style="color:#6b7280; display:block; margin-top: 12px;">
              Client Name: ${escapeHtml(input.client_name || "")} &nbsp;|&nbsp;
              Client Mobile: ${escapeHtml(input.client_mobile || "")} &nbsp;|&nbsp;
              Date: ${escapeHtml(formatDate(input.created_at))} &nbsp;|&nbsp;
              Service: ${escapeHtml(input.service_name || "")}
            </small>
            <br />
          </div>

          ${
            serviceDesc
              ? `
            <div style="margin-bottom: 16px;">
              <h6 style="font-weight:700; margin-bottom:8px;">Service Description:</h6>
              <div class="service-desc-content">${serviceDesc}</div>
            </div>
          `
              : ""
          }

          <div style="margin-bottom: 16px;">
            <p>
              <strong>Base Amount:</strong> Rs.${formatCurrency(amount)} &nbsp;|&nbsp;
              <strong>GST (${escapeHtml(gstRate)}%):</strong> Rs.${formatCurrency(gstAmount)} &nbsp;|&nbsp;
              <strong>Total:</strong> Rs.${formatCurrency(totalAmount)}
            </p>
            <p>
              <strong>Advance (${advancePercent}%):</strong> Rs.${formatCurrency(advanceAmount)} &nbsp;|&nbsp;
              <strong>Remaining (${remainPercent}%):</strong> Rs.${formatCurrency(remainingAmount)}
            </p>
            <p>
              <strong>Estimated Duration:</strong> ${escapeHtml(input.duration || "N/A")} This duration is indicative and may vary depending on field conditions, subject availability, third-party cooperation, legal constraints, and operational factors. Ion Detective Agency shall not be liable for delays beyond its reasonable control.
            </p>
            <p>
              <strong>Client Acceptance & Consent:</strong> By making any payment, replying "I AGREE", "ACCEPT", or providing any form of confirmation, the client expressly acknowledges that they have read, understood, and unconditionally accepted Ion Detective Agency's Terms & Conditions, Refund Policy, Privacy Policy, and Service Disclaimers available on our website and shared documents. Such acceptance shall be treated as a valid and legally binding consent.
            </p>
          </div>

          <div class="footer-note">
            <small>
              <strong>Note:</strong> Ion Detective Agency conducts all investigations with the highest standards of professionalism, integrity, and confidentiality, and strictly in accordance with all applicable laws and regulations. Our role is limited to identifying and presenting facts based on the available evidence, documented information, and prevailing circumstances. The outcome of any investigation may be favourable or unfavourable, as it depends solely on real-world conditions and verified findings. Ion Detective Agency does not influence, modify, fabricate, or alter any information or results under any circumstances.
            </small>
            <small>
              <strong>Important Note:</strong> This quotation is provided in good faith and is intended exclusively for the recipient. All prices quoted are inclusive of applicable GST. Upon initiation of services, our standard terms of service will apply. For detailed information, please refer to our <a href="https://iondetective.com/refund-policy/" style="color: #007BFF; text-decoration: none;">Refund Policy</a>.
            </small>
            <small>
              <strong>Scope & Limitation:</strong> Ion Detective Agency provides professional, effort-based investigation services. No assurance or guarantee is provided regarding the discovery, quantity, quality, or admissibility of evidence. Payments are made towards professional expertise, time, and operational effort, not guaranteed outcomes.
            </small>
            <small>
              <strong>Dispute Nature:</strong> Any disagreement arising from this quotation or service shall be treated as a professional service dispute and not as cyber fraud, cheating, or misrepresentation.
            </small>
          </div>
        </div>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  return true;
}
