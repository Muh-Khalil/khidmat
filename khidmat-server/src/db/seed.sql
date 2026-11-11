-- Khidmat Database Seed Script
-- Realistic service providers across Islamabad sectors

-- Sample users
INSERT INTO users (id, name, phone, email, role, sector) VALUES
('usr_demo_customer', 'Ahmed Hassan', '+923001234567', 'ahmed@example.com', 'customer', 'F-7'),
('usr_demo_provider', 'Tariq Mehmood', '+923019876543', 'tariq@khidmat.pk', 'provider', 'G-13'),
('usr_demo_provider_2', 'Rashid Khan', '+923335551234', 'rashid@khidmat.pk', 'provider', 'G-11')
ON CONFLICT (id) DO NOTHING;

-- Development-only PIN for seeded demo accounts: 1234.
INSERT INTO auth_credentials (user_id, password_hash) VALUES
('usr_demo_customer', 'scrypt$khidmat-demo-salt$1b49961e6e8251fd9e56afa328d95637ea26e382d6cbdda0bd1c3fa473027b966c86d07cb030e7eca77dfe0e480cb19788037b7bc9b9eabd35ea3f3140e8e23f'),
('usr_demo_provider', 'scrypt$khidmat-demo-salt$1b49961e6e8251fd9e56afa328d95637ea26e382d6cbdda0bd1c3fa473027b966c86d07cb030e7eca77dfe0e480cb19788037b7bc9b9eabd35ea3f3140e8e23f')
ON CONFLICT (user_id) DO NOTHING;

-- Providers with PostGIS Point geometries (SRID 4326: Point(lng, lat))
INSERT INTO providers (
    id, user_id, name, phone, category, experience_years, rating, total_jobs, hourly_rate,
    location, sector, is_online, available_slots
) VALUES
('p_hvac_1', 'usr_demo_provider', 'Tariq Mehmood', '+92 301 9876543', 'ac', 8, 4.9, 142, 1800,
 ST_SetSRID(ST_Point(72.9789, 33.6425), 4326), 'G-13', true, '["10:00 AM", "02:00 PM", "05:00 PM"]'::jsonb),

('p_hvac_2', NULL, 'Kamran Aslam', '+92 321 4443322', 'ac', 5, 4.7, 89, 1500,
 ST_SetSRID(ST_Point(73.0125, 33.6789), 4326), 'G-11', true, '["09:00 AM", "12:00 PM", "03:00 PM"]'::jsonb),

('p_hvac_3', NULL, 'Muhammad Bilal', '+92 345 1112233', 'ac', 11, 4.95, 230, 2000,
 ST_SetSRID(ST_Point(73.0456, 33.7123), 4326), 'F-10', true, '["11:00 AM", "01:00 PM", "04:00 PM"]'::jsonb),

('p_plumb_1', 'usr_demo_provider_2', 'Rashid Khan', '+92 333 5551234', 'plumber', 7, 4.8, 115, 1200,
 ST_SetSRID(ST_Point(72.9912, 33.6550), 4326), 'G-12', true, '["09:00 AM", "11:30 AM", "02:30 PM", "04:30 PM"]'::jsonb),

('p_plumb_2', NULL, 'Imran Qureshi', '+92 312 9988776', 'plumber', 4, 4.6, 64, 1000,
 ST_SetSRID(ST_Point(72.9750, 33.6390), 4326), 'G-13', true, '["10:00 AM", "01:00 PM", "04:00 PM"]'::jsonb),

('p_elec_1', NULL, 'Zahid Hussain', '+92 300 7766554', 'electrician', 10, 4.85, 198, 1400,
 ST_SetSRID(ST_Point(73.0300, 33.6900), 4326), 'F-11', true, '["09:30 AM", "01:30 PM", "03:30 PM", "06:00 PM"]'::jsonb),

('p_elec_2', NULL, 'Arshad Ali', '+92 334 2233445', 'electrician', 6, 4.7, 92, 1200,
 ST_SetSRID(ST_Point(72.9800, 33.6450), 4326), 'G-13', true, '["10:00 AM", "12:00 PM", "03:00 PM"]'::jsonb),

('p_tutor_1', NULL, 'Sir Farhan', '+92 313 5544332', 'tutor', 6, 4.9, 75, 2500,
 ST_SetSRID(ST_Point(73.0180, 33.7050), 4326), 'F-10', true, '["03:00 PM", "04:30 PM", "06:00 PM"]'::jsonb),

('p_beauty_1', NULL, 'Ayesha Malik', '+92 322 8877665', 'beautician', 7, 4.92, 134, 3000,
 ST_SetSRID(ST_Point(73.0550, 33.7250), 4326), 'F-7', true, '["11:00 AM", "02:00 PM", "05:00 PM"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Sample dues for Tariq Mehmood
INSERT INTO dues (id, provider_id, customer_name, customer_phone, service_category, amount, status, due_date, notes) VALUES
('due_demo_1', 'p_hvac_1', 'Ahmed Hassan', '+92 300 1234567', 'ac', 1500, 'pending', '2026-03-20', 'Gas refill balance pending'),
('due_demo_2', 'p_hvac_1', 'Kashif Mehmood', '+92 321 8765432', 'ac', 2000, 'pending', '2026-03-18', 'Master bed AC PCB repair'),
('due_demo_3', 'p_hvac_1', 'Usman Butt', '+92 333 1122334', 'ac', 1200, 'paid', '2026-03-15', 'General servicing')
ON CONFLICT (id) DO NOTHING;
