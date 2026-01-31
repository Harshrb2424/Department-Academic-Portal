# Department Academic Portal - Developer Documentation (Lowdb Edition)

A client-side academic management system using Lowdb for local JSON database operations, with GitHub Pages static hosting and branch-specific content filtering.

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [File Structure](#file-structure)
3. [Tech Stack](#tech-stack)
4. [Data Schemas (Lowdb)](#data-schemas-lowdb)
5. [Branch & Regulation System](#branch--regulation-system)
6. [Core Implementation with Lowdb](#core-implementation-with-lowdb)
7. [Project Management](#project-management)
8. [Setup Instructions](#setup-instructions)
9. [Deployment](#deployment)

---

## Architecture Overview

**Paradigm:** Client-Side JSON Database with GitHub Persistence
**Database:** Lowdb (Lodash-powered local JSON database)
**Hosting:** GitHub Pages + GitHub API for persistence
**State Management:** Lowdb runs in-memory with GitHub as backup store
**Routing:** Hash-based SPA with branch context persistence

### Workflow
1. App loads `db.json` from repository (initial state)
2. Lowdb initializes in browser memory
3. Faculty edits modify Lowdb instance
4. Changes committed back to GitHub via API (creates new `db.json`)
5. Students view filtered data based on their Branch/Dept/Regulation/Year

---

## File Structure

```
department-portal/
├── .github/
│   └── workflows/
│       └── sync-db.yml              # Backup db.json to GitHub
├── data/
│   ├── db.json                      # LOWDB MAIN DATABASE (single source of truth)
│   └── schemas/                     # Validation schemas
│       ├── subject.schema.json
│       └── project.schema.json
├── content/                         # Large files (Git LFS)
│   ├── notes/
│   ├── projects/                    # Project files organized by branch-year
│   │   ├── CSM/
│   │   │   ├── 2022-2026/
│   │   │   │   ├── R22/
│   │   │   │   │   ├── sem8/
│   │   │   │   │   │   ├── project-id-001/
│   │   │   │   │   │   │   ├── presentation.pptx
│   │   │   │   │   │   │   ├── report.pdf
│   │   │   │   │   │   │   └── code.zip
│   │   │   │   │   │   └── ...
│   ├── presentations/
│   └── assignments/
├── assets/
│   ├── js/
│   │   ├── db.js                    # Lowdb initialization & adapter
│   │   ├── schema.js                # Branch/Regulation calculations
│   │   ├── auth.js                  # GitHub API for persistence
│   │   └── app.js                   # Main application logic
│   └── css/
├── index.html
└── README.md
```

---

## Tech Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Database** | Lowdb 7.x | Local JSON database with Lodash API |
| **Storage** | GithubProvider (custom) | Sync db.json to GitHub |
| **Auth** | GitHub OAuth | Faculty write access |
| **Schema** | Zod / Joi | Runtime validation |
| **UI** | Tailwind CSS | Styling |
| **Icons** | Lucide | Icons |
| **Files** | Git LFS | Binary storage |

---

## Data Schemas (Lowdb)

### Main Database Structure (`data/db.json`)

```json
{
  "config": {
    "institution": "University College of Engineering",
    "departments": ["CSE", "CSM", "ECE", "EEE", "MECH", "CIVIL"],
    "regulations": {
      "R22": {
        "name": "2022 Regulation",
        "effectiveFrom": "2022-06-01",
        "semesters": 8,
        "scheme": "yearly" 
      },
      "R19": {
        "name": "2019 Regulation",
        "effectiveFrom": "2019-06-01",
        "semesters": 8,
        "scheme": "semester"
      }
    },
    "branches": {
      "CSE": { "name": "Computer Science", "code": "CSE" },
      "CSM": { "name": "CSE (AI & ML)", "code": "CSM" },
      "CSD": { "name": "CSE (Data Science)", "code": "CSD" }
    }
  },
  
  "users": [
    {
      "id": "faculty-001",
      "type": "faculty",
      "name": "Dr. Smith",
      "departments": ["CSE", "CSM"],
      "github": "drsmith"
    }
  ],
  
  "subjects": [
    {
      "id": "CS401",
      "code": "CS401",
      "name": "Artificial Intelligence",
      "regulation": "R22",
      "semester": 7,
      "departments": ["CSE", "CSM", "CSD"],
      "credits": 3,
      "syllabus": {
        "units": [...],
        "objectives": [...]
      },
      "resources": {
        "notes": [],
        "assignments": []
      }
    }
  ],
  
  "projects": [
    {
      "id": "proj-2024-csm-001",
      "title": "Smart Traffic Management using AI",
      "description": "IoT based traffic control system",
      "branch": "CSM",
      "regulation": "R22",
      "batch": "2022-2026",
      "semester": 8,
      "year": 4,
      "team": [
        { "name": "Student A", "roll": "22R11A6601" },
        { "name": "Student B", "roll": "22R11A6602" }
      ],
      "facultyGuide": "faculty-001",
      "files": {
        "ppt": "content/projects/CSM/2022-2026/R22/sem8/proj-001/presentation.pptx",
        "report": "content/projects/CSM/2022-2026/R22/sem8/proj-001/report.pdf",
        "abstract": "content/projects/CSM/2022-2026/R22/sem8/proj-001/abstract.pdf",
        "code": "content/projects/CSM/2022-2026/R22/sem8/proj-001/source.zip"
      },
      "tags": ["ai", "iot", "traffic"],
      "dateAdded": "2024-01-15",
      "status": "completed"
    }
  ],
  
  "viva": {
    "questions": [...],
    "sessions": []
  }
}
```

### Schema Definitions

```javascript
// assets/js/schema.js
export const BranchSchema = {
  id: String,           // CSM, CSE, etc.
  name: String,         // Full name
  department: String,   // Parent department
  regulations: [String] // Allowed: ['R22', 'R19']
};

export const StudentContext = {
  branch: String,       // CSM
  department: String,   // CSE
  regulation: String,   // R22
  admissionYear: Number, // 2022
  graduationYear: Number, // 2026
  currentSemester: Number, // Calculated
  currentYear: Number      // Calculated
};
```

---

## Branch & Regulation System

### Automatic Semester Calculator

```javascript
// assets/js/schema.js

export class AcademicCalculator {
  static calculateCurrentSemester(admissionYear, regulation, currentDate = new Date()) {
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // 0-11
    
    // Determine academic year progression
    let yearDiff = currentYear - admissionYear;
    
    // If before June, still in previous academic year
    if (currentMonth < 5) yearDiff--;
    
    if (yearDiff < 0) return { year: 0, semester: 0 }; // Not started
    
    const semester = (yearDiff * 2) + (currentMonth >= 5 ? 1 : 2);
    const academicYear = yearDiff + 1;
    
    return {
      year: academicYear,
      semester: semester,
      isValid: semester <= 8
    };
  }
  
  static getBatchString(admissionYear, graduationYear) {
    return `${admissionYear}-${graduationYear}`;
  }
  
  static getContext(branch, regulation, admissionYear) {
    const regulationData = db.data.config.regulations[regulation];
    const years = regulationData.semesters / 2;
    const graduationYear = admissionYear + years;
    
    const calc = this.calculateCurrentSemester(admissionYear, regulation);
    
    return {
      branch,
      regulation,
      admissionYear,
      graduationYear,
      batch: this.getBatchString(admissionYear, graduationYear),
      currentYear: calc.year,
      currentSemester: calc.semester,
      isActive: calc.isValid
    };
  }
}
```

### User Onboarding Flow

```javascript
// assets/js/onboarding.js

class OnboardingManager {
  constructor() {
    this.context = null;
  }
  
  renderBranchSelector() {
    const branches = db.data.config.branches;
    const regulations = Object.keys(db.data.config.regulations);
    const currentYear = new Date().getFullYear();
    
    return `
      <div class="max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg">
        <h2 class="text-2xl font-bold mb-6">Select Your Academic Details</h2>
        
        <form id="onboarding-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">Department</label>
            <select name="department" id="dept-select" class="w-full border rounded p-2" required>
              <option value="">Select Department</option>
              ${db.data.config.departments.map(d => `<option value="${d}">${d}</option>`).join('')}
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Branch</label>
            <select name="branch" id="branch-select" class="w-full border rounded p-2" required disabled>
              <option value="">First select department</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Regulation</label>
            <select name="regulation" class="w-full border rounded p-2" required>
              ${regulations.map(r => `<option value="${r}">${r}</option>`).join('')}
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Admission Year</label>
            <select name="admissionYear" class="w-full border rounded p-2" required>
              ${Array.from({length: 5}, (_, i) => currentYear - i).map(y => 
                `<option value="${y}">${y}-${y+4}</option>`
              ).join('')}
            </select>
          </div>
          
          <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
            Continue to Portal
          </button>
        </form>
      </div>
    `;
  }
  
  handleSubmission(formData) {
    const context = AcademicCalculator.getContext(
      formData.branch,
      formData.regulation,
      parseInt(formData.admissionYear)
    );
    
    // Save to localStorage
    localStorage.setItem('student_context', JSON.stringify(context));
    this.context = context;
    
    // Redirect to dashboard
    window.location.hash = '/dashboard';
  }
  
  getContext() {
    if (!this.context) {
      const saved = localStorage.getItem('student_context');
      if (saved) this.context = JSON.parse(saved);
    }
    return this.context;
  }
  
  clearContext() {
    localStorage.removeItem('student_context');
    this.context = null;
  }
}
```

---

## Core Implementation with Lowdb

### 1. Database Initialization

```javascript
// assets/js/db.js
import { Low } from 'https://cdn.jsdelivr.net/npm/lowdb@7.0.1/+esm';
import { GithubAdapter } from './adapters.js';

// Custom adapter for GitHub persistence
class GithubAdapter {
  constructor(repo, token) {
    this.repo = repo;
    this.token = token;
    this.path = 'data/db.json';
  }
  
  async read() {
    try {
      const res = await fetch(`https://api.github.com/repos/${this.repo}/contents/${this.path}`, {
        headers: this.token ? { 'Authorization': `token ${this.token}` } : {}
      });
      
      if (res.status === 404) return {}; // New database
      
      const data = await res.json();
      const content = atob(data.content);
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to read from GitHub:', error);
      return {};
    }
  }
  
  async write(data) {
    if (!this.token) throw new Error('Write access requires authentication');
    
    // Get current SHA
    const current = await fetch(`https://api.github.com/repos/${this.repo}/contents/${this.path}`, {
      headers: { 'Authorization': `token ${this.token}` }
    });
    const sha = current.ok ? (await current.json()).sha : null;
    
    // Commit new data
    const res = await fetch(`https://api.github.com/repos/${this.repo}/contents/${this.path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Update database ${new Date().toISOString()}`,
        content: btoa(JSON.stringify(data, null, 2)),
        sha: sha
      })
    });
    
    if (!res.ok) throw new Error('Failed to write to GitHub');
    return true;
  }
}

