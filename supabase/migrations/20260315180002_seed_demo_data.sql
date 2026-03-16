delete from public."ChatMessage" where "userEmail" is null or "userEmail" = 'probe@example.com';
delete from public."ChannelMember" where "userEmail" = 'probe@example.com';
delete from public."Channel" where name = 'Probe Channel';
delete from public."WorkersCompRecord" where "userEmail" = 'probe@example.com';
delete from public."SafetyCertification" where "userEmail" = 'probe@example.com';
delete from public."Invoice" where "contractorEmail" = 'probe@example.com';
delete from public."QCInspection" where "technicianId" is null and notes is null;
delete from public."Task" where title = 'Probe task';
delete from public."DirectMessageThread" where "participantEmails" = array['probe@example.com'];
delete from public."User" where email = 'probe@example.com';

insert into public."User" (
  id, email, display_name, full_name, m2pm, "velocitiScore", "avgQcScore", active, project, "shadowingStatus", absences, "lateArrivals"
) values
  ('11111111-1111-4111-8111-111111111111', 'austin@m2fleetcom.com', 'Austin Sinks', 'Austin Sinks', null, 97, 96, true, 'Leadership', 'completed', 0, 0),
  ('22222222-2222-4222-8222-222222222222', 'pm.west@m2fleetcom.com', 'Casey Walker', 'Casey Walker', null, 93, 91, true, 'West Region', 'completed', 0, 1),
  ('33333333-3333-4333-8333-333333333333', 'pm.east@m2fleetcom.com', 'Jordan Lee', 'Jordan Lee', null, 91, 89, true, 'East Region', 'completed', 0, 0),
  ('44444444-4444-4444-8444-444444444444', 'ryan@m2fleetcom.com', 'Ryan QC', 'Ryan QC', null, 95, 98, true, 'Quality Control', 'completed', 0, 0),
  ('55555555-5555-4555-8555-555555555555', 'alex.contractor@m2fleetcom.com', 'Alex Carter', 'Alex Carter', 'Casey Walker', 88, 90, true, 'Phoenix Fiber', 'completed', 1, 0),
  ('66666666-6666-4666-8666-666666666666', 'jamie.contractor@m2fleetcom.com', 'Jamie Brooks', 'Jamie Brooks', 'Casey Walker', 76, 79, true, 'Phoenix Fiber', 'in_progress', 2, 1),
  ('77777777-7777-4777-8777-777777777777', 'morgan.contractor@smcinstallations.com', 'Morgan Price', 'Morgan Price', 'Jordan Lee', 84, 86, true, 'Atlanta Build', 'completed', 0, 2),
  ('88888888-8888-4888-8888-888888888888', 'taylor.contractor@m2fleetcom.com', 'Taylor Reed', 'Taylor Reed', 'Jordan Lee', 68, 74, true, 'Atlanta Build', 'in_progress', 3, 2)
on conflict (id) do update set
  email = excluded.email,
  display_name = excluded.display_name,
  full_name = excluded.full_name,
  m2pm = excluded.m2pm,
  "velocitiScore" = excluded."velocitiScore",
  "avgQcScore" = excluded."avgQcScore",
  active = excluded.active,
  project = excluded.project,
  "shadowingStatus" = excluded."shadowingStatus",
  absences = excluded.absences,
  "lateArrivals" = excluded."lateArrivals";

