import { ReactNode } from 'react';

interface Props {
  title: string;
  actions?: ReactNode;
  tabs?: ReactNode;
}

export function PageHeader({ title, actions, tabs }: Props) {
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
      {tabs && <div className="tabs" style={{ padding: '0 24px' }}>{tabs}</div>}
    </>
  );
}
