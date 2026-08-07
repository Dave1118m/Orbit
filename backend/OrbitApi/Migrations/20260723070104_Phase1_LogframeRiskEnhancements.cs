using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrbitApi.Migrations
{
    /// <inheritdoc />
    public partial class Phase1_LogframeRiskEnhancements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "RisksIssues",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "RisksIssues",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "ImpactScore",
                table: "RisksIssues",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "LikelihoodScore",
                table: "RisksIssues",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "MitigationPlan",
                table: "RisksIssues",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResolutionNotes",
                table: "RisksIssues",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ResolvedAt",
                table: "RisksIssues",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ResolvedByUserId",
                table: "RisksIssues",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LinkedTaskId",
                table: "LogframeActivities",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "Indicators",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Indicators",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_RisksIssues_ProjectId",
                table: "RisksIssues",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_RisksIssues_ResolvedByUserId",
                table: "RisksIssues",
                column: "ResolvedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_LogframeActivities_LinkedTaskId",
                table: "LogframeActivities",
                column: "LinkedTaskId");

            migrationBuilder.AddForeignKey(
                name: "FK_LogframeActivities_Tasks_LinkedTaskId",
                table: "LogframeActivities",
                column: "LinkedTaskId",
                principalTable: "Tasks",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_RisksIssues_Projects_ProjectId",
                table: "RisksIssues",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_RisksIssues_Users_ResolvedByUserId",
                table: "RisksIssues",
                column: "ResolvedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_LogframeActivities_Tasks_LinkedTaskId",
                table: "LogframeActivities");

            migrationBuilder.DropForeignKey(
                name: "FK_RisksIssues_Projects_ProjectId",
                table: "RisksIssues");

            migrationBuilder.DropForeignKey(
                name: "FK_RisksIssues_Users_ResolvedByUserId",
                table: "RisksIssues");

            migrationBuilder.DropIndex(
                name: "IX_RisksIssues_ProjectId",
                table: "RisksIssues");

            migrationBuilder.DropIndex(
                name: "IX_RisksIssues_ResolvedByUserId",
                table: "RisksIssues");

            migrationBuilder.DropIndex(
                name: "IX_LogframeActivities_LinkedTaskId",
                table: "LogframeActivities");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "RisksIssues");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "RisksIssues");

            migrationBuilder.DropColumn(
                name: "ImpactScore",
                table: "RisksIssues");

            migrationBuilder.DropColumn(
                name: "LikelihoodScore",
                table: "RisksIssues");

            migrationBuilder.DropColumn(
                name: "MitigationPlan",
                table: "RisksIssues");

            migrationBuilder.DropColumn(
                name: "ResolutionNotes",
                table: "RisksIssues");

            migrationBuilder.DropColumn(
                name: "ResolvedAt",
                table: "RisksIssues");

            migrationBuilder.DropColumn(
                name: "ResolvedByUserId",
                table: "RisksIssues");

            migrationBuilder.DropColumn(
                name: "LinkedTaskId",
                table: "LogframeActivities");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "Indicators");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Indicators");
        }
    }
}
