import fs from 'fs';
import path from 'path';
import { query, pool } from '../server/db/mysql';
import { DbSchema } from '../src/types';

const JSON_PATHS = [
  path.join(process.cwd(), 'data', 'imvelo_db.json'),
  '/app/data/imvelo_db.json',
  path.join(process.cwd(), 'imvelo_db.json')
];

async function runMigration() {
  console.log('[Migration] Starting JSON to MySQL migration...');

  // Find existing JSON backup file
  let jsonPath = '';
  for (const p of JSON_PATHS) {
    if (fs.existsSync(p)) {
      jsonPath = p;
      break;
    }
  }

  if (!jsonPath) {
    console.warn('[Migration] No imvelo_db.json backup file found. Skipping migration.');
    process.exit(0);
  }

  console.log(`[Migration] Found backup file at: ${jsonPath}`);
  
  let data: DbSchema;
  try {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    data = JSON.parse(raw) as DbSchema;
  } catch (err: any) {
    console.error(`[Migration] Failed to read or parse JSON backup file: ${err.message}`);
    process.exit(1);
  }

  try {
    // Verify connection pool
    const conn = await pool.getConnection();
    conn.release();
    console.log('[Migration] Connected to MySQL successfully.');
  } catch (err: any) {
    console.error(`[Migration] Could not connect to MySQL database: ${err.message}`);
    process.exit(1);
  }

  try {
    // 1. Roles
    if (data.roles && Array.isArray(data.roles)) {
      let count = 0;
      for (const r of data.roles) {
        await query('INSERT INTO roles (id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)', [r.id, r.name]);
        count++;
      }
      console.log(`[Migration] Migrated ${count} roles successfully.`);
    }

    // 2. Departments
    if (data.departments && Array.isArray(data.departments)) {
      let count = 0;
      for (const d of data.departments) {
        await query('INSERT INTO departments (id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)', [d.id, d.name]);
        count++;
      }
      console.log(`[Migration] Migrated ${count} departments successfully.`);
    }

    // 3. Sections
    if (data.sections && Array.isArray(data.sections)) {
      let count = 0;
      for (const s of data.sections) {
        await query(
          'INSERT INTO sections (id, name, department_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), department_id = VALUES(department_id)',
          [s.id, s.name, s.departmentId]
        );
        count++;
      }
      console.log(`[Migration] Migrated ${count} sections successfully.`);
    }

    // 4. Teams
    if (data.teams && Array.isArray(data.teams)) {
      let count = 0;
      for (const t of data.teams) {
        await query(
          'INSERT INTO teams (id, name, supervisor_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), supervisor_id = VALUES(supervisor_id)',
          [t.id, t.name, t.supervisorId || null]
        );
        count++;
      }
      console.log(`[Migration] Migrated ${count} teams successfully.`);
    }

    // 5. Machines
    if (data.machines && Array.isArray(data.machines)) {
      let count = 0;
      for (const m of data.machines) {
        await query(
          'INSERT INTO machines (id, name, code, section_id) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), code = VALUES(code), section_id = VALUES(section_id)',
          [m.id, m.name, m.code, m.sectionId]
        );
        count++;
      }
      console.log(`[Migration] Migrated ${count} machines successfully.`);
    }

    // 6. Skills
    if (data.skills && Array.isArray(data.skills)) {
      let count = 0;
      for (const s of data.skills) {
        await query('INSERT INTO skills (id, name, code) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), code = VALUES(code)', [s.id, s.name, s.code]);
        count++;
      }
      console.log(`[Migration] Migrated ${count} skills successfully.`);
    }

    // 7. Users
    if (data.users && Array.isArray(data.users)) {
      let count = 0;
      for (const u of data.users) {
        await query(
          `INSERT INTO users (id, clock_id, name, password_hash, role_id, mobile, email, department_id, section_id, machine_id, status, remember_me_token, onboarding_completed_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
             clock_id = VALUES(clock_id), name = VALUES(name), password_hash = VALUES(password_hash),
             role_id = VALUES(role_id), mobile = VALUES(mobile), email = VALUES(email),
             department_id = VALUES(department_id), section_id = VALUES(section_id), machine_id = VALUES(machine_id),
             status = VALUES(status), remember_me_token = VALUES(remember_me_token),
             onboarding_completed_at = VALUES(onboarding_completed_at)`,
          [
            u.id,
            u.clockId,
            u.name,
            u.passwordHash,
            u.roleId,
            u.mobile || null,
            u.email || null,
            u.departmentId || null,
            u.sectionId || null,
            u.machineId || null,
            u.status,
            u.rememberMeToken || null,
            u.onboardingCompletedAt ? new Date(u.onboardingCompletedAt) : null,
            u.createdAt ? new Date(u.createdAt) : new Date()
          ]
        );
        count++;
      }
      console.log(`[Migration] Migrated ${count} users successfully.`);
    }

    // 8. Employee Default Shift Patterns
    if (data.employeeDefaultShiftPatterns && Array.isArray(data.employeeDefaultShiftPatterns)) {
      let count = 0;
      for (const p of data.employeeDefaultShiftPatterns) {
        await query(
          'INSERT INTO employee_default_shift_patterns (id, user_id, day_of_week, shift_code) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE shift_code = VALUES(shift_code)',
          [p.id, p.userId, p.dayOfWeek, p.shiftCode]
        );
        count++;
      }
      console.log(`[Migration] Migrated ${count} employee default shift patterns successfully.`);
    }

    // 9. Shifts
    if (data.shifts && Array.isArray(data.shifts)) {
      let count = 0;
      for (const s of data.shifts) {
        await query(
          'INSERT INTO shifts (id, name, code, start_time, end_time) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), code = VALUES(code), start_time = VALUES(start_time), end_time = VALUES(end_time)',
          [s.id, s.name, s.code, s.startTime, s.endTime]
        );
        count++;
      }
      console.log(`[Migration] Migrated ${count} shifts successfully.`);
    }

    // 10. Shift Assignments
    if (data.shiftAssignments && Array.isArray(data.shiftAssignments)) {
      let count = 0;
      for (const sa of data.shiftAssignments) {
        await query(
          'INSERT INTO shift_assignments (id, user_id, date, shift_code, machine_id) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE shift_code = VALUES(shift_code), machine_id = VALUES(machine_id)',
          [sa.id, sa.userId, sa.date, sa.shiftCode, sa.machineId || null]
        );
        count++;
      }
      console.log(`[Migration] Migrated ${count} shift assignments successfully.`);
    }

    // 11. Swap Requests
    if (data.swapRequests && Array.isArray(data.swapRequests)) {
      let count = 0;
      for (const sr of data.swapRequests) {
        await query(
          `INSERT INTO swap_requests (id, requester_id, date, shift_code, swap_type, target_user_id, status, supervisor_comment, incentive_offered, incentive_amount, remarks, supervisor_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status = VALUES(status), supervisor_comment = VALUES(supervisor_comment), target_user_id = VALUES(target_user_id), updated_at = VALUES(updated_at)`,
          [
            sr.id,
            sr.requesterId,
            sr.date,
            sr.shiftCode,
            sr.swapType,
            sr.targetUserId || null,
            sr.status,
            sr.supervisorComment || null,
            sr.incentiveOffered ? 1 : 0,
            sr.incentiveAmount || 0,
            sr.remarks || null,
            sr.supervisorId || null,
            sr.createdAt ? new Date(sr.createdAt) : new Date(),
            sr.updatedAt ? new Date(sr.updatedAt) : new Date()
          ]
        );
        count++;
      }
      console.log(`[Migration] Migrated ${count} swap requests successfully.`);
    }

    // 12. Swap Volunteers
    if (data.swapVolunteers && Array.isArray(data.swapVolunteers)) {
      let count = 0;
      for (const sv of data.swapVolunteers) {
        await query(
          'INSERT INTO swap_volunteers (id, swap_request_id, volunteer_id, status, created_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status)',
          [sv.id, sv.swapRequestId, sv.volunteerId, sv.status, sv.createdAt ? new Date(sv.createdAt) : new Date()]
        );
        count++;
      }
      console.log(`[Migration] Migrated ${count} swap volunteers successfully.`);
    }

    // 13. Leave Requests
    if (data.leaveRequests && Array.isArray(data.leaveRequests)) {
      let count = 0;
      for (const lr of data.leaveRequests) {
        await query(
          `INSERT INTO leave_requests (id, user_id, start_date, end_date, leave_type, status, remarks, supervisor_comment, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status = VALUES(status), supervisor_comment = VALUES(supervisor_comment)`,
          [
            lr.id,
            lr.userId,
            lr.startDate,
            lr.endDate,
            lr.leaveType,
            lr.status,
            lr.remarks || null,
            lr.supervisorComment || null,
            lr.createdAt ? new Date(lr.createdAt) : new Date()
          ]
        );
        count++;
      }
      console.log(`[Migration] Migrated ${count} leave requests successfully.`);
    }

    // 14. Leave Balances
    if (data.leaveBalances && Array.isArray(data.leaveBalances)) {
      let count = 0;
      for (const lb of data.leaveBalances) {
        await query(
          'INSERT INTO leave_balances (id, user_id, leave_type, allocated, used, pending) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE allocated = VALUES(allocated), used = VALUES(used), pending = VALUES(pending)',
          [lb.id, lb.userId, lb.leaveType, lb.allocated, lb.used, lb.pending]
        );
        count++;
      }
      console.log(`[Migration] Migrated ${count} leave balances successfully.`);
    }

    // 15. Conversations
    if (data.conversations && Array.isArray(data.conversations)) {
      let count = 0;
      for (const c of data.conversations) {
        await query(
          'INSERT INTO conversations (id, type, title, swap_request_id, created_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title), swap_request_id = VALUES(swap_request_id)',
          [c.id, c.type, c.title || null, c.swapRequestId || null, c.createdAt ? new Date(c.createdAt) : new Date()]
        );
        count++;
      }
      console.log(`[Migration] Migrated ${count} conversations successfully.`);
    }

    // 16. Conversation Participants
    if (data.conversationParticipants && Array.isArray(data.conversationParticipants)) {
      let count = 0;
      for (const cp of data.conversationParticipants) {
        await query(
          'INSERT INTO conversation_participants (id, conversation_id, user_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
          [cp.id, cp.conversationId, cp.userId]
        );
        count++;
      }
      console.log(`[Migration] Migrated ${count} conversation participants successfully.`);
    }

    // 17. Messages
    if (data.messages && Array.isArray(data.messages)) {
      let count = 0;
      for (const m of data.messages) {
        const isReadByStr = JSON.stringify(m.isReadBy || []);
        await query(
          `INSERT INTO messages (id, conversation_id, sender_id, text, attachment_url, attachment_name, is_read_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE text = VALUES(text), is_read_by = VALUES(is_read_by)`,
          [
            m.id,
            m.conversationId,
            m.senderId,
            m.text,
            m.attachmentUrl || null,
            m.attachmentName || null,
            isReadByStr,
            m.createdAt ? new Date(m.createdAt) : new Date()
          ]
        );
        count++;
      }
      console.log(`[Migration] Migrated ${count} messages successfully.`);
    }

    // 18. Notifications
    if (data.notifications && Array.isArray(data.notifications)) {
      let count = 0;
      for (const n of data.notifications) {
        await query(
          'INSERT INTO notifications (id, user_id, title, body, type, is_read, link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE is_read = VALUES(is_read)',
          [n.id, n.userId, n.title, n.body, n.type, n.isRead ? 1 : 0, n.link || null, n.createdAt ? new Date(n.createdAt) : new Date()]
        );
        count++;
      }
      console.log(`[Migration] Migrated ${count} notifications successfully.`);
    }

    // 19. Holidays
    if (data.holidays && Array.isArray(data.holidays)) {
      let count = 0;
      for (const h of data.holidays) {
        await query('INSERT INTO holidays (id, date, name, is_company_paid) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)', [h.id, h.date, h.name, h.isCompanyPaid ? 1 : 0]);
        count++;
      }
      console.log(`[Migration] Migrated ${count} holidays successfully.`);
    }

    // 20. Audit Logs
    if (data.auditLogs && Array.isArray(data.auditLogs)) {
      let count = 0;
      for (const al of data.auditLogs) {
        await query(
          'INSERT INTO audit_logs (id, user_id, action, timestamp, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
          [al.id, al.userId, al.action, al.timestamp ? new Date(al.timestamp) : new Date(), al.oldValue || null, al.newValue || null]
        );
        count++;
      }
      console.log(`[Migration] Migrated ${count} audit logs successfully.`);
    }

    // 21. System Settings
    if (data.systemSettings && Array.isArray(data.systemSettings)) {
      let count = 0;
      for (const ss of data.systemSettings) {
        await query(
          'INSERT INTO system_settings (id, `key`, `value`, description) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), description = VALUES(description)',
          [ss.id, ss.key, ss.value, ss.description || null]
        );
        count++;
      }
      console.log(`[Migration] Migrated ${count} system settings successfully.`);
    }

    // 22. Swap Review Requests
    if (data.swapReviewRequests && Array.isArray(data.swapReviewRequests)) {
      let count = 0;
      for (const srr of data.swapReviewRequests) {
        await query(
          `INSERT INTO swap_review_requests (id, swap_request_id, volunteer_user_id, status, approvals_required, approvals_received, rejections_received, created_at, finalized_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status = VALUES(status), approvals_received = VALUES(approvals_received), rejections_received = VALUES(rejections_received), finalized_at = VALUES(finalized_at)`,
          [
            srr.id,
            srr.swapRequestId,
            srr.volunteerUserId,
            srr.status,
            srr.approvalsRequired,
            srr.approvalsReceived,
            srr.rejectionsReceived,
            srr.createdAt ? new Date(srr.createdAt) : new Date(),
            srr.finalizedAt ? new Date(srr.finalizedAt) : null
          ]
        );
        count++;
      }
      console.log(`[Migration] Migrated ${count} swap review requests successfully.`);
    }

    // 23. Swap Review Assignments
    if (data.swapReviewAssignments && Array.isArray(data.swapReviewAssignments)) {
      let count = 0;
      for (const sra of data.swapReviewAssignments) {
        await query(
          'INSERT INTO swap_review_assignments (id, review_request_id, reviewer_user_id, assigned_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
          [sra.id, sra.reviewRequestId, sra.reviewerUserId, sra.assignedAt ? new Date(sra.assignedAt) : new Date()]
        );
        count++;
      }
      console.log(`[Migration] Migrated ${count} swap review assignments successfully.`);
    }

    // 24. Swap Review Decisions
    if (data.swapReviewDecisions && Array.isArray(data.swapReviewDecisions)) {
      let count = 0;
      for (const srd of data.swapReviewDecisions) {
        await query(
          'INSERT INTO swap_review_decisions (id, review_request_id, reviewer_user_id, decision, comments, decided_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE decision = VALUES(decision), comments = VALUES(comments)',
          [srd.id, srd.reviewRequestId, srd.reviewerUserId, srd.decision, srd.comments || null, srd.decidedAt ? new Date(srd.decidedAt) : new Date()]
        );
        count++;
      }
      console.log(`[Migration] Migrated ${count} swap review decisions successfully.`);
    }

    console.log('[Migration] Migration from JSON backup to Docker MySQL completed successfully.');
    process.exit(0);
  } catch (err: any) {
    console.error(`[Migration] Database migration failed: ${err.message}`);
    process.exit(1);
  }
}

runMigration();
