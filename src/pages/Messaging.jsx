import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { format } from 'date-fns';
import {
  Hash,
  Lock,
  Plus,
  MessageSquare,
  User,
  Users,
  Search,
  X,
  Send,
  Smile,
  Trash2,
  CheckCircle2,
  Bell,
} from 'lucide-react';

const ADMIN_EMAILS = [
  'austin@m2fleetcom.com',
  'adam@m2fleetcom.com',
  'lena@m2fleetcom.com',
  'orville@m2fleetcom.com',
  'steve@m2fleetcom.com',
  'jason@m2fleetcom.com',
  'erica@m2fleetcom.com',
  'lowell@m2fleetcom.com',
  'secretary@m2fleetcom.com',
  'tjserota@gmail.com',
];

const COMMON_EMOJIS = ['👍', '❤️', '😂', '🔥', '✅', '👀'];

function displayName(user) {
  return user?.full_name || user?.display_name || user?.email || 'User';
}

function initials(name) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function avatarClass(email = '') {
  const colors = ['bg-blue-600', 'bg-purple-600', 'bg-green-600', 'bg-amber-600', 'bg-red-600', 'bg-pink-600'];
  const idx = Math.abs(email.toLowerCase().charCodeAt(0) || 0) % colors.length;
  return colors[idx];
}

