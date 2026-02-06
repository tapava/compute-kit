import { usePoolStats } from '@computekit/react';

export function PoolMonitor() {
  const stats = usePoolStats(500); // Update every 500ms

  return (
    <div className="stats-bar">
      <div className="stat">
        <span className="stat-label">Workers</span>
        <span className="stat-value">{stats.totalWorkers}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Active</span>
        <span className="stat-value" style={{ color: stats.activeWorkers > 0 ? '#ffa657' : '#7ee787' }}>
          {stats.activeWorkers}
        </span>
      </div>
      <div className="stat">
        <span className="stat-label">Queue</span>
        <span className="stat-value">{stats.queueLength}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Completed</span>
        <span className="stat-value" style={{ color: '#7ee787' }}>{stats.tasksCompleted}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Failed</span>
        <span className="stat-value" style={{ color: stats.tasksFailed > 0 ? '#da3633' : '#8b949e' }}>
          {stats.tasksFailed}
        </span>
      </div>
      <div className="stat">
        <span className="stat-label">Avg. Duration</span>
        <span className="stat-value">{stats.averageTaskDuration.toFixed(0)}ms</span>
      </div>
    </div>
  );
}
