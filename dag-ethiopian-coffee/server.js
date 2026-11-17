const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { pool, initDb } = require("./src/db");

const app = express();
const port = Number(process.env.PORT) || 3000;
const whatsapp = String(process.env.WHATSAPP_NUMBER || "251924012897").replace(/\D/g, "");
const fallbackProducts = [
  { id: 1, slug: "yirgacheffe-washed", name: "Yirgacheffe Washed", origin: "Yirgacheffe", type: "green", description: "Elegant floral aroma, citrus character and a clean cup profile.", process: "Washed", grade: "Grade 1", weight_kg: 60, price_etb: 0, price_usd: 0, image_url: "https://images.unsplash.com/photo-1559525839-b184a4d698c7?auto=format&fit=crop&w=900&q=85", stock: 100 },
  { id: 2, slug: "sidama-natural", name: "Sidama Natural", origin: "Sidama", type: "green", description: "Fruit-forward Ethiopian coffee with a distinctive natural-process character.", process: "Natural", grade: "Grade 1", weight_kg: 60, price_etb: 0, price_usd: 0, image_url: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=900&q=85", stock: 100 },
  { id: 3, slug: "guji-washed", name: "Guji Washed", origin: "Guji", type: "green", description: "Aromatic highland coffee with a balanced and complex cup profile.", process: "Washed", grade: "Grade 1", weight_kg: 60, price_etb: 0, price_usd: 0, image_url: "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=900&q=85", stock: 100 },
  { id: 4, slug: "limu-roasted", name: "Limu Roasted Coffee", origin: "Limu", type: "roasted", description: "Balanced Ethiopian coffee, freshly roasted for home brewing.", process: "Washed", grade: "Roasted", weight_kg: 0.25, price_etb: 1000, price_usd: 9, image_url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=85", stock: 50 },
  { id: 5, slug: "jimma-roasted", name: "Jimma Roasted Coffee", origin: "Jimma", type: "roasted", description: "Traditional Ethiopian coffee character in a convenient roasted pack.", process: "Natural", grade: "Roasted", weight_kg: 0.25, price_etb: 950, price_usd: 8.5, image_url: "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=900&q=85", stock: 50 },
  { id: 6, slug: "ethiopian-house-blend", name: "Ethiopian House Blend", origin: "Ethiopia", type: "roasted", description: "A curated expression of Ethiopia's rich coffee heritage.", process: "Blend", grade: "Roasted", weight_kg: 0.25, price_etb: 1100, price_usd: 10, image_url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=85", stock: 50 },
];
let databaseReady = false;
app.use(express.json({ limit: "1mb" }));
app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/api", (req, res, next) => {
  if (databaseReady) return next();
  if (req.method === "GET" && req.path === "/config") return res.json({ businessName: "DAG ETHIOPIAN COFFEE", whatsapp, email: process.env.BUSINESS_EMAIL || "", currencies: ["ETB", "USD"] });
  if (req.method === "GET" && req.path === "/products") {
    const type = ["green", "roasted"].includes(req.query.type) ? req.query.type : null;
    return res.json(fallbackProducts.filter((product) => !type || product.type === type));
  }
  if (req.method === "POST" && req.path === "/orders") {
    const { name, email, phone, country, address = "", currency = "ETB", paymentMethod = "whatsapp", items } = req.body || {};
    if (!name || !/^\S+@\S+\.\S+$/.test(String(email || "")) || !phone || !country || !Array.isArray(items) || !items.length) return res.status(400).json({ error: "Please provide your name, valid email, phone, country and at least one product." });
    if (paymentMethod === "chapa") return res.status(503).json({ error: "Online payments require database setup. Please choose WhatsApp ordering." });
    const orderItems = items.slice(0, 30).map((item) => { const product = fallbackProducts.find((entry) => entry.id === Number(item.id)); return product ? { product, quantity: Math.max(1, Math.min(100, Math.floor(Number(item.quantity) || 1))), price: Number(currency === "USD" ? product.price_usd : product.price_etb) } : null; });
    if (orderItems.some((item) => !item)) return res.status(400).json({ error: "A selected product is unavailable." });
    if (orderItems.some(({ price }) => price <= 0)) return res.status(400).json({ error: `Some selected products do not have a price for ${currency}. Please contact us.` });
    const ref = `DAG${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const lines = orderItems.map(({ product, quantity, price }) => `${product.name} x ${quantity} = ${(price * quantity).toFixed(2)} ${currency}`).join("\n");
    const message = `Hello DAG Ethiopian Coffee. I would like to confirm order ${ref}.\n\n${lines}\n\nTotal: ${total.toFixed(2)} ${currency}\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nCountry: ${country}\nAddress: ${address || "To be confirmed"}\n\nPlease confirm availability, shipping and payment arrangements.`;
    return res.json({ orderRef: ref, method: "whatsapp", whatsappUrl: `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}` });
  }
  if (req.path.startsWith("/admin") || req.path.startsWith("/auth") || req.path.startsWith("/payments") || req.path === "/wholesale") return res.status(503).json({ error: "This feature needs a configured PostgreSQL database." });
  next();
});
async function start() {
  const server = app.listen(port, "0.0.0.0", () => console.log(`DAG Ethiopian Coffee listening on ${port}`));
  if (!process.env.DATABASE_URL) { console.warn("DATABASE_URL is not set; running storefront in database-free mode. Orders are handed off to WhatsApp and are not stored."); return; }
  try {
    await pool.query("SELECT 1");
    await initDb();
    app.use("/api", require("./src/routes"));
    databaseReady = true;
    console.log("PostgreSQL connected and initialized.");
  } catch (error) { console.error("Database unavailable; continuing in database-free mode:", error.message); }
  server.on("close", () => pool.end().catch(() => {}));
}
start().catch((error) => { console.error("Server startup failed:", error); process.exitCode = 1; });
