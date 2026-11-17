const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { pool } = require("./db");
const { requireAdmin } = require("./auth");

const router = express.Router();
const whatsapp = (process.env.WHATSAPP_NUMBER || "251924012897").replace(
  /\D/g,
  ""
);

function clean(v, max = 300) {
  return String(v ?? "")
    .trim()
    .slice(0, max);
}
function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function moneyNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
function makeRef() {
  return (
    "DAG" +
    Date.now().toString(36).toUpperCase() +
    crypto.randomBytes(3).toString("hex").toUpperCase()
  );
}

router.get("/config", (_req, res) => {
  res.json({
    businessName: "DAG ETHIOPIAN COFFEE",
    whatsapp,
    email: process.env.BUSINESS_EMAIL || "",
    currencies: ["ETB", "USD"],
  });
});

router.get("/products", async (req, res) => {
  try {
    const type = ["green", "roasted"].includes(req.query.type)
      ? req.query.type
      : null;
    const result = await pool.query(
      `SELECT id,slug,name,origin,type,description,process,grade,weight_kg,
       price_etb,price_usd,image_url,stock
       FROM products WHERE active=TRUE AND ($1::text IS NULL OR type=$1)
       ORDER BY id`,
      [type]
    );
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not load products." });
  }
});

router.post("/orders", async (req, res) => {
  const client = await pool.connect();
  try {
    const name = clean(req.body.name, 120);
    const email = clean(req.body.email, 180).toLowerCase();
    const phone = clean(req.body.phone, 40);
    const country = clean(req.body.country, 100);
    const address = clean(req.body.address, 500);
    const currency = req.body.currency === "USD" ? "USD" : "ETB";
    const method = req.body.paymentMethod === "chapa" ? "chapa" : "whatsapp";
    const items = Array.isArray(req.body.items)
      ? req.body.items.slice(0, 30)
      : [];

    if (!name || !validEmail(email) || !phone || !country || !items.length) {
      return res
        .status(400)
        .json({
          error:
            "Please provide your name, valid email, phone, country and at least one product.",
        });
    }

    await client.query("BEGIN");
    const ids = [
      ...new Set(items.map((i) => Number(i.id)).filter(Number.isInteger)),
    ];
    if (!ids.length) throw new Error("Invalid product selection.");
    const products = await client.query(
      "SELECT id,name,price_etb,price_usd,stock,active FROM products WHERE id=ANY($1::int[]) FOR UPDATE",
      [ids]
    );
    const map = new Map(products.rows.map((p) => [p.id, p]));
    let subtotal = 0;
    const normalized = [];
    for (const item of items) {
      const id = Number(item.id);
      const qty = Math.max(
        1,
        Math.min(100, Math.floor(Number(item.quantity) || 1))
      );
      const p = map.get(id);
      if (!p || !p.active)
        throw new Error("A selected product is unavailable.");
      if (p.stock < qty)
        throw new Error(`${p.name} does not have enough stock.`);
      const price = moneyNumber(currency === "USD" ? p.price_usd : p.price_etb);
      if (price <= 0)
        throw new Error(
          `${p.name} is not currently priced for ${currency}. Please contact us.`
        );
      subtotal += price * qty;
      normalized.push({
        id,
        name: p.name,
        quantity: qty,
        price,
        line: price * qty,
      });
    }
    const ref = makeRef();
    const order = await client.query(
      `INSERT INTO orders(order_ref,customer_name,email,phone,country,address,currency,subtotal,total,payment_method)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,$9) RETURNING id,order_ref,total,currency`,
      [ref, name, email, phone, country, address, currency, subtotal, method]
    );
    for (const item of normalized) {
      await client.query(
        `INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price,line_total)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [
          order.rows[0].id,
          item.id,
          item.name,
          item.quantity,
          item.price,
          item.line,
        ]
      );
      await client.query("UPDATE products SET stock=stock-$1 WHERE id=$2", [
        item.quantity,
        item.id,
      ]);
    }
    await client.query("COMMIT");

    if (method === "whatsapp") {
      const lines = normalized
        .map(
          (i) => `${i.name} x ${i.quantity} = ${i.line.toFixed(2)} ${currency}`
        )
        .join("\n");
      const msg = `Hello DAG Ethiopian Coffee. I would like to confirm order ${ref}.\n\n${lines}\n\nTotal: ${subtotal.toFixed(
        2
      )} ${currency}\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nCountry: ${country}\nAddress: ${
        address || "To be confirmed"
      }\n\nPlease confirm availability, shipping and payment arrangements.`;
      return res.json({
        orderRef: ref,
        method: "whatsapp",
        whatsappUrl: `https://wa.me/${whatsapp}?text=${encodeURIComponent(
          msg
        )}`,
      });
    }

    if (!process.env.CHAPA_PRIVATE_KEY) {
      return res
        .status(503)
        .json({
          error:
            "Online payment is not configured yet. Please choose WhatsApp ordering.",
        });
    }

    const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
    if (!appUrl)
      return res.status(500).json({ error: "APP_URL is not configured." });
    const customerPhone = phone.replace(/\D/g, "");
    const [firstName, ...lastParts] = name.split(/\s+/);
    const paymentBody = {
      amount: Math.round(subtotal * 100) / 100,
      currency,
      merchant_reference: ref,
      customer: {
        first_name: firstName,
        last_name: lastParts.join(" ") || firstName,
        email,
        phone_number: customerPhone,
      },
      callback_url: `${appUrl}/api/payments/chapa/callback`,
      return_url: `${appUrl}/payment-return.html?order=${encodeURIComponent(
        ref
      )}`,
      meta: { order_ref: ref },
      customization: {
        title: "DAG Ethiopian Coffee",
        description: `Payment for ${ref}`,
      },
    };
    const chapaResponse = await fetch(
      `${
        process.env.CHAPA_API_URL || "https://api.chapa.global/v2"
      }/payments/hosted`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CHAPA_PRIVATE_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": ref,
        },
        body: JSON.stringify(paymentBody),
      }
    );
    const chapaData = await chapaResponse.json().catch(() => ({}));
    const checkoutUrl = chapaData?.data?.checkout_url;
    if (!chapaResponse.ok || !checkoutUrl) {
      console.error("Chapa initialization failed:", chapaData);
      return res
        .status(502)
        .json({
          error:
            "Could not start online payment. Please try WhatsApp ordering or contact us.",
        });
    }
    const paymentRef = checkoutUrl.split("/").filter(Boolean).pop();
    await pool.query(
      "UPDATE orders SET chapa_reference=$1 WHERE order_ref=$2",
      [paymentRef, ref]
    );
    res.json({ orderRef: ref, method: "chapa", checkoutUrl });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(e);
    res.status(400).json({ error: e.message || "Could not create order." });
  } finally {
    client.release();
  }
});

async function verifyChapaOrder(orderRef) {
  const found = await pool.query("SELECT * FROM orders WHERE order_ref=$1", [
    orderRef,
  ]);
  if (!found.rowCount) throw new Error("Order not found.");
  const order = found.rows[0];
  if (order.payment_status === "paid") return order;
  if (!order.chapa_reference || !process.env.CHAPA_PRIVATE_KEY)
    throw new Error("Payment reference is not available.");
  const response = await fetch(
    `${
      process.env.CHAPA_API_URL || "https://api.chapa.global/v2"
    }/payments/${encodeURIComponent(order.chapa_reference)}/verify`,
    {
      headers: { Authorization: `Bearer ${process.env.CHAPA_PRIVATE_KEY}` },
    }
  );
  const payload = await response.json().catch(() => ({}));
  const data = payload.data || {};
  if (
    !response.ok ||
    data.status !== "SUCCESS" ||
    String(data.merchant_reference) !== String(orderRef) ||
    String(data.currency).toUpperCase() !==
      String(order.currency).toUpperCase() ||
    Math.abs(Number(data.amount) - Number(order.total)) > 0.01
  ) {
    throw new Error(
      "Payment has not been verified as successful for this order."
    );
  }
  const updated = await pool.query(
    "UPDATE orders SET payment_status='paid',order_status='processing' WHERE order_ref=$1 RETURNING *",
    [orderRef]
  );
  return updated.rows[0];
}

router.get("/payments/chapa/callback", async (req, res) => {
  try {
    const ref = clean(req.query.merchant_reference || req.query.ref, 40);
    if (ref) await verifyChapaOrder(ref);
    res.status(200).json({ received: true });
  } catch (e) {
    console.error("Chapa callback verification:", e.message);
    res.status(400).json({ received: false });
  }
});

router.post("/payments/verify/:orderRef", async (req, res) => {
  try {
    const order = await verifyChapaOrder(clean(req.params.orderRef, 40));
    res.json({
      success: true,
      orderRef: order.order_ref,
      paymentStatus: order.payment_status,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/wholesale", async (req, res) => {
  try {
    const company = clean(req.body.company, 160);
    const contact = clean(req.body.contactName, 120);
    const email = clean(req.body.email, 180).toLowerCase();
    const phone = clean(req.body.phone, 40);
    const country = clean(req.body.country, 100);
    const interest = clean(req.body.coffeeInterest, 160);
    const quantity = clean(req.body.quantity, 100);
    const message = clean(req.body.message, 2000);
    if (
      !company ||
      !contact ||
      !validEmail(email) ||
      !country ||
      !interest ||
      !quantity
    ) {
      return res
        .status(400)
        .json({
          error: "Please complete all required wholesale enquiry fields.",
        });
    }
    await pool.query(
      `INSERT INTO wholesale_requests(company,contact_name,email,phone,country,coffee_interest,estimated_quantity,message)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [company, contact, email, phone, country, interest, quantity, message]
    );
    res.json({
      success: true,
      message: "Thank you. Your wholesale enquiry has been received.",
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not submit your enquiry." });
  }
});

// Admin login
router.post("/auth/login", async (req, res) => {
  try {
    const email = clean(req.body.email, 180).toLowerCase();
    const password = String(req.body.password || "");
    const result = await pool.query("SELECT * FROM admins WHERE email=$1", [
      email,
    ]);
    if (
      !result.rowCount ||
      !(await bcrypt.compare(password, result.rows[0].password_hash))
    ) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      return res
        .status(500)
        .json({ error: "JWT_SECRET must be at least 32 characters." });
    }
    const token = jwt.sign(
      { id: result.rows[0].id, email },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );
    res.cookie("dag_admin", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000,
      path: "/",
    });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not sign in." });
  }
});

