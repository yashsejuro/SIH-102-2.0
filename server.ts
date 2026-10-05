import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createHash } from 'crypto';

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Setup multer for file uploads
const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 },
  storage: multer.memoryStorage(),
});

// --- Types & Data Structures ---
interface User {
  id: number;
  name: string;
  email: string;
  identity_id: string;
  role: 'MINISTRY' | 'STATE_NODAL_AUTHORITY' | 'DISTRICT_AUTHORITY' | 'MEMBER_OF_PARLIAMENT';
  status: string;
  scope_type: string;
  scope_id?: string;
  scope_state?: string;
  permissions: string[];
  password?: string;
}

interface Project {
  id: number;
  project_name: string;
  project_code: string;
  state: string;
  district: string;
  constituency: string;
  category: string;
  agency: string;
  sanction_amount: number;
  expenditure: number;
  utilization_ratio: number;
  expected_completion_date: string;
  actual_completion_date: string;
  anomaly_score: number;
  normalized_ml_score: number;
  ml_anomaly_flag: boolean;
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'DATA_QUALITY_REVIEW';
  status: string;
  delay_days: number;
  peer_median: number;
  contextual_cost_deviation: number;
  reasons: string[];
  primary_reason: string;
  signal_components: Record<string, number>;
  duplicate_flag: boolean;
  source_datasets: string[];
  vendor_name: string;
  payment_status: string;
  mp_name: string;
  allocation_limit: number;
  calamity_type?: string;
  calamity_name?: string;
  consent_date?: string;
  consent_amount?: number;
}

interface Alert {
  id: number;
  project_id: number;
  project_name: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  state: string;
  district: string;
}

interface AuditCase {
  id: number;
  project_id: number;
  title: string;
  priority: string;
  status: string;
  notes?: string;
  assigned_authority?: string;
  created_at: string;
  updated_at: string;
}

interface AuditChecklist {
  [projectId: number]: {
    audit_status: string;
    checklist: Array<{ item: string; completed: boolean }>;
    dispositions: Record<string, { disposition: string; reason: string; evidence: string }>;
  };
}

// --- Seed Users ---
const users: User[] = [
  {
    id: 1,
    name: 'Ministry Demo',
    email: 'ministry.demo',
    identity_id: 'MINISTRY-DEMO',
    role: 'MINISTRY',
    status: 'ACTIVE',
    scope_type: 'NATIONAL',
    permissions: ['projects:read', 'audit:write', 'dataset:upload', 'analysis:read', 'analysis:manage', 'users:manage', 'audit:integrity', 'security:read', 'security:manage'],
    password: 'password123',
  },
  {
    id: 2,
    name: 'Karnataka State Nodal Demo',
    email: 'karnataka.nodal.demo',
    identity_id: 'STATE-DEMO-KA',
    role: 'STATE_NODAL_AUTHORITY',
    status: 'ACTIVE',
    scope_type: 'STATE',
    scope_id: 'Karnataka',
    scope_state: 'Karnataka',
    permissions: ['projects:read', 'audit:write', 'analysis:read', 'users:manage:lower', 'security:read', 'users:manage'],
    password: 'password123',
  },
  {
    id: 3,
    name: 'Bengaluru Urban District Demo',
    email: 'bengaluru.district.demo',
    identity_id: 'DISTRICT-DEMO-BLR',
    role: 'DISTRICT_AUTHORITY',
    status: 'ACTIVE',
    scope_type: 'DISTRICT',
    scope_id: 'Bengaluru Urban',
    scope_state: 'Karnataka',
    permissions: ['projects:read', 'audit:write', 'analysis:read', 'security:read'],
    password: 'password123',
  },
  {
    id: 4,
    name: 'Demo Member of Parliament',
    email: 'mp.demo',
    identity_id: 'MP-DEMO-001',
    role: 'MEMBER_OF_PARLIAMENT',
    status: 'ACTIVE',
    scope_type: 'CONSTITUENCY',
    scope_id: 'Bengaluru Central',
    scope_state: 'Karnataka',
    permissions: ['projects:read', 'analysis:read'],
    password: 'password123',
  },
];

