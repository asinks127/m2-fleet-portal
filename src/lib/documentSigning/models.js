// Document Signing System Models

export const FIELD_TYPES = {
  SIGNATURE: 'signature',
  INITIALS: 'initials',
  TEXT: 'text',
  DATE: 'date',
  CHECKBOX: 'checkbox',
  DROPDOWN: 'dropdown',
  FULL_NAME: 'full_name',
  EMAIL: 'email',
  COMPANY: 'company',
  TITLE: 'title',
  PHONE: 'phone',
  EIN: 'ein',
  NUMBER: 'number',
  AMOUNT: 'amount',
  CUSTOM: 'custom',
};

export const DOCUMENT_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  SENT: 'sent',
  VIEWED: 'viewed',
  SIGNED: 'signed',
  COMPLETED: 'completed',
  DECLINED: 'declined',
  VOIDED: 'voided',
  EXPIRED: 'expired',
};

export const SIGNER_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  VIEWED: 'viewed',
  SIGNED: 'signed',
  DECLINED: 'declined',
};

export const DOCUMENT_TYPES = {
  ONBOARDING_PACKET: 'onboarding_packet',
  CONTRACTOR_AGREEMENT: 'contractor_agreement',
  SAFETY_ACKNOWLEDGEMENT: 'safety_acknowledgement',
  WORKERS_COMP: 'workers_comp',
  ACH_FORM: 'ach_form',
  TAX_1099: 'tax_1099',
  NDA: 'nda',
  COMPLIANCE: 'compliance',
  CUSTOM: 'custom',
};

// Default field configuration
export const DEFAULT_FIELD_CONFIG = {
  [FIELD_TYPES.SIGNATURE]: {
    label: 'Signature',
    width: 150,
    height: 40,
    required: true,
  },
  [FIELD_TYPES.INITIALS]: {
    label: 'Initials',
    width: 50,
    height: 30,
    required: true,
  },
  [FIELD_TYPES.TEXT]: {
    label: 'Text Field',
    width: 200,
    height: 30,
    required: false,
  },
  [FIELD_TYPES.DATE]: {
    label: 'Date',
    width: 120,
    height: 30,
    required: true,
    format: 'MM/DD/YYYY',
  },
  [FIELD_TYPES.CHECKBOX]: {
    label: 'Checkbox',
    width: 20,
    height: 20,
    required: false,
  },
  [FIELD_TYPES.DROPDOWN]: {
    label: 'Dropdown',
    width: 150,
    height: 30,
    required: false,
    options: [],
  },
  [FIELD_TYPES.FULL_NAME]: {
    label: 'Full Name',
    width: 200,
    height: 30,
    required: true,
  },
  [FIELD_TYPES.EMAIL]: {
    label: 'Email',
    width: 200,
    height: 30,
    required: true,
    validation: 'email',
  },
  [FIELD_TYPES.COMPANY]: {
    label: 'Company Name',
    width: 200,
    height: 30,
    required: false,
  },
  [FIELD_TYPES.TITLE]: {
    label: 'Title',
    width: 150,
    height: 30,
    required: false,
  },
  [FIELD_TYPES.PHONE]: {
    label: 'Phone',
    width: 150,
    height: 30,
    required: false,
    validation: 'phone',
  },
  [FIELD_TYPES.EIN]: {
    label: "EIN",
    width: 150,
    height: 30,
    required: false,
    validation: "ein",
  },
  [FIELD_TYPES.NUMBER]: {
    label: "Number",
    width: 120,
    height: 30,
    required: false,
    validation: "number",
  },
  [FIELD_TYPES.AMOUNT]: {
    label: "Amount",
    width: 120,
    height: 30,
    required: false,
    validation: "currency",
  },
  [FIELD_TYPES.CUSTOM]: {
    label: 'Custom Field',
    width: 150,
    height: 30,
    required: false,
  },
};

// Create a new template field
export function createTemplateField(type, pageNumber, position, signerId = null) {
  const config = DEFAULT_FIELD_CONFIG[type] || DEFAULT_FIELD_CONFIG[FIELD_TYPES.CUSTOM];
  
  return {
    id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    pageNumber,
    position: {
      x: position.x,
      y: position.y,
    },
    width: config.width,
    height: config.height,
    label: config.label,
    required: config.required || false,
    signerId,
    value: '',
    prefilledValue: '',
    validation: config.validation || null,
    options: config.options || null,
    format: config.format || null,
  };
}

