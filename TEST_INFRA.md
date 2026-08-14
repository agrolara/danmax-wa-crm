# E2E Test Infra: DanMax WA CRM Multi-Tenant & Disk Persistence

## Test Philosophy
- Opaque-box, requirement-driven verification of multi-tenant disk persistence, auto-recovery, and tenant isolation.
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise Interaction + Realistic Lifecycle Workloads.

## Feature Inventory
| # | Feature | Source | Tier 1 | Tier 2 | Tier 3 |
|---|---------|--------|:------:|:------:|:------:|
| 1 | Multi-Disk File Writes | ORIGINAL_REQUEST §1 | 5 | 5 | ✓ |
| 2 | Auto-Recovery & Backfill on Read | ORIGINAL_REQUEST §1 | 5 | 5 | ✓ |
| 3 | Atomic File Writes & Corruption Protection | ORIGINAL_REQUEST §1 | 5 | 5 | ✓ |
| 4 | OpenWA Config Persistence | ORIGINAL_REQUEST §1 | 5 | 5 | ✓ |
| 5 | Admin Tenant Aliasing & Canonical Mapping | ORIGINAL_REQUEST §2 | 5 | 5 | ✓ |
| 6 | Request Tenant Resolution (`getTenantIdFromReq`) | ORIGINAL_REQUEST §2 | 5 | 5 | ✓ |
| 7 | Route-Level Admin Normalization | ORIGINAL_REQUEST §2 | 5 | 5 | ✓ |
| 8 | Group Categories & Mapping Persistence | ORIGINAL_REQUEST §3 | 5 | 5 | ✓ |
| 9 | Rich Templates Store Persistence | ORIGINAL_REQUEST §3 | 5 | 5 | ✓ |
| 10 | Strict Client Tenant Isolation | ORIGINAL_REQUEST §3 | 5 | 5 | ✓ |
| 11 | Kanban Store Persistence | ORIGINAL_REQUEST §1 | 5 | 5 | ✓ |
| 12 | Multi-Line Tenant Persistence | ORIGINAL_REQUEST §1 | 5 | 5 | ✓ |
| 13 | TypeScript 0-Error Build Verification | ORIGINAL_REQUEST §4 | 5 | 5 | ✓ |

## Test Architecture
- Test Runner: Node.js verification script executing against compiled modules and direct disk state.
- Test Files & Test Data: Test stores written to temporary test subdirectories across the persistent locations, verifying multi-directory writing, partial wiping, recovery backfill, alias mapping, and cross-tenant boundaries.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Container Cold Boot with Wiped `./data` (Surviving `~/.danmax_crm_data`) | F1, F2, F4, F8, F9 | High |
| 2 | Multi-Admin Simultaneous Session (Owner + SuperAdmin + GlobalLine) editing Templates | F5, F6, F7, F9 | High |
| 3 | Client Tenant Onboarding with Custom Categories without Admin Leakage | F8, F9, F10 | High |
| 4 | Power Loss Simulation Mid-Write (Atomic Temp File Invariance) | F2, F3 | High |
| 5 | Full Browser Refresh & Re-login Category / Template Retention | F5, F8, F9, F11 | Medium |

## Coverage Thresholds
- Tier 1: ≥5 per feature (Happy-path isolation tests)
- Tier 2: ≥5 per feature (Boundary, empty, malformed, missing dir tests)
- Tier 3: Pairwise coverage of major feature interactions
- Tier 4: ≥5 realistic lifecycle scenarios
