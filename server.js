const express = require('express');
const sqlite3 = require('sqlite3');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

if (!fs.existsSync('./db')) fs.mkdirSync('./db');
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

const db = new sqlite3.Database('./db/database.sqlite');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'student',
    security_question TEXT DEFAULT 'What was the name of your favorite teacher in secondary school?',
    security_answer TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT,
    category TEXT,
    topic TEXT,
    level TEXT,
    question TEXT,
    added_by TEXT,
    excel_file TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS uploaded_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    original_name TEXT,
    uploaded_by TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    question_count INTEGER
  )`);

  db.run(`INSERT OR IGNORE INTO users (username, password, role, security_answer) 
          VALUES ('admin', '12345678', 'admin', 'admin')`);
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/')
  },
  filename: function (req, file, cb) {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + '-' + cleanName;
    cb(null, uniqueName)
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

const sessions = {};

function auth(role) {
  return (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token || !sessions[token]) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (role && sessions[token].role !== role) {
      return res.status(403).json({ error: "Forbidden" });
    }
    req.user = sessions[token];
    next();
  };
}

app.post('/api/register', (req, res) => {
  const { username, password, security_answer } = req.body;
  
  if (!username || !password || !security_answer) {
    return res.status(400).json({ error: "All fields are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  
  db.run("INSERT INTO users (username, password, role, security_answer) VALUES (?, ?, 'student', ?)",
    [username.trim(), password, security_answer], function(err) {
      if (err) {
        return res.status(400).json({ error: "Username already exists" });
      }
      res.json({ success: true });
    });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }
  
  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username.trim(), password], (err, row) => {
    if (row) {
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessions[token] = { username: row.username, role: row.role };
      res.json({ token, role: row.role });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });
});

app.post('/api/get-security-question', (req, res) => {
  const { username } = req.body;
  
  db.get("SELECT username, security_question FROM users WHERE username = ?", 
    [username.trim()], (err, row) => {
      if (err || !row) {
        return res.status(400).json({ error: "User not found" });
      }
      res.json({ 
        success: true, 
        security_question: row.security_question 
      });
    });
});

app.post('/api/reset-password', (req, res) => {
  const { username, security_answer, new_password } = req.body;
  
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  db.run("UPDATE users SET password = ? WHERE username = ? AND security_answer = ?",
    [new_password, username.trim(), security_answer], function(err) {
      if (err || this.changes === 0) {
        return res.status(400).json({ error: "Invalid security answer" });
      }
      res.json({ success: true });
    });
});

app.post('/api/add-admin', auth('admin'), (req, res) => {
  const { username, password } = req.body;
  
  db.run("INSERT INTO users (username, password, role, security_answer) VALUES (?, ?, 'admin', ?)",
    [username.trim(), password, 'default'], function(err) {
      if (err) return res.status(400).json({ error: "Username already exists" });
      res.json({ success: true });
    });
});

app.post('/api/upload', auth('admin'), upload.single('excel'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    console.log('📁 Processing file:', req.file.originalname);
    
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    console.log('📊 Excel data rows:', data.length);

    const stmt = db.prepare("INSERT INTO questions (subject, category, topic, level, question, added_by, excel_file) VALUES (?, ?, ?, ?, ?, ?, ?)");
    let count = 0;
    let errors = [];

    data.forEach((row, index) => {
      const subject = row.Subject || row.subject || '';
      const category = row.Category || row.category || '';
      const topic = row.Topic || row.topic || '';
      const level = row.Level || row.level || '';
      const question = row.Question || row.question || '';

      if (subject && category && topic && level && question) {
        stmt.run(
          subject.toString().trim(),
          category.toString().trim(),
          topic.toString().trim(),
          level.toString().trim(),
          question.toString().trim(),
          req.user.username,
          req.file.filename
        );
        count++;
      } else {
        errors.push(`Row ${index + 1}: Missing required fields`);
      }
    });
    
    stmt.finalize();

    console.log(`✅ Successfully processed ${count} questions`);

    db.run("INSERT INTO uploaded_files (filename, original_name, uploaded_by, question_count) VALUES (?, ?, ?, ?)",
      [req.file.filename, req.file.originalname, req.user.username, count]);

    res.json({ 
      success: true, 
      added: count,
      filename: req.file.filename,
      originalName: req.file.originalname,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: "Error processing Excel file: " + error.message });
  }
});

app.get('/api/uploaded-files', auth('admin'), (req, res) => {
  db.all("SELECT * FROM uploaded_files ORDER BY uploaded_at DESC", [], (err, rows) => {
    if (err) {
      console.error('Error fetching uploaded files:', err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});

app.delete('/api/uploaded-file/:filename', auth('admin'), (req, res) => {
  const filename = req.params.filename;
  
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: "Invalid filename" });
  }
  
  db.serialize(() => {
    db.run("DELETE FROM questions WHERE excel_file = ?", [filename]);
    db.run("DELETE FROM uploaded_files WHERE filename = ?", [filename]);
    
    const filePath = path.join(__dirname, 'uploads', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    res.json({ success: true, message: 'File deleted successfully' });
  });
});

app.get('/api/questions', auth(), (req, res) => {
  const { subject, category, topic, level } = req.query;
  let sql = "SELECT * FROM questions WHERE 1=1";
  const params = [];
  
  if (subject) { sql += " AND subject = ?"; params.push(subject); }
  if (category) { sql += " AND category = ?"; params.push(category); }
  if (topic) { sql += " AND topic = ?"; params.push(topic); }
  if (level) { sql += " AND level = ?"; params.push(level); }
  
  sql += " ORDER BY created_at DESC";
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Error fetching questions:', err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});

app.get('/api/filters', auth(), (req, res) => {
  const queries = [
    "SELECT DISTINCT subject as value FROM questions WHERE subject IS NOT NULL AND subject != ''",
    "SELECT DISTINCT category as value FROM questions WHERE category IS NOT NULL AND category != ''", 
    "SELECT DISTINCT topic as value FROM questions WHERE topic IS NOT NULL AND topic != ''",
    "SELECT DISTINCT level as value FROM questions WHERE level IS NOT NULL AND level != ''"
  ];

  const keys = ['subjects', 'categories', 'topics', 'levels'];
  const results = {};

  let completed = 0;
  
  queries.forEach((query, index) => {
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error(`Error fetching ${keys[index]}:`, err);
        results[keys[index]] = [];
      } else {
        results[keys[index]] = rows.map(row => row.value).filter(val => val && val.trim());
      }
      
      completed++;
      if (completed === queries.length) {
        console.log('🎯 Filters loaded:', results);
        res.json(results);
      }
    });
  });
});

app.get('/api/stats', auth('admin'), (req, res) => {
  db.get("SELECT COUNT(*) as totalQuestions FROM questions", (err, qResult) => {
    if (err) {
      console.error('Error fetching question stats:', err);
      return res.status(500).json({ error: "Database error" });
    }
    
    db.get("SELECT COUNT(*) as totalStudents FROM users WHERE role = 'student'", (err, uResult) => {
      if (err) {
        console.error('Error fetching user stats:', err);
        return res.status(500).json({ error: "Database error" });
      }
      
      res.json({
        totalQuestions: qResult.totalQuestions,
        totalStudents: uResult.totalStudents
      });
    });
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/:page', (req, res) => {
  const page = req.params.page.replace('.html', '');
  const validPages = ['login', 'register', 'forgot-password', 'admin-dashboard', 'student-dashboard'];
  
  if (validPages.includes(page)) {
    res.sendFile(path.join(__dirname, 'public', `${page}.html`));
  } else {
    res.status(404).send('Page not found');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}/`);
});