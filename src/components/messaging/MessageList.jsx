import React, { useEffect, useRef, useState } from 'react';
import { Smile, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

const COMMON_EMOJIS = ['👍', '❤️', '😂', '🔥', '✅', '👀'];

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getAvatarColor(email) {
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-pink-500'];
  const idx = email ? email.charCodeAt(0) % colors.length : 0;
  return colors[idx];
}

export default function MessageList({ messages, currentUser, onReact, onEdit, onDelete, isAdmin }) {
  const bottomRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [hoveredId, setHoveredId] = useState(null);
  const [showEmojiFor, setShowEmojiFor] = useState(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleStartEdit = (msg) => {
    setEditingId(msg.id);
    setEditContent(msg.content);
  };

  const handleSaveEdit = async (msg) => {
    await onEdit(msg, editContent);
    setEditingId(null);
  };

  const canModify = (msg) => msg.senderEmail === currentUser.email || isAdmin;

  // Group messages by sender + time
  let grouped = [];
  messages.forEach((msg, idx) => {
    const prev = messages[idx - 1];
    const isGrouped = prev && prev.senderEmail === msg.senderEmail && 
      new Date(msg.created_date) - new Date(prev.created_date) < 5 * 60 * 1000;
    grouped.push({ ...msg, isGrouped });
  });

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
      {grouped.map((msg) => (
        <div
          key={msg.id}
          className={`group flex items-start gap-3 relative hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 ${msg.isGrouped ? 'mt-0.5' : 'mt-3'}`}
          onMouseEnter={() => setHoveredId(msg.id)}
          onMouseLeave={() => { setHoveredId(null); setShowEmojiFor(null); }}
        >
          {!msg.isGrouped ? (
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${getAvatarColor(msg.senderEmail)}`}>
              {getInitials(msg.senderName)}
            </div>
          ) : <div className="w-9 flex-shrink-0" />}
          
          <div className="flex-1 min-w-0">
            {!msg.isGrouped && (
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="font-semibold text-gray-900 text-sm">{msg.senderName}</span>
                <span className="text-xs text-gray-400">
                  {format(new Date(msg.created_date), 'MMM d, h:mm a')}
                </span>
                {msg.edited && <span className="text-xs text-gray-400">(edited)</span>}
              </div>
            )}

            {editingId === msg.id ? (
              <div className="flex gap-2 items-center">
                <input
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(msg);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="flex-1 border rounded px-2 py-1 text-sm"
                  autoFocus
                />
                <button onClick={() => handleSaveEdit(msg)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Save</button>
                <button onClick={() => setEditingId(null)} className="text-xs text-gray-500">Cancel</button>
              </div>
            ) : (
              <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                {msg.content.split(/(@\w[\w.]*)/g).map((part, i) =>
                  part.startsWith('@') ? <span key={i} className="text-blue-600 font-medium">{part}</span> : part
                )}
              </p>
            )}

            {msg.attachmentUrl && (
              <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline mt-1 block">
                📎 {msg.attachmentName || 'Attachment'}
              </a>
            )}

            {msg.reactions && msg.reactions.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {Object.entries(
                  msg.reactions.reduce((acc, r) => {
                    acc[r.emoji] = (acc[r.emoji] || []);
                    acc[r.emoji].push(r.userEmail);
                    return acc;
                  }, {})
                ).map(([emoji, users]) => (
                  <button
                    key={emoji}
                    onClick={() => onReact(msg, emoji)}
                    className={`text-xs border rounded-full px-2 py-0.5 flex items-center gap-1 hover:bg-gray-100 ${
                      users.includes(currentUser.email) ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    {emoji} <span className="text-gray-600">{users.length}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {hoveredId === msg.id && (
            <div className="absolute right-2 top-1 flex gap-1 bg-white border border-gray-200 rounded-lg shadow-sm px-1 py-0.5">
              <div className="relative">
                <button
                  onClick={() => setShowEmojiFor(showEmojiFor === msg.id ? null : msg.id)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <Smile className="w-4 h-4 text-gray-500" />
                </button>
                {showEmojiFor === msg.id && (
                  <div className="absolute right-0 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 flex gap-1 z-10">
                    {COMMON_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => { onReact(msg, emoji); setShowEmojiFor(null); }}
                        className="text-lg hover:bg-gray-100 rounded p-1"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {canModify(msg) && (
                <>
                  <button onClick={() => handleStartEdit(msg)} className="p-1 hover:bg-gray-100 rounded">
                    <Pencil className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this message?')) onDelete(msg);
                    }}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}