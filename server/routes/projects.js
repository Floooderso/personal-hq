const express = require('express');
const db = require('../db/database');
const { logActivity } = require('../utils/activity');
const { Octokit } = require('@octokit/rest');

const router = express.Router();

function parseProject(row) {
  if (!row) return null;
  return {
    ...row,
    tags: JSON.parse(row.tags || '[]'),
    subtasks: JSON.parse(row.subtasks || '[]'),
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  res.json(rows.map(parseProject));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const history = db.prepare(
    'SELECT * FROM project_status_history WHERE project_id = ? ORDER BY changed_at ASC'
  ).all(req.params.id);

  res.json({ ...parseProject(row), status_history: history });
});

router.post('/', (req, res) => {
  const { title, status, priority, tags, progress, due_date, notes, subtasks, github_url, github_token, notion_url, linear_url } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  const result = db.prepare(
    `INSERT INTO projects (title,status,priority,tags,progress,due_date,notes,subtasks,github_url,github_token,notion_url,linear_url)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(title, status || 'ideas', priority || 'P3', JSON.stringify(tags || []), progress || 0, due_date || null, notes || '', JSON.stringify(subtasks || []), github_url || null, github_token || null, notion_url || null, linear_url || null);

  db.prepare('INSERT INTO project_status_history (project_id, status) VALUES (?,?)').run(result.lastInsertRowid, status || 'ideas');
  logActivity('create', 'projects', result.lastInsertRowid, title);

  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(parseProject(row));
});

router.put('/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });

  const { title, status, priority, tags, progress, due_date, notes, subtasks, github_url, github_token, notion_url, linear_url } = req.body;

  if (status && status !== project.status) {
    db.prepare('INSERT INTO project_status_history (project_id, status) VALUES (?,?)').run(req.params.id, status);
  }

  db.prepare(
    `UPDATE projects SET title=?,status=?,priority=?,tags=?,progress=?,due_date=?,notes=?,subtasks=?,github_url=?,github_token=?,notion_url=?,linear_url=?,updated_at=datetime('now') WHERE id=?`
  ).run(
    title ?? project.title,
    status ?? project.status,
    priority ?? project.priority,
    JSON.stringify(tags ?? JSON.parse(project.tags || '[]')),
    progress ?? project.progress,
    due_date ?? project.due_date,
    notes ?? project.notes,
    JSON.stringify(subtasks ?? JSON.parse(project.subtasks || '[]')),
    github_url ?? project.github_url,
    github_token ?? project.github_token,
    notion_url ?? project.notion_url,
    linear_url ?? project.linear_url,
    req.params.id
  );

  logActivity('update', 'projects', req.params.id, title ?? project.title);
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  const history = db.prepare('SELECT * FROM project_status_history WHERE project_id = ? ORDER BY changed_at ASC').all(req.params.id);
  res.json({ ...parseProject(row), status_history: history });
});

router.delete('/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  logActivity('delete', 'projects', req.params.id, project.title);
  res.json({ success: true });
});

router.get('/:id/github', async (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project || !project.github_url || !project.github_token) {
    return res.status(400).json({ error: 'GitHub not configured for this project' });
  }

  const cached = db.prepare('SELECT * FROM github_cache WHERE project_id = ?').get(req.params.id);
  if (cached) {
    const ageMinutes = (Date.now() - new Date(cached.cached_at).getTime()) / 60000;
    if (ageMinutes < 15) return res.json(JSON.parse(cached.data));
  }

  try {
    const match = project.github_url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return res.status(400).json({ error: 'Invalid GitHub URL' });
    const [, owner, repo] = match;
    const repoName = repo.replace(/\.git$/, '');

    const octokit = new Octokit({ auth: project.github_token });

    const [repoData, issues, prs] = await Promise.all([
      octokit.repos.get({ owner, repo: repoName }),
      octokit.issues.listForRepo({ owner, repo: repoName, state: 'open', per_page: 1 }),
      octokit.pulls.list({ owner, repo: repoName, state: 'open', per_page: 1 }),
    ]);

    let ciStatus = null;
    try {
      const commits = await octokit.repos.listCommits({ owner, repo: repoName, per_page: 1 });
      if (commits.data.length > 0) {
        const sha = commits.data[0].sha;
        const checks = await octokit.checks.listForRef({ owner, repo: repoName, ref: sha });
        const runs = checks.data.check_runs;
        if (runs.length > 0) {
          ciStatus = runs.every(r => r.conclusion === 'success') ? 'success' : 'failure';
        }
      }
    } catch (_) {}

    const data = {
      open_issues: repoData.data.open_issues_count,
      open_prs: prs.data.length,
      default_branch: repoData.data.default_branch,
      stargazers: repoData.data.stargazers_count,
      last_commit: repoData.data.pushed_at,
      ci_status: ciStatus,
      owner,
      repo: repoName,
    };

    db.prepare('INSERT OR REPLACE INTO github_cache (project_id, data, cached_at) VALUES (?,?,datetime("now"))').run(req.params.id, JSON.stringify(data));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/github/issue', async (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project || !project.github_url || !project.github_token) {
    return res.status(400).json({ error: 'GitHub not configured' });
  }

  const { title, body } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  const match = project.github_url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return res.status(400).json({ error: 'Invalid GitHub URL' });
  const [, owner, repo] = match;

  try {
    const octokit = new Octokit({ auth: project.github_token });
    const issue = await octokit.issues.create({ owner, repo: repo.replace(/\.git$/, ''), title, body: body || '' });
    res.json({ url: issue.data.html_url, number: issue.data.number });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