// --- Seed Seed Data Generator ---
const STATE_DISTRICTS: Record<string, string[]> = {
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

const CATEGORIES: Record<string, [number, number]> = {
  'Roads': [950000, 8],
  'Water Supply': [1600000, 10],
  'Education': [1250000, 12],
  'Health': [1450000, 9],
  'Sanitation': [750000, 7],
  'Community Infrastructure': [1100000, 14],
  'Calamity Relief': [2500000, 6],
  'Trust and Society': [1300000, 10],
  'Normal/Others': [850000, 8],
};

const AGENCIES = [
  'PWD',
  'Rural Development',
  'Urban Development',
  'Water Resources',
  'Health Department',
  'Education Department',
  'District Irrigation Dept',
];

const VENDORS = [
  'Apex Civil Infrastructure Ltd.',
  'National Highway Construction Co.',
  'Bharat Urban Engineering Corp.',
  'Shivalik Infra & Water Projects',
  'Pragati Building Works',
  'Hindustan Sanitary Works',
  'Kaveri Construction Syndicate',
  'Sunrise Public Contracting Ltd.',
  'Metro Civic Works Pvt Ltd',
  'Eastern Geo-Infra Partners',
];

const MP_NAMES = [
  'Hon. Rajesh Verma, MP',
  'Hon. Meenakshi Sundaram, MP',
  'Hon. Suresh Kumar Hegde, MP',
  'Hon. Sunita Devi, MP',
  'Hon. Amit Patel, MP',
  'Hon. Ananya Roy, MP',
  'Hon. Dr. K. Venkatraman, MP',
  'Hon. Balwinder Singh, MP',
];

function generateProjects(): Project[] {
  const list: Project[] = [];
  const stateKeys = Object.keys(STATE_DISTRICTS);
  const categoryKeys = Object.keys(CATEGORIES);

  // Deterministic generator with pseudo-random seed
  let seed = 42;
  function random() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  const patterns = [
    ...Array(115).fill('NORMAL'),
    ...Array(20).fill('DELAY'),
    ...Array(14).fill('COST_ANOMALY'),
    ...Array(12).fill('OVERRUN'),
    ...Array(8).fill('HIGH_UTILIZATION'),
    ...Array(6).fill('DUPLICATE'),
    ...Array(5).fill('DATA_QUALITY'),
  ];

  for (let i = 0; i < patterns.length; i++) {
    const id = i + 1;
    const pattern = patterns[i];
    let state = stateKeys[Math.floor(random() * stateKeys.length)];
    let districts = STATE_DISTRICTS[state];
    let district = districts[Math.floor(random() * districts.length)];
    let constituency = `${district} Parliamentary Constituency`;
    const category = categoryKeys[Math.floor(random() * categoryKeys.length)];
    const [baseAmount, baseMonths] = CATEGORIES[category];
    const agency = AGENCIES[Math.floor(random() * AGENCIES.length)];
    const vendor = VENDORS[Math.floor(random() * VENDORS.length)];
    let mp = MP_NAMES[Math.floor(random() * MP_NAMES.length)];

    // Seed predictable jurisdictions for realistic multi-tier RBAC demos
    if (id <= 25) {
      state = 'Karnataka';
      if (id <= 14) {
        district = 'Bengaluru Urban';
        if (id <= 8) {
          constituency = 'Bengaluru Central';
          mp = 'Shri P. C. Mohan (MP, Bengaluru Central)';
        } else {
          constituency = 'Bengaluru South';
          mp = 'Hon. Suresh Kumar Hegde, MP';
        }
      } else if (id <= 20) {
        district = 'Mysuru';
        constituency = 'Mysuru Parliamentary Constituency';
        mp = 'Hon. Suresh Kumar Hegde, MP';
      } else {
        district = 'Belagavi';
        constituency = 'Belagavi Parliamentary Constituency';
        mp = 'Hon. Meenakshi Sundaram, MP';
      }
    }

    let sanction = Math.round((baseAmount * (0.7 + random() * 0.7)) / 1000) * 1000;
    let utilRatio = 0.45 + random() * 0.45;
    let delayDays = Math.floor(random() * 25);
    let name = `${category} Improvement Scheme ${id.toString().padStart(3, '0')}`;

    if (pattern === 'DELAY') {
      delayDays = 120 + Math.floor(random() * 260);
      utilRatio = 0.55 + random() * 0.35;
    } else if (pattern === 'COST_ANOMALY') {
      sanction = Math.round((baseAmount * (2.8 + random() * 2.2)) / 1000) * 1000;
      utilRatio = 0.65 + random() * 0.3;
    } else if (pattern === 'OVERRUN') {
      utilRatio = 1.12 + random() * 0.38;
      delayDays = 45 + Math.floor(random() * 90);
    } else if (pattern === 'HIGH_UTILIZATION') {
      utilRatio = 0.98 + random() * 0.08;
    } else if (pattern === 'DUPLICATE') {
      name = `Community Hall Renovation Phase ${Math.ceil(id / 2)}`;
      utilRatio = 0.75 + random() * 0.2;
    }

    const expenditure = Math.round((sanction * utilRatio) / 1000) * 1000;
    const actualRatio = expenditure / (sanction || 1);

    // Compute composite risk score (0 - 100)
    let score = 15;
    const reasons: string[] = [];

    if (actualRatio > 1.05) {
      const excess = Math.round((actualRatio - 1) * 100);
      score += 35;
      reasons.push(`Expenditure exceeds sanctioned ceiling by ${excess}%`);
    } else if (actualRatio > 0.98) {
      score += 15;
      reasons.push('Expenditure is right at 100% of sanctioned ceiling');
    }

    if (delayDays > 180) {
      score += 30;
      reasons.push(`Extended project delay of ${delayDays} days past approved deadline`);
    } else if (delayDays > 60) {
      score += 18;
      reasons.push(`Project delayed by ${delayDays} days`);
    }

    if (sanction > baseAmount * 2.5) {
      score += 25;
      reasons.push('Sanction amount significantly exceeds historical category median');
    }

    if (pattern === 'DUPLICATE') {
      score += 20;
      reasons.push('High nomenclature and cost similarity with nearby scheme');
    }

    if (score < 20) {
      reasons.push('Normal expenditure and progress rhythm verified');
    }

    score = Math.min(Math.max(score, 8), 96);

    let risk_level: Project['risk_level'] = 'LOW';
    if (pattern === 'DATA_QUALITY') {
      risk_level = 'DATA_QUALITY_REVIEW';
      reasons.unshift('Incomplete or unverified documentation fields in source register');
    } else if (score >= 80) {
      risk_level = 'CRITICAL';
    } else if (score >= 60) {
      risk_level = 'HIGH';
    } else if (score >= 35) {
      risk_level = 'MEDIUM';
    }

    const sanctionYear = 2023 + (id % 3);
    const sanctionMonth = 1 + (id % 12);
    const sanctionDate = `${sanctionYear}-${sanctionMonth.toString().padStart(2, '0')}-15`;
    const expectedMonth = (sanctionMonth + baseMonths) % 12 || 12;
    const expectedYear = sanctionYear + Math.floor((sanctionMonth + baseMonths) / 12);
    const expectedDate = `${expectedYear}-${expectedMonth.toString().padStart(2, '0')}-28`;

    list.push({
      id,
      project_code: `MPLAD-${id.toString().padStart(4, '0')}`,
      project_name: name,
      state,
      district,
      constituency,
      category,
      agency,
      sanction_amount: sanction,
      expenditure,
      utilization_ratio: Number(actualRatio.toFixed(3)),
      expected_completion_date: expectedDate,
      actual_completion_date: `${expectedYear}-${expectedMonth.toString().padStart(2, '0')}-30`,
      anomaly_score: Number((score / 100).toFixed(3)),
      normalized_ml_score: Number((score / 100).toFixed(3)),
      ml_anomaly_flag: score >= 60,
      risk_score: Number(score.toFixed(1)),
      risk_level,
      status: delayDays > 45 ? 'Delayed' : 'Completed',
      delay_days: delayDays,
      peer_median: baseAmount,
      contextual_cost_deviation: Number((sanction / baseAmount).toFixed(2)),
      reasons,
      primary_reason: reasons[0] || 'Standard monitoring',
      signal_components: {
        delay_score_component: Number((Math.min(delayDays / 365, 1)).toFixed(2)),
        cost_overrun_score_component: actualRatio > 1 ? Number((Math.min((actualRatio - 1) * 2, 1)).toFixed(2)) : 0,
        peer_deviation_score_component: Number((Math.min(sanction / (baseAmount * 3), 1)).toFixed(2)),
        duplicate_score_component: pattern === 'DUPLICATE' ? 0.85 : 0.05,
        data_quality_score_component: pattern === 'DATA_QUALITY' ? 0.9 : 0.08,
      },
      duplicate_flag: pattern === 'DUPLICATE',
      source_datasets: ['Works Sanctioned.xlsx', 'Works Completed.xlsx', 'Expenditure Register.xlsx'],
      vendor_name: vendor,
      payment_status: actualRatio >= 1 ? '100% Disbursed' : 'In Progress',
      mp_name: mp,
      allocation_limit: 50000000,
    });
  }

  return list;
}

const projects: Project[] = generateProjects();

// Generate Alerts from High and Critical projects
let alerts: Alert[] = projects
  .filter(p => p.risk_level === 'CRITICAL' || p.risk_level === 'HIGH')
  .slice(0, 32)
  .map((p, idx) => ({
    id: idx + 1,
    project_id: p.id,
    project_name: p.project_name,
    severity: p.risk_level as 'CRITICAL' | 'HIGH',
    title: p.primary_reason,
    message: `${p.project_name} in ${p.district}, ${p.state} requires audit review: ${p.reasons.join('; ')}.`,
    state: p.state,
    district: p.district,
  }));

// In-memory Audit Cases
let auditCases: AuditCase[] = [
  {
    id: 1,
    project_id: projects[0].id,
    title: `Review: ${projects[0].project_name}`,
    priority: 'HIGH',
    status: 'OPEN',
    assigned_authority: 'District audit officer',
    notes: 'Initial triage performed. Site inspection scheduled.',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: 2,
    project_id: projects[5].id,
    title: `Review: ${projects[5].project_name}`,
    priority: 'CRITICAL',
    status: 'UNDER_REVIEW',
    assigned_authority: 'State Nodal Inspection Cell',
    notes: 'Checking expenditure vouchers against sanction limits.',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

const auditChecklists: AuditChecklist = {};

// Helper for Project Audit File
function getProjectAuditFile(projectId: number) {
  if (!auditChecklists[projectId]) {
    auditChecklists[projectId] = {
      audit_status: 'Not Reviewed',
      checklist: [
        { item: 'Approval papers', completed: false },
        { item: 'Bills and payment records', completed: false },
        { item: 'Completion proof', completed: false },
        { item: 'Site photographs', completed: false },
      ],
      dispositions: {},
    };
  }
  return auditChecklists[projectId];
}

// In-memory analysis runs
let activeRunId = 1;
const analysisRuns: Record<number, any> = {
  1: {
    id: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    summary: {
      rows_processed: 180,
      projects_created: 180,
      matched_completed: 165,
      matched_expenditure: 172,
      allocation_matched: 180,
      calamity_count: 14,
      conflicts: [],
      relationship: 'Joined across Sanction, Completion, and Expenditure registers using canonical project codes and location keys.',
      datasets: [
        {
          filename: 'Works Sanctioned.xlsx',
          file_type: 'xlsx',
          detected_role: 'SANCTIONED_WORKS',
          confidence: 96,
          selected_sheet: 'Sanctioned_Works',
          sheets: [{ sheet: 'Sanctioned_Works', rows: 180, role: 'SANCTIONED_WORKS', confidence: 96 }],
        },
        {
          filename: 'Works Completed.xlsx',
          file_type: 'xlsx',
          detected_role: 'COMPLETED_WORKS',
          confidence: 94,
          selected_sheet: 'Completed_Records',
          sheets: [{ sheet: 'Completed_Records', rows: 165, role: 'COMPLETED_WORKS', confidence: 94 }],
        },
        {
          filename: 'Expenditure Register.xlsx',
          file_type: 'xlsx',
          detected_role: 'EXPENDITURE',
          confidence: 91,
          selected_sheet: 'Disbursements',
          sheets: [{ sheet: 'Disbursements', rows: 172, role: 'EXPENDITURE', confidence: 91 }],
        },
      ],
    },
  },
};

// --- AUTH MIDDLEWARE & UTILS ---
function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ detail: 'Authentication required' });
  }
  const token = authHeader.substring(7);
  // Decode user id from base64 token or match
  try {
    const raw = Buffer.from(token, 'base64').toString('utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.exp && Date.now() > parsed.exp) {
      return res.status(401).json({ detail: 'Session expired. Please log in again.' });
    }
    const user = users.find(u => u.id === parsed.id || u.email === parsed.email);
    if (user && user.status === 'ACTIVE') {
      (req as any).user = user;
      return next();
    }
  } catch {
    // If not json, try to match by demo email
    const user = users.find(u => u.email === token || token.includes(u.email));
    if (user && user.status === 'ACTIVE') {
      (req as any).user = user;
      return next();
    }
  }
  return res.status(401).json({ detail: 'Invalid or expired session token.' });
}

function getAuthenticatedUser(req: Request): User | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  try {
    const raw = Buffer.from(token, 'base64').toString('utf-8');
    const parsed = JSON.parse(raw);
    const user = users.find(u => u.id === parsed.id || u.email === parsed.email);
    if (user && user.status === 'ACTIVE') return user;
  } catch {
    const user = users.find(u => u.email === token || token.includes(u.email));
    if (user && user.status === 'ACTIVE') return user;
  }
  return null;
}

// --- API ROUTES ---

