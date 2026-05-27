import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { SlideOver } from '../components/common/SlideOver';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../components/common/Toast';
import { api } from '../utils/api';
import { formatDate, daysUntil } from '../utils/format';
import type { Project } from '../types';
import { useKeyboard } from '../hooks/useKeyboard';

const COLUMNS: { key: Project['status']; label: string; color: string }[] = [
  { key: 'ideas', label: 'Ideas', color: 'var(--blue)' },
  { key: 'planning', label: 'Planning', color: 'var(--yellow)' },
  { key: 'active', label: 'Active', color: 'var(--green)' },
  { key: 'on_hold', label: 'On Hold', color: 'var(--red)' },
  { key: 'done', label: 'Done', color: 'var(--text-muted)' },
];

const defaultForm = {
  title: '', status: 'ideas' as Project['status'], priority: 'P3' as Project['priority'],
  tags: '', progress: '0', due_date: '', notes: '', github_url: '', notion_url: '', linear_url: '',
};

export function Projects() {
  const [data, setData] = useState<Project[]>([]);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<Project | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const load = useCallback(() => {
    api.get<Project[]>('/projects').then(setData).catch(() => toast.error('Failed to load projects'));
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (searchParams.get('action') === 'new-project') openNew(); }, [searchParams]);
  useKeyboard('n', () => { if (!slideOpen) openNew(); }, [slideOpen]);

  function openNew() {
    setEditRecord(null);
    setForm(defaultForm);
    setErrors({});
    setSlideOpen(true);
  }

  function openEdit(project: Project) {
    setEditRecord(project);
    setForm({
      title: project.title,
      status: project.status,
      priority: project.priority,
      tags: project.tags.join(', '),
      progress: String(project.progress),
      due_date: project.due_date ?? '',
      notes: project.notes ?? '',
      github_url: project.github_url ?? '',
      notion_url: project.notion_url ?? '',
      linear_url: project.linear_url ?? '',
    });
    setErrors({});
    setSlideOpen(true);
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    const prog = Number(form.progress);
    if (isNaN(prog) || prog < 0 || prog > 100) errs.progress = 'Progress must be 0-100';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function save() {
    if (!validate()) return;
    try {
      const payload = {
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        progress: Number(form.progress),
      };
      if (editRecord) {
        await api.put(`/projects/${editRecord.id}`, payload);
        toast.success('Project updated');
      } else {
        await api.post('/projects', payload);
        toast.success('Project created');
      }
      setSlideOpen(false);
      load();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function deleteProject(project: Project) {
    if (!confirm(`Delete "${project.title}"?`)) return;
    await api.delete(`/projects/${project.id}`);
    toast.success('Deleted');
    setSlideOpen(false);
    load();
  }

  async function moveProject(project: Project, newStatus: Project['status']) {
    await api.put(`/projects/${project.id}`, { status: newStatus });
    load();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        title="Projects"
        actions={
          <button className="btn btn-primary" onClick={openNew}><Plus size={15} /> New Project</button>
        }
      />
      <div className="page-content" style={{ overflow: 'auto' }}>
        {data.length === 0 ? (
          <EmptyState
            title="No projects yet"
            subtitle="Plan and track your ideas from conception to completion."
            action={<button className="btn btn-primary" onClick={openNew}><Plus size={15} /> New Project</button>}
          />
        ) : (
          <div className="kanban-board">
            {COLUMNS.map(col => {
              const cards = data.filter(p => p.status === col.key);
              return (
                <div key={col.key} className="kanban-column">
                  <div className="kanban-column-header">
                    <span className="kanban-column-title" style={{ color: col.color }}>{col.label}</span>
                    <span className="kanban-column-count">{cards.length}</span>
                  </div>
                  <div className="kanban-cards">
                    {cards.map(project => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onOpen={() => navigate(`/projects/${project.id}`)}
                        onEdit={() => openEdit(project)}
                        columns={COLUMNS}
                        onMove={(status) => moveProject(project, status)}
                      />
                    ))}
                    {cards.length === 0 && (
                      <div style={{ padding: '16px 8px', color: 'var(--text-faint)', fontSize: 12, textAlign: 'center' }}>Empty</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SlideOver
        title={editRecord ? 'Edit Project' : 'New Project'}
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        footer={
          <>
            {editRecord && (
              <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/projects/${editRecord.id}`)}>View Detail</button>
            )}
            <button className="btn btn-secondary" onClick={() => setSlideOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          {errors.title && <span className="form-error">{errors.title}</span>}
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Project['status'] }))}>
              {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select className="form-select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Project['priority'] }))}>
              <option value="P1">P1 – Critical</option>
              <option value="P2">P2 – High</option>
              <option value="P3">P3 – Normal</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Progress %</label>
            <input className="form-input" type="number" min="0" max="100" value={form.progress} onChange={e => setForm(f => ({ ...f, progress: e.target.value }))} />
            {errors.progress && <span className="form-error">{errors.progress}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input className="form-input" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Tags (comma-separated)</label>
          <input className="form-input" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="web, design, learning" />
        </div>
        <div className="form-group">
          <label className="form-label">GitHub URL</label>
          <input className="form-input" value={form.github_url} onChange={e => setForm(f => ({ ...f, github_url: e.target.value }))} placeholder="https://github.com/user/repo" />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Notion URL</label>
            <input className="form-input" value={form.notion_url} onChange={e => setForm(f => ({ ...f, notion_url: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Linear URL</label>
            <input className="form-input" value={form.linear_url} onChange={e => setForm(f => ({ ...f, linear_url: e.target.value }))} />
          </div>
        </div>
        {editRecord && (
          <button className="btn btn-danger w-full" onClick={() => deleteProject(editRecord)}>
            <Trash2 size={14} /> Delete Project
          </button>
        )}
      </SlideOver>
    </div>
  );
}

function ProjectCard({ project, onOpen, onEdit, columns, onMove }: {
  project: Project;
  onOpen: () => void;
  onEdit: () => void;
  columns: typeof COLUMNS;
  onMove: (status: Project['status']) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const days = daysUntil(project.due_date);
  const overdue = days !== null && days < 0;

  return (
    <div className="kanban-card" onClick={onOpen}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span className={`priority-${project.priority.toLowerCase()}`}>{project.priority}</span>
        <button
          className="btn btn-ghost btn-icon btn-sm"
          style={{ padding: 2 }}
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
        >
          ···
        </button>
      </div>

      {showMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 149 }} onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
          <div className="context-menu" style={{ position: 'absolute', zIndex: 150 }}>
            <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); onEdit(); setShowMenu(false); }}>Edit</div>
            <div className="context-menu-sep" />
            {columns.filter(c => c.key !== project.status).map(c => (
              <div key={c.key} className="context-menu-item" onClick={(e) => { e.stopPropagation(); onMove(c.key); setShowMenu(false); }}>
                Move to {c.label}
              </div>
            ))}
          </div>
        </>
      )}

      <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, lineHeight: 1.4 }}>{project.title}</p>

      {project.tags.length > 0 && (
        <div className="flex" style={{ gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {project.tags.map(t => <span key={t} className="tag">{t}</span>)}
        </div>
      )}

      <div className="progress-bar" style={{ marginBottom: 8 }}>
        <div className="progress-bar-fill" style={{ width: `${project.progress}%` }} />
      </div>

      <div className="flex items-center justify-between">
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>{project.progress}%</span>
        {project.due_date && (
          <span style={{ fontSize: 11, color: overdue ? 'var(--red)' : 'var(--text-muted)', fontFamily: 'DM Mono' }}>
            {overdue ? 'Overdue' : formatDate(project.due_date)}
          </span>
        )}
      </div>
    </div>
  );
}
