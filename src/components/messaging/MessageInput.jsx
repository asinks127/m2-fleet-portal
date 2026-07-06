import React, { useState, useRef } from 'react';
import { Send, Paperclip, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient.js';

export default function MessageInput({ onSend, users, placeholder }) {
  const [content, setContent] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const fileRef = useRef(null);

  const handleContentChange = (e) => {
    const val = e.target.value;
    setContent(val);
    
    const lastWord = val.split(' ').pop();
    if (lastWord.startsWith('@') && lastWord.length > 1) {
      setMentionQuery(lastWord.slice(1).toLowerCase());
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const handleMentionSelect = (user) => {
    const words = content.split(' ');
    words[words.length - 1] = `@${user.full_name || user.email}`;
    setContent(words.join(' ') + ' ');
    setShowMentions(false);
  };

  const mentionSuggestions = users.filter(u =>
    (u.full_name || u.email).toLowerCase().includes(mentionQuery)
  ).slice(0, 5);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(`${Date.now()}_${file.name}`, file);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(data.path);
    setAttachment({ url: urlData.publicUrl, name: file.name });
    setUploading(false);
  };

  const handleSend = async () => {
    if (!content.trim() && !attachment) return;
    setSending(true);
    try {
      await onSend({ content: content.trim(), attachmentUrl: attachment?.url, attachmentName: attachment?.name });
      setContent('');
      setAttachment(null);
    } catch (e) {
      console.error('Send failed:', e);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="px-4 pb-4 pt-2 border-t">
      {attachment && (
        <div className="flex items-center gap-2 mb-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <span className="text-sm text-blue-700">📎 {attachment.name}</span>
          <button onClick={() => setAttachment(null)} className="ml-auto text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      <div className="relative flex items-end gap-2 bg-gray-100 rounded-xl px-3 py-2">
        {showMentions && mentionSuggestions.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg min-w-48 z-10">
            {mentionSuggestions.map(user => (
              <button
                key={user.id}
                onClick={() => handleMentionSelect(user)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <span className="font-medium">{user.full_name || user.email}</span>
              </button>
            ))}
          </div>
        )}
        
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="text-gray-400 hover:text-gray-600 flex-shrink-0 pb-1"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />
        
        <textarea
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder={uploading ? 'Uploading...' : placeholder || 'Type a message...'}
          disabled={uploading}
          rows={1}
          className="flex-1 bg-transparent text-sm resize-none outline-none max-h-32 py-1"
          style={{ minHeight: '24px' }}
        />
        
        <button
          onClick={handleSend}
          disabled={(!content.trim() && !attachment) || sending || uploading}
          className="flex-shrink-0 pb-1 text-blue-600 disabled:text-gray-300 hover:text-blue-700"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-1 ml-1">Press Enter to send, Shift+Enter for new line. Use @ to mention someone.</p>
    </div>
  );
}