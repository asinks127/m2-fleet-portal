import React, { useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { UploadCloud, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils/index.js';
import UploadInvoiceDialog from './UploadInvoiceDialog';

export default function Toolbar({ onUpdate, path, contractors }) {
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  return (
    <>
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 hidden sm:block">Files</h3>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setIsUploadOpen(true)}>
            <UploadCloud className="w-4 h-4 mr-2" />
            Upload Invoice
          </Button>

          {path.length === 0 && (
            <Link to={createPageUrl('TechRoster')}>
              <Button variant="outline">
                <Users className="w-4 h-4 mr-2" />
                Manage Contractors
              </Button>
            </Link>
          )}
        </div>
      </div>
      <UploadInvoiceDialog
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUpdate={onUpdate}
        contractors={contractors}
      />
    </>
  );
}