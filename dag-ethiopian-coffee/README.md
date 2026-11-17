# DAG Ethiopian Coffee

This Node.js/Express storefront runs on Railway from either the repository root or the `dag-ethiopian-coffee` folder. Node.js 20+ is required.

## Run locally

```sh
npm install
npm start
```

Open <http://localhost:3000>. PostgreSQL is optional for displaying the storefront. Without `DATABASE_URL`, the product catalogue is served from the app and WhatsApp orders open directly without being saved on the server. Chapa payments, admin features, wholesale submissions, and persistent orders require PostgreSQL.

## Railway deployment

Deploy this GitHub repository as a Node.js service. The included `railway.json` starts `npm start`; Railway's `PORT` is used automatically, and `/healthz` is the health check. You may set the Railway service root directory to `dag-ethiopian-coffee` or leave it at the repository root. No database variable is needed for the storefront to load.

For persistent orders, admin tools, wholesale enquiries, and Chapa checkout, add a PostgreSQL service and set `DATABASE_URL` to its Railway reference (for example `${{Postgres.DATABASE_URL}}`). Add `NODE_ENV=production`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and a random `JWT_SECRET` of at least 32 characters. Set `APP_URL` to the public HTTPS domain to use Chapa. Keep private keys and passwords in Railway variables, never in source control.

## Notes

The database-free WhatsApp flow does not persist order records; the customer details and items are handed to WhatsApp for confirmation. The green coffee items start without retail prices and must be priced before checkout. Chapa online payments need both a database and valid Chapa credentials.
