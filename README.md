# Health Watcher

Build the frontend for an existing application called WATERWATCH.

IMPORTANT:
This is an EXISTING FastAPI backend. Do NOT invent backend endpoints, database models, mock API layers, or alternate business logic.

Keep the frontend design MINIMAL and functional. Do not waste implementation effort on fancy landing-page animations, excessive cards, gradients, illustrations, or complicated design systems.

The ONE visually important component should be the disease surveillance MAP with an attractive heatmap.

Tech:
- React + TypeScript
- Tailwind CSS
- Use a lightweight mapping library such as Leaflet/react-leaflet
- Use Lucide icons
- Responsive desktop/mobile
- Clean healthcare/public-health aesthetic
- Minimal white/light UI
- Small number of reusable components
- No unnecessary animations

==================================================
BACKEND
==================================================

Local API:

http://localhost:8000

Production/Tailscale API will be:

https://<machine>.<tailnet>.ts.net

Make the API base URL configurable with:

VITE_API_BASE_URL

All REST responses use:

{
  "success": true,
  "data": {},
  "error": null
}

or:

{
  "success": false,
  "data": null,
  "error": {
    "code": "...",
    "message": "..."
  }
}

Protected requests require:

Authorization: Bearer <JWT>
Content-Type: application/json

Login/register return a JWT and role.

==================================================
AUTHENTICATION
==================================================

POST /api/v1/auth/register

Patient example:

{
  "role": "PATIENT",
  "full_name": "Asha Singh",
  "email": "asha@example.com",
  "password": "minimum-6-characters",
  "phone": "9876543210",
  "age": 28,
  "gender": "FEMALE",
  "latitude": 26.4499,
  "longitude": 80.3319
}

Doctor registration additionally supports:

specialization
license_number
clinic_id
latitude
longitude

POST /api/v1/auth/login

Body:

{
  "email": "asha@example.com",
  "password": "minimum-6-characters"
}

Response data:

{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "role": "PATIENT",
  "user_id": "<uuid>"
}

Save the JWT securely and route based on role.

Roles:

PATIENT
DOCTOR
ADMIN

Only build patient and doctor dashboards. ADMIN can be handled minimally.

==================================================
PATIENT FRONTEND
==================================================

Patient endpoints:

GET /api/v1/patient/me

PUT /api/v1/patient/me

Fields that can be updated:
- full_name
- phone
- age
- gender
- latitude
- longitude

POST /api/v1/patient/symptoms

Body:

{
  "symptoms": ["DIARRHEA", "VOMITING", "FEVER"],
  "duration_hours": 24,
  "temperature": 38.5,
  "severity": "MODERATE",
  "notes": "Optional"
}

Allowed symptoms:

DIARRHEA
VOMITING
FEVER
ABDOMINAL_PAIN
DEHYDRATION
NAUSEA
BLOOD_IN_STOOL
HEADACHE
WEAKNESS
MUSCLE_CRAMPS

Severity:

MILD
MODERATE
SEVERE

The response contains:
- predicted_disease
- is_water_borne
- confidence
- model_version
- precautions
- disclaimer

ALWAYS display the prediction disclaimer visibly.
It is NOT a confirmed medical diagnosis.

GET /api/v1/patient/predictions

GET /api/v1/predictions/{prediction_id}

GET /api/v1/patient/appointments

POST /api/v1/patient/appointments

GET /api/v1/patient/disease-activity

Query:
radius_km
disease

GET /api/v1/patient/nearby-clinics

Query:
radius_km

GET /api/v1/patient/dashboard

Use this as the primary initial dashboard request rather than making many separate requests.

Dashboard contains:

profile
disease_activity
rising_diseases
outbreak_alerts
map.cells
upcoming_appointments
unread_notification_count
notifications
nearby_clinics
recent_predictions

==================================================
PATIENT DASHBOARD
==================================================

Keep it compact.

Suggested layout:

Header:
WaterWatch + user + notification icon

Main:
--------------------------------
Local Disease Risk     [status]
Cases nearby           Growth %
--------------------------------

[ LARGE SURVEILLANCE MAP ]

--------------------------------
Environmental Risk
--------------------------------

Recent Prediction

Upcoming Appointment

Notifications

Do NOT create 15 separate cards.

The MAP should occupy the largest visual area.

==================================================
ENVIRONMENTAL RISK
==================================================

Patient-only:

GET /api/v1/environmental-risk/me

Response:

{
  "risk_level": "ELEVATED",
  "risk_score": 0.72,
  "potential_water_borne_diseases": ["CHOLERA", "TYPHOID"],
  "potential_vector_borne_diseases": ["MALARIA"],
  "contributing_factors": [
    {
      "factor": "FLOODING",
      "severity": "HIGH",
      "reason": "Recent local flooding"
    }
  ],
  "prevention_guidance": [
    "Use treated water",
    "Avoid standing water"
  ],
  "data_status": "LIVE_ENVIRONMENTAL_MODEL",
  "assessed_at": "...",
  "disclaimer": "..."
}

Show this as a compact environmental-risk panel.

Do NOT call this a disease diagnosis or outbreak prediction.

If data_status is:

NO_LIVE_ENVIRONMENTAL_DATA

show that honestly.

==================================================
DOCTOR FRONTEND
==================================================

Doctor endpoints:

GET /api/v1/doctor/me

PUT /api/v1/doctor/me

POST /api/v1/doctor/slots

Body:

{
  "start_time": "...",
  "end_time": "..."
}

GET /api/v1/doctor/slots

PUT /api/v1/doctor/slots/{slot_id}

DELETE /api/v1/doctor/slots/{slot_id}

GET /api/v1/doctor/appointments

GET /api/v1/doctor/appointments/{appointment_id}

POST /api/v1/doctor/cases

PUT /api/v1/doctor/cases/{case_id}

GET /api/v1/doctor/surveillance

GET /api/v1/doctor/dashboard

==================================================
DOCTOR CASE REGISTRATION
==================================================

POST /api/v1/doctor/cases

Example:

{
  "disease": "CHOLERA",
  "case_status": "CONFIRMED",
  "patient_id": null,
  "age": 50,
  "gender": "FEMALE",
  "latitude": 26.4499,
  "longitude": 80.3319,
  "clinic_id": null,
  "symptoms": ["DIARRHEA", "DEHYDRATION"],
  "symptom_onset": "2026-08-16T08:00:00Z",
  "notes": "Optional clinician notes",
  "reported_at": "2026-08-16T10:00:00Z"
}

Diseases:

CHOLERA
TYPHOID
HEPATITIS_A
HEPATITIS_E
DYSENTERY
ROTAVIRUS
OTHER_WATER_BORNE

Case status:

SUSPECTED
PROBABLE
CONFIRMED
RECOVERED
REJECTED

IMPORTANT:

patient_id can be NULL.

This represents an unregistered/walk-in patient.

Do NOT force the doctor to create a fake patient account.

==================================================
DOCTOR DASHBOARD
==================================================

GET /api/v1/doctor/dashboard

Contains:

profile
todays_appointments
upcoming_appointments
appointment_count
recent_cases
disease_activity
rising_diseases
outbreak_alerts
notifications
map.cells
available_slots

Suggested layout:

Header

Today's appointments

[ LARGE SURVEILLANCE MAP ]

Recent disease cases

Active outbreak alerts

Available slots

Keep it minimal.

==================================================
SURVEILLANCE MAP
==================================================

THIS IS THE MOST IMPORTANT UI COMPONENT.

Endpoint:

GET /api/v1/surveillance/map

Query parameters:

latitude
longitude
radius_km=10
disease (optional)
time_window_days=7

Example:

GET /api/v1/surveillance/map?latitude=26.4499&longitude=80.3319&radius_km=10&time_window_days=7

Response contains coarse anonymous cells:

{
  "cells": [
    {
      "cell_id": "1322_4016",
      "latitude": 26.45,
      "longitude": 80.33,
      "case_count": 7,
      "diseases": {
        "CHOLERA": 5,
        "TYPHOID": 2
      },
      "activity_level": "ELEVATED"
    }
  ]
}

Activity levels:

NORMAL
WATCH
ELEVATED
HIGH
CRITICAL

IMPORTANT PRIVACY RULE:

NEVER render individual patients.

NEVER request or display:
- patient ID
- doctor ID
- patient name
- age
- gender
- individual coordinates
- individual case records

Only render the anonymous coarse map cells returned by the endpoint.

==================================================
MAP DESIGN
==================================================

Use Leaflet/react-leaflet.

Default center:

26.4499, 80.3319

This is the Kanpur demo area.

Create an appealing public-health heatmap.

Each returned cell should become a heatmap/grid/cluster visualization.

Use case_count and activity_level to determine visual intensity.

Recommended visual hierarchy:

NORMAL      → subtle/green
WATCH       → yellow
ELEVATED    → orange
HIGH        → red-orange
CRITICAL    → red

Use translucent circular heat regions or soft grid cells rather than ugly large markers.

The map should feel like a professional disease surveillance dashboard.

Add:

- zoom controls
- map legend
- disease filter
- time-window selector if simple to implement
- "Center on my area" button
- case count on hover/click
- disease breakdown on hover/click

Example popup:

ELEVATED

7 reported cases

