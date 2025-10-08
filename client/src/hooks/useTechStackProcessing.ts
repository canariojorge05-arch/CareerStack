import { useMemo } from "react";

export interface ParsedTechStack {
  name: string;
  points: string[];
  color: string;
}

export interface PreviewStats {
  totalTechs: number;
  totalPoints: number;
  avgPointsPerTech: number;
  longestTech: string;
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

const TECH_COLORS = [
  'bg-blue-100 text-blue-800',
  'bg-green-100 text-green-800',
  'bg-purple-100 text-purple-800',
  'bg-orange-100 text-orange-800',
  'bg-pink-100 text-pink-800',
  'bg-indigo-100 text-indigo-800',
  'bg-yellow-100 text-yellow-800',
  'bg-red-100 text-red-800',
];

export function useTechStackProcessing(input: string) {
  // Memoize the input lines to avoid re-splitting on every render
  const lines = useMemo(() => input.split('\n').filter(line => line.trim()), [input]);
  
  const parsedTechStack = useMemo((): ParsedTechStack[] => {
    const techs: ParsedTechStack[] = [];
    let currentTech: ParsedTechStack | null = null;
    let colorIndex = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
        const point = trimmed.replace(/^[•\-*]\s*/, '');
        if (currentTech && point) {
          currentTech.points.push(point);
        }
      } else if (trimmed) {
        if (currentTech) {
          techs.push(currentTech);
        }
        currentTech = {
          name: trimmed,
          points: [],
          color: TECH_COLORS[colorIndex % TECH_COLORS.length]
        };
        colorIndex++;
      }
    }
    if (currentTech) {
      techs.push(currentTech);
    }
    return techs;
  }, [input]);

  const previewStats = useMemo((): PreviewStats => {
    const totalPoints = parsedTechStack.reduce((sum, tech) => sum + tech.points.length, 0);
    const errors: string[] = [];
    const warnings: string[] = [];
    if (parsedTechStack.length === 0) {
      errors.push('No tech stacks found');
    }
    if (totalPoints === 0) {
      errors.push('No bullet points found');
    }
    const techsWithoutPoints = parsedTechStack.filter(tech => tech.points.length === 0);
    if (techsWithoutPoints.length > 0) {
      warnings.push(`${techsWithoutPoints.length} tech(s) have no bullet points: ${techsWithoutPoints.map(t => t.name).join(', ')}`);
    }
    if (parsedTechStack.length > 0) {
      const avgPoints = totalPoints / parsedTechStack.length;
      const unevenTechs = parsedTechStack.filter(tech => Math.abs(tech.points.length - avgPoints) > 2);
      if (unevenTechs.length > 0) {
        warnings.push('Uneven point distribution detected across tech stacks');
      }
    }
    const allPoints = parsedTechStack.flatMap(tech => tech.points);
    const shortPoints = allPoints.filter(point => point.length < 20);
    const longPoints = allPoints.filter(point => point.length > 120);
    if (shortPoints.length > 0) {
      warnings.push(`${shortPoints.length} bullet point(s) might be too short`);
    }
    if (longPoints.length > 0) {
      warnings.push(`${longPoints.length} bullet point(s) might be too long`);
    }
    const longestTech = parsedTechStack.reduce(
      (longest, current) => current.points.length > longest.points.length ? current : longest,
      parsedTechStack[0] || { name: 'None', points: [] }
    );
    return {
      totalTechs: parsedTechStack.length,
      totalPoints,
      avgPointsPerTech: parsedTechStack.length > 0 ? Math.round(totalPoints / parsedTechStack.length * 100) / 100 : 0,
      longestTech: longestTech?.name || 'None',
      validation: {
        isValid: errors.length === 0,
        errors,
        warnings
      }
    };
  }, [parsedTechStack]);

  return { parsedTechStack, previewStats };
}
