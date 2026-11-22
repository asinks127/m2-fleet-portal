import { getAuthUser, supabase } from './_lib/supabaseServer.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data: responses, error } = await supabase
      .from('VeloSurveyResponse')
      .select(`
        id,
        technicianId,
        technicianName,
        communicationSkills,
        availability,
        installQuality,
        reliability,
        problemSolving,
        safetyCompliance,
        overallPerformance,
        calculatedScore,
        additionalNotes,
        submittedDate,
        surveyId
      `)
      .not('submittedDate', 'is', null)
      .order('submittedDate', { ascending: false });

    if (error) {
      console.error('Error fetching ratings:', error);
      return res.status(500).json({ error: 'Failed to fetch ratings' });
    }

    const byTechnician = {};

    for (const r of responses) {
      if (!r.technicianId) continue;
      const key = r.technicianId;
      if (!byTechnician[key]) {
        byTechnician[key] = {
          technicianId: r.technicianId,
          technicianName: r.technicianName || 'Unknown',
          totalResponses: 0,
          scores: [],
          categoryAverages: {
            communicationSkills: [],
            availability: [],
            installQuality: [],
            reliability: [],
            problemSolving: [],
            safetyCompliance: [],
            overallPerformance: [],
          },
          recentNotes: [],
          lastRated: null,
        };
      }

      const tech = byTechnician[key];
      tech.totalResponses++;

      if (typeof r.calculatedScore === 'number') {
        tech.scores.push(r.calculatedScore);
      }

      const categories = ['communicationSkills', 'availability', 'installQuality', 'reliability', 'problemSolving', 'safetyCompliance', 'overallPerformance'];
      for (const cat of categories) {
        if (typeof r[cat] === 'number') {
          tech.categoryAverages[cat].push(r[cat]);
        }
      }

      if (r.additionalNotes && r.additionalNotes.trim()) {
        tech.recentNotes.push({
          note: r.additionalNotes,
          date: r.submittedDate,
          score: r.calculatedScore,
        });
      }

      if (!tech.lastRated || new Date(r.submittedDate) > new Date(tech.lastRated)) {
        tech.lastRated = r.submittedDate;
      }
    }

    const rankings = Object.values(byTechnician).map(tech => {
      const avgOverall = tech.scores.length > 0
        ? tech.scores.reduce((a, b) => a + b, 0) / tech.scores.length
        : null;

      const categoryAvgs = {};
      for (const [cat, vals] of Object.entries(tech.categoryAverages)) {
        categoryAvgs[cat] = vals.length > 0
          ? vals.reduce((a, b) => a + b, 0) / vals.length
          : null;
      }

      tech.recentNotes.sort((a, b) => new Date(b.date) - new Date(a.date));
      tech.recentNotes = tech.recentNotes.slice(0, 5);

      return {
        ...tech,
        overallRating: avgOverall !== null ? Math.round(avgOverall * 100) / 100 : null,
        categoryAverages: categoryAvgs,
      };
    });

    rankings.sort((a, b) => {
      if (a.overallRating === null && b.overallRating === null) return 0;
      if (a.overallRating === null) return 1;
      if (b.overallRating === null) return -1;
      return b.overallRating - a.overallRating;
    });

    return res.status(200).json({
      success: true,
      totalResponses: responses.length,
      totalTechnicians: rankings.length,
      rankings,
    });

  } catch (error) {
    console.error('getContractorRatings error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
}
