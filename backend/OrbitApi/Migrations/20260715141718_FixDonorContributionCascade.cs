using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrbitApi.Migrations
{
    /// <inheritdoc />
    public partial class FixDonorContributionCascade : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DonorContributions_Tasks_AllocatedTaskId",
                table: "DonorContributions");

            migrationBuilder.AddForeignKey(
                name: "FK_DonorContributions_Tasks_AllocatedTaskId",
                table: "DonorContributions",
                column: "AllocatedTaskId",
                principalTable: "Tasks",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DonorContributions_Tasks_AllocatedTaskId",
                table: "DonorContributions");

            migrationBuilder.AddForeignKey(
                name: "FK_DonorContributions_Tasks_AllocatedTaskId",
                table: "DonorContributions",
                column: "AllocatedTaskId",
                principalTable: "Tasks",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