// 1. Auth
app.post('/api/auth/login', (req, res) => {
  const { login, email, password, role, identity_id } = req.body;
  const identifier = (email || login || '').toLowerCase().trim();
  const identity = (identity_id || '').toLowerCase().trim();

  if (!identifier && !identity && !role) {
    return res.status(400).json({ detail: 'Credentials required.' });
  }

  // Find user by email or identity_id or role if unique
  let user = users.find(u =>
    (identifier && u.email.toLowerCase() === identifier) ||
    (identity && u.identity_id.toLowerCase() === identity)
  );

  if (!user && role) {
    if (identifier || identity) {
      user = users.find(u =>
        u.role === role &&
        ((identifier && u.email.toLowerCase() === identifier) ||
         (identity && u.identity_id.toLowerCase() === identity))
      );
    } else {
      user = users.find(u => u.role === role);
    }
  }

  if (!user) {
    return res.status(401).json({ detail: 'Invalid credentials. User account not found.' });
  }

  // Validate role if specified
  if (role && user.role !== role) {
    return res.status(401).json({ detail: 'Role does not match provisioned account.' });
  }

  // Validate identity_id if specified
  if (identity && user.identity_id.toLowerCase() !== identity) {
    return res.status(401).json({ detail: 'Invalid identity ID for this official account.' });
  }

  // Validate password
  const expectedPassword = user.password || 'password123';
  if (!password || password !== expectedPassword) {
    return res.status(401).json({ detail: 'Invalid password. Please check your credentials.' });
  }

  if (user.status !== 'ACTIVE') {
    return res.status(403).json({ detail: 'Account is pending activation. Please contact the administrator.' });
  }

  const tokenPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + 30 * 60 * 1000,
  };
  const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');

  res.json({
    access_token: token,
    token_type: 'bearer',
    expires_in: 1800,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      identity_id: user.identity_id,
      role: user.role,
      status: user.status,
      scope_type: user.scope_type,
      scope_id: user.scope_id,
      scope_state: user.scope_state,
      permissions: user.permissions,
    },
    demo_environment: true,
  });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json((req as any).user);
});

app.post('/api/auth/logout', (_req, res) => {
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/options', (_req, res) => {
  res.json({
    roles: ['MINISTRY', 'STATE_NODAL_AUTHORITY', 'DISTRICT_AUTHORITY', 'MEMBER_OF_PARLIAMENT'],
    demo_accounts: users.map(u => ({ email: u.email, role: u.role, name: u.name, scope: u.scope_id || 'National' })),
  });
});

app.get('/api/auth/users', authenticate, (_req, res) => {
  res.json({ items: users });
});

app.post('/api/auth/users', authenticate, (req, res) => {
  const { name, email, identity_id, role, state, scope_id, temporary_password } = req.body;
  if (!name || !email || !identity_id) {
    return res.status(400).json({ detail: 'Name, email, and identity ID are required.' });
  }
  const newUser: User = {
    id: users.length + 1,
    name,
    email,
    identity_id,
    role: role || 'STATE_NODAL_AUTHORITY',
    status: 'PENDING_ACTIVATION',
    scope_type: role === 'MINISTRY' ? 'NATIONAL' : role === 'STATE_NODAL_AUTHORITY' ? 'STATE' : 'DISTRICT',
    scope_id: scope_id || state,
    scope_state: state,
    permissions: ['projects:read', 'analysis:read'],
    password: temporary_password || 'password123',
  };
  users.push(newUser);
  res.json(newUser);
});

app.patch('/api/auth/users/:id', authenticate, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const user = users.find(u => u.id === id);
  if (!user) return res.status(404).json({ detail: 'User not found' });
  if (req.body.status) user.status = req.body.status;
  res.json(user);
});

app.get('/api/auth/audit-log/integrity', authenticate, (_req, res) => {
  res.json({
    status: 'VALID',
    total_records: 48,
    verified_records: 48,
    first_failure: null,
    chain_head: createHash('sha256').update('mplads_audit_chain_head').digest('hex'),
  });
});

