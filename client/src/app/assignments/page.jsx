'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  MessageSquare,
  PlusCircle,
  Send,
  Trash2,
} from 'lucide-react';
import MainLayout from '@/components/MainLayout';
import { commonDiscussionAPI } from '@/lib/api';
import { getPublicUserName, isGoogleUser } from '@/lib/user';
import useStore from '@/store/useStore';

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

const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join('') || 'NH';

export default function AssignmentsPage() {
  const user = useStore((state) => state.user);
  const canPost = isGoogleUser(user);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replying, setReplying] = useState({});
  const [deleting, setDeleting] = useState({});
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [postForm, setPostForm] = useState({
    title: '',
    content: '',
  });
  const [replyText, setReplyText] = useState({});
  const [openReplyId, setOpenReplyId] = useState(null);

  const sortedPosts = useMemo(
    () => [...posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [posts]
  );

  const loadPosts = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccessMessage('');
      const response = await commonDiscussionAPI.getPosts();
      setPosts(response.data || []);
    } catch {
      setError('Unable to load the common discussion right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const handleCreatePost = async () => {
    const title = postForm.title.trim();
    const content = postForm.content.trim();

    if (!canPost) {
      setError('Please sign in with Google to start a discussion.');
      setSuccessMessage('');
      return;
    }

    if (!title || !content) {
      setError('Please add both a title and a message.');
      setSuccessMessage('');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const response = await commonDiscussionAPI.createPost({ title, content });
      setPostForm({ title: '', content: '' });
      setPosts((current) => [response.data, ...current]);
      setSuccessMessage('Post published successfully.');
    } catch (err) {
      setError(err?.message || 'Unable to create this post right now.');
      setSuccessMessage('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (postId) => {
    const text = (replyText[postId] || '').trim();

    if (!canPost) {
      setError('Please sign in with Google to reply.');
      setSuccessMessage('');
      return;
    }

    if (!text) {
      setError('Reply cannot be empty.');
      setSuccessMessage('');
      return;
    }

    try {
      setReplying((state) => ({ ...state, [postId]: true }));
      setError('');
      const response = await commonDiscussionAPI.addReply(postId, text);
      setReplyText((state) => ({ ...state, [postId]: '' }));
      setPosts((current) =>
        current.map((post) => (post._id === postId ? response.data : post))
      );
      setSuccessMessage('Reply added successfully.');
    } catch (err) {
      setError(err?.message || 'Unable to add your reply right now.');
      setSuccessMessage('');
    } finally {
      setReplying((state) => ({ ...state, [postId]: false }));
    }
  };

  const handleDeletePost = async (postId) => {
    const confirmed = window.confirm('Delete this post permanently?');
    if (!confirmed) return;

    try {
      setDeleting((state) => ({ ...state, [postId]: true }));
      setError('');
      await commonDiscussionAPI.deletePost(postId);
      setPosts((current) => current.filter((post) => post._id !== postId));
      if (openReplyId === postId) {
        setOpenReplyId(null);
      }
      setSuccessMessage('Post deleted successfully.');
    } catch (err) {
      setError(err?.message || 'Unable to delete this post right now.');
      setSuccessMessage('');
    } finally {
      setDeleting((state) => ({ ...state, [postId]: false }));
    }
  };

  return (
    <MainLayout>
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-100 p-3 text-blue-600">
              <MessageSquare size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Common Discussion
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                A simple space for general discussion
              </h1>
            </div>
          </div>

          <p className="mt-5 text-sm leading-7 text-slate-600">
            Use this page for platform-wide questions, general study talk, or discussion that does
            not belong to a specific week. For course-specific discussion, open a week page from
            the dashboard.
          </p>

          {!canPost ? (
            <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              You are browsing as a guest. You can read everything here, but you need Google sign-in
              to start a post or reply.
              <Link href="/login" className="ml-2 font-semibold underline">
                Continue with Google
              </Link>
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <PlusCircle size={18} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Start a new post</h2>
          </div>

          <div className="mt-4 space-y-4">
            <input
              value={postForm.title}
              onChange={(event) =>
                setPostForm((state) => ({ ...state, title: event.target.value }))
              }
              placeholder={canPost ? 'Discussion title' : 'Sign in with Google to post'}
              disabled={!canPost || submitting}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
            <textarea
              value={postForm.content}
              onChange={(event) =>
                setPostForm((state) => ({ ...state, content: event.target.value }))
              }
              rows={5}
              placeholder={canPost ? 'Write your message...' : 'Sign in with Google to post'}
              disabled={!canPost || submitting}
              className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
            <button
              type="button"
              onClick={handleCreatePost}
              disabled={!canPost || submitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Post
            </button>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        <section className="space-y-4">
          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center text-slate-600 shadow-sm">
              Loading discussions...
            </div>
          ) : sortedPosts.length ? (
            sortedPosts.map((post) => (
              <article
                key={post._id}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                    {getInitials(getPublicUserName(post.userId))}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {getPublicUserName(post.userId)}
                        </span>
                        <span className="text-sm text-slate-500">
                          {formatRelativeTime(post.createdAt)}
                        </span>
                      </div>

                      {String(post.userId?._id || post.userId) === String(user?._id || user?.id) ? (
                        <button
                          type="button"
                          onClick={() => handleDeletePost(post._id)}
                          disabled={deleting[post._id]}
                          className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deleting[post._id] ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                          Delete
                        </button>
                      ) : null}
                    </div>
                    <h3 className="mt-2 text-xl font-semibold text-slate-900">{post.title}</h3>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                      {post.content}
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        setOpenReplyId((current) => (current === post._id ? null : post._id))
                      }
                      className="mt-4 text-sm font-semibold text-blue-700 transition hover:text-blue-800"
                    >
                      {post.replies?.length || 0} repl{post.replies?.length === 1 ? 'y' : 'ies'}
                    </button>
                  </div>
                </div>

                {openReplyId === post._id ? (
                  <div className="mt-5 border-t border-slate-200 pt-5">
                    <div className="space-y-3">
                      {(post.replies || []).length ? (
                        post.replies.map((reply) => (
                          <div
                            key={reply._id}
                            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                          >
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-semibold text-slate-900">
                                {getPublicUserName(reply.userId)}
                              </span>
                              <span className="text-slate-500">
                                {formatRelativeTime(reply.createdAt)}
                              </span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                              {reply.text}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">No replies yet.</p>
                      )}
                    </div>

                    <div className="mt-4 flex gap-3">
                      <input
                        value={replyText[post._id] || ''}
                        onChange={(event) =>
                          setReplyText((state) => ({
                            ...state,
                            [post._id]: event.target.value,
                          }))
                        }
                        placeholder={canPost ? 'Write a reply...' : 'Sign in with Google to reply'}
                        disabled={!canPost || replying[post._id]}
                        className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleReply(post._id)}
                        disabled={!canPost || replying[post._id]}
                        className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {replying[post._id] ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Send size={16} />
                        )}
                        Reply
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-slate-600">
              No common discussion posts yet. Start the first one.
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