// Create a new signer for a document
export function createSigner(signerData) {
  return {
    id: `signer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: signerData.name || '',
    email: signerData.email || '',
    role: signerData.role || 'Signer',
    order: signerData.order || 0,
    status: SIGNER_STATUS.PENDING,
    userId: signerData.userId || null,
    viewedAt: null,
    signedAt: null,
    declinedAt: null,
    declinedReason: null,
    signingUrl: null,
    signingToken: null,
    reminderCount: 0,
    lastReminderAt: null,
  };
}

// Create a new document template
export function createTemplate(templateData) {
  return {
    id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: templateData.name || 'Untitled Template',
    description: templateData.description || '',
    documentType: templateData.documentType || DOCUMENT_TYPES.CUSTOM,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: templateData.createdBy || null,
    originalPdfUrl: templateData.originalPdfUrl || null,
    pdfPageCount: templateData.pdfPageCount || 1,
    fields: templateData.fields || [],
    signers: templateData.signers || [],
    settings: {
      signingOrder: templateData.signingOrder || 'sequential', // sequential | parallel
      expirationDays: templateData.expirationDays || 30,
      remindDays: templateData.remindDays || 3,
      remindDaysBeforeExpiration: templateData.remindDaysBeforeExpiration || 7,
      allowTypedSignature: true,
      allowDrawnSignature: true,
      requireAccessCode: false,
      allowDownload: true,
      allowPrint: true,
      ...templateData.settings,
    },
    isActive: true,
    usageCount: 0,
  };
}

// Create a new document request (sent for signing)
export function createDocumentRequest(requestData) {
  return {
    id: `request_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    templateId: requestData.templateId || null,
    name: requestData.name || 'Untitled Document',
    documentType: requestData.documentType || DOCUMENT_TYPES.CUSTOM,
    status: DOCUMENT_STATUS.DRAFT,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: requestData.createdBy || null,
    originalPdfUrl: requestData.originalPdfUrl || null,
    fields: JSON.parse(JSON.stringify(requestData.fields || [])), // Deep clone
    signers: JSON.parse(JSON.stringify(requestData.signers || [])), // Deep clone
    currentSignerOrder: 0,
    expiresAt: requestData.expiresAt || null,
    completedAt: null,
    signedPdfUrl: null,
    contractorId: requestData.contractorId || null,
    contractorName: requestData.contractorName || null,
    bulkSendId: requestData.bulkSendId || null,
    metadata: {
      source: requestData.source || 'manual',
      tags: requestData.tags || [],
      notes: requestData.notes || '',
      ...requestData.metadata,
    },
  };
}

// Create a signed document record
export function createSignedDocument(documentRequest) {
  return {
    id: `signed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    requestId: documentRequest.id,
    templateId: documentRequest.templateId,
    name: documentRequest.name,
    documentType: documentRequest.documentType,
    signedPdfUrl: documentRequest.signedPdfUrl,
    signedAt: new Date().toISOString(),
    contractorId: documentRequest.contractorId,
    contractorName: documentRequest.contractorName,
    signers: documentRequest.signers,
    expiresAt: documentRequest.expiresAt || null,
    auditTrail: [],
    storagePath: null,
    fileSize: null,
    checksum: null,
  };
}

// Create an audit log entry
export function createAuditEntry(event, data = {}) {
  return {
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    event,
    ...data,
    // These will be populated by the backend
    ipAddress: null,
    userAgent: null,
    deviceId: null,
  };
}

export const AUDIT_EVENTS = {
  DOCUMENT_CREATED: 'document_created',
  DOCUMENT_SENT: 'document_sent',
  DOCUMENT_VIEWED: 'document_viewed',
  DOCUMENT_SIGNED: 'document_signed',
  DOCUMENT_COMPLETED: 'document_completed',
  DOCUMENT_DECLINED: 'document_declined',
  DOCUMENT_VOIDED: 'document_voided',
  DOCUMENT_EXPIRED: 'document_expired',
  FIELD_FILLED: 'field_filled',
  FIELD_UPDATED: 'field_updated',
  SIGNATURE_ADDED: 'signature_added',
  SIGNATURE_UPDATED: 'signature_updated',
  SIGNER_ADDED: 'signer_added',
  REMINDER_SENT: 'reminder_sent',
  EMAIL_SENT: 'email_sent',
  ERROR: 'error',
};
