import { Student } from '../types';

/**
 * Ensures every student record has a unique ID, fixing any duplicate keys
 * that may exist in legacy stored state or bulk uploaded datasets.
 */
export function ensureUniqueStudentIds(list: Student[]): Student[] {
  const seenIds = new Set<string>();
  let nextNumericId = 300;

  return list.map((student) => {
    let id = (student.id || '').trim();

    // Map known legacy duplicate records from earlier initial data
    if (id === 'S-0058' && student.family?.toLowerCase().includes('numan ali')) {
      id = 'S-0266';
    } else if (id === 'S-0060' && student.family?.toLowerCase().includes('imran')) {
      id = 'S-0062';
    } else if (id === 'S-00089' && student.family?.toLowerCase().includes('imran raza')) {
      id = 'S-00048';
    } else if (id === 'S-0068' && student.family?.toLowerCase().includes('hammad')) {
      id = 'S-0272';
    } else if (id === 'S-0088' && student.family?.toLowerCase().includes('ali') && student.familyId === 'F-0213') {
      id = 'S-0271';
    }

    // If ID is missing, or already used in this list, generate a unique fallback ID
    if (!id || seenIds.has(id)) {
      while (seenIds.has(`S-${String(nextNumericId).padStart(4, '0')}`)) {
        nextNumericId++;
      }
      id = `S-${String(nextNumericId).padStart(4, '0')}`;
      nextNumericId++;
    }

    seenIds.add(id);
    return {
      ...student,
      id
    };
  });
}
