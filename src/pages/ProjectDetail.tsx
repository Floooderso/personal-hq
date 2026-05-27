import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, ExternalLink, CheckSquare, Square, Trash2, Github } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { StatusPill } from '../components/common/StatusPill';
import { useToast } from '../components/common/Toast';
import { api } from '../utils/api';
import { formatDate, formatRelative } from '../utils/format';
import type { Project, Subtask } from '../types';
import { marked } from 'marked';

interface GitHubData {
  open_issues: number;
  open_prs: number;
  default_branch: string;
  stargazers: number;
  last_commit: string;
  ci_status: 'success' | 'failure' | null;
  owner: string;
  repo: string;
}

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [github, setGithub] = useState<GitHubData | null>(null);
  const [notes, setNotes] = useState('');
  const [editNotes, setEditNotes] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [newIssueBody, setNewIssueBody] = useState('');
  const [showIssueForm, setShowIssueForm] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<Project>(`/projects/${id}`).then(p => {
      setProject(p);
      setNotes(p.notes ?? '');
    }).catch(() => navigate('/projects'));
  }, [id, navigate]);

  useEffect(() => {
    if (!project?.github_url || !project?.github_token) return;
    api.get<GitHubData>(`/projects/${id}/github`).then(setGithub).catch(() => {});
  }, [project, id]);

  async function saveNotes() {
    if (!project) return;
    await api.put(`/projects/${project.id}`, { notes });
    setProject(prev => prev ? { ...prev, notes } : null);
    setEditNotes(false);
    toast.success('Notes saved');
  }

  async function toggleSubtask(task: Subtask) {
    if (!project) return;
    const updated = project.subtasks.map(t => t.id === task.id ? { ...t, done: !t.done } : t);
    await api.put(`/projects/${project.id}`, { subtasks: updated });
    setProject(prev => prev ? { ...prev, subtasks: updated } : null);
  }

  async function addSubtask() {
    if (!project || !newTask.trim()) return;
    const task: Subtask = { id: Date.now().toString(), text: newTask.trim(), done: false };
    const updated = [...project.subtasks, task];
    await api.put(`/projects/${project.id}`, { subtasks: updated });
    setProject(prev => prev ? { ...prev, subtasks: updated } : null);
    setNewTask('');
  }

  async function deleteSubtask(task: Subtask) {
    if (!project) return;
    const updated = project.subtasks.filter(t => t.id !== task.id);
    await api.put(`/projects/${project.id}`, { subtasks: updated });
    setProject(prev => prev ? { ...prev, subtasks: updated } : null);
  }

  async function createIssue() {
    if (!newIssueTitle.trim()) return;
    try {
      const result = await api.post<{ url: string; number: number }>(`/projects/${id}/github/issue`, { title: newIssueTitle, body: newIssueBody });
      toast.success(`Issue #${result.number} created`);
      setShowIssueForm(false);
      setNewIssueTitle('');
      setNewIssueBody('');
    } catch (e) { toast.error((e as Error).message); }
  }

  async function openURL(url: string) {
    await api.post('/open-url', { url });
  }

  if (!project) return <div className="page-content" style={{ color: 'var(--text-muted)' }}>Loading...</div>;

  const done = project.subtasks.filter(t => t.done).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        title={project.title}
        actions={
          <button className="btn btn-secondary" onClick={() => navigate('/projects')}>
            <ArrowLeft size={15} /> Back
          </button>
        }
      />
      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Meta */}
            <div className="card card-sm flex items-center gap-16" style={{ flexWrap: 'wrap' }}>
              <StatusPill status={project.status} />
              <span className={`priority-${project.priority.toLowerCase()}`}>{project.priority}</span>
              {project.due_date && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Due: {formatDate(project.due_date)}</span>}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="progress-bar" style={{ flex: 1 }}>
                  <div className="progress-bar-fill" style={{ width: `${project.progress}%` }} />
                </div>
                <span className="mono" style={{ fontSize: 12 }}>{project.progress}%</span>
              </div>
            </div>

            {/* Notes */}
            <div className="card">
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <h3>Notes</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditNotes(!editNotes); }}>
                  {editNotes ? 'Preview' : 'Edit'}
                </button>
              </div>
              {editNotes ? (
                <>
                  <textarea
                    className="form-textarea"
                    style={{ minHeight: 200, fontFamily: 'DM Mono', fontSize: 13 }}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Markdown supported..."
                  />
                  <div className="flex" style={{ gap: 8, marginTop: 12 }}>
                    <button className="btn btn-primary btn-sm" onClick={saveNotes}>Save Notes</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setNotes(project.notes ?? ''); setEditNotes(false); }}>Cancel</button>
                  </div>
                </>
              ) : (
                <div
                  className="markdown"
                  style={{ minHeight: 80, color: notes ? 'var(--text)' : 'var(--text-muted)', fontSize: 13 }}
                  dangerouslySetInnerHTML={{ __html: notes ? marked(notes) as string : '<p>No notes yet. Click Edit to add some.</p>' }}
                />
              )}
            </div>

            {/* Subtasks */}
            <div className="card">
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <h3>Tasks <span className="mono" style={{ fontSize: 13, color: 'var(--text-muted)' }}>{done}/{project.subtasks.length}</span></h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {project.subtasks.map(task => (
                  <div key={task.id} className="flex items-center gap-8" style={{ padding: '6px 0' }}>
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ padding: 2 }} onClick={() => toggleSubtask(task)}>
                      {task.done ? <CheckSquare size={16} color="var(--primary)" /> : <Square size={16} color="var(--text-muted)" />}
                    </button>
                    <span style={{ flex: 1, textDecoration: task.done ? 'line-through' : 'none', color: task.done ? 'var(--text-muted)' : 'var(--text)', fontSize: 13 }}>
                      {task.text}
                    </span>
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ padding: 2, opacity: 0.5 }} onClick={() => deleteSubtask(task)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-8" style={{ marginTop: 12 }}>
                <input
                  className="form-input"
                  style={{ flex: 1 }}
                  placeholder="New task..."
                  value={newTask}
                  onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addSubtask(); }}
                />
                <button className="btn btn-secondary" onClick={addSubtask}><Plus size={15} /></button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Status history */}
            <div className="card card-sm">
              <h3 style={{ marginBottom: 12 }}>History</h3>
              {(project.status_history ?? []).map(h => (
                <div key={h.id} className="flex items-center justify-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <StatusPill status={h.status} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>{formatRelative(h.changed_at)}</span>
                </div>
              ))}
            </div>

            {/* Tags */}
            {project.tags.length > 0 && (
              <div className="card card-sm">
                <h3 style={{ marginBottom: 10 }}>Tags</h3>
                <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {project.tags.map(t => <span key={t} className="tag">{t}</span>)}
                </div>
              </div>
            )}

            {/* External links */}
            {(project.notion_url || project.linear_url) && (
              <div className="card card-sm">
                <h3 style={{ marginBottom: 10 }}>Links</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {project.notion_url && (
                    <button className="btn btn-secondary btn-sm" onClick={() => openURL(project.notion_url!)}>
                      <ExternalLink size={13} /> Open in Notion
                    </button>
                  )}
                  {project.linear_url && (
                    <button className="btn btn-secondary btn-sm" onClick={() => openURL(project.linear_url!)}>
                      <ExternalLink size={13} /> Open in Linear
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* GitHub Panel */}
            {project.github_url && (
              <div className="card card-sm">
                <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                  <div className="flex items-center gap-8">
                    <Github size={16} />
                    <h3>GitHub</h3>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => openURL(project.github_url!)}>
                    <ExternalLink size={12} />
                  </button>
                </div>
                {github ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Open Issues</span>
                      <span className="mono" style={{ fontSize: 13 }}>{github.open_issues}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Open PRs</span>
                      <span className="mono" style={{ fontSize: 13 }}>{github.open_prs}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Stars</span>
                      <span className="mono" style={{ fontSize: 13 }}>★ {github.stargazers}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>CI</span>
                      {github.ci_status ? (
                        <span className={`pill ${github.ci_status === 'success' ? 'pill-green' : 'pill-red'}`} style={{ fontSize: 10 }}>
                          {github.ci_status}
                        </span>
                      ) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last Push</span>
                      <span style={{ fontSize: 11, fontFamily: 'DM Mono' }}>{formatRelative(github.last_commit)}</span>
                    </div>
                    <hr className="divider" style={{ margin: '4px 0' }} />
                    {showIssueForm ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <input className="form-input" placeholder="Issue title" value={newIssueTitle} onChange={e => setNewIssueTitle(e.target.value)} />
                        <textarea className="form-textarea" placeholder="Description (optional)" value={newIssueBody} onChange={e => setNewIssueBody(e.target.value)} style={{ minHeight: 60 }} />
                        <div className="flex gap-8">
                          <button className="btn btn-primary btn-sm" onClick={createIssue}>Create</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setShowIssueForm(false)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button className="btn btn-secondary btn-sm" onClick={() => setShowIssueForm(true)}>
                        <Plus size={12} /> Create Issue
                      </button>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading GitHub data...</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
