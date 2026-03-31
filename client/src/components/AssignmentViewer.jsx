'use client';

import { useState, useEffect } from 'react';
import { Heart, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { assignmentAPI } from '@/lib/api';

export default function AssignmentViewer({ courseCode, weekNumber }) {
  const [solution, setSolution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedDiscussions, setExpandedDiscussions] = useState(false);
  const [discussions, setDiscussions] = useState([
    {
      id: 1,
      author: 'Student A',
      avatar: '👨‍🎓',
      title: 'What does the first part mean?',
      content: 'I am confused about the first part of the solution.',
      votes: 5,
      replies: 2,
      timestamp: '2 hours ago',
    },
    {
      id: 2,
      author: 'Student B',
      avatar: '👩‍🎓',
      title: 'Great explanation!',
      content: 'This solution is very clear and helpful.',
      votes: 12,
      replies: 1,
      timestamp: '1 hour ago',
    },
  ]);
  const [newDiscussion, setNewDiscussion] = useState('');

  useEffect(() => {
    const fetchSolution = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await assignmentAPI.getSolution(courseCode, weekNumber);
        setSolution(data.solution);
      } catch (err) {
        setError(err?.data?.error || err.message || 'Failed to load solution');
      } finally {
        setLoading(false);
      }
    };

    if (courseCode && weekNumber) {
      fetchSolution();
    }
  }, [courseCode, weekNumber]);

  const handlePostDiscussion = () => {
    if (!newDiscussion.trim()) {
      alert('Please enter a discussion');
      return;
    }

    const discussion = {
      id: discussions.length + 1,
      author: 'You',
      avatar: '😊',
      title: newDiscussion.split('\n')[0],
      content: newDiscussion,
      votes: 0,
      replies: 0,
      timestamp: 'just now',
    };

    setDiscussions([discussion, ...discussions]);
    setNewDiscussion('');
    alert('Discussion posted!');
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-600">Loading solution...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 font-semibold">{error}</p>
      </div>
    );
  }

  if (!solution) {
    return (
      <div className="text-center py-12 text-slate-600">
        No solution available for this week.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* PDF Viewer */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-slate-100 p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">
            {solution.assignmentNumber} - {solution.title}
          </h3>
        </div>

        {/* Embed Google Drive PDF */}
        <div className="w-full" style={{ height: '600px', overflow: 'hidden' }}>
          <iframe
            src={solution.embedLink}
            className="w-full h-full border-0"
            title="Assignment Solution PDF"
            allow="autoplay"
          />
        </div>

        {/* Link to Original */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-sm text-slate-600">
            View on Google Drive for better quality
          </p>
          <a
            href={solution.driveLink}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Open in Drive
          </a>
        </div>
      </div>

      {/* Discussions Section */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <button
          onClick={() => setExpandedDiscussions(!expandedDiscussions)}
          className="w-full flex items-center justify-between py-2"
        >
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <MessageCircle size={20} className="text-blue-600" />
            Discussions ({discussions.length})
          </h3>
          {expandedDiscussions ? <ChevronUp /> : <ChevronDown />}
        </button>

        {expandedDiscussions && (
          <div className="mt-6 space-y-4">
            {/* New Discussion Form */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Ask a Question or Share Your Thoughts
              </label>
              <textarea
                value={newDiscussion}
                onChange={(e) => setNewDiscussion(e.target.value)}
                placeholder="Type your discussion here..."
                rows="3"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <button
                onClick={handlePostDiscussion}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Post Discussion
              </button>
            </div>

            {/* Discussions List */}
            <div className="space-y-3">
              {discussions.map((discussion) => (
                <div
                  key={discussion.id}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex gap-3">
                    <div className="text-2xl">{discussion.avatar}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-slate-900">
                          {discussion.author}
                        </p>
                        <p className="text-xs text-slate-500">{discussion.timestamp}</p>
                      </div>
                      <p className="font-medium text-slate-900 mb-1">
                        {discussion.title}
                      </p>
                      <p className="text-sm text-slate-700 mb-2">
                        {discussion.content}
                      </p>

                      {/* Discussion Actions */}
                      <div className="flex gap-3 text-sm">
                        <button className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 transition-colors">
                          <Heart size={14} />
                          <span>{discussion.votes}</span>
                        </button>
                        <button className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 transition-colors">
                          <MessageCircle size={14} />
                          <span>{discussion.replies} replies</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
