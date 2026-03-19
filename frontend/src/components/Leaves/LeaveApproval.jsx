import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Calendar, Clock, User, MessageSquare, Check, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { leaveService } from '../../services/leaveService';
import { toast } from 'react-hot-toast';

const LeaveApproval = () => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      const requests = await leaveService.getPendingRequests();
      setPendingRequests(requests);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      toast.error('Failed to load pending requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (requestId, status, comments = '') => {
    try {
      setProcessingId(requestId);
      await leaveService.updateLeaveStatus(requestId, {
        status,
        comments,
        approvedBy: user.id
      });
      
      toast.success(`Leave request ${status.toLowerCase()} successfully`);
      fetchPendingRequests(); // Refresh the list
    } catch (error) {
      console.error('Error updating leave request:', error);
      toast.error(`Failed to ${status.toLowerCase()} leave request`);
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const calculateDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const getLeaveTypeColor = (type) => {
    const colors = {
      annual: 'bg-blue-100 text-blue-800',
      sick: 'bg-red-100 text-red-800',
      personal: 'bg-green-100 text-green-800',
      emergency: 'bg-orange-100 text-orange-800',
      maternity: 'bg-purple-100 text-purple-800',
      paternity: 'bg-indigo-100 text-indigo-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const ApprovalActions = ({ request }) => {
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [comments, setComments] = useState('');
    const [actionType, setActionType] = useState('');

    const handleActionClick = (type) => {
      setActionType(type);
      setShowCommentModal(true);
    };

    const handleSubmitAction = () => {
      handleApproval(request.id, actionType, comments);
      setShowCommentModal(false);
      setComments('');
    };

    return (
      <>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-green-600 border-green-200 hover:bg-green-50"
            onClick={() => handleActionClick('APPROVED')}
            disabled={processingId === request.id}
          >
            <Check className="w-4 h-4 mr-1" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => handleActionClick('REJECTED')}
            disabled={processingId === request.id}
          >
            <X className="w-4 h-4 mr-1" />
            Reject
          </Button>
        </div>

        {/* Comment Modal */}
        {showCommentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96 max-w-90vw">
              <h3 className="text-lg font-semibold mb-4">
                {actionType === 'APPROVED' ? 'Approve' : 'Reject'} Leave Request
              </h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comments {actionType === 'REJECTED' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder={`Add ${actionType === 'APPROVED' ? 'approval' : 'rejection'} comments...`}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCommentModal(false);
                    setComments('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitAction}
                  disabled={actionType === 'REJECTED' && !comments.trim()}
                  className={actionType === 'APPROVED' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                >
                  {actionType === 'APPROVED' ? 'Approve' : 'Reject'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Leave Approvals</h2>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Leave Approvals</h2>
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
          {pendingRequests.length} Pending
        </Badge>
      </div>

      {pendingRequests.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No pending requests</h3>
            <p className="text-gray-500">All leave requests have been processed.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pendingRequests.map((request) => (
            <Card key={request.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {request.employee?.firstName} {request.employee?.lastName}
                      </h3>
                      <p className="text-sm text-gray-500">{request.employee?.email}</p>
                    </div>
                  </div>
                  <Badge className={getLeaveTypeColor(request.leaveType)}>
                    {request.leaveType?.charAt(0).toUpperCase() + request.leaveType?.slice(1)}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Start Date</p>
                      <p className="font-medium">{formatDate(request.startDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">End Date</p>
                      <p className="font-medium">{formatDate(request.endDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Duration</p>
                      <p className="font-medium">
                        {calculateDays(request.startDate, request.endDate)} day(s)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Applied</p>
                      <p className="font-medium">{formatDate(request.createdAt)}</p>
                    </div>
                  </div>
                </div>

                {request.reason && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Reason</p>
                        <p className="text-sm text-gray-600">{request.reason}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Employee Leave Balance: {request.employee?.leaveBalance || 0} days
                  </div>
                  <ApprovalActions request={request} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default LeaveApproval;