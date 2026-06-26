import { SwapRepository } from '../repositories/SwapRepository';
import { UserRepository } from '../repositories/UserRepository';
import { ReviewRepository } from '../repositories/ReviewRepository';
import { AuditRepository } from '../repositories/AuditRepository';
import { ShiftRepository } from '../repositories/ShiftRepository';
import { NotificationDispatcherService } from './NotificationDispatcherService';
import { SwapReviewRequest, SwapReviewAssignment, SwapReviewDecision } from '../../src/types';

const uuid = () => Math.random().toString(36).substring(2, 11);

export class ReviewWorkflowService {
  /**
   * Creates a review request for a swap request and auto-assigns eligible reviewers.
   */
  public static async createReviewRequest(swapRequestId: string, volunteerUserId: string): Promise<SwapReviewRequest> {
    const swap = await SwapRepository.getSwapRequestById(swapRequestId);
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

    await ReviewRepository.saveSwapReviewRequest(newRequest);

    // Auto-assign reviewers (supervisors/admins who are not requester or volunteer)
    const users = await UserRepository.findAll();
    const eligibleReviewers = users.filter(u => 
      u.id !== swap.requesterId && 
      u.id !== volunteerUserId && 
      (u.roleId === '2' || u.roleId === '3')
    ).slice(0, 3);

    for (const reviewer of eligibleReviewers) {
      const assignment: SwapReviewAssignment = {
        id: 'asg_' + uuid(),
        reviewRequestId,
        reviewerUserId: reviewer.id,
        assignedAt: new Date().toISOString()
      };
      await ReviewRepository.saveSwapReviewAssignment(assignment);

      // Notify reviewer
      NotificationDispatcherService.dispatch({
        type: 'REVIEW_ASSIGNED',
        recipients: [reviewer.id],
        title: 'New Swap Review Assigned',
        message: `You have been assigned to review a shift swap request for ${swap.date}.`,
        link: '/swap-marketplace'
      }).catch(e => console.error(e));
    }

    // Update swap status to indicate it is now undergoing multi-level review
    swap.status = 'volunteer_selected';
    swap.targetUserId = volunteerUserId;
    swap.updatedAt = new Date().toISOString();
    await SwapRepository.saveSwapRequest(swap);

    // Log audit trail
    await AuditRepository.saveAuditLog({
      id: uuid(),
      userId: volunteerUserId,
      action: 'SUBMIT_VOLUNTEER_REVIEW',
      timestamp: new Date().toISOString(),
      newValue: `reviewRequestId: ${reviewRequestId}, swapId: ${swapRequestId}`
    });

    // Notify original requester
    NotificationDispatcherService.dispatch({
      type: 'VOLUNTEER_JOINED',
      recipients: [swap.requesterId],
      title: 'Volunteer Registered',
      message: `An employee has volunteered for your shift swap on ${swap.date}. It is now under supervisor review.`,
      link: '/swap-marketplace'
    }).catch(e => console.error(e));

    return newRequest;
  }