router.post("/auth/logout", (_req, res) => {
  res.clearCookie("dag_admin", { httpOnly: true, sameSite: "lax", path: "/" });
  res.json({ success: true });
});

router.get("/admin/summary", requireAdmin, async (_req, res) => {
  try {
    const [orders, products, wholesale] = await Promise.all([
      pool.query(
        "SELECT COUNT(*)::int AS count, COALESCE(SUM(total) FILTER (WHERE payment_status='paid'),0) AS paid_total FROM orders"
      ),
      pool.query(
        "SELECT COUNT(*)::int AS count, COALESCE(SUM(stock),0)::int AS stock FROM products WHERE active=true"
      ),
      pool.query(
        "SELECT COUNT(*)::int AS count FROM wholesale_requests WHERE status='new'"
      ),
    ]);
    res.json({
      orders: orders.rows[0],
      products: products.rows[0],
      wholesale: wholesale.rows[0],
    });
  } catch {
    res.status(500).json({ error: "Could not load dashboard." });
  }
});

router.get("/admin/orders", requireAdmin, async (_req, res) => {
  const result = await pool.query(`
    SELECT o.*, COALESCE(json_agg(json_build_object(
      'name',i.product_name,'quantity',i.quantity,'unit_price',i.unit_price,'line_total',i.line_total
    )) FILTER (WHERE i.id IS NOT NULL),'[]') AS items
    FROM orders o LEFT JOIN order_items i ON i.order_id=o.id
    GROUP BY o.id ORDER BY o.created_at DESC LIMIT 200
  `);
  res.json(result.rows);
});

