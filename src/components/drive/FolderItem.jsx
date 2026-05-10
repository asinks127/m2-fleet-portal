import React from 'react';
import { Folder } from 'lucide-react';
import { motion } from 'framer-motion';

export default function FolderItem({ folder, onNavigate }) {
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  return (
    <motion.div
      variants={itemVariants}
      className="flex flex-col items-center p-3 rounded-lg hover:bg-blue-50 cursor-pointer text-center transition-colors"
      onDoubleClick={onNavigate}
      onClick={onNavigate}
      tabIndex={0}
      onKeyPress={(e) => e.key === 'Enter' && onNavigate()}
    >
      <Folder className="w-16 h-16 text-blue-500 mb-2" />
      <p className="text-sm font-medium text-gray-700 break-words w-full">
        {folder.name.replace(/_/g, ' ')}
      </p>
    </motion.div>
  );
}