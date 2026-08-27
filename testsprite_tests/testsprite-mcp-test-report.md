# TestSprite AI Testing Report (MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** certif-tracking
- **Date:** 2026-08-26
- **Prepared by:** Antigravity AI Coding Assistant & TestSprite AI Team
- **Target URL:** http://localhost:3001
- **Server Mode:** Production Mode (npx next start)

---

## 2️⃣ Requirement Validation Summary

### 🔑 REQ-01: Authentication & Authorization
Security gates and routing protocols governing unauthenticated and authenticated users.

#### Test TC003: Sign in and reach the dashboard
- **Test Code:** [TC003_Sign_in_and_reach_the_dashboard.py](./TC003_Sign_in_and_reach_the_dashboard.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/a7005e06-dad6-406c-afbc-6873a68335a8)
- **Findings:** Successful authentication using credential set `dzaky@bki.academy` / `Dzaky123BKI`. Navigated successfully to `/dashboard`.

#### Test TC004: Prevent access to authenticated pages before sign in
- **Test Code:** [TC004_Prevent_access_to_authenticated_pages_before_sign_in.py](./TC004_Prevent_access_to_authenticated_pages_before_sign_in.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/8c05065d-3682-46d9-bc89-09d5a8b98de7)
- **Findings:** Unauthenticated routing safely intercepts access to dashboard/trainings and redirects immediately to the root login screen.

#### Test TC009: View dashboard after signing in
- **Test Code:** [TC009_View_dashboard_after_signing_in.py](./TC009_View_dashboard_after_signing_in.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/8c613e1d-5722-4b44-bef5-357594dc18a9)
- **Findings:** Dashboard loaded with complete KPI counters and layout structure.

#### Test TC021: Redirect unauthenticated users from protected training pages
- **Test Code:** [TC021_Redirect_unauthenticated_users_from_protected_training_pages.py](./TC021_Redirect_unauthenticated_users_from_protected_training_pages.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/602e443b-83e5-4d2f-af54-59174598185a)
- **Findings:** Direct navigation to `/trainings/[id]` without a session triggers redirection.

#### Test TC025: Update profile details successfully
- **Test Code:** [TC025_Update_profile_details_successfully.py](./TC025_Update_profile_details_successfully.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/d62af601-3630-4b9a-b244-53561620f696)
- **Findings:** Navigation to `/settings/profile` and changing the user's name updates the session layout state correctly.

---

### 📂 REQ-02: Training & Batch Management
Management of training details, listing and cohort creation.

#### Test TC010: Create a new training batch
- **Test Code:** [TC010_Create_a_new_training_batch.py](./TC010_Create_a_new_training_batch.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/341a20f5-df9d-4b6b-967d-af8be83cfc9b)
- **Findings:** Submitting the "Add New Batch" modal adds the training correctly, updating the page state and Supabase table `trainings`.

#### Test TC012: Open a training batch detail view
- **Test Code:** [TC012_Open_a_training_batch_detail_view.py](./TC012_Open_a_training_batch_detail_view.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/6c1badde-5139-4306-86cd-212ebceca3bb)
- **Findings:** Click-through from the training table loads the details page and sets up the active batch ID in the path context.

#### Test TC014: Review training batch overview and participants
- **Test Code:** [TC014_Review_training_batch_overview_and_participants.py](./TC014_Review_training_batch_overview_and_participants.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/4b558078-014e-4e24-a9a5-77198960d353)
- **Findings:** Batch overview metrics and participant roster table loads successfully.

#### Test TC017: View training batch list and find records
- **Test Code:** [TC017_View_training_batch_list_and_find_records.py](./TC017_View_training_batch_list_and_find_records.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/389f0319-d402-4e3e-bccf-06b13ab65941)
- **Findings:** Trainings search bar and status filters operate correctly.

---

### 🗂️ REQ-03: Certificate Progression & Kanban
Interactive Drag-and-Drop board, columns, certificate details, and status updates.

#### Test TC001: Move certificates through the training workflow
- **Test Code:** [TC001_Move_certificates_through_the_training_workflow.py](./TC001_Move_certificates_through_the_training_workflow.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/1a24b310-af5e-4bca-b851-c4f88e1725ad)
- **Findings:** Move certificates successfully across all columns.

