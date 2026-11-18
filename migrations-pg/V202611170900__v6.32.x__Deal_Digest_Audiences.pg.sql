-- =============================================================================================
-- PostgreSQL counterpart of V202611170900__v6.32.x__Deal_Digest_Audiences.sql
-- =============================================================================================
-- Written by hand to the translation conventions of the neighbouring .pg.sql files:
-- uniqueidentifier -> UUID (default gen_random_uuid()), bit -> BOOLEAN (TRUE/FALSE), nvarchar(n)
-- -> VARCHAR(n), nvarchar(MAX) -> TEXT, extended properties -> COMMENT ON. Both tables are new, so
-- there is no CodeGen output to carry; a PostgreSQL host runs `mj codegen` after installing.
--   * UQ_DealDigestRecipient IS `NULLS NOT DISTINCT` (PostgreSQL 15+). SQL Server treats two NULL
--     CompanyIDs as equal in a UNIQUE constraint, and that is the intended rule: one portfolio-wide
--     row per person per audience. PostgreSQL's default treats NULLs as distinct and would let a
--     person hold the same portfolio-wide row twice.
--   * Foreign-key targets in ${mjSchema} name the quoted "ID" column, as in
--     V202611062300__v6.25.x__Pipeline_Company_Link.pg.sql.
--   * No CHECK ties CompanyID to IsPortfolioWide; see the SQL Server file's header.
-- UNVALIDATED AGAINST A LIVE PostgreSQL SERVER: this repo has no PostgreSQL host, as with every
-- file in this directory.
-- =============================================================================================


CREATE TABLE __mj_BizAppsSales."DealDigestAudienceType" (
 "ID" UUID NOT NULL DEFAULT gen_random_uuid(),
 "Code" VARCHAR(50) NOT NULL,
 "Name" VARCHAR(100) NOT NULL,
 "Description" TEXT NULL,
 "IsPortfolioWide" BOOLEAN NOT NULL DEFAULT FALSE,
 "MinDaysLapsed" INTEGER NULL,
 "IncludeMissingCloseDate" BOOLEAN NOT NULL DEFAULT TRUE,
 "SendWhenEmpty" BOOLEAN NOT NULL DEFAULT FALSE,
 "GroupByCompany" BOOLEAN NOT NULL DEFAULT TRUE,
 "SubjectTemplate" VARCHAR(255) NULL,
 "IntroTemplate" TEXT NULL,
 "EmptyMessage" VARCHAR(500) NULL,
 "DisplayRank" INTEGER NOT NULL DEFAULT 0,
 "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
 CONSTRAINT "PK_DealDigestAudienceType" PRIMARY KEY ("ID"),
 CONSTRAINT "UQ_DealDigestAudienceType_Code" UNIQUE ("Code"),
 CONSTRAINT "CK_DealDigestAudienceType_MinDaysLapsed" CHECK ("MinDaysLapsed" IS NULL OR "MinDaysLapsed" >= 0)
);

CREATE TABLE __mj_BizAppsSales."DealDigestRecipient" (
 "ID" UUID NOT NULL DEFAULT gen_random_uuid(),
 "DealDigestAudienceTypeID" UUID NOT NULL,
 "CompanyID" UUID NULL,
 "EmployeeID" UUID NOT NULL,
 "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
 CONSTRAINT "PK_DealDigestRecipient" PRIMARY KEY ("ID"),
 CONSTRAINT "UQ_DealDigestRecipient" UNIQUE NULLS NOT DISTINCT ("DealDigestAudienceTypeID", "CompanyID", "EmployeeID"),
 CONSTRAINT "FK_DealDigestRecipient_DealDigestAudienceType" FOREIGN KEY ("DealDigestAudienceTypeID")
 REFERENCES __mj_BizAppsSales."DealDigestAudienceType" ("ID"),
 CONSTRAINT "FK_DealDigestRecipient_Company" FOREIGN KEY ("CompanyID")
 REFERENCES ${mjSchema}."Company" ("ID"),
 CONSTRAINT "FK_DealDigestRecipient_Employee" FOREIGN KEY ("EmployeeID")
 REFERENCES ${mjSchema}."Employee" ("ID")
);

COMMENT ON TABLE __mj_BizAppsSales."DealDigestAudienceType" IS 'One kind of audience for the Lapsed Close Date Digest (Company Leader, CEO, CFO, CTO). Behaviour comes from the flags on this row, never from the Code or Name: the digest builder reads IsPortfolioWide, MinDaysLapsed, IncludeMissingCloseDate, SendWhenEmpty and GroupByCompany, so adding an audience is a data change with no code impact.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."Code" IS 'Stable identifier the seeds and the digest builder key on. Renaming Name is cosmetic; renaming Code changes an identifier.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."Name" IS 'Display name of the audience, as shown to the people who administer recipients.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."Description" IS 'What this audience is for and who belongs in it.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."IsPortfolioWide" IS 'When 1, recipients of this audience receive one digest covering every company, and their recipient rows carry no Company. When 0, each recipient row names the company the digest covers. Enforced in the recipient''s Save(), not by a CHECK, because it ties a column on this table to one on another.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."MinDaysLapsed" IS 'A deal appears only once its expected close date is at least this many days past. Empty means no minimum: any deal whose date has passed appears. Never negative.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."IncludeMissingCloseDate" IS 'When 1, open deals that never had an expected close date are listed too, after the lapsed ones. When 0 only deals whose date has passed appear.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."SendWhenEmpty" IS 'When 1, a recipient with nothing lapsed still gets the email, carrying the Empty Message, so silence cannot be mistaken for a missed send. When 0 the email is skipped.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."GroupByCompany" IS 'When 1, the digest lists deals under a heading per company. When 0 it is one flat list.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."SubjectTemplate" IS 'Subject line of the email. Empty means the digest builder''s built-in subject.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."IntroTemplate" IS 'Opening text of the email, above the deal list. Empty means the digest builder''s built-in introduction.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."EmptyMessage" IS 'Text sent in place of the deal list when nothing is lapsed and Send When Empty is on.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."DisplayRank" IS 'Order in which audiences are listed and processed; lowest first.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."IsActive" IS 'Whether this audience is sent at all. Clearing it pauses the audience without deleting its recipients.';

COMMENT ON TABLE __mj_BizAppsSales."DealDigestRecipient" IS 'One person receiving one audience''s Lapsed Close Date Digest, for one company or, on a portfolio-wide audience, for all of them. The audience decides what the email contains; this row decides who gets it.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestRecipient"."DealDigestAudienceTypeID" IS 'The audience this person receives.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestRecipient"."CompanyID" IS 'The company the digest covers for this person. Empty on a portfolio-wide audience, and required on any other; the recipient''s Save() enforces that pairing.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestRecipient"."EmployeeID" IS 'The employee who receives the digest, at their work email.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestRecipient"."IsActive" IS 'Whether this person is sent the digest. Clearing it stops the email without deleting the row.';
