import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";

const colorClasses = {
  blue: {
    bg: "bg-blue-50",
    icon: "text-blue-600",
    gradient: "from-blue-500 to-blue-600"
  },
  green: {
    bg: "bg-green-50",
    icon: "text-green-600",
    gradient: "from-green-500 to-green-600"
  },
  orange: {
    bg: "bg-orange-50",
    icon: "text-orange-600",
    gradient: "from-orange-500 to-orange-600"
  },
  red: {
    bg: "bg-red-50",
    icon: "text-red-600",
    gradient: "from-red-500 to-red-600"
  },
  purple: {
    bg: "bg-purple-50",
    icon: "text-purple-600",
    gradient: "from-purple-500 to-purple-600"
  }
};

export default function StatsCard({ title, value, icon: Icon, color, subtitle }) {
  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="material-card shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            {title}
          </CardTitle>
          <div className={`p-3 rounded-xl ${colors.bg}`}>
            <Icon className={`h-5 w-5 ${colors.icon}`} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-gray-900">
            {value}
          </div>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}