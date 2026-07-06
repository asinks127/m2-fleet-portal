import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, Mail, User } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function ProjectManagerMapping() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: mappings = [], isLoading } = useQuery({
        queryKey: ['pmMappings'],
        queryFn: () => base44.entities.ProjectManagerMapping.list(),
    });

    const createMutation = useMutation({
        mutationFn: (newMapping) => base44.entities.ProjectManagerMapping.create(newMapping),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pmMappings'] });
            setName('');
            setEmail('');
            toast({ title: 'Mapping added successfully' });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.ProjectManagerMapping.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pmMappings'] });
            toast({ title: 'Mapping deleted' });
        },
    });

    const handleAdd = (e) => {
        e.preventDefault();
        if (!name || !email) return;
        createMutation.mutate({ name: name.trim(), email: email.trim() });
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-gray-900">Project Manager Email Mappings</h1>
            <p className="text-gray-600 mb-8">
                Use this table to map Project Manager names (as they appear in user profiles) to their correct email addresses. 
                This ensures they receive the Daily PM Reports properly.
            </p>
            
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Add New PM Mapping</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAdd} className="flex gap-4 items-end flex-wrap md:flex-nowrap">
                        <div className="flex-1 min-w-[250px]">
                            <label className="text-sm font-medium mb-1 block">PM Name (Exact Match)</label>
                            <div className="relative">
                                <User className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                                <Input 
                                    value={name} 
                                    onChange={(e) => setName(e.target.value)} 
                                    placeholder="e.g. Jason Wiersema" 
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <div className="flex-1 min-w-[250px]">
                            <label className="text-sm font-medium mb-1 block">Email Address</label>
                            <div className="relative">
                                <Mail className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                                <Input 
                                    type="email"
                                    value={email} 
                                    onChange={(e) => setEmail(e.target.value)} 
                                    placeholder="pm@example.com" 
                                    className="pl-9"
                                />
                            </div>
                        </div>
                        <Button type="submit" disabled={!name || !email || createMutation.isPending} className="w-full md:w-auto">
                            <Plus className="w-4 h-4 mr-2" /> Add
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Existing Mappings</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="py-4 text-gray-500">Loading mappings...</div>
                    ) : mappings.length === 0 ? (
                        <div className="text-gray-500 py-4">No mappings defined yet. Add one above.</div>
                    ) : (
                        <div className="space-y-2">
                            {mappings.map((mapping) => (
                                <div key={mapping.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-4 flex-wrap md:flex-nowrap">
                                        <div className="font-medium text-gray-900 min-w-[200px]">{mapping.name}</div>
                                        <div className="text-gray-500 text-sm flex items-center">
                                            <Mail className="w-3 h-3 mr-1" />
                                            {mapping.email}
                                        </div>
                                    </div>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => deleteMutation.mutate(mapping.id)}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}