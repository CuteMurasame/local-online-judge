// server.js (updated)
// Express + Nunjucks CP Platform (MySQL/MariaDB) - testcase files + contest editing + hide stdout
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const nunjucks = require('nunjucks');
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const app = express();
// Use multer for file uploads (destination handled by us)
const upload = multer({ dest: 'uploads/' });

// CONFIG
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'cp_platform';
const SESSION_SECRET = process.env.SESSION_SECRET || 'please-change-me';
const TESTCASE_BASE = path.join(__dirname, 'data', 'testcases'); // where testcase files are stored

// ensure directory exists
if (!fs.existsSync(TESTCASE_BASE)) fs.mkdirSync(TESTCASE_BASE, { recursive: true });

const pool = mysql.createPool({
  host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME,
  waitForConnections: true, connectionLimit: 10, queueLimit: 0, charset: 'utf8mb4'
});

// Nunjucks setup
const env = nunjucks.configure('views', { autoescape: true, express: app });
env.addFilter('fmtDate', ts => { if (!ts && ts !== 0) return ''; return new Date(Number(ts)).toLocaleString(); });
env.addFilter('truncate', function(str, length=200, killwords=false){
  if (!str) return '';
  str = String(str);
  if (str.length <= length) return str;
  if (killwords) return str.slice(0,length)+'...';
  const idx = str.lastIndexOf(' ', length);
  return (idx>0?str.slice(0,idx):str.slice(0,length)) + '...';
});

app.set('view engine', 'njk');
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(session({ secret: SESSION_SECRET, resave: false, saveUninitialized: false }));
app.use('/static', express.static(path.join(__dirname, 'static')));

// Init DB: create default admin if no users
(async function initDb(){
  try {
    const [rows] = await pool.query('SELECT COUNT(*) AS c FROM users');
    if ((rows[0] && rows[0].c) === 0) {
      const pwHash = await bcrypt.hash('admin', 10);
      await pool.query('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', ['admin', pwHash, 'admin']);
      console.log('Created default admin/admin (change password manually in database!).');
    }
  } catch (e) {
    console.error('DB init error. Did you run init_db.sql?');
    console.error(e);
    process.exit(1);
  }
})();

// session -> res.locals.user
app.use(async (req, res, next) => {
  res.locals.user = null;
  try {
    if (req.session.userId) {
      const [rows] = await pool.query('SELECT id, username, role FROM users WHERE id = ?', [req.session.userId]);
      res.locals.user = rows[0] || null;
    }
  } catch (e) { console.error(e); }
  next();
});

function ensureLogin(req, res, next) { if (!req.session.userId) return res.redirect('/login'); next(); }
async function ensureAdmin(req, res, next) { if (!res.locals.user || res.locals.user.role !== 'admin') return res.status(403).send('Admin only'); next(); }
const pidRegex = /^[A-Za-z0-9_]+$/;

// ---------- Routes (important ones only shown in full) ----------

// Index
app.get('/', async (req, res) => {
  const [contests] = await pool.query('SELECT * FROM contests ORDER BY start_ts DESC');
  const [problems] = await pool.query('SELECT id, title FROM problems ORDER BY id');
  res.render('index.njk', { contests, problems });
});