// 2. Dashboard
app.get('/api/dashboard', (req, res) => {
  const authUser = getAuthenticatedUser(req);
  const stateFilter = (req.query.state as string) || '';
  const categoryFilter = (req.query.category as string) || '';
  const riskFilter = (req.query.risk_level as string) || '';

  // Determine base projects for user role (Role-Based Access Control)
  let baseProjects = projects;
  let jurisdictionScope: any = {
    role: authUser?.role || 'MINISTRY',
    scope_type: authUser?.scope_type || 'NATIONAL',
    scope_id: authUser?.scope_id || 'National',
    scope_title: 'National Oversight (All 16 States)',
    authority_title: 'Ministry of Statistics & Programme Implementation',
    default_state: '',
    default_district: '',
    is_national: true,
  };

  if (authUser?.role === 'STATE_NODAL_AUTHORITY') {
    const targetState = authUser.scope_state || authUser.scope_id || 'Karnataka';
    baseProjects = projects.filter(p => p.state && p.state.toLowerCase() === targetState.toLowerCase());
    jurisdictionScope = {
      role: 'STATE_NODAL_AUTHORITY',
      scope_type: 'STATE',
      scope_id: targetState,
      scope_state: targetState,
      scope_title: `State Jurisdiction: ${targetState} (State Nodal Cell)`,
      authority_title: `State Nodal Authority · Government of ${targetState}`,
      default_state: targetState,
      default_district: '',
      is_state: true,
    };
  } else if (authUser?.role === 'DISTRICT_AUTHORITY') {
    const targetDistrict = authUser.scope_id || 'Bengaluru Urban';
    baseProjects = projects.filter(p => p.district && p.district.toLowerCase() === targetDistrict.toLowerCase());
    jurisdictionScope = {
      role: 'DISTRICT_AUTHORITY',
      scope_type: 'DISTRICT',
      scope_id: targetDistrict,
      scope_state: authUser.scope_state || 'Karnataka',
      scope_title: `District Jurisdiction: ${targetDistrict} (${authUser.scope_state || 'Karnataka'})`,
      authority_title: `District Authority · Office of the Deputy Commissioner, ${targetDistrict}`,
      default_state: authUser.scope_state || 'Karnataka',
      default_district: targetDistrict,
      is_district: true,
    };
  } else if (authUser?.role === 'MEMBER_OF_PARLIAMENT') {
    const targetConstituency = authUser.scope_id || 'Bengaluru Central';
    baseProjects = projects.filter(p => p.constituency && p.constituency.toLowerCase() === targetConstituency.toLowerCase());
    jurisdictionScope = {
      role: 'MEMBER_OF_PARLIAMENT',
      scope_type: 'CONSTITUENCY',
      scope_id: targetConstituency,
      scope_state: authUser.scope_state || 'Karnataka',
      scope_title: `Parliamentary Constituency: ${targetConstituency}`,
      authority_title: `Office of the Member of Parliament · ${targetConstituency}`,
      default_state: authUser.scope_state || 'Karnataka',
      default_district: 'Bengaluru Urban',
      is_constituency: true,
      mp_name: 'Shri P. C. Mohan (MP, Bengaluru Central)',
    };
  }

  let filtered = baseProjects;
  if (stateFilter) filtered = filtered.filter(p => p.state === stateFilter);
  if (categoryFilter) filtered = filtered.filter(p => p.category === categoryFilter);
  if (riskFilter) filtered = filtered.filter(p => p.risk_level === riskFilter);

  const totalSanction = filtered.reduce((acc, p) => acc + p.sanction_amount, 0);
  const totalExpenditure = filtered.reduce((acc, p) => acc + p.expenditure, 0);
  const highRisk = filtered.filter(p => p.risk_level === 'HIGH').length;
  const critical = filtered.filter(p => p.risk_level === 'CRITICAL').length;

  const riskDist = {
    LOW: filtered.filter(p => p.risk_level === 'LOW').length,
    MEDIUM: filtered.filter(p => p.risk_level === 'MEDIUM').length,
    HIGH: highRisk,
    CRITICAL: critical,
    DATA_QUALITY_REVIEW: filtered.filter(p => p.risk_level === 'DATA_QUALITY_REVIEW').length,
  };

  // Scoped active alerts for role
  const scopedAlerts = authUser?.role === 'STATE_NODAL_AUTHORITY'
    ? alerts.filter(a => a.state && a.state.toLowerCase() === (authUser.scope_state || 'Karnataka').toLowerCase())
    : authUser?.role === 'DISTRICT_AUTHORITY' || authUser?.role === 'MEMBER_OF_PARLIAMENT'
    ? alerts.filter(a => a.district && a.district.toLowerCase() === (authUser.scope_id || 'Bengaluru Urban').toLowerCase())
    : alerts;

  // MP Allocation statutory quota data
  const mp_allocation = authUser?.role === 'MEMBER_OF_PARLIAMENT' ? {
    annual_quota: 50000000,
    total_sanctioned: totalSanction,
    total_expenditure: totalExpenditure,
    unspent_balance: Math.max(0, 50000000 - totalSanction),
    utilization_rate: totalSanction > 0 ? Number((totalExpenditure / totalSanction).toFixed(3)) : 0,
    works_recommended: filtered.length,
    completed_works: filtered.filter(p => p.status === 'Completed').length,
    in_progress_works: filtered.filter(p => p.status !== 'Completed').length,
    delayed_works: filtered.filter(p => p.delay_days > 45).length,
  } : null;

  // State wise aggregates
  const statesMap: Record<string, {
    projects: number;
    sanctioned: number;
    expenditure: number;
    riskSum: number;
    high_risk: number;
    critical: number;
    categories: Record<string, number>;
  }> = {};
  for (const p of filtered) {
    if (!statesMap[p.state]) {
      statesMap[p.state] = { projects: 0, sanctioned: 0, expenditure: 0, riskSum: 0, high_risk: 0, critical: 0, categories: {} };
    }
    const item = statesMap[p.state];
    item.projects += 1;
    item.sanctioned += p.sanction_amount;
    item.expenditure += p.expenditure;
    item.riskSum += p.risk_score;
    if (p.category) {
      item.categories[p.category] = (item.categories[p.category] || 0) + 1;
    }
    if (p.risk_level === 'HIGH') item.high_risk += 1;
    if (p.risk_level === 'CRITICAL') item.critical += 1;
  }
  const state_wise = Object.entries(statesMap).map(([name, data]) => ({
    name,
    projects: data.projects,
    sanctioned: data.sanctioned,
    total_sanctioned_amount: data.sanctioned,
    expenditure: data.expenditure,
    average_risk: data.projects ? Number((data.riskSum / data.projects).toFixed(1)) : 0,
    high_risk: data.high_risk,
    critical: data.critical,
    top_sectors: Object.entries(data.categories || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([sector, count]) => ({ sector, count })),
  })).sort((a, b) => b.average_risk - a.average_risk);

  // Category wise aggregates
  const categoryMap: Record<string, { projects: number; sanctioned: number; expenditure: number; riskSum: number }> = {};
  for (const p of filtered) {
    if (!categoryMap[p.category]) {
      categoryMap[p.category] = { projects: 0, sanctioned: 0, expenditure: 0, riskSum: 0 };
    }
    const item = categoryMap[p.category];
    item.projects += 1;
    item.sanctioned += p.sanction_amount;
    item.expenditure += p.expenditure;
    item.riskSum += p.risk_score;
  }
  const category_wise = Object.entries(categoryMap).map(([name, data]) => ({
    name,
    projects: data.projects,
    sanctioned: data.sanctioned,
    expenditure: data.expenditure,
    average_risk: data.projects ? Number((data.riskSum / data.projects).toFixed(1)) : 0,
  }));

  // Risk Score Distribution
  const risk_score_distribution = [
    { range: '0-20%', projects: filtered.filter(p => p.risk_score < 20).length },
    { range: '20-40%', projects: filtered.filter(p => p.risk_score >= 20 && p.risk_score < 40).length },
    { range: '40-60%', projects: filtered.filter(p => p.risk_score >= 40 && p.risk_score < 60).length },
    { range: '60-80%', projects: filtered.filter(p => p.risk_score >= 60 && p.risk_score < 80).length },
    { range: '80-100%', projects: filtered.filter(p => p.risk_score >= 80).length },
  ];

  // Utilization distribution
  const utilization_distribution = [
    { range: '0-25%', projects: filtered.filter(p => p.utilization_ratio < 0.25).length },
    { range: '25-50%', projects: filtered.filter(p => p.utilization_ratio >= 0.25 && p.utilization_ratio < 0.5).length },
    { range: '50-75%', projects: filtered.filter(p => p.utilization_ratio >= 0.5 && p.utilization_ratio < 0.75).length },
    { range: '75-100%', projects: filtered.filter(p => p.utilization_ratio >= 0.75 && p.utilization_ratio <= 1.0).length },
    { range: '>100%', projects: filtered.filter(p => p.utilization_ratio > 1.0).length },
  ];

  // Delay distribution
  const delay_distribution = [
    { range: 'On Time', projects: filtered.filter(p => p.delay_days <= 0).length },
    { range: '1-30 Days', projects: filtered.filter(p => p.delay_days > 0 && p.delay_days <= 30).length },
    { range: '31-90 Days', projects: filtered.filter(p => p.delay_days > 30 && p.delay_days <= 90).length },
    { range: '91-180 Days', projects: filtered.filter(p => p.delay_days > 90 && p.delay_days <= 180).length },
    { range: '>180 Days', projects: filtered.filter(p => p.delay_days > 180).length },
  ];

  // District wise aggregates
  const districtsMap: Record<string, {
    district: string;
    state: string;
    projects: number;
    sanctioned: number;
    expenditure: number;
    riskSum: number;
    high_risk: number;
    critical: number;
    categories: Record<string, number>;
    delays: number;
    anomalies: number;
  }> = {};

  for (const p of filtered) {
    const key = `${p.state}:::${p.district || 'Unassigned'}`;
    if (!districtsMap[key]) {
      districtsMap[key] = {
        district: p.district || 'Unassigned',
        state: p.state,
        projects: 0,
        sanctioned: 0,
        expenditure: 0,
        riskSum: 0,
        high_risk: 0,
        critical: 0,
        categories: {},
        delays: 0,
        anomalies: 0,
      };
    }
    const d = districtsMap[key];
    d.projects += 1;
    d.sanctioned += p.sanction_amount;
    d.expenditure += p.expenditure;
    d.riskSum += p.risk_score;
    if (p.category) d.categories[p.category] = (d.categories[p.category] || 0) + 1;
    if (p.risk_level === 'HIGH') d.high_risk += 1;
    if (p.risk_level === 'CRITICAL') d.critical += 1;
    if (p.delay_days && p.delay_days > 0) d.delays += 1;
    if (p.risk_score >= 50) d.anomalies += 1;
  }

  // If a state is selected, ensure all known districts for this state from STATE_DISTRICTS exist
  if (stateFilter && STATE_DISTRICTS[stateFilter]) {
    for (const dist of STATE_DISTRICTS[stateFilter]) {
      const key = `${stateFilter}:::${dist}`;
      if (!districtsMap[key]) {
        districtsMap[key] = {
          district: dist,
          state: stateFilter,
          projects: 0,
          sanctioned: 0,
          expenditure: 0,
          riskSum: 0,
          high_risk: 0,
          critical: 0,
          categories: {},
          delays: 0,
          anomalies: 0,
        };
      }
    }
  }

  const district_wise = Object.values(districtsMap).map(d => ({
    district: d.district,
    state: d.state,
    projects: d.projects,
    sanctioned: d.sanctioned,
    expenditure: d.expenditure,
    utilization_ratio: d.sanctioned > 0 ? Number((d.expenditure / d.sanctioned).toFixed(3)) : 0,
    average_risk: d.projects > 0 ? Number((d.riskSum / d.projects).toFixed(1)) : 0,
    high_risk: d.high_risk,
    critical: d.critical,
    risk_level: d.projects > 0 ? (
      (d.riskSum / d.projects) >= 70 ? 'CRITICAL' :
      (d.riskSum / d.projects) >= 50 ? 'HIGH' :
      (d.riskSum / d.projects) >= 30 ? 'MEDIUM' : 'LOW'
    ) : 'LOW',
    delays_count: d.delays,
    anomalies_count: d.anomalies,
    top_sectors: Object.entries(d.categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([sector, count]) => ({ sector, count })),
  })).sort((a, b) => b.average_risk - a.average_risk);

  const topProjects = [...filtered].sort((a, b) => b.risk_score - a.risk_score).slice(0, 10);
  const nationalRiskSum = filtered.reduce((acc, p) => acc + (p.risk_score || 0), 0);
  const nationalAverageRisk = filtered.length ? Number((nationalRiskSum / filtered.length).toFixed(1)) : 0;

  res.json({
    total_projects: filtered.length,
    total_sanction_amount: totalSanction,
    total_expenditure: totalExpenditure,
    total_utilization_ratio: totalSanction ? Number((totalExpenditure / totalSanction).toFixed(3)) : 0,
    national_average_risk: nationalAverageRisk,
    high_risk_projects: highRisk + critical,
    critical_projects: critical,
    active_alerts: scopedAlerts.length,
    risk_distribution: riskDist,
    alert_distribution: { CRITICAL: critical, HIGH: highRisk, MEDIUM: riskDist.MEDIUM },
    state_wise,
    district_wise,
    category_wise,
    risk_score_distribution,
    utilization_distribution,
    delay_distribution,
    last_analysis: new Date().toISOString(),
    model_status: 'Ready',
    dataset_status: 'Loaded',
    top_projects: topProjects,
    state_options: authUser?.role === 'STATE_NODAL_AUTHORITY' || authUser?.role === 'DISTRICT_AUTHORITY' || authUser?.role === 'MEMBER_OF_PARLIAMENT'
      ? [authUser.scope_state || 'Karnataka']
      : Object.keys(STATE_DISTRICTS).sort(),
    jurisdiction_scope: jurisdictionScope,
    mp_allocation,
  });
});

// 2b. District-Level Risk Intelligence
app.get('/api/districts', (req, res) => {
  const state = req.query.state as string;
  const districtQuery = (req.query.district as string || '').toLowerCase().trim();
  let filtered = projects;
  if (state) {
    filtered = filtered.filter(p => p.state === state);
  }
  if (districtQuery) {
    filtered = filtered.filter(p => p.district.toLowerCase() === districtQuery);
  }

  const districtsMap: Record<string, {
    district: string;
    state: string;
    projects: number;
    sanctioned: number;
    expenditure: number;
    riskSum: number;
    high_risk: number;
    critical: number;
    categories: Record<string, number>;
    delays: number;
    anomalies: number;
  }> = {};

  for (const p of filtered) {
    const key = `${p.state}:::${p.district || 'Unassigned'}`;
    if (!districtsMap[key]) {
      districtsMap[key] = {
        district: p.district || 'Unassigned',
        state: p.state,
        projects: 0,
        sanctioned: 0,
        expenditure: 0,
        riskSum: 0,
        high_risk: 0,
        critical: 0,
        categories: {},
        delays: 0,
        anomalies: 0,
      };
    }
    const d = districtsMap[key];
    d.projects += 1;
    d.sanctioned += p.sanction_amount;
    d.expenditure += p.expenditure;
    d.riskSum += p.risk_score;
    if (p.category) d.categories[p.category] = (d.categories[p.category] || 0) + 1;
    if (p.risk_level === 'HIGH') d.high_risk += 1;
    if (p.risk_level === 'CRITICAL') d.critical += 1;
    if (p.delay_days && p.delay_days > 0) d.delays += 1;
    if (p.risk_score >= 50) d.anomalies += 1;
  }

  if (state && STATE_DISTRICTS[state]) {
    for (const dist of STATE_DISTRICTS[state]) {
      const key = `${state}:::${dist}`;
      if (!districtsMap[key]) {
        districtsMap[key] = {
          district: dist,
          state,
          projects: 0,
          sanctioned: 0,
          expenditure: 0,
          riskSum: 0,
          high_risk: 0,
          critical: 0,
          categories: {},
          delays: 0,
          anomalies: 0,
        };
      }
    }
  }

  const result = Object.values(districtsMap).map(d => ({
    district: d.district,
    state: d.state,
    projects: d.projects,
    sanctioned: d.sanctioned,
    expenditure: d.expenditure,
    utilization_ratio: d.sanctioned > 0 ? Number((d.expenditure / d.sanctioned).toFixed(3)) : 0,
    average_risk: d.projects > 0 ? Number((d.riskSum / d.projects).toFixed(1)) : 0,
    high_risk: d.high_risk,
    critical: d.critical,
    risk_level: d.projects > 0 ? (
      (d.riskSum / d.projects) >= 70 ? 'CRITICAL' :
      (d.riskSum / d.projects) >= 50 ? 'HIGH' :
      (d.riskSum / d.projects) >= 30 ? 'MEDIUM' : 'LOW'
    ) : 'LOW',
    delays_count: d.delays,
    anomalies_count: d.anomalies,
    top_sectors: Object.entries(d.categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([sector, count]) => ({ sector, count })),
  })).sort((a, b) => b.average_risk - a.average_risk);

  res.json({ state: state || 'All', items: result, total: result.length });
});

