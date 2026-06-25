import fs from 'fs';
import path from 'path';
import { query, pool } from '../server/db/mysql';

const JSON_DB_PATH = path.join(process.cwd(), 'data', 'imvelo_db.json');

async function runMigration() {
  console.log('[Migration] Starting migration from JSON to MySQL...');
  
  if (!fs.existsSync(JSON_DB_PATH)) {
    console.log(`[Migration] JSON Database file not found at ${JSON_DB_PATH}. Nothing to migrate.`);
    process.exit(0);
  }

  let dbData: any;
  try {
    const raw = fs.readFileSync(JSON_DB_PATH, 'utf-8');
    dbData = JSON.parse(raw);
  } catch (err) {
    console.error('[Migration] Failed to parse JSON database file:', err);
    process.exit(1);
  }

  console.log('[Migration] JSON parsed successfully. Migrating tables...');

  try {
    // 1. Roles
    if (dbData.roles && Array.isArray(dbData.roles)) {
      console.log(`[Migration] Migrating ${dbData.roles.length} roles...`);
      for (const r of dbData.roles) {
        await query(
          'INSERT INTO roles (id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
          [r.id, r.name]
        );
      }
    }

    // 2. Departments
    if (dbData.departments && Array.isArray(dbData.departments)) {
      console.log(`[Migration] Migrating ${dbData.departments.length} departments...`);
      for (const d of dbData.departments) {
        await query(
          'INSERT INTO departments (id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
          [d.id, d.name]
        );
      }
    }

    // 3. Sections
    if (dbData.sections && Array.isArray(dbData.sections)) {
      console.log(`[Migration] Migrating ${dbData.sections.length} sections...`);
      for (const s of dbData.sections) {
        await query(
          'INSERT INTO sections (id, name, department_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), department_id = VALUES(department_id)',
          [s.id, s.name, s.departmentId]
        );
      }
    }

    // 4. Teams
    if (dbData.teams && Array.isArray(dbData.teams)) {
      console.log(`[Migration] Migrating ${dbData.teams.length} teams...`);
      for (const t of dbData.teams) {
        await query(
          'INSERT INTO teams (id, name, supervisor_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), supervisor_id = VALUES(supervisor_id)',
          [t.id, t.name, t.supervisorId || null]
        );
      }
    }

    // 5. Machines
    if (dbData.machines && Array.isArray(dbData.machines)) {
      console.log(`[Migration] Migrating ${dbData.machines.length} machines...`);
      for (const m of dbData.machines) {
        await query(
          'INSERT INTO machines (id, name, code, section_id) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), code = VALUES(code), section_id = VALUES(section_id)',
          [m.id, m.name, m.code, m.sectionId]
        );
      }
    }

    // 6. Skills
    if (dbData.skills && Array.isArray(dbData.skills)) {
      console.log(`[Migration] Migrating ${dbData.skills.length} skills...`);
      for (const sk of dbData.skills) {
        await query(
          'INSERT INTO skills (id, name, code) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), code = VALUES(code)',
          [sk.id, sk.name, sk.code]
        );
      }
    }

    // 7. Users
    if (dbData.users && Array.isArray(dbData.users)) {
      console.log(`[Migration] Migrating ${dbData.users.length} users...`);
      for (const u of dbData.users) {
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
            u.status || 'active',
            u.rememberMeToken || null,
            u.onboardingCompletedAt ? new Date(u.onboardingCompletedAt) : null,
            u.createdAt ? new Date(u.createdAt) : new Date()
          ]
        );
      }
    }

    // 8. Employee Skills
    if (dbData.employeeSkills && Array.isArray(dbData.employeeSkills)) {
      console.log(`[Migration] Migrating ${dbData.employeeSkills.length} employee skills...`);
      for (const es of dbData.employeeSkills) {
        await query(
          'INSERT INTO employee_skills (id, user_id, skill_id, certification_date, expiry_date) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE certification_date = VALUES(certification_date), expiry_date = VALUES(expiry_date)',
          [es.id, es.userId, es.skillId, es.certificationDate, es.expiryDate]
        );
      }
    }

    // 9. Employee Machine Mapping
    if (dbData.employeeMachineMapping && Array.isArray(dbData.employeeMachineMapping)) {
      console.log(`[Migration] Migrating ${dbData.employeeMachineMapping.length} employee machine mappings...`);
      for (const emm of dbData.employeeMachineMapping) {
        await query(
          'INSERT INTO employee_machine_mapping (id, user_id, machine_id, is_certified) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE is_certified = VALUES(is_certified)',
          [emm.id, emm.userId, emm.machineId, emm.isCertified ? 1 : 0]
        );
      }
    }

    // 10. Employee Default Shift Patterns
    if (dbData.employeeDefaultShiftPatterns && Array.isArray(dbData.employeeDefaultShiftPatterns)) {
      console.log(`[Migration] Migrating ${dbData.employeeDefaultShiftPatterns.length} default shift patterns...`);
      for (const edsp of dbData.employeeDefaultShiftPatterns) {
        await query(
          'INSERT INTO employee_default_shift_patterns (id, user_id, day_of_week, shift_code) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE shift_code = VALUES(shift_code)',
          [edsp.id, edsp.userId, edsp.dayOfWeek, edsp.shiftCode]
        );
      }
    }

    // 11. Shifts
    if (dbData.shifts && Array.isArray(dbData.shifts)) {
      console.log(`[Migration] Migrating ${dbData.shifts.length} shifts...`);
      for (const sh of dbData.shifts) {
        await query(
          'INSERT INTO shifts (id, name, code, start_time, end_time) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), start_time = VALUES(start_time), end_time = VALUES(end_time)',
          [sh.id, sh.name, sh.code, sh.startTime, sh.endTime]
        );
      }
    }

    // 12. Shift Assignments
    if (dbData.shiftAssignments && Array.isArray(dbData.shiftAssignments)) {
      console.log(`[Migration] Migrating ${dbData.shiftAssignments.length} shift assignments...`);
      for (const sa of dbData.shiftAssignments) {
        await query(
          'INSERT INTO shift_assignments (id, user_id, date, shift_code, machine_id) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE shift_code = VALUES(shift_code), machine_id = VALUES(machine_id)',
          [sa.id, sa.userId, sa.date, sa.shiftCode, sa.machineId || null]
        );
      }
    }

    // 13. Shift Templates
    if (dbData.shiftTemplates && Array.isArray(dbData.shiftTemplates)) {
      console.log(`[Migration] Migrating ${dbData.shiftTemplates.length} shift templates...`);
      for (const st of dbData.shiftTemplates) {
        await query(
          'INSERT INTO shift_templates (id, name, rotation_days) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), rotation_days = VALUES(rotation_days)',
          [st.id, st.name, st.rotationDays]
        );
      }
    }

    // 14. Swap Requests
    if (dbData.swapRequests && Array.isArray(dbData.swapRequests)) {
      console.log(`[Migration] Migrating ${dbData.swapRequests.length} swap requests...`);
      for (const sr of dbData.swapRequests) {
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
      }
    }

    // 15. Swap Volunteers
    if (dbData.swapVolunteers && Array.isArray(dbData.swapVolunteers)) {
      console.log(`[Migration] Migrating ${dbData.swapVolunteers.length} swap volunteers...`);
      for (const sv of dbData.swapVolunteers) {
        await query(
          'INSERT INTO swap_volunteers (id, swap_request_id, volunteer_id, status, created_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status)',
          [sv.id, sv.swapRequestId, sv.volunteerId, sv.status, sv.createdAt ? new Date(sv.createdAt) : new Date()]
        );
      }
    }

    // 16. Leave Requests
    if (dbData.leaveRequests && Array.isArray(dbData.leaveRequests)) {
      console.log(`[Migration] Migrating ${dbData.leaveRequests.length} leave requests...`);
      for (const lr of dbData.leaveRequests) {
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
      }
    }

    // 17. Leave Balances
    if (dbData.leaveBalances && Array.isArray(dbData.leaveBalances)) {
      console.log(`[Migration] Migrating ${dbData.leaveBalances.length} leave balances...`);
      for (const lb of dbData.leaveBalances) {
        await query(
          'INSERT INTO leave_balances (id, user_id, leave_type, allocated, used, pending) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE allocated = VALUES(allocated), used = VALUES(used), pending = VALUES(pending)',
          [lb.id, lb.userId, lb.leaveType, lb.allocated, lb.used, lb.pending]
        );
      }
    }

    // 18. Conversations
    if (dbData.conversations && Array.isArray(dbData.conversations)) {
      console.log(`[Migration] Migrating ${dbData.conversations.length} conversations...`);
      for (const conv of dbData.conversations) {
        await query(
          'INSERT INTO conversations (id, type, title, swap_request_id, created_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title), swap_request_id = VALUES(swap_request_id)',
          [conv.id, conv.type, conv.title || null, conv.swapRequestId || null, conv.createdAt ? new Date(conv.createdAt) : new Date()]
        );
      }
    }

    // 19. Conversation Participants
    if (dbData.conversationParticipants && Array.isArray(dbData.conversationParticipants)) {
      console.log(`[Migration] Migrating ${dbData.conversationParticipants.length} conversation participants...`);
      for (const cp of dbData.conversationParticipants) {
        await query(
          'INSERT INTO conversation_participants (id, conversation_id, user_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
          [cp.id, cp.conversationId, cp.userId]
        );
      }
    }

    // 20. Messages
    if (dbData.messages && Array.isArray(dbData.messages)) {
      console.log(`[Migration] Migrating ${dbData.messages.length} messages...`);
      for (const msg of dbData.messages) {
        const isReadByStr = JSON.stringify(msg.isReadBy || []);
        await query(
          `INSERT INTO messages (id, conversation_id, sender_id, text, attachment_url, attachment_name, is_read_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE text = VALUES(text), is_read_by = VALUES(is_read_by)`,
          [
            msg.id,
            msg.conversationId,
            msg.senderId,
            msg.text,
            msg.attachmentUrl || null,
            msg.attachmentName || null,
            isReadByStr,
            msg.createdAt ? new Date(msg.createdAt) : new Date()
          ]
        );
      }
    }

    // 21. Notifications
    if (dbData.notifications && Array.isArray(dbData.notifications)) {
      console.log(`[Migration] Migrating ${dbData.notifications.length} notifications...`);
      for (const n of dbData.notifications) {
        await query(
          'INSERT INTO notifications (id, user_id, title, body, type, is_read, link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE is_read = VALUES(is_read)',
          [n.id, n.userId, n.title, n.body, n.type, n.isRead ? 1 : 0, n.link || null, n.createdAt ? new Date(n.createdAt) : new Date()]
        );
      }
    }

    // 22. Holidays
    if (dbData.holidays && Array.isArray(dbData.holidays)) {
      console.log(`[Migration] Migrating ${dbData.holidays.length} holidays...`);
      for (const h of dbData.holidays) {
        await query(
          'INSERT INTO holidays (id, date, name, is_company_paid) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), is_company_paid = VALUES(is_company_paid)',
          [h.id, h.date, h.name, h.isCompanyPaid ? 1 : 0]
        );
      }
    }

    // 23. Audit Logs
    if (dbData.auditLogs && Array.isArray(dbData.auditLogs)) {
      console.log(`[Migration] Migrating ${dbData.auditLogs.length} audit logs...`);
      for (const al of dbData.auditLogs) {
        await query(
          'INSERT INTO audit_logs (id, user_id, action, timestamp, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)',
          [al.id, al.userId, al.action, al.timestamp ? new Date(al.timestamp) : new Date(), al.oldValue || null, al.newValue || null]
        );
      }
    }

    // 24. System Settings
    if (dbData.systemSettings && Array.isArray(dbData.systemSettings)) {
      console.log(`[Migration] Migrating ${dbData.systemSettings.length} system settings...`);
      for (const ss of dbData.systemSettings) {
        await query(
          'INSERT INTO system_settings (id, `key`, `value`, description) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), description = VALUES(description)',
          [ss.id, ss.key, ss.value, ss.description || null]
        );
      }
    }

    // 25. Swap Review Requests
    if (dbData.swapReviewRequests && Array.isArray(dbData.swapReviewRequests)) {
      console.log(`[Migration] Migrating ${dbData.swapReviewRequests.length} swap review requests...`);
      for (const srr of dbData.swapReviewRequests) {
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
      }
    }

    // 26. Swap Review Assignments
    if (dbData.swapReviewAssignments && Array.isArray(dbData.swapReviewAssignments)) {
      console.log(`[Migration] Migrating ${dbData.swapReviewAssignments.length} swap review assignments...`);
      for (const sra of dbData.swapReviewAssignments) {
        await query(
          'INSERT INTO swap_review_assignments (id, review_request_id, reviewer_user_id, assigned_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
          [sra.id, sra.reviewRequestId, sra.reviewerUserId, sra.assignedAt ? new Date(sra.assignedAt) : new Date()]
        );
      }
    }

    // 27. Swap Review Decisions
    if (dbData.swapReviewDecisions && Array.isArray(dbData.swapReviewDecisions)) {
      console.log(`[Migration] Migrating ${dbData.swapReviewDecisions.length} swap review decisions...`);
      for (const srd of dbData.swapReviewDecisions) {
        await query(
          'INSERT INTO swap_review_decisions (id, review_request_id, reviewer_user_id, decision, comments, decided_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE decision = VALUES(decision), comments = VALUES(comments)',
          [srd.id, srd.reviewRequestId, srd.reviewerUserId, srd.decision, srd.comments || null, srd.decidedAt ? new Date(srd.decidedAt) : new Date()]
        );
      }
    }

    console.log('[Migration] Migration complete successfully!');
  } catch (error) {
    console.error('[Migration] Migration failed with error:', error);
  } finally {
    await pool.end();
  }
}

runMigration().catch(e => console.error('[Migration] Unhandled top-level exception:', e));
