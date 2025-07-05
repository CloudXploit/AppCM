# CM Diagnostics Quick Troubleshooting Reference

## 🚨 Emergency Commands

```bash
# System Health Check
curl -f http://localhost:3000/health || echo "SYSTEM DOWN"

# Emergency Restart (Docker)
docker-compose down && docker-compose up -d

# Emergency Restart (Systemd)
sudo systemctl restart cm-diagnostics

# View Recent Errors
tail -n 50 /var/log/cm-diagnostics/error.log | grep ERROR

# Check All Services
docker-compose ps  # or systemctl status cm-diagnostics nginx postgresql redis
```

## 🔧 Common Fixes

### Service Won't Start
```bash
# Check ports
netstat -tulpn | grep -E ':(80|443|3000|5432|6379)'
# Kill conflicting process
sudo kill -9 $(lsof -t -i:3000)
# Start fresh
docker-compose up -d --force-recreate
```

### Cannot Login
```bash
# Reset admin password
docker exec -it cm-diagnostics-app npm run reset-password -- --user admin
# Or SQL method
psql -U cmdiag -d cmdiagnostics -c "UPDATE users SET locked=false, failed_attempts=0 WHERE email='admin@company.com';"
```

### No Data Showing
```bash
# Check collectors
ps aux | grep collector
# Restart collectors
docker-compose restart collector
# Verify data flow
tail -f /var/log/cm-diagnostics/collector.log
```

### High CPU/Memory
```bash
# Find culprit
top -b -n 1 | head -20
# Restart app
docker-compose restart app
# Clear cache
redis-cli FLUSHALL
```

## 📊 Quick Diagnostics

### Database Issues
```sql
-- Check connections
SELECT count(*) FROM pg_stat_activity;
-- Kill idle connections
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < NOW() - INTERVAL '10 minutes';
-- Vacuum database
VACUUM ANALYZE;
```

### API Issues
```bash
# Test API
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/health
# Check rate limits
curl -I http://localhost:3000/api/metrics | grep -i rate
# View API logs
grep "API" /var/log/cm-diagnostics/app.log | tail -20
```

### Integration Issues
```bash
# Test Content Manager
curl -k https://cm-server.company.com/api/v2/health
# Test IDOL
curl "http://idol-server:9002/action=GetStatus"
# Test Redis
redis-cli ping
```

## 🗝️ Key File Locations

```bash
# Logs
/var/log/cm-diagnostics/*.log        # Application logs
/var/log/nginx/error.log            # Nginx logs
/var/log/postgresql/*.log           # Database logs

# Configuration
/opt/cm-diagnostics/config/         # App config
/etc/nginx/sites-available/         # Nginx config
/etc/postgresql/14/main/            # PostgreSQL config

# Data
/var/lib/postgresql/14/main/        # Database files
/var/lib/redis/                     # Redis data
/opt/cm-diagnostics/uploads/        # Uploaded files
```

## 🛠️ Recovery Commands

### Full System Recovery
```bash
#!/bin/bash
# Stop everything
docker-compose down
# Backup current state
tar -czf backup-$(date +%Y%m%d).tar.gz /opt/cm-diagnostics/
# Reset to clean state
docker system prune -a
docker-compose pull
docker-compose up -d
```

### Database Recovery
```bash
# Backup
pg_dump -U cmdiag cmdiagnostics > backup.sql
# Restore
psql -U cmdiag cmdiagnostics < backup.sql
# Repair
psql -U cmdiag -c "REINDEX DATABASE cmdiagnostics;"
```

## 📞 Support Contacts

- **Emergency (24/7)**: 1-800-DIAG-NOW
- **Email**: support@cm-diagnostics.com
- **Chat**: In-app support widget
- **Docs**: https://docs.cm-diagnostics.com

## 💡 Pro Tips

1. **Always check logs first**: `tail -f /var/log/cm-diagnostics/*.log`
2. **Keep backups current**: Run daily automated backups
3. **Monitor disk space**: `df -h` (keep >20% free)
4. **Test in staging first**: Never test fixes in production
5. **Document changes**: Update runbooks after fixes

---
**Remember**: When in doubt, collect support bundle first:
```bash
cm-diagnostics support-bundle
```