// 3. Projects List & Details
app.get('/api/projects', (req, res) => {
  const authUser = getAuthenticatedUser(req);
  const page = parseInt(req.query.page as string, 10) || 1;
  const pageSize = parseInt(req.query.page_size as string, 10) || 50;
  const query = (req.query.search as string || '').toLowerCase().trim();
  const risk_level = req.query.risk_level as string;
  const state = req.query.state as string;
  const district = (req.query.district as string || '').toLowerCase().trim();
  const category = req.query.category as string;

  // Base projects based on RBAC jurisdiction
  let baseProjects = projects;
  if (authUser?.role === 'STATE_NODAL_AUTHORITY') {
    const targetState = authUser.scope_state || authUser.scope_id || 'Karnataka';
    baseProjects = projects.filter(p => p.state && p.state.toLowerCase() === targetState.toLowerCase());
  } else if (authUser?.role === 'DISTRICT_AUTHORITY') {
    const targetDistrict = authUser.scope_id || 'Bengaluru Urban';
    baseProjects = projects.filter(p => p.district && p.district.toLowerCase() === targetDistrict.toLowerCase());
  } else if (authUser?.role === 'MEMBER_OF_PARLIAMENT') {
    const targetConstituency = authUser.scope_id || 'Bengaluru Central';
    baseProjects = projects.filter(p => p.constituency && p.constituency.toLowerCase() === targetConstituency.toLowerCase());
  }

  let filtered = baseProjects;
  if (query) {
    filtered = filtered.filter(p =>
      p.project_name.toLowerCase().includes(query) ||
      p.project_code.toLowerCase().includes(query) ||
      p.state.toLowerCase().includes(query) ||
      p.district.toLowerCase().includes(query) ||
      p.constituency.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query) ||
      p.agency.toLowerCase().includes(query)
    );
  }
  if (risk_level) filtered = filtered.filter(p => p.risk_level === risk_level);
  if (state) filtered = filtered.filter(p => p.state === state);
  if (district) filtered = filtered.filter(p => p.district.toLowerCase() === district);
  if (category) filtered = filtered.filter(p => p.category === category);

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const records = filtered.slice(start, start + pageSize);

  const risk_counts = {
    LOW: filtered.filter(p => p.risk_level === 'LOW').length,
    MEDIUM: filtered.filter(p => p.risk_level === 'MEDIUM').length,
    HIGH: filtered.filter(p => p.risk_level === 'HIGH').length,
    CRITICAL: filtered.filter(p => p.risk_level === 'CRITICAL').length,
    DATA_QUALITY_REVIEW: filtered.filter(p => p.risk_level === 'DATA_QUALITY_REVIEW').length,
  };

  res.json({
    records,
    items: records,
    total,
    total_count: total,
    filtered_count: total,
    page,
    page_size: pageSize,
    risk_counts,
  });
});

app.get('/api/projects/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const project = projects.find(p => p.id === id);
  if (!project) return res.status(404).json({ detail: 'Project not found' });
  res.json(project);
});

app.get('/api/projects/:id/explanation', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const project = projects.find(p => p.id === id);
  if (!project) return res.status(404).json({ detail: 'Project not found' });

  const reasons = project.reasons.length ? project.reasons : ['Standard audit verification'];
  const verification = [
    'Administrative and technical sanction orders',
    'Itemized bills, contractor invoices, and measurement books',
    'Bank reconciliation and PFMS disbursement logs',
    'Final completion certificate signed by Executive Engineer',
    'Geo-tagged and time-stamped photographs of project site',
    'Citizen information board display evidence',
  ];

  res.json({
    project_id: project.id,
    why_flagged: reasons,
    primary_reason: project.primary_reason,
    recommended_verification: verification,
    risk_score: project.risk_score,
  });
});

app.get('/api/projects/:id/similar', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const project = projects.find(p => p.id === id);
  if (!project) return res.status(404).json({ detail: 'Project not found' });

  const similar = projects
    .filter(p => p.id !== project.id && (p.category === project.category || p.state === project.state))
    .slice(0, 10)
    .map(p => ({
      id: p.id,
      project_code: p.project_code,
      project_name: p.project_name,
      state: p.state,
      district: p.district,
      category: p.category,
      expenditure: p.expenditure,
      risk_level: p.risk_level,
      similarity: Math.floor(75 + (p.category === project.category ? 15 : 5) + (p.state === project.state ? 8 : 0)),
    }))
    .sort((a, b) => b.similarity - a.similarity);

  res.json({ items: similar });
});

app.get('/api/projects/:id/audit-file', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const auditFile = getProjectAuditFile(id);
  res.json(auditFile);
});

app.patch('/api/projects/:id/audit-status', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const auditFile = getProjectAuditFile(id);
  if (req.body.status) auditFile.audit_status = req.body.status;
  res.json(auditFile);
});

app.post('/api/projects/:id/documents/checklist', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { item, completed } = req.body;
  const auditFile = getProjectAuditFile(id);
  const entry = auditFile.checklist.find(c => c.item === item);
  if (entry) {
    entry.completed = Boolean(completed);
  } else {
    auditFile.checklist.push({ item, completed: Boolean(completed) });
  }
  res.json(auditFile);
});

app.post('/api/projects/:id/notes', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { notes } = req.body;
  const auditFile = getProjectAuditFile(id);
  auditFile.notes = typeof notes === 'string' ? notes : (notes || '');
  res.json(auditFile);
});

app.get('/api/projects/:id/compliance', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const project = projects.find(p => p.id === id);
  if (!project) return res.status(404).json({ detail: 'Project not found' });

  const items = [];
  if (project.expenditure > project.sanction_amount) {
    items.push({
      rule_code: 'MPLADS-RULE-01',
      title: 'Expenditure Exceeds Sanctioned Amount',
      severity: 'HIGH',
      explanation: `Total expenditure (${project.expenditure}) exceeds sanctioned amount (${project.sanction_amount}) by ₹${project.expenditure - project.sanction_amount}.`,
      recommended_action: 'Obtain sanction enhancement approval and revise technical estimate.',
    });
  }
  if (project.delay_days > 90) {
    items.push({
      rule_code: 'MPLADS-RULE-02',
      title: 'Project Completion Delayed Beyond Permissible Timeline',
      severity: 'MEDIUM',
      explanation: `Project has a delay of ${project.delay_days} days compared to planned completion schedule.`,
      recommended_action: 'Examine executing agency extension letters and penalty clauses.',
    });
  }
  if (project.duplicate_flag) {
    items.push({
      rule_code: 'MPLADS-RULE-03',
      title: 'Potential Duplicate Scheme Detected',
      severity: 'HIGH',
      explanation: 'Work description and sanctioned scope have significant overlap with another nearby work.',
      recommended_action: 'Cross-reference district project register to verify work separation.',
    });
  }
  if (project.category === 'Calamity Relief' && project.sanction_amount > 2500000) {
    items.push({
      rule_code: 'MPLADS-RULE-04',
      title: 'Calamity Allocation Threshold Verification',
      severity: 'MEDIUM',
      explanation: 'Works under Calamity Relief must conform strictly to prescribed state calamity parameters.',
      recommended_action: 'Verify State Disaster Management Authority recommendation.',
    });
  }

  res.json({ items });
});