Cholera       5
Typhoid       2

Last 7 days

Do NOT show exact patient locations.

Do NOT calculate a second frontend risk algorithm.
Use the backend's activity_level directly.

==================================================
SURVEILLANCE ENDPOINTS
==================================================

GET /api/v1/surveillance/nearby

Query:
latitude
longitude
radius_km=10
disease?
time_window_days=7

Returns aggregate nearby statistics.

GET /api/v1/surveillance/map

Used ONLY for geographic visualization.

GET /api/v1/surveillance/activity

Query:
latitude
longitude
radius_km
disease?

Returns local activity and growth.

GET /api/v1/surveillance/outbreaks

Query:
latitude?
longitude?
radius_km=50
active_only=true

Returns active outbreak alerts.

Do not implement outbreak calculations in frontend.

==================================================
NOTIFICATIONS
==================================================

GET /api/v1/notifications

PATCH /api/v1/notifications/{notification_id}/read

PATCH /api/v1/notifications/read-all

Build a small notification dropdown/panel.

==================================================
REALTIME WEBSOCKET
==================================================

After login connect to:

ws://localhost:8000/ws?token=<JWT>

Production:

wss://<api-host>/ws?token=<JWT>

Do NOT poll the API.

REST is for initial state.
WebSocket is for realtime changes.

Events:

NEW_CASE
SURVEILLANCE_UPDATED
OUTBREAK_ALERT
APPOINTMENT_BOOKED
NOTIFICATION

Behavior:

NEW_CASE:
Optionally refresh high-level surveillance.

SURVEILLANCE_UPDATED:
Call /api/v1/surveillance/map ONCE for the current map area and update the map.

OUTBREAK_ALERT:
Show a prominent but compact alert and refresh outbreak data.

APPOINTMENT_BOOKED:
Refresh appointments.

NOTIFICATION:
Update notification UI.

Use exponential backoff for reconnects.

Close WebSocket on logout.

Never log the JWT.

==================================================
OUTBREAK FLOW
==================================================

Understand this architecture:

Patient symptom prediction
        ↓
Prediction history

is NOT the same as:

Doctor disease case
        ↓
PostGIS surveillance
        ↓
Outbreak evaluation

Only doctor-created disease cases participate in outbreak surveillance.

When a case causes surveillance changes:

Doctor creates case
        ↓
Backend stores case
        ↓
PostGIS surveillance updates
        ↓
Backend evaluates outbreak
        ↓
Redis Pub/Sub
        ↓
WebSocket
        ↓
Frontend receives OUTBREAK_ALERT
        ↓
Map/dashboard updates

The frontend does NOT implement outbreak detection.

==================================================
ERROR HANDLING
==================================================

All API responses use the success/data/error envelope.

For API errors:

Show a small clean toast/message.

Do not dump raw backend errors into the UI.

Handle:

401 → logout/re-authenticate
403 → access denied
409 → show conflict message
422 → validation errors
503 → service unavailable

==================================================
HEALTH
==================================================

GET /health
GET /health/db
GET /health/redis
GET /health/ml

Optional small developer/system status page.

Do not make this a major UI feature.

==================================================
DEVELOPMENT SIMULATOR
==================================================

These are development-only:

POST /api/v1/dev/simulate-case
POST /api/v1/dev/simulate-outbreak

Do NOT expose these controls in normal production UI.

They can be hidden behind a small development mode check.

==================================================
DESIGN REQUIREMENTS
==================================================

Minimal.

No giant hero section.

No marketing landing page.

No excessive gradients.

No glassmorphism everywhere.

No unnecessary animations.

No giant typography.

Use:

- clean white/light background
- dark text
- subtle borders
- compact cards
- small status badges
- Lucide icons
- good spacing
- responsive layout

The map is the visual centerpiece.

Use a dark or light map style that makes heat points easy to see.

Make the surveillance map feel like a real public-health command center without making the entire application visually complicated.

==================================================
IMPLEMENTATION PRIORITY
==================================================

Build in this order:

1. Authentication + role routing
2. Patient dashboard
3. Doctor dashboard
4. Reusable API client with JWT
5. Surveillance map
6. WebSocket realtime events
7. Notifications
8. Symptom checker
9. Environmental risk card
10. Doctor case registration
11. Appointments/slots

Do not create fake backend data once API integration is available.

Use loading skeletons only where useful.

Keep components reusable but don't over-engineer them.

The final application should look like a polished hackathon MVP, not a huge enterprise dashboard.

Most importantly:

MAKE THE SURVEILLANCE MAP LOOK GOOD.
Everything else should remain minimal.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://watch-sight.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8139dbc5-18e5-4fcd-a6b8-e990160ac686).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
