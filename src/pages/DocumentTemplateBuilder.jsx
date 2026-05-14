// Document Signing - Template Builder Page
// This is the admin page for creating/editing document templates

import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TemplateBuilder from './documentSigning/TemplateBuilder';

export default function DocumentTemplateBuilder() {
  const navigate = useNavigate();
  const { templateId } = useParams();

  return (
    <TemplateBuilder
      editTemplateId={templateId}
      onSave={() => navigate('/DocumentsAdmin')}
      onCancel={() => navigate('/DocumentsAdmin')}
    />
  );
}