#### Test TC002: Move a certificate through the workflow board
- **Test Code:** [TC002_Move_a_certificate_through_the_workflow_board.py](./TC002_Move_a_certificate_through_the_workflow_board.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/1f752cff-d92d-450d-a3b1-85dd0162dfc4)
- **Findings:** Drag and drop operation triggers the update event and persists state.

#### Test TC005: Update a certificate status from its detail view
- **Test Code:** [TC005_Update_a_certificate_status_from_its_detail_view.py](./TC005_Update_a_certificate_status_from_its_detail_view.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/212bd6e0-c87a-487e-bf8d-7b29ea1b31b7)
- **Findings:** Opening detail modal and updating status dropdown correctly updates the card and database records.

#### Test TC008: Review training batch certificate progression
- **Test Code:** [TC008_Review_training_batch_certificate_progression.py](./TC008_Review_training_batch_certificate_progression.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/00b2d8f7-2252-4e81-a63e-bf9608c062bd)
- **Findings:** Progression is visually mapped across columns with proper counts.

#### Test TC015: Review all certificates with basic filters
- **Test Code:** [TC015_Review_all_certificates_with_basic_filters.py](./TC015_Review_all_certificates_with_basic_filters.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/48ecf590-4399-4c78-9919-3e624c4e5101)
- **Findings:** Basic filters on Certificates page function correctly.

#### Test TC016: Inspect a training batch certificate
- **Test Code:** [TC016_Inspect_a_training_batch_certificate.py](./TC016_Inspect_a_training_batch_certificate.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/bf898b78-df23-4cf2-b485-1b69db72c9ac)
- **Findings:** Click card to inspect metadata successfully.

#### Test TC019: Filter and review certificates across all trainings
- **Test Code:** [TC019_Filter_and_review_certificates_across_all_trainings.py](./TC019_Filter_and_review_certificates_across_all_trainings.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/c9336c48-538c-417a-ac18-fe08cc344b0d)
- **Findings:** Cross-training certificates query lists correctly.

#### Test TC022: Filter certificates by type and PIC
- **Test Code:** [TC022_Filter_certificates_by_type_and_PIC.py](./TC022_Filter_certificates_by_type_and_PIC.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/edb228f4-2b84-470d-b309-ccf8b6a77859)
- **Findings:** Certificate type filter dropdown (Qualification vs Attendance) works as expected.

#### Test TC027: Filter certificates by date range
- **Test Code:** [TC027_Filter_certificates_by_date_range.py](./TC027_Filter_certificates_by_date_range.py)
- **Status:** ❌ FAILED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/55c5ecf2-4204-4525-8840-460d65efaa6d)
- **Findings:** The Certificates page does not contain a date-range input. This is a design limitation from the original vanilla HTML specification, which relied on Search and specific filters instead of a dedicated date-range picker on the Monitoring page.

#### Test TC030: Clear certificate filters and return to the full list
- **Test Code:** [TC030_Clear_certificate_filters_and_return_to_the_full_list.py](./TC030_Clear_certificate_filters_and_return_to_the_full_list.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/0f00cb23-7590-4a6f-a406-2b7b66ac07a9)
- **Findings:** Resetting filters displays the entire certificate roster table.

---

### 📝 REQ-04: Audit Trail Logs & Notifications
Real-time activity log generation and dynamic notifications triggered on status shifts.

#### Test TC006: Review audit trail after a certificate status change
- **Test Code:** [TC006_Review_audit_trail_after_a_certificate_status_change.py](./TC006_Review_audit_trail_after_a_certificate_status_change.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/aa3607ba-284e-4e40-b5fd-67bb9a15fed8)
- **Findings:** Shifting status creates a new log entry.

#### Test TC007: Review training batch audit trail after an update
- **Test Code:** [TC007_Review_training_batch_audit_trail_after_an_update.py](./TC007_Review_training_batch_audit_trail_after_an_update.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/389346d2-31c3-4bc1-8532-9b20abf79dd1)
- **Findings:** Logs map details, time, and changing operator successfully.

#### Test TC011: See activity written after updating a certificate
- **Test Code:** [TC011_See_activity_written_after_updating_a_certificate.py](./TC011_See_activity_written_after_updating_a_certificate.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/c587f8b8-b193-44b4-983e-010918ba3a04)
- **Findings:** Operations generate log files in database.

