import { EmailMessage } from "cloudflare:email";

// Test tokens only work against this sandbox host, not the country-specific
// live one (e.g. api-sa.myfatoorah.com) — that mismatch returns a generic
// 500 from MyFatoorah with no useful detail. Update this alongside the
// token when switching to a live credential.
const MYFATOORAH_BASE = "https://apitest.myfatoorah.com";

// Server-side source of truth. Never trust a price sent by the client.
const PRICES = {
  main: { 1: 599, 3: 1609, 6: 3109, 12: 5859 },
  student: { 1: 419, 3: 1129, 6: 2179, 12: 4099 },
};

const PACKAGE_LABEL = {
  main: "الباقة الرئيسية",
  student: "باقة الطلاب",
};

const DURATION_LABEL = { 1: "شهر", 3: "3 أشهر", 6: "6 أشهر", 12: "سنة" };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function handleCheckout(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid request body" }, 400);
  }

  const tier = body.tier;
  const months = Number(body.months);
  const customerName = String(body.customerName || "").trim();
  const customerMobile = String(body.customerMobile || "").replace(/\D/g, "");

  const price = PRICES[tier]?.[months];
  if (!price) return json({ error: "invalid package" }, 400);
  if (!customerName) return json({ error: "missing customer name" }, 400);
  if (customerMobile.length < 8 || customerMobile.length > 12) {
    return json({ error: "invalid mobile number" }, 400);
  }

  const origin = new URL(request.url).origin;

  const payload = {
    InvoiceValue: price,
    CustomerName: customerName,
    MobileCountryCode: "+966",
    CustomerMobile: customerMobile,
    DisplayCurrencyIso: "SAR",
    NotificationOption: "LNK",
    Language: "ar",
    CallBackUrl: `${origin}/checkout-success.html`,
    ErrorUrl: `${origin}/checkout-error.html`,
    UserDefinedField: JSON.stringify({ tier, months }),
    InvoiceItems: [
      {
        ItemName: `${PACKAGE_LABEL[tier]} — ${DURATION_LABEL[months]}`,
        Quantity: 1,
        UnitPrice: price,
      },
    ],
  };

  let res, bodyText;
  try {
    res = await fetch(`${MYFATOORAH_BASE}/v2/SendPayment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.MYFATOORAH_TEST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    bodyText = await res.text();
  } catch {
    return json({ error: "payment gateway unreachable" }, 502);
  }

  let data;
  try {
    data = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    data = null;
  }

  if (!res.ok || !data?.IsSuccess || !data.Data?.InvoiceURL) {
    console.error("MyFatoorah SendPayment failed", res.status, bodyText);
    return json({ error: "payment init failed" }, 502);
  }

  return json({ url: data.Data.InvoiceURL });
}

async function getPaymentStatus(env, invoiceId) {
  const res = await fetch(`${MYFATOORAH_BASE}/v2/GetPaymentStatus`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.MYFATOORAH_TEST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ Key: String(invoiceId), KeyType: "InvoiceId" }),
  });
  const bodyText = await res.text();
  if (!res.ok || !bodyText) {
    console.error("MyFatoorah GetPaymentStatus failed", res.status, bodyText);
    return null;
  }
  let data;
  try {
    data = JSON.parse(bodyText);
  } catch {
    return null;
  }
  return data?.Data || null;
}

function buildOrderEmail(order) {
  const subject = `طلب اشتراك جديد — ${order.amount} ر.س`;
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const lines = [
    `الاسم: ${order.customerName}`,
    `الجوال: ${order.customerMobile}`,
    `الباقة: ${order.packageLabel}`,
    `المبلغ: ${order.amount} ر.س`,
    `رقم الفاتورة: ${order.invoiceId}`,
    `الوقت: ${order.paidAt}`,
  ];
  const raw = [
    "From: orders@nassercoaching.com",
    "To: coaching@nasserpt.com",
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    lines.join("\n"),
  ].join("\r\n");
  return raw;
}

async function sendOrderEmail(env, order) {
  const raw = buildOrderEmail(order);
  const message = new EmailMessage(
    "orders@nassercoaching.com",
    "coaching@nasserpt.com",
    raw,
  );
  await env.SEND_EMAIL.send(message);
}

// MyFatoorah's webhook call is treated only as a hint to re-check, never as
// proof of payment on its own — we always re-verify the invoice's status
// with MyFatoorah directly, using our own token, before acting on it.
async function handleWebhook(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("ok", { status: 200 });
  }

  const invoiceId = body?.Data?.InvoiceId ?? body?.InvoiceId;
  if (!invoiceId) return new Response("ok", { status: 200 });

  const invoice = await getPaymentStatus(env, invoiceId);
  if (!invoice || invoice.InvoiceStatus !== "Paid") {
    return new Response("ok", { status: 200 });
  }

  const orderKey = `order:${invoiceId}`;
  if (await env.ORDERS.get(orderKey)) {
    return new Response("ok", { status: 200 }); // already processed
  }

  let tier, months;
  try {
    ({ tier, months } = JSON.parse(invoice.UserDefinedField || "{}"));
  } catch {
    tier = null;
    months = null;
  }

  const order = {
    invoiceId,
    amount: invoice.InvoiceValue,
    customerName: invoice.CustomerName,
    customerMobile: invoice.CustomerMobile,
    packageLabel: tier
      ? `${PACKAGE_LABEL[tier]} — ${DURATION_LABEL[months]}`
      : "غير معروف",
    paidAt: new Date().toISOString(),
  };

  await env.ORDERS.put(orderKey, JSON.stringify(order));
  await sendOrderEmail(env, order);

  return new Response("ok", { status: 200 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/checkout") {
      return handleCheckout(request, env);
    }
    if (request.method === "POST" && url.pathname === "/api/webhook") {
      return handleWebhook(request, env);
    }
    return new Response("not found", { status: 404 });
  },
};
