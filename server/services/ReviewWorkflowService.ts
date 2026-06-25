import { dbInstance } from '../db/database';
import { getNotificationService } from './NotificationService';
import { ScheduleResolutionService } from './ScheduleResolutionService';
import { SwapReviewRequest, SwapReviewAssignment, SwapReviewDecision, User, SwapRequest } from '../../src/types';

const uuid = () => Math.random().toString(36).substring(2, 11);

export class ReviewWorkflowService {
  /**
   * Creates a review request for a swap request and auto-assigns eligible reviewers.
   */
  public static createReviewRequest(swapRequestId: string, volunteerUserId: string): SwapReviewRequest {
    const swap = dbInstance.getSwapRequests().find(s => s.id === swapRequestId);
    if (!swap) {
      throw new Error('Swap request not found');
    }

    const reviewRequestId = 'rev_' + uuid();
    const newRequest: SwapReviewRequest = {
      id: reviewRequestId,
      swapRequestId,
      volunteerUserId,
      status: 'PENDING_ADMIN_REVIEW',
      approvalsRequired: 2,
      approvalsReceived: 0,
      rejectionsReceived: 0,
      createdAt: new Date().toISOString()
    };

    dbInstance.updateState(state => {
      if (!state.swapReviewRequests) state.swapReviewRequests = [];
      if (!state.swapReviewAssignments) state.swapReviewAssignments = [];
      
      state.swapReviewRequests.push(newRequest);

      // Auto-assign reviewers (supervisors/admins who are not requester or volunteer)
      const eligibleReviewers = state.users.filter(u => 
        u.id !== swap.requesterId && 
        u.id !== volunteerUserId && 
        (u.roleId === '2' || u.roleId === '3')
      ).slice(0, 3);

      eligibleReviewers.forEach(reviewer => {
        state.swapReviewAssignments!.push({
          id: 'asg_' + uuid(),
          reviewRequestId,
          reviewerUserId: reviewer.id,
          assignedAt: new Date().toISOString()
        });

        // Notify reviewer
        getNotificationService().sendNotification(
          reviewer.id,
          'New Swap Review Assigned',
          `You have been assigned to review a shift swap request for ${swap.date}.`,
          'swap',
          '/swap-marketplace'
        ).catch(e => console.error(e));
      });

      // Update swap status to indicate it is now undergoing multi-level review
      swap.status = 'volunteer_selected';
      swap.targetUserId = volunteerUserId;
      swap.updatedAt = new Date().toISOString();

      // Log audit trail
      state.auditLogs.push({
        id: uuid(),
        userId: volunteerUserId,
        action: 'SUBMIT_VOLUNTEER_REVIEW',
        timestamp: new Date().toISOString(),
        newValue: `reviewRequestId: ${reviewRequestId}, swapId: ${swapRequestId}`
      });
    });

    return newRequest;
  }

