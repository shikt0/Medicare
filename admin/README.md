# MediCare administration and staff portal

This is the existing MediCare administration and workforce application.
Patients continue to use Clerk in the patient frontend. Staff accounts use
administrator-provided email/password credentials and a backend-issued JWT.

## Local setup

The Vite configuration reads local environment variables from `../Frontend`.
Set `VITE_API_URL` when the backend is not running at `http://localhost:4000`.

Run the applications:

```bash
cd Backend
npm start

cd ../admin
npm run dev

# In another terminal, run the authenticated workforce portal
npm run dev:staff
```

Open `http://localhost:5174` for the local no-login administrator workspace and
open **Staff management** from the sidebar.

During local Vite development on exactly `http://localhost:5174`, the admin
workspace uses a localhost-only development bypass and opens without Clerk
sign-in. The backend rejects this bypass for the patient port, non-local
origins, and whenever `NODE_ENV=production`.

Authenticated workforce portals run from the same maintained codebase on a
separate local origin so the no-login Admin bypass cannot intercept staff
sessions:

- `http://localhost:5175/nurse/login`
- `http://localhost:5175/pathologist/login`
- `http://localhost:5175/hr/login`
- `http://localhost:5175/freelancer/login`

Each route has its own email/password form. Signing out returns to the portal
directory. There is intentionally no administrator option in that directory.

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
