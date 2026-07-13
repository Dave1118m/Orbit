export default function WorkloadChart({ workloadData }) {
  if (!workloadData) return null;

  const maxTasks = Math.max(
    workloadData.openTasksTotal,
    workloadData.overdueTasksTotal,
    ...workloadData.memberWorkloads.map(m => m.openTasks + m.overdueTasks)
  ) || 1;

  return (
    <div className="space-y-4">
      {/* Team Summary */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 p-4 border border-blue-200">
          <p className="text-xs font-medium text-blue-600 mb-1">Total Members</p>
          <p className="text-2xl font-bold text-blue-900">{workloadData.totalMembers}</p>
        </div>
        <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 border border-emerald-200">
          <p className="text-xs font-medium text-emerald-600 mb-1">Open Tasks</p>
          <p className="text-2xl font-bold text-emerald-900">{workloadData.openTasksTotal}</p>
        </div>
        <div className="rounded-lg bg-gradient-to-br from-red-50 to-red-100 p-4 border border-red-200">
          <p className="text-xs font-medium text-red-600 mb-1">Overdue</p>
          <p className="text-2xl font-bold text-red-900">{workloadData.overdueTasksTotal}</p>
        </div>
        <div className="rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 p-4 border border-amber-200">
          <p className="text-xs font-medium text-amber-600 mb-1">Avg per Member</p>
          <p className="text-2xl font-bold text-amber-900">{workloadData.averageTasksPerMember.toFixed(1)}</p>
        </div>
      </div>

      {/* Per-Member Workload Bars */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h4 className="text-sm font-semibold text-slate-900 mb-4">Member Workload</h4>
        <div className="space-y-4">
          {workloadData.memberWorkloads.map((member, idx) => {
            const totalTasks = member.openTasks + member.overdueTasks;
            const percentage = (totalTasks / maxTasks) * 100;
            const overduePercentage = member.overdueTasks > 0 ? (member.overdueTasks / totalTasks) * 100 : 0;

            return (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{member.userName}</p>
                  </div>
                  <div className="flex gap-2 text-xs font-semibold">
                    <span className="text-emerald-600">{member.openTasks} open</span>
                    <span className="text-red-600">{member.overdueTasks} overdue</span>
                  </div>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                  {totalTasks > 0 ? (
                    <div className="h-full flex">
                      <div
                        className="bg-gradient-to-r from-emerald-400 to-emerald-500"
                        style={{ width: `${100 - overduePercentage}%` }}
                      />
                      <div
                        className="bg-gradient-to-r from-red-400 to-red-500"
                        style={{ width: `${overduePercentage}%` }}
                      />
                    </div>
                  ) : (
                    <div className="h-full bg-slate-50" />
                  )}
                </div>
                <p className="text-xs text-slate-500">{totalTasks} total tasks</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Team Health Indicators */}
      <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div className="text-center">
          <div className="text-sm font-medium text-slate-600">Capacity</div>
          <div className={`text-2xl font-bold mt-1 ${workloadData.averageTasksPerMember > 5 ? 'text-red-600' : workloadData.averageTasksPerMember > 3 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {workloadData.averageTasksPerMember > 5 ? '⚠️ High' : workloadData.averageTasksPerMember > 3 ? '⚡ Medium' : '✅ Good'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm font-medium text-slate-600">Overdue Rate</div>
          <div className="text-2xl font-bold mt-1 text-slate-900">
            {workloadData.openTasksTotal > 0 ? ((workloadData.overdueTasksTotal / (workloadData.openTasksTotal + workloadData.overdueTasksTotal)) * 100).toFixed(0) : 0}%
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm font-medium text-slate-600">Distribution</div>
          <div className={`text-2xl font-bold mt-1 ${Math.max(...workloadData.memberWorkloads.map(m => m.openTasks + m.overdueTasks)) > workloadData.averageTasksPerMember * 1.5 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {Math.max(...workloadData.memberWorkloads.map(m => m.openTasks + m.overdueTasks)) > workloadData.averageTasksPerMember * 1.5 ? '⚠️ Uneven' : '✅ Balanced'}
          </div>
        </div>
      </div>
    </div>
  );
}
