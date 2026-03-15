import React, { useState, useEffect } from 'react';
import { getMessages } from '@/functions.js';
import { supabase } from '@/lib/supabaseClient.js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ChannelSidebar from '@/components/messaging/ChannelSidebar';
import MessageList from '@/components/messaging/MessageList';
import MessageInput from '@/components/messaging/MessageInput';
import CreateChannelDialog from '@/components/messaging/CreateChannelDialog';
import NewDMDialog from '@/components/messaging/NewDMDialog';
import EditDMDialog from '@/components/messaging/EditDMDialog';
import ChannelTasksPanel from '@/components/messaging/ChannelTasksPanel';
import { Users } from 'lucide-react';

export default function Messaging() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedDMThread, setSelectedDMThread] = useState(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showEditDM, setShowEditDM] = useState(false);
  const [activeTab, setActiveTab] = useState('messages'); // 'messages' or 'tasks'
  const queryClient = useQueryClient();

  useEffect(() => {
    (supabase.auth.getUser().then(res => res.data.user)).then(setCurrentUser);
  }, []);

  // Queries
  const { data: channels = [] } = useQuery({
    queryKey: ['channels'],
    queryFn: async () => (await supabase.from('Channel').select('*') /* TODO: restore sorting/limit '-created_date', 100 */).data,
    enabled: !!currentUser,
  });

  const { data: channelMembers = [] } = useQuery({
    queryKey: ['channelMembers'],
    queryFn: async () => (await supabase.from('ChannelMember').select('*') /* TODO: restore sorting/limit '', 1000 */).data,
    enabled: !!currentUser,
  });

  const { data: directMessages = [] } = useQuery({
    queryKey: ['directMessages'],
    queryFn: async () => (await supabase.from('DirectMessageThread').select('*') /* TODO: restore sorting/limit '-lastActivityAt', 50 */).data,
    enabled: !!currentUser,
  });

  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ['messages', selectedChannel?.id, selectedDMThread?.id],
    queryFn: async () => {
      let payload = {};
      if (selectedChannel) {
        payload = { channelId: selectedChannel.id };
      } else if (selectedDMThread) {
        payload = { dmThreadId: selectedDMThread.id };
      } else {
        return [];
      }
      try {
        const response = await getMessages(payload);
        return response.data.messages || [];
      } catch (e) {
        console.error("Failed to fetch messages securely", e);
        return [];
      }
    },
    enabled: !!(selectedChannel || selectedDMThread),
    refetchInterval: false,
  });

  // Filter channels/DMs for current user
  const myMemberships = channelMembers.filter(m => m.userEmail === currentUser?.email);
  const myChannelIds = new Set(myMemberships.map(m => m.channelId));
  const isAdmin = currentUser?.role === 'admin';

  const visibleChannels = channels.filter(ch => {
    if (ch.type === 'public') return true;
    return myChannelIds.has(ch.id);
  });

  const myDMThreads = dmThreads.filter(t =>
    t.participantEmails?.includes(currentUser?.email)
  );

  // Ensure selection is valid
  useEffect(() => {
    if (!currentUser) return;
    if (selectedChannel && selectedChannel.type !== 'public') {
      if (!myChannelIds.has(selectedChannel.id)) {
        setSelectedChannel(null);
      }
    }
    if (selectedDMThread) {
      if (!myDMThreads.find(t => t.id === selectedDMThread.id)) {
        setSelectedDMThread(null);
      }
    }
  }, [channelMembers, dmThreads, selectedChannel, selectedDMThread, currentUser, myChannelIds, myDMThreads]);

  // Seed default channels if none exist
  useEffect(() => {
    const seedDefaultChannels = async () => {
      const existing = await (await supabase.from('Channel').select('*')).data;
      if (existing.length === 0 && currentUser) {
        const defaults = [
          { name: 'general', description: 'General team discussion', type: 'public' },
          { name: 'operations', description: 'Operations updates', type: 'public' },
          { name: 'install-team', description: 'Install team coordination', type: 'public' },
        ];
        for (const ch of defaults) {
          await (await supabase.from('Channel').insert({
            ...ch,
            createdByEmail: currentUser.email,
            isArchived: false,
          })).data;
        }
        queryClient.invalidateQueries({ queryKey: ['channels'] });
      }
    };
    if (currentUser && channels.length === 0) {
      seedDefaultChannels();
    }
  }, [currentUser, channels.length, queryClient]);

  // Real-time subscription
  useEffect(() => {
    const unsubscribe = /* FIXME: Unconverted base44 call */ supabase.entities.ChatMessage.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    });
    return unsubscribe;
  }, [queryClient]);

  // Select first channel on load
  useEffect(() => {
    if (visibleChannels.length > 0 && !selectedChannel && !selectedDMThread) {
      setSelectedChannel(visibleChannels[0]);
    }
  }, [visibleChannels.length, selectedChannel, selectedDMThread]);

  const handleSelectChannel = (channel) => {
    setSelectedChannel(channel);
    setSelectedDMThread(null);
    setActiveTab('messages');
  };

  const handleSelectDM = (thread) => {
    setSelectedDMThread(thread);
    setSelectedChannel(null);
    setActiveTab('messages');
  };

  const handleChannelCreated = (channel) => {
    queryClient.invalidateQueries({ queryKey: ['channels'] });
    queryClient.invalidateQueries({ queryKey: ['channelMembers'] });
    setSelectedChannel(channel);
    setShowCreateChannel(false);
  };

  const handleDMCreated = (thread) => {
    queryClient.invalidateQueries({ queryKey: ['dmThreads'] });
    setSelectedDMThread(thread);
    setSelectedChannel(null);
    setShowNewDM(false);
  };

  const handleSendMessage = async ({ content, attachmentUrl, attachmentName }) => {
    if (!currentUser) return;
    const msgData = {
      senderEmail: currentUser.email,
      senderName: currentUser.full_name || currentUser.email,
      content,
      attachmentUrl: attachmentUrl || null,
      attachmentName: attachmentName || null,
      reactions: [],
      edited: false,
      deleted: false,
    };
    if (selectedChannel) msgData.channelId = selectedChannel.id;
    if (selectedDMThread) msgData.dmThreadId = selectedDMThread.id;
    await (await supabase.from('ChatMessage').insert(msgData)).data;
    queryClient.invalidateQueries({ queryKey: ['messages'] });
  };

  const handleReact = async (message, emoji) => {
    const reactions = message.reactions || [];
    const existing = reactions.findIndex(r => r.emoji === emoji && r.userEmail === currentUser.email);
    let newReactions;
    if (existing >= 0) {
      newReactions = reactions.filter((_, i) => i !== existing);
    } else {
      newReactions = [...reactions, { emoji, userEmail: currentUser.email }];
    }
    await (await supabase.from('ChatMessage').update({ reactions: newReactions }).eq('id', message.id)).data;
    queryClient.invalidateQueries({ queryKey: ['messages'] });
  };

  const handleEditMessage = async (message, newContent) => {
    await (await supabase.from('ChatMessage').update({ content: newContent, edited: true }).eq('id', message.id)).data;
    queryClient.invalidateQueries({ queryKey: ['messages'] });
  };

  const handleDeleteMessage = async (message) => {
    await (await supabase.from('ChatMessage').update({ deleted: true, content: '[Message deleted]' }).eq('id', message.id)).data;
    queryClient.invalidateQueries({ queryKey: ['messages'] });
  };

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsersForMessaging'],
    queryFn: async () => (await supabase.from('User').select('*') /* TODO: restore sorting/limit '', 1000 */).data,
    enabled: !!currentUser,
  });

  if (!currentUser) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  const currentTitle = selectedChannel 
    ? `#${selectedChannel.name}`
    : selectedDMThread
    ? selectedDMThread.participantNames?.filter(n => n !== (currentUser.full_name || currentUser.email)).join(', ') || 'Empty Conversation'
    : 'Select a conversation';

  return (
    <div className="flex h-[calc(100vh-65px)] bg-white overflow-hidden">
      <ChannelSidebar
        channels={visibleChannels}
        dmThreads={myDMThreads}
        currentUser={currentUser}
        selectedChannelId={selectedChannel?.id}
        selectedDMThreadId={selectedDMThread?.id}
        onSelectChannel={handleSelectChannel}
        onSelectDM={handleSelectDM}
        onCreateChannel={() => setShowCreateChannel(true)}
        onNewDM={() => setShowNewDM(true)}
        isAdmin={isAdmin}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedChannel || selectedDMThread ? (
          <>
            <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{currentTitle}</span>
                {selectedChannel?.description && (
                  <span className="text-sm text-gray-500 ml-2 border-l pl-2">{selectedChannel.description}</span>
                )}
                {selectedDMThread && (
                  <button 
                    onClick={() => setShowEditDM(true)}
                    className="ml-2 text-gray-400 hover:text-blue-600 focus:outline-none p-1 rounded-md hover:bg-gray-100"
                    title="Manage Members"
                  >
                    <Users className="w-4 h-4" />
                  </button>
                )}
              </div>
              {(selectedChannel || selectedDMThread) && (
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button 
                    onClick={() => setActiveTab('messages')}
                    className={`px-3 py-1 text-sm font-medium rounded-md ${activeTab === 'messages' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Messages
                  </button>
                  <button 
                    onClick={() => setActiveTab('tasks')}
                    className={`px-3 py-1 text-sm font-medium rounded-md ${activeTab === 'tasks' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Tasks
                  </button>
                </div>
              )}
            </div>
            
            {activeTab === 'messages' || (!selectedChannel && !selectedDMThread) ? (
              <>
                <MessageList
                  messages={messages.filter(m => !m.deleted)}
                  currentUser={currentUser}
                  onReact={handleReact}
                  onEdit={handleEditMessage}
                  onDelete={handleDeleteMessage}
                  isAdmin={isAdmin}
                />
                <MessageInput
                  onSend={handleSendMessage}
                  users={allUsers}
                  placeholder={`Message ${currentTitle}`}
                />
              </>
            ) : (
              <ChannelTasksPanel 
                channel={selectedChannel} 
                dmThread={selectedDMThread}
                currentUser={currentUser} 
                allUsers={allUsers} 
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-xl font-semibold mb-2">Welcome to Team Messaging</p>
              <p className="text-sm">Select a channel or direct message to start chatting</p>
            </div>
          </div>
        )}
      </div>

      <CreateChannelDialog
        open={showCreateChannel}
        onClose={() => setShowCreateChannel(false)}
        onCreated={handleChannelCreated}
        currentUser={currentUser}
        allUsers={allUsers}
      />

      <NewDMDialog
        open={showNewDM}
        onClose={() => setShowNewDM(false)}
        onCreated={handleDMCreated}
        currentUser={currentUser}
        allUsers={allUsers}
        existingThreads={myDMThreads}
      />

      <EditDMDialog
        open={showEditDM}
        onClose={() => setShowEditDM(false)}
        thread={selectedDMThread}
        currentUser={currentUser}
        allUsers={allUsers}
      />
    </div>
  );
}