app.get('/api/projects/:id/fraud-risk', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const project = projects.find(p => p.id === id);
  if (!project) return res.status(404).json({ detail: 'Project not found' });

  const signals = [];
  if (project.expenditure > project.sanction_amount * 1.1) {
    signals.push({
      signal_code: 'FR-EXP-01',
      title: 'Disproportionate Cost Escalation',
      severity: 'HIGH',
      confidence: 0.88,
      explanation: `Reported expenditure is ${(project.utilization_ratio * 100).toFixed(0)}% of the sanctioned estimate.`,
      recommended_verification: 'Inspect measurement books and contractor payment vouchers.',
    });
  }
  if (project.duplicate_flag) {
    signals.push({
      signal_code: 'FR-DUP-01',
      title: 'Coincident Scheme Proposal',
      severity: 'MEDIUM',
      confidence: 0.82,
      explanation: 'Identical nomenclature and fiscal attributes detected in same jurisdiction.',
      recommended_verification: 'Conduct physical on-site verification to verify work uniqueness.',
    });
  }
  if (project.delay_days > 180 && project.utilization_ratio > 0.9) {
    signals.push({
      signal_code: 'FR-TIM-01',
      title: 'Funds Disbursed Despite Prolonged Non-Completion',
      severity: 'HIGH',
      confidence: 0.91,
      explanation: 'Full disbursement recorded while work remained incomplete past original target.',
      recommended_verification: 'Audit milestone billing milestones against physical progress.',
    });
  }

  res.json({
    disclaimer: 'Potential fraud-risk signals require human verification and are not proof of wrongdoing.',
    signals,
  });
});

app.post('/api/projects/:id/fraud-risk/reviews', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { signal_code, disposition, decision_reason, evidence_reference } = req.body;
  const auditFile = getProjectAuditFile(id);
  auditFile.dispositions[signal_code] = {
    disposition,
    reason: decision_reason,
    evidence: evidence_reference,
  };
  res.json({ status: 'saved', audit_file: auditFile });
});

// 4. Compliance & Fraud Summaries
app.get('/api/compliance/summary', (_req, res) => {
  const totalFindings = 42;
  res.json({
    total_findings: totalFindings,
    by_severity: {
      CRITICAL: 6,
      HIGH: 18,
      MEDIUM: 14,
      LOW: 4,
    },
    items: [
      { rule_code: 'MPLADS-RULE-01', title: 'Expenditure Exceeds Sanction Limit', recommended_action: 'Audit physical bills against sanctioned scope' },
      { rule_code: 'MPLADS-RULE-02', title: 'Delayed Completion Beyond Permissible Timeline', recommended_action: 'Verify execution agency penalty clause' },
      { rule_code: 'MPLADS-RULE-03', title: 'High Single-Vendor Allocation Concentration', recommended_action: 'Investigate tender allotment and competitive bidding' },
      { rule_code: 'MPLADS-RULE-04', title: 'Duplicate Project Naming and Cost Proximity', recommended_action: 'Conduct site inspection to rule out ghost works' },
      { rule_code: 'MPLADS-RULE-05', title: 'Incomplete Asset Register Documentation', recommended_action: 'Request geotagged verification proofs from district' },
    ],
  });
});

app.get('/api/fraud-risk/summary', (_req, res) => {
  res.json({
    projects_with_signals: 24,
    project_splitting_count: 5,
    payment_timing_anomaly_count: 8,
    duplicate_payment_count: 3,
    repeated_work_count: 4,
    repeated_work_across_years_count: 2,
  });
});

app.get('/api/fraud-risk/vendors', (_req, res) => {
  const items = VENDORS.map((vendor, index) => {
    const vProjects = projects.filter(p => p.vendor_name === vendor);
    const count = vProjects.length;
    const highRiskCount = vProjects.filter(p => p.risk_level === 'HIGH').length;
    const criticalCount = vProjects.filter(p => p.risk_level === 'CRITICAL').length;
    const anomalyCount = vProjects.filter(p => p.ml_anomaly_flag).length;
    const districts = new Set(vProjects.map(p => p.district)).size;
    const agencies = new Set(vProjects.map(p => p.agency)).size;

    return {
      vendor,
      projects: count,
      concentration_percentage: Number(((count / projects.length) * 100).toFixed(1)),
      district_count: districts || 2,
      agency_count: agencies || 2,
      high_risk_count: highRiskCount,
      critical_count: criticalCount,
      anomaly_count: anomalyCount,
    };
  }).sort((a, b) => b.projects - a.projects);

  res.json({ items });
});

app.get('/api/integration/coverage', (_req, res) => {
  res.json({
    coverage_percentages: {
      'Works Sanctioned': 100,
      'Works Completed': 92,
      'Expenditure': 96,
      'MP Allocation': 100,
      'Calamity Relief': 85,
    },
    ambiguous_matches: [],
    unmatched_rows: [],
  });
});

// 5. Alerts
app.get('/api/alerts', (req, res) => {
  const authUser = getAuthenticatedUser(req);
  let filteredAlerts = alerts;

  if (authUser?.role === 'STATE_NODAL_AUTHORITY') {
    const targetState = authUser.scope_state || authUser.scope_id || 'Karnataka';
    filteredAlerts = alerts.filter(a => a.state && a.state.toLowerCase() === targetState.toLowerCase());
  } else if (authUser?.role === 'DISTRICT_AUTHORITY') {
    const targetDistrict = authUser.scope_id || 'Bengaluru Urban';
    filteredAlerts = alerts.filter(a => a.district && a.district.toLowerCase() === targetDistrict.toLowerCase());
  } else if (authUser?.role === 'MEMBER_OF_PARLIAMENT') {
    filteredAlerts = alerts.filter(a => a.district && a.district.toLowerCase() === 'bengaluru urban');
  }

  res.json({ items: filteredAlerts });
});

// 6. Audit Cases
app.get('/api/audit-cases', (req, res) => {
  const authUser = getAuthenticatedUser(req);
  let scopedCases = auditCases;

  if (authUser?.role === 'DISTRICT_AUTHORITY') {
    const districtProjIds = new Set(projects.filter(p => p.district && p.district.toLowerCase() === 'bengaluru urban').map(p => p.id));
    scopedCases = auditCases.filter(c => districtProjIds.has(c.project_id) || (c.assigned_authority && c.assigned_authority.toLowerCase().includes('district')));
  } else if (authUser?.role === 'STATE_NODAL_AUTHORITY') {
    const stateProjIds = new Set(projects.filter(p => p.state && p.state.toLowerCase() === 'karnataka').map(p => p.id));
    scopedCases = auditCases.filter(c => stateProjIds.has(c.project_id) || (c.assigned_authority && (c.assigned_authority.toLowerCase().includes('karnataka') || c.assigned_authority.toLowerCase().includes('state'))));
  } else if (authUser?.role === 'MEMBER_OF_PARLIAMENT') {
    const constProjIds = new Set(projects.filter(p => p.constituency && p.constituency.toLowerCase() === 'bengaluru central').map(p => p.id));
    scopedCases = auditCases.filter(c => constProjIds.has(c.project_id));
  }

  res.json({ items: scopedCases });
});

app.post('/api/audit-cases', (req, res) => {
  const { project_id, title, priority, assigned_authority, notes } = req.body;
  const newCase: AuditCase = {
    id: auditCases.length + 1,
    project_id: Number(project_id),
    title: title || `Audit Review for Project ${project_id}`,
    priority: priority || 'MEDIUM',
    status: 'OPEN',
    assigned_authority: assigned_authority || 'District audit officer',
    notes: notes || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  auditCases.unshift(newCase);
  res.json(newCase);
});

app.patch('/api/audit-cases/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const auditCase = auditCases.find(c => c.id === id);
  if (!auditCase) return res.status(404).json({ detail: 'Audit case not found' });
  if (req.body.status) auditCase.status = req.body.status;
  if (req.body.assigned_authority) auditCase.assigned_authority = req.body.assigned_authority;
  if (req.body.notes !== undefined) auditCase.notes = req.body.notes;
  auditCase.updated_at = new Date().toISOString();
  res.json(auditCase);
});

// 7. Agencies & Intelligence
app.get('/api/agencies', (_req, res) => {
  const agencyMap: Record<string, { projects: number; sanctioned: number; expenditure: number; delayed: number; high_risk: number; critical: number; riskSum: number }> = {};
  for (const p of projects) {
    if (!agencyMap[p.agency]) {
      agencyMap[p.agency] = { projects: 0, sanctioned: 0, expenditure: 0, delayed: 0, high_risk: 0, critical: 0, riskSum: 0 };
    }
    const item = agencyMap[p.agency];
    item.projects += 1;
    item.sanctioned += p.sanction_amount;
    item.expenditure += p.expenditure;
    item.riskSum += p.risk_score;
    if (p.delay_days > 45) item.delayed += 1;
    if (p.risk_level === 'HIGH') item.high_risk += 1;
    if (p.risk_level === 'CRITICAL') item.critical += 1;
  }

  const items = Object.entries(agencyMap).map(([name, data]) => ({
    name,
    projects: data.projects,
    sanctioned: data.sanctioned,
    expenditure: data.expenditure,
    average_utilization: data.sanctioned ? Number((data.expenditure / data.sanctioned).toFixed(3)) : 0,
    delayed: data.delayed,
    high_risk: data.high_risk,
    critical: data.critical,
    average_risk: data.projects ? Number((data.riskSum / data.projects).toFixed(1)) : 0,
  })).sort((a, b) => b.projects - a.projects);

  res.json({ items });
});

// 8. Reconciliation
app.get('/api/reconciliation', (_req, res) => {
  const mismatches = projects
    .filter(p => p.expenditure > p.sanction_amount)
    .map(p => ({
      project_id: p.id,
      project_name: p.project_name,
      project_code: p.project_code,
      state: p.state,
      district: p.district,
      category: p.category,
      sanction_amount: p.sanction_amount,
      expenditure: p.expenditure,
      utilization_ratio: p.utilization_ratio,
      delay_days: p.delay_days,
      anomaly_score: p.anomaly_score,
      risk_level: p.risk_level,
      risk_score: p.risk_score,
    }));

  res.json({
    total_mismatches: mismatches.length,
    available_fields: ['Sanction Amount', 'Cumulative Expenditure', 'Utilization Ratio', 'Completion Status'],
    unavailable_fields: ['Sub-Contractor Bills', 'Direct Material Invoices'],
    mismatches,
  });
});

