import React, { useState } from 'react';
import { SafetyAcknowledgement } from '@/api/entities.js';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

export default function SafetyMessageModal({ message, user, onAcknowledged }) {
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [hasRead, setHasRead] = useState(false);
  const [error, setError] = useState(null);

  const handleAcknowledge = async () => {
    if (!hasRead) {
      setError('Please confirm that you have read the safety message by checking the box below.');
      return;
    }

    if (!message?.id || !user?.id) {
      setError('Missing message or user information.');
      return;
    }

    setIsAcknowledging(true);
    setError(null);

    try {
      await SafetyAcknowledgement.create({
        messageId: message.id,
        userId: user.id,
        acknowledged_at: new Date().toISOString(),
        metadata: {
          userEmail: user.email || null,
          userName: user.full_name || user.displayName || user.email || null,
          deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          acknowledgedFrom: 'SafetyMessageModal'
        }
      });

      if (typeof onAcknowledged === 'function') {
        onAcknowledged();
      }
    } catch (err) {
      console.error('Error acknowledging safety message:', err);
      setError(err?.message || 'Failed to acknowledge message. Please try again.');
      setIsAcknowledging(false);
    }
  };

  const publishedRaw = message?.published_at || message?.publishDate;
  const publishedLabel = (() => {
    if (!publishedRaw) return 'N/A';
    const d = new Date(publishedRaw);
    return !isNaN(d.getTime()) ? format(d, 'MMMM d, yyyy') : 'N/A';
  })();

  const bodyText = message?.message || message?.content || '';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <CardHeader className="bg-red-50 border-b">
          <CardTitle className="flex items-center gap-3 text-red-800">
            <ShieldCheck className="w-6 h-6" />
            <span>Important Safety Message</span>
          </CardTitle>
          <p className="text-sm text-red-600">Published: {publishedLabel}</p>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{message?.title || 'Safety Message'}</h2>
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-gray-700">{bodyText}</div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="border-t pt-4">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasRead}
                onChange={(e) => setHasRead(e.target.checked)}
                className="mt-1 h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">
                I confirm that I have read and understood this safety message in its entirety. 
                I acknowledge my responsibility to follow all safety protocols and procedures outlined above.
              </span>
            </label>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleAcknowledge}
              disabled={!hasRead || isAcknowledging}
              className="bg-red-600 hover:bg-red-700"
            >
              {isAcknowledging ? 'Processing...' : 'I Acknowledge'}
            </Button>
          </div>

          <div className="text-xs text-gray-500 text-center border-t pt-3">
            This acknowledgment is required for compliance and will be logged with your user information and timestamp.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}