import React from 'react';
import {
  Card,
  Table,
  Typography,
  Button,
} from '@shadcn/ui/react';

const teamHealthData = {
  teams: [
    {
      id: 'team-alpha',
      name: 'Alpha Squad',
      members: [
        { name: 'Adam Garza', role: 'Senior Tech', status: 'healthy', score: 94 },
        { name: 'Lena Chen', role: 'Mid-Level Tech', status: 'healthy', score: 88 },
        { name: 'Marcus Rivera', role: 'Junior Tech', status: 'at-risk', score: 72 },
      ],
    },
    {
      id: 'team-beta',
      name: 'Beta Crew',
      members: [
        { name: 'Sofia Patel', role: 'Lead Tech', status: 'healthy', score: 91 },
        { name: 'James Okafor', role: 'Tech Lead', status: 'healthy', score: 95 },
        { name: 'Priya Sharma', role: 'Support Tech', status: 'at-risk', score: 68 },
      ],
    },
  ],
};

function TeamHealth() {
  const { teams } = teamHealthData;

  return (
    <div className="space-y-6">
      {teams.map((team) => (
        <Card key={team.id} className="rounded-lg border p-4 hover:shadow-md">
          <Typography className="text-xl font-bold mb-2">{team.name}</Typography>
          <Table>
            <tbody>
              {team.members.map((member) => (
                <tr key={member.id}>
                  <td className="text-sm">{member.name}</td>
                  <td className="text-sm">{member.role}</td>
                  <td className="text-sm">{member.status}</td>
                  <td className="text-sm">Score: {member.score}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ))}
    </div>
  );
}

export default TeamHealth;
