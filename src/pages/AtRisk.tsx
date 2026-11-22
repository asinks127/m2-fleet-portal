import React from 'react';
import {
  Card,
  Table,
  Typography,
  Button,
} from '@shadcn/ui/react';

const atRiskData = {
  members: [
    { name: 'Marcus Rivera', role: 'Junior Tech', status: 'at-risk', score: 72, issues: ['Low availability', 'Missed deadlines'] },
    { name: 'Priya Sharma', role: 'Support Tech', status: 'at-risk', score: 68, issues: ['Training gap', 'Communication delays'] },
    { name: 'Diego Martinez', role: 'Mid-Level Tech', status: 'at-risk', score: 65, issues: ['System conflicts', 'Limited experience'] },
  ],
};

function AtRisk() {
  const { members } = atRiskData;

  return (
    <div className="space-y-6">
      <Typography className="text-2xl font-bold mb-4">At-Risk Team Members</Typography>
      <Table>
        <thead>
          <tr>
            <th className="text-left">Member</th>
            <th className="text-left">Role</th>
            <th className="text-left">Score</th>
            <th className="text-left">Issues</th>
            <th className="text-right">Actions</th>
          </thead>
        </tbody>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td className="font-medium">{member.name}</td>
              <td className="font-medium">{member.role}</td>
              <td className="text-sm text-red-600">{member.score}</td>
              <td className="text-sm text-gray-600">{member.issues.join(', ')}</td>
              <td className="text-right">
                <Button variant="outline" onClick={() => alert(`Action taken for ${member.name}`)}>
                  Investigate
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export default AtRisk;