// Initialize database
let db;

export async function initDatabase(githubToken = null) {
  const defaultData = {
    config: {},
    subjects: [],
    projects: [],
    users: [],
    viva: { questions: [], sessions: [] }
  };
  
  // Use localStorage adapter for demo/student mode, GitHub for faculty
  const adapter = githubToken 
    ? new GithubAdapter('owner/repo', githubToken)
    : {
        read: async () => {
          const local = localStorage.getItem('db_cache');
          return local ? JSON.parse(local) : defaultData;
        },
        write: async (data) => {
          localStorage.setItem('db_cache', JSON.stringify(data));
        }
      };
  
  db = new Low(adapter, defaultData);
  await db.read();
  
  // Ensure default structure
  db.data = { ...defaultData, ...db.data };
  
  return db;
}

export { db };

// Helper functions using Lowdb (Lodash API)
export const DB = {
  // Subjects filtered by context
  getSubjectsForContext(context) {
    return db.data.subjects.filter(subject => 
      subject.regulation === context.regulation &&
      subject.departments.includes(context.branch) &&
      subject.semester === context.currentSemester
    );
  },
  
  // Projects filtered by context
  getProjectsForContext(context) {
    return db.data.projects.filter(project =>
      project.branch === context.branch &&
      project.regulation === context.regulation &&
      project.batch === context.batch &&
      project.semester === context.currentSemester
    ).sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
  },
  
  // Add new project
  async addProject(projectData, files) {
    const id = `proj-${Date.now()}`;
    const project = {
      id,
      ...projectData,
      dateAdded: new Date().toISOString(),
      files: {}
    };
    
    // Upload files first to get paths
    for (const [type, file] of Object.entries(files)) {
      const path = await this.uploadProjectFile(project, type, file);
      project.files[type] = path;
    }
    
    db.data.projects.push(project);
    await db.write();
    return project;
  },
  
  async uploadProjectFile(project, type, file) {
    // Implementation for Git LFS upload
    const path = `content/projects/${project.branch}/${project.batch}/${project.regulation}/sem${project.semester}/${project.id}/${type}-${file.name}`;
    // ... upload logic
    return path;
  },
  
  // Update subject resources
  async addNote(subjectId, noteData) {
    const subject = db.data.subjects.find(s => s.id === subjectId);
    if (!subject) throw new Error('Subject not found');
    
    subject.resources.notes.push({
      id: `note-${Date.now()}`,
      ...noteData,
      date: new Date().toISOString()
    });
    
    await db.write();
    return subject;
  }
};
```

### 2. Filtered Dashboard

```javascript
// assets/js/dashboard.js