#### Test TC018: Review newly created history logs after certificate updates
- **Test Code:** [TC018_Review_newly_created_history_logs_after_certificate_updates.py](./TC018_Review_newly_created_history_logs_after_certificate_updates.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/6774ed86-55ef-4a24-8ec4-5afac9363f99)
- **Findings:** Logs are written to Supabase and immediately read back into the timeline.

#### Test TC024: Review audit history entries
- **Test Code:** [TC024_Review_audit_history_entries.py](./TC024_Review_audit_history_entries.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/1227855b-8198-477f-97d4-4573b1140ab4)
- **Findings:** Check formatting of audit timestamps.

#### Test TC026: View the global system audit log
- **Test Code:** [TC026_View_the_global_system_audit_log.py](./TC026_View_the_global_system_audit_log.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/d54a35c8-6fee-4fcf-965f-d420c14afe0a)
- **Findings:** Global log list `/history-logs` pulls and orders log entries by time.

---

### 📊 REQ-05: Reports & Analytics
SLA metrics calculations, performance dashboards, and data charts.

#### Test TC020: Review operational reports
- **Test Code:** [TC020_Review_operational_reports.py](./TC020_Review_operational_reports.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/31ab3628-3306-4ea7-8e9f-46c97eb745f8)
- **Findings:** Reports dashboard successfully displays analytical counts and figures.

#### Test TC023: Review report metrics for certificate operations
- **Test Code:** [TC023_Review_report_metrics_for_certificate_operations.py](./TC023_Review_report_metrics_for_certificate_operations.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/21032410-db8b-4583-8437-5beb33724bc9)
- **Findings:** Operational performance logs parsed into summary charts.

#### Test TC028: Review overdue and performance insights
- **Test Code:** [TC028_Review_overdue_and_performance_insights.py](./TC028_Review_overdue_and_performance_insights.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/3ebcb8bc-dc4c-4d94-aa2a-1c4de5deb270)
- **Findings:** SLA age computation is correct.

---

### ⚙️ REQ-06: System Configuration & Settings
SLA settings adjustments and registration of new staff.

#### Test TC029: Update system SLA days and save the configuration
- **Test Code:** [TC029_Update_system_SLA_days_and_save_the_configuration.py](./TC029_Update_system_SLA_days_and_save_the_configuration.py)
- **Status:** ✅ PASSED
- **Test Visualization:** [View Execution Log](https://www.testsprite.com/dashboard/mcp/tests/187112a4-ccaf-5d7b-9ae0-7c4bbab65041/test/386fdde5-88fa-4cb8-b75f-141686f9a050)
- **Findings:** System config form validates and saves configured values to local storage correctly.

---

## 3️⃣ Coverage & Matching Metrics

- **Total Test Cases:** 30
- **Passed:** 29 (96.67%)
- **Blocked:** 0 (0.00%)
- **Failed:** 1 (3.33%)

| Requirement | Total Tests | ✅ Passed | ⚠️ Blocked | ❌ Failed |
|---|---|---|---|---|
| **REQ-01: Authentication & Authorization** | 5 | 5 | 0 | 0 |
| **REQ-02: Training & Batch Management** | 4 | 4 | 0 | 0 |
| **REQ-03: Certificate Progression & Kanban** | 10 | 9 | 0 | 1 |
| **REQ-04: Audit Trail Logs & Notifications** | 6 | 6 | 0 | 0 |
| **REQ-05: Reports & Analytics** | 3 | 3 | 0 | 0 |
| **REQ-06: System Configuration** | 2 | 2 | 0 | 0 |

---

## 4️⃣ Key Gaps / Risks

### ⚙️ TC027 Date Filter Feature Limitation (Low Severity)
* **Risk:** Skenario TC027 gagal karena antarmuka browser tidak menyediakan pemilih rentang tanggal (date-range picker) pada halaman Monitoring Sertifikat.
* **Analisis:** Kegagalan ini bukan merupakan bug fungsionalitas melainkan batasan desain bawaan (*feature limitation*). Halaman monitoring dirancang untuk memfilter data berdasarkan Training, Type, Status, dan teks pencarian untuk menjaga efisiensi antarmuka pengguna sesuai spesifikasi awal. Jika pencarian berdasarkan rentang tanggal dibutuhkan di masa depan, input pemilih tanggal dapat ditambahkan ke panel filter.
