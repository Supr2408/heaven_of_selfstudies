'use client';

import { useEffect, useState } from 'react';
import { ThumbsUp, ThumbsDown, MessageCircle, Flag, ExternalLink } from 'lucide-react';
import { resourceAPI } from '@/lib/api';
import { getPublicUserName } from '@/lib/user';
import useStore from '@/store/useStore';

export default function ResourceVault({ weekId }) {
  const store = useStore();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  // Fetch resources
  useEffect(() => {
    const fetchResources = async () => {
      try {
        setLoading(true);
        const response = await resourceAPI.getResources(weekId, {
          type: filter === 'all' ? undefined : filter,
          page: 1,
          limit: 20,
        });
        setResources(response.data);
      } catch (error) {
        console.error('Failed to fetch resources:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchResources();
  }, [weekId, filter]);

  const handleUpvote = async (resourceId) => {
    if (!store.isAuthenticated) {
      alert('Please login to vote');
      return;
    }

    try {
      await resourceAPI.upvoteResource(resourceId);
      // Optimistic update
      const updated = resources.map((r) =>
        r._id === resourceId
          ? { ...r, upvotes: r.upvotes.length + 1 }
          : r
      );
      setResources(updated);
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handleReport = async (resourceId) => {
    if (!store.isAuthenticated) {
      alert('Please login to report');
      return;
    }

    const reason = prompt('Why are you reporting this resource?');
    if (!reason) return;

    try {
      await resourceAPI.reportResource(resourceId, reason);
      alert('Resource reported successfully');
    } catch (error) {
      console.error('Error reporting resource:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'note', 'link', 'solution', 'discussion'].map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              filter === type
                ? 'bg-blue-500 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Resources Grid */}
      {loading ? (
        <div className="text-center text-slate-500">Loading resources...</div>
      ) : resources.length === 0 ? (
        <div className="text-center text-slate-500">No resources yet</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {resources.map((resource) => (
            <div
              key={resource._id}
              className="p-4 border border-slate-200 rounded-lg hover:shadow-md transition-shadow"
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 line-clamp-2">
                    {resource.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    by {getPublicUserName(resource.userId)}
                  </p>
                </div>
                <span className="px-2 py-1 bg-slate-100 text-xs rounded text-slate-600 capitalize ml-2">
                  {resource.type}
                </span>
              </div>

              {/* Description */}
              {resource.description && (
                <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                  {resource.description}
                </p>
              )}

              {/* Tags */}
              {resource.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {resource.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Stats & Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex gap-3 text-sm">
                  <button
                    onClick={() => handleUpvote(resource._id)}
                    className="flex items-center gap-1 text-slate-600 hover:text-blue-500 transition-colors"
                  >
                    <ThumbsUp size={14} />
                    {resource.upvotes.length}
                  </button>
                  <button className="flex items-center gap-1 text-slate-600 hover:text-slate-700 transition-colors">
                    <MessageCircle size={14} />
                    {resource.comments?.length || 0}
                  </button>
                  <div className="flex items-center gap-1 text-slate-500 text-xs">
                    👁 {resource.views || 0}
                  </div>
                </div>

                <div className="flex gap-2">
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 hover:bg-slate-100 rounded transition-colors"
                  >
                    <ExternalLink size={14} className="text-blue-500" />
                  </a>
                  <button
                    onClick={() => handleReport(resource._id)}
                    className="p-1 hover:bg-slate-100 rounded transition-colors"
                  >
                    <Flag size={14} className="text-slate-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
