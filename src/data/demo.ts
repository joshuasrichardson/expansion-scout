/**
 * Guaranteed demo dataset — the fictional Utah-County taco truck and the nearby
 * candidate places it could grow into. This is the seed the whole flow can fall
 * back to so the demo survives airplane mode (CLAUDE.md).
 *
 * Coordinates cluster around Provo/Orem so every pin fits one map region.
 */

import type { BusinessProfileInput, PlaceCandidate } from '@/services/gemmaTypes';

export const demoBusiness: BusinessProfileInput = {
  name: 'Tacos El Scout',
  type: 'taco truck',
  description: 'Family-run birria and street tacos, currently parked near downtown Provo.',
  city: 'Provo, UT',
  latitude: 40.2338,
  longitude: -111.6585,
  serviceRadiusMiles: 12,
  availability: 'Weekdays 10a–8p, some Saturdays',
  goals: ['Land recurring/steady revenue', 'Fill slow weekday afternoons'],
  capabilities: ['Batch catering up to 150 people', 'Cashless payments', 'Fast 3-minute service'],
};

export const demoCandidates: PlaceCandidate[] = [
  {
    id: 'c1',
    name: 'Canyon Tech Campus',
    category: 'lunch',
    latitude: 40.2712,
    longitude: -111.6835,
    address: '2200 N University Pkwy, Provo',
    distanceMiles: 2.8,
    context: 'office park · ~400 employees, few nearby lunch options',
  },
  {
    id: 'c2',
    name: 'Slate Canyon Brewing',
    category: 'partnership',
    latitude: 40.2205,
    longitude: -111.6402,
    address: '155 W Center St, Provo',
    distanceMiles: 1.9,
    context: 'taproom with a patio and no kitchen',
  },
  {
    id: 'c3',
    name: 'Riverwoods Corporate Events',
    category: 'catering',
    latitude: 40.3021,
    longitude: -111.665,
    address: '4801 N University Ave, Provo',
    distanceMiles: 4.6,
    context: 'hosts frequent all-hands lunches',
  },
  {
    id: 'c4',
    name: 'Utah Valley Sports Complex',
    category: 'event',
    latitude: 40.2966,
    longitude: -111.695,
    address: '620 N 2000 W, Orem',
    distanceMiles: 5.3,
    context: 'weekend tournaments, hundreds of families',
  },
  {
    id: 'c5',
    name: 'Wolverine Crossing Apartments',
    category: 'partnership',
    latitude: 40.2841,
    longitude: -111.7159,
    address: '1830 S State St, Orem',
    distanceMiles: 6.1,
    context: '600 units, student-heavy, hosts resident nights',
  },
  {
    id: 'c6',
    name: 'Provo Beach Resort',
    category: 'event',
    latitude: 40.2543,
    longitude: -111.6721,
    address: '4801 N University Ave, Provo',
    distanceMiles: 3.4,
    context: 'birthday parties & corporate outings',
  },
];