function safeParse(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? <div className="border-t px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

export default function Messaging() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [users, setUsers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [members, setMembers] = useState([]);
  const [dmThreads, setDmThreads] = useState([]);
  const [messages, setMessages] = useState([]);

  const [selectedChannelId, setSelectedChannelId] = useState(null);
  const [selectedDmId, setSelectedDmId] = useState(null);
  const [compose, setCompose] = useState('');
  const [composeError, setComposeError] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionOptions, setMentionOptions] = useState([]);

  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDescription, setNewChannelDescription] = useState('');
  const [dmSearch, setDmSearch] = useState('');
  const [dmPick, setDmPick] = useState(null);

  const seededRef = useRef(false);
  const mentionAnchorRef = useRef(null);

  const isAdmin = useMemo(() => {
    const email = currentUser?.email?.toLowerCase() || '';
    return Boolean(currentUser?.user_metadata?.role === 'admin' || ADMIN_EMAILS.includes(email));
  }, [currentUser]);

  const myChannelIds = useMemo(() => {
    const email = currentUser?.email?.toLowerCase();
    return new Set(
      members.filter((m) => m.userEmail?.toLowerCase() === email).map((m) => m.channelId)
    );
  }, [members, currentUser]);

  const visibleChannels = useMemo(() => {
    return channels
      .filter((channel) => channel.isArchived !== true)
      .filter((channel) => channel.type === 'public' || isAdmin || myChannelIds.has(channel.id))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [channels, isAdmin, myChannelIds]);

  const visibleDmThreads = useMemo(() => {
    const email = currentUser?.email?.toLowerCase();
    return dmThreads.filter((thread) => {
      const participants = thread.participantEmails || safeParse(thread.participants, []);
      return Array.isArray(participants) && participants.some((p) => String(p).toLowerCase() === email);
    });
  }, [dmThreads, currentUser]);

  const selectedChannel = useMemo(
    () => channels.find((c) => c.id === selectedChannelId) || null,
    [channels, selectedChannelId]
  );
  const selectedDm = useMemo(
    () => dmThreads.find((d) => d.id === selectedDmId) || null,
    [dmThreads, selectedDmId]
  );

  const selectedMessages = useMemo(() => {
    return [...messages].sort((a, b) => new Date(a.created_at || a.created_date || 0) - new Date(b.created_at || b.created_date || 0));
  }, [messages]);

  const currentConversationLabel = selectedChannel
    ? `# ${selectedChannel.name}`
    : selectedDm
      ? (selectedDm.participantNames || []).filter((name) => name !== displayName(currentUser))[0] || 'Direct Message'
      : 'Team Messaging';

  const loadCurrentUser = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const authUser = data?.user;
    if (!authUser) return null;
    return {
      id: authUser.id,
      email: authUser.email,
      full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email,
      display_name: authUser.user_metadata?.display_name || authUser.user_metadata?.full_name || authUser.email,
      user_metadata: authUser.user_metadata || {},
    };
  };

  const loadCoreData = async () => {
    const [usersRes, channelsRes, membersRes, threadsRes] = await Promise.all([
      supabase.from('User').select('id,email,full_name,display_name,active').order('full_name', { ascending: true }),
      supabase.from('Channel').select('*').order('name', { ascending: true }),
      supabase.from('ChannelMember').select('*'),
      supabase.from('DirectMessageThread').select('*').order('created_at', { ascending: false }),
    ]);

    if (usersRes.error) throw usersRes.error;
    if (channelsRes.error) throw channelsRes.error;
    if (membersRes.error) throw membersRes.error;
    if (threadsRes.error) throw threadsRes.error;

    setUsers(usersRes.data || []);
    setChannels(channelsRes.data || []);
    setMembers(membersRes.data || []);
    setDmThreads(threadsRes.data || []);

    return {
      channels: channelsRes.data || [],
      members: membersRes.data || [],
      threads: threadsRes.data || [],
    };
  };

  const loadMessages = async (channelId = selectedChannelId, dmId = selectedDmId) => {
    if (!channelId && !dmId) {
      setMessages([]);
      return;
    }
    let query = supabase.from('ChatMessage').select('*').order('created_at', { ascending: true });
    if (channelId) query = query.eq('channelId', channelId);
    if (dmId) query = query.eq('dmThreadId', dmId);
    const { data, error } = await query;
    if (error) throw error;
    setMessages(data || []);
  };

  const seedDefaultChannels = async (user) => {
    if (seededRef.current) return;
    seededRef.current = true;
    const defaults = [
      { name: 'general', description: 'General team discussion', type: 'public' },
      { name: 'operations', description: 'Operations updates', type: 'public' },
      { name: 'install-team', description: 'Install team coordination', type: 'public' },
    ];
    for (const channel of defaults) {
      const { data, error } = await supabase
        .from('Channel')
        .insert({
          name: channel.name,
          description: channel.description,
          type: channel.type,
          createdByEmail: user.email,
          isArchived: false,
        })
        .select()
        .single();
      if (error) throw error;
      if (data?.id) {
        await supabase.from('ChannelMember').insert({
          channelId: data.id,
          userEmail: user.email,
          userName: displayName(user),
          role: 'admin',
        });
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setLoading(true);
      setPageError('');
      try {
        const user = await loadCurrentUser();
        if (cancelled) return;
        setCurrentUser(user);
        if (!user) {
          setLoading(false);
          return;
        }
        const core = await loadCoreData();
        if (cancelled) return;

        if (isAdmin && core.channels.length === 0) {
          await seedDefaultChannels(user);
          const refreshed = await loadCoreData();
          if (cancelled) return;
          const first = refreshed.channels.find((c) => c.type === 'public') || refreshed.channels[0] || null;
          setSelectedChannelId(first?.id || null);
          setSelectedDmId(null);
          if (first?.id) await loadMessages(first.id, null);
        } else {
          const firstVisible = core.channels.find((c) => c.type === 'public' || isAdmin || core.members.some((m) => m.channelId === c.id && m.userEmail?.toLowerCase() === user.email?.toLowerCase())) || null;
          if (firstVisible?.id) {
            setSelectedChannelId(firstVisible.id);
            setSelectedDmId(null);
            await loadMessages(firstVisible.id, null);
          }
        }
      } catch (err) {
        if (!cancelled) setPageError(err?.message || 'Failed to load messaging');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (!currentUser) return;
      try {
        await loadMessages();
      } catch (err) {
        if (!cancelled) setComposeError(err?.message || 'Failed to load messages');
      }
    };
    refresh();
    const timer = setInterval(refresh, 3500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [currentUser, selectedChannelId, selectedDmId]);

  useEffect(() => {
    if (!currentUser) return;
    if (!selectedChannelId && !selectedDmId && visibleChannels.length > 0) {
      setSelectedChannelId(visibleChannels[0].id);
    }
  }, [currentUser, visibleChannels, selectedChannelId, selectedDmId]);

  const handleSelectChannel = (channelId) => {
    setSelectedChannelId(channelId);
    setSelectedDmId(null);
    setCompose('');
    setComposeError('');
  };

  const handleSelectDm = (threadId) => {
    setSelectedDmId(threadId);
    setSelectedChannelId(null);
    setCompose('');
    setComposeError('');
  };

  const ensureAdmin = () => {
    if (!isAdmin) {
      setComposeError('Admins only.');
      return false;
    }
    return true;
  };

  const handleCreateChannel = async () => {
    if (!ensureAdmin()) return;
    const name = slugify(newChannelName);
    if (!name) return;
    const { data, error } = await supabase.from('Channel').insert({
      name,
      description: newChannelDescription,
      type: 'public',
      createdByEmail: currentUser.email,
      isArchived: false,
    }).select().single();
    if (error) throw error;
    await supabase.from('ChannelMember').insert({
      channelId: data.id,
      userEmail: currentUser.email,
      userName: displayName(currentUser),
      role: 'admin',
    });
    setShowNewChannel(false);
    setNewChannelName('');
    setNewChannelDescription('');
    await loadCoreData();
    handleSelectChannel(data.id);
  };

  const handleCreateDm = async () => {
    if (!ensureAdmin()) return;
    if (!dmPick) return;
    const participantEmails = [currentUser.email, dmPick.email].map((v) => v.toLowerCase()).sort();
    const participantNames = [displayName(currentUser), displayName(dmPick)].sort();
    const existing = dmThreads.find((thread) => {
      const emails = (thread.participantEmails || []).map((v) => String(v).toLowerCase()).sort();
      return JSON.stringify(emails) === JSON.stringify(participantEmails);
    });
    if (existing) {
      setShowNewDm(false);
      setDmSearch('');
      setDmPick(null);
      handleSelectDm(existing.id);
      return;
    }
    const { data, error } = await supabase.from('DirectMessageThread').insert({
      participantEmails,
      participantNames,
    }).select().single();
    if (error) throw error;
    setShowNewDm(false);
    setDmSearch('');
    setDmPick(null);
    await loadCoreData();
    handleSelectDm(data.id);
  };

  const currentUsersForMentions = useMemo(() => {
    const q = mentionQuery.toLowerCase();
    return users
      .filter((u) => u.active !== false)
      .filter((u) => (u.email || '').toLowerCase() !== (currentUser?.email || '').toLowerCase())
      .filter((u) => displayName(u).toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
      .slice(0, 6);
  }, [users, currentUser, mentionQuery]);

  useEffect(() => {
    setMentionOptions(currentUsersForMentions);
  }, [currentUsersForMentions]);

  const handleComposeChange = (value) => {
    setCompose(value);
    const tokens = value.split(/\s+/);
    const lastToken = tokens[tokens.length - 1] || '';
    if (lastToken.startsWith('@') && lastToken.length > 1) {
      setMentionQuery(lastToken.slice(1));
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
      setMentionQuery('');
    }
  };

  const insertMention = (user) => {
    const mention = `@${displayName(user)}`;
    const parts = compose.split(/\s+/);
    parts[parts.length - 1] = mention;
    setCompose(parts.join(' ') + ' ');
    setMentionOpen(false);
    setMentionQuery('');
    mentionAnchorRef.current?.focus();
  };

  const handleSendMessage = async () => {
    if (!currentUser) return;
    if (!compose.trim()) return;
    if (!selectedChannelId && !selectedDmId) return;

    const payload = {
      senderEmail: currentUser.email,
      senderName: displayName(currentUser),
      content: compose.trim(),
      reactions: JSON.stringify([]),
      edited: false,
      deleted: false,
    };
    if (selectedChannelId) payload.channelId = selectedChannelId;
    if (selectedDmId) payload.dmThreadId = selectedDmId;

    const { error } = await supabase.from('ChatMessage').insert(payload);
    if (error) throw error;
    setCompose('');
    setMentionOpen(false);
    await loadMessages();
  };

  const toggleReaction = async (message, emoji) => {
    const existing = safeParse(message.reactions, []);
    const reactions = Array.isArray(existing) ? existing : [];
    const currentIndex = reactions.findIndex((r) => r.emoji === emoji && String(r.userEmail).toLowerCase() === String(currentUser?.email).toLowerCase());
    let next;
    if (currentIndex >= 0) {
      next = reactions.filter((_, idx) => idx !== currentIndex);
    } else {
      next = [...reactions, { emoji, userEmail: currentUser.email, userName: displayName(currentUser) }];
    }
    const { error } = await supabase.from('ChatMessage').update({ reactions: JSON.stringify(next) }).eq('id', message.id);
    if (error) throw error;
    await loadMessages();
  };

  const deleteChannel = async (channelId) => {
    if (!isAdmin) return;
    if (!window.confirm('Delete this channel?')) return;
    await supabase.from('Channel').delete().eq('id', channelId);
    if (selectedChannelId === channelId) setSelectedChannelId(null);
    await loadCoreData();
  };

  const filteredDmUsers = useMemo(() => {
    const q = dmSearch.toLowerCase();
    return users
      .filter((u) => u.active !== false)
      .filter((u) => (u.email || '').toLowerCase() !== (currentUser?.email || '').toLowerCase())
      .filter((u) => displayName(u).toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
      .slice(0, 12);
  }, [users, dmSearch, currentUser]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-6rem)] items-center justify-center rounded-xl border bg-white">
        <div className="flex items-center gap-3 text-gray-600">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          Loading team messaging...
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="flex h-[calc(100vh-6rem)] items-center justify-center rounded-xl border bg-white p-8 text-center">
        <div>
          <Bell className="mx-auto mb-3 h-10 w-10 text-red-500" />
          <h2 className="text-xl font-semibold text-gray-900">Messaging failed to load</h2>
          <p className="mt-2 text-sm text-gray-600">{pageError}</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-[calc(100vh-6rem)] items-center justify-center rounded-xl border bg-white p-8 text-center">
        <div>
          <Users className="mx-auto mb-3 h-10 w-10 text-gray-500" />
          <h2 className="text-xl font-semibold text-gray-900">Admins only</h2>
          <p className="mt-2 text-sm text-gray-600">This Slack-style team messaging area is limited to admins.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] overflow-hidden rounded-xl border bg-white">
      <aside className="flex w-72 flex-shrink-0 flex-col border-r bg-slate-950 text-slate-200">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Team Messaging</div>
            <div className="mt-1 text-lg font-bold text-white">Slack-style admin chat</div>
          </div>
          <MessageSquare className="h-5 w-5 text-slate-400" />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span>Channels</span>
              <button
                onClick={() => setShowNewChannel(true)}
                className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                title="Create channel"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              {visibleChannels.map((channel) => {
                const active = selectedChannelId === channel.id;
                return (
                  <div key={channel.id} className="group flex items-center gap-1">
                    <button
                      onClick={() => handleSelectChannel(channel.id)}
                      className={`flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${active ? 'bg-blue-600 text-white' : 'hover:bg-white/10 hover:text-white'}`}
                    >
                      {channel.type === 'private' ? <Lock className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
                      <span className="truncate">{channel.name}</span>
                    </button>
                    <button
                      onClick={() => deleteChannel(channel.id)}
                      className="opacity-0 transition group-hover:opacity-100 rounded p-1 text-slate-500 hover:bg-white/10 hover:text-red-300"
                      title="Delete channel"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span>Direct Messages</span>
              <button
                onClick={() => setShowNewDm(true)}
                className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                title="Start DM"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              {visibleDmThreads.map((thread) => {
                const other = (thread.participantNames || []).filter((name) => name !== displayName(currentUser))[0] || 'Direct Message';
                const active = selectedDmId === thread.id;
                return (
                  <button
                    key={thread.id}
                    onClick={() => handleSelectDm(thread.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${active ? 'bg-blue-600 text-white' : 'hover:bg-white/10 hover:text-white'}`}
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span className="truncate">{other}</span>
                  </button>
                );
              })}
              {visibleDmThreads.length === 0 && (
                <div className="px-3 py-2 text-sm text-slate-500">No direct messages yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2 rounded-lg bg-white/5 p-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {initials(displayName(currentUser))}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">{displayName(currentUser)}</div>
              <div className="truncate text-xs text-slate-400">Admin</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <div className="text-lg font-semibold text-gray-900">{currentConversationLabel}</div>
            <div className="text-sm text-gray-500">
              {selectedChannel ? selectedChannel.description || 'Public channel' : 'Private 1:1 direct message'}
            </div>
          </div>
          {selectedChannel ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Users className="h-4 w-4" />
              {members.filter((m) => m.channelId === selectedChannel.id).length} members
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 px-5 py-5">
          {!selectedChannel && !selectedDm ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed bg-white p-8 text-center text-gray-500">
              Select a channel or start a DM.
            </div>
          ) : (
            <div className="mx-auto flex max-w-4xl flex-col gap-3">
              {selectedMessages.map((message) => {
                const reactions = safeParse(message.reactions, []);
                const groupedReactions = Array.isArray(reactions)
                  ? reactions.reduce((acc, reaction) => {
                      acc[reaction.emoji] = acc[reaction.emoji] || [];
                      acc[reaction.emoji].push(reaction);
                      return acc;
                    }, {})
                  : {};
                return (
                  <div key={message.id} className="group rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarClass(message.senderEmail)}`}>
                        {initials(message.senderName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <div className="font-semibold text-gray-900">{message.senderName}</div>
                          <div className="text-xs text-gray-400">
                            {format(new Date(message.created_at || message.created_date || Date.now()), 'MMM d, h:mm a')}
                          </div>
                        </div>
                        <div className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">
                          {message.content}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {Object.entries(groupedReactions).map(([emoji, items]) => (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(message, emoji)}
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition hover:bg-gray-50 ${items.some((item) => String(item.userEmail).toLowerCase() === String(currentUser?.email).toLowerCase()) ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}
                            >
                              <span>{emoji}</span>
                              <span className="text-gray-500">{items.length}</span>
                            </button>
                          ))}
                          {COMMON_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(message, emoji)}
                              className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs transition hover:bg-gray-50"
                              title={`React with ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t bg-white px-5 py-4">
          <div className="mx-auto max-w-4xl">
            {composeError ? (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{composeError}</div>
            ) : null}
            <div className="relative rounded-2xl border bg-gray-100 px-4 py-3 shadow-inner">
              {mentionOpen && mentionOptions.length > 0 ? (
                <div className="absolute bottom-full left-4 mb-2 w-80 rounded-xl border bg-white p-2 shadow-xl">
                  <div className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    <Search className="h-3.5 w-3.5" />
                    Mentions
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {mentionOptions.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => insertMention(user)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-gray-50"
                      >
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${avatarClass(user.email)}`}>
                          {initials(displayName(user))}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-gray-900">{displayName(user)}</div>
                          <div className="truncate text-xs text-gray-500">{user.email}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <textarea
                ref={mentionAnchorRef}
                value={compose}
                onChange={(e) => handleComposeChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage().catch((err) => setComposeError(err?.message || 'Failed to send message'));
                  }
                }}
                placeholder={selectedChannel ? `Message #${selectedChannel.name}` : 'Message this DM'}
                rows={2}
                className="min-h-[56px] w-full resize-none border-0 bg-transparent text-sm outline-none placeholder:text-gray-400"
              />
              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-gray-400">Type @ to mention someone. Enter sends, Shift+Enter makes a new line.</div>
                <button
                  onClick={() => handleSendMessage().catch((err) => setComposeError(err?.message || 'Failed to send message'))}
                  disabled={!compose.trim() || (!selectedChannelId && !selectedDmId)}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  <Send className="h-4 w-4" />
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Modal
        open={showNewChannel}
        title="Create Channel"
        onClose={() => setShowNewChannel(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setShowNewChannel(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
            <button
              onClick={() => handleCreateChannel().catch((err) => setComposeError(err?.message || 'Failed to create channel'))}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Create
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Channel name</label>
            <input
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="general, operations, install-team"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <input
              value={newChannelDescription}
              onChange={(e) => setNewChannelDescription(e.target.value)}
              placeholder="What is this channel for?"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={showNewDm}
        title="Start Direct Message"
        onClose={() => {
          setShowNewDm(false);
          setDmSearch('');
          setDmPick(null);
        }}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setShowNewDm(false);
                setDmSearch('');
                setDmPick(null);
              }}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => handleCreateDm().catch((err) => setComposeError(err?.message || 'Failed to start DM'))}
              disabled={!dmPick}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300"
            >
              Start DM
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Search users</label>
            <input
              value={dmSearch}
              onChange={(e) => setDmSearch(e.target.value)}
              placeholder="Search by name or email"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div className="max-h-72 overflow-y-auto rounded-xl border">
            {filteredDmUsers.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-gray-500">No matching users.</div>
            ) : (
              filteredDmUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setDmPick(user)}
                  className={`flex w-full items-center gap-3 border-b px-3 py-3 text-left last:border-b-0 hover:bg-gray-50 ${dmPick?.id === user.id ? 'bg-blue-50' : ''}`}
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${avatarClass(user.email)}`}>
                    {initials(displayName(user))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-900">{displayName(user)}</div>
                    <div className="truncate text-xs text-gray-500">{user.email}</div>
                  </div>
                  {dmPick?.id === user.id ? <CheckCircle2 className="h-4 w-4 text-blue-600" /> : null}
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
