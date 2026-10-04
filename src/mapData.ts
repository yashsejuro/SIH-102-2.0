// Precomputed exact SVG bounding boxes for all 36 Indian States and Union Territories in @svg-maps/india
export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export const STATE_BBOXES: Record<string, BBox> = {
  'Andaman and Nicobar Islands': { minX: 503, minY: 521.7, maxX: 539.3, maxY: 695.7, width: 36.3, height: 174, centerX: 521.2, centerY: 608.7 },
  'Andhra Pradesh': { minX: 179.5, minY: 428.4, maxX: 347, maxY: 571.1, width: 167.5, height: 142.7, centerX: 263.3, centerY: 499.8 },
  'Arunachal Pradesh': { minX: 489, minY: 190.8, maxX: 611.9, maxY: 257.5, width: 122.9, height: 66.8, centerX: 550.5, centerY: 224.2 },
  'Assam': { minX: 450.2, minY: 226.3, maxX: 582.6, maxY: 315.9, width: 132.4, height: 89.6, centerX: 516.4, centerY: 271.1 },
  'Bihar': { minX: 316.8, minY: 237.2, maxX: 420.9, maxY: 312.6, width: 104.1, height: 75.3, centerX: 368.9, centerY: 274.9 },
  'Chandigarh': { minX: 178, minY: 158.4, maxX: 180.9, maxY: 161.5, width: 2.9, height: 3.2, centerX: 179.5, centerY: 160 },
  'Chhattisgarh': { minX: 252.4, minY: 316.8, maxX: 339.2, maxY: 458.7, width: 86.8, height: 141.9, centerX: 295.8, centerY: 387.8 },
  'Dadra and Nagar Haveli': { minX: 99.2, minY: 401.6, maxX: 105.5, maxY: 408.5, width: 6.4, height: 6.9, centerX: 102.4, centerY: 405.1 },
  'Daman and Diu': { minX: 52.1, minY: 387.5, maxX: 56.8, maxY: 394.2, width: 4.7, height: 6.7, centerX: 54.5, centerY: 390.9 },
  'Delhi': { minX: 181, minY: 204.7, maxX: 191.6, maxY: 216.1, width: 10.5, height: 11.4, centerX: 186.3, centerY: 210.4 },
  'Goa': { minX: 115, minY: 502.3, maxX: 128.9, maxY: 521.9, width: 13.8, height: 19.6, centerX: 122, centerY: 512.1 },
  'Gujarat': { minX: 0, minY: 302.9, maxX: 131.7, maxY: 406.9, width: 131.7, height: 104, centerX: 65.9, centerY: 354.9 },
  'Haryana': { minX: 131.4, minY: 155.2, maxX: 196.9, maxY: 233.9, width: 65.5, height: 78.8, centerX: 164.2, centerY: 194.6 },
  'Himachal Pradesh': { minX: 154.7, minY: 97.5, maxX: 226.3, maxY: 168.5, width: 71.5, height: 70.9, centerX: 190.5, centerY: 133 },
  'Jammu and Kashmir': { minX: 92.7, minY: 0, maxX: 252.5, maxY: 122, width: 159.8, height: 122, centerX: 172.6, centerY: 61 },
  'Jharkhand': { minX: 316.9, minY: 288, maxX: 414.2, maxY: 365.5, width: 97.3, height: 77.4, centerX: 365.6, centerY: 326.8 },
  'Karnataka': { minX: 123.7, minY: 444, maxX: 217.5, maxY: 593.4, width: 93.8, height: 149.4, centerX: 170.6, centerY: 518.7 },
  'Kerala': { minX: 139.9, minY: 567.3, maxX: 192.8, maxY: 663.1, width: 52.9, height: 95.8, centerX: 166.4, centerY: 615.2 },
  'Lakshadweep': { minX: 82, minY: 590.6, maxX: 115.5, maxY: 663.8, width: 33.5, height: 73.2, centerX: 98.8, centerY: 627.2 },
  'Madhya Pradesh': { minX: 122.4, minY: 252.4, maxX: 306.1, maxY: 385.6, width: 183.7, height: 133.2, centerX: 214.3, centerY: 319 },
  'Maharashtra': { minX: 93.5, minY: 364.1, maxX: 266, maxY: 506.5, width: 172.5, height: 142.3, centerX: 179.8, centerY: 435.3 },
  'Manipur': { minX: 518.9, minY: 279.9, maxX: 556, maxY: 322.8, width: 37, height: 42.8, centerX: 537.5, centerY: 301.4 },
  'Meghalaya': { minX: 452.9, minY: 270.1, maxX: 515.3, maxY: 295.4, width: 62.4, height: 25.3, centerX: 484.1, centerY: 282.8 },
  'Mizoram': { minX: 503.9, minY: 307.2, maxX: 528.7, maxY: 366, width: 24.8, height: 58.8, centerX: 516.3, centerY: 336.6 },
  'Nagaland': { minX: 526.4, minY: 248.4, maxX: 566.4, maxY: 291.4, width: 40, height: 43, centerX: 546.4, centerY: 269.9 },
  'Odisha': { minX: 276.3, minY: 352, maxX: 403.9, maxY: 458.3, width: 127.6, height: 106.4, centerX: 340.1, centerY: 405.2 },
  'Puducherry': { minX: 239.9, minY: 481.4, maxX: 295.4, maxY: 609.6, width: 55.6, height: 128.2, centerX: 267.7, centerY: 545.5 },
  'Punjab': { minX: 119, minY: 114.5, maxX: 183, maxY: 188.8, width: 64, height: 74.2, centerX: 151, centerY: 151.7 },
  'Rajasthan': { minX: 27.2, minY: 173.1, maxX: 210.9, maxY: 340.6, width: 183.8, height: 167.5, centerX: 119.1, centerY: 256.9 },
  'Sikkim': { minX: 415.1, minY: 222.7, maxX: 434.1, maxY: 247.5, width: 19, height: 24.8, centerX: 424.6, centerY: 235.1 },
  'Tamil Nadu': { minX: 168.3, minY: 551.2, maxX: 254.5, maxY: 667.8, width: 86.2, height: 116.5, centerX: 211.4, centerY: 609.5 },
  'Telangana': { minX: 189.4, minY: 411.5, maxX: 284.8, maxY: 501.6, width: 95.4, height: 90.1, centerX: 237.1, centerY: 456.6 },
  'Tripura': { minX: 480.9, minY: 307.1, maxX: 505.6, maxY: 343, width: 24.7, height: 35.9, centerX: 493.3, centerY: 325.1 },
  'Uttar Pradesh': { minX: 186.3, minY: 167.8, maxX: 344.2, maxY: 322, width: 158, height: 154.2, centerX: 265.3, centerY: 244.9 },
  'Uttarakhand': { minX: 196.3, minY: 141.9, maxX: 268.6, maxY: 208.7, width: 72.4, height: 66.8, centerX: 232.5, centerY: 175.3 },
  'West Bengal': { minX: 369.3, minY: 244.3, maxX: 454.1, maxY: 375.1, width: 84.8, height: 130.8, centerX: 411.7, centerY: 309.7 },
};

