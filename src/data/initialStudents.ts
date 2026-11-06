import { Student } from '../types';

export const AVATAR_COLORS = [
  'bg-emerald-600',
  'bg-blue-600',
  'bg-indigo-600',
  'bg-purple-600',
  'bg-rose-600',
  'bg-amber-600',
  'bg-cyan-600',
  'bg-teal-600',
  'bg-fuchsia-600',
  'bg-violet-600',
  'bg-red-600',
  'bg-orange-600'
];

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const INITIAL_STUDENTS: Student[] = [];

export const ARCHIVED_INITIAL_STUDENTS: Student[] = [
  // Prep Section A students matching screenshot
  { id: 'S0087', name: 'Amna', family: 'Adeel Ali', familyId: 'F-0038', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 302 3456703', admissionDate: '2025-01-20' },
  { id: 'S0076', name: 'Fiza', family: 'Ali Raza', familyId: 'F0090', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 315 6789016', admissionDate: '2025-01-16' },
  { id: 'S0077', name: 'Fiza', family: 'Ali Raza', familyId: 'F0092', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 315 6789016', admissionDate: '2025-01-16' },
  { id: 'S0082', name: 'Fiza', family: 'Ali Raza', familyId: 'F0094', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 314 5678915', admissionDate: '2025-01-15' },
  { id: 'S0103', name: 'Usman', family: 'Hassan Khan', familyId: 'F-0010', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 324 5678925', admissionDate: '2025-01-10' },
  { id: 'S0094', name: 'ahsan', family: 'hassan', familyId: 'F0103', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 325 6789026', admissionDate: '2025-01-12' },
  { id: 'S0090', name: 'alisha', family: 'waseeem', familyId: 'F0099', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 301 2345602', admissionDate: '2025-01-14' },
  { id: 'S0074', name: 'amna', family: 'Mushtaq', familyId: 'F0181', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 309 0123410', admissionDate: '2025-01-18' },
  { id: 'S0102', name: 'amna', family: 'Ali Iqbal', familyId: 'F-0009', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 312 3456713', admissionDate: '2025-01-19' },
  { id: 'S0100', name: 'arslan', family: 'Ali', familyId: 'F0100', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 309 0123410', admissionDate: '2025-01-05' },
  { id: 'S0075', name: 'esha', family: 'hassan', familyId: 'F0089', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 325 6789026', admissionDate: '2025-01-21' },
  { id: 'S0086', name: 'shumail', family: 'Adeel Ali', familyId: 'F-0038', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 302 3456703', admissionDate: '2025-01-20' },
  { id: 'S0052', name: 'Fiza', family: 'Ali Raza', familyId: 'F-0016', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 314 5678915', admissionDate: '2025-01-15' },
  { id: 'S0051', name: 'Fiza', family: 'Ali Raza', familyId: 'F-0012', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 315 6789016', admissionDate: '2025-01-16' },
  { id: 'S0049', name: 'Fiza', family: 'Ali Raza', familyId: 'F-0012', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 315 6789016', admissionDate: '2025-01-16' },
  { id: 'S0080', name: 'arslan', family: 'Ali', familyId: 'F-0100', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 309 0123410', admissionDate: '2025-01-05' },

  // Class 2 Section A students
  { id: 'S0107', name: 'Adeel Mirza', family: 'Adeel Ali', familyId: 'F-0038', class: 'Class 2', section: 'A', status: 'Active', bloodGroup: 'AB+', phone: '+92 302 3456703', admissionDate: '2024-09-01' },
  { id: 'S0109', name: 'SAMINA', family: 'M Luqman', familyId: 'F-0093', class: 'Class 2', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 334 5678935', admissionDate: '2024-09-02' },
  { id: 'S0112', name: 'Hassan Ali', family: 'Ali Raza', familyId: 'F-0012', class: 'Class 2', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 315 6789016', admissionDate: '2024-09-03' },
  { id: 'S0115', name: 'Zainab Bibi', family: 'Tariq Mehmood', familyId: 'F-0045', class: 'Class 2', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 305 6789006', admissionDate: '2024-09-04' },
  { id: 'S0118', name: 'Bilal Khan', family: 'Hassan Khan', familyId: 'F-0010', class: 'Class 2', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 324 5678925', admissionDate: '2024-09-05' },
  { id: 'S0122', name: 'Ayesha Noor', family: 'Noor Muhammad', familyId: 'F-0078', class: 'Class 2', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 310 1234511', admissionDate: '2024-09-06' },
  { id: 'S0125', name: 'Hamza Malik', family: 'Malik Asif', familyId: 'F-0088', class: 'Class 2', section: 'A', status: 'Active', bloodGroup: 'AB+', phone: '+92 318 9012319', admissionDate: '2024-09-07' },

  { id: 'S-00101', name: 'mariyam', family: 'gulzar', familyId: 'F-0080', class: 'testing class', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 300 1234501', admissionDate: '2025-08-15' },
  { id: 'S-0085', name: 'Alisha', family: 'ALI', familyId: 'F-0097', class: 'Class 6', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 301 2345602', admissionDate: '2024-03-10' },
  { id: 'S-00106', name: 'Omar Mirza', family: 'Adeel Mirza', familyId: 'F-0113', class: 'Class 9', section: 'A', status: 'Active', bloodGroup: 'B-', phone: '+92 303 4567804', admissionDate: '2023-04-12' },
  { id: 'S-0058', name: 'eman', family: 'Ahmad', familyId: 'F-0168', class: 'Class 3', section: 'A', status: 'Active', bloodGroup: 'O-', phone: '+92 304 5678905', admissionDate: '2024-08-11' },
  { id: 'S-0096', name: 'ali', family: 'Ahmad', familyId: 'F-0104', class: 'Class 9', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 305 6789006', admissionDate: '2023-09-05' },
  { id: 'S-00166', name: 'Anam Ali', family: 'Ahmed Ali', familyId: 'F-0132', class: 'Class 6', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 306 7890107', admissionDate: '2024-03-22' },
  { id: 'S-00117', name: 'Hassan Javed', family: 'Ahmed Javed', familyId: 'F-0014', class: 'Nursery', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 307 8901208', admissionDate: '2025-02-14' },
  { id: 'S-0179', name: 'Ali', family: 'Ahsan', familyId: 'F-0070', class: 'Class 1', section: 'A', status: 'Active', bloodGroup: 'A-', phone: '+92 308 9012309', admissionDate: '2024-11-03' },
  { id: 'S-0080', name: 'arslan', family: 'Ali', familyId: 'F-0100', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 309 0123410', admissionDate: '2025-01-05' },
  { id: 'S-0082', name: 'numan', family: 'Ali Chaudhry', familyId: 'F-0062', class: 'one', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 310 1234511', admissionDate: '2024-10-18' },
  { id: 'S0081', name: 'HAMID', family: 'Ali Iqbal', familyId: 'F-0009', class: 'Class 3', section: 'A', status: 'Active', bloodGroup: 'AB+', phone: '+92 311 2345612', admissionDate: '2024-04-14' },
  { id: 'S0064', name: 'Aiman', family: 'Ali Iqbal', familyId: 'F-0009', class: 'test class', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 312 3456713', admissionDate: '2024-05-19' },
  { id: 'S-00010', name: 'Fatima Iqbal', family: 'Ali Iqbal', familyId: 'F-0009', class: 'Nursery', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 312 3456713', admissionDate: '2025-02-01' },
  { id: 'S-00181', name: 'Ayesha Khan', family: 'Ali Khan', familyId: 'F-0127', class: 'Class 6', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 313 4567814', admissionDate: '2024-02-12' },
  { id: 'S-0052', name: 'Fiza', family: 'Ali Raza', familyId: 'F-0016', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 314 5678915', admissionDate: '2025-01-15' },
  { id: 'S-0051', name: 'Fiza', family: 'Ali Raza', familyId: 'F-0012', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 315 6789016', admissionDate: '2025-01-16' },
  { id: 'S-0049', name: 'Fiza', family: 'Ali Raza', familyId: 'F-0012', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 315 6789016', admissionDate: '2025-01-16' },
  { id: 'S-00028', name: 'Sana Siddiqui', family: 'Ali Siddiqui', familyId: 'F-0066', class: 'Class 3', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 316 7890117', admissionDate: '2024-06-01' },
  { id: 'S-0084', name: 'Faisal', family: 'Aslam', familyId: 'F-0096', class: 'Class 9', section: 'A', status: 'Active', bloodGroup: 'A-', phone: '+92 317 8901218', admissionDate: '2023-08-20' },
  { id: 'S-00129', name: 'Faisal Iqbal', family: 'Bilal Iqbal', familyId: 'F-0101', class: 'Class 5', section: 'A', status: 'Active', bloodGroup: 'AB+', phone: '+92 318 9012319', admissionDate: '2024-05-09' },
  { id: 'S-00130', name: 'Komal Dar', family: 'Faisal Dar', familyId: 'F-0102', class: 'Class 5', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 319 0123420', admissionDate: '2024-05-11' },
  { id: 'S-00008', name: 'Iqra Shah', family: 'Faisal Shah', familyId: 'F-0059', class: 'Class 3', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 320 1234521', admissionDate: '2024-07-22' },
  { id: 'S-0175', name: 'X student', family: 'Family X', familyId: 'F-0196', class: 'Class 5', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 321 2345622', admissionDate: '2024-09-15' },
  { id: 'S-0077', name: 'Ali Butt', family: 'Hassan Chaudhry', familyId: 'F-0067', class: 'Class 3', section: 'A', status: 'Active', bloodGroup: 'O-', phone: '+92 322 3456723', admissionDate: '2024-04-18' },
  { id: 'S-0076', name: 'Usman Chaudhry', family: 'Hassan Chaudhry', familyId: 'F-0067', class: 'Class 3', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 322 3456723', admissionDate: '2024-04-18' },
  { id: 'S-00087', name: 'Talha Iqbal', family: 'Hassan Iqbal', familyId: 'F-0058', class: 'Class 3', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 323 4567824', admissionDate: '2024-06-12' },
  { id: 'S-0059', name: 'Batool', family: 'Hassan Khan', familyId: 'F-0010', class: 'Class 3', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 324 5678925', admissionDate: '2024-07-01' },
  { id: 'S-00089', name: 'Iqra Malik', family: 'Hassan Khan', familyId: 'F-0010', class: 'Class 3', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 324 5678925', admissionDate: '2024-07-01' },
  { id: 'S-00011', name: 'Faisal Khan', family: 'Hassan Khan', familyId: 'F-0010', class: 'Nursery', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 324 5678925', admissionDate: '2025-02-10' },
  { id: 'S-0092', name: 'rahim', family: 'Hassan Khan', familyId: 'F-0076', class: 'Class 8', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 325 6789026', admissionDate: '2023-11-20' },
  { id: 'S-0066', name: 'Anam Khan', family: 'Hassan Khan', familyId: 'F-0010', class: 'Class 3', section: 'A', status: 'Active', bloodGroup: 'AB+', phone: '+92 324 5678925', admissionDate: '2024-07-02' },
  { id: 'S-00095', name: 'Maryam Shah', family: 'Hassan Shah', familyId: 'F-0046', class: 'Class 4', section: 'B', status: 'Active', bloodGroup: 'O+', phone: '+92 326 7890127', admissionDate: '2024-05-30' },
  { id: 'S-00120', name: 'Rabia Siddiqui', family: 'Hassan Siddiqui', familyId: 'F-0095', class: 'Class 4', section: 'B', status: 'Active', bloodGroup: 'A+', phone: '+92 327 8901228', admissionDate: '2024-06-15' },
  { id: 'S-00187', name: 'Nimra Siddiqui', family: 'Ibrahim Siddiqui', familyId: 'F-0148', class: 'Class 9', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 328 9012329', admissionDate: '2023-09-12' },
  { id: 'S-00191', name: 'Sidra Hussain', family: 'Imran Hussain', familyId: 'F-0152', class: 'Class 9', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 329 0123430', admissionDate: '2023-08-19' },
  { id: 'S-00048', name: 'Anam Raza', family: 'Imran Raza', familyId: 'F-0060', class: 'Class 3', section: 'A', status: 'Active', bloodGroup: 'A-', phone: '+92 330 1234531', admissionDate: '2024-07-10' },
  { id: 'S-00050', name: 'Zainab Raza', family: 'Imran Raza', familyId: 'F-0070', class: 'Class 3', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 331 2345632', admissionDate: '2024-07-11' },
  { id: 'S-00184', name: 'Talha Ahmed', family: 'Junaid Ahmed', familyId: 'F-0159', class: 'Class 5', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 332 3456733', admissionDate: '2024-04-20' },
  { id: 'S-00133', name: 'Rizwan Iqbal', family: 'Junaid Iqbal', familyId: 'F-0103', class: 'Class 5', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 333 4567834', admissionDate: '2024-05-18' },
  { id: 'S-00109', name: 'SAMINA', family: 'M Luqman', familyId: 'F-0093', class: 'Class 2', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 334 5678935', admissionDate: '2024-09-02' },
  { id: 'S-0079', name: 'JAMEEL', family: 'M Luqman', familyId: 'F-0093', class: 'Nursery', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 334 5678935', admissionDate: '2025-02-18' },
  { id: 'S-0078', name: 'M ALI', family: 'M Luqman', familyId: 'F-0093', class: 'pG', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 334 5678935', admissionDate: '2025-02-18' },
  { id: 'S-0074', name: 'amna', family: 'Mushtaq', familyId: 'F-0181', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 335 6789036', admissionDate: '2025-01-22' },
  { id: 'S-00091', name: 'Sidra Abbasi', family: 'Omar Abbasi', familyId: 'F-0078', class: 'Class 3', section: 'A', status: 'Active', bloodGroup: 'B-', phone: '+92 336 7890137', admissionDate: '2024-06-25' },
  { id: 'S-00006', name: 'Sara Awan', family: 'Omar Awan', familyId: 'F-0057', class: 'Class 3', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 337 8901238', admissionDate: '2024-07-05' },
  { id: 'S-00007', name: 'Imran Awan', family: 'Omar Awan', familyId: 'F-0057', class: 'Class 2', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 337 8901238', admissionDate: '2024-09-12' },
  { id: 'S-00065', name: 'Zain Malik', family: 'Omar Malik', familyId: 'F-0036', class: 'Class 6', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 338 9012339', admissionDate: '2024-03-15' },
  { id: 'S-00056', name: 'Zainab Malik', family: 'Omar Malik', familyId: 'F-0047', class: 'Class 2', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 339 0123440', admissionDate: '2024-08-28' },
  { id: 'S-00164', name: 'Omar Malik', family: 'Omar Malik', familyId: 'F-0130', class: 'Class 6', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 340 1234541', admissionDate: '2024-03-19' },
  { id: 'S-0073', name: 'mateen', family: 'Rafy', familyId: 'F-0085', class: 'Class 7', section: 'A', status: 'Active', bloodGroup: 'AB+', phone: '+92 341 2345642', admissionDate: '2024-01-10' },
  { id: 'S-0070', name: 'hamna', family: 'Rafy', familyId: 'F-0085', class: 'Class 7', section: 'A', status: 'Active', bloodGroup: 'AB+', phone: '+92 341 2345642', admissionDate: '2024-01-10' },
  { id: 'S-0088', name: 'amna', family: 'Raza', familyId: 'F-0183', class: 'one', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 342 3456743', admissionDate: '2024-10-22' },
  { id: 'S-00031', name: 'Talha Khan', family: 'Rizwan Khan', familyId: 'F-0018', class: 'Class 2', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 343 4567844', admissionDate: '2024-09-08' },
  { id: 'S-00003', name: 'Junaid Siddiqui', family: 'Rizwan Siddiqui', familyId: 'F-0048', class: 'Class 2', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 344 5678945', admissionDate: '2024-09-10' },
  { id: 'S-00185', name: 'Hassan Ali', family: 'Saad Ali', familyId: 'F-0155', class: 'Class 9', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 345 6789046', admissionDate: '2023-08-25' },
  { id: 'S-00131', name: 'Maryam Mirza', family: 'Saad Mirza', familyId: 'F-0113', class: 'Class 6', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 346 7890147', admissionDate: '2024-03-08' },
  { id: 'S-0213', name: 'Hamza Ali', family: 'Sara Ali', familyId: 'F-0170', class: 'Class 6', section: 'A', status: 'Active', isNewAdmission: true, bloodGroup: 'B+', phone: '+92 347 8901248', admissionDate: '2026-08-01' },
  { id: 'S-0214', name: 'Zoya Ali', family: 'Sara Ali', familyId: 'F-0170', class: 'Class 4', section: 'B', status: 'Active', isNewAdmission: true, bloodGroup: 'B+', phone: '+92 347 8901248', admissionDate: '2026-08-01' },
  { id: 'S-00159', name: 'Maira Awan', family: 'Shahid Awan', familyId: 'F-0125', class: 'Class 6', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 348 9012349', admissionDate: '2024-02-18' },
  { id: 'S-00072', name: 'Waqar Butt', family: 'Shahid Butt', familyId: 'F-0087', class: 'Class 3', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 349 0123450', admissionDate: '2024-06-18' },
  { id: 'S-0018', name: '575g', family: 'Shehryar Khan', familyId: 'F-0184', class: 'Nursery', section: 'A', status: 'Active', bloodGroup: 'O-', phone: '+92 350 1234551', admissionDate: '2025-02-05' },
  { id: 'S-00186', name: 'Noor Ahmed', family: 'Talha Ahmed', familyId: 'F-0149', class: 'Class 9', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 351 2345652', admissionDate: '2023-09-01' },
  { id: 'S-00122', name: 'Alina Ali', family: 'Talha Bajwa', familyId: 'F-0083', class: 'Class 4', section: 'B', status: 'Active', bloodGroup: 'A+', phone: '+92 352 3456753', admissionDate: '2024-06-20' },
  { id: 'S-00036', name: 'Saad Bajwa', family: 'Talha Bajwa', familyId: 'F-0081', class: 'Class 3', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 353 4567854', admissionDate: '2024-07-15' },
  { id: 'S-0083', name: 'Syeda Hadia', family: 'Tauqeer Shah', familyId: 'F-0095', class: 'Nursery', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 354 5678955', admissionDate: '2025-01-30' },
  { id: 'S-0089', name: 'Test 1', family: 'Test', familyId: 'F-0098', class: 'Class 1', section: 'A', status: 'Inactive', bloodGroup: 'AB+', phone: '+92 355 6789056', admissionDate: '2024-01-10' },
  { id: 'S-00162', name: 'Omar Chaudhry', family: 'Usman Chaudhry', familyId: 'F-0128', class: 'Class 6', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 356 7890157', admissionDate: '2024-02-28' },
  { id: 'S-00094', name: 'Shahid Hussain', family: 'Usman Hussain', familyId: 'F-0079', class: 'Class 3', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 357 8901258', admissionDate: '2024-06-22' },
  { id: 'S-00114', name: 'Shahid Shah', family: 'Usman Shah', familyId: 'F-0084', class: 'Class 5', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 358 9012359', admissionDate: '2024-05-02' },
  { id: 'S-00140', name: 'Waqar Raza', family: 'Waqar Raza', familyId: 'F-0015', class: 'Nursery', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 359 0123460', admissionDate: '2025-02-12' },
  { id: 'S-00123', name: 'Sara Rehman', family: 'Waqar Rehman', familyId: 'F-0097', class: 'Class 4', section: 'B', status: 'Active', bloodGroup: 'O+', phone: '+92 360 1234561', admissionDate: '2024-06-18' },
  { id: 'S-00183', name: 'Imran Dar', family: 'Zain Dar', familyId: 'F-0154', class: 'Class 9', section: 'A', status: 'Active', bloodGroup: 'A-', phone: '+92 361 2345662', admissionDate: '2023-08-30' },
  { id: 'S-00134', name: 'Hira Javed', family: 'Zain Javed', familyId: 'F-0106', class: 'Class 5', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 362 3456763', admissionDate: '2024-05-14' },
  { id: 'S-0068', name: 'numan', family: 'ahsan', familyId: 'F-0084', class: 'Class 7', section: 'A', status: 'Inactive', bloodGroup: 'O+', phone: '+92 363 4567864', admissionDate: '2024-01-15' },
  { id: 'S-0069', name: 'ali ahsan', family: 'ahsan', familyId: 'F-0084', class: 'Class 7', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 363 4567864', admissionDate: '2024-01-15' },
  { id: 'S-0067', name: 'faiza', family: 'ahsan', familyId: 'F-0087', class: 'Class 7', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 364 5678965', admissionDate: '2024-01-18' },
  { id: 'S-0271', name: 'numan', family: 'ali', familyId: 'F-0213', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 365 6789066', admissionDate: '2025-01-28' },
  { id: 'S-0270', name: 'ahsan', family: 'ali', familyId: 'F-0213', class: 'Class 2', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 365 6789066', admissionDate: '2024-09-05' },
  { id: 'S-0063', name: 'efedfe', family: 'asdfd', familyId: 'F-0081', class: 'Class 9', section: 'A', status: 'Active', bloodGroup: 'O-', phone: '+92 366 7890167', admissionDate: '2023-09-18' },
  { id: 'S-0272', name: 'amna', family: 'hammad', familyId: 'F-0063', class: 'class 1st', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 367 8901268', admissionDate: '2024-10-12' },
  { id: 'S-0075', name: 'esha', family: 'hassan', familyId: 'F-0089', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 368 9012369', admissionDate: '2025-01-19' },
  { id: 'S-0094', name: 'ahsan', family: 'hassan', familyId: 'F-0103', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'AB+', phone: '+92 369 0123470', admissionDate: '2025-01-24' },
  { id: 'S-0093', name: 'fiza', family: 'hassan', familyId: 'F-0094', class: 'Class 7', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 370 1234571', admissionDate: '2024-01-20' },
  { id: 'S-005', name: 'awi', family: 'hrmm', familyId: 'F-0082', class: 'testing class', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 371 2345672', admissionDate: '2025-08-10' },
  { id: 'S-0062', name: 'esha', family: 'imran', familyId: 'F-0078', class: 'class 1st', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 372 3456773', admissionDate: '2024-10-14' },
  { id: 'S-0061', name: 'Fatima', family: 'murtaza', familyId: 'F-0079', class: 'Class 1st', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 373 4567874', admissionDate: '2024-10-15' },
  { id: 'S-0266', name: 'Fatima', family: 'numan ali', familyId: 'F-0203', class: 'class hello 1', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 374 5678975', admissionDate: '2024-11-05' },
  { id: 'S-0268', name: 'Abrar', family: 'numan ali', familyId: 'F-0203', class: 'class hello 1', section: 'A', status: 'Active', isNewAdmission: true, bloodGroup: 'A+', phone: '+92 374 5678975', admissionDate: '2026-08-15' },
  { id: 'S-0267', name: 'ali', family: 'numan ali', familyId: 'F-0203', class: 'class hello 1', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 374 5678975', admissionDate: '2024-11-06' },
  { id: 'S-0269', name: 'naima', family: 'numan ali', familyId: 'F-0203', class: 'class hello 1', section: 'A', status: 'Active', isNewAdmission: true, bloodGroup: 'O+', phone: '+92 374 5678975', admissionDate: '2026-08-15' },
  { id: 'S-0071', name: 'naeem asif', family: 'sanaullah', familyId: 'F-0102', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'AB+', phone: '+92 375 6789076', admissionDate: '2025-01-26' },
  { id: 'S-0091', name: 'Aman', family: 'sanaullah', familyId: 'F-0101', class: 'Nursery', section: 'A', status: 'Active', bloodGroup: 'A+', phone: '+92 376 7890177', admissionDate: '2025-02-15' },
  { id: 'S-0097', name: 'safan', family: 'usama', familyId: 'F-0105', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'B+', phone: '+92 377 8901278', admissionDate: '2025-01-27' },
  { id: 'S-0090', name: 'alisha', family: 'waseem', familyId: 'F-0099', class: 'Prep', section: 'A', status: 'Active', bloodGroup: 'O+', phone: '+92 378 9012379', admissionDate: '2025-01-29' }
];