// 9. Duplicates
const duplicateActions: Record<string, { status: string; notes?: string; officer?: string; updated_at: string }> = {};

app.get('/api/duplicates', (_req, res) => {
  const dupProjects = projects.filter(p => p.duplicate_flag);
  const items = [];
  for (let i = 0; i < dupProjects.length - 1; i += 2) {
    const a = dupProjects[i];
    const b = dupProjects[i + 1] || projects[i + 2];
    if (a && b) {
      const pairKey = `${a.id}-${b.id}`;
      const action = duplicateActions[pairKey] || { status: 'PENDING_REVIEW' };
      items.push({
        id: pairKey,
        project_a: { id: a.id, code: a.project_code, name: a.project_name, state: a.state, district: a.district, category: a.category, sanction_amount: a.sanction_amount, expenditure: a.expenditure, agency: a.agency },
        project_b: { id: b.id, code: b.project_code, name: b.project_name, state: b.state, district: b.district, category: b.category, sanction_amount: b.sanction_amount, expenditure: b.expenditure, agency: b.agency },
        similarity: 92,
        status: action.status,
        action_details: action,
        reasons: [
          `Matching category (${a.category}) in ${a.district}, ${a.state}`,
          `Close sanction values: ₹${a.sanction_amount.toLocaleString('en-IN')} vs ₹${b.sanction_amount.toLocaleString('en-IN')}`,
          'Identical executing agency and overlapping timeline',
        ],
      });
    }
  }

  res.json({ items });
});

app.post('/api/duplicates/action', (req, res) => {
  const { pair_id, action, notes, officer } = req.body;
  if (!pair_id) return res.status(400).json({ error: 'pair_id required' });

  const record = {
    status: action === 'CONFIRM' ? 'CONFIRMED_DUPLICATE' : action === 'INSPECT' ? 'FLAGGED_INSPECTION' : 'CLEARED_LEGITIMATE',
    notes: notes || '',
    officer: officer || 'District Vigilance Officer',
    updated_at: new Date().toISOString(),
  };
  duplicateActions[pair_id] = record;

  // Create connected Audit Case for administrative tracking
  const [idA, idB] = pair_id.split('-');
  const projA = projects.find(p => p.id === Number(idA));
  const projB = projects.find(p => p.id === Number(idB));

  if (action === 'CONFIRM' || action === 'INSPECT') {
    const isConfirm = action === 'CONFIRM';
    const newCase: AuditCase = {
      id: auditCases.length + 1,
      project_id: Number(idA),
      title: isConfirm 
        ? `Double-Billing Investigation: ${projA?.project_name || idA} & ${projB?.project_name || idB}`
        : `Physical Site Inspection: Verify duplicate work sites (${idA} vs ${idB})`,
      priority: isConfirm ? 'CRITICAL' : 'HIGH',
      status: 'OPEN',
      assigned_authority: officer || 'District Vigilance Unit',
      notes: notes || (isConfirm 
        ? `Confirmed potential duplicate works. Expenditure freeze recommended across ${projA?.agency || 'agency'}.` 
        : `On-site physical measurement required to confirm if separate physical assets exist on ground.`),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    auditCases.unshift(newCase);
  }

  res.json({ success: true, record });
});

app.post('/api/reconciliation/inquiry', (req, res) => {
  const { project_id, excess_amount, notes, authority } = req.body;
  const project = projects.find(p => p.id === Number(project_id));
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const overrunText = excess_amount ? `₹${Number(excess_amount).toLocaleString('en-IN')}` : 'excess expenditure';
  const newCase: AuditCase = {
    id: auditCases.length + 1,
    project_id: project.id,
    title: `Budget Overrun Inquiry: ${project.project_name} (${overrunText} above sanction)`,
    priority: 'HIGH',
    status: 'OPEN',
    assigned_authority: authority || 'District Accounts Officer',
    notes: notes || `Expenditure (₹${project.expenditure.toLocaleString('en-IN')}) exceeds approved financial ceiling (₹${project.sanction_amount.toLocaleString('en-IN')}). Formal recovery and revised sanction justification required.`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  auditCases.unshift(newCase);

  res.json({ success: true, case: newCase });
});

// 10. Data Quality
app.get('/api/data-quality', (_req, res) => {
  const dataQualityRecords = projects.filter(p => p.risk_level === 'DATA_QUALITY_REVIEW').length;
  res.json({
    total_records: projects.length,
    completeness: 0.965,
    validity: 0.978,
    uniqueness: 0.985,
    data_quality_records: dataQualityRecords,
    duplicate_project_ids: 2,
  });
});

// 11. Audit Copilot Search
app.post('/api/audit-search', (req, res) => {
  const query = (req.body.query || '').toLowerCase().trim();
  const interpreted: string[] = [];

  let matched = projects;

  if (query.includes('delayed') || query.includes('delay')) {
    matched = matched.filter(p => p.delay_days > 30);
    interpreted.push('Filter: Delayed completion > 30 days');
  }
  if (query.includes('overrun') || query.includes('approved amount') || query.includes('overspent') || query.includes('above')) {
    matched = matched.filter(p => p.expenditure > p.sanction_amount);
    interpreted.push('Filter: Expenditure exceeds approved sanction');
  }
  if (query.includes('critical') || query.includes('high risk')) {
    matched = matched.filter(p => p.risk_level === 'CRITICAL' || p.risk_level === 'HIGH');
    interpreted.push('Filter: High or Critical review level');
  }

  // Check state match
  for (const state of Object.keys(STATE_DISTRICTS)) {
    if (query.includes(state.toLowerCase())) {
      matched = matched.filter(p => p.state.toLowerCase() === state.toLowerCase());
      interpreted.push(`State: ${state}`);
      break;
    }
  }

  // Check category match
  for (const category of Object.keys(CATEGORIES)) {
    if (query.includes(category.toLowerCase())) {
      matched = matched.filter(p => p.category.toLowerCase() === category.toLowerCase());
      interpreted.push(`Category: ${category}`);
      break;
    }
  }

  if (interpreted.length === 0) {
    interpreted.push(`General Keyword Search for "${query}"`);
    matched = projects.filter(p =>
      p.project_name.toLowerCase().includes(query) ||
      p.district.toLowerCase().includes(query) ||
      p.state.toLowerCase().includes(query)
    );
  }

  res.json({
    interpreted,
    total_count: matched.length,
    records: matched.slice(0, 30),
  });
});

// 12. Dataset Ingestion / Multi-Upload
app.post('/api/validate', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided.' });
  res.json({
    valid: true,
    rows: 45,
    columns: ['project_code', 'project_name', 'state', 'district', 'sanction_amount', 'expenditure'],
    message: 'Schema successfully validated against MPLADS canonical register format.',
  });
});

app.post('/api/analyze', upload.single('file'), (req, res) => {
  res.json({
    total_projects: 45,
    high_risk_count: 6,
    critical_count: 2,
    alerts_created: 8,
    analysis_run_id: activeRunId,
    status: 'completed',
  });
});

app.post('/api/inspect-datasets', upload.array('files'), (req, res) => {
  const uploadedFiles = (req.files as Express.Multer.File[]) || [];
  const results = uploadedFiles.map(f => {
    let role = 'OTHER';
    let confidence = 85;
    const lower = f.originalname.toLowerCase();
    if (lower.includes('sanction')) { role = 'SANCTIONED_WORKS'; confidence = 96; }
    else if (lower.includes('complet')) { role = 'COMPLETED_WORKS'; confidence = 94; }
    else if (lower.includes('expend') || lower.includes('disburs')) { role = 'EXPENDITURE'; confidence = 93; }
    else if (lower.includes('allocat') || lower.includes('mp')) { role = 'MP_ALLOCATION'; confidence = 91; }
    else if (lower.includes('calamity')) { role = 'CALAMITY'; confidence = 89; }

    return {
      filename: f.originalname,
      file_type: f.originalname.endsWith('.xlsx') ? 'xlsx' : 'csv',
      detected_role: role,
      confidence,
      selected_sheet: 'Sheet1',
      sheets: [{ sheet: 'Sheet1', rows: 60, role, confidence }],
      column_mapping: [
        { uploaded_column: 'Work_ID', canonical_field: 'project_code', confidence: 98, status: 'MAPPED' },
        { uploaded_column: 'Work_Name', canonical_field: 'project_name', confidence: 95, status: 'MAPPED' },
        { uploaded_column: 'State_Name', canonical_field: 'state', confidence: 99, status: 'MAPPED' },
        { uploaded_column: 'Sanction_Cost', canonical_field: 'sanction_amount', confidence: 94, status: 'MAPPED' },
      ],
    };
  });

  res.json({ files: results });
});

app.post('/api/analyze-multi', upload.array('files'), (req, res) => {
  const uploadedFiles = (req.files as Express.Multer.File[]) || [];
  activeRunId += 1;
  const runId = activeRunId;

  analysisRuns[runId] = {
    id: runId,
    is_active: true,
    created_at: new Date().toISOString(),
    summary: {
      rows_processed: Math.max(uploadedFiles.length * 45, 120),
      projects_created: Math.max(uploadedFiles.length * 40, 110),
      matched_completed: 85,
      matched_expenditure: 92,
      allocation_matched: 95,
      calamity_count: 4,
      conflicts: [],
      relationship: 'Unified via multi-source canonical join using verified project identifiers.',
      datasets: uploadedFiles.map(f => ({
        filename: f.originalname,
        file_type: f.originalname.endsWith('.xlsx') ? 'xlsx' : 'csv',
        detected_role: 'SANCTIONED_WORKS',
        confidence: 94,
        selected_sheet: 'Sheet1',
        sheets: [{ sheet: 'Sheet1', rows: 45, role: 'SANCTIONED_WORKS', confidence: 94 }],
      })),
    },
  };

  res.json({
    analysis_run_id: runId,
    files_processed: uploadedFiles.length || 1,
    rows_processed: 180,
    projects_created: 180,
    alerts_created: 12,
    datasets: uploadedFiles.map((f, i) => ({
      id: i + 1,
      file_name: f.originalname,
      integrity_status: 'VERIFIED',
      algorithm: 'SHA-256',
    })),
  });
});

app.get('/api/analysis-runs/active', (_req, res) => {
  res.json(analysisRuns[activeRunId] || analysisRuns[1]);
});

app.get('/api/analysis-runs/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const run = analysisRuns[id] || analysisRuns[1];
  res.json(run);
});