class FilteredDashboard {
  constructor(onboarding) {
    this.context = onboarding.getContext();
    this.db = db;
  }
  
  render() {
    if (!this.context) {
      return window.router.navigate('/welcome');
    }
    
    const subjects = DB.getSubjectsForContext(this.context);
    const projects = DB.getProjectsForContext(this.context);
    
    return `
      <div class="max-w-6xl mx-auto p-6">
        <!-- Context Header -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex justify-between items-center">
          <div>
            <h1 class="text-2xl font-bold text-blue-900">
              ${this.context.branch} - ${this.context.regulation}
            </h1>
            <p class="text-blue-700">
              Year ${this.context.currentYear}, Semester ${this.context.currentSemester} 
              (${this.context.batch} Batch)
            </p>
          </div>
          <button onclick="onboarding.clearContext(); location.reload()" 
                  class="text-sm text-blue-600 hover:underline">
            Change Details
          </button>
        </div>
        
        <!-- Current Semester Subjects -->
        <section class="mb-8">
          <h2 class="text-xl font-bold mb-4">Your Current Subjects</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            ${subjects.length ? subjects.map(sub => `
              <subject-card .data=${sub}></subject-card>
            `).join('') : `
              <div class="col-span-3 text-gray-500 text-center py-8">
                No subjects found for current semester
              </div>
            `}
          </div>
        </section>
        
        <!-- Class Projects -->
        <section class="mb-8">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold">Class Projects</h2>
            <span class="text-sm text-gray-600">${projects.length} projects</span>
          </div>
          
          <div class="space-y-4">
            ${projects.map(proj => this.renderProjectCard(proj)).join('')}
          </div>
        </section>
        
        <!-- Quick Links -->
        <section class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a href="#/viva" class="block p-6 bg-white border rounded-lg hover:shadow-md transition">
            <h3 class="font-bold text-lg mb-2">Viva Practice</h3>
            <p class="text-gray-600">Practice questions for current semester subjects</p>
          </a>
          
          <a href="#/resources" class="block p-6 bg-white border rounded-lg hover:shadow-md transition">
            <h3 class="font-bold text-lg mb-2">All Resources</h3>
            <p class="text-gray-600">Browse notes, assignments and previous papers</p>
          </a>
        </section>
      </div>
    `;
  }
  