router.patch("/admin/orders/:id", requireAdmin, async (req, res) => {
  const status = clean(req.body.status, 30);
  if (
    !["pending", "processing", "shipped", "completed", "cancelled"].includes(
      status
    )
  ) {
    return res.status(400).json({ error: "Invalid order status." });
  }
  const result = await pool.query(
    "UPDATE orders SET order_status=$1 WHERE id=$2 RETURNING id,order_status",
    [status, req.params.id]
  );
  if (!result.rowCount)
    return res.status(404).json({ error: "Order not found." });
  res.json(result.rows[0]);
});

router.get("/admin/products", requireAdmin, async (_req, res) => {
  const result = await pool.query("SELECT * FROM products ORDER BY id");
  res.json(result.rows);
});

router.patch("/admin/products/:id", requireAdmin, async (req, res) => {
  const stock = Math.max(
    0,
    Math.min(100000, Math.floor(Number(req.body.stock)))
  );
  const active = req.body.active === false ? false : true;
  const priceEtb = moneyNumber(req.body.price_etb);
  const priceUsd = moneyNumber(req.body.price_usd);
  const result = await pool.query(
    "UPDATE products SET stock=$1,active=$2,price_etb=$3,price_usd=$4 WHERE id=$5 RETURNING *",
    [stock, active, priceEtb, priceUsd, req.params.id]
  );
  if (!result.rowCount)
    return res.status(404).json({ error: "Product not found." });
  res.json(result.rows[0]);
});

router.get("/admin/wholesale", requireAdmin, async (_req, res) => {
  const result = await pool.query(
    "SELECT * FROM wholesale_requests ORDER BY created_at DESC LIMIT 200"
  );
  res.json(result.rows);
});

module.exports = router;