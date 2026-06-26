import { query } from '../db/mysql';
import { Mapper } from './Mapper';
import { SwapReviewRequest, SwapReviewAssignment, SwapReviewDecision } from '../../src/types';

export class ReviewRepository {
  public static async getSwapReviewRequests(): Promise<SwapReviewRequest[]> {
    const rows = await query('SELECT * FROM swap_review_requests ORDER BY created_at DESC');
    return rows.map(Mapper.mapSwapReviewRequest);
  }

  public static async getSwapReviewRequestById(id: string): Promise<SwapReviewRequest | null> {
    const rows = await query('SELECT * FROM swap_review_requests WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    return Mapper.mapSwapReviewRequest(rows[0]);
  }

  public static async saveSwapReviewRequest(req: SwapReviewRequest): Promise<void> {
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
  }

  public static async getSwapReviewAssignments(reviewRequestId?: string): Promise<SwapReviewAssignment[]> {
    let sql = 'SELECT * FROM swap_review_assignments';
    const params: any[] = [];
    if (reviewRequestId) {
      sql += ' WHERE review_request_id = ?';
      params.push(reviewRequestId);
    }
    const rows = await query(sql, params);
    return rows.map(Mapper.mapSwapReviewAssignment);
  }

  public static async saveSwapReviewAssignment(asg: SwapReviewAssignment): Promise<void> {
    await query(
      `INSERT INTO swap_review_assignments (id, review_request_id, reviewer_user_id, assigned_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = id`,
      [asg.id, asg.reviewRequestId, asg.reviewerUserId, asg.assignedAt ? new Date(asg.assignedAt) : new Date()]
    );
  }

  public static async getSwapReviewDecisions(reviewRequestId?: string): Promise<SwapReviewDecision[]> {
    let sql = 'SELECT * FROM swap_review_decisions';
    const params: any[] = [];
    if (reviewRequestId) {
      sql += ' WHERE review_request_id = ?';
      params.push(reviewRequestId);
    }
    const rows = await query(sql, params);
    return rows.map(Mapper.mapSwapReviewDecision);
  }

  public static async saveSwapReviewDecision(dec: SwapReviewDecision): Promise<void> {
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
  }
}
