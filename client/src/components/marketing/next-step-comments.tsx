import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Loader2,
  Clock,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { AdminDeleteButton } from './admin-delete-button';

interface NextStepComment {
  id: string;
  requirementId: string;
  comment: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  createdByUser: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface NextStepCommentsProps {
  requirementId: string;
  className?: string;
}

export default function NextStepComments({ requirementId, className = '' }: NextStepCommentsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch next step comments
  const {
    data: comments = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: [`/api/marketing/requirements/${requirementId}/next-step-comments`],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/marketing/requirements/${requirementId}/next-step-comments`);
      if (!response.ok) {
        throw new Error('Failed to fetch next step comments');
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (comment: string) => {
      const response = await apiRequest('POST', `/api/marketing/requirements/${requirementId}/next-step-comments`, {
        comment,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add comment');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/marketing/requirements/${requirementId}/next-step-comments`] });
      setNewComment('');
      setShowAddForm(false);
      toast.success('Comment added successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add comment');
    },
  });

  // Update comment mutation
  const updateCommentMutation = useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment: string }) => {
      const response = await apiRequest('PATCH', `/api/marketing/next-step-comments/${id}`, {
        comment,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update comment');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/marketing/requirements/${requirementId}/next-step-comments`] });
      setEditingId(null);
      setEditingText('');
      toast.success('Comment updated successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update comment');
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/marketing/next-step-comments/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete comment');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/marketing/requirements/${requirementId}/next-step-comments`] });
      toast.success('Comment deleted successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete comment');
    },
  });

  const handleAddComment = () => {
    if (!newComment.trim()) {
      toast.error('Please enter a comment');
      return;
    }
    addCommentMutation.mutate(newComment.trim());
  };

  const handleEditComment = (comment: NextStepComment) => {
    setEditingId(comment.id);
    setEditingText(comment.comment);
  };

  const handleSaveEdit = () => {
    if (!editingText.trim()) {
      toast.error('Please enter a comment');
      return;
    }
    if (editingId) {
      updateCommentMutation.mutate({ id: editingId, comment: editingText.trim() });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  const handleDeleteComment = async (id: string) => {
    await deleteCommentMutation.mutateAsync(id);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getUserDisplayName = (comment: NextStepComment) => {
    const { firstName, lastName, email } = comment.createdByUser;
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    return email;
  };

  const isOwner = (comment: NextStepComment) => {
    return user?.id === comment.createdBy;
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare size={20} />
            <span>Next Step Comments</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="ml-2 text-slate-600">Loading comments...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare size={20} />
            <span>Next Step Comments</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">
              {error?.message || 'Failed to load comments'}
            </p>
            <Button
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: [`/api/marketing/requirements/${requirementId}/next-step-comments`] })
              }
              variant="outline"
              size="sm"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare size={20} />
            <span>Next Step Comments</span>
            <Badge variant="secondary" className="ml-2">
              {comments.length}
            </Badge>
          </CardTitle>
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus size={16} className="mr-1" />
            Add Comment
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Comment Form */}
        {showAddForm && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-4">
              <div className="space-y-3">
                <Textarea
                  placeholder="Add your next step comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[100px] resize-none"
                />
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={handleAddComment}
                    disabled={addCommentMutation.isPending || !newComment.trim()}
                    size="sm"
                  >
                    {addCommentMutation.isPending ? (
                      <>
                        <Loader2 size={16} className="mr-1 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Save size={16} className="mr-1" />
                        Add Comment
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewComment('');
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <X size={16} className="mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Comments List */}
        <div className="space-y-3">
          {comments.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600 mb-2">No next step comments yet</p>
              <p className="text-sm text-slate-500">Add the first comment to start tracking next steps</p>
            </div>
          ) : (
            comments.map((comment: NextStepComment) => (
              <Card key={comment.id} className="border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <User size={16} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-slate-900">
                          {getUserDisplayName(comment)}
                        </p>
                        <div className="flex items-center space-x-1 text-xs text-slate-500">
                          <Clock size={12} />
                          <span>{formatDateTime(comment.createdAt)}</span>
                          {comment.updatedAt !== comment.createdAt && (
                            <span className="text-slate-400">(edited)</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {isOwner(comment) && (
                      <div className="flex items-center space-x-1">
                        <Button
                          onClick={() => handleEditComment(comment)}
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                        >
                          <Edit size={14} />
                        </Button>
                        <AdminDeleteButton
                          onDelete={async () => {
                            await deleteCommentMutation.mutateAsync(comment.id);
                          }}
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {deleteCommentMutation.isPending ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </AdminDeleteButton>
                      </div>
                    )}
                  </div>

                  {editingId === comment.id ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="min-h-[80px] resize-none"
                      />
                      <div className="flex items-center space-x-2">
                        <Button
                          onClick={handleSaveEdit}
                          disabled={updateCommentMutation.isPending || !editingText.trim()}
                          size="sm"
                        >
                          {updateCommentMutation.isPending ? (
                            <>
                              <Loader2 size={16} className="mr-1 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save size={16} className="mr-1" />
                              Save
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={handleCancelEdit}
                          variant="outline"
                          size="sm"
                        >
                          <X size={16} className="mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-700 whitespace-pre-wrap">
                      {comment.comment}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
