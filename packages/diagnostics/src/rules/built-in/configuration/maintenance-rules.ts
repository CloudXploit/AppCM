import { RuleBuilder, RemediationBuilder } from '../../rule-builder';

// Database Maintenance Disabled Rule
export const dbMaintenanceDisabledRule = RuleBuilder.configurationRule('config-db-maintenance')
  .name('Database Maintenance Disabled')
  .description('Automatic database maintenance is not configured')
  .severity('medium')
  .supportedVersions('*')
  .tags('configuration', 'database', 'maintenance')
  .when('database.maintenance.autoVacuum', 'equals', false)
  .when('database.maintenance.autoAnalyze', 'equals', false)
  .remediate(
    RemediationBuilder.updateConfig('config-enable-maintenance')
      .name('Enable Database Maintenance')
      .description('Enable automatic database maintenance tasks')
      .action('update_configuration')
      .parameters({
        settings: {
          auto_vacuum_enabled: true,
          auto_analyze_enabled: true,
          maintenance_window_start: '02:00',
          maintenance_window_end: '06:00'
        }
      })
      .riskLevel('low')
      .estimatedDuration(10)
      .build()
  )
  .build();

// Backup Not Configured Rule
export const backupNotConfiguredRule = RuleBuilder.configurationRule('config-backup-settings')
  .name('Database Backup Not Configured')
  .description('Automatic database backups are not properly configured')
  .severity('critical')
  .supportedVersions('*')
  .tags('configuration', 'backup', 'disaster-recovery')
  .when('database.backup.enabled', 'equals', false)
  .remediate(
    RemediationBuilder.updateConfig('config-enable-backup')
      .name('Configure Automatic Backups')
      .description('Enable and configure automatic database backups')
      .action('update_configuration')
      .parameters({
        settings: {
          backup_enabled: true,
          backup_type: 'FULL',
          backup_frequency: 'DAILY',
          backup_retention_days: 30,
          backup_compression: true
        }
      })
      .riskLevel('medium')
      .requiresApproval()
      .estimatedDuration(30)
      .build()
  )
  .build();

// Index Maintenance Rule
export const indexMaintenanceRule = RuleBuilder.configurationRule('config-index-maintenance')
  .name('Index Rebuild Threshold Too High')
  .description('Database index fragmentation threshold is set too high')
  .severity('low')
  .supportedVersions('*')
  .tags('configuration', 'database', 'performance')
  .when('database.maintenance.indexRebuildThreshold', 'greater_than', 30)
  .remediate(
    RemediationBuilder.updateConfig('config-index-threshold')
      .name('Optimize Index Rebuild Threshold')
      .description('Lower index rebuild threshold for better performance')
      .action('update_configuration')
      .parameters({
        setting: 'index_rebuild_threshold',
        value: 20,
        oldValue: 30
      })
      .riskLevel('low')
      .estimatedDuration(5)
      .build()
  )
  .build();