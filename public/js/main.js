function logout() {
  console.log('🚪 Logging out...');
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem('username');
  window.location.href = 'login.html';
}

function checkAuth() {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  
  if (!token || !role) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

async function loadFilters() {
  if (!checkAuth()) return;
  
  const token = localStorage.getItem('token');
  
  try {
    const res = await fetch('/api/filters', {
      headers: { 'Authorization': token }
    });
    
    if (res.status === 401) {
      logout();
      return;
    }
    
    const filters = await res.json();
    const filtersDiv = document.getElementById('filters');
    
    console.log('📊 Filters received:', filters);
    
    filtersDiv.innerHTML = `
      <div class="col-md-3">
        <label class="form-label fw-semibold small">Subject</label>
        <select class="form-select" id="subjectFilter">
          <option value="">All Subjects</option>
          ${(filters.subjects || []).map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>
      <div class="col-md-3">
        <label class="form-label fw-semibold small">Category</label>
        <select class="form-select" id="categoryFilter">
          <option value="">All Categories</option>
          ${(filters.categories || []).map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
      <div class="col-md-2">
        <label class="form-label fw-semibold small">Topic</label>
        <select class="form-select" id="topicFilter">
          <option value="">All Topics</option>
          ${(filters.topics || []).map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>
      <div class="col-md-2">
        <label class="form-label fw-semibold small">Level</label>
        <select class="form-select" id="levelFilter">
          <option value="">All Levels</option>
          ${(filters.levels || []).map(l => `<option value="${l}">${l}</option>`).join('')}
        </select>
      </div>
      <div class="col-md-2 d-flex align-items-end">
        <button class="btn btn-primary w-100" onclick="applyFilters()">
          <i class="bi bi-funnel me-1"></i>Filter
        </button>
      </div>
    `;
  } catch (error) {
    console.error('Error loading filters:', error);
  }
}

function applyFilters() {
  const subject = document.getElementById('subjectFilter').value;
  const category = document.getElementById('categoryFilter').value;
  const topic = document.getElementById('topicFilter').value;
  const level = document.getElementById('levelFilter').value;
  loadQuestions({ subject, category, topic, level });
}

async function loadQuestions(filters) {
  if (!checkAuth()) return;
  
  const token = localStorage.getItem('token');
  let url = '/api/questions';
  const params = [];
  
  for (const key in filters) {
    if (filters[key]) params.push(`${key}=${encodeURIComponent(filters[key])}`);
  }
  if (params.length) url += '?' + params.join('&');
  
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': token }
    });
    
    if (res.status === 401) {
      logout();
      return;
    }
    
    const questions = await res.json();
    const qDiv = document.getElementById('questions');
    
    if (!questions.length) {
      qDiv.innerHTML = `
        <div class="col-12">
          <div class="alert alert-info text-center py-4">
            <i class="bi bi-info-circle display-4 d-block mb-2"></i>
            No questions found matching your criteria.
          </div>
        </div>
      `;
      return;
    }
    
    qDiv.innerHTML = questions.map(q => `
      <div class="col-lg-6 mb-3">
        <div class="card h-100 border-0 shadow-sm">
          <div class="card-header bg-light d-flex justify-content-between align-items-center">
            <span class="fw-semibold text-primary">${q.subject}</span>
            <span class="badge ${getLevelBadgeClass(q.level)}">${q.level}</span>
          </div>
          <div class="card-body">
            <div class="mb-2">
              <small class="text-muted">
                <i class="bi bi-tag me-1"></i>${q.category} • 
                <i class="bi bi-bookmark me-1"></i>${q.topic}
              </small>
            </div>
            <pre class="bg-dark text-light p-3 rounded mb-0">${q.question}</pre>
          </div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading questions:', error);
  }
}

function getLevelBadgeClass(level) {
  const classes = {
    'Easy': 'bg-success',
    'Medium': 'bg-warning',
    'Hard': 'bg-danger',
    'Beginner': 'bg-info',
    'Advanced': 'bg-dark'
  };
  return classes[level] || 'bg-secondary';
}