  /**
   * Submits a reviewer decision (Approve, Reject, Clarification)
   */
  public static submitDecision(
    reviewRequestId: string,
    reviewerUserId: string,
    decision: 'Approve' | 'Reject' | 'Clarification',
    comments?: string
  ): SwapReviewRequest {
    let resultRequest!: SwapReviewRequest;

    dbInstance.updateState(state => {
      const reviewReq = state.swapReviewRequests?.find(r => r.id === reviewRequestId);
      if (!reviewReq) {
        throw new Error('Review request not found');
      }

      if (reviewReq.status === 'APPROVED' || reviewReq.status === 'REJECTED' || reviewReq.status === 'CANCELLED' || reviewReq.status === 'EXPIRED') {
        throw new Error('Review request has already been finalized');
      }

      const swap = state.swapRequests.find(s => s.id === reviewReq.swapRequestId);
      if (!swap) {
        throw new Error('Associated swap request not found');
      }

      // Validation: Users cannot review their own swaps
      if (reviewerUserId === swap.requesterId || reviewerUserId === reviewReq.volunteerUserId) {
        throw new Error('You cannot review your own shift swap request');
      }

      // Ensure review assignments and decisions lists exist
      if (!state.swapReviewDecisions) state.swapReviewDecisions = [];
      if (!state.swapReviewAssignments) state.swapReviewAssignments = [];

      // Check if this reviewer already submitted a decision
      const existingDecision = state.swapReviewDecisions.find(d => 
        d.reviewRequestId === reviewRequestId && 
        d.reviewerUserId === reviewerUserId
      );

      if (existingDecision) {
        throw new Error('You have already submitted a decision for this review request');
      }

      // Add decision
      const newDecision: SwapReviewDecision = {
        id: 'dec_' + uuid(),
        reviewRequestId,
        reviewerUserId,
        decision,
        comments,
        decidedAt: new Date().toISOString()
      };
      state.swapReviewDecisions.push(newDecision);

      // If reviewReq status is PENDING_ADMIN_REVIEW, transition it to UNDER_REVIEW on first action
      if (reviewReq.status === 'PENDING_ADMIN_REVIEW') {
        reviewReq.status = 'UNDER_REVIEW';
      }

      // Update counters based on decision
      if (decision === 'Approve') {
        reviewReq.approvalsReceived += 1;
      } else if (decision === 'Reject') {
        reviewReq.rejectionsReceived += 1;
      }

      // Write audit log
      state.auditLogs.push({
        id: uuid(),
        userId: reviewerUserId,
        action: `REVIEW_DECISION_${decision.toUpperCase()}`,
        timestamp: new Date().toISOString(),
        newValue: `reviewRequestId: ${reviewRequestId}, comments: ${comments || ''}`
      });

      // Check finalization conditions
      const minApprovals = reviewReq.approvalsRequired; // 2
      const maxRejections = 2;

      let finalized = false;
      let finalStatus: 'APPROVED' | 'REJECTED' | null = null;

      if (reviewReq.approvalsReceived >= minApprovals) {
        finalized = true;
        finalStatus = 'APPROVED';
      } else if (reviewReq.rejectionsReceived >= maxRejections) {
        finalized = true;
        finalStatus = 'REJECTED';
      }

      if (finalized && finalStatus) {
        reviewReq.status = finalStatus;
        reviewReq.finalizedAt = new Date().toISOString();
        swap.status = finalStatus === 'APPROVED' ? 'approved' : 'rejected';
        swap.updatedAt = new Date().toISOString();

        // 1. Notify Original Employee & Volunteer
        getNotificationService().sendNotification(
          swap.requesterId,
          `Shift Swap ${finalStatus}`,
          `Your shift swap request for ${swap.date} has been ${finalStatus.toLowerCase()}.`,
          'swap',
          '/swap-marketplace'
        ).catch(e => console.error(e));

        getNotificationService().sendNotification(
          reviewReq.volunteerUserId,
          `Shift Swap ${finalStatus}`,
          `The shift swap request for ${swap.date} you volunteered for has been ${finalStatus.toLowerCase()}.`,
          'swap',
          '/swap-marketplace'
        ).catch(e => console.error(e));

        // 2. Schedule update if APPROVED
        if (finalStatus === 'APPROVED') {
          const requester = state.users.find(u => u.id === swap.requesterId);
          const volunteer = state.users.find(u => u.id === reviewReq.volunteerUserId);

          const reqAssign = state.shiftAssignments.find(a => a.userId === swap.requesterId && a.date === swap.date);
          const volAssign = state.shiftAssignments.find(a => a.userId === reviewReq.volunteerUserId && a.date === swap.date);

          const targetReqShift = swap.requestedShiftCode || 'OFF';
          const targetVolShift = swap.shiftCode;

          // Update requester assignment
          if (reqAssign) {
            reqAssign.shiftCode = targetReqShift;
          } else {
            state.shiftAssignments.push({
              id: `sa_${swap.requesterId}_${swap.date}`,
              userId: swap.requesterId,
              date: swap.date,
              shiftCode: targetReqShift,
              machineId: requester?.machineId
            });
          }

          // Update volunteer assignment
          if (volAssign) {
            volAssign.shiftCode = targetVolShift;
          } else {
            state.shiftAssignments.push({
              id: `sa_${reviewReq.volunteerUserId}_${swap.date}`,
              userId: reviewReq.volunteerUserId,
              date: swap.date,
              shiftCode: targetVolShift,
              machineId: volunteer?.machineId
            });
          }

          // Write audit log for schedule update
          state.auditLogs.push({
            id: uuid(),
            userId: 'system',
            action: 'SCHEDULE_UPDATED_VIA_SWAP_APPROVAL',
            timestamp: new Date().toISOString(),
            newValue: `swapId: ${swap.id}, requester: ${swap.requesterId} receives ${targetReqShift}, volunteer: ${reviewReq.volunteerUserId} receives ${targetVolShift}`
          });
        }

        // Notify all assigned reviewers about finalization
        const assignments = state.swapReviewAssignments.filter(a => a.reviewRequestId === reviewRequestId);
        assignments.forEach(asg => {
          getNotificationService().sendNotification(
            asg.reviewerUserId,
            `Swap Request Finalized`,
            `The swap request for ${swap.date} has been finalized as ${finalStatus!.toLowerCase()}.`,
            'swap',
            '/swap-marketplace'
          ).catch(e => console.error(e));
        });
      } else {
        // If not finalized but decision is Approve/Reject/Clarification, notify requester/volunteer
        getNotificationService().sendNotification(
          swap.requesterId,
          `Review Action: ${decision}`,
          `A reviewer has submitted a decision: ${decision} for your swap on ${swap.date}. Progress: ${reviewReq.approvalsReceived} of ${minApprovals} approvals received.`,
          'swap',
          '/swap-marketplace'
        ).catch(e => console.error(e));
      }

      resultRequest = reviewReq;
    });

    return resultRequest;
  }
}
