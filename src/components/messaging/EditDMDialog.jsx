import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { supabase } from '@/lib/supabaseClient.js';
import { useQueryClient } from '@tanstack/react-query';

export default function EditDMDialog({ open, onClose, thread, currentUser, allUsers }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState([]);

  // Initialize participants from thread when dialog opens
  React.useEffect(() => {
    if (open && thread) {
      const currentParticipants = thread.participantEmails.map((email, idx) => ({
        email,
        name: thread.participantNames[idx] || email
      }));
      setParticipants(currentParticipants);
    }
  }, [open, thread]);

  const filtered = allUsers.filter(u =>
    u.email !== currentUser.email &&
    !participants.find(p => p.email === u.email) &&
    (u.full_name || u.email).toLowerCase().includes(search.toLowerCase())
  ).slice(0, 10);

  const handleSave = async () => {
    if (participants.length <= 1) return; // Must have at least self + 1 other
    setLoading(true);

    const participantEmails = participants.map(p => p.email);
    const participantNames = participants.map(p => p.name);

    await (await supabase.from('DirectMessageThread').update({
      participantEmails,
      participantNames
    }).eq('id', thread.id)).data;

    queryClient.invalidateQueries({ queryKey: ['dmThreads'] });
    setLoading(false);
    onClose();
  };

  const toggleUser = (user) => {
    setParticipants(prev => [...prev, { email: user.email, name: user.full_name || user.email }]);
    setSearch('');
  };

  const removeUser = (email) => {
    if (email === currentUser.email) return; // Prevent removing self
    setParticipants(prev => prev.filter(u => u.email !== email));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Conversation Members</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Current Members</h4>
            <div className="flex flex-wrap gap-2">
              {participants.map(p => (
                <div key={p.email} className={`text-xs px-2.5 py-1.5 rounded-full flex items-center gap-1.5 ${p.email === currentUser.email ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-800'}`}>
                  {p.name}
                  {p.email !== currentUser.email && (
                    <button onClick={() => removeUser(p.email)} className="text-blue-500 hover:text-blue-900 focus:outline-none">&times;</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Add Members</h4>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email to add..."
            />
            {search && filtered.length > 0 && (
              <div className="border rounded-lg max-h-40 overflow-y-auto mt-2">
                {filtered.map(user => (
                  <button
                    key={user.email}
                    onClick={() => toggleUser(user)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                      {(user.full_name || user.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{user.full_name || user.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {search && filtered.length === 0 && (
              <div className="text-sm text-gray-500 text-center py-4">No users found</div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={participants.length <= 1 || loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}