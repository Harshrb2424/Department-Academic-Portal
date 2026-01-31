
const app = {
    state: {
        reg: '',
        batch: '',
        dept: '',
        yearSem: '',
        currentClassId: '',
        mobileFiltersOpen: false
    },
    data: {
        metadata: {},
        curriculum: [],
        subjects: [],
        notes: [],
        classes: [],
        projects: []
    },

    init: async function () {
        // Theme
        if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        // URL Params
        const params = new URLSearchParams(window.location.search);
        this.state.reg = params.get('reg') || localStorage.getItem('reg') || '';
        this.state.batch = params.get('batch') || localStorage.getItem('batch') || '';
        this.state.dept = params.get('dept') || localStorage.getItem('dept') || '';
        this.state.yearSem = params.get('yearSem') || localStorage.getItem('yearSem') || '';

        await this.loadMetadata();
        this.setupListeners();

        if (this.state.reg && this.state.batch && this.state.dept) {
            this.updateUIValues();
            document.getElementById('mobileFilterDot').classList.remove('hidden');
            this.fetchCoreData();
        } else {
            this.updateUIValues();

            if (window.innerWidth < 640 && !this.state.mobileFiltersOpen) {
                this.toggleMobileFilters();
            }
        }
    },

    toggleTheme: function () {
        if (document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
        } else {
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark';
        }
    },

    toggleMobileFilters: function () {
        const tray = document.getElementById('filterTray');
        this.state.mobileFiltersOpen = !this.state.mobileFiltersOpen;

        if (this.state.mobileFiltersOpen) {
            tray.classList.remove('hidden');
            tray.classList.add('block');
        } else {
            tray.classList.add('hidden');
            tray.classList.remove('block');
        }
    },

    loadMetadata: async function () {
        try {
            // Only fetch metadata here. Curriculum is now Regulation-specific.
            const res = await fetch('./resources/metadata.json');
            this.data.metadata = await res.json();

            this.populateSelect('regSelect', this.data.metadata.regulations);
            this.populateSelect('batchSelect', this.data.metadata.batches);
            this.populateSelect('deptSelect', this.data.metadata.departments);
        } catch (e) {
            console.error("Metadata load failed", e);
            this.setStatus("Error Loading Metadata", "error");
        }
    },

    setupListeners: function () {
        ['regSelect', 'batchSelect', 'deptSelect'].forEach(id => {
            document.getElementById(id).addEventListener('change', (e) => {
                const key = id.replace('Select', '');
                this.state[key] = e.target.value;

                // Reset sub-filter
                if (key !== 'yearSem') {
                    this.state.yearSem = '';
                    document.getElementById('yearSemSelect').value = '';
                }
                this.handleStateChange();
            });
        });

        document.getElementById('yearSemSelect').addEventListener('change', (e) => {
            this.state.yearSem = e.target.value;
            this.handleStateChange();
        });

        document.getElementById('classSelect').addEventListener('change', (e) => {
            this.state.currentClassId = e.target.value;
            this.fetchProjects(this.state.currentClassId);
        });
    },

    handleStateChange: function () {
        const { reg, batch, dept, yearSem } = this.state;

        localStorage.setItem('reg', reg);
        localStorage.setItem('batch', batch);
        localStorage.setItem('dept', dept);
        localStorage.setItem('yearSem', yearSem);

        const url = new URL(window.location);
        if (reg) url.searchParams.set('reg', reg);
        if (batch) url.searchParams.set('batch', batch);
        if (dept) url.searchParams.set('dept', dept);
        if (yearSem) url.searchParams.set('yearSem', yearSem);
        window.history.pushState({}, '', url);

        document.getElementById('batchSelect').disabled = !reg;
        document.getElementById('deptSelect').disabled = !reg;

        if (reg && batch && dept) {
            document.getElementById('mobileFilterDot').classList.remove('hidden');
            this.fetchCoreData();

            if (yearSem !== '' && this.state.mobileFiltersOpen) {
                this.toggleMobileFilters();
            }
        } else {
            document.getElementById('yearSemSelect').disabled = true;
            document.getElementById('welcomeState').classList.remove('hidden');
            document.getElementById('mainContent').classList.add('hidden');
            document.getElementById('mobileFilterDot').classList.add('hidden');
        }
    },

    fetchCoreData: async function () {
        this.setStatus("Loading...", "loading");
        const { reg, batch, dept } = this.state;

        try {
            const [subRes, noteRes, clsRes, currRes] = await Promise.all([
                fetch(`./resources/${reg}/subjects.json`),
                fetch(`./resources/${reg}/notes.json`),
                fetch(`./resources/${reg}/classes.json`),
                fetch(`./resources/${reg}/curriculum.json`) // Fetches from R22/curriculum.json
            ]);

            if (!subRes.ok || !noteRes.ok || !clsRes.ok) throw new Error("Resources not found");

            this.data.subjects = await subRes.json();
            this.data.notes = await noteRes.json();
            const allClasses = await clsRes.json();

            // Handle Curriculum safely (in case file is missing)
            if (currRes.ok) {
                this.data.curriculum = await currRes.json();
            } else {
                this.data.curriculum = [];
                console.warn("Curriculum file not found for this regulation");
            }

            this.data.classes = allClasses.filter(c => c.batch === batch && c.dept === dept);

            // Now that data is loaded, enable dropdown and populate
            document.getElementById('yearSemSelect').disabled = false;
            this.populateYearSemDropdown();

            this.renderSubjects();
            this.handleClassesLogic();

            document.getElementById('welcomeState').classList.add('hidden');
            document.getElementById('mainContent').classList.remove('hidden');
            this.setStatus("Ready", "ready");

        } catch (e) {
            console.error(e);
            document.getElementById('subjectsContainer').innerHTML =
                `<div class="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded">Error loading resources for ${reg}. Check file paths.</div>`;
            this.setStatus("Error", "error");
        }
    },

    populateYearSemDropdown: function () {
        const sel = document.getElementById('yearSemSelect');
        const { batch, dept, yearSem } = this.state;

        sel.innerHTML = '<option value="">All Semesters</option>';

        // Filter curriculum for current batch/dept
        const validEntries = this.data.curriculum.filter(c => c.batch === batch && c.department === dept);

        // Sort (Year 1 Sem 1 -> Year 1 Sem 2 -> Year 2 Sem 1...)
        validEntries.sort((a, b) => (a.year - b.year) || (a.semester - b.semester));

        if (validEntries.length === 0) {
            // If no entries found, disable select
            const opt = document.createElement('option');
            opt.textContent = "No Data";
            sel.appendChild(opt);
            sel.disabled = true;
            return;
        }

        validEntries.forEach(entry => {
            const opt = document.createElement('option');
            opt.value = `${entry.year}-${entry.semester}`;
            opt.textContent = `Year ${entry.year} - Sem ${entry.semester}`;
            sel.appendChild(opt);
        });

        // Restore previous selection if it exists
        if (yearSem) {
            sel.value = yearSem;
        }
    },

    handleClassesLogic: function () {
        const classSelect = document.getElementById('classSelect');
        const { classes } = this.data;

        if (classes.length === 0) {
            classSelect.classList.add('hidden');
            document.getElementById('projectsContainer').innerHTML = `<div class="p-6 text-center text-slate-500 italic">No classes found.</div>`;
            return;
        }

        classSelect.innerHTML = '';
        classes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.class_id;
            opt.textContent = c.name || c.class_id;
            classSelect.appendChild(opt);
        });

        this.state.currentClassId = classes[0].class_id;
        if (classes.length > 1) classSelect.classList.remove('hidden');
        else classSelect.classList.add('hidden');

        this.fetchProjects(this.state.currentClassId);
    },

    fetchProjects: async function (classId) {
        const { reg } = this.state;
        const container = document.getElementById('projectsContainer');
        container.innerHTML = `<div class="p-8 text-center text-slate-400 dark:text-slate-500 animate-pulse">Loading Projects...</div>`;

        try {
            const res = await fetch(`./resources/${reg}/${classId}/projects.json`);
            if (!res.ok) throw new Error("No projects");
            const projects = await res.json();
            this.renderProjects(projects);
        } catch (e) {
            container.innerHTML = `<div class="p-8 text-center text-slate-400 dark:text-slate-500 italic">No projects uploaded.</div>`;
        }
    },

    renderSubjects: function () {
        const container = document.getElementById('subjectsContainer');
        const semesterText = document.getElementById('currentSemText');
        container.innerHTML = '';

        let validSubjectCodes = [];
        let curriculumEntries = [];

        // 1. First, find all curriculum entries for this Batch & Dept
        if (this.state.batch && this.state.dept) {
            curriculumEntries = this.data.curriculum.filter(c =>
                c.batch === this.state.batch &&
                c.department === this.state.dept
            );
        }

        // 2. If a specific Year/Sem is selected, filter further
        if (this.state.yearSem) {
            const [y, s] = this.state.yearSem.split('-');
            semesterText.textContent = `(Year ${y} - Sem ${s})`;

            // Filter the entries to just this semester
            curriculumEntries = curriculumEntries.filter(c => c.year == y && c.semester == s);
        } else {
            semesterText.textContent = '(All Semesters)';
        }

        // 3. Collect all valid subject codes from the filtered curriculum entries
        curriculumEntries.forEach(entry => {
            if (entry.subjects && Array.isArray(entry.subjects)) {
                validSubjectCodes.push(...entry.subjects);
            }
        });

        // 4. Filter the main subjects list against these codes
        // If curriculum is empty (e.g. data missing), we show nothing to prevent showing wrong subjects
        let visibleSubjects = [];
        if (validSubjectCodes.length > 0) {
            visibleSubjects = this.data.subjects.filter(sub => validSubjectCodes.includes(sub.code));
        }

        // --- RENDER (No changes below this line) ---
        if (visibleSubjects.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-slate-400 dark:text-slate-500 italic">No subjects found for this selection.</div>`;
            return;
        }

        visibleSubjects.forEach((sub, index) => {
            const subNotes = this.data.notes.filter(n => n.subject_code === sub.code);

            let syllabusHtml = '';
            if (sub.syllabus && sub.syllabus.units) {
                syllabusHtml = sub.syllabus.units.map((unit, uIdx) => `
                            <details class="group mb-2 last:mb-0">
                                <summary class="flex cursor-pointer items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 p-3 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-transparent dark:border-slate-700">
                                    <span class="font-medium text-slate-700 dark:text-slate-300 text-sm">${unit.name}</span>
                                    <span class="text-slate-400 transition-transform group-open:rotate-180"><i class="ph ph-caret-down"></i></span>
                                </summary>
                                <div class="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-b-lg -mt-1">
                                    <ul class="list-disc pl-4 space-y-2">
                                        ${unit.topics.map(t => `
                                            <li><span class="font-semibold text-slate-800 dark:text-slate-200">${t.topic}</span>
                                            ${t.subTopics.length ? `<span class="text-slate-500 dark:text-slate-500 text-xs block mt-1">${t.subTopics.join(', ')}</span>` : ''}
                                            </li>`).join('')}
                                    </ul>
                                </div>
                            </details>`).join('');
            }

            let notesHtml = subNotes.length ? subNotes.map(note => `
                        <div class="flex flex-col sm:flex-row sm:items-start justify-between bg-indigo-50/50 dark:bg-slate-800/50 p-3 rounded-md border border-indigo-100 dark:border-slate-700 gap-3">
                            <div class="min-w-[150px]">
                                <div class="font-medium text-indigo-900 dark:text-indigo-300 text-sm flex items-center gap-2">
                                    <i class="ph ph-file-text"></i> ${note.resource_type}
                                </div>
                                <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    By <a href="${note.author_link}" target="_blank" class="hover:underline text-indigo-600 dark:text-indigo-400">${note.author_name}</a>
                                </div>
                            </div>
                            <div class="flex flex-wrap gap-2 justify-start sm:justify-end">
                                ${note.links.map(l => `<a href="${l.link}" target="_blank" class="text-xs font-semibold bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 px-3 py-1.5 border border-indigo-200 dark:border-slate-600 rounded hover:bg-indigo-600 dark:hover:bg-indigo-500 hover:text-white transition-colors whitespace-nowrap">${l.name}</a>`).join('')}
                            </div>
                        </div>`).join('') : `<div class="text-xs text-slate-400 italic pl-1">No notes available yet.</div>`;

            const card = document.createElement('div');
            card.className = "bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden fade-in transition-colors";
            card.style.animationDelay = `${index * 50}ms`;
            card.innerHTML = `
                        <div class="p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-white to-slate-50 dark:from-slate-900 dark:to-slate-850">
                            <div class="flex justify-between items-start">
                                <div><h3 class="text-lg font-bold text-slate-800 dark:text-slate-100">${sub.name}</h3><span class="inline-block mt-1 text-xs font-mono font-semibold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">${sub.code}</span></div>
                            </div>
                        </div>
                        <div class="p-5"><div class="mb-4"><h4 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Study Resources</h4><div class="space-y-2">${notesHtml}</div></div><div><h4 class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Curriculum</h4>${syllabusHtml || '<div class="text-sm text-slate-400 italic">Syllabus data not available.</div>'}</div></div>`;
            container.appendChild(card);
        });
    },
    renderProjects: function (projects) {
        const container = document.getElementById('projectsContainer');
        container.innerHTML = '';
        if (projects.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-slate-400 italic">No projects found.</div>`;
            return;
        }
        const grouped = projects.reduce((acc, p) => { (acc[p.type_category] = acc[p.type_category] || []).push(p); return acc; }, {});
        for (const [type, projs] of Object.entries(grouped)) {
            const details = document.createElement('details');
            details.className = "group border-b border-slate-100 dark:border-slate-800 last:border-0";
            details.open = true;

            let itemsHtml = projs.map(p => {
                // Map all presentation links
                const presentations = p.presentation_links.map((link, idx) => `
                            <a href="${link}" target="_blank" class="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 font-medium">
                                <i class="ph ph-presentation"></i> Presentation ${p.presentation_links.length > 1 ? idx + 1 : ''}
                            </a>
                        `).join('');

                // Map all document links
                const reports = p.documents.map((link, idx) => `
                            <a href="${link}" target="_blank" class="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-medium">
                                <i class="ph ph-file-pdf"></i> Report ${p.documents.length > 1 ? idx + 1 : ''}
                            </a>
                        `).join('');

                return `
                        <div class="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div class="flex justify-between items-start mb-1">
                                <span class="font-bold text-slate-700 dark:text-slate-200 text-sm">${p.team_no}: ${p.title}</span>
                            </div>
                            <div class="text-xs text-slate-500 dark:text-slate-400 mb-3">
                                ${p.members.map(m => `${m.name} <span class="opacity-70">(${m.roll})</span>`).join(', ')}
                            </div>
                            <div class="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                                ${presentations}
                                ${reports}
                            </div>
                        </div>`;
            }).join('');

            details.innerHTML = `
                        <summary class="cursor-pointer bg-slate-50/80 dark:bg-slate-800/80 px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide sticky top-0 backdrop-blur-sm flex justify-between items-center select-none">
                            ${type}
                            <i class="ph ph-caret-down text-slate-400 transition-transform group-open:rotate-180"></i>
                        </summary>
                        <div class="divide-y divide-slate-100 dark:divide-slate-800">${itemsHtml}</div>`;
            container.appendChild(details);
        }
    },
    populateSelect: function (id, items) {
        const sel = document.getElementById(id);
        const placeholder = sel.firstElementChild;
        sel.innerHTML = '';
        sel.appendChild(placeholder);
        items.forEach(item => { const opt = document.createElement('option'); opt.value = item; opt.textContent = item; sel.appendChild(opt); });
    },

    setStatus: function (msg, type) {
        const wrapper = document.getElementById('statusIndicator');
        const dot = document.getElementById('statusDot');
        const pulse = document.getElementById('statusDotPulse');
        const text = document.getElementById('statusText');
        text.innerText = msg;
        const themes = {
            ready: { wrapper: "bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400", dot: "bg-emerald-500", pulse: "bg-emerald-400" },
            loading: { wrapper: "bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400", dot: "bg-amber-500", pulse: "bg-amber-400" },
            error: { wrapper: "bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400", dot: "bg-rose-500", pulse: "bg-rose-400" }
        };
        const theme = themes[type] || themes.ready;
        wrapper.className = `hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-300 ${theme.wrapper}`;
        dot.className = `relative inline-flex rounded-full h-2 w-2 ${theme.dot}`;
        pulse.className = `animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${theme.pulse}`;
        if (type === 'error') pulse.classList.add('hidden'); else pulse.classList.remove('hidden');
    },

    updateUIValues: function () {
        if (this.state.reg) document.getElementById('regSelect').value = this.state.reg;
        if (this.state.batch) document.getElementById('batchSelect').value = this.state.batch;
        if (this.state.dept) document.getElementById('deptSelect').value = this.state.dept;
        if (this.state.yearSem) document.getElementById('yearSemSelect').value = this.state.yearSem;
        if (this.state.reg) {
            document.getElementById('batchSelect').disabled = false;
            document.getElementById('deptSelect').disabled = false;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => { app.init(); });