  /**
   * Submits a reviewer decision (Approve, Reject, Clarification)
   */
  public static async submitDecision(
    reviewRequestId: string,
    reviewerUserId: string,
    decision: 'Approve' | 'Reject' | 'Clarification',
    comments?: string
  ): Promise<SwapReviewRequest> {
    const reviewReq = await ReviewRepository.getSwapReviewRequestById(reviewRequestId);
    if (!reviewReq) {
      throw new Error('Review request not found');
    }

    if (reviewReq.status === 'APPROVED' || reviewReq.status === 'REJECTED' || reviewReq.status === 'CANCELLED' || reviewReq.status === 'EXPIRED') {
      throw new Error('Review request has already been finalized');
    }

    const swap = await SwapRepository.getSwapRequestById(reviewReq.swapRequestId);
    if (!swap) {
      throw new Error('Associated swap request not found');
    }

    // Validation: Users cannot review their own swaps
    if (reviewerUserId === swap.requesterId || reviewerUserId === reviewReq.volunteerUserId) {
      throw new Error('You cannot review your own shift swap request');
    }

    // Security Check: Active & Not Deleted reviewer validation
    const reviewerUser = await UserRepository.findById(reviewerUserId);
    if (!reviewerUser || reviewerUser.status !== 'active') {
      throw new Error('Inactive or deleted users cannot perform reviews');
    }

    // Security Check: Only assigned reviewers can review
    const assignments = await ReviewRepository.getSwapReviewAssignments(reviewRequestId);
    const isAssigned = assignments.some(asg => asg.reviewerUserId === reviewerUserId);
    if (!isAssigned) {
      throw new Error('Only assigned reviewers can review this request');
    }

    // Check if this reviewer already submitted a decision
    const decisions = await ReviewRepository.getSwapReviewDecisions(reviewRequestId);
    const existingDecision = decisions.some(d => d.reviewerUserId === reviewerUserId);
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
    await ReviewRepository.saveSwapReviewDecision(newDecision);

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
    await AuditRepository.saveAuditLog({
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
      await ReviewRepository.saveSwapReviewRequest(reviewReq);

      swap.status = finalStatus === 'APPROVED' ? 'approved' : 'rejected';
      swap.updatedAt = new Date().toISOString();
      await SwapRepository.saveSwapRequest(swap);

      // 1. Notify Original Employee & Volunteer
      NotificationDispatcherService.dispatch({
        type: finalStatus === 'APPROVED' ? 'SWAP_APPROVED' : 'SWAP_REJECTED',
        recipients: [swap.requesterId],
        title: `Shift Swap ${finalStatus}`,
        message: `Your shift swap request for ${swap.date} has been ${finalStatus.toLowerCase()}.`,
        link: '/swap-marketplace'
      }).catch(e => console.error(e));

      NotificationDispatcherService.dispatch({
        type: finalStatus === 'APPROVED' ? 'SWAP_APPROVED' : 'SWAP_REJECTED',
        recipients: [reviewReq.volunteerUserId],
        title: `Shift Swap ${finalStatus}`,
        message: `The shift swap request for ${swap.date} you volunteered for has been ${finalStatus.toLowerCase()}.`,
        link: '/swap-marketplace'
      }).catch(e => console.error(e));

      // 2. Schedule update if APPROVED
      if (finalStatus === 'APPROVED') {
        const requester = await UserRepository.findById(swap.requesterId);
        const volunteer = await UserRepository.findById(reviewReq.volunteerUserId);

        const requesterAssignments = await ShiftRepository.getShiftAssignments(swap.requesterId);
        const reqAssign = requesterAssignments.find(a => a.date === swap.date);

        const volunteerAssignments = await ShiftRepository.getShiftAssignments(reviewReq.volunteerUserId);
        const volAssign = volunteerAssignments.find(a => a.date === swap.date);

        const targetReqShift = swap.requestedShiftCode || 'OFF';
        const targetVolShift = swap.shiftCode;

        // Update requester assignment
        if (reqAssign) {
          reqAssign.shiftCode = targetReqShift;
          await ShiftRepository.saveShiftAssignment(reqAssign);
        } else {
          await ShiftRepository.saveShiftAssignment({
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
          await ShiftRepository.saveShiftAssignment(volAssign);
        } else {
          await ShiftRepository.saveShiftAssignment({
            id: `sa_${reviewReq.volunteerUserId}_${swap.date}`,
            userId: reviewReq.volunteerUserId,
            date: swap.date,
            shiftCode: targetVolShift,
            machineId: volunteer?.machineId
          });
        }

        // Write audit log for schedule update
        await AuditRepository.saveAuditLog({
          id: uuid(),
          userId: 'system',
          action: 'SCHEDULE_UPDATED_VIA_SWAP_APPROVAL',
          timestamp: new Date().toISOString(),
          newValue: `swapId: ${swap.id}, requester: ${swap.requesterId} receives ${targetReqShift}, volunteer: ${reviewReq.volunteerUserId} receives ${targetVolShift}`
        });
      }

      // Notify all assigned reviewers about finalization
      assignments.forEach(asg => {
        NotificationDispatcherService.dispatch({
          type: finalStatus === 'APPROVED' ? 'SWAP_APPROVED' : 'SWAP_REJECTED',
          recipients: [asg.reviewerUserId],
          title: `Swap Request Finalized`,
          message: `The swap request for ${swap.date} has been finalized as ${finalStatus!.toLowerCase()}.`,
          link: '/swap-marketplace'
        }).catch(e => console.error(e));
      });
    } else {
      // Just save the updated reviewReq (counters changed)
      await ReviewRepository.saveSwapReviewRequest(reviewReq);

      // If not finalized but decision is Approve/Reject/Clarification, notify requester
      NotificationDispatcherService.dispatch({
        type: `REVIEW_DECISION_${decision.toUpperCase()}`,
        recipients: [swap.requesterId],
        title: `Review Action: ${decision}`,
        message: `A reviewer has submitted a decision: ${decision} for your swap on ${swap.date}. Progress: ${reviewReq.approvalsReceived} of ${minApprovals} approvals received.`,
        link: '/swap-marketplace'
      }).catch(e => console.error(e));
    }

    return reviewReq;
  }
}
