import { base44 as portalClient } from './base44Client';

export const base44 = {
  ...portalClient,
  functions: {
    invoke: async (name, payload) => {
      const data = await portalClient.functions.invoke(name, payload);
      return { ...data, data };
    },
  },
};