// Auth routes (login/register/logout) - same as before
app.get('/login', (req,res) => res.render('login.njk',{error:null}));
app.post('/login', async (req,res) => {
  const { username, password } = req.body;
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  const user = rows[0];
  if (!user) return res.render('login.njk', { error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.render('login.njk', { error: 'Invalid credentials' });
  req.session.userId = user.id; res.redirect('/');
});
app.get('/logout', (req,res)=>{ req.session.destroy(()=>res.redirect('/')); });

// ---------- Admin: problems ----------

// List problems
app.get('/admin/problems', ensureAdmin, async (req,res) => {
  const [problems] = await pool.query('SELECT * FROM problems ORDER BY id');
  res.render('admin_problems.njk', { problems });
});

// Create
app.get('/admin/problems/create', ensureAdmin, (req,res)=>res.render('admin_create_problem.njk',{error:null}));
app.post('/admin/problems/create', ensureAdmin, upload.none(), async (req,res) => {
  const { id, title, statement, timelimit_ms, memlimit_kb, score, visibility } = req.body;
  if (!pidRegex.test(id)) return res.render('admin_create_problem.njk',{error:'Invalid id'});
  try {
    await pool.query('INSERT INTO problems (id, title, statement, timelimit_ms, memlimit_kb, score, visibility) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, title, statement, parseInt(timelimit_ms)||2000, parseInt(memlimit_kb)||65536, parseInt(score)||100, visibility==='contest' ? 'contest' : 'public']);
    res.redirect('/admin/problems');
  } catch(e) { console.error(e); res.render('admin_create_problem.njk',{error:'Error creating problem'}); }
});

// Edit page (shows testcase filenames only)
app.get('/admin/problems/:id', ensureAdmin, async (req,res) => {
  const id = req.params.id;
  const [pRows] = await pool.query('SELECT * FROM problems WHERE id = ?', [id]);
  if (!pRows[0]) return res.sendStatus(404);
  const problem = pRows[0];
  const [tests] = await pool.query('SELECT id, input_path, output_path, input_name, output_name, input_size, output_size FROM testcases WHERE problem_id = ? ORDER BY id', [id]);
  res.render('admin_edit_problem.njk', { problem, tests, error: null });
});

app.post('/admin/problems/:id/edit', ensureAdmin, upload.none(), async (req,res) => {
  const id = req.params.id;
  const { title, statement, timelimit_ms, memlimit_kb, score, visibility } = req.body;
  await pool.query('UPDATE problems SET title=?, statement=?, timelimit_ms=?, memlimit_kb=?, score=?, visibility=? WHERE id=?',
    [title, statement, parseInt(timelimit_ms)||2000, parseInt(memlimit_kb)||65536, parseInt(score)||100, visibility==='contest' ? 'contest':'public', id]);
  res.redirect(`/admin/problems/${id}`);
});

// Add testcase: supports file upload OR text input/output
app.post('/admin/problems/:id/add_test', ensureAdmin, upload.fields([{name:'input_file'},{name:'output_file'}]), async (req,res) => {
  const id = req.params.id;
  const files = req.files || {};
  const inputFile = (files.input_file && files.input_file[0]) || null;
  const outputFile = (files.output_file && files.output_file[0]) || null;
  const inputText = req.body.input_text;
  const outputText = req.body.output_text;

  // ensure directory per problem
  const problemDir = path.join(TESTCASE_BASE, id);
  if (!fs.existsSync(problemDir)) fs.mkdirSync(problemDir, { recursive: true });

  let input_path=null, output_path=null, input_name=null, output_name=null, input_size=0, output_size=0;

  if (inputFile) {
    // move from multer tmp to problemDir with a safe name
    const newInputName = uuidv4() + '_' + (inputFile.originalname || 'input');
    const newInputPath = path.join(problemDir, newInputName);
    fs.renameSync(inputFile.path, newInputPath);
    input_path = path.relative(__dirname, newInputPath);
    input_name = inputFile.originalname;
    input_size = inputFile.size;
  } else if (inputText) {
    const newInputName = uuidv4() + '_input.txt';
    const newInputPath = path.join(problemDir, newInputName);
    fs.writeFileSync(newInputPath, inputText, 'utf8');
    input_path = path.relative(__dirname, newInputPath);
    input_name = 'inline';
    input_size = Buffer.byteLength(inputText, 'utf8');
  }

  if (outputFile) {
    const newOutputName = uuidv4() + '_' + (outputFile.originalname || 'output');
    const newOutputPath = path.join(problemDir, newOutputName);
    fs.renameSync(outputFile.path, newOutputPath);
    output_path = path.relative(__dirname, newOutputPath);
    output_name = outputFile.originalname;
    output_size = outputFile.size;
  } else if (outputText) {
    const newOutputName = uuidv4() + '_output.txt';
    const newOutputPath = path.join(problemDir, newOutputName);
    fs.writeFileSync(newOutputPath, outputText, 'utf8');
    output_path = path.relative(__dirname, newOutputPath);
    output_name = 'inline';
    output_size = Buffer.byteLength(outputText, 'utf8');
  }

  // require both input and output at least
  if (!input_path || !output_path) {
    // cleanup any uploaded file left in tmp
    if (inputFile && fs.existsSync(inputFile.path)) fs.unlinkSync(inputFile.path);
    if (outputFile && fs.existsSync(outputFile.path)) fs.unlinkSync(outputFile.path);
    return res.redirect(`/admin/problems/${id}?err=need-both`);
  }

  await pool.query('INSERT INTO testcases (problem_id, input_path, output_path, input_name, output_name, input_size, output_size) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, input_path, output_path, input_name, output_name, input_size, output_size]);
  res.redirect(`/admin/problems/${id}`);
});

// Import tests file (the old textual format) — will create individual test files in problemDir
app.post('/admin/problems/:id/import_tests', ensureAdmin, upload.single('file'), async (req,res) => {
  const id = req.params.id;
  if (!req.file) return res.redirect(`/admin/problems/${id}?err=no-file`);
  const content = fs.readFileSync(req.file.path, 'utf8');
  fs.unlinkSync(req.file.path);
  const blocks = content.split(/\n---TESTCASE---\n/);
  const problemDir = path.join(TESTCASE_BASE, id);
  if (!fs.existsSync(problemDir)) fs.mkdirSync(problemDir, { recursive: true });
  for (const b of blocks) {
    const parts = b.split(/\n---OUTPUT---\n/);
    if (parts.length === 2) {
      const input = parts[0].replace(/\r/g,'');
      const output = parts[1].replace(/\r/g,'');
      const inName = uuidv4() + '_input.txt';
      const outName = uuidv4() + '_output.txt';
      const inPath = path.join(problemDir, inName);
      const outPath = path.join(problemDir, outName);
      fs.writeFileSync(inPath, input, 'utf8');
      fs.writeFileSync(outPath, output, 'utf8');
      await pool.query('INSERT INTO testcases (problem_id, input_path, output_path, input_name, output_name, input_size, output_size) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, path.relative(__dirname, inPath), path.relative(__dirname, outPath), 'imported', 'imported', Buffer.byteLength(input,'utf8'), Buffer.byteLength(output,'utf8')]);
    }
  }
  res.redirect(`/admin/problems/${id}`);
});

// ---------- Admin: contests (list, create, edit) ----------

app.get('/admin/contests', ensureAdmin, async (req,res) => {
  const [contests] = await pool.query('SELECT * FROM contests ORDER BY start_ts DESC');
  const [problems] = await pool.query('SELECT id, title FROM problems ORDER BY id');
  res.render('admin_contests.njk', { contests, problems });
});

app.get('/admin/contests/create', ensureAdmin, async (req,res) => {
  const [problems] = await pool.query('SELECT id, title FROM problems ORDER BY id');
  res.render('admin_create_contest.njk', { problems, error: null });
});

app.post('/admin/contests/create', ensureAdmin, upload.none(), async (req,res) => {
  const { title, start_iso, end_iso, problem_ids } = req.body;
  const start_ts = Date.parse(start_iso);
  const end_ts = Date.parse(end_iso);
  if (isNaN(start_ts) || isNaN(end_ts) || end_ts <= start_ts) {
    const [problems] = await pool.query('SELECT id, title FROM problems ORDER BY id');
    return res.render('admin_create_contest.njk', { problems, error: 'Bad dates' });
  }
  const [r] = await pool.query('INSERT INTO contests (title, start_ts, end_ts) VALUES (?, ?, ?)', [title, start_ts, end_ts]);
  const cid = r.insertId;
  const pids = Array.isArray(problem_ids) ? problem_ids : (problem_ids ? [problem_ids] : []);
  let ordinal = 1;
  for (const pid of pids) {
    await pool.query('INSERT INTO contest_problems (contest_id, problem_id, ordinal) VALUES (?, ?, ?)', [cid, pid, ordinal++]);
  }
  res.redirect('/admin/contests');
});

// Edit contest (GET + POST)
app.get('/admin/contests/:id/edit', ensureAdmin, async (req,res) => {
  const cid = req.params.id;
  const [cr] = await pool.query('SELECT * FROM contests WHERE id = ?', [cid]);
  const contest = cr[0];
  if (!contest) return res.sendStatus(404);
  const [problems] = await pool.query('SELECT id, title FROM problems ORDER BY id');
  // find currently selected problems
  const [selected] = await pool.query('SELECT problem_id FROM contest_problems WHERE contest_id = ? ORDER BY ordinal', [cid]);
  const selectedIds = selected.map(x => x.problem_id);
  res.render('admin_edit_contest.njk', { contest, problems, selectedIds, error: null });
});

app.post('/admin/contests/:id/edit', ensureAdmin, upload.none(), async (req,res) => {
  const cid = req.params.id;
  const { title, start_iso, end_iso, problem_ids } = req.body;
  const start_ts = Date.parse(start_iso);
  const end_ts = Date.parse(end_iso);
  if (isNaN(start_ts) || isNaN(end_ts) || end_ts <= start_ts) {
    const [problems] = await pool.query('SELECT id, title FROM problems ORDER BY id');
    return res.render('admin_create_contest.njk', { problems, error: 'Bad dates' });
  }
  await pool.query('UPDATE contests SET title=?, start_ts=?, end_ts=? WHERE id=?', [title, start_ts, end_ts, cid]);
  // replace contest_problems
  await pool.query('DELETE FROM contest_problems WHERE contest_id = ?', [cid]);
  const pids = Array.isArray(problem_ids) ? problem_ids : (problem_ids ? [problem_ids] : []);
  let ordinal = 1;
  for (const pid of pids) {
    await pool.query('INSERT INTO contest_problems (contest_id, problem_id, ordinal) VALUES (?, ?, ?)', [cid, pid, ordinal++]);
  }
  res.redirect('/admin/contests');
});

// ---------- Contest overview ----------

app.get('/contests/:id', ensureLogin, async (req,res) => {
  const cid = req.params.id;
  const [contestRows] = await pool.query('SELECT * FROM contests WHERE id = ?', [cid]);
  const contest = contestRows[0];
  if (!contest) return res.sendStatus(404);
  const [problems] = await pool.query('SELECT p.* FROM contest_problems cp JOIN problems p ON cp.problem_id = p.id WHERE cp.contest_id = ? ORDER BY cp.ordinal', [cid]);
  const now = Date.now();
  const is_running = now >= contest.start_ts && now <= contest.end_ts;
  const [regRows] = await pool.query('SELECT * FROM registrations WHERE contest_id = ? AND user_id = ?', [cid, req.session.userId]);
  const registered = regRows.length > 0;
  res.render('contest_view.njk', { contest, problems, is_running, registered });
});

// register (POST)
app.post('/contests/:id/register', ensureLogin, upload.none(), async (req,res) => {
  const cid = req.params.id;
  try {
    await pool.query('INSERT IGNORE INTO registrations (contest_id, user_id, unrated) VALUES (?, ?, 1)', [cid, req.session.userId]);
    res.redirect(`/contests/${cid}`);
  } catch (e) { console.error(e); res.status(500).send('Server error'); }
});

// ---------- Contest problem page (view + submit area) ----------

app.get('/contest/:cid/problem/:pid', ensureLogin, async (req,res) => {
  const { cid, pid } = req.params;
  const [contestRows] = await pool.query('SELECT * FROM contests WHERE id = ?', [cid]);
  const contest = contestRows[0];
  if (!contest) return res.sendStatus(404);
  const [cp] = await pool.query('SELECT * FROM contest_problems WHERE contest_id = ? AND problem_id = ?', [cid, pid]);
  if (!cp.length) return res.status(404).send('Problem not in contest');
  const [regRows] = await pool.query('SELECT * FROM registrations WHERE contest_id = ? AND user_id = ?', [cid, req.session.userId]);
  const registered = regRows.length > 0;
  if (!registered && !(res.locals.user && res.locals.user.role === 'admin')) return res.status(403).send('Register for contest to access problems');
  const [pRows] = await pool.query('SELECT * FROM problems WHERE id = ?', [pid]);
  const problem = pRows[0];
  if (!problem) return res.sendStatus(404);

  const [subs] = await pool.query('SELECT id, status, score, created_ts, compile_error FROM submissions WHERE contest_id = ? AND user_id = ? AND problem_id = ? ORDER BY created_ts DESC', [cid, req.session.userId, pid]);
  res.render('problem_view.njk', { problem, contest, registered, submissions: subs });
});

// ---------- Problem for root ----------------

app.get('/problem/:pid', ensureLogin, async (req,res) => {
  const { pid } = req.params;
  if (!(res.locals.user.role === 'admin')) return res.status(403).send('Permission denied');
  const [pRows] = await pool.query('SELECT * FROM problems WHERE id = ?', [pid]);
  const problem = pRows[0];
  if (!problem) return res.sendStatus(404);

  const [subs] = await pool.query('SELECT id, status, score, created_ts, compile_error FROM submissions WHERE user_id = ? AND problem_id = ? ORDER BY created_ts DESC', [req.session.userId, pid]);
  res.render('problem_view_admin.njk', { problem, submissions: subs });
});

// ---------- Submission endpoint (supports cpp compile) ----------

app.post('/contest/:cid/problem/:pid/submit', ensureLogin, upload.none(), async (req,res) => {
  const { cid, pid } = req.params;
  const { language, source } = req.body;
  const [contestRows] = await pool.query('SELECT * FROM contests WHERE id = ?', [cid]);
  const contest = contestRows[0];
  if (!contest) return res.sendStatus(404);
  const now = Date.now();
  if (!(now >= contest.start_ts && now <= contest.end_ts)) return res.send('Contest not running');
  const [cp] = await pool.query('SELECT * FROM contest_problems WHERE contest_id = ? AND problem_id = ?', [cid, pid]);
  if (!cp.length) return res.status(404).send('Problem not in contest');

  const created_ts = Date.now();
  const [ins] = await pool.query('INSERT INTO submissions (user_id, contest_id, problem_id, language, source, status, score, created_ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [req.session.userId, cid, pid, language, source, 'judging', 0, created_ts]);
  const submission_id = ins.insertId;

  // Fetch problem and testcases
  const [pRows] = await pool.query('SELECT * FROM problems WHERE id = ?', [pid]);
  const problem = pRows[0];
  const [tests] = await pool.query('SELECT * FROM testcases WHERE problem_id = ? ORDER BY id', [pid]);

  // Judge asynchronously (fire-and-forget but we wrote submission record already)
  (async () => {
    try {
      let compileError = false, compileOutput = '', exePath = null;
      const workdir = path.join(__dirname, 'tmp_runs');
      if (!fs.existsSync(workdir)) fs.mkdirSync(workdir, { recursive: true });
      const runId = uuidv4();
      const srcExt = language === 'cpp' ? '.cpp' : (language === 'python' ? '.py' : (language === 'node' ? '.js' : '.txt'));
      const srcFile = path.join(workdir, runId + srcExt);
      fs.writeFileSync(srcFile, source);

      // Compile if C++
      if (language === 'cpp') {
        // compile using requested command: g++ <srcFile> -o <binPath> -std=c++26 -O2 -lm
        const binPath = path.join(workdir, runId + '_bin');
        await new Promise((resolve, reject) => {
          const cp = spawn('g++', [srcFile, '-o', binPath, '-std=c++26', '-O2', '-lm'], { cwd: workdir, timeout: 20000 });
          let cout='', cerr='';
          cp.stdout.on('data', d=>cout+=d.toString());
          cp.stderr.on('data', d=>cerr+=d.toString());
          cp.on('error', e=>reject(e));
          cp.on('close', code => {
            compileOutput = cout + '\n' + cerr;
            if (code !== 0) { compileError = true; resolve(); } else { exePath = binPath; resolve(); }
          });
        });
      }

      if (compileError) {
        await pool.query('UPDATE submissions SET status=?, score=?, compile_error=1, compile_output=? WHERE id=?',
          ['CE', 0, compileOutput, submission_id]);
        await pool.query('INSERT INTO attempts (contest_id, user_id, problem_id, submission_id, is_ac, is_compile_error, created_ts) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [cid, req.session.userId, pid, submission_id, 0, 1, Date.now()]);
        return;
      }

      // run all tests (reading test input/output from files)
      const perTest = [];
      let allPassed = true;
      let maxRuntime = 0;
      for (let i=0;i<tests.length;i++) {
        const t = tests[i];
        // read input and expected output from file
        const inPath = path.join(__dirname, t.input_path);
        const outPath = path.join(__dirname, t.output_path);
        let inputData = '';
        let expected = '';
        try {
          inputData = fs.readFileSync(inPath, 'utf8');
        } catch(e){ inputData = ''; }
        try {
          expected = fs.readFileSync(outPath, 'utf8');
        } catch(e){ expected = ''; }
        // run process depending on language
        const timelimit = problem.timelimit_ms || 2000;
        const start = Date.now();
        let resObj = null;
        try {
          if (language === 'cpp') {
            resObj = await runProcess(exePath, [], inputData, timelimit);
          } else if (language === 'python') {
            resObj = await runProcess('python3', [srcFile], inputData, timelimit);
          } else {
            perTest.push({ index: i+1, verdict: 'SystemError', runtime_ms: 0, stderr: 'Unsupported language' });
            allPassed = false;
            continue;
          }
        } catch (e) {
          perTest.push({ index: i+1, verdict: 'SystemError', runtime_ms: 0, stderr: String(e) });
          allPassed = false;
          continue;
        }
        const runtime_ms = resObj.runtime_ms;
        maxRuntime = Math.max(maxRuntime, runtime_ms);
        let verdict = 'AC';
        if (resObj.timedOut) {
          verdict = 'TLE'; allPassed = false;
        } else if ((resObj.stderr||'').trim()) {
          verdict = 'RE'; allPassed = false;
        } else {
          const got = String(resObj.stdout||'').replace(/\r/g,'').trim();
          const want = String(expected||'').replace(/\r/g,'').trim();
          if (got !== want) { verdict='WA'; allPassed = false; }
        }
        perTest.push({ index: i+1, verdict, runtime_ms, stderr: resObj.stderr || '' }); // do NOT store/display stdout
      }

      const finalScore = perTest.every(r=>r.verdict==='AC') ? (problem.score||100) : 0;
      const finalStatus = perTest.every(r=>r.verdict==='AC') ? 'AC' : perTest.find(r=>r.verdict==='TLE') ? 'TLE' : perTest.find(r=>r.verdict==='RE') ? 'RE' : 'WA';
      await pool.query('UPDATE submissions SET status=?, score=?, runtime_ms=?, message=?, result_json=? WHERE id=?',
        [finalStatus, finalScore, maxRuntime, (perTest.find(r=>r.verdict!=='AC') || {}).verdict || '', JSON.stringify(perTest), submission_id]);
      await pool.query('INSERT INTO attempts (contest_id, user_id, problem_id, submission_id, is_ac, is_compile_error, created_ts) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [cid, req.session.userId, pid, submission_id, (finalScore>0?1:0), 0, Date.now()]);
    } catch(e) {
      console.error('Judge error', e);
      await pool.query('UPDATE submissions SET status=?, score=?, message=? WHERE id=?', ['SystemError', 0, String(e), submission_id]);
      await pool.query('INSERT INTO attempts (contest_id, user_id, problem_id, submission_id, is_ac, is_compile_error, created_ts) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [cid, req.session.userId, pid, submission_id, 0, 0, Date.now()]);
    }
  })();

  res.redirect(`/contests/${cid}/submissions?problem=${pid}`);
});

// Robust runProcess — replace your existing runProcess with this
function runProcess(cmd, args, input, timelimitMs) {
  return new Promise((resolve) => {
    const startNs = process.hrtime.bigint();
    let child;
    try {
      child = spawn(cmd, args, { stdio: ['pipe','pipe','pipe'] });
    } catch (err) {
      const endNs = process.hrtime.bigint();
      const runtime_ms = Number(endNs - startNs) / 1e6;
      return resolve({
        code: null,
        stdout: '',
        stderr: String(err),
        runtime_ms,
        timedOut: false,
        signal: null
      });
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // --- IMPORTANT: attach error handlers to child streams to avoid unhandled 'error' (EPIPE)
    const streamErrHandler = (err) => {
      // swallow common pipe errors (EPIPE) — but capture non-EPIPE for debugging
      if (err && err.code && err.code !== 'EPIPE') {
        stderr += `\n[stream error] ${String(err)}`;
      }
      // do NOT throw here; we want to keep running and let child.close settle
    };
    if (child.stdin)  child.stdin.on('error', streamErrHandler);
    if (child.stdout) child.stdout.on('error', streamErrHandler);
    if (child.stderr) child.stderr.on('error', streamErrHandler);

    // killer: give a small margin (110%) then SIGKILL
    const killAfter = typeof timelimitMs === 'number' ? Math.max(1, Math.floor(timelimitMs * 1.1)) : 60_000;
    const killer = setTimeout(() => {
      timedOut = true;
      try { child.kill('SIGKILL'); } catch (e) {}
    }, killAfter);
    if (killer.unref) killer.unref();

    if (child.stdout) child.stdout.on('data', (d) => { stdout += d.toString(); });
    if (child.stderr) child.stderr.on('data', (d) => { stderr += d.toString(); });

    // Safely write input (handle writable flag and drain; swallow write errors)
    try {
      if (input && input.length) {
        if (child.stdin && child.stdin.writable) {
          const ok = child.stdin.write(input, () => {
            try { child.stdin.end(); } catch (_) {}
          });
          if (!ok && child.stdin) {
            child.stdin.once('drain', () => {
              try { child.stdin.end(); } catch (_) {}
            });
          }
        } else {
          try { child.stdin && child.stdin.end(); } catch (_) {}
        }
      } else {
        try { child.stdin && child.stdin.end(); } catch (_) {}
      }
    } catch (e) {
      // ignore write-time exceptions (EPIPE etc.)
      try { child.stdin && child.stdin.end(); } catch (_) {}
    }

    child.on('error', (err) => {
      clearTimeout(killer);
      const endNs = process.hrtime.bigint();
      const runtime_ms = Number(endNs - startNs) / 1e6;
      return resolve({
        code: null,
        stdout,
        stderr: String(err),
        runtime_ms,
        timedOut,
        signal: null
      });
    });

    child.on('close', (code, signal) => {
      clearTimeout(killer);
      const endNs = process.hrtime.bigint();
      const runtime_ms = Number(endNs - startNs) / 1e6;
      if (runtime_ms > timelimitMs) timedOut = true;
      return resolve({
        code,
        stdout,
        stderr,
        runtime_ms,
        timedOut,
        signal
      });
    });
  });
}




// ---------- Submissions list and detail ----------

app.get('/contests/:cid/submissions', ensureLogin, async (req,res) => {
  const cid = req.params.cid;
  const problem = req.query.problem;
  const isAdmin = res.locals.user && res.locals.user.role === 'admin';
  let sql = 'SELECT s.*, u.username FROM submissions s LEFT JOIN users u ON u.id = s.user_id WHERE s.contest_id = ?';
  const params = [cid];
  if (problem) { sql += ' AND s.problem_id = ?'; params.push(problem); }
  if (!isAdmin) { sql += ' AND s.user_id = ?'; params.push(req.session.userId); }
  sql += ' ORDER BY s.created_ts DESC LIMIT 200';
  const [rows] = await pool.query(sql, params);
  res.render('submissions_list.njk', { contest_id: cid, submissions: rows });
});

app.get('/submission/:id', ensureLogin, async (req,res) => {
  const id = req.params.id;
  const [rows] = await pool.query('SELECT s.*, u.username FROM submissions s LEFT JOIN users u ON u.id = s.user_id WHERE s.id = ?', [id]);
  if (!rows[0]) return res.sendStatus(404);
  const s = rows[0];
  if (!(res.locals.user && res.locals.user.role === 'admin') && s.user_id !== req.session.userId) return res.status(403).send('Forbidden');
  let results = null;
  try { results = s.result_json ? JSON.parse(s.result_json) : null; } catch(e) { results = null; }
  // do NOT include stdout in the view; results objects contain stderr/runtime/verdict only
  res.render('submission_view.njk', { sub: s, results });
});

// ---------- Scoreboard and other routes unchanged (use same logic as before) ----------
/* ... (keep your existing scoreboard route here unchanged except it will use attempts, submissions as stored) ... */

// For brevity, include the scoreboard route from your existing server.js (unchanged)
// (If you want I can paste the scoreboard code here again — tell me and I will.)

// -------- scoreboard with detailed per-problem cells --------
app.get('/contests/:id/scoreboard', ensureLogin, async (req, res) => {
  const cid = req.params.id;
  const [contestRows] = await pool.query('SELECT * FROM contests WHERE id = ?', [cid]);
  const contest = contestRows[0];
  if (!contest) return res.sendStatus(404);
  const [problems] = await pool.query('SELECT cp.ordinal, p.* FROM contest_problems cp JOIN problems p ON cp.problem_id = p.id WHERE cp.contest_id = ? ORDER BY cp.ordinal', [cid]);

  // users: those who registered OR made submissions
  const [regs] = await pool.query('SELECT u.id, u.username FROM users u JOIN registrations r ON r.user_id = u.id WHERE r.contest_id = ?', [cid]);
  let users = regs;
  if (users.length === 0) {
    const [subsUsers] = await pool.query('SELECT DISTINCT u.id, u.username FROM users u JOIN submissions s ON s.user_id = u.id WHERE s.contest_id = ?', [cid]);
    users = subsUsers;
  }

  const scoreboard = [];
  for (const u of users) {
    let totalScore = 0;
    let totalPenaltySeconds = 0;
    const perProblemCells = []; // for UI: contains { displayText, scoreValue, triesBeforeAc }
    for (const p of problems) {
      // find all submissions for this user/problem ordered by created_ts asc
      const [subs] = await pool.query('SELECT * FROM submissions WHERE contest_id = ? AND user_id = ? AND problem_id = ? ORDER BY created_ts ASC', [cid, u.id, p.id]);
      if (subs.length === 0) {
        perProblemCells.push({ display: '-', score: 0, tries: 0, status: 'no_submit' });
        continue;
      }
      // Count non-CE attempts before first AC
      let firstAc = null;
      let firstAcTs = null;
      let triesBeforeAc = 0;
      for (const s of subs) {
        if (s.compile_error) {
          // compile errors do not count towards tries
          continue;
        }
        if (s.status === 'AC') {
          firstAc = s;
          firstAcTs = s.created_ts;
          break;
        } else {
          triesBeforeAc++;
        }
      }
      if (!firstAc) {
        // no AC but there were submissions; check if any non-CE submit exists -> show red (TRIES)
        const anyNonCE = subs.some(s => !s.compile_error);
        const tries = anyNonCE ? subs.filter(s => !s.compile_error).length : 0;
        perProblemCells.push({ display: `(TRIES)`, score: 0, tries, status: 'tried_no_ac' });
      } else {
        const problemScore = p.score || 0;
        totalScore += problemScore;
        // penalty: time from contest.start to firstAc (in seconds) + 5min per wrong attempt (seconds)
        const secondsToAc = Math.max(0, Math.floor((firstAcTs - contest.start_ts) / 1000));
        const wrongCount = triesBeforeAc;
        totalPenaltySeconds += secondsToAc + (wrongCount * 5 * 60);
        // build display: green SCORE and red (TRIES) unless pass@1
        const showTries = wrongCount > 0;
        const disp = showTries ? `${problemScore} (${wrongCount})` : `${problemScore}`;
        perProblemCells.push({ display: disp, score: problemScore, tries: wrongCount, status: 'ac' });
      }
    }

    scoreboard.push({
      user: u,
      totalScore,
      totalPenaltySeconds,
      perProblemCells
    });
  }

  // sort by totalScore desc, totalPenaltySeconds asc
  scoreboard.sort((a,b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.totalPenaltySeconds - b.totalPenaltySeconds;
  });

  // Convert totalPenaltySeconds to MM:SS for display
  for (const row of scoreboard) {
    const s = row.totalPenaltySeconds || 0;
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    row.totalPenaltyDisplay = `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  }

  res.render('scoreboard.njk', { contest, problems, scoreboard });
});

// ----------------- auth routes and index -----------------
app.get('/', async (req, res) => {
  const [contests] = await pool.query('SELECT * FROM contests ORDER BY start_ts DESC');
  const [problems] = await pool.query('SELECT id, title FROM problems ORDER BY id');
  res.render('index.njk', { contests, problems });
});

app.get('/login', (req,res) => res.render('login.njk', { error: null }));
app.post('/login', async (req,res) => {
  const { username, password } = req.body;
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  const user = rows[0];
  if (!user) return res.render('login.njk', { error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.render('login.njk', { error: 'Invalid credentials' });
  req.session.userId = user.id;
  res.redirect('/');
});
app.get('/logout', (req,res) => { req.session.destroy(()=>res.redirect('/')); });

app.get('/register', (req,res) => res.render('register.njk', { error: null }));
app.post('/register', async (req,res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.render('register.njk', { error: 'Missing fields' });
  try {
    const pwHash = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, pwHash, 'user']);
    res.redirect('/login');
  } catch (e) {
    console.error(e);
    res.render('register.njk', { error: 'Username taken or DB error' });
  }
});
// app.post('/register', async (req,res) => {
//   res.render('register.njk', { error: 'Registration closed. Contact website admin for an account.' });
// });
// ---------- Bulk import (admin) ----------
// Allowed root for bulk imports: by default project root; override with BULK_ROOT env var
const BULK_ROOT = process.env.BULK_ROOT ? path.resolve(process.env.BULK_ROOT) : path.resolve(process.cwd());
console.log('Bulk import root:', BULK_ROOT);

// Helper: recursively scan directory for files
async function scanDirForFiles(rootDir) {
  const results = [];
  async function walk(dir) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
      } else if (ent.isFile()) {
        results.push(full);
      }
    }
  }
  await walk(rootDir);
  return results;
}

// Helper: find input-output pairs from a list of files
function matchPairs(files) {
  // normalized ext lists
  const inputExts = ['.in', '.inp', '.input', '.txt']; // allow .txt as potential input
  const outputExts = ['.ans', '.out', '.answer', '.expected', '.txt'];

  // build map by basename without extension
  const map = new Map(); // key -> { inputs:[], outputs:[] }
  for (const f of files) {
    const base = path.basename(f);
    const ext = path.extname(base).toLowerCase();
    const nameNoExt = base.slice(0, base.length - ext.length);
    if (!map.has(nameNoExt)) map.set(nameNoExt, { inputs: [], outputs: [] });
    const entry = map.get(nameNoExt);
    if (inputExts.includes(ext)) entry.inputs.push(f);
    if (outputExts.includes(ext)) entry.outputs.push(f);
  }

  // produce pairs for entries that have at least one input and one output
  const pairs = [];
  for (const [key, val] of map.entries()) {
    for (const inp of val.inputs) {
      // prefer output with same key; choose first available output
      const out = val.outputs.length ? val.outputs[0] : null;
      if (out) pairs.push({ key, input: inp, output: out });
    }
  }
  return pairs;
}

// GET bulk import page: form to choose problem + directory
app.get('/admin/bulk_import', ensureAdmin, async (req, res) => {
  const [problems] = await pool.query('SELECT id, title FROM problems ORDER BY id');
  res.render('admin_bulk_import.njk', { problems, preview: null, error: null });
});

// POST scan: scan the directory (server-side) and show preview (no DB changes)
app.post('/admin/bulk_import/scan', ensureAdmin, async (req, res) => {
  const { dir_path, problem_id } = req.body;
  if (!dir_path || !problem_id) {
    const [problems] = await pool.query('SELECT id, title FROM problems ORDER BY id');
    return res.render('admin_bulk_import.njk', { problems, preview: null, error: 'Missing directory or problem' });
  }

  // resolve the path and enforce it is inside BULK_ROOT
  const resolved = path.resolve(dir_path);
  if (false && !resolved.startsWith(BULK_ROOT)) {
    const [problems] = await pool.query('SELECT id, title FROM problems ORDER BY id');
    return res.render('admin_bulk_import.njk', { problems, preview: null, error: `Directory must be inside allowed root: ${BULK_ROOT}` });
  }

  // ensure exists and is directory
  try {
    const st = await fs.promises.stat(resolved);
    if (!st.isDirectory()) throw new Error('Not a directory');
  } catch (e) {
    const [problems] = await pool.query('SELECT id, title FROM problems ORDER BY id');
    return res.render('admin_bulk_import.njk', { problems, preview: null, error: 'Directory not found or inaccessible' });
  }

  // scan
  let files = [];
  try {
    files = await scanDirForFiles(resolved);
  } catch (e) {
    console.error('Scan error', e);
    const [problems] = await pool.query('SELECT id, title FROM problems ORDER BY id');
    return res.render('admin_bulk_import.njk', { problems, preview: null, error: 'Error scanning directory' });
  }

  const pairs = matchPairs(files);

  // Build preview structure: list of { input_rel, output_rel, input_name, output_name, input_size, output_size }
  const preview = [];
  for (const p of pairs) {
    try {
      const inStat = await fs.promises.stat(p.input);
      const outStat = await fs.promises.stat(p.output);
      preview.push({
        input: p.input,
        output: p.output,
        input_name: path.basename(p.input),
        output_name: path.basename(p.output),
        input_size: inStat.size,
        output_size: outStat.size
      });
    } catch (e) {
      // skip if stat fails
    }
  }

  // store preview temporarily as JSON file (keyed by uuid) so commit can use it
  const previewId = uuidv4();
  const tmpDir = path.join(__dirname, 'tmp', 'bulk_previews');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const previewFile = path.join(tmpDir, previewId + '.json');
  fs.writeFileSync(previewFile, JSON.stringify({ problem_id, dir_path: resolved, items: preview }, null, 2), 'utf8');

  const [problems] = await pool.query('SELECT id, title FROM problems ORDER BY id');
  res.render('admin_bulk_import.njk', { problems, preview: { id: previewId, items: preview, problem_id, dir_path: resolved }, error: null });
});

// POST commit: import previewed pairs into the selected problem
app.post('/admin/bulk_import/commit', ensureAdmin, async (req, res) => {
  const { preview_id } = req.body;
  if (!preview_id) return res.status(400).send('Missing preview id');
  const tmpDir = path.join(__dirname, 'tmp', 'bulk_previews');
  const previewFile = path.join(tmpDir, preview_id + '.json');
  if (!fs.existsSync(previewFile)) return res.status(404).send('Preview not found or expired');
  const data = JSON.parse(fs.readFileSync(previewFile, 'utf8'));
  const problemId = data.problem_id;
  const items = data.items || [];

  // verify problem exists
  const [pRows] = await pool.query('SELECT id FROM problems WHERE id = ?', [problemId]);
  if (!pRows.length) return res.status(400).send('Problem not found');

  const problemDir = path.join(TESTCASE_BASE, problemId);
  if (!fs.existsSync(problemDir)) fs.mkdirSync(problemDir, { recursive: true });

  const inserted = [];
  for (const it of items) {
    try {
      const inSrc = it.input;
      const outSrc = it.output;
      const inName = uuidv4() + '_' + path.basename(inSrc);
      const outName = uuidv4() + '_' + path.basename(outSrc);
      const inDest = path.join(problemDir, inName);
      const outDest = path.join(problemDir, outName);
      // copy files
      await fs.promises.copyFile(inSrc, inDest);
      await fs.promises.copyFile(outSrc, outDest);
      const inStat = await fs.promises.stat(inDest);
      const outStat = await fs.promises.stat(outDest);
      const relativeIn = path.relative(__dirname, inDest);
      const relativeOut = path.relative(__dirname, outDest);
      await pool.query('INSERT INTO testcases (problem_id, input_path, output_path, input_name, output_name, input_size, output_size) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [problemId, relativeIn, relativeOut, it.input_name || path.basename(inSrc), it.output_name || path.basename(outSrc), inStat.size, outStat.size]);
      inserted.push({ input: relativeIn, output: relativeOut });
    } catch (e) {
      console.error('Import item failed', e);
      // continue with rest
    }
  }

  // remove preview file to avoid accidental re-commit
  try { fs.unlinkSync(previewFile); } catch(e){}

  // redirect to problem edit page
  res.redirect(`/admin/problems/${problemId}`);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running http://localhost:${PORT}`));