app.post('/api/datasets/:id/privacy-scan', (req, res) => {
  res.json({
    privacy_status: 'COMPLIANT_WITH_MASKING',
    pii_detected: false,
    columns: [],
  });
});

// ==========================================
// 12. CARTEL & COLLUSION RADAR (SIH)
// ==========================================

// 12A. Cartel & Collusion Detector Endpoint
app.get('/api/forensics/cartels', (_req, res) => {
  const rings = [
    {
      id: 'RING-01',
      name: 'Apex-Shivalik-Pragati Bidder Syndicate',
      risk_score: 94,
      severity: 'CRITICAL',
      total_pooled_value: 84500000,
      contract_count: 14,
      location: 'Bengaluru Urban & Pune',
      primary_contractor: 'Apex Civil Infrastructure Ltd.',
      interconnected_bidders: ['Apex Civil Infrastructure Ltd.', 'Shivalik Infra & Water Projects', 'Pragati Building Works'],
      flags: [
        'Shared Corporate Office: Plot 42-B, Industrial Area Ph-II, Bengaluru',
        'Common Director DIN: DIN-08492019 (Shri Rajesh M. Singhal)',
        'Rotational Bidding Cycle: Alternating L1/L2 winners in 12 consecutive tenders',
        'Bid Submission IP Concurrency: Tenders submitted within 180s from same subnet (103.21.x.x)',
      ],
      centrality_score: 0.89,
      cover_bidding_probability: 0.92,
      cvc_violation_code: 'CVC-ANTI-CARTEL-01',
    },
    {
      id: 'RING-02',
      name: 'Kaveri-Sunrise Civic Alliance',
      risk_score: 88,
      severity: 'HIGH',
      total_pooled_value: 51200000,
      contract_count: 9,
      location: 'Chennai & Mysuru',
      primary_contractor: 'Kaveri Construction Syndicate',
      interconnected_bidders: ['Kaveri Construction Syndicate', 'Sunrise Public Contracting Ltd.'],
      flags: [
        'Matching Bank Guarantee Branch: State Bank of India, Branch Code SBIN0004128',
        'Common Contact Telephone & Domain Registrar: @civicpartners.in',
        'Cover Bidding Margin: Sunrise bids consistently +8.4% above Kaveri in water supply tenders',
        'Shared Equipment / Machinery Registry: Identical RTO vehicle registration numbers in tender affidavits',
      ],
      centrality_score: 0.76,
      cover_bidding_probability: 0.84,
      cvc_violation_code: 'CVC-ANTI-CARTEL-02',
    },
    {
      id: 'RING-03',
      name: 'Metro-Eastern Earthmovers Syndicate',
      risk_score: 72,
      severity: 'MEDIUM',
      total_pooled_value: 38000000,
      contract_count: 6,
      location: 'Kolkata & Patna',
      primary_contractor: 'Metro Civic Works Pvt Ltd',
      interconnected_bidders: ['Metro Civic Works Pvt Ltd', 'Eastern Geo-Infra Partners'],
      flags: [
        'Complementary Bidding: Eastern Geo-Infra bids above ceiling to satisfy mandatory 3-bid qualification',
        'Common Auditor Firm: M/s S.K. Goyal & Associates (FRN 012948N)',
        'Bid Deposit Cheque Number Sequence: Consecutive serial numbers in earnest money deposit (EMD)',
      ],
      centrality_score: 0.62,
      cover_bidding_probability: 0.74,
      cvc_violation_code: 'CVC-ANTI-CARTEL-03',
    },
  ];

  // Graph Nodes
  const nodes = [
    // Contractors
    { id: 'c1', label: 'Apex Civil Infrastructure', type: 'CONTRACTOR', risk: 92, wins: 8, bids: 14, ring: 'RING-01' },
    { id: 'c2', label: 'Shivalik Infra & Water', type: 'CONTRACTOR', risk: 85, wins: 5, bids: 12, ring: 'RING-01' },
    { id: 'c3', label: 'Pragati Building Works', type: 'CONTRACTOR', risk: 78, wins: 1, bids: 11, ring: 'RING-01' },
    { id: 'c4', label: 'Kaveri Construction', type: 'CONTRACTOR', risk: 88, wins: 6, bids: 9, ring: 'RING-02' },
    { id: 'c5', label: 'Sunrise Public Contracting', type: 'CONTRACTOR', risk: 82, wins: 3, bids: 9, ring: 'RING-02' },
    { id: 'c6', label: 'Metro Civic Works', type: 'CONTRACTOR', risk: 74, wins: 5, bids: 7, ring: 'RING-03' },
    { id: 'c7', label: 'Eastern Geo-Infra', type: 'CONTRACTOR', risk: 68, wins: 1, bids: 6, ring: 'RING-03' },
    // Shared Entity Nodes
    { id: 'e1', label: 'DIN-08492019 (Rajesh Singhal)', type: 'SHARED_DIRECTOR', risk: 95, ring: 'RING-01' },
    { id: 'e2', label: 'Plot 42-B, Ind. Area Ph-II, BLR', type: 'SHARED_ADDRESS', risk: 90, ring: 'RING-01' },
    { id: 'e3', label: 'SBI Branch SBIN0004128', type: 'BANK_BRANCH', risk: 85, ring: 'RING-02' },
    { id: 'e4', label: 'Contact: @civicpartners.in', type: 'COMMON_CONTACT', risk: 80, ring: 'RING-02' },
    { id: 'e5', label: 'Auditor: S.K. Goyal & Assoc.', type: 'COMMON_AUDITOR', risk: 65, ring: 'RING-03' },
  ];

  // Graph Edges
  const edges = [
    // Ring 01 Edges
    { source: 'c1', target: 'e1', type: 'DIRECTOR_LINK', label: 'Director DIN', risk: 95 },
    { source: 'c2', target: 'e1', type: 'DIRECTOR_LINK', label: 'Director DIN', risk: 95 },
    { source: 'c1', target: 'e2', type: 'ADDRESS_LINK', label: 'Registered Office', risk: 90 },
    { source: 'c2', target: 'e2', type: 'ADDRESS_LINK', label: 'Registered Office', risk: 90 },
    { source: 'c3', target: 'e2', type: 'ADDRESS_LINK', label: 'Sub-Office', risk: 85 },
    { source: 'c1', target: 'c2', type: 'ROTATIONAL_BIDDING', label: 'Rotational L1/L2 (8 Tenders)', risk: 94 },
    { source: 'c2', target: 'c3', type: 'COVER_BID', label: 'Cover Bids (+11%)', risk: 80 },
    // Ring 02 Edges
    { source: 'c4', target: 'e3', type: 'BANK_LINK', label: 'BG Issued SBIN0004128', risk: 88 },
    { source: 'c5', target: 'e3', type: 'BANK_LINK', label: 'BG Issued SBIN0004128', risk: 88 },
    { source: 'c4', target: 'e4', type: 'CONTACT_LINK', label: 'Common Domain & Phone', risk: 82 },
    { source: 'c5', target: 'e4', type: 'CONTACT_LINK', label: 'Common Domain & Phone', risk: 82 },
    { source: 'c4', target: 'c5', type: 'COVER_BID', label: 'Cover Bidding (+8.4%)', risk: 86 },
    // Ring 03 Edges
    { source: 'c6', target: 'e5', type: 'AUDITOR_LINK', label: 'Common Auditor', risk: 68 },
    { source: 'c7', target: 'e5', type: 'AUDITOR_LINK', label: 'Common Auditor', risk: 68 },
    { source: 'c6', target: 'c7', type: 'COVER_BID', label: 'Synthetic 3rd Bid', risk: 74 },
  ];

  res.json({
    rings,
    graph: { nodes, edges },
    metrics: {
      total_cartel_rings: rings.length,
      high_risk_contractors: 7,
      total_pooled_exposure: 173700000,
      total_rigged_tenders: 29,
      cvc_inquiry_readiness: 'EVIDENCE_GRADE_COMPLETE',
    },
  });
});

// --- Development vs Production Frontend Serving ---
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api/')) return next();
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`[MPLADS AI] Server running on http://${HOST}:${PORT}`);
  });
}

startServer();
