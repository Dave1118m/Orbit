using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrbitApi.Migrations
{
    /// <inheritdoc />
    public partial class Phase3_ChartOfAccountsHierarchy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AccountType",
                table: "FinancialCategories",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "HierarchyLevel",
                table: "FinancialCategories",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsUSAIDAllowable",
                table: "FinancialCategories",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "RequiresReceiptThreshold",
                table: "FinancialCategories",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AccountType",
                table: "FinancialCategories");

            migrationBuilder.DropColumn(
                name: "HierarchyLevel",
                table: "FinancialCategories");

            migrationBuilder.DropColumn(
                name: "IsUSAIDAllowable",
                table: "FinancialCategories");

            migrationBuilder.DropColumn(
                name: "RequiresReceiptThreshold",
                table: "FinancialCategories");
        }
    }
}