  renderProjectCard(project) {
    return `
      <div class="bg-white border rounded-lg p-6 hover:shadow-md transition">
        <div class="flex justify-between items-start">
          <div>
            <h3 class="font-bold text-lg mb-1">${project.title}</h3>
            <p class="text-gray-600 text-sm mb-2">${project.description}</p>
            
            <div class="flex gap-2 mb-3">
              ${project.tags.map(tag => `
                <span class="px-2 py-1 bg-gray-100 text-xs rounded">${tag}</span>
              `).join('')}
            </div>
            
            <div class="text-sm text-gray-500 mb-3">
              Team: ${project.team.map(t => t.name).join(', ')}
            </div>
          </div>
          
          <div class="flex flex-col gap-2">
            ${project.files.ppt ? `
              <a href="${project.files.ppt}" target="_blank" 
                 class="flex items-center gap-2 px-3 py-2 bg-orange-50 text-orange-700 rounded text-sm hover:bg-orange-100">
                <span>📊</span> PPT
              </a>
            ` : ''}
            
            ${project.files.report ? `
              <a href="${project.files.report}" target="_blank"
                 class="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded text-sm hover:bg-blue-100">
                <span>📄</span> Report
              </a>
            ` : ''}
            
            ${project.files.code ? `
              <a href="${project.files.code}" target="_blank"
                 class="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded text-sm hover:bg-green-100">
                <span>💻</span> Code
              </a>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }
}
```

---

## Project Management

### Project Upload Interface (Faculty Only)

```javascript
// assets/js/admin/projects.js

