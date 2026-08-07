using System;
using System.Collections.Generic;

namespace OrbitApi.DTOs
{
    public class TaskAnalyticsDto
    {
        public decimal CompletionRate { get; set; }
        public int TasksOverdue { get; set; }
        public decimal OnTimeDeliveryRate { get; set; }
        public decimal AvgCycleTimeDays { get; set; }
        
        public List<ChartDataPoint> BurndownData { get; set; } = new List<ChartDataPoint>();
        public List<ChartDataPoint> TaskStatusDistribution { get; set; } = new List<ChartDataPoint>();
        public List<WorkloadDataPoint> WorkloadDistribution { get; set; } = new List<WorkloadDataPoint>();
    }

    public class ChartDataPoint
    {
        public string Label { get; set; } = string.Empty;
        public decimal Value { get; set; }
    }

    public class WorkloadDataPoint
    {
        public string UserName { get; set; } = string.Empty;
        public int OnTrackCount { get; set; }
        public int OverdueCount { get; set; }
    }
}
