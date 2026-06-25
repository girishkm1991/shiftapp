import { query, useMySQL } from '../db/mysql';
import { dbInstance } from '../db/database';
import { Mapper } from './Mapper';
import { SwapReviewRequest, SwapReviewAssignment, SwapReviewDecision } from '../../src/types';

export class ReviewRepository {
  public static async getSwapReviewRequests(): Promise<SwapReviewRequest[]> {
    if (useMySQL()) {
      const rows = await query('SELECT * FROM swap_review_requests ORDER BY created_at DESC');
      return rows.map(Mapper.mapSwapReviewRequest);
    } else {
      return dbInstance.getSwapReviewRequests();
    }
  }

  public static async getSwapReviewRequestById(id: string): Promise<SwapReviewRequest | null> {
    if (useMySQL()) {
      const rows = await query('SELECT * FROM swap_review_requests WHERE id = ?', [id]);
      if (rows.length === 0) return null;
      return Mapper.mapSwapReviewRequest(rows[0]);
    } else {
      return dbInstance.getSwapReviewRequests().find(r => r.id === id) || null;
    }
  }

  public static async saveSwapReviewRequest(req: SwapReviewRequest): Promise<void> {
    if (useMySQL()) {
      await query(
        `INSERT INTO swap_review_requests (id, swap_request_id, volunteer_user_id, status, approvals_required, approvals_received, rejections_received, created_at, finalized_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           status = VALUES(status), 
           approvals_received = VALUES(approvals_received), 
           rejections_received = VALUES(rejections_received), 
           finalized_at = VALUES(finalized_at)`,
        [
          req.id,
          req.swapRequestId,
          req.volunteerUserId,
          req.status,
          req.approvalsRequired,
          req.approvalsReceived,
          req.rejectionsReceived,
          req.createdAt ? new Date(req.createdAt) : new Date(),
          req.finalizedAt ? new Date(req.finalizedAt) : null
        ]
      );
    } else {
      dbInstance.updateState(state => {
        const idx = state.swapReviewRequests.findIndex(r => r.id === req.id);
        if (idx !== -1) {
          state.swapReviewRequests[idx] = req;
        } else {
          state.swapReviewRequests.push(req);
        }
      });
    }
  }

  public static async getSwapReviewAssignments(reviewRequestId?: string): Promise<SwapReviewAssignment[]> {
    if (useMySQL()) {
      let sql = 'SELECT * FROM swap_review_assignments';
      const params: any[] = [];
      if (reviewRequestId) {
        sql += ' WHERE review_request_id = ?';
        params.push(reviewRequestId);
      }
      const rows = await query(sql, params);
      return rows.map(Mapper.mapSwapReviewAssignment);
    } else {
      const all = dbInstance.getSwapReviewAssignments();
      return reviewRequestId ? all.filter(a => a.reviewRequestId === reviewRequestId) : all;
    }
  }

  public static async saveSwapReviewAssignment(asg: SwapReviewAssignment): Promise<void> {
    if (useMySQL()) {
      await query(
        `INSERT INTO swap_review_assignments (id, review_request_id, reviewer_user_id, assigned_at)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id = id`,
        [asg.id, asg.reviewRequestId, asg.reviewerUserId, asg.assignedAt ? new Date(asg.assignedAt) : new Date()]
      );
    } else {
      dbInstance.updateState(state => {
        const idx = state.swapReviewAssignments.findIndex(a => a.id === asg.id);
        if (idx === -1) {
          state.swapReviewAssignments.push(asg);
        }
      });
    }
  }

  public static async getSwapReviewDecisions(reviewRequestId?: string): Promise<SwapReviewDecision[]> {
    if (useMySQL()) {
      let sql = 'SELECT * FROM swap_review_decisions';
      const params: any[] = [];
      if (reviewRequestId) {
        sql += ' WHERE review_request_id = ?';
        params.push(reviewRequestId);
      }
      const rows = await query(sql, params);
      return rows.map(Mapper.mapSwapReviewDecision);
    } else {
      const all = dbInstance.getSwapReviewDecisions();
      return reviewRequestId ? all.filter(d => d.reviewRequestId === reviewRequestId) : all;
    }
  }

  public static async saveSwapReviewDecision(dec: SwapReviewDecision): Promise<void> {
    if (useMySQL()) {
      await query(
        `INSERT INTO swap_review_decisions (id, review_request_id, reviewer_user_id, decision, comments, decided_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE decision = VALUES(decision), comments = VALUES(comments)`,
        [
          dec.id,
          dec.reviewRequestId,
          dec.reviewerUserId,
          dec.decision,
          dec.comments || null,
          dec.decidedAt ? new Date(dec.decidedAt) : new Date()
        ]
      );
    } else {
      dbInstance.updateState(state => {
        const idx = state.swapReviewDecisions.findIndex(d => d.id === dec.id);
        if (idx !== -1) {
          state.swapReviewDecisions[idx] = dec;
        } else {
          state.swapReviewDecisions.push(dec);
        }
      });
    }
  }
}
