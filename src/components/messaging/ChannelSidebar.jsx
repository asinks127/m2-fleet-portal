import React from 'react';
import { Hash, Lock, Plus, MessageSquare, User } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';

export default function ChannelSidebar({ channels, dmThreads, currentUser, selectedChannelId, selectedDMThreadId, onSelectChannel, onSelectDM, onCreateChannel, onNewDM, isAdmin }) {
  
  const getDMName = (thread) => {
    if (!thread.participantNames) return 'Unknown';
    return thread.participantNames.filter(n => n !== (currentUser.full_name || currentUser.email)).join(', ') || 'You';
  };

  return (
    <div className="w-64 bg-gray-900 text-gray-300 flex flex-col h-full flex-shrink-0">
      <div className="p-4 border-b border-gray-700">
        <h2 className="font-bold text-white text-lg">Team Messages</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {/* Channels */}
        <div className="mt-4">
          <div className="flex items-center justify-between px-4 mb-1">
            <span className="text-xs font-semibold uppercase text-gray-400 tracking-wider">Channels</span>
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={onCreateChannel} className="h-5 w-5 p-0 text-gray-400 hover:text-white">
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </div>
          {channels.map(channel => (
            <button
              key={channel.id}
              onClick={() => onSelectChannel(channel)}
              className={`w-full text-left px-4 py-1.5 text-sm flex items-center gap-2 rounded mx-1 hover:bg-gray-700 transition-colors ${
                selectedChannelId === channel.id ? 'bg-blue-600 text-white' : ''
              }`}
            >
              {channel.type === 'private' ? <Lock className="w-3.5 h-3.5 flex-shrink-0" /> : <Hash className="w-3.5 h-3.5 flex-shrink-0" />}
              <span className="truncate">{channel.name}</span>
            </button>
          ))}
        </div>

        {/* Direct Messages */}
        <div className="mt-6">
          <div className="flex items-center justify-between px-4 mb-1">
            <span className="text-xs font-semibold uppercase text-gray-400 tracking-wider">Direct Messages</span>
            <Button variant="ghost" size="sm" onClick={onNewDM} className="h-5 w-5 p-0 text-gray-400 hover:text-white">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {dmThreads.map(thread => (
            <button
              key={thread.id}
              onClick={() => onSelectDM(thread)}
              className={`w-full text-left px-4 py-1.5 text-sm flex items-center gap-2 rounded mx-1 hover:bg-gray-700 transition-colors ${
                selectedDMThreadId === thread.id ? 'bg-blue-600 text-white' : ''
              }`}
            >
              <User className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{getDMName(thread)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 border-t border-gray-700 text-xs text-gray-500">
        <div className="font-medium text-gray-300">{currentUser.full_name || currentUser.email}</div>
        <div className="truncate">{currentUser.email}</div>
      </div>
    </div>
  );
}