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

const DEMO_USER = {
  email: 'pm.west@m2fleetcom.com',
  full_name: 'Casey Walker',
  role: 'pm'
};

export default function Messaging() {
  const [currentUser, setCurrentUser] = useState(DEMO_USER);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedDMThread, setSelectedDMThread] = useState(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showEditDM, setShowEditDM] = useState(false);
  const [activeTab, setActiveTab] = useState('messages');
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then((res) => {
      const user = res?.data?.user;
      if (user) {
        setCurrentUser({
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email,
          role: user.user_metadata?.role || 'pm'
        });
      }
    });
  }, []);

  const { data: channels = [] } = useQuery({
    queryKey: ['channels'],
    queryFn: async () => (await supabase.from('Channel').select('*')).data || [],
    enabled: !!currentUser,
  });

  const { data: channelMembers = [] } = useQuery({
    queryKey: ['channelMembers'],
    queryFn: async () => (await supabase.from('ChannelMember').select('*')).data || [],
    enabled: !!currentUser,
  });

  const { data: directMessages = [] } = useQuery({
    queryKey: ['directMessages'],
    queryFn: async () => (await supabase.from('DirectMessageThread').select('*')).data || [],
    enabled: !!currentUser,
  });

  const { data: messages = [] } = useQuery({
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
        return response.data?.messages || [];
      } catch (e) {
        console.error('Failed to fetch messages securely', e);
        return [];
      }
    },
    enabled: !!(selectedChannel || selectedDMThread),
    refetchInterval: false,
  });

  const myMemberships = channelMembers.filter(m => m.userEmail === currentUser?.email);
  const myChannelIds = new Set(myMemberships.map(m => m.channelId));

  const visibleChannels = channels.filter(ch => {
    if (ch.type === 'public') return true;
    return myChannelIds.has(ch.id);
  });

  const myDMThreads = directMessages.filter(t =>
    t.participantEmails?.includes(currentUser?.email)
  );

  useEffect(() => {
    if (!currentUser) return;
    if (selectedChannel && selectedChannel.type !== 'public' && !myChannelIds.has(selectedChannel.id)) {
      setSelectedChannel(null);
    }
    if (selectedDMThread && !myDMThreads.find(t => t.id === selectedDMThread.id)) {
      setSelectedDMThread(null);
    }
  }, [selectedChannel, selectedDMThread, currentUser, myDMThreads, myChannelIds]);

  useEffect(() => {
    const seedDefaultChannels = async () => {
      const existing = (await supabase.from('Channel').select('*')).data || [];
      if (existing.length === 0 && currentUser) {
        const defaults = [
          { name: 'general', description: 'General team discussion', type: 'public' },
          { name: 'operations', description: 'Operations updates', type: 'public' },
          { name: 'install-team', description: 'Install team coordination', type: 'public' },
        ];
        for (const ch of defaults) {
          await supabase.from('Channel').insert({
            ...ch,
            createdByEmail: currentUser.email,
            isArchived: false,
          });
        }
        queryClient.invalidateQueries({ queryKey: ['channels'] });
      }
    };
    if (currentUser && channels.length === 0) {
      seedDefaultChannels();
    }
  }, [currentUser, channels.length, queryClient]);

  useEffect(() => {
    if (visibleChannels.length > 0 && !selectedChannel && !selectedDMThread) {
      setSelectedChannel(visibleChannels[0]);
    }
  }, [visibleChannels, selectedChannel, selectedDMThread]);

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
    queryClient.invalidateQueries({ queryKey: ['directMessages'] });
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
    await supabase.from('ChatMessage').insert(msgData);
    queryClient.invalidateQueries({ queryKey: ['messages'] });
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex bg-white rounded-xl border overflow-hidden">
      <ChannelSidebar
        currentUser={currentUser}
        channels={visibleChannels}
        dmThreads={myDMThreads}
        selectedChannel={selectedChannel}
        selectedDMThread={selectedDMThread}
        onSelectChannel={handleSelectChannel}
        onSelectDM={handleSelectDM}
        onCreateChannel={() => setShowCreateChannel(true)}
        onNewDM={() => setShowNewDM(true)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {selectedChannel || selectedDMThread ? (
          <>
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  {selectedChannel ? `# ${selectedChannel.name}` : selectedDMThread?.participantNames?.filter(n => n !== currentUser?.full_name)[0] || 'Direct Message'}
                </h1>
                <p className="text-sm text-gray-500">
                  {selectedChannel?.description || 'Secure team messaging'}
                </p>
              </div>
              {selectedChannel ? (
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'messages' ? 'tasks' : 'messages')}
                  className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  <Users className="h-4 w-4" />
                  {activeTab === 'messages' ? 'Channel Tasks' : 'Messages'}
                </button>
              ) : null}
            </div>

            <div className="flex-1 min-h-0">
              {activeTab === 'tasks' && selectedChannel ? (
                <ChannelTasksPanel channel={selectedChannel} currentUser={currentUser} />
              ) : (
                <>
                  <MessageList messages={messages} currentUser={currentUser} />
                  <MessageInput onSendMessage={handleSendMessage} />
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a channel or direct message to begin.
          </div>
        )}
      </div>

      <CreateChannelDialog
        open={showCreateChannel}
        onOpenChange={setShowCreateChannel}
        currentUser={currentUser}
        onCreated={handleChannelCreated}
      />
      <NewDMDialog
        open={showNewDM}
        onOpenChange={setShowNewDM}
        currentUser={currentUser}
        onCreated={handleDMCreated}
      />
      <EditDMDialog
        open={showEditDM}
        onOpenChange={setShowEditDM}
        thread={selectedDMThread}
        currentUser={currentUser}
        onUpdated={() => queryClient.invalidateQueries({ queryKey: ['directMessages'] })}
      />
    </div>
  );
}