# MediCare administration and staff portal

This is the existing MediCare administration and workforce application.
Patients continue to use Clerk in the patient frontend. Staff accounts use
administrator-provided email/password credentials and a backend-issued JWT.

## Local setup

The admin Vite configuration shares environment files with the patient app:
it reads `Frontend/.env` and `Frontend/.env.local`, not `admin/.env`.
Set `VITE_API_URL` when the backend is not running at `http://localhost:4000`.
Set `VITE_CURRENCY` to the same value as backend `PAYMENT_CURRENCY` (`BDT` by
default). Changing the display currency does not convert stored prices. Booking
history keeps its recorded currency; older online bookings without a currency
are treated as INR. Revenue summaries show each currency separately.

Run the applications:

```bash
cd Backend
npm start

cd ../admin
npm run dev

# In another terminal, run the authenticated workforce portal
npm run dev:staff
```

Open `http://localhost:5174/admin/login` for administrator sign in. Set
`VITE_CLERK_PUBLISHABLE_KEY` in `Frontend/.env.local` and configure the
matching Clerk credentials on the backend. An administrator's Clerk account
must have server-managed public metadata `{ "role": "admin" }`; signing in
alone never grants administrative access. The API verifies this role.

For isolated local development only, an optional no-login workspace requires
both `VITE_ENABLE_LOCAL_ADMIN=true` in `Frontend/.env.local` and
`ENABLE_LOCAL_ADMIN=true` in `Backend/.env`. It is disabled by default, accepts
only loopback requests from port 5174, and is rejected in production. Restart
both servers after changing these flags.

Authenticated workforce portals run from the same maintained codebase on a
separate local origin so the no-login Admin bypass cannot intercept staff
sessions:

- `http://localhost:5175/nurse/login`
- `http://localhost:5175/pathologist/login`
- `http://localhost:5175/hr/login`
- `http://localhost:5175/freelancer/login`

Each route has its own email/password form. Signing out returns to the portal
directory, which also links to the separate administrator sign-in page.
Staff routes work on either admin port and do not require Clerk configuration.
Set `VITE_WORKFORCE_URL` only when hosting staff on a separate origin. For
production deployments, set `VITE_PATIENT_URL` to the patient website origin
so patient and doctor portal links resolve to that application.

After authentication, each role remains inside its own route space instead of
the administrator root:

- Nurse: `http://localhost:5175/nurse-portal`
- Pathologist: `http://localhost:5175/pathologist-portal`
- HR: `http://localhost:5175/hr-portal`
- Freelancer: `http://localhost:5175/freelancer-portal`

## Role portals

The operations app now serves five backend-authorized workspaces from the same
codebase:

- **Admin** — doctors, appointments, services, staff, duties, laboratory,
  recruitment, announcements, and freelancer assignments.
- **Nurse** — role dashboard, personal duty schedule, assigned patient context,
  announcements, and profile.
- **Pathologist** — assigned laboratory queue, sample/status workflow, factual
  result submission, announcements, and profile.
- **HR** — workforce directory, duty scheduling, jobs, applicants,
  announcements, and freelancer coordination. Clinical appointment details are
  omitted from HR schedule responses.
- **Freelancer** — personal assignments, controlled status progression,
  announcements, and profile.

The patient app remains at port 5173 and includes completed lab results. The
existing doctor workspace includes a laboratory order screen linked to the
doctor's own patient appointments.

## Operations API

The backend exposes the new modules under `/api/shifts`, `/api/lab-tests`,
`/api/jobs`, `/api/applicants`, `/api/announcements`,
`/api/freelancer-assignments`, and `/api/dashboard`. With the exception of the
public open-job listing and application submission, these endpoints require a
verified actor and enforce role/ownership rules on the server.

## Staff login credentials

1. Admin opens **Staff Management** and creates the employee record.
2. Admin enters the employee email, assigned role, and an initial password of at
   least eight characters.
3. The backend hashes the password with bcrypt; the plaintext password is never
   returned by the API.
4. The employee opens the login URL for the assigned role and enters the email
   and password provided by Admin.
5. The backend verifies the credentials and issues a seven-day staff JWT. The
   role is loaded from MongoDB, not trusted from the browser or token alone.

For an existing staff record created before password login was added, Admin must
edit the record once and enter a new password. Inactive staff cannot sign in.

## Staff profile images

Authenticated staff can upload, replace, or remove their own profile image from
the **My Profile** page. Uploads accept JPG, PNG, and WebP files up to 5 MB and
reuse the existing Cloudinary configuration. Replaced Cloudinary images are
cleaned up after the profile update succeeds.

## Verification

```bash
npm run lint
npm run build

cd ../Backend
npm test
```