class ProjectManager {
  constructor() {
    this.context = new OnboardingManager().getContext();
  }
  
  renderUploadForm() {
    if (!Auth.isFaculty()) return Auth.showLogin();
    
    return `
      <div class="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow">
        <h2 class="text-2xl font-bold mb-6">Upload Student Project</h2>
        
        <form id="project-form" class="space-y-6">
          <!-- Context Selection (Pre-filled but editable) -->
          <div class="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded">
            <div>
              <label class="block text-sm font-medium">Branch</label>
              <select name="branch" class="w-full border rounded p-2" required>
                ${Object.entries(db.data.config.branches).map(([code, info]) => `
                  <option value="${code}" ${code === this.context?.branch ? 'selected' : ''}>
                    ${info.name}
                  </option>
                `).join('')}
              </select>
            </div>
            
            <div>
              <label class="block text-sm font-medium">Regulation</label>
              <select name="regulation" class="w-full border rounded p-2" required>
                ${Object.keys(db.data.config.regulations).map(r => `
                  <option value="${r}" ${r === this.context?.regulation ? 'selected' : ''}>
                    ${r}
                  </option>
                `).join('')}
              </select>
            </div>
            
            <div>
              <label class="block text-sm font-medium">Semester</label>
              <select name="semester" class="w-full border rounded p-2" required>
                ${Array.from({length: 8}, (_, i) => i + 1).map(s => `
                  <option value="${s}" ${s === this.context?.currentSemester ? 'selected' : ''}>
                    Semester ${s}
                  </option>
                `).join('')}
              </select>
            </div>
          </div>
          
          <!-- Project Details -->
          <div>
            <label class="block text-sm font-medium mb-1">Project Title</label>
            <input type="text" name="title" class="w-full border rounded p-2" required>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Description</label>
            <textarea name="description" rows="3" class="w-full border rounded p-2" required></textarea>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Team Members</label>
            <div id="team-members" class="space-y-2">
              <div class="flex gap-2">
                <input type="text" placeholder="Name" class="flex-1 border rounded p-2" required>
                <input type="text" placeholder="Roll Number" class="w-1/3 border rounded p-2" required>
              </div>
            </div>
            <button type="button" onclick="ProjectManager.addTeamField()" class="text-blue-600 text-sm mt-2">
              + Add Member
            </button>
          </div>
          
          <!-- File Uploads -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Presentation (PPT/PPTX)</label>
              <input type="file" name="file_ppt" accept=".ppt,.pptx,.pdf" class="w-full">
            </div>
            
            <div>
              <label class="block text-sm font-medium mb-1">Project Report (PDF)</label>
              <input type="file" name="file_report" accept=".pdf" class="w-full" required>
            </div>
            
            <div>
              <label class="block text-sm font-medium mb-1">Source Code (ZIP)</label>
              <input type="file" name="file_code" accept=".zip,.rar,.tar.gz" class="w-full">
            </div>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Tags (comma separated)</label>
            <input type="text" name="tags" placeholder="AI, IoT, Web Development" class="w-full border rounded p-2">
          </div>
          
          <button type="submit" class="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium">
            Upload Project
          </button>
        </form>
        
        <div id="upload-progress" class="hidden mt-4">
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-blue-600 h-2 rounded-full" style="width: 0%"></div>
          </div>
          <p class="text-sm text-gray-600 mt-1">Uploading...</p>
        </div>
      </div>
    `;
  }
  
