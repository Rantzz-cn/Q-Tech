-- Demo Data for Q-Tech Queue Management System
-- Use this to populate the database with sample data for demonstration

-- Clear existing data (optional - be careful in production!)
-- TRUNCATE TABLE queue_entries, queue_logs, notifications, counter_staff, counters, services, users RESTART IDENTITY CASCADE;

-- Insert Demo Users

-- Admin User
INSERT INTO users (student_id, email, password_hash, first_name, last_name, role, is_active)
VALUES 
  ('ADMIN001', 'admin@clsu.edu.ph', '$2b$10$rQ8K8K8K8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Admin', 'User', 'admin', true)
ON CONFLICT (email) DO NOTHING;

-- Counter Staff Users
INSERT INTO users (student_id, email, password_hash, first_name, last_name, role, is_active)
VALUES 
  ('STAFF001', 'staff1@clsu.edu.ph', '$2b$10$rQ8K8K8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Maria', 'Santos', 'counter_staff', true),
  ('STAFF002', 'staff2@clsu.edu.ph', '$2b$10$rQ8K8K8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Juan', 'Dela Cruz', 'counter_staff', true)
ON CONFLICT (email) DO NOTHING;

-- Student Users
INSERT INTO users (student_id, email, password_hash, first_name, last_name, role, is_active)
VALUES 
  ('2020-12345', 'student1@clsu.edu.ph', '$2b$10$rQ8K8K8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'John', 'Doe', 'student', true),
  ('2020-12346', 'student2@clsu.edu.ph', '$2b$10$rQ8K8K8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Jane', 'Smith', 'student', true),
  ('2020-12347', 'student3@clsu.edu.ph', '$2b$10$rQ8K8K8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Michael', 'Johnson', 'student', true),
  ('2020-12348', 'student4@clsu.edu.ph', '$2b$10$rQ8K8K8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Sarah', 'Williams', 'student', true),
  ('2020-12349', 'student5@clsu.edu.ph', '$2b$10$rQ8K8K8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'David', 'Brown', 'student', true)
ON CONFLICT (email) DO NOTHING;

-- Note: Password for all demo users is "demo123" (hashed with bcrypt)
-- In production, users should set their own passwords

-- Insert Demo Services
INSERT INTO services (name, description, location, estimated_service_time, max_queue_size, is_active, queue_prefix)
VALUES 
  ('Registrar', 'Student registration, transcript requests, and academic records', 'Main Building, 2nd Floor', 10, 100, true, 'REG'),
  ('Cashier', 'Tuition payments, fees, and financial transactions', 'Administration Building, 1st Floor', 5, 150, true, 'CAS'),
  ('Clinic', 'Medical consultations and health services', 'Health Center', 15, 50, true, 'CLI'),
  ('Library', 'Book borrowing, research assistance, and library services', 'Library Building', 8, 80, true, 'LIB'),
  ('Guidance Office', 'Counseling services and student support', 'Student Affairs Building', 20, 30, true, 'GUD'),
  ('Admission Office', 'Admission inquiries and application processing', 'Administration Building, 1st Floor', 12, 60, true, 'ADM')
ON CONFLICT (name) DO NOTHING;

-- Insert Demo Counters
INSERT INTO counters (service_id, counter_number, name, status, is_active)
SELECT 
  s.id,
  counter_num,
  s.name || ' Counter ' || counter_num,
  'open',
  true
FROM services s
CROSS JOIN generate_series(1, 2) AS counter_num
WHERE s.is_active = true
ON CONFLICT DO NOTHING;

-- Assign Counter Staff to Counters
INSERT INTO counter_staff (counter_id, user_id, assigned_at)
SELECT 
  c.id,
  u.id,
  CURRENT_TIMESTAMP
FROM counters c
JOIN services s ON c.service_id = s.id
JOIN users u ON u.role = 'counter_staff'
WHERE c.counter_number = '1'
LIMIT (SELECT COUNT(*) FROM counters WHERE counter_number = '1')
ON CONFLICT DO NOTHING;

-- Insert Demo Queue Entries (for demonstration)
-- These will show various queue states
INSERT INTO queue_entries (user_id, service_id, queue_number, queue_position, status, requested_at, estimated_wait_time)
WITH numbered_entries AS (
  SELECT 
    u.id as user_id,
    s.id as service_id,
    s.queue_prefix,
    s.estimated_service_time,
    ROW_NUMBER() OVER (PARTITION BY s.id ORDER BY u.id) as row_num
  FROM users u
  CROSS JOIN services s
  WHERE u.role = 'student' 
    AND s.is_active = true
)
SELECT 
  user_id,
  service_id,
  COALESCE(queue_prefix, '') || '-' || LPAD(row_num::text, 3, '0'),
  row_num,
  CASE 
    WHEN row_num = 1 THEN 'serving'
    WHEN row_num <= 3 THEN 'called'
    ELSE 'waiting'
  END,
  CURRENT_TIMESTAMP - (INTERVAL '1 hour' * row_num),
  estimated_service_time * row_num
FROM numbered_entries
WHERE row_num <= 5
ON CONFLICT DO NOTHING;

-- Update some queues to completed status (for history)
UPDATE queue_entries 
SET 
  status = 'completed',
  completed_at = CURRENT_TIMESTAMP - INTERVAL '1 day',
  started_serving_at = CURRENT_TIMESTAMP - INTERVAL '1 day' - INTERVAL '10 minutes',
  called_at = CURRENT_TIMESTAMP - INTERVAL '1 day' - INTERVAL '15 minutes'
WHERE id IN (
  SELECT id FROM queue_entries 
  WHERE status = 'waiting' 
  ORDER BY RANDOM() 
  LIMIT 10
);

-- Insert System Settings (if table exists)
INSERT INTO system_settings (id, settings, created_at, updated_at)
VALUES (
  1,
  '{
    "queue_number_prefix": "",
    "notification_before_minutes": 5,
    "auto_refresh_interval": 5,
    "display_board_refresh_interval": 5,
    "max_queue_per_user": 3,
    "enable_sms_notifications": false,
    "enable_email_notifications": false,
    "system_maintenance_mode": false,
    "maintenance_message": ""
  }'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO UPDATE
SET settings = EXCLUDED.settings,
    updated_at = CURRENT_TIMESTAMP;

-- Display summary
SELECT 'Demo data inserted successfully!' as status;
SELECT COUNT(*) as total_users FROM users;
SELECT COUNT(*) as total_services FROM services;
SELECT COUNT(*) as total_counters FROM counters;
SELECT COUNT(*) as total_queues FROM queue_entries;

