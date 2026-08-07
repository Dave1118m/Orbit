using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrbitApi.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizationToDonor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM Donors;");

            migrationBuilder.AddColumn<int>(
                name: "OrganizationId",
                table: "Donors",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_Donors_OrganizationId",
                table: "Donors",
                column: "OrganizationId");

            migrationBuilder.AddForeignKey(
                name: "FK_Donors_Organizations_OrganizationId",
                table: "Donors",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Donors_Organizations_OrganizationId",
                table: "Donors");

            migrationBuilder.DropIndex(
                name: "IX_Donors_OrganizationId",
                table: "Donors");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Donors");
        }
    }
}
