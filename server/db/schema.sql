-- Imvelo Shift: MySQL Production Database Schema
-- Optimized for scale (500+ Employees) with indexes, soft deletes and constraints

CREATE DATABASE IF NOT EXISTS imvelo_shift_db;
USE imvelo_shift_db;

-- 1. Roles Table
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Departments Table
CREATE TABLE IF NOT EXISTS departments (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Sections Table
CREATE TABLE IF NOT EXISTS sections (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    department_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    UNIQUE KEY idx_section_name_dept (name, department_id)
);

-- 4. Teams Table
CREATE TABLE IF NOT EXISTS teams (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    supervisor_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Machines Table
CREATE TABLE IF NOT EXISTS machines (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    section_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
);

-- 6. Skills Table
CREATE TABLE IF NOT EXISTS skills (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Machine Certifications Table
CREATE TABLE IF NOT EXISTS machine_certifications (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Users (Clock ID-based auth)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    clock_id VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id VARCHAR(50) NOT NULL,
    mobile VARCHAR(20),
    email VARCHAR(100),
    department_id VARCHAR(50),
    section_id VARCHAR(50),
    machine_id VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'onboarding_step1',
    remember_me_token VARCHAR(255),
    onboarding_completed_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL, -- Soft delete support
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE SET NULL,
    INDEX idx_user_clock_id (clock_id)
);

-- 9. Employee Skills Mapping
CREATE TABLE IF NOT EXISTS employee_skills (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    skill_id VARCHAR(50) NOT NULL,
    certification_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
    UNIQUE KEY idx_user_skill (user_id, skill_id)
);

-- 10. Employee Machine Certifications Mapping
CREATE TABLE IF NOT EXISTS employee_machine_mapping (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    machine_id VARCHAR(50) NOT NULL,
    is_certified BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
    UNIQUE KEY idx_user_machine (user_id, machine_id)
);

-- 11. Default Shift Patterns (Weekly Default Settings)
CREATE TABLE IF NOT EXISTS employee_default_shift_patterns (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    day_of_week INT NOT NULL, -- 0 for Sunday, 6 for Saturday
    shift_code VARCHAR(10) NOT NULL, -- A, B, C, OFF
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY idx_user_day (user_id, day_of_week)
);

-- 12. Shifts Definition
CREATE TABLE IF NOT EXISTS shifts (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    code VARCHAR(10) NOT NULL UNIQUE, -- A, B, C, OFF
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. Shift Assignments (Actual day-to-day schedule)
CREATE TABLE IF NOT EXISTS shift_assignments (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    shift_code VARCHAR(10) NOT NULL,
    machine_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE SET NULL,
    UNIQUE KEY idx_user_date (user_id, date),
    INDEX idx_date (date)
);

-- 14. Shift Templates
CREATE TABLE IF NOT EXISTS shift_templates (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    rotation_days INT NOT NULL DEFAULT 7,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 15. Swap Requests (Direct and Open Shift Marketplace)
CREATE TABLE IF NOT EXISTS swap_requests (
    id VARCHAR(50) PRIMARY KEY,
    requester_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    shift_code VARCHAR(10) NOT NULL,
    swap_type VARCHAR(20) NOT NULL, -- 'direct' or 'open'
    target_user_id VARCHAR(50) NULL, -- For direct swap
    status VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending, volunteer_selected, approved, rejected, cancelled
    supervisor_comment TEXT NULL,
    incentive_offered BOOLEAN NOT NULL DEFAULT FALSE,
    incentive_amount DECIMAL(10, 2) NULL DEFAULT 0.00,
    remarks TEXT NULL,
    supervisor_id VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_swap_date (date),
    INDEX idx_swap_status (status)
);

-- 16. Swap Volunteers (Many volunteers can sign up for an open shift request)
CREATE TABLE IF NOT EXISTS swap_volunteers (
    id VARCHAR(50) PRIMARY KEY,
    swap_request_id VARCHAR(50) NOT NULL,
    volunteer_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, selected, rejected
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (swap_request_id) REFERENCES swap_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (volunteer_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY idx_request_volunteer (swap_request_id, volunteer_id)
);

-- 17. Leave Requests
CREATE TABLE IF NOT EXISTS leave_requests (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    leave_type VARCHAR(30) NOT NULL, -- Casual, Sick, Earned, Emergency, Unpaid
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    remarks TEXT NULL,
    supervisor_comment TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_leave_dates (start_date, end_date)
);

-- 18. Leave Balances
CREATE TABLE IF NOT EXISTS leave_balances (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    leave_type VARCHAR(30) NOT NULL,
    allocated INT NOT NULL DEFAULT 0,
    used INT NOT NULL DEFAULT 0,
    pending INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY idx_user_leave_type (user_id, leave_type)
);

-- 19. Conversations (Threads for Direct, Group, and Swap discussions)
CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR(50) PRIMARY KEY,
    type VARCHAR(20) NOT NULL, -- 'direct', 'group', 'swap'
    title VARCHAR(100) NULL,
    swap_request_id VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (swap_request_id) REFERENCES swap_requests(id) ON DELETE SET NULL
);

-- 20. Conversation Participants
CREATE TABLE IF NOT EXISTS conversation_participants (
    id VARCHAR(50) PRIMARY KEY,
    conversation_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY idx_conversation_user (conversation_id, user_id)
);

-- 21. Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(50) PRIMARY KEY,
    conversation_id VARCHAR(50) NOT NULL,
    sender_id VARCHAR(50) NOT NULL,
    text TEXT NOT NULL,
    attachment_url VARCHAR(255) NULL,
    attachment_name VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 22. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    body TEXT NOT NULL,
    type VARCHAR(30) NOT NULL, -- swap, leave, chat, announcement
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    link VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_unread (user_id, is_read)
);

-- 23. Holidays Table
CREATE TABLE IF NOT EXISTS holidays (
    id VARCHAR(50) PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    is_company_paid BOOLEAN NOT NULL DEFAULT TRUE
);

-- 24. Audit Logs (Compliance & Tracking)
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    old_value TEXT NULL,
    new_value TEXT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 25. System Settings (Configurations)
CREATE TABLE IF NOT EXISTS system_settings (
    id VARCHAR(50) PRIMARY KEY,
    `key` VARCHAR(100) NOT NULL UNIQUE,
    `value` TEXT NOT NULL,
    description TEXT NULL
);
