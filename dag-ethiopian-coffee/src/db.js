const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products ( id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, origin TEXT NOT NULL, type TEXT NOT NULL CHECK (type IN ('green','roasted')),
      description TEXT NOT NULL,
      process TEXT NOT NULL DEFAULT 'Washed',
      grade TEXT NOT NULL DEFAULT 'Grade 1',
      weight_kg NUMERIC(10,2) NOT NULL DEFAULT 1,
      price_etb NUMERIC(12,2) NOT NULL DEFAULT 0,
      price_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
      image_url TEXT NOT NULL DEFAULT '',
      stock INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders ( id BIGSERIAL PRIMARY KEY, order_ref TEXT UNIQUE NOT NULL, customer_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, country TEXT NOT NULL, address TEXT NOT NULL DEFAULT '', currency TEXT NOT NULL CHECK (currency IN ('ETB','USD')),
      subtotal NUMERIC(12,2) NOT NULL,
      shipping NUMERIC(12,2) NOT NULL DEFAULT 0,
      total NUMERIC(12,2) NOT NULL,
      payment_method TEXT NOT NULL CHECK (payment_method IN ('whatsapp','chapa')),
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      order_status TEXT NOT NULL DEFAULT 'pending',
      chapa_reference TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_items ( id BIGSERIAL PRIMARY KEY, order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price NUMERIC(12,2) NOT NULL,
      line_total NUMERIC(12,2) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wholesale_requests ( id BIGSERIAL PRIMARY KEY, company TEXT NOT NULL, contact_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', country TEXT NOT NULL, coffee_interest TEXT NOT NULL, estimated_quantity TEXT NOT NULL, message TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS admins ( id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const count = await pool.query("SELECT COUNT(*)::int AS count FROM products");
  if (count.rows[0].count === 0) {
    const seeds = [
      [
        "yirgacheffe-washed",
        "Yirgacheffe Washed",
        "Yirgacheffe",
        "green",
        "Elegant floral aroma, citrus character and a clean cup profile.",
        "Washed",
        "Grade 1",
        60,
        0,
        0,
        "https://images.unsplash.com/photo-1559525839-b184a4d698c7?auto=format&fit=crop&w=900&q=85",
        100,
      ],
      [
        "sidama-natural",
        "Sidama Natural",
        "Sidama",
        "green",
        "Fruit-forward Ethiopian coffee with a distinctive natural-process character.",
        "Natural",
        "Grade 1",
        60,
        0,
        0,
        "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=900&q=85",
        100,
      ],
      [
        "guji-washed",
        "Guji Washed",
        "Guji",
        "green",
        "Aromatic highland coffee with a balanced and complex cup profile.",
        "Washed",
        "Grade 1",
        60,
        0,
        0,
        "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=900&q=85",
        100,
      ],
      [
        "limu-roasted",
        "Limu Roasted Coffee",
        "Limu",
        "roasted",
        "Balanced Ethiopian coffee, freshly roasted for home brewing.",
        "Washed",
        "Roasted",
        0.25,
        1000,
        9,
        "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=85",
        50,
      ],
      [
        "jimma-roasted",
        "Jimma Roasted Coffee",
        "Jimma",
        "roasted",
        "Traditional Ethiopian coffee character in a convenient roasted pack.",
        "Natural",
        "Roasted",
        0.25,
        950,
        8.5,
        "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=900&q=85",
        50,
      ],
      [
        "ethiopian-house-blend",
        "Ethiopian House Blend",
        "Ethiopia",
        "roasted",
        "A curated expression of Ethiopia's rich coffee heritage.",
        "Blend",
        "Roasted",
        0.25,
        1100,
        10,
        "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=85",
        50,
      ],
    ];
    for (const p of seeds) {
      await pool.query(
        `INSERT INTO products
        (slug,name,origin,type,description,process,grade,weight_kg,price_etb,price_usd,image_url,stock)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        p
      );
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword && !adminPassword.startsWith("CHANGE_")) {
    const existing = await pool.query("SELECT id FROM admins WHERE email=$1", [
      adminEmail.toLowerCase(),
    ]);
    if (!existing.rowCount) {
      const hash = await bcrypt.hash(adminPassword, 12);
      await pool.query(
        "INSERT INTO admins(email,password_hash) VALUES($1,$2)",
        [adminEmail.toLowerCase(), hash]
      );
      console.log("Initial admin account created from environment settings.");
    }
  }
}

module.exports = { pool, initDb };