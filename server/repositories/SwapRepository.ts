import { query } from '../db/mysql';
import { Mapper } from './Mapper';
import { SwapRequest, SwapVolunteer } from '../../src/types';

export class SwapRepository {
  public static async getSwapRequests(): Promise<SwapRequest[]> {
    const rows = await query('SELECT * FROM swap_requests ORDER BY created_at DESC');
    return rows.map(Mapper.mapSwapRequest);
  }

  public static async getSwapRequestById(id: string): Promise<SwapRequest | null> {
    const rows = await query('SELECT * FROM swap_requests WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    return Mapper.mapSwapRequest(rows[0]);
  }

  public static async saveSwapRequest(swap: SwapRequest): Promise<void> {
    await query(
      `INSERT INTO swap_requests (id, requester_id, date, shift_code, swap_type, target_user_id, status, supervisor_comment, incentive_offered, incentive_amount, remarks, supervisor_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         status = VALUES(status), 
         target_user_id = VALUES(target_user_id), 
         supervisor_comment = VALUES(supervisor_comment), 
         supervisor_id = VALUES(supervisor_id), 
         updated_at = VALUES(updated_at)`,
      [
        swap.id,
        swap.requesterId,
        swap.date,
        swap.shiftCode,
        swap.swapType,
        swap.targetUserId || null,
        swap.status,
        swap.supervisorComment || null,
        swap.incentiveOffered ? 1 : 0,
        swap.incentiveAmount || 0,
        swap.remarks || null,
        swap.supervisorId || null,
        swap.createdAt ? new Date(swap.createdAt) : new Date(),
        swap.updatedAt ? new Date(swap.updatedAt) : new Date()
      ]
    );
  }

  public static async getSwapVolunteers(requestId?: string): Promise<SwapVolunteer[]> {
    let sql = 'SELECT * FROM swap_volunteers';
    const params: any[] = [];
    if (requestId) {
      sql += ' WHERE swap_request_id = ?';
      params.push(requestId);
    }
    const rows = await query(sql, params);
    return rows.map(Mapper.mapSwapVolunteer);
  }

  public static async saveSwapVolunteer(volunteer: SwapVolunteer): Promise<void> {
    await query(
      `INSERT INTO swap_volunteers (id, swap_request_id, volunteer_id, status, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status)`,
      [
        volunteer.id,
        volunteer.swapRequestId,
        volunteer.volunteerId,
        volunteer.status,
        volunteer.createdAt ? new Date(volunteer.createdAt) : new Date()
      ]
    );
  }
}
