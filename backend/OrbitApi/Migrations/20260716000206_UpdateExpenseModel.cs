using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrbitApi.Migrations
{
    /// <inheritdoc />
    public partial class UpdateExpenseModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_Projects_ProjectId",
                table: "Expenses");

            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_Tasks_TaskId",
                table: "Expenses");

            migrationBuilder.AddColumn<int>(
                name: "AttachmentId",
                table: "Expenses",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Category",
                table: "Expenses",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Expenses",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "FinanceReviewedAt",
                table: "Expenses",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ManagerSignedOffAt",
                table: "Expenses",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ProjectId1",
                table: "Expenses",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectionReason",
                table: "Expenses",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SubmittedByUserId",
                table: "Expenses",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TaskItemId",
                table: "Expenses",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_ApprovedByFinanceOfficerId",
                table: "Expenses",
                column: "ApprovedByFinanceOfficerId");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_AttachmentId",
                table: "Expenses",
                column: "AttachmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_ProjectId1",
                table: "Expenses",
                column: "ProjectId1");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_SignedOffByManagerId",
                table: "Expenses",
                column: "SignedOffByManagerId");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_SubmittedByUserId",
                table: "Expenses",
                column: "SubmittedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_TaskItemId",
                table: "Expenses",
                column: "TaskItemId");

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_Attachments_AttachmentId",
                table: "Expenses",
                column: "AttachmentId",
                principalTable: "Attachments",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_Projects_ProjectId",
                table: "Expenses",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_Projects_ProjectId1",
                table: "Expenses",
                column: "ProjectId1",
                principalTable: "Projects",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_Tasks_TaskId",
                table: "Expenses",
                column: "TaskId",
                principalTable: "Tasks",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_Tasks_TaskItemId",
                table: "Expenses",
                column: "TaskItemId",
                principalTable: "Tasks",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_Users_ApprovedByFinanceOfficerId",
                table: "Expenses",
                column: "ApprovedByFinanceOfficerId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_Users_SignedOffByManagerId",
                table: "Expenses",
                column: "SignedOffByManagerId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_Users_SubmittedByUserId",
                table: "Expenses",
                column: "SubmittedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_Attachments_AttachmentId",
                table: "Expenses");

            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_Projects_ProjectId",
                table: "Expenses");

            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_Projects_ProjectId1",
                table: "Expenses");

            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_Tasks_TaskId",
                table: "Expenses");

            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_Tasks_TaskItemId",
                table: "Expenses");

            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_Users_ApprovedByFinanceOfficerId",
                table: "Expenses");

            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_Users_SignedOffByManagerId",
                table: "Expenses");

            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_Users_SubmittedByUserId",
                table: "Expenses");

            migrationBuilder.DropIndex(
                name: "IX_Expenses_ApprovedByFinanceOfficerId",
                table: "Expenses");

            migrationBuilder.DropIndex(
                name: "IX_Expenses_AttachmentId",
                table: "Expenses");

            migrationBuilder.DropIndex(
                name: "IX_Expenses_ProjectId1",
                table: "Expenses");

            migrationBuilder.DropIndex(
                name: "IX_Expenses_SignedOffByManagerId",
                table: "Expenses");

            migrationBuilder.DropIndex(
                name: "IX_Expenses_SubmittedByUserId",
                table: "Expenses");

            migrationBuilder.DropIndex(
                name: "IX_Expenses_TaskItemId",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "AttachmentId",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "FinanceReviewedAt",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "ManagerSignedOffAt",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "ProjectId1",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "RejectionReason",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "SubmittedByUserId",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "TaskItemId",
                table: "Expenses");

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_Projects_ProjectId",
                table: "Expenses",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_Tasks_TaskId",
                table: "Expenses",
                column: "TaskId",
                principalTable: "Tasks",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
