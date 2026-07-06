import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { supabase } from '@/lib/supabaseClient.js';

export default function CreateChannelDialog({ open, onClose, onCreated, currentUser, allUsers }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('public');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    
    const { data: channelData, error } = await supabase.from('Channel').insert({
      name: name.toLowerCase().replace(/\s+/g, '-'),
      description,
      type,
      createdByEmail: currentUser.email,
      isArchived: false,
    }).select().single(); // Use .select().single() to return the inserted row

    if (error) {
      console.error('Error creating channel:', error);
      setLoading(false);
      return;
    }

    const channel = channelData;

    // Add creator as admin member
    const { error: memberError1 } = await supabase.from('ChannelMember').insert({
      channelId: channel.id,
      userEmail: currentUser.email,
      userName: currentUser.full_name || currentUser.email,
      role: 'admin',
    });

    // Add selected members
    for (const user of selectedMembers) {
      await supabase.from('ChannelMember').insert({
        channelId: channel.id,
        userEmail: user.email,
        userName: user.full_name || user.email,
        role: 'member',
      });
    }

    setLoading(false);
    setName('');
    setDescription('');
    setType('public');
    setSelectedMembers([]);
    onCreated(channel);
  };

  const toggleMember = (user) => {
    setSelectedMembers(prev =>
      prev.find(m => m.email === user.email)
        ? prev.filter(m => m.email !== user.email)
        : [...prev, user]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create a Channel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Channel Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. general, install-team"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this channel about?"
            />
          </div>
          <div>
            <Label>Type</Label>
            <div className="flex gap-3 mt-1">
              {['public', 'private'].map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={type === t} onChange={() => setType(t)} />
                  <span className="capitalize text-sm">{t}</span>
                </label>
              ))}
            </div>
          </div>
          {type === 'private' && (
            <div>
              <Label>Invite Members</Label>
              <div className="border rounded-lg max-h-40 overflow-y-auto mt-1">
                {allUsers.filter(u => u.email !== currentUser.email).map(user => (
                  <label key={user.email} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedMembers.some(m => m.email === user.email)}
                      onChange={() => toggleMember(user)}
                    />
                    <span className="text-sm">{user.full_name || user.email}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!name.trim() || loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? 'Creating...' : 'Create Channel'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}