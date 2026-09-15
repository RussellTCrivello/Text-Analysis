import type { AppData } from '../types';

const now = new Date().toISOString();
const d = (offset: number) => new Date(Date.now() - offset * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

export const sampleData: AppData = {
  sources: [
    {
      id: 's1',
      name: 'Reuters News Agency',
      type: 'website',
      link_sources: 'https://www.reuters.com',
      importance: 0.95,
      country: 'United Kingdom',
      city: 'London',
      description: 'International news organization providing global coverage of events.',
      accounts: '@Reuters',
      note: 'Primary wire service for breaking news',
      ownership: 'Thomson Reuters Corporation',
      date_entry: d(30),
      date_creation: now,
      date_modified: now,
    },
    {
      id: 's2',
      name: 'Dr. Sarah Mitchell',
      type: 'person',
      link_sources: '',
      importance: 0.80,
      country: 'United States',
      city: 'Washington D.C.',
      description: 'Senior analyst at the Institute for Strategic Studies. Specializes in Middle East policy.',
      accounts: '',
      note: 'Interview conducted March 2025',
      ownership: '',
      date_entry: d(20),
      date_creation: now,
      date_modified: now,
    },
    {
      id: 's3',
      name: 'Al Jazeera Arabic',
      type: 'website',
      link_sources: 'https://www.aljazeera.net',
      importance: 0.78,
      country: 'Qatar',
      city: 'Doha',
      description: 'Arabic-language news channel covering regional and international events.',
      accounts: '@AJArabic',
      note: 'Primary Arabic source for regional analysis',
      ownership: 'Qatar Media Corporation',
      date_entry: d(25),
      date_creation: now,
      date_modified: now,
    },
    {
      id: 's4',
      name: 'Global Policy Institute',
      type: 'organization',
      link_sources: 'https://www.gpi.org',
      importance: 0.55,
      country: 'Belgium',
      city: 'Brussels',
      description: 'Independent think tank producing policy research and analysis reports.',
      accounts: '',
      note: '',
      ownership: 'Non-profit',
      date_entry: d(15),
      date_creation: now,
      date_modified: now,
    },
    {
      id: 's5',
      name: 'Foreign Affairs Journal',
      type: 'publication',
      link_sources: 'https://www.foreignaffairs.com',
      importance: 0.82,
      country: 'United States',
      city: 'New York',
      description: 'Leading journal on international relations and foreign policy.',
      accounts: '',
      note: 'Peer-reviewed quarterly publication',
      ownership: 'Council on Foreign Relations',
      date_entry: d(10),
      date_creation: now,
      date_modified: now,
    },
  ],
  contents: [
    {
      id: 'c1',
      sources_id: 's1',
      title: 'Regional Security Developments in Q1 2025',
      content_data: 'A comprehensive analysis of security developments across the region. Key figures include Minister James Harrison, General Amira Khalil, and Ambassador Chen Wei. The events took place primarily in Baghdad, Ankara, and Cairo. Increased diplomatic activity was observed between Turkey and Iraq following the summit held in Ankara on 15 January 2025. Coordinates for the summit venue: 39.9208, 32.8541.',
      attachments: 'report_q1_2025.pdf',
      note: 'Cross-reference with source s3 for regional perspective',
      importance: 0.90,
      date_content: d(5),
      date_creation: now,
      date_modified: now,
    },
    {
      id: 'c2',
      sources_id: 's2',
      title: 'Interview: The Shifting Alliances in North Africa',
      content_data: 'Dr. Mitchell discusses the realignment of political alliances in North Africa. She names Ahmed Al-Rashidi and Fatima Benali as key political figures driving the change. Locations mentioned include Tripoli, Tunis, and Algiers. She emphasizes that the economic factors originating in Cairo and extending to Casablanca are central to understanding the shifts.',
      attachments: '',
      note: 'Recorded interview, transcript verified',
      importance: 0.75,
      date_content: d(12),
      date_creation: now,
      date_modified: now,
    },
    {
      id: 'c3',
      sources_id: 's3',
      title: 'Economic Forum Outcomes: Gulf Cooperation Council',
      content_data: 'The GCC economic forum concluded with agreements on joint infrastructure investment. Participants included Crown Prince Abdullah, Finance Minister Khalid Al-Turki, and economist Dr. Noura Hassan. Key locations: Riyadh, Abu Dhabi, and Kuwait City. The forum took place at the Riyadh International Convention Center (coordinates: 24.7136, 46.6753).',
      attachments: 'gcc_forum_summary.docx',
      note: 'Translation from Arabic required for full text',
      importance: 0.70,
      date_content: d(8),
      date_creation: now,
      date_modified: now,
    },
    {
      id: 'c4',
      sources_id: 's4',
      title: 'Policy Brief: Climate Security Nexus in Sub-Saharan Africa',
      content_data: 'This policy brief examines the intersection of climate change and security threats in Sub-Saharan Africa. Key researchers: Prof. Kwame Mensah, Dr. Aisha Diallo. Focus regions: Sahel zone, Lake Chad Basin, Horn of Africa. The brief references data collection sites near coordinates 13.5137, 2.1098 (Niamey) and 12.3645, 43.1456 (Djibouti).',
      attachments: 'policy_brief_v2.pdf',
      note: 'Published February 2025',
      importance: 0.50,
      date_content: d(18),
      date_creation: now,
      date_modified: now,
    },
    {
      id: 'c5',
      sources_id: 's5',
      title: 'The New Multipolar Order: Emerging Power Dynamics',
      content_data: 'Analysis of how emerging economies are reshaping the global order. Key figures mentioned: Secretary-General Maria Santos, Ambassador Rajesh Patel, and strategist Dr. Li Wei. Discussions took place in Geneva, New York, and Singapore. The article references the UN headquarters (coordinates: 40.7489, -73.9680) and the Singapore International Mediation Centre (1.2966, 103.8559).',
      attachments: '',
      note: 'Feature article, volume 104 issue 2',
      importance: 0.85,
      date_content: d(3),
      date_creation: now,
      date_modified: now,
    },
  ],
  analyses: [
    {
      id: 'a1',
      content_id: 'c1',
      classification: 'Security / Diplomacy',
      list_names_people: 'James Harrison, Amira Khalil, Chen Wei',
      list_names_places: 'Baghdad, Ankara, Cairo',
      list_coordinates: '39.9208, 32.8541',
      list_sides: 'Turkish Government; Iraqi Ministry of Defense; UN Observers',
      date_analysis: d(4),
      date_creation: now,
      date_modified: now,
    },
    {
      id: 'a2',
      content_id: 'c2',
      classification: 'Political Analysis',
      list_names_people: 'Sarah Mitchell, Ahmed Al-Rashidi, Fatima Benali',
      list_names_places: 'Tripoli, Tunis, Algiers, Cairo, Casablanca',
      list_coordinates: '',
      list_sides: 'North African Union; Opposition Coalitions',
      date_analysis: d(10),
      date_creation: now,
      date_modified: now,
    },
    {
      id: 'a3',
      content_id: 'c3',
      classification: 'Economic / Trade',
      list_names_people: 'Crown Prince Abdullah, Khalid Al-Turki, Noura Hassan',
      list_names_places: 'Riyadh, Abu Dhabi, Kuwait City',
      list_coordinates: '24.7136, 46.6753',
      list_sides: 'GCC Member States; Arab Investment Fund',
      date_analysis: d(7),
      date_creation: now,
      date_modified: now,
    },
    {
      id: 'a4',
      content_id: 'c4',
      classification: 'Environmental Security',
      list_names_people: 'Kwame Mensah, Aisha Diallo',
      list_names_places: 'Sahel Zone, Lake Chad Basin, Niamey, Djibouti',
      list_coordinates: '13.5137, 2.1098',
      list_sides: 'African Union Commission; UNEP; World Food Programme',
      date_analysis: d(15),
      date_creation: now,
      date_modified: now,
    },
    {
      id: 'a5',
      content_id: 'c5',
      classification: 'Geopolitics',
      list_names_people: 'Maria Santos, Rajesh Patel, Li Wei',
      list_names_places: 'Geneva, New York, Singapore',
      list_coordinates: '40.7489, -73.9680',
      list_sides: 'G20 Working Group; ASEAN; UN Security Council',
      date_analysis: d(2),
      date_creation: now,
      date_modified: now,
    },
  ],
};

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function extractPeopleFromText(text: string): string[] {
  const titlePattern = /\b(?:Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|General|Ambassador|Minister|Secretary|Crown Prince|President|Director)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/g;
  const names: Set<string> = new Set();
  let match;
  while ((match = titlePattern.exec(text)) !== null) names.add(match[0].trim());
  const capPattern = /\b([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
  while ((match = capPattern.exec(text)) !== null) {
    const c = match[1];
    if (!['The ', 'This ', 'That ', 'Their ', 'These ', 'Those '].some(w => c.startsWith(w))) names.add(c);
  }
  return Array.from(names).slice(0, 10);
}

export function extractPlacesFromText(text: string): string[] {
  const known = ['Baghdad','Ankara','Cairo','Tripoli','Tunis','Algiers','Riyadh','Abu Dhabi','Kuwait City','Geneva','New York','Singapore','London','Washington','Brussels','Doha','Tehran','Beirut','Amman','Damascus','Istanbul','Moscow','Beijing','Paris','Berlin','Tokyo','Dubai','Niamey','Djibouti'];
  const found: Set<string> = new Set();
  for (const p of known) if (text.includes(p)) found.add(p);
  return Array.from(found).slice(0, 10);
}

export function extractCoordinatesFromText(text: string): string {
  const m = /(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/.exec(text);
  return m ? `${m[1]}, ${m[2]}` : '';
}
