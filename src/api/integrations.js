import { supabase } from '@/lib/supabaseClient.js';

// Integrations - replaces base44 integrations with direct API calls

export const InvokeLLM = async ({ prompt, response_json_schema, ...options }) => {
  // Calls our Vercel serverless function which proxies to Gemini
  const res = await fetch('/api/invokeLLM', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, response_json_schema, ...options })
  });
  if (!res.ok) throw new Error('LLM invocation failed');
  return res.json();
};

export const SendEmail = async ({ to, subject, body, ...options }) => {
  const res = await fetch('/api/sendEmail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, body, ...options })
  });
  if (!res.ok) throw new Error('Email send failed');
  return res.json();
};

export const SendSMS = async ({ to, message, ...options }) => {
  const res = await fetch('/api/sendSMS', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, message, ...options })
  });
  if (!res.ok) throw new Error('SMS send failed');
  return res.json();
};

export const UploadFile = async ({ file }) => {
  const fileName = `${Date.now()}_${file.name}`;
  const { data, error } = await supabase.storage
    .from('documents')
    .upload(fileName, file);
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName);
  return { file_url: urlData.publicUrl };
};

export const GenerateImage = async (options) => {
  const res = await fetch('/api/generateImage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options)
  });
  if (!res.ok) throw new Error('Image generation failed');
  return res.json();
};

export const ExtractDataFromUploadedFile = async (options) => {
  const res = await fetch('/api/extractData', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options)
  });
  if (!res.ok) throw new Error('Data extraction failed');
  return res.json();
};

export const Core = {
  InvokeLLM,
  SendEmail,
  SendSMS,
  UploadFile,
  GenerateImage,
  ExtractDataFromUploadedFile
};
