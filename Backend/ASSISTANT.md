# Local assistant and MCP

MediCare uses the existing MongoDB Atlas database for clinic records and Ollama on
the backend computer for local model inference. Each signed-in doctor gets a
private assistant context based on that doctor's verified account. Doctors share
one model process; they do not share conversations or patient access.

## Start it on this PC

Ollama and `qwen2.5:1.5b` are already installed. Start the Ollama desktop app, then
start the backend and patient website using the commands in the root README.
If the Ollama desktop app is not running, a separate terminal can run:

```powershell
ollama serve
```

Do not start a second Ollama server if port 11434 is already in use. The backend
checks the configured local model automatically. Open `http://localhost:5173` and
choose **Ask MediCare**. In the signed-in doctor portal choose **My assistant**.

On another computer, install Ollama and download the model first:

```powershell
ollama pull qwen2.5:1.5b
```

Optional settings belong in `Backend/.env`, never in frontend environment files:

```dotenv
ASSISTANT_ENABLED=true
ASSISTANT_OLLAMA_URL=http://127.0.0.1:11434
ASSISTANT_MODEL=qwen2.5:1.5b
```

The defaults already match this PC. Only loopback HTTP model endpoints are
accepted. Cloud model names and cloud-backed aliases are rejected, including a
metadata check before inference. The installed 3B model is an optional setting,
but the 1.5B model is the default for this 8 GB, CPU-only development computer.
The first generated response can take longer while the model loads. Model
generation is limited to one concurrent request, with a 90-second timeout and
220 output tokens. Lookup and booking forms can work while the model is offline.

## What the assistant does

- Patients and visitors can find real doctors, fees, services, and available times.
- Signed-in patients can ask for their own appointments.
- A patient reviews doctor, date, time, fee, personal details, and payment method,
  then explicitly clicks **Confirm appointment**. The existing booking endpoint
  verifies the patient session and current availability, handles duplicate slots,
  records BDT pricing, and runs the existing checkout flow when selected.
- Doctors can ask **My schedule today**, **Upcoming patients**, or **My weekly
  availability**. **View saved notes** reads an owned appointment and laboratory
  records ordered by that same doctor for that appointment. Results are bounded
  excerpts; the full original record remains the clinical source of truth.
- A small reviewed reference library explains appointment preparation, medicine
  safety, laboratory preparation/results, diabetes, and high blood pressure.
  Answers link to the specific MedlinePlus, WHO, or NHS source. Unsupported
  clinical questions get a bounded response, not unsourced model advice.

The assistant keeps a small conversation context so follow-ups such as
"tomorrow", "the second one", and "10am" retain the selected doctor and date.
All selections are checked again against current clinic data. Changing a date or
an ambiguous doctor selection clears the old booking draft. An unavailable slot
returns fresh alternatives. **Start a new chat** clears the conversation.