export const STATE_DISTRICTS: Record<string, string[]> = {
  'Andhra Pradesh': ['Guntur', 'Krishna', 'Visakhapatnam'],
  'Assam': ['Kamrup', 'Jorhat', 'Dibrugarh'],
  'Bihar': ['Patna', 'Gaya', 'Muzaffarpur'],
  'Chhattisgarh': ['Raipur', 'Durg', 'Bilaspur'],
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara'],
  'Haryana': ['Gurugram', 'Hisar', 'Karnal'],
  'Jharkhand': ['Ranchi', 'Dhanbad', 'East Singhbhum'],
  'Karnataka': ['Bengaluru Urban', 'Mysuru', 'Belagavi'],
  'Madhya Pradesh': ['Bhopal', 'Indore', 'Jabalpur'],
  'Maharashtra': ['Pune', 'Nagpur', 'Nashik'],
  'Odisha': ['Cuttack', 'Puri', 'Ganjam'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur'],
  'Tamil Nadu': ['Chennai', 'Madurai', 'Coimbatore'],
  'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad'],
  'Uttar Pradesh': ['Lucknow', 'Varanasi', 'Prayagraj'],
  'West Bengal': ['Kolkata', 'Howrah', 'Darjeeling'],
};

// Known normalized geographic coordinates (relative to state bounding box: rx: 0..1, ry: 0..1)
export const DISTRICT_GEO_OFFSETS: Record<string, Record<string, { rx: number; ry: number }>> = {
  'Maharashtra': {
    'Nashik': { rx: 0.35, ry: 0.34 },
    'Pune': { rx: 0.36, ry: 0.65 },
    'Nagpur': { rx: 0.82, ry: 0.28 },
    'Mumbai': { rx: 0.16, ry: 0.50 },
    'Thane': { rx: 0.22, ry: 0.46 },
    'Aurangabad': { rx: 0.48, ry: 0.42 },
    'Solapur': { rx: 0.52, ry: 0.76 },
    'Kolhapur': { rx: 0.30, ry: 0.86 },
    'Amravati': { rx: 0.68, ry: 0.30 },
  },
  'Karnataka': {
    'Belagavi': { rx: 0.32, ry: 0.22 },
    'Bengaluru Urban': { rx: 0.78, ry: 0.80 },
    'Mysuru': { rx: 0.52, ry: 0.88 },
    'Dharwad': { rx: 0.38, ry: 0.36 },
    'Kalaburagi': { rx: 0.68, ry: 0.18 },
    'Mangaluru': { rx: 0.24, ry: 0.72 },
    'Shivamogga': { rx: 0.36, ry: 0.56 },
  },
  'Uttar Pradesh': {
    'Lucknow': { rx: 0.48, ry: 0.48 },
    'Varanasi': { rx: 0.84, ry: 0.70 },
    'Prayagraj': { rx: 0.68, ry: 0.72 },
    'Kanpur': { rx: 0.42, ry: 0.55 },
    'Agra': { rx: 0.22, ry: 0.42 },
    'Meerut': { rx: 0.18, ry: 0.22 },
    'Gorakhpur': { rx: 0.82, ry: 0.44 },
    'Bareilly': { rx: 0.36, ry: 0.30 },
  },
  'Tamil Nadu': {
    'Chennai': { rx: 0.82, ry: 0.18 },
    'Coimbatore': { rx: 0.24, ry: 0.58 },
    'Madurai': { rx: 0.48, ry: 0.74 },
    'Tiruchirappalli': { rx: 0.56, ry: 0.58 },
    'Salem': { rx: 0.46, ry: 0.42 },
    'Tirunelveli': { rx: 0.38, ry: 0.90 },
  },
  'Gujarat': {
    'Ahmedabad': { rx: 0.58, ry: 0.48 },
    'Surat': { rx: 0.68, ry: 0.82 },
    'Vadodara': { rx: 0.74, ry: 0.60 },
    'Rajkot': { rx: 0.32, ry: 0.54 },
    'Bhavnagar': { rx: 0.48, ry: 0.66 },
    'Kutch': { rx: 0.24, ry: 0.28 },
  },
  'Rajasthan': {
    'Jaipur': { rx: 0.64, ry: 0.44 },
    'Jodhpur': { rx: 0.34, ry: 0.52 },
    'Udaipur': { rx: 0.44, ry: 0.82 },
    'Kota': { rx: 0.76, ry: 0.72 },
    'Bikaner': { rx: 0.38, ry: 0.30 },
    'Ajmer': { rx: 0.50, ry: 0.52 },
  },
  'West Bengal': {
    'Kolkata': { rx: 0.64, ry: 0.78 },
    'Howrah': { rx: 0.52, ry: 0.76 },
    'Darjeeling': { rx: 0.48, ry: 0.10 },
    'Siliguri': { rx: 0.55, ry: 0.16 },
    'Asansol': { rx: 0.35, ry: 0.60 },
    'Murshidabad': { rx: 0.58, ry: 0.50 },
  },
  'Bihar': {
    'Patna': { rx: 0.48, ry: 0.55 },
    'Gaya': { rx: 0.50, ry: 0.80 },
    'Muzaffarpur': { rx: 0.52, ry: 0.35 },
    'Bhagalpur': { rx: 0.84, ry: 0.62 },
    'Darbhanga': { rx: 0.64, ry: 0.36 },
  },
  'Madhya Pradesh': {
    'Bhopal': { rx: 0.46, ry: 0.52 },
    'Indore': { rx: 0.28, ry: 0.65 },
    'Jabalpur': { rx: 0.72, ry: 0.54 },
    'Gwalior': { rx: 0.50, ry: 0.18 },
    'Ujjain': { rx: 0.32, ry: 0.56 },
  },
  'Telangana': {
    'Hyderabad': { rx: 0.45, ry: 0.60 },
    'Warangal': { rx: 0.72, ry: 0.45 },
    'Nizamabad': { rx: 0.45, ry: 0.25 },
    'Karimnagar': { rx: 0.62, ry: 0.32 },
    'Khammam': { rx: 0.78, ry: 0.70 },
  },
  'Andhra Pradesh': {
    'Visakhapatnam': { rx: 0.86, ry: 0.24 },
    'Krishna': { rx: 0.58, ry: 0.62 },
    'Guntur': { rx: 0.50, ry: 0.72 },
    'Kurnool': { rx: 0.26, ry: 0.70 },
    'Tirupati': { rx: 0.55, ry: 0.90 },
  },
  'Assam': {
    'Kamrup': { rx: 0.35, ry: 0.56 },
    'Jorhat': { rx: 0.66, ry: 0.46 },
    'Dibrugarh': { rx: 0.88, ry: 0.30 },
    'Silchar': { rx: 0.52, ry: 0.85 },
  },
  'Haryana': {
    'Gurugram': { rx: 0.68, ry: 0.80 },
    'Hisar': { rx: 0.32, ry: 0.54 },
    'Karnal': { rx: 0.64, ry: 0.30 },
    'Faridabad': { rx: 0.76, ry: 0.84 },
    'Ambala': { rx: 0.60, ry: 0.16 },
  },
  'Odisha': {
    'Cuttack': { rx: 0.70, ry: 0.46 },
    'Puri': { rx: 0.74, ry: 0.62 },
    'Ganjam': { rx: 0.46, ry: 0.82 },
    'Bhubaneswar': { rx: 0.68, ry: 0.52 },
    'Sambalpur': { rx: 0.32, ry: 0.38 },
  },
  'Jharkhand': {
    'Ranchi': { rx: 0.48, ry: 0.58 },
    'Dhanbad': { rx: 0.78, ry: 0.46 },
    'East Singhbhum': { rx: 0.82, ry: 0.86 },
    'Bokaro': { rx: 0.68, ry: 0.50 },
  },
  'Chhattisgarh': {
    'Raipur': { rx: 0.50, ry: 0.52 },
    'Durg': { rx: 0.38, ry: 0.56 },
    'Bilaspur': { rx: 0.55, ry: 0.35 },
    'Bastar': { rx: 0.46, ry: 0.85 },
  },
};

