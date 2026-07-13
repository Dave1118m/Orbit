using System;
using System.Collections.Generic;

namespace OrbitApi.DTOs
{
    public enum TaskStatus { ToDo = 0, InProgress = 1, InReview = 2, Blocked = 3, Done = 4 }
    public enum TaskPriority { Low = 0, Medium = 1, High = 2, Urgent = 3 }

    public class TaskDto
    {
        public int Id { get; set; }
        public int ProjectId { get; set; }
        public string Title { get; set; } = null!;
        public string? Description { get; set; }
        public TaskStatus Status { get; set; }
        public TaskPriority Priority { get; set; }
        public DateTime? Deadline { get; set; }
        public DateTime? CompletedDate { get; set; }
        public int? ParentTaskId { get; set; }
        public List<int>? AssignedUserIds { get; set; }
        public List<SubtaskDto>? Subtasks { get; set; }
        public byte[]? RowVersion { get; set; }
    }

    public class CreateTaskRequest
    {
        public int ProjectId { get; set; }
        public string Title { get; set; } = null!;
        public string? Description { get; set; }
        public TaskStatus Status { get; set; }
        public TaskPriority Priority { get; set; }
        public DateTime? Deadline { get; set; }
        public int? ParentTaskId { get; set; }
        public List<int>? AssignedUserIds { get; set; }
    }

    public class UpdateTaskRequest
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public TaskStatus? Status { get; set; }
        public TaskPriority? Priority { get; set; }
        public DateTime? Deadline { get; set; }
        public int? ParentTaskId { get; set; }
        public List<int>? AssignedUserIds { get; set; }
        public byte[]? RowVersion { get; set; }
    }

    public class SubtaskDto
    {
        public int Id { get; set; }
        public int TaskId { get; set; }
        public string Title { get; set; } = null!;
        public bool IsDone { get; set; }
    }

    public class CreateSubtaskRequest
    {
        public int TaskId { get; set; }
        public string Title { get; set; } = null!;
    }

    public class TaskDependencyDto
    {
        public int Id { get; set; }
        public int TaskId { get; set; }
        public int DependsOnTaskId { get; set; }
        public string? DependencyType { get; set; }
    }

    public class CommentDto
    {
        public int Id { get; set; }
        public string EntityType { get; set; } = "Task";
        public int EntityId { get; set; }
        public int UserId { get; set; }
        public string? UserName { get; set; }
        public string Content { get; set; } = null!;
        public int? ParentCommentId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? EditedAt { get; set; }
        public List<CommentDto>? Replies { get; set; }
    }

    public class CreateCommentRequest
    {
        public string Content { get; set; } = null!;
        public int? ParentCommentId { get; set; }
    }

    public class AttachmentDto
    {
        public int Id { get; set; }
        public string EntityType { get; set; } = "Task";
        public int EntityId { get; set; }
        public string FileName { get; set; } = null!;
        public string AbsoluteFilePath { get; set; } = null!;
        public string MediaType { get; set; } = null!;
        public string MimeType { get; set; } = null!;
        public long FileSizeBytes { get; set; }
        public bool PreviewEnabled { get; set; }
        public string DownloadUrl { get; set; } = null!;
        public string? PreviewUrl { get; set; }
        public int? UserId { get; set; }
    }

    public class TaskStatusHistoryDto
    {
        public int Id { get; set; }
        public int TaskId { get; set; }
        public string OldStatus { get; set; } = null!;
        public string NewStatus { get; set; } = null!;
        public int ChangedByUserId { get; set; }
        public string? ChangedByUserName { get; set; }
        public DateTime ChangedAt { get; set; }
    }

    public class TaskMemberDto
    {
        public int Id { get; set; }
        public int TaskId { get; set; }
        public int UserId { get; set; }
        public string? UserName { get; set; }
        public string? UserEmail { get; set; }
    }

    public class AssignTaskMemberRequest
    {
        public int UserId { get; set; }
    }
}