  static addTeamField() {
    const container = document.getElementById('team-members');
    const div = document.createElement('div');
    div.className = 'flex gap-2';
    div.innerHTML = `
      <input type="text" placeholder="Name" class="flex-1 border rounded p-2" required>
      <input type="text" placeholder="Roll Number" class="w-1/3 border rounded p-2" required>
      <button type="button" onclick="this.parentElement.remove()" class="text-red-500">×</button>
    `;
    container.appendChild(div);
  }
  
  async handleSubmit(formData) {
    const context = {
      branch: formData.branch,
      regulation: formData.regulation,
      semester: parseInt(formData.semester),
      batch: this.calculateBatch(formData.branch, formData.semester)
    };
    
    const projectData = {
      title: formData.title,
      description: formData.description,
      branch: context.branch,
      regulation: context.regulation,
      semester: context.semester,
      batch: context.batch,
      year: Math.ceil(context.semester / 2),
      team: this.extractTeamMembers(),
      facultyGuide: Auth.getCurrentUser().id,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      status: 'completed'
    };
    
    const files = {
      ppt: formData.file_ppt,
      report: formData.file_report,
      code: formData.file_code,
      abstract: formData.file_abstract
    };
    
    try {
      await DB.addProject(projectData, files);
      alert('Project uploaded successfully!');
      window.router.navigate('/projects');
    } catch (error) {
      alert('Upload failed: ' + error.message);
    }
  }
  
  calculateBatch(branch, semester) {
    const currentYear = new Date().getFullYear();
    const yearOfStudy = Math.ceil(semester / 2);
    const admissionYear = currentYear - yearOfStudy + 1;
    return `${admissionYear}-${admissionYear + 4}`;
  }
  
  extractTeamMembers() {
    const members = [];
    document.querySelectorAll('#team-members > div').forEach(div => {
      const inputs = div.querySelectorAll('input');
      members.push({
        name: inputs[0].value,
        roll: inputs[1].value
      });
    });
    return members;
  }
}
```

### Project Browser with Filters

```javascript
class ProjectBrowser {
  constructor() {
    this.filters = {
      branch: '',
      year: '',
      regulation: '',
      tag: ''
    };
  }
  
  render() {
    const projects = this.getFilteredProjects();
    
    return `
      <div class="max-w-6xl mx-auto p-6">
        <h2 class="text-2xl font-bold mb-6">Project Repository</h2>
        
        <!-- Filters -->
        <div class="bg-white p-4 rounded-lg shadow mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <select id="filter-branch" onchange="projectBrowser.updateFilter('branch', this.value)" class="border rounded p-2">
            <option value="">All Branches</option>
            ${Object.keys(db.data.config.branches).map(b => `<option value="${b}">${b}</option>`).join('')}
          </select>
          
          <select id="filter-year" onchange="projectBrowser.updateFilter('year', this.value)" class="border rounded p-2">
            <option value="">All Years</option>
            <option value="1">1st Year</option>
            <option value="2">2nd Year</option>
            <option value="3">3rd Year</option>
            <option value="4">4th Year</option>
          </select>
          
          <select id="filter-reg" onchange="projectBrowser.updateFilter('regulation', this.value)" class="border rounded p-2">
            <option value="">All Regulations</option>
            ${Object.keys(db.data.config.regulations).map(r => `<option value="${r}">${r}</option>`).join('')}
          </select>
          
          <input type="text" placeholder="Search tags..." oninput="projectBrowser.updateFilter('tag', this.value)" class="border rounded p-2">
        </div>
        
        <!-- Results -->
        <div class="grid grid-cols-1 gap-4">
          ${projects.map(p => this.renderProjectCard(p)).join('')}
        </div>
      </div>
    `;
  }
  
  updateFilter(key, value) {
    this.filters[key] = value;
    this.refresh();
  }
  