insert into public."Task" (
  id, title, description, status, "assignedToId", "createdById", priority, due_date, metadata
) values
  ('90000000-0000-4000-8000-000000000001', 'Review missing COI for Jamie Brooks', 'Upload workers comp certificate and confirm expiration date.', 'Open', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'high', now() + interval '2 days', '{"technicianId":"66666666-6666-4666-8666-666666666666","technicianName":"Jamie Brooks","category":"Compliance"}'::jsonb),
  ('90000000-0000-4000-8000-000000000002', 'QC follow-up on Taylor Reed', 'Needs ride-along and retraining after low QC score.', 'In Progress', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444', 'high', now() + interval '4 days', '{"technicianId":"88888888-8888-4888-8888-888888888888","technicianName":"Taylor Reed","category":"Quality"}'::jsonb),
  ('90000000-0000-4000-8000-000000000003', 'Collect onboarding docs from Morgan Price', 'Need updated license and banking form.', 'Open', '33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'medium', now() + interval '5 days', '{"technicianId":"77777777-7777-4777-8777-777777777777","technicianName":"Morgan Price","category":"Onboarding"}'::jsonb)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  status = excluded.status,
  "assignedToId" = excluded."assignedToId",
  "createdById" = excluded."createdById",
  priority = excluded.priority,
  due_date = excluded.due_date,
  metadata = excluded.metadata;

insert into public."WorkersCompRecord" (id, "userEmail", "expirationDate") values
  ('91000000-0000-4000-8000-000000000001', 'alex.contractor@m2fleetcom.com', current_date + 75),
  ('91000000-0000-4000-8000-000000000002', 'jamie.contractor@m2fleetcom.com', current_date + 12),
  ('91000000-0000-4000-8000-000000000003', 'morgan.contractor@smcinstallations.com', current_date + 42),
  ('91000000-0000-4000-8000-000000000004', 'taylor.contractor@m2fleetcom.com', current_date - 3)
on conflict (id) do update set
  "userEmail" = excluded."userEmail",
  "expirationDate" = excluded."expirationDate";

insert into public."SafetyCertification" (id, "userEmail", "expirationDate") values
  ('92000000-0000-4000-8000-000000000001', 'alex.contractor@m2fleetcom.com', current_date + 120),
  ('92000000-0000-4000-8000-000000000002', 'jamie.contractor@m2fleetcom.com', current_date + 20),
  ('92000000-0000-4000-8000-000000000003', 'morgan.contractor@smcinstallations.com', current_date + 95),
  ('92000000-0000-4000-8000-000000000004', 'taylor.contractor@m2fleetcom.com', current_date + 5)
on conflict (id) do update set
  "userEmail" = excluded."userEmail",
  "expirationDate" = excluded."expirationDate";

insert into public."QCInspection" (id, "technicianId", score, status, notes, inspection_date) values
  ('93000000-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555', 92, 'complete', 'Strong workmanship and customer communication.', now() - interval '10 days'),
  ('93000000-0000-4000-8000-000000000002', '66666666-6666-4666-8666-666666666666', 78, 'complete', 'Needs cleaner drop routing and documentation.', now() - interval '8 days'),
  ('93000000-0000-4000-8000-000000000003', '77777777-7777-4777-8777-777777777777', 87, 'complete', 'Solid install quality.', now() - interval '12 days'),
  ('93000000-0000-4000-8000-000000000004', '88888888-8888-4888-8888-888888888888', 71, 'complete', 'Needs immediate field coaching.', now() - interval '6 days')
on conflict (id) do update set
  "technicianId" = excluded."technicianId",
  score = excluded.score,
  status = excluded.status,
  notes = excluded.notes,
  inspection_date = excluded.inspection_date;

insert into public."Invoice" (id, "contractorName", "contractorEmail", "businessName", "fileName", "invoiceDate", "weekEndingDate", "totalAmount", "daysWorked", status, "paymentStatus") values
  ('94000000-0000-4000-8000-000000000001', 'Alex Carter', 'alex.contractor@m2fleetcom.com', 'Carter Installations', 'alex-week-11.pdf', now() - interval '7 days', current_date - 2, 1840.00, 5, 'approved', 'unpaid'),
  ('94000000-0000-4000-8000-000000000002', 'Jamie Brooks', 'jamie.contractor@m2fleetcom.com', 'Brooks Telecom', 'jamie-week-11.pdf', now() - interval '5 days', current_date - 2, 1625.50, 5, 'pending', 'unpaid'),
  ('94000000-0000-4000-8000-000000000003', 'Morgan Price', 'morgan.contractor@smcinstallations.com', 'Price Fiber', 'morgan-week-11.pdf', now() - interval '4 days', current_date - 2, 1710.25, 5, 'approved', 'paid')
on conflict (id) do update set
  "contractorName" = excluded."contractorName",
  "contractorEmail" = excluded."contractorEmail",
  "businessName" = excluded."businessName",
  "fileName" = excluded."fileName",
  "invoiceDate" = excluded."invoiceDate",
  "weekEndingDate" = excluded."weekEndingDate",
  "totalAmount" = excluded."totalAmount",
  "daysWorked" = excluded."daysWorked",
  status = excluded.status,
  "paymentStatus" = excluded."paymentStatus";

insert into public."Channel" (id, name, description, type, "createdByEmail", "createdBy") values
  ('95000000-0000-4000-8000-000000000001', 'Operations', 'Daily ops coordination', 'public', 'austin@m2fleetcom.com', '11111111-1111-4111-8111-111111111111'),
  ('95000000-0000-4000-8000-000000000002', 'Phoenix Team', 'West region field updates', 'public', 'pm.west@m2fleetcom.com', '22222222-2222-4222-8222-222222222222')
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  type = excluded.type,
  "createdByEmail" = excluded."createdByEmail",
  "createdBy" = excluded."createdBy";

insert into public."ChannelMember" (id, "channelId", "userEmail", "userName", role) values
  ('96000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000001', 'austin@m2fleetcom.com', 'Austin Sinks', 'owner'),
  ('96000000-0000-4000-8000-000000000002', '95000000-0000-4000-8000-000000000001', 'pm.west@m2fleetcom.com', 'Casey Walker', 'member'),
  ('96000000-0000-4000-8000-000000000003', '95000000-0000-4000-8000-000000000001', 'pm.east@m2fleetcom.com', 'Jordan Lee', 'member'),
  ('96000000-0000-4000-8000-000000000004', '95000000-0000-4000-8000-000000000002', 'alex.contractor@m2fleetcom.com', 'Alex Carter', 'member'),
  ('96000000-0000-4000-8000-000000000005', '95000000-0000-4000-8000-000000000002', 'jamie.contractor@m2fleetcom.com', 'Jamie Brooks', 'member')
on conflict (id) do update set
  "channelId" = excluded."channelId",
  "userEmail" = excluded."userEmail",
  "userName" = excluded."userName",
  role = excluded.role;

insert into public."ChatMessage" (id, "channelId", "userEmail", "userName", content) values
  ('97000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000001', 'austin@m2fleetcom.com', 'Austin Sinks', 'Morning team — focus today is compliance cleanup and invoice approvals.'),
  ('97000000-0000-4000-8000-000000000002', '95000000-0000-4000-8000-000000000002', 'pm.west@m2fleetcom.com', 'Casey Walker', 'Jamie needs updated workers comp uploaded before Friday.'),
  ('97000000-0000-4000-8000-000000000003', '95000000-0000-4000-8000-000000000002', 'alex.contractor@m2fleetcom.com', 'Alex Carter', 'Submitted my invoice and latest job photos.')
on conflict (id) do update set
  "channelId" = excluded."channelId",
  "userEmail" = excluded."userEmail",
  "userName" = excluded."userName",
  content = excluded.content;

insert into public."DirectMessageThread" (id, "participantEmails", "participantNames") values
  ('98000000-0000-4000-8000-000000000001', array['austin@m2fleetcom.com','pm.west@m2fleetcom.com'], array['Austin Sinks','Casey Walker'])
on conflict (id) do update set
  "participantEmails" = excluded."participantEmails",
  "participantNames" = excluded."participantNames";

insert into public."AppLog" (id, user_id, page, action, metadata) values
  ('99000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'AdminDashboard', 'viewed', '{"source":"seed"}'::jsonb),
  ('99000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'MyTeam', 'viewed', '{"source":"seed"}'::jsonb)
on conflict (id) do update set
  user_id = excluded.user_id,
  page = excluded.page,
  action = excluded.action,
  metadata = excluded.metadata;
