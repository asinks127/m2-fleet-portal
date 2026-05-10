import React, { useEffect, useRef, useState } from 'react';
import { Smile, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

const COMMON_EMOJIS = ['👍', '❤️', '😂', '🔥', '✅', '👀'];

function renderMessageContent(content) {
  if (content.startsWith('🎫 **New Task Created:**')) {
    const lines = content.split('\n');
    const titleLine = lines.find(l => l.startsWith('🎫 **New Task Created:**'));
    const assignLine = lines.find(l => l.startsWith('👤 **Assigned to:**'));
    const priorityLine = lines.find(l => l.startsWith('⚡ **Priority:**'));
    const dueLine = lines.find(l => l.startsWith('📅 **Due:**'));

    const title = titleLine ? titleLine.replace('🎫 **New Task Created:**', '').trim() : '';
    const assignee = assignLine ? assignLine.replace('👤 **Assigned to:**', '').trim() : 'Unassigned';
    const priority = priorityLine ? priorityLine.replace('⚡ **Priority:**', '').trim() : 'medium';
    const dueDate = dueLine ? dueLine.replace('📅 **Due:**', '').trim() : 'None';

    const getPriorityColor = (p) => {
      const pLower = p.toLowerCase();
      if (pLower === 'high') return 'bg-red-50 text-red-700 border-red-200';
      if (pLower === 'low') return 'bg-gray-50 text-gray-700 border-gray-200';
      return 'bg-amber-50 text-amber-700 border-amber-200';
    };

    return (
      <div className="mt-1.5 mb-1 p-3 bg-white border border-gray-200 shadow-sm rounded-lg max-w-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h4 className="font-semibold text-gray-900 text-sm leading-snug">{title}</h4>
          <span className={`text-[10px] px-2 py-0.5 rounded-md border font-bold uppercase tracking-wider whitespace-nowrap ${getPriorityColor(priority)}`}>
            {priority}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs mt-3 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-gray-600 truncate max-w-[50%]">
            <span className="text-gray-400 text-[11px]">👤</span>
            <span className="truncate font-medium" title={assignee}>{assignee}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-600">
            <span className="text-gray-400 text-[11px]">📅</span>
            <span className="font-medium">{dueDate}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
      {content.split(/(@\w[\w.]*)/g).map((part, i) =>
        part.startsWith('@') ? <span key={i} className="text-blue-600 font-medium">{part}</span> : part
      )}
    </p>
  );
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getAvatarColor(email) {
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-pink-500'];
  const idx = email ? email.charCodeAt(0) % colors.length : 0;
  return colors[idx];
}

export default function MessageList({ messages, currentUser }) {
  const bottomRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [hoveredId, setHoveredId] = useState(null);
  const [showEmojiFor, setShowEmojiFor] = useState(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const canModify = (msg) => msg.senderEmail === currentUser?.email;

  // Group messages by sender + time
  let grouped = [];
  messages.forEach((msg, idx) => {
    const prev = messages[idx - 1];
    const msgDate = msg.created_date || msg.createdAt || msg.created_at;
    const prevDate = prev?.created_date || prev?.createdAt || prev?.created_at;
    const isGrouped = prev && prev.senderEmail === msg.senderEmail && 
      (msgDate && prevDate ? new Date(msgDate) - new Date(prevDate) < 5 * 60 * 1000 : false);
    grouped.push({ ...msg, isGrouped });
  });

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
      {grouped.map((msg) => {
        const msgDate = msg.created_date || msg.createdAt || msg.created_at;
        return (
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
                  {msgDate && (
                    <span className="text-xs text-gray-400">
                      {format(new Date(msgDate), 'MMM d, h:mm a')}
                    </span>
                  )}
                  {msg.edited && <span className="text-xs text-gray-400">(edited)</span>}
                </div>
              )}

              {editingId === msg.id ? (
                <div className="flex gap-2 items-center">
                  <input
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="flex-1 border rounded px-2 py-1 text-sm"
                    autoFocus
                  />
                  <button className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-gray-500">Cancel</button>
                </div>
              ) : (
                renderMessageContent(msg.content)
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
                      className={`text-xs border rounded-full px-2 py-0.5 flex items-center gap-1 hover:bg-gray-100 ${
                        users.includes(currentUser?.email) ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      {emoji} <span className="text-gray-600">{users.length}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {hoveredId === msg.id && canModify(msg) && (
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
                          onClick={() => setShowEmojiFor(null)}
                          className="text-lg hover:bg-gray-100 rounded p-1"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => { setEditingId(msg.id); setEditContent(msg.content); }} className="p-1 hover:bg-gray-100 rounded">
                  <Pencil className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}