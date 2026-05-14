// Document Signing - Signer Page (Public Access)
// This is the public-facing page where contractors sign documents

import React from 'react';
import { useParams } from 'react-router-dom';
import SignerPage from './documentSigning/SignerPage';

export default function SignDocumentPage() {
  const { requestId, token } = useParams();
  
  return <SignerPage />;
}
