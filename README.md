# TrackSmart

TrackSmart is a Flask/MongoDB delivery-tracking prototype. The main
application serves user, delivery-partner, and company pages; QR identifiers
connect an order to location updates and delivery completion.

## Implemented flows

- Company registration/login and company dashboard.
- Delivery-partner registration/login, role selection, and live location
  updates.
- User registration/login and QR-based access checks.
- QR creation, activation, lookup, assignment, and tracking.
- MongoDB-backed company, user, partner, location, and QR-specific records.
- Optional email notifications and HERE Maps key delivery to the frontend.
- Company order, employee, and employee-analytics endpoints.

The current source is a single `app.py`; the repository also contains
deployment notes for separate `user_app.py`, `delivery_app.py`, and
`company_app.py` services, but those service files are not present in the
checked-in root inventory. Verify `render.yaml` before using a multi-service
deployment.

## Local setup

`render_requirements.txt` contains Flask 3.0.0, Gunicorn 23.0.0, PyMongo
4.13.2, Werkzeug 3.0.1, and dnspython 2.4.2.

```bash
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r render_requirements.txt
export MONGODB_URI='your-mongodb-uri'
export SESSION_SECRET="$(python -c 'import secrets; print(secrets.token_hex(32))')"
python app.py
```

Use the port supplied by the environment (Render sets `PORT`); local Flask
defaults are defined by the application. Do not put database or HERE keys in
source control.

## Route map

```text
/, /qr, /scan, /delivery, /user
/user/dashboard, /company, /company/login, /company/dashboard
/company/register, /company/login
/store-location, /activate-qr/<qr_id>
/store-live-location, /stop-qr-tracking
/locations, /live-locations, /api/qr-code/<qr_id>
/api/check-qr-access/<qr_id>/<user_id>
/api/qr-tracking/<qr_id>, /api/mark-delivered
/api/company/<id>/orders
/api/company/<id>/employees
/api/company/<id>/employee/<name>/analytics
```

## Deployment

`render.yaml`, `DEPLOYMENT.md`, and `RENDER_DEPLOYMENT_SUMMARY.md` describe a
Render Blueprint and service commands. The application uses MongoDB
collections for QR-specific tracking and needs the same database configuration
where services are split.

## Security status

This is a prototype. The deployment notes explicitly identify plain-text
password handling and recommend hashing, rate limiting, stronger
authentication, and other hardening. Treat session secrets, MongoDB URIs, HERE
keys, and email credentials as deployment secrets. Review authorization on QR
access and company routes before exposing the app publicly. No automated test
suite is included.
