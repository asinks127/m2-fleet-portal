import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, MessageSquare, Plus, ChevronDown, ChevronUp, Paperclip } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const PassFailButtons = ({ value, onChange, disabled }) => (
  <div className="flex gap-2">
    <button
      disabled={disabled}
      onClick={() => onChange(value === 'pass' ? '' : 'pass')}
      className={`px-5 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
        value === 'pass'
          ? 'bg-green-500 text-white border-green-500 shadow-sm'
          : 'bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      Pass
    </button>
    <button
      disabled={disabled}
      onClick={() => onChange(value === 'fail' ? '' : 'fail')}
      className={`px-5 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
        value === 'fail'
          ? 'bg-red-500 text-white border-red-500 shadow-sm'
          : 'bg-white text-gray-600 border-gray-200 hover:border-red-400 hover:text-red-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      Fail
    </button>
  </div>
);

const YesNoButtons = ({ value, onChange, disabled }) => (
  <div className="flex gap-2">
    <button
      disabled={disabled}
      onClick={() => onChange(value === 'yes' ? '' : 'yes')}
      className={`px-5 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
        value === 'yes' ? 'bg-green-500 text-white border-green-500 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      Yes
    </button>
    <button
      disabled={disabled}
      onClick={() => onChange(value === 'no' ? '' : 'no')}
      className={`px-5 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
        value === 'no' ? 'bg-red-500 text-white border-red-500 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-red-400 hover:text-red-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      No
    </button>
  </div>
);

export default function ChecklistItem({ item, response, onResponse, onCreateCA, disabled, index }) {
  const [showNotes, setShowNotes] = useState(!!response.notes);
  const [uploading, setUploading] = useState(false);
  
  const val = response.responseValue?.toLowerCase();
  const isFailed = val === 'fail' || val === 'no';
  const isPassed = val === 'pass' || val === 'yes';
  
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onResponse('attachmentUrl', file_url);
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const renderInput = () => {
    switch (item.responseType) {
      case 'pass_fail':
        return <PassFailButtons value={response.responseValue || ''} onChange={(v) => onResponse('responseValue', v)} disabled={disabled} />;
      case 'yes_no':
        return <YesNoButtons value={response.responseValue || ''} onChange={(v) => onResponse('responseValue', v)} disabled={disabled} />;
      case 'text':
        return (
          <Textarea
            placeholder="Enter response..."
            value={response.responseValue || ''}
            onChange={(e) => onResponse('responseValue', e.target.value)}
            disabled={disabled}
            className="min-h-[80px] text-sm"
          />
        );
      case 'number':
        return (
          <Input
            type="number"
            placeholder="0"
            value={response.responseValue || ''}
            onChange={(e) => onResponse('responseValue', e.target.value)}
            disabled={disabled}
            className="w-40"
          />
        );
      case 'date':
        return (
          <Input
            type="date"
            value={response.responseValue || ''}
            onChange={(e) => onResponse('responseValue', e.target.value)}
            disabled={disabled}
            className="w-48"
          />
        );
      case 'file_upload':
        return (
          <div className="flex items-center gap-3">
            <label className={`flex items-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg cursor-pointer text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <Paperclip className="w-4 h-4" />
              {uploading ? 'Uploading...' : response.attachmentUrl ? 'Change file' : 'Upload file'}
              <input type="file" className="hidden" onChange={handleFileUpload} disabled={disabled || uploading} />
            </label>
            {response.attachmentUrl && (
              <a href={response.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">View</a>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`p-4 transition-colors ${isFailed ? 'bg-red-50/60' : isPassed ? 'bg-green-50/30' : 'bg-white'}`}>
      <div className="flex flex-col md:flex-row gap-4">
        {/* Left: Question info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-1">
            <span className="text-xs font-bold text-gray-400 mt-0.5 flex-shrink-0">#{index}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`text-sm font-semibold ${isFailed ? 'text-red-700' : 'text-gray-900'}`}>{item.question}</p>
                {item.isCritical && (
                  <Badge className="bg-red-100 text-red-700 text-xs flex items-center gap-0.5 border border-red-200">
                    <AlertTriangle className="w-2.5 h-2.5" /> Critical
                  </Badge>
                )}
                {item.pointValue > 0 && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{item.pointValue} pts</span>
                )}
              </div>
              {item.description && (
                <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Response input */}
        <div className="flex-shrink-0 flex flex-col gap-2">
          {renderInput()}
        </div>
      </div>

      {/* Notes / Attachment / CA row */}
      <div className="flex items-center gap-2 mt-3 ml-5 flex-wrap">
        <button
          onClick={() => setShowNotes(!showNotes)}
          className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {showNotes ? 'Hide notes' : (response.notes ? 'View notes' : 'Add notes')}
          {showNotes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {isFailed && !disabled && (
          <button
            onClick={onCreateCA}
            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Create corrective action
          </button>
        )}

        {response.attachmentUrl && (
          <a href={response.attachmentUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-500 flex items-center gap-1">
            <Paperclip className="w-3 h-3" /> Attachment
          </a>
        )}
      </div>

      {showNotes && (
        <div className="mt-2 ml-5">
          <Textarea
            placeholder="Add a note for this item..."
            value={response.notes || ''}
            onChange={(e) => onResponse('notes', e.target.value)}
            disabled={disabled}
            className="text-xs min-h-[60px]"
          />
        </div>
      )}
    </div>
  );
}