Common spelling variants such as "nxt avaiable time" follow the same booking
path as "next available time". Ordinary skin, hair, and nail concerns can lead
to dermatologist lookup, using the [AAD specialty definition](https://www.aad.org/public/fad/what-is-a-derm).
This selects a type of clinician, not a diagnosis or treatment. Emergency and
medication questions retain priority. Doctors without published appointment
times are identified explicitly; chat does not invent their availability.

The intent schema is restricted to the authenticated account role. Patient and
guest requests cannot select doctor-only schedules or records, even when the
model returns an incorrect intent. Booking follow-ups retain the selected
doctor; ambiguous requests get a patient-appropriate clarification.

Schedule answers use short conversational summaries, with the next appointment
first and more details available on request. Upcoming views exclude elapsed,
canceled, and completed visits in Bangladesh time. Explicit history/status
requests can include those records. Displayed appointment selections retain
their identity even if the upcoming schedule changes between messages.

The local model interprets unfamiliar wording through a constrained intent schema
and supplies brief social replies. Common lookups work without inference, and
database facts are phrased directly from verified results so model prose cannot
invent a patient, appointment, fee, or a completed action. Chat never writes appointments,
cancels visits, prescribes treatment, or sends notifications. The patient form is
the explicit booking action. There are no automatic reminders or background
clinical decisions in this version.

Conversation history lives only in component memory and is cleared when account
identity changes or the page reloads. It is not saved in MongoDB or browser
storage. Requests and record contents are not logged by the assistant. Existing
Atlas and authentication services still use the internet; local inference does
not make the entire website an offline application.

## MCP connection

The actual stateless Streamable HTTP endpoint is:

```text
http://localhost:4000/api/assistant/mcp
```

It is implemented with the official MCP v2 server and Node transport packages.
The website assistant and MCP server share the same validated, role-scoped tool
service. The website calls that service internally; external MCP clients use the
HTTP protocol. The server does not expose arbitrary MongoDB queries or write
tools.

Use an MCP client that supports a configured `Authorization: Bearer <token>`
header. A doctor uses their current doctor login JWT; a patient uses their
current Clerk session token. Tokens must be kept private and refreshed when they
expire. This endpoint uses existing application authentication, not a separate
MCP OAuth discovery/login flow. An administrator bypass, a guest, or an expired
token cannot access it.

| Tool | Access |
| --- | --- |
| `find_doctors` | Patient, doctor |
| `list_services` | Patient, doctor |
| `get_available_slots` | Patient, doctor |
| `prepare_booking` | Patient; returns a draft requiring website confirmation |
| `my_appointments` | Only the signed-in patient's bookings |
| `my_schedule` | Only the signed-in doctor's schedule and appointments |
| `my_patients` | Only appointments assigned to the signed-in doctor |
| `get_patient_context` | An owned appointment and its doctor-scoped laboratory records |

The three private list tools accept `from`, `to`, `limit`, `view`, and optional
`status`. Dates and appointment times use `Asia/Dhaka`. The default
`view: "upcoming"` returns remaining active appointments, excluding elapsed,
completed, and canceled visits. Use `view: "all"` for history. An exact status
filter accepts `Pending`, `Confirmed`, `Completed`, `Canceled`, or `Rescheduled`;
`Completed` and `Canceled` require `view: "all"`. Status and date filters always
remain restricted to the signed-in account. `meta.total` counts appointments,
not unique patients; if `meta.countIsExact` is false, it is a lower bound because
the read is capped at 500 matching records. `meta.truncated` also reports when
the returned list is shorter than the counted records. Recurring weekly slots
describe published working times, not confirmed free appointments.

Public website chat can use the public lookup tools without an account; the MCP
endpoint itself always requires authentication. Tool input cannot supply another
doctor or patient identity for private queries. Each MCP request constructs a
separate server bound to its verified actor, so there are no reusable shared
MCP sessions. All exposed tools are read-only; booking preparation is not a
reservation or evidence of a completed booking.

For a local protocol check, set `MEDICARE_MCP_TOKEN` privately in your terminal
to your own current application token, then use:

```powershell
$headers = @{
  Authorization = "Bearer $env:MEDICARE_MCP_TOKEN"
  Accept = "application/json, text/event-stream"
  'MCP-Protocol-Version' = '2025-11-25'
}
$body = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"medicare-local-check","version":"1.0.0"}}}'
Invoke-RestMethod -Method Post -Uri 'http://localhost:4000/api/assistant/mcp' -Headers $headers -ContentType 'application/json' -Body $body
$body = '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
Invoke-RestMethod -Method Post -Uri 'http://localhost:4000/api/assistant/mcp' -Headers $headers -ContentType 'application/json' -Body $body
```

Host and Origin checks default to the local API and patient frontend. A future
deployment must explicitly configure `ASSISTANT_MCP_ALLOWED_HOSTS` and
`ASSISTANT_MCP_ALLOWED_ORIGINS` (comma-separated exact values), use HTTPS, and
retain account authentication. Do not expose the Ollama port directly.

## Verification

```powershell
cd Backend
node --test tests/assistantChat.test.js tests/assistantConversation.test.js tests/assistantRouting.test.js tests/assistantTools.test.js tests/assistantMcp.test.js tests/assistantKnowledge.test.js
```

Tests cover account isolation, private record projections, input limits, Dhaka
time, unavailable/taken slots, confirmation-only drafts, real MCP HTTP transport,
Host/Origin checks, model outages, cloud alias rejection, capacity limits, and
bounded clinical responses. Booking UI verification uses intercepted synthetic
responses so verification does not create real appointments.

Implementation references: [Ollama chat](https://docs.ollama.com/api/chat),
[Ollama tools](https://docs.ollama.com/capabilities/tool-calling), and the
[official MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk).
