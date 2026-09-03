using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrbitApi.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizationIdToAuditLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF NOT EXISTS (
                    SELECT 1 FROM sys.columns 
                    WHERE object_id = OBJECT_ID(N'[AuditLogs]') AND name = 'OrganizationId'
                )
                BEGIN
                    ALTER TABLE [AuditLogs] ADD [OrganizationId] int NULL;
                END;

                IF NOT EXISTS (
                    SELECT 1 FROM sys.foreign_keys 
                    WHERE name = 'FK_AuditLogs_Organizations_OrganizationId'
                )
                BEGIN
                    ALTER TABLE [AuditLogs] ADD CONSTRAINT [FK_AuditLogs_Organizations_OrganizationId] 
                    FOREIGN KEY ([OrganizationId]) REFERENCES [Organizations] ([Id]) ON DELETE CASCADE;
                END;

                IF NOT EXISTS (
                    SELECT 1 FROM sys.indexes 
                    WHERE name = 'IX_AuditLogs_OrganizationId_Timestamp' AND object_id = OBJECT_ID(N'[AuditLogs]')
                )
                BEGIN
                    CREATE INDEX [IX_AuditLogs_OrganizationId_Timestamp] ON [AuditLogs] ([OrganizationId], [Timestamp]);
                END;
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF EXISTS (
                    SELECT 1 FROM sys.foreign_keys 
                    WHERE name = 'FK_AuditLogs_Organizations_OrganizationId'
                )
                BEGIN
                    ALTER TABLE [AuditLogs] DROP CONSTRAINT [FK_AuditLogs_Organizations_OrganizationId];
                END;

                IF EXISTS (
                    SELECT 1 FROM sys.indexes 
                    WHERE name = 'IX_AuditLogs_OrganizationId_Timestamp' AND object_id = OBJECT_ID(N'[AuditLogs]')
                )
                BEGIN
                    DROP INDEX [IX_AuditLogs_OrganizationId_Timestamp] ON [AuditLogs];
                END;

                IF EXISTS (
                    SELECT 1 FROM sys.columns 
                    WHERE object_id = OBJECT_ID(N'[AuditLogs]') AND name = 'OrganizationId'
                )
                BEGIN
                    ALTER TABLE [AuditLogs] DROP COLUMN [OrganizationId];
                END;
            ");
        }
    }
}
