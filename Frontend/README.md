# MediCare patient website

The patient website and doctor workspace use React and Vite. From this directory, run `npm install` followed by `npm run dev`; the development server uses port 5173.

## Configuration

Copy `.env.example` to `.env` and set your Clerk publishable key. Vite exposes `VITE_*` values to the browser, so do not place secret keys in these variables.

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk patient authentication publishable key | Required |
| `VITE_API_URL` | MediCare API base URL | `http://localhost:4000` |
| `VITE_WORKFORCE_URL` | Staff portal base URL | `http://localhost:5175` |
| `VITE_CURRENCY` | Currency shown for current doctor and service fees | `BDT` |

Set `VITE_CURRENCY` to the same value as the backend `PAYMENT_CURRENCY`; supported values are `BDT` and `INR`. The selected deployment currency is Bangladeshi taka (`BDT`). Restart the development server or rebuild the site after changing these values.

Appointment history uses each saved payment's currency. Historical online payments without a saved currency were charged in INR and remain labeled INR; historical cash bookings retain BDT. Amounts are never converted or relabeled as another currency. The doctor revenue overview groups totals by currency.

## Validation

- `npm run build` creates the production website in `dist`.
- `npm run lint` checks source code.
- `node --test src/lib/format.test.js src/lib/api.test.js` runs booking, payment, pagination, validation, and currency regressions.
