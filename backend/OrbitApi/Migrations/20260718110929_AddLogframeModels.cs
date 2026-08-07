using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrbitApi.Migrations
{
    /// <inheritdoc />
    public partial class AddLogframeModels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Projects_Donors_DonorId",
                table: "Projects");

            migrationBuilder.DropTable(
                name: "BudgetRevisions");

            migrationBuilder.DropColumn(
                name: "Budget",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "Budget",
                table: "Organizations");

            migrationBuilder.RenameColumn(
                name: "OutputId",
                table: "Indicators",
                newName: "Level");

            migrationBuilder.AddColumn<int>(
                name: "EntityId",
                table: "Indicators",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "Indicators",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "LogframeGoals",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProjectId = table.Column<int>(type: "int", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LogframeGoals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LogframeGoals_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LogframeOutcomes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    GoalId = table.Column<int>(type: "int", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LogframeOutcomes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LogframeOutcomes_LogframeGoals_GoalId",
                        column: x => x.GoalId,
                        principalTable: "LogframeGoals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LogframeOutputs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OutcomeId = table.Column<int>(type: "int", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LogframeOutputs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LogframeOutputs_LogframeOutcomes_OutcomeId",
                        column: x => x.OutcomeId,
                        principalTable: "LogframeOutcomes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LogframeActivities",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OutputId = table.Column<int>(type: "int", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LogframeActivities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LogframeActivities_LogframeOutputs_OutputId",
                        column: x => x.OutputId,
                        principalTable: "LogframeOutputs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LogframeActivities_OutputId",
                table: "LogframeActivities",
                column: "OutputId");

            migrationBuilder.CreateIndex(
                name: "IX_LogframeGoals_ProjectId",
                table: "LogframeGoals",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_LogframeOutcomes_GoalId",
                table: "LogframeOutcomes",
                column: "GoalId");

            migrationBuilder.CreateIndex(
                name: "IX_LogframeOutputs_OutcomeId",
                table: "LogframeOutputs",
                column: "OutcomeId");

            migrationBuilder.AddForeignKey(
                name: "FK_Projects_Donors_DonorId",
                table: "Projects",
                column: "DonorId",
                principalTable: "Donors",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Projects_Donors_DonorId",
                table: "Projects");

            migrationBuilder.DropTable(
                name: "LogframeActivities");

            migrationBuilder.DropTable(
                name: "LogframeOutputs");

            migrationBuilder.DropTable(
                name: "LogframeOutcomes");

            migrationBuilder.DropTable(
                name: "LogframeGoals");

            migrationBuilder.DropColumn(
                name: "EntityId",
                table: "Indicators");

            migrationBuilder.DropColumn(
                name: "Name",
                table: "Indicators");

            migrationBuilder.RenameColumn(
                name: "Level",
                table: "Indicators",
                newName: "OutputId");

            migrationBuilder.AddColumn<decimal>(
                name: "Budget",
                table: "Projects",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Budget",
                table: "Organizations",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "BudgetRevisions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProjectId = table.Column<int>(type: "int", nullable: false),
                    ApprovedByFinanceOfficerId = table.Column<int>(type: "int", nullable: true),
                    ApprovedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    VersionNo = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BudgetRevisions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BudgetRevisions_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BudgetRevisions_ProjectId",
                table: "BudgetRevisions",
                column: "ProjectId");

            migrationBuilder.AddForeignKey(
                name: "FK_Projects_Donors_DonorId",
                table: "Projects",
                column: "DonorId",
                principalTable: "Donors",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
