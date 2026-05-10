import React, { useState } from 'react';
import { SafetyMessage } from '@/api/entities.js';
import { InvokeLLM } from '@/api/integrations.js';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { AlertCircle, Loader2, Sparkles, Calendar } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox.jsx';

export default function NewSafetyMessageForm({ onSuccess }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('General Safety');
  const [isMonthly, setIsMonthly] = useState(false);
  const [scheduledFor, setScheduledFor] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerateAIContent = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const currentDate = new Date();
      const season = getSeason(currentDate);
      const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
      
      const prompt = `Generate a comprehensive weekly safety message for field service technicians working on telecommunications and fleet installations. 

Current context:
- Season: ${season}
- Month: ${currentMonth}
- Industry: Telecommunications/Fleet service installations
- Audience: Field technicians working on various job sites

Please create a safety message that includes:
1. A relevant, engaging title
2. A brief introduction highlighting the week's safety focus
3. 3-4 specific safety tips or reminders relevant to the current season/month
4. A real-world scenario or example they might encounter
5. A clear call-to-action for safe practices
6. Professional, authoritative but friendly tone

Focus on practical, actionable advice that technicians can immediately apply in the field. Consider seasonal hazards like ${season === 'Winter' ? 'ice, cold weather, reduced daylight' : season === 'Summer' ? 'heat stress, UV exposure, hydration' : season === 'Spring' ? 'wet conditions, increased activity, equipment maintenance' : 'variable weather, early darkness, preparation for winter conditions'}.

The message should be comprehensive enough to serve as a weekly safety memo but concise enough to hold attention.`;

      const response = await InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: { type: "string" },
            suggestedCategory: { type: "string" }
          }
        }
      });

      setTitle(response.title);
      setContent(response.content);
      setCategory(response.suggestedCategory || 'General Safety');
      
    } catch (err) {
      console.error('Failed to generate AI content:', err);
      setError('Failed to generate AI content. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateWeeklySchedule = () => {
    const nextMonday = getNextMonday();
    setScheduledFor(nextMonday.toISOString().split('T')[0]);
    setIsMonthly(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !content) {
      setError('Title and content are required.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const messageData = {
        title,
        content,
        category,
        publishDate: new Date().toISOString(),
        isActive: true,
        isMonthly,
      };

      if (scheduledFor) {
        messageData.scheduledFor = scheduledFor;
      }

      await SafetyMessage.create(messageData);
      onSuccess();
    } catch (err) {
      console.error('Failed to create safety message:', err);
      setError('An error occurred while saving the message.');
    } finally {
      setIsSaving(false);
    }
  };

  const getSeason = (date) => {
    const month = date.getMonth();
    if (month >= 2 && month <= 4) return 'Spring';
    if (month >= 5 && month <= 7) return 'Summer';
    if (month >= 8 && month <= 10) return 'Fall';
    return 'Winter';
  };

  const getNextMonday = () => {
    const today = new Date();
    const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    return nextMonday;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-4">
      {/* AI Generation Section */}
      <div className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI-Powered Content Generation
          </h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Generate contextual, seasonal safety content automatically based on current conditions and industry best practices.
        </p>
        <div className="flex gap-3">
          <Button
            type="button"
            onClick={handleGenerateAIContent}
            disabled={isGenerating}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {isGenerating ? 'Generating...' : 'Generate AI Content'}
          </Button>
          <Button
            type="button"
            onClick={handleGenerateWeeklySchedule}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            Schedule for Next Monday
          </Button>
        </div>
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Weekly Safety Focus: Ladder Safety"
            disabled={isSaving}
          />
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <Select value={category} onValueChange={setCategory} disabled={isSaving}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="General Safety">General Safety</SelectItem>
              <SelectItem value="OSHA">OSHA Compliance</SelectItem>
              <SelectItem value="Workers Comp">Workers Compensation</SelectItem>
              <SelectItem value="Emergency Procedures">Emergency Procedures</SelectItem>
              <SelectItem value="Equipment Safety">Equipment Safety</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="content">Content</Label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter the full safety message here..."
          rows={12}
          disabled={isSaving}
        />
      </div>

      {/* Scheduling Options */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <h3 className="font-semibold mb-3">Scheduling Options</h3>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="isMonthly" 
              checked={isMonthly} 
              onCheckedChange={setIsMonthly}
              disabled={isSaving}
            />
            <Label htmlFor="isMonthly" className="text-sm">
              Schedule as recurring weekly message
            </Label>
          </div>
          
          {isMonthly && (
            <div>
              <Label htmlFor="scheduledFor">Scheduled For</Label>
              <Input
                id="scheduledFor"
                type="date"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                disabled={isSaving}
              />
              <p className="text-xs text-gray-500 mt-1">
                This message will be automatically sent to all active technicians on the scheduled date.
              </p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end space-x-3">
        <Button type="submit" disabled={isSaving || isGenerating}>
          {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isMonthly ? 'Schedule Message' : 'Publish Message'}
        </Button>
      </div>
    </form>
  );
}