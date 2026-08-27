PRODUCT REQUIREMENTS DOCUMENT (PRD)
1. Product Overview
Product Name

BKI Academy Certificate Management System (CMS)

Problem Statement

Saat ini proses setelah pelaksanaan training belum memiliki sistem monitoring terintegrasi.

Setelah training selesai:

Tidak ada tracking status sertifikat
Tidak diketahui siapa PIC yang bertanggung jawab
Tidak ada reminder jika sertifikat terlambat
Tidak ada histori proses sertifikat
Management sulit mengetahui bottleneck proses

Akibatnya:

Sertifikat terlambat dikirim
Follow-up masih manual
Risiko human error meningkat
2. Product Goal

Membangun sistem internal untuk:

Tracking lifecycle sertifikat peserta
Monitoring progres penerbitan sertifikat
Memberikan reminder otomatis
Menyediakan dashboard operasional
Menyediakan histori/audit trail
3. Scope MVP
Included

✅ Training management
✅ Participant management
✅ Qualification certificate tracking
✅ Attendance certificate tracking
✅ Status workflow
✅ PIC assignment
✅ Dashboard monitoring
✅ Email reminder
✅ Activity history

Not Included (Future)

❌ Payment system
❌ Registration training
❌ LMS
❌ Online examination
❌ Trainer management kompleks

4. User Roles
1. Admin Training

Role utama.

Permission:

Create training
Input peserta
Update sertifikat
Generate report
2. Certificate Team

Fokus:

Generate sertifikat
Printing
Signature
Shipping
3. Manager

View only:

Dashboard
Performance
Delay monitoring
5. System Architecture
                 USER

                  |
                  |

          HTML / CSS / JS
              Frontend

                  |

              Supabase

       ----------------------

       PostgreSQL Database

       Authentication

       Storage

       Edge Functions

       ----------------------

                  |

          Email Notification
6. Backend Design (Supabase)

Database menggunakan PostgreSQL.

ERD

High level:

                 users
                   |
                   |
                   |
training -------- user
   |
   |
   |
participants
   |
   |
certificates
   |
   |
certificate_history


training
   |
   |
training_status


notifications
Database Schema
TABLE 1 — users

Purpose:
Menyimpan user aplikasi.

users

id UUID PK

name

email

role

created_at

Example:

id	name	role
001	Andi	Admin
002	Budi	Certificate
TABLE 2 — trainings

Master training.

trainings

id UUID PK

training_name

batch

start_date

end_date

training_status

pic_id FK users

created_at

Example:

Training	Batch	Status
Internal Auditor ISM	116	Completed
TABLE 3 — participants

Peserta training.

participants

id UUID PK

training_id FK

name

company

email

position

phone

Relationship:

1 Training

has many

Participants
TABLE 4 — certificates

Core table.

certificates


id UUID PK


participant_id FK


certificate_type


status


certificate_number


file_url


generated_at


printed_at


sent_at


created_at

certificate_type:

ENUM:

QUALIFICATION

ATTENDANCE

status:

PENDING

PROCESSING

GENERATED

QC

PRINTING

SIGNING

SHIPPING

COMPLETED
TABLE 5 — certificate_history

Audit trail.

certificate_history


id


certificate_id


previous_status


new_status


changed_by


note


created_at

Example:

Old	New	User
Printing	Signing	Andi
TABLE 6 — notifications

Untuk reminder.

notifications


id


user_id


title


message


type


is_read


created_at
TABLE 7 — attachments

File management.

attachments


id


certificate_id


file_name


file_url


file_type
Supabase Storage

Bucket:

certificate-files

Structure:

certificate-files

/
 training_name

    /
     qualification

          cert001.pdf

     attendance

          attendance001.pdf
7. Application Flow
Main Flow
Training Completed

        |

Admin create training record

        |

Upload participant list

        |

System generate certificate task

        |

Certificate Team process


        |

Update status


        |

System record history


        |

If delayed

        |

Send reminder


        |

Completed
8. Use Cases
UC-01 Create Training

Actor:

Admin Training

Flow:

Login
Open Training
Click Add Training
Input:
Name
Batch
Date
PIC
Save

System:

Create training record.

UC-02 Upload Participant

Actor:

Admin

Flow:

Training Detail

↓

Participant Tab

↓

Upload Excel

↓

Validation

↓

Import

Validation:

Duplicate participant
Empty name
Invalid email
UC-03 Generate Certificate Task

Trigger:

Training status = Completed

System automatically:

Create:

Participant A

Qualification Certificate

Status:
Pending


Participant A

Attendance Certificate

Status:
Pending
UC-04 Update Certificate Progress

Actor:

Certificate Team

Flow:

Open Certificate

↓

Change Status

↓

Add Note

↓

Save

↓

History created

↓

Notification sent
UC-05 Overdue Reminder

Automation:

Every morning:

Check:

status != completed

AND

last_update > SLA

Send email.

9. Frontend Structure

Pages:

/
Login


/dashboard


/trainings


/trainings/:id


/certificates


/reports


/settings
PAGE 1 — Dashboard

Purpose:

Operational overview.

Header
Good Morning, Andi

Today:
25 Aug 2026
KPI Cards
Card 1
Training Completed

42

This month
Card 2
Certificate Pending

18

Need Attention
Card 3
Overdue

5

> SLA
Card 4
Completion Rate

92%
Chart

Certificate Pipeline

Pending        12

Processing     8

Printing       5

Shipping       3

Completed      50
Recent Activity Card
Recent Update


✓ IA ISM Batch 116
  Changed:
  Printing → Signing


✓ CSO Batch 53
  Completed
PAGE 2 — Training List

Table:

Training	Batch	Date	Participant	Status
ISM	116	Aug	25	Completed

Features:

Search
Filter
Sort

Button:

+ Add Training
Add Training Modal

Fields:

Training Name

Batch

Start Date

End Date

PIC

Status

Button:

Cancel

Create Training
PAGE 3 — Training Detail

Layout:

Header:

Internal Auditor ISM Code

Batch 116


03-05 August 2026


Status:
Completed

Tabs:

Overview

Participants

Certificates

Activity
Overview Tab

Cards:

Participants

25


Qualification

80%


Attendance

100%
Participant Tab

Table:

Name	Company	Qualification	Attendance
Ahmad	ABC	Printing	Sent
Certificate Tab

Kanban:

PENDING

Ahmad


PROCESSING

Budi


PRINTING

Rudi


COMPLETED

Sinta
Certificate Detail Modal

Click card:

Participant

Ahmad


Certificate Type

Qualification


Current Status

PRINTING


Timeline


✓ Generated

✓ QC

✓ Printed

○ Signature

○ Shipping


Notes:

Waiting signature

Button:

Update Status
PAGE 4 — Certificate Monitoring

Global view.

Filter:

Training

Certificate Type

Status

PIC

Date

Table:

Participant	Training	Type	Status	Age
Ahmad	ISM	Qualification	Printing	5 days
PAGE 5 — Reports

Manager page.

Cards:

Average Completion Time

4.2 days


Late Certificate

7


Total Certificate

250

Charts:

Monthly completion
Delay reason
PIC performance
10. UI Design Direction

Style:

Professional enterprise dashboard.

Reference:

Linear
Notion
Stripe Dashboard

Color:

Primary:

Navy / Blue

Status:

Green:
Completed

Yellow:
Processing

Red:
Overdue

Gray:
Pending

Component Library
Cards

Rounded:

12px

Shadow:

Soft

Buttons

Primary:

Save Changes

Secondary:

Cancel

Danger:

Delete
Modal

Used for:

Add Training
Update Status
Upload Participant
11. MVP Development Priority
Sprint 1

Backend:

✅ Supabase setup
✅ Database schema
✅ Authentication

Frontend:

✅ Login
✅ Dashboard skeleton

Sprint 2

Core:

✅ Training CRUD
✅ Participant upload
✅ Certificate workflow

Sprint 3

Automation:

✅ Email reminder
✅ Activity log
✅ Report

12. Success Metrics

After implementation:

Operational:

100% completed training masuk tracker
Certificate overdue turun >80%
Tidak ada sertifikat tanpa PIC
Management dapat melihat status real-time