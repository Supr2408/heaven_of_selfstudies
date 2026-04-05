'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Heart,
  Link as LinkIcon,
  Loader2,
  MessageCircle,
  Send,
  StickyNote,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { resourceAPI, resolveApiAssetUrl } from '@/lib/api';
import {
  COURSE_DISCUSSION_UPLOAD_ACCEPT,
  MAX_COURSE_DISCUSSION_UPLOAD_LABEL,
  validateCourseDiscussionUploadFile,
} from '@/lib/pdfUploads';
import { getPublicUserName, isGoogleUser, isGuestLikeUser } from '@/lib/user';
import useStore from '@/store/useStore';

const CATEGORY_META = {
  discussion: {
    label: 'Discussion',
    accent: 'bg-slate-100 text-slate-700',
    icon: MessageCircle,
    prompt: 'Ask a course-level doubt, share a plan, or start a discussion.',
  },
  note: {
    label: 'Notes',
    accent: 'bg-amber-100 text-amber-700',
    icon: StickyNote,
    prompt: 'Share notes, summaries, or revision material for the whole course.',
  },
  link: {
    label: 'Links',
    accent: 'bg-cyan-100 text-cyan-700',
    icon: LinkIcon,
    prompt: 'Drop a useful article, video, drive folder, or reference link.',
  },
  solution: {
    label: 'Solution',
    accent: 'bg-emerald-100 text-emerald-700',
    icon: Send,
    prompt: 'Share a trusted solved file or explain the solution path clearly.',
  },
  resource: {
    label: 'Resource',
    accent: 'bg-violet-100 text-violet-700',
    icon: FileText,
    prompt: 'Add any extra material that helps everyone studying this course.',
  },
};

const FILTERS = ['all', 'discussion', 'note', 'link', 'solution', 'resource'];

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

