DAG Ethiopian Coffee

A full-stack starter store for Ethiopian green and roasted coffee, retail orders, WhatsApp checkout, Chapa hosted checkout, wholesale enquiries and a private admin dashboard.


Included


Responsive customer storefront

ETB and USD price display

Green and roasted coffee catalogue

PostgreSQL-backed products, orders and wholesale enquiries

WhatsApp order handoff: +251 924 012 897

Chapa V2 hosted checkout with server-side payment verification

Admin login, order status updates, stock and price management

Railway-ready Node.js/Express app


1. Run locally

Requirements: Node.js 20+ and PostgreSQL.


npm install
cp .env.example .env

Edit .env:



DATABASE_URL: your local PostgreSQL connection string

ADMIN_EMAIL: initial administrator email

ADMIN_PASSWORD: long unique password

JWT_SECRET: random secret at least 32 characters

APP_URL=http://localhost:3000

WHATSAPP_NUMBER=251924012897

BUSINESS_EMAIL: your real business email

CHAPA_PRIVATE_KEY: leave blank until you configure Chapa test mode


Then run:


npm start

Open http://localhost:3000. Admin page: http://localhost:3000/admin.html.


The initial admin account is created once at first database initialization if ADMIN_EMAIL and ADMIN_PASSWORD are set. If you change those variables later, the existing admin account is not automatically overwritten.


2. Deploy to Railway from GitHub


Push the entire project to a GitHub repository.

In Railway, create a project and deploy from that GitHub repository.

Add a PostgreSQL database service to the same Railway project.

In the web service variables, set:
DATABASE_URL=${{Postgres.DATABASE_URL}} (choose the actual PostgreSQL service name in Railway)
NODE_ENV=production
APP_URL=https://YOUR-RAILWAY-DOMAIN
ADMIN_EMAIL=your-admin-email
ADMIN_PASSWORD=a-long-unique-password
JWT_SECRET=a-random-secret-of-at-least-32-characters
WHATSAPP_NUMBER=251924012897
BUSINESS_EMAIL=your-real-email
PGSSL=false for Railway's internal database connection unless your database configuration specifically requires SSL

Generate a public domain for the web service.

Make sure APP_URL exactly matches the public HTTPS domain, without a trailing slash.

Redeploy and test /healthz.


Railway uses the start script in package.json and provides the PORT environment variable.


3. Configure Chapa online payments


Create/verify a Chapa merchant account and complete any business verification required by Chapa.

Start in Chapa Test Mode.

Copy the V2 private key into Railway's CHAPA_PRIVATE_KEY variable. Never put it in browser JavaScript or GitHub.

Set CHAPA_API_URL=https://api.chapa.global/v2.

Confirm that your merchant account is enabled for the currencies and payment methods you plan to accept.

Test an ETB order and USD order with Chapa test mode before enabling live payments.

Switch to a live key only after your business and payment flow are approved and tested.


This project uses Chapa V2 hosted checkout. The server verifies the payment and checks order reference, currency and amount before marking the order paid. Do not ship an order based only on the browser redirect. Review Chapa's current docs for account-specific requirements and webhook configuration.


4. Important before taking real orders


Replace example coffee photos and sample product data with your own approved product photos and accurate specifications.

The green coffee seed products have zero prices initially. Add confirmed ETB/USD prices from the admin dashboard before offering them for sale.

The example retail prices are placeholders. Confirm package size, grade, processing, taxes, shipping and currency with your business.

Shipping is not calculated in this starter. Confirm freight, customs, duties and delivery with the buyer before final invoicing.

International sales, export documentation, tax, food safety and labeling requirements depend on destination and business setup. Confirm these with qualified local and destination-market advisers.

Configure regular database backups and monitor Railway logs.

Use a strong admin password and JWT secret. Do not commit .env.

Add CSRF protection, verified webhook signature handling, email notifications, audit logs and more detailed inventory reservation logic before scaling to high order volumes.


5. Main folders

dag-ethiopian-coffee/
├── server.js
├── package.json
├── .env.example
├── src/
│   ├── db.js
│   ├── auth.js
│   └── routes.js
└── public/
    ├── index.html
    ├── admin.html
    ├── payment-return.html
    ├── css/style.css
    └── js/
        ├── app.js
        └── admin.js

Notes

This is a functional first production-style foundation, not a substitute for a security review or payment-provider approval. WhatsApp orders are stored as pending orders and opened in WhatsApp for confirmation. Online payment requires your own active Chapa merchant credentials.

