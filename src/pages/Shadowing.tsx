import React from 'react';
import {
  Card,
  Table,
  Typography,
  Button,
} from '@shadcn/ui/react';

const shadowingData = {
  people: [
    { name: 'Marcus Rivera', role: 'Junior Tech', status: 'shadowing', mentor: 'Adam Garza', progress: 40 },
    { name: 'Priya Sharma', role: 'Support Tech', status: 'shadowing', mentor: 'Sofia Patel', progress: 25 },
    { name: 'Lena Chen', role: 'Mid-Level Tech', status: 'shadowing', mentor: 'James Okafor', progress: 60 },
  ],
};

function Shadowing() {
  const { people } = shadowingData;

  return (
    <div className="space-y-6">
      <Typography className="text-2xl font-bold mb-4">People Currently Shadowing</Typography>
      <Table>
        <thead>
          <tr>
            <th className="text-left">Name</th>
            <th className="text-left">Role</th>
            <th className="text-left">Mentor</th>
            <th className="text-right">Progress (%)</th>
            <th className="text-right">Actions</th>
          </thead>
        </tbody>
        <tbody>
          {people.map((person) => (
            <tr key={person.id}>
              <td className="font-medium">{person.name}</td>
              <td className="font-medium">{person.role}</td>
              <td className="font-medium">{person.mentor}</td>
              <td className="text-sm text-green-600">{person.progress}%</td>
              <td className="text-right">
                <Button variant="outline" onClick={() => alert(`Start shadowing session for ${person.name}`)}>
                  Begin Session
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export default Shadowing;
