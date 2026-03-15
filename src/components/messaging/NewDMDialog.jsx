import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { supabase } from '@/lib/supabaseClient.js';

export default function NewDMDialog({ open, onClose, onCreated, currentUser, allUsers, existingThreads }) {
  const [search, setSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const filtered = allUsers.filter(u =>
    u.email !== currentUser.email &&
    !selectedUsers.find(su => su.email === u.email) &&
    (u.full_name || u.email).toLowerCase().includes(search.toLowerCase())
  ).slice(0, 10);

  const handleStart = async () => {
    if (selectedUsers.length === 0) return;
    setLoading(true);

    const participantEmails = [currentUser.email, ...selectedUsers.map(u => u.email)].sort();

    // Check if thread already exists
    const existing = existingThreads.find(t => {
      const threadEmails = [...(t.participantEmails || [])].sort();
      return JSON.stringify(threadEmails) === JSON.stringify(participantEmails);
    });

    if (existing) {
      setLoading(false);
      setSelectedUsers([]);
      setSearch('');
      onCreated(existing);
      return;
    }

    const { data: threadData } = await supabase.from('DirectMessageThread').insert({
      participantEmails,
      participantNames: [
        currentUser.full_name || currentUser.email,
        ...selectedUsers.map(u => u.full_name || u.email)
      ],
    }).select().single();
    const thread = threadData;

    setLoading(false);
    setSelectedUsers([]);
    setSearch('');
    onCreated(thread);
  };

  const toggleUser = (user) => {
    setSelectedUsers(prev => [...prev, user]);
    setSearch('');
  };

  const removeUser = (email) => {
    setSelectedUsers(prev => prev.filter(u => u.email !== email));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Direct Message</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedUsers.map(u => (
                <div key={u.email} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  {u.full_name || u.email}
                  <button onClick={() => removeUser(u.email)} className="text-blue-500 hover:text-blue-900">&times;</button>
                </div>
              ))}
            </div>
          )}
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email to add..."
            autoFocus
          />
          <div className="border rounded-lg max-h-60 overflow-y-auto">
            {filtered.map(user => (
              <button
                key={user.email}
                onClick={() => toggleUser(user)}
                className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center gap-2`}
              >
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                  {(user.full_name || user.email)[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium">{user.full_name || user.email}</div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleStart} disabled={selectedUsers.length === 0 || loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? 'Starting...' : 'Start Conversation'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}