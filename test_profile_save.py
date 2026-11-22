import os, json, urllib.request, re

env = {}
with open('/home/workspace/M23FOR3-15/.env.local') as f:
    for line in f:
        if '=' in line:
            k, v = line.strip().split('=', 1)
            env[k] = v

url = env['VITE_SUPABASE_URL']
key = env['VITE_SUPABASE_ANON_KEY']
erik_id = 'fe33d54c-9c91-4fd9-a988-8e5992fc9489'

# Get original
req = urllib.request.Request(
    f'{url}/rest/v1/User?id=eq.{erik_id}&select=phone,businessName,endDate,startDate,emergencyContactName,emergencyContactPhone,emergencyContactEmail,display_name',
    headers={'apikey': key, 'Authorization': f'Bearer {key}'}
)
orig = json.loads(urllib.request.urlopen(req).read())[0]
print(f"Original: {orig}")

# Apply the same mapper the app uses
COLUMN_ALIASES = {
    'end_date': 'endDate', 'start_date': 'startDate',
    'full_name': 'fullName', 'profile_complete': 'profileComplete',
    'business_name': 'businessName',
    'shadowing_end_date': 'shadowingEndDate', 'shadowing_start_date': 'shadowingStartDate',
    'sunbelt_cert_end_date': 'sunbeltCertEndDate', 'sunbelt_cert_start_date': 'sunbeltCertStartDate',
    'sunbelt_cert_status': 'sunbeltCertStatus', 'sunbelt_cert_notes': 'sunbeltCertNotes',
    'emergency_contact_name': 'emergencyContactName', 'emergency_contact_phone': 'emergencyContactPhone',
    'emergency_contact_email': 'emergencyContactEmail', 'qc_assignment': 'qcAssignment',
    'invoice_review_reason': 'invoiceReviewReason', 'inactive_reason': 'inactiveReason',
    'inactive_date': 'inactiveDate', 'avg_qc_score': 'avgQcScore',
    'late_arrivals': 'lateArrivals', 'needs_invoice_review': 'needsInvoiceReview',
    'velo_survey_feedback': 'veloSurveyFeedback', 'velociti_score': 'velocitiScore',
    'onboarding_completed': 'onboardingCompleted', 'weekly_pay': 'weeklyPay',
    'm2_pm': 'm2pm', 'velo_pm': 'velopm',
}
def camel_to_snake(key):
    s = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1_\2', key)
    s = re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', s)
    return s.lower()
def to_db_key(key):
    return COLUMN_ALIASES.get(camel_to_snake(key), camel_to_snake(key))

# Simulate exactly what the form sends
form_payload = {
    'phone': '9362290834',
    'businessName': '7B Associates',
    'endDate': orig['endDate'],
    'startDate': orig['startDate'],
    'emergencyContactName': 'Berenice Baltazar',
    'emergencyContactPhone': '9362122099',
    'emergencyContactEmail': 'Velasquez_b@ymail.com',
    'displayName': 'Erik Baltazar',
    'profileComplete': True,
    'm2PM': 'Austin Sinks',
    'veloPM': 'Rob Hyberger',
    'qcAssignment': 'Ryan Miller',
    'project': 'Sunbelt',
    'location': 'DFW',
    'weeklyPay': 1700,
    'active': True,
    'shadowingStatus': 'completed',
    'email': 'ebaltazar.contractor@m2fleetcom.com',
    'business': None,
}

mapped = {to_db_key(k): v for k, v in form_payload.items() if v is not None and v != ''}
print(f"\nMapped payload keys: {list(mapped.keys())}")
print(f"Mapped payload: {json.dumps(mapped, indent=2)[:600]}")

patch_req = urllib.request.Request(
    f'{url}/rest/v1/User?id=eq.{erik_id}',
    data=json.dumps(mapped).encode(),
    headers={
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
    },
    method='PATCH'
)
try:
    urllib.request.urlopen(patch_req)
    print("\n✓ FULL PROFILE SAVE SUCCEEDED — all fields accepted by Supabase")
except urllib.error.HTTPError as e:
    print(f"\n✗ FAILED: {e.code} {e.read().decode()[:500]}")
