'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Heart,
  Link as LinkIcon,
  Loader2,
  MessageCircle,
  Send,
  StickyNote,
} from 'lucide-react';
import { resourceAPI } from '@/lib/api';
import useStore from '@/store/useStore';

const CATEGORY_META = {
  discussion: {
    label: 'Discussion',
    accent: 'bg-slate-100 text-slate-700',
    icon: MessageCircle,
    prompt: 'Ask a doubt, share a thought, or start a discussion thread.',
  },
  note: {
    label: 'Notes',
    accent: 'bg-amber-100 text-amber-700',
    icon: StickyNote,
    prompt: 'Share your own notes or revision summary for this week.',
  },
  link: {
    label: 'Links',
    accent: 'bg-cyan-100 text-cyan-700',
    icon: LinkIcon,
    prompt: 'Drop a useful link such as a reference article or video.',
  },
  solution: {
    label: 'Solution',
    accent: 'bg-emerald-100 text-emerald-700',
    icon: Send,
    prompt: 'Share a trusted solution link or explain the approach clearly.',
  },
};

const FILTERS = ['all', 'discussion', 'note', 'link', 'solution'];

const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join('') || 'NH';

const formatRelativeTime = (value) => {
  if (!value) return 'just now';
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));

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

  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [expandedThread, setExpandedThread] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [posting, setPosting] = useState(false);
  const [replying, setReplying] = useState({});
  const [voting, setVoting] = useState({});
  const [replyText, setReplyText] = useState({});
  const [newPost, setNewPost] = useState({
    type: 'discussion',
    title: '',
    content: '',
    url: '',
  });

  const currentUserId = useMemo(() => user?._id || user?.id || '', [user]);
  const selectedCategoryMeta = CATEGORY_META[newPost.type];

  const filteredResources = useMemo(() => {
    if (selectedFilter === 'all') return resources;
    return resources.filter((item) => item.type === selectedFilter);
  }, [resources, selectedFilter]);

  const fetchResources = useCallback(async () => {
    if (!weekId) return;

    try {
      setLoading(true);
      setError('');
      const response = await resourceAPI.getResources(weekId, {
        limit: 100,
        sortBy: 'createdAt',
      });
      const sorted = [...(response?.data || [])].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setResources(sorted);
    } catch {
      setError('Unable to load the discussion board right now.');
    } finally {
      setLoading(false);
    }
  }, [weekId]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const ensureAuthenticated = () => {
    if (!isAuthenticated) {
      alert('Please log in to post or reply.');
      return false;
    }
    return true;
  };

  const handleCreatePost = async () => {
    if (!ensureAuthenticated() || !weekId) return;

    const title = newPost.title.trim();
    const description = newPost.content.trim();
    const url = newPost.url.trim();

    if (!title) {
      alert('Please add a title for your post.');
      return;
    }

    if (!description && newPost.type === 'discussion') {
      alert('Please describe your discussion clearly.');
      return;
    }

    if (['link', 'solution'].includes(newPost.type) && !url) {
      alert('Please add the material link for this category.');
      return;
    }

    try {
      setPosting(true);
      await resourceAPI.createResource({
        weekId,
        title,
        description,
        type: newPost.type,
        url: url || undefined,
        fileType: url ? 'link' : undefined,
      });
      setNewPost({ type: 'discussion', title: '', content: '', url: '' });
      setShowComposer(false);
      setSelectedFilter('all');
      fetchResources();
    } catch (err) {
      alert(err?.message || 'Unable to create this post right now.');
    } finally {
      setPosting(false);
    }
  };

  const handleReply = async (resourceId) => {
    if (!ensureAuthenticated()) return;

    const text = (replyText[resourceId] || '').trim();
    if (!text) {
      alert('Reply cannot be empty.');
      return;
    }

    try {
      setReplying((state) => ({ ...state, [resourceId]: true }));
      await resourceAPI.addComment(resourceId, text);
      setReplyText((state) => ({ ...state, [resourceId]: '' }));
      fetchResources();
    } catch (err) {
      alert(err?.message || 'Unable to post your reply right now.');
    } finally {
      setReplying((state) => ({ ...state, [resourceId]: false }));
    }
  };

  const handleVote = async (resourceId) => {
    if (!ensureAuthenticated()) return;

    try {
      setVoting((state) => ({ ...state, [resourceId]: true }));
      await resourceAPI.upvoteResource(resourceId);
      fetchResources();
    } catch (err) {
      alert(err?.message || 'Unable to register your vote right now.');
    } finally {
      setVoting((state) => ({ ...state, [resourceId]: false }));
    }
  };

  return (
    <section id="week-discussion-board" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Discussion Board
          </p>
          <h2 className="mt-1 text-3xl font-bold text-slate-900">
            Week {weekNumber} community space
          </h2>
          {weekTitle ? (
            <p className="mt-2 text-sm text-slate-500">
              Share notes, useful links, solutions, and discussion points for {weekTitle}.
            </p>
          ) : null}
        </div>

        <button
          onClick={() => setShowComposer((state) => !state)}
          className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          {showComposer ? 'Close composer' : 'Add a community post'}
        </button>
      </div>

      {error ? (
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} />
          {error}
        </div>
      ) : null}

      {showComposer ? (
        <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Category</label>
                <select
                  value={newPost.type}
                  onChange={(e) => setNewPost((state) => ({ ...state, type: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {Object.entries(CATEGORY_META).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">{selectedCategoryMeta.label}</p>
                <p className="mt-2">{selectedCategoryMeta.prompt}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Title</label>
                <input
                  value={newPost.title}
                  onChange={(e) => setNewPost((state) => ({ ...state, title: e.target.value }))}
                  placeholder="Give this post a clear title"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Details
                </label>
                <textarea
                  value={newPost.content}
                  onChange={(e) => setNewPost((state) => ({ ...state, content: e.target.value }))}
                  rows={5}
                  placeholder="Explain what you are sharing so others can understand it quickly."
                  className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Link {['link', 'solution'].includes(newPost.type) ? '(required)' : '(optional)'}
                </label>
                <input
                  value={newPost.url}
                  onChange={(e) => setNewPost((state) => ({ ...state, url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleCreatePost}
                  disabled={posting}
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {posting ? <Loader2 size={16} className="animate-spin" /> : null}
                  Publish post
                </button>
                <button
                  onClick={() => setShowComposer(false)}
                  className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              selectedFilter === filter
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {filter === 'all' ? 'All posts' : CATEGORY_META[filter].label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-12 text-center text-slate-600">
            Loading community posts...
          </div>
        ) : filteredResources.length ? (
          filteredResources.map((resource) => {
            const category = CATEGORY_META[resource.type] || CATEGORY_META.discussion;
            const CategoryIcon = category.icon;
            const replies = resource.comments || [];
            const isExpanded = expandedThread === resource._id;
            const hasVoted = currentUserId
              ? (resource.upvotes || []).some((id) => String(id) === String(currentUserId))
              : false;

            return (
              <article
                key={resource._id}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="p-5">
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                        {getInitials(resource.userId?.name || 'Learner')}
                      </div>
                      <button
                        onClick={() => handleVote(resource._id)}
                        disabled={voting[resource._id]}
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                          hasVoted
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <Heart size={13} className={hasVoted ? 'fill-current' : ''} />
                        {resource.upvotes?.length || 0}
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {resource.userId?.name || 'Community member'}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${category.accent}`}>
                          <CategoryIcon size={12} />
                          {category.label}
                        </span>
                        <span className="text-sm text-slate-500">
                          {formatRelativeTime(resource.createdAt)}
                        </span>
                      </div>

                      <h3 className="mt-3 text-xl font-semibold text-slate-900">{resource.title}</h3>
                      {resource.description ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                          {resource.description}
                        </p>
                      ) : null}

                      {resource.url ? (
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex max-w-full items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-blue-700 transition hover:border-blue-200 hover:bg-blue-50"
                        >
                          <LinkIcon size={15} />
                          <span className="truncate">{resource.url}</span>
                        </a>
                      ) : null}

                      <button
                        onClick={() => setExpandedThread(isExpanded ? null : resource._id)}
                        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-blue-700"
                      >
                        <MessageCircle size={16} />
                        {replies.length} repl{replies.length === 1 ? 'y' : 'ies'}
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded ? (
                  <div className="border-t border-slate-200 bg-slate-50 p-5">
                    {replies.length ? (
                      <div className="space-y-4">
                        {replies.map((reply) => (
                          <div key={reply._id} className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-semibold text-slate-900">
                                {reply.userId?.name || 'Learner'}
                              </span>
                              <span className="text-slate-500">
                                {formatRelativeTime(reply.createdAt)}
                              </span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                              {reply.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No replies yet. Start the thread.</p>
                    )}

                    <div className="mt-4 flex gap-3">
                      <input
                        value={replyText[resource._id] || ''}
                        onChange={(e) =>
                          setReplyText((state) => ({ ...state, [resource._id]: e.target.value }))
                        }
                        placeholder="Add a reply..."
                        className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                      <button
                        onClick={() => handleReply(resource._id)}
                        disabled={replying[resource._id]}
                        className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {replying[resource._id] ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        Reply
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-slate-600">
            No posts in this category yet. Add the first community contribution for this week.
          </div>
        )}
      </div>
    </section>
  );
}