export default function CourseDiscussionBoard({ courseId, courseTitle, yearInstances = [] }) {
  const router = useRouter();
  const { user, isAuthenticated } = useStore((state) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
  }));

  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [expandedThread, setExpandedThread] = useState(null);
  const [replyText, setReplyText] = useState({});
  const [replying, setReplying] = useState({});
  const [deleting, setDeleting] = useState({});
  const [voting, setVoting] = useState({});
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [newPost, setNewPost] = useState({
    type: 'discussion',
    title: '',
    content: '',
    url: '',
  });
  const [uploadState, setUploadState] = useState({
    type: 'resource',
    title: `${courseTitle || 'Course'} discussion file`,
    description: '',
    file: null,
  });

  const currentUserId = useMemo(() => user?._id || user?.id || '', [user]);
  const canPostAsUser = isGoogleUser(user);
  const isGuestMode = isGuestLikeUser(user);
  const selectedCategoryMeta = CATEGORY_META[newPost.type];

  const filteredResources = useMemo(() => {
    if (selectedFilter === 'all') return resources;
    return resources.filter((item) => item.type === selectedFilter);
  }, [resources, selectedFilter]);

  const fetchResources = useCallback(async () => {
    if (!courseId) return;

    try {
      setLoading(true);
      setError('');
      const response = await resourceAPI.getCourseResources(courseId, {
        limit: 100,
        sortBy: 'createdAt',
      });
      const sorted = [...(response?.data || [])].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setResources(sorted);
    } catch {
      setError('Unable to load this course discussion branch right now.');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  useEffect(() => {
    setUploadState((state) => ({
      ...state,
      title: state.title?.trim() ? state.title : `${courseTitle || 'Course'} discussion file`,
    }));
  }, [courseTitle]);

  const ensureSignedIn = () => {
    if (!isAuthenticated) {
      alert('Please log in to post or upload here.');
      return false;
    }
    return true;
  };

  const ensureCanPost = () => {
    if (!courseId) {
      setError('This discussion branch is missing its course connection.');
      return false;
    }

    if (!ensureSignedIn()) {
      return false;
    }

    if (!canPostAsUser) {
      alert('Please sign in with Google to post or upload files here.');
      router.push('/login');
      return false;
    }

    return true;
  };

  const handleCreatePost = async () => {
    if (!ensureCanPost()) return;

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

    if (['link', 'solution', 'resource'].includes(newPost.type) && !url) {
      alert('Please add the related link for this post.');
      return;
    }

    try {
      setPosting(true);
      setFeedback('');
      const response = await resourceAPI.createResource({
        courseId,
        branchType: 'course-discussion',
        title,
        description,
        type: newPost.type,
        url: url || undefined,
        fileType: url ? 'link' : undefined,
      });

      const created = response?.data;
      if (created?._id) {
        setResources((current) => [created, ...current.filter((item) => item._id !== created._id)]);
      }

      setNewPost({ type: 'discussion', title: '', content: '', url: '' });
      setShowComposer(false);
      setSelectedFilter('all');
      setFeedback('Post published successfully.');
      await fetchResources();
    } catch (err) {
      alert(err?.message || 'Unable to publish this post right now.');
    } finally {
      setPosting(false);
    }
  };

  const handleUpload = async () => {
    if (!ensureCanPost()) return;

    if (!uploadState.title.trim()) {
      alert('Please add a title for this file upload.');
      return;
    }

    const fileValidationError = validateCourseDiscussionUploadFile(uploadState.file);
    if (fileValidationError) {
      alert(fileValidationError);
      return;
    }

    const formData = new FormData();
    formData.append('courseId', courseId);
    formData.append('title', uploadState.title.trim());
    formData.append('description', uploadState.description.trim());
    formData.append('type', uploadState.type);
    formData.append('file', uploadState.file);

    try {
      setUploading(true);
      setFeedback('');
      await resourceAPI.uploadResourceFile(formData);
      setUploadState({
        type: uploadState.type,
        title: `${courseTitle || 'Course'} discussion file`,
        description: '',
        file: null,
      });
      setFeedback('File submitted successfully. It is now waiting for admin approval.');
    } catch (err) {
      alert(err?.message || 'Unable to upload this file right now.');
    } finally {
      setUploading(false);
    }
  };

  const handleReply = async (resourceId) => {
    if (!ensureCanPost()) return;

    const text = (replyText[resourceId] || '').trim();
    if (!text) {
      alert('Reply cannot be empty.');
      return;
    }

    try {
      setReplying((state) => ({ ...state, [resourceId]: true }));
      const response = await resourceAPI.addComment(resourceId, text);
      const comments = response?.data || [];
      setReplyText((state) => ({ ...state, [resourceId]: '' }));
      setResources((current) =>
        current.map((resource) =>
          resource._id === resourceId ? { ...resource, comments } : resource
        )
      );
    } catch (err) {
      alert(err?.message || 'Unable to post your reply right now.');
    } finally {
      setReplying((state) => ({ ...state, [resourceId]: false }));
    }
  };

  const handleVote = async (resourceId) => {
    if (!ensureSignedIn()) return;

    try {
      setVoting((state) => ({ ...state, [resourceId]: true }));
      await resourceAPI.upvoteResource(resourceId);
      await fetchResources();
    } catch (err) {
      alert(err?.message || 'Unable to register your vote right now.');
    } finally {
      setVoting((state) => ({ ...state, [resourceId]: false }));
    }
  };

  const handleDeletePost = async (resourceId) => {
    if (!window.confirm('Delete this post permanently?')) return;

    try {
      setDeleting((state) => ({ ...state, [resourceId]: true }));
      await resourceAPI.deleteResource(resourceId);
      setResources((current) => current.filter((resource) => resource._id !== resourceId));
      if (expandedThread === resourceId) {
        setExpandedThread(null);
      }
    } catch (err) {
      alert(err?.message || 'Unable to delete this post right now.');
    } finally {
      setDeleting((state) => ({ ...state, [resourceId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-slate-950 via-blue-700 to-cyan-500 px-6 py-8 text-white sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-100">
            Course Discussion Branch
          </p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{courseTitle || 'Course discussion'}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-blue-50 sm:text-base">
            This branch is for extra material, shared notes, solved files, and general discussion
            that belongs to the whole course instead of a single week.
          </p>

          {yearInstances.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {yearInstances.map((instance) => (
                <span
                  key={instance._id}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {instance.year} - {instance.semester}
                </span>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-blue-50">
              No batch branch is available yet, but this discussion branch is already open for extra
              material and future uploads.
            </div>
          )}
        </div>
      </section>

      {feedback ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {feedback}
        </div>
      ) : null}

      {!canPostAsUser ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {isGuestMode
            ? 'Guest and demo access can read this branch, but Google sign-in is required to post and upload files.'
            : 'Google sign-in is required to post and upload files in this branch.'}
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} />
          {error}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Contribute Here
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Share posts and upload files</h2>
          </div>

          <button
            onClick={() => {
              if (canPostAsUser) {
                setShowComposer((state) => !state);
              } else {
                router.push('/login');
              }
            }}
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            {canPostAsUser ? (showComposer ? 'Close composer' : 'Add a discussion post') : 'Continue with Google'}
          </button>
        </div>

        {showComposer ? (
          <div className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Category</label>
                <select
                  value={newPost.type}
                  onChange={(event) => setNewPost((state) => ({ ...state, type: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {Object.entries(CATEGORY_META).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">{selectedCategoryMeta.label}</p>
                <p className="mt-2">{selectedCategoryMeta.prompt}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Title</label>
                <input
                  value={newPost.title}
                  onChange={(event) =>
                    setNewPost((state) => ({ ...state, title: event.target.value }))
                  }
                  placeholder="Give this post a clear title"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Details</label>
                <textarea
                  value={newPost.content}
                  onChange={(event) =>
                    setNewPost((state) => ({ ...state, content: event.target.value }))
                  }
                  rows={5}
                  placeholder="Explain what you are sharing so others can understand it quickly."
                  className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Link {['link', 'solution', 'resource'].includes(newPost.type) ? '(required)' : '(optional)'}
                </label>
                <input
                  value={newPost.url}
                  onChange={(event) =>
                    setNewPost((state) => ({ ...state, url: event.target.value }))
                  }
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
        ) : null}

        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
              <UploadCloud size={22} />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900">Upload extra material</p>
              <p className="mt-1 text-sm text-slate-500">
                Upload a PDF, ZIP, PNG, or JPG file to this discussion branch. The file stays hidden until an admin reviews and approves it.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Type</label>
                <select
                  value={uploadState.type}
                  onChange={(event) =>
                    setUploadState((state) => ({ ...state, type: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="resource">Resource</option>
                  <option value="note">Notes</option>
                  <option value="solution">Solution</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Title</label>
                <input
                  value={uploadState.title}
                  onChange={(event) =>
                    setUploadState((state) => ({ ...state, title: event.target.value }))
                  }
                  placeholder="Cloud Computing extra notes ZIP"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Reviewer note</label>
                <textarea
                  value={uploadState.description}
                  onChange={(event) =>
                    setUploadState((state) => ({ ...state, description: event.target.value }))
                  }
                  rows={4}
                  placeholder="Mention source, batch relevance, or anything useful for review."
                  className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">File</label>
                <input
                  type="file"
                  accept={COURSE_DISCUSSION_UPLOAD_ACCEPT}
                  onChange={(event) =>
                    {
                      const nextFile = event.target.files?.[0] || null;
                      const fileError = nextFile ? validateCourseDiscussionUploadFile(nextFile) : '';
                      if (fileError) {
                        alert(fileError);
                      }
                      setUploadState((state) => ({
                        ...state,
                        file: fileError ? null : nextFile,
                      }));
                    }
                  }
                  className="block w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
                />
                {uploadState.file ? (
                  <p className="mt-2 text-xs text-slate-500">{uploadState.file.name}</p>
                ) : null}
                <p className="mt-2 text-xs text-slate-500">
                  PDF, ZIP, PNG, JPG, or JPEG. Maximum size: {MAX_COURSE_DISCUSSION_UPLOAD_LABEL}.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              Upload for admin review
            </button>
            <span className="text-xs text-slate-500">Approved files will appear in this branch.</span>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap gap-2">
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
              Loading branch content...
            </div>
          ) : filteredResources.length ? (
            filteredResources.map((resource) => {
              const category = CATEGORY_META[resource.type] || CATEGORY_META.discussion;
              const CategoryIcon = category.icon;
              const replies = resource.comments || [];
              const isExpanded = expandedThread === resource._id;
              const isOwner =
                String(resource.userId?._id || resource.userId) === String(currentUserId);
              const hasVoted = currentUserId
                ? (resource.upvotes || []).some((id) => String(id) === String(currentUserId))
                : false;
              const resourceHref = resolveApiAssetUrl(resource.url);

              return (
                <article
                  key={resource._id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="p-5">
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                          {getInitials(getPublicUserName(resource.userId))}
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
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900">
                              {getPublicUserName(resource.userId) || 'Community member'}
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${category.accent}`}>
                              <CategoryIcon size={12} />
                              {category.label}
                            </span>
                            <span className="text-sm text-slate-500">
                              {formatRelativeTime(resource.createdAt)}
                            </span>
                          </div>

                          {isOwner ? (
                            <button
                              type="button"
                              onClick={() => handleDeletePost(resource._id)}
                              disabled={deleting[resource._id]}
                              className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {deleting[resource._id] ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Trash2 size={14} />
                              )}
                              Delete
                            </button>
                          ) : null}
                        </div>

                        <h3 className="mt-3 text-xl font-semibold text-slate-900">{resource.title}</h3>
                        {resource.description ? (
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                            {resource.description}
                          </p>
                        ) : null}

                        {resource.url ? (
                          <a
                            href={resourceHref}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-4 inline-flex max-w-full items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-blue-700 transition hover:border-blue-200 hover:bg-blue-50"
                          >
                            <LinkIcon size={15} />
                            <span className="truncate">
                              {resource.url.startsWith('/uploads/') ? 'Open approved uploaded file' : resource.url}
                            </span>
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
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">No replies yet. Start the thread.</p>
                      )}

                      <div className="mt-4 flex gap-3">
                        <input
                          value={replyText[resource._id] || ''}
                          onChange={(event) =>
                            setReplyText((state) => ({
                              ...state,
                              [resource._id]: event.target.value,
                            }))
                          }
                          placeholder={
                            canPostAsUser
                              ? 'Add a reply...'
                              : 'Sign in with Google to reply to this thread'
                          }
                          disabled={!canPostAsUser}
                          className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                        <button
                          onClick={() => handleReply(resource._id)}
                          disabled={replying[resource._id] || !canPostAsUser}
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
              No approved posts yet in this branch. Start the first course-level discussion or upload
              the first extra PDF.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
