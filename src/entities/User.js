import { supabase } from '@/lib/supabaseClient';

const DEMO_USER = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'pm.west@m2fleetcom.com',
  role: 'admin',
  user_metadata: {
    full_name: 'Casey Walker',
    role: 'pm'
  }
};

const User = {
  me: async () => {
    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      return DEMO_USER;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    return user;
  },
  
  filter: async (filters = {}, sort = '', limit = 1000) => {
    let query = supabase.from('User').select('*');
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    if (sort) {
      const [field, direction] = sort.startsWith('-')
        ? [sort.slice(1), 'desc']
        : [sort, 'asc'];
      query = query.order(field, { ascending: direction === 'asc' });
    }
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  
  findFirst: async (filters = {}) => {
    const { data, error } = await supabase
      .from('User')
      .select('*')
      .match(filters)
      .limit(1)
      .single();
    if (error) return null;
    return data;
  },
  
  get: async (id) => {
    const { data, error } = await supabase
      .from('User')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },
  
  create: async (data) => {
    const { data: result, error } = await supabase
      .from('User')
      .insert([data])
      .select()
      .single();
    if (error) throw error;
    return result;
  },
  
  update: async (id, data) => {
    const { data: result, error } = await supabase
      .from('User')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return result;
  },
  
  delete: async (id) => {
    const { error } = await supabase.from('User').delete().eq('id', id);
    if (error) throw error;
  },
  
  logout: async () => {
    await supabase.auth.signOut();
    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      return;
    }
    window.location.href = '/PortalAccess';
  },
  
  // Google OAuth login - redirects to Google sign-in
  login: async () => {
    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      return { user: DEMO_USER };
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/PortalAccess'
      }
    });
    if (error) throw error;
    return data;
  }
};

export { User };
export default User;
