# NPTEL Hub - 10-Point Production Deployment Checklist

## Pre-Deployment (Infrastructure)

### 1. Security Configuration
- [ ] **SSL/TLS Certificates**
  - [ ] Obtain SSL certificate (Let's Encrypt recommended)
  - [ ] Install on load balancer/reverse proxy
  - [ ] Set `NODE_ENV=production` in `.env`
  - [ ] Enable HTTPS redirect middleware
  - [ ] Verify certificate auto-renewal setup

- [ ] **Environment Secrets**
  - [ ] Generate strong `JWT_SECRET` (min 32 characters)
  - [ ] Set unique MongoDB password
  - [ ] Create Redis password
  - [ ] Store in secure vault (AWS Secrets Manager, HashiCorp Vault)
  - [ ] Configure secrets injection in deployment
  - [ ] Rotation schedule (every 90 days)

- [ ] **CORS & Security Headers**
  - [ ] Configure `FRONTEND_URL` to match production domain
  - [ ] Enable CORS only for production domains
  - [ ] Set security headers (HSTS, CSP, X-Frame-Options)
  - [ ] Configure rate limiting thresholds for production load

### 2. Database & Cache Setup

- [ ] **MongoDB Production Instance**
  - [ ] Create managed MongoDB Atlas cluster (recommended)
  - [ ] Enable authentication (strong password)
  - [ ] Set up backups (daily + 30-day retention)
  - [ ] Configure IP whitelist for backend server
  - [ ] Enable encryption at rest
  - [ ] Test connection string
  - [ ] Run `createProductionIndexes()` script
  - [ ] Verify indexes created: `db.collection.getIndexes()`

- [ ] **Redis Setup**
  - [ ] Deploy Redis cluster or managed Redis service
  - [ ] Enable password authentication
  - [ ] Configure persistence (RDB + AOF)
  - [ ] Set memory eviction policy (`allkeys-lru`)
  - [ ] Monitor memory usage

### 3. Infrastructure & Deployment

- [ ] **Docker & Container Orchestration**
  - [ ] Build and test Docker images locally
  - [ ] Push images to container registry (GHCR, Docker Hub)
  - [ ] Test `docker-compose.production.yml` in staging
  - [ ] Set resource limits (CPU, memory)
  - [ ] Configure health checks
  - [ ] Set up auto-restart policies

- [ ] **Reverse Proxy/Load Balancer**
  - [ ] Configure Nginx or HAProxy
  - [ ] Enable compression (gzip)
  - [ ] Set up SSL termination
  - [ ] Configure upstream to backend server(s)
  - [ ] Add logging and monitoring
  - [ ] Test failover scenarios

- [ ] **CI/CD Pipeline**
  - [ ] GitHub Actions workflows configured
  - [ ] All tests passing
  - [ ] Linting enabled
  - [ ] Security scanning enabled
  - [ ] Docker build and push automated
  - [ ] Deploy secrets configured correctly

## Application-Level

### 4. Backend Hardening

- [ ] **Code Quality**
  - [ ] No hardcoded secrets in codebase
  - [ ] All API endpoints protected with authentication
  - [ ] Error messages don't leak sensitive info (verify in logs)
  - [ ] Rate limiters tested and configured
  - [ ] Input validation on all endpoints
  - [ ] SQL injection / XSS protections verified

- [ ] **Socket.io Configuration**
  - [ ] Redis adapter enabled in production
  - [ ] Room naming convention verified: `{courseId}_{year}_{weekNumber}`
  - [ ] User session cleanup on disconnect working
  - [ ] Message rate limiting active
  - [ ] Cross-origin Socket.io allowed only from frontend domain

- [ ] **Monitoring & Logging**
  - [ ] Application logs sent to centralized logging (ELK, CloudWatch)
  - [ ] Error tracking enabled (Sentry recommended)
  - [ ] Performance monitoring enabled (APM)
  - [ ] Database query logging (slow query log)
  - [ ] Redis monitoring configured

### 5. Frontend Deployment

- [ ] **Next.js Build**
  - [ ] Production build created (`npm run build`)
  - [ ] Image optimization enabled
  - [ ] No development dependencies bundled
  - [ ] Environment variables injected correctly
  - [ ] API URL points to production backend

- [ ] **CDN & Static Files**
  - [ ] Static assets served from CDN
  - [ ] Cache headers configured appropriately
  - [ ] Versioning on changeable assets
  - [ ] Image compression enabled

## Post-Deployment

### 6. Testing & Validation

- [ ] **Smoke Tests**
  - [ ] Home page loads
  - [ ] Login/signup working
  - [ ] API health check endpoint responds
  - [ ] Database connectivity verified
  - [ ] Redis connectivity verified
  - [ ] Socket.io connection works

- [ ] **Functional Tests**
  - [ ] Course browsing working
  - [ ] Week navigation working
  - [ ] Chat messages persisting
  - [ ] Message editing working
  - [ ] Message deletion working
  - [ ] Room isolation verified (messages don't leak between weeks)

- [ ] **Performance Tests**
  - [ ] Page load time < 3 seconds
  - [ ] API response time < 500ms
  - [ ] Database queries optimized (indexes working)
  - [ ] Memory usage stable
  - [ ] No memory leaks (monitor for 24+ hours)

### 7. Monitoring & Alerting

- [ ] **Monitoring Setup**
  - [ ] Server metrics collected (CPU, memory, disk)
  - [ ] Application metrics collected (requests/sec, error rate)
  - [ ] Database health monitored
  - [ ] Redis health monitored
  - [ ] Uptime monitoring enabled

- [ ] **Alerting**
  - [ ] Critical alerts configured (service down, database unavailable)
  - [ ] Warning alerts configured (high error rate, slow queries)
  - [ ] Alert recipients configured
  - [ ] On-call rotation setup
  - [ ] Alert testing completed

### 8. Security Hardening

- [ ] **Network Security**
  - [ ] Firewall rules configured
  - [ ] Only necessary ports open (80, 443)
  - [ ] Backend only accessible from frontend/internal services
  - [ ] Database only accessible from backend
  - [ ] DDoS protection enabled (CloudFlare recommended)

- [ ] **Dependency Security**
  - [ ] `npm audit` passed (no high/critical vulnerabilities)
  - [ ] Dependencies updated to latest secure versions
  - [ ] Automated vulnerability scanning enabled
  - [ ] Dependency update schedule established

### 9. Backup & Recovery

- [ ] **Backup Configuration**
  - [ ] MongoDB backups automated (daily)
  - [ ] Backups stored in separate region
  - [ ] Backup retention policy set (30 days minimum)
  - [ ] Test restore procedures
  - [ ] Document recovery procedures

- [ ] **Disaster Recovery Plan**
  - [ ] RTO (Recovery Time Objective) defined
  - [ ] RPO (Recovery Point Objective) defined
  - [ ] Failover procedures documented
  - [ ] Team trained on recovery procedures
  - [ ] Disaster recovery drill scheduled quarterly

### 10. Documentation & Handoff

- [ ] **Documentation**
  - [ ] Architecture diagram updated
  - [ ] Deployment procedure documented
  - [ ] Troubleshooting guide created
  - [ ] Runbook for common issues
  - [ ] API documentation current
  - [ ] Database schema documented

- [ ] **Operational Readiness**
  - [ ] Team trained on new stack
  - [ ] Escalation procedures documented
  - [ ] On-call handbook updated
  - [ ] Post-incident review template ready
  - [ ] Change management process established
  - [ ] Rollback procedures tested

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| DevOps Lead | | | |
| Backend Lead | | | |
| Frontend Lead | | | |
| QA Lead | | | |
| Product Manager | | | |

---

## Post-Launch Monitoring (First Week)

- [ ] Monitor server logs continuously
- [ ] Check error rates hourly
- [ ] Review performance metrics daily
- [ ] Conduct daily standup on production health
- [ ] Be ready for rapid rollback if needed
- [ ] Document any issues for post-launch review

---

## Common Issues & Resolution

### Database Connection Issues
- Check MongoDB connection string
- Verify IP whitelist
- Test with `mongosh` command
- Check firewall rules

### Redis Connection Issues
- Verify Redis URL format
- Check Redis password
- Test with `redis-cli`
- Verify network connectivity

### High CPU/Memory Usage
- Check slow queries
- Verify indexes are being used
- Review Socket.io connections
- Check for memory leaks
- Scale horizontally if needed

### Chat Room Issues
- Verify Redis adapter started
- Check Socket.io message logs
- Verify room naming convention
- Test cross-server connectivity

---

Created: 2024
Last Updated: April 1, 2026
