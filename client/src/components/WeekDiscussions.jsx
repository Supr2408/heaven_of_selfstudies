'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Heart, Loader2, MessageCircle, Send } from 'lucide-react';
import { resourceAPI } from '@/lib/api';
import useStore from '@/store/useStore';

const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0]?.toUpperCase())
    .slice(0, 2)
    .join('') || 'CC';

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return 'just now';
  const date = new Date(timestamp);
  const diff = Date.now() - date.getTime();

  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
};

export default function WeekDiscussions({ weekId, weekNumber, weekTitle }) {
  const { user, isAuthenticated } = useStore((state) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
  }));

  const [discussions, setDiscussions] = useState([]);
  const [expandedThread, setExpandedThread] = useState(null);
  const [newDiscussion, setNewDiscussion] = useState({ title: '', content: '' });
  const [showNewForm, setShowNewForm] = useState(false);
  const [replyText, setReplyText] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [posting, setPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState({});
  const [voting, setVoting] = useState({});

  const currentUserId = useMemo(() => user?._id || user?.id || null, [user]);

  const fetchDiscussions = useCallback(async () => {
    if (!weekId) return;

    try {
      setLoading(true);
      setError(null);
      const response = await resourceAPI.getResources(weekId, {
        type: 'discussion',
        limit: 50,
        sortBy: 'createdAt',
      });
      setDiscussions(response.data || []);
    } catch (err) {
      console.error('Failed to load discussions', err);
      setError('Unable to load discussions right now.');
    } finally {
      setLoading(false);
    }
  }, [weekId]);

  useEffect(() => {
    fetchDiscussions();
  }, [fetchDiscussions]);

  const ensureAuthenticated = () => {
    if (!isAuthenticated) {
      alert('Please log in to participate in discussions.');
      return false;
    }
    return true;
  };

  const handleCreateDiscussion = async () => {
    if (!weekId || !ensureAuthenticated()) return;

    const title = newDiscussion.title.trim();
    const content = newDiscussion.content.trim();

    if (!title || !content) {
      alert('Please fill in both title and description.');
      return;
    }

    try {
      setPosting(true);
      await resourceAPI.createResource({
        weekId,
        title,
        description: content,
        type: 'discussion',
      });
      setNewDiscussion({ title: '', content: '' });
      setShowNewForm(false);
      fetchDiscussions();
    } catch (err) {
      console.error('Failed to create discussion', err);
      alert(err?.message || 'Unable to create discussion right now.');
    } finally {
      setPosting(false);
    }
  };

  const handleAddReply = async (discussionId) => {
    if (!weekId || !ensureAuthenticated()) return;

    const message = replyText[discussionId]?.trim();
    if (!message) {
      alert('Reply cannot be empty.');
      return;
    }

    try {
      setReplyingTo((state) => ({ ...state, [discussionId]: true }));
      await resourceAPI.addComment(discussionId, message);
      setReplyText((state) => ({ ...state, [discussionId]: '' }));
      fetchDiscussions();
    } catch (err) {
      console.error('Failed to add reply', err);
      alert(err?.message || 'Unable to post reply right now.');
    } finally {
      setReplyingTo((state) => ({ ...state, [discussionId]: false }));
    }
  };

  const handleVote = async (discussionId) => {
    if (!weekId || !ensureAuthenticated()) return;

    try {
      setVoting((state) => ({ ...state, [discussionId]: true }));
      await resourceAPI.upvoteResource(discussionId);
      fetchDiscussions();
    } catch (err) {
      console.error('Failed to vote discussion', err);
      alert(err?.message || 'Unable to register vote right now.');
    } finally {
      setVoting((state) => ({ ...state, [discussionId]: false }));
    }
  };

  const renderAvatar = (author) => {
    if (author?.avatar) {
      return author.avatar;
    }
    return getInitials(author?.name || 'NPTEL');
  };

  return (
    <div className="mt-8 border-t border-slate-200 pt-8">
      <div className="flex flex-col gap-2 mb-6">
        <h3 className="text-2xl font-bold text-slate-900">
          💬 Week {weekNumber || ''} Discussions
        </h3>
        {weekTitle && (
          <p className="text-sm text-slate-500">Focused on {weekTitle}</p>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {!weekId && (
        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-6 text-center text-slate-600">
          Select a week to load its dedicated discussion space.
        </div>
      )}

      {weekId && (
        <>
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                {getInitials(user?.name || 'You')}
              </div>
              <button
                onClick={() => setShowNewForm(!showNewForm)}
                className="flex-1 px-4 py-2 bg-slate-100 rounded-lg text-slate-600 hover:bg-slate-200 text-left transition-colors"
              >
                Start a discussion or ask a question...
              </button>
            </div>

            {showNewForm && (
              <div className="space-y-4 border-t border-slate-200 pt-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Discussion Title
                  </label>
                  <input
                    type="text"
                    value={newDiscussion.title}
                    onChange={(e) =>
                      setNewDiscussion({ ...newDiscussion, title: e.target.value })
                    }
                    placeholder="e.g., Strategies for Week assignments"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Description / Question
                  </label>
                  <textarea
                    value={newDiscussion.content}
                    onChange={(e) =>
                      setNewDiscussion({ ...newDiscussion, content: e.target.value })
                    }
                    placeholder="Describe your challenge in detail..."
                    rows="4"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCreateDiscussion}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    {posting && <Loader2 size={16} className="animate-spin" />}
                    Post Discussion
                  </button>
                  <button
                    onClick={() => setShowNewForm(false)}
                    className="px-4 py-2 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12 bg-white border border-slate-200 rounded-lg text-slate-600">
                Loading discussions...
              </div>
            ) : discussions.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-slate-600 text-lg">
                  No discussions yet. Be the first to start a conversation!
                </p>
              </div>
            ) : (
              discussions.map((discussion) => {
                const replies = discussion.comments || [];
                const author = discussion.userId;
                const isUpvoted = currentUserId
                  ? discussion.upvotes?.some((id) => id?.toString() === currentUserId)
                  : false;

                return (
                  <div
                    key={discussion._id}
                    className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  >
                    <div className="p-6">
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-lg font-semibold">
                            {renderAvatar(author)}
                          </div>
                          <button
                            onClick={() => handleVote(discussion._id)}
                            disabled={voting[discussion._id]}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-sm transition-colors ${
                              isUpvoted
                                ? 'bg-blue-100 text-blue-600'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            } ${voting[discussion._id] ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            <Heart
                              size={16}
                              className={isUpvoted ? 'fill-current' : ''}
                            />
                            <span className="text-xs font-semibold">
                              {discussion.upvotes?.length || 0}
                            </span>
                          </button>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-slate-900">
                              {author?.name || 'Anonymous Learner'}
                            </span>
                            <span className="text-sm text-slate-500">
                              {formatRelativeTime(discussion.createdAt)}
                            </span>
                          </div>

                          <h4 className="text-lg font-semibold text-slate-900 mb-2">
                            {discussion.title}
                          </h4>
                          <p className="text-slate-700 mb-3">
                            {discussion.description || 'Shared without additional description.'}
                          </p>

                          <button
                            onClick={() =>
                              setExpandedThread(
                                expandedThread === discussion._id ? null : discussion._id
                              )
                            }
                            className="flex items-center gap-1 text-sm text-slate-600 hover:text-blue-600 transition-colors font-medium"
                          >
                            <MessageCircle size={16} />
                            {replies.length} replies
                            {expandedThread === discussion._id ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {expandedThread === discussion._id && (
                      <div className="bg-slate-50 border-t border-slate-200">
                        {replies.length > 0 && (
                          <div className="p-6 space-y-4 border-b border-slate-200">
                            {replies.map((reply) => {
                              const replyAuthor = reply.userId;
                              return (
                                <div
                                  key={reply._id}
                                  className="flex gap-3 pl-6 border-l-2 border-blue-300"
                                >
                                  <div className="w-10 h-10 rounded-full bg-white text-slate-700 flex items-center justify-center text-sm font-semibold">
                                    {getInitials(replyAuthor?.name || 'Learner')}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-semibold text-slate-900 text-sm">
                                        {replyAuthor?.name || 'Learner'}
                                      </span>
                                      <span className="text-xs text-slate-500">
                                        {formatRelativeTime(reply.createdAt)}
                                      </span>
                                    </div>
                                    <p className="text-sm text-slate-700">{reply.text}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="p-6">
                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">
                              {getInitials(user?.name || 'You')}
                            </div>
                            <div className="flex-1">
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={replyText[discussion._id] || ''}
                                  onChange={(e) =>
                                    setReplyText({
                                      ...replyText,
                                      [discussion._id]: e.target.value,
                                    })
                                  }
                                  placeholder="Write your reply..."
                                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                />
                                <button
                                  onClick={() => handleAddReply(discussion._id)}
                                  disabled={replyingTo[discussion._id]}
                                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                                >
                                  {replyingTo[discussion._id] ? (
                                    <Loader2 size={16} className="animate-spin" />
                                  ) : (
                                    <Send size={16} />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-slate-700">
              💡 <strong>Pro Tip:</strong> Upvote helpful discussions, cite resources, and be respectful while
              sharing your assignment strategies.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