  getFilteredProjects() {
    return db.data.projects.filter(p => {
      if (this.filters.branch && p.branch !== this.filters.branch) return false;
      if (this.filters.year && p.year !== parseInt(this.filters.year)) return false;
      if (this.filters.regulation && p.regulation !== this.filters.regulation) return false;
      if (this.filters.tag && !p.tags.some(t => t.toLowerCase().includes(this.filters.tag.toLowerCase()))) return false;
      return true;
    }).sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
  }
}
```

---

## Setup Instructions

### Step 1: Initialize Lowdb Structure

```bash
# Create initial db.json with default structure
mkdir -p data
cat > data/db.json << 'EOF'
{
  "config": {
    "institution": "Your College Name",
    "departments": ["CSE", "CSM", "CSD", "ECE", "EEE"],
    "branches": {
      "CSE": { "name": "Computer Science", "department": "CSE" },
      "CSM": { "name": "CSE (AI & ML)", "department": "CSE" },
      "CSD": { "name": "CSE (Data Science)", "department": "CSE" }
    },
    "regulations": {
      "R22": { "name": "2022 Regulation", "semesters": 8 },
      "R19": { "name": "2019 Regulation", "semesters": 8 }
    }
  },
  "subjects": [],
  "projects": [],
  "users": [],
  "viva": { "questions": [], "sessions": [] }
}
EOF
```

### Step 2: Configure Git LFS for Projects

```bash
# Track all project files
git lfs track "content/projects/**/*.pptx"
git lfs track "content/projects/**/*.pdf"
git lfs track "content/projects/**/*.zip"
git add .gitattributes
```

### Step 3: GitHub OAuth Setup

1. Go to GitHub Settings → Developer Settings → OAuth Apps
2. New OAuth App:
   - Name: "Dept Academic Portal"
   - Homepage URL: `https://yourusername.github.io/department-portal`
   - Authorization callback URL: `https://yourusername.github.io/department-portal/callback.html`
3. Copy Client ID to `assets/js/config.js`:
   ```javascript
   export const GITHUB_CLIENT_ID = 'your_client_id_here';
   export const REPO_NAME = 'owner/department-portal';
   ```

### Step 4: Enable GitHub Pages

```bash
git add .
git commit -m "Initial setup with Lowdb schema"
git push origin main
```

Then enable Pages in repository settings.

---

## Deployment

### Sync Strategy

Since Lowdb runs in browser memory, changes must be persisted back to GitHub:

```javascript
// Auto-sync every 5 minutes for faculty
if (Auth.isFaculty()) {
  setInterval(async () => {
    if (db.data && db.dirty) { // Track modifications
      await db.write();
      console.log('Database synced to GitHub');
    }
  }, 300000);
}

// Or manual sync button in admin panel
<button onclick="db.write().then(() => alert('Saved!'))">
  Save Changes to GitHub
</button>
```

### Schema Migrations

When updating structure:

```javascript
// Migration script
if (!db.data.version || db.data.version < 2) {
  // Migrate old projects to new structure with branch/regulation
  db.data.projects.forEach(p => {
    if (!p.branch) p.branch = 'CSE'; // Default fallback
    if (!p.regulation) p.regulation = 'R22';
  });
  db.data.version = 2;
  await db.write();
}
```

---

## API Reference (Lowdb Operations)

```javascript
// Common operations using Lowdb's Lodash API

// Find all subjects for specific semester
db.chain.get('subjects')
  .filter({ regulation: 'R22', semester: 4 })
  .orderBy('code')
  .value()

// Find project by ID
db.chain.get('projects').find({ id: 'proj-123' }).value()

// Add new note to subject
db.chain.get('subjects')
  .find({ id: 'CS201' })
  .get('resources.notes')
  .push(newNote)
  .value()

// Search projects by tag
db.chain.get('projects')
  .filter(p => p.tags.includes('AI'))
  .take(10)
  .value()

// Get unique branches with projects
db.chain.get('projects')
  .map('branch')
  .uniq()
  .value()
```

This architecture provides a type-safe, lowdb-powered academic portal with automatic semester calculation and branch-specific content filtering.
```