// Calculate SVG coordinate point for a district given the state bounding box
export function getDistrictCoordinates(
  stateName: string,
  districtName: string,
  index: number,
  totalCount: number
): { x: number; y: number } {
  const bbox = STATE_BBOXES[stateName] || {
    minX: 100, minY: 100, maxX: 400, maxY: 400, width: 300, height: 300, centerX: 250, centerY: 250
  };

  const knownState = DISTRICT_GEO_OFFSETS[stateName];
  if (knownState && knownState[districtName]) {
    const { rx, ry } = knownState[districtName];
    return {
      x: bbox.minX + bbox.width * rx,
      y: bbox.minY + bbox.height * ry,
    };
  }

  // Automatic harmonious distribution inside state territory
  if (totalCount <= 1) {
    return { x: bbox.centerX, y: bbox.centerY };
  }

  // Distribute along an elliptical ring with proportional radius
  const angle = (2 * Math.PI * index) / totalCount - Math.PI / 2;
  const radiusX = bbox.width * 0.32;
  const radiusY = bbox.height * 0.32;

  return {
    x: bbox.centerX + radiusX * Math.cos(angle),
    y: bbox.centerY + radiusY * Math.sin(angle),
  };
}

// Generate smooth polygon path for district territory cell
export function generateDistrictCellPath(
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
  index: number
): string {
  // Elliptical polygon with organic variation
  const points: [number, number][] = [];
  const segments = 16;
  const seed = (index * 7 + 13) % 17;

  for (let s = 0; s < segments; s++) {
    const theta = (2 * Math.PI * s) / segments;
    // slight organic perturbation based on index
    const wobble = 1 + 0.12 * Math.sin(theta * 3 + seed);
    const px = cx + radiusX * wobble * Math.cos(theta);
    const py = cy + radiusY * wobble * Math.sin(theta);
    points.push([px, py]);
  }

  return 'M ' + points.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L ') + ' Z';
}
