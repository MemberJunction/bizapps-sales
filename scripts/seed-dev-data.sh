#!/usr/bin/env bash
#
# Seed the MINIMUM MJ core records a developer needs to actually USE this app locally.
#
# WHY THIS IS A SEPARATE SCRIPT AND NOT metadata/
# ------------------------------------------------
# metadata/ is the app's VOCABULARY — deal statuses, roles, loss reasons. It ships with the app, is
# identical in every environment, and carries hardcoded UUIDs so it can be re-pushed safely.
#
# What this script creates is none of those things. A Company, an Employee and a User are DEPLOYMENT
# data: every real installation has its own, and shipping ours as app metadata would push a fake
# company into somebody's production database. So it lives here, is not referenced by mj-app.json,
# and is only ever run by hand.
#
# WHY IT IS NEEDED AT ALL — two hard stops discovered standing up S1:
#
#   1. `mj migrate` seeds ZERO companies and ZERO employees. But Pipeline.CompanyID is NOT NULL with
#      a foreign key to __mj.Company (L-14, and the decision that makes every rollup sliceable by
#      company for free). With no Company row, no Pipeline can be created — and since Deal.PipelineID
#      is also NOT NULL, no Deal either. The app is uncreatable until a Company exists.
#
#   2. MJ core seeds only the 'System' and 'Anonymous' users. MJ Explorer authenticates against the
#      MSAL tenant and then resolves the authenticated email to a __mj.User row; with no matching row
#      a successful tenant login still lands nowhere useful. The developer needs a User of their own,
#      carrying roles that hold entity permissions.
#
# Everything is created through the core CRUD procedures (spCreateCompany / spCreateEmployee /
# spCreateUser / spCreateUserRole) rather than by INSERT, so MJ's own side effects — record-change
# tracking, defaults, computed columns — all happen as they would through the app.
#
# IDEMPOTENT: every step is guarded on existence, so re-running after a rebuild-db.sh is safe and
# quiet. The UUIDs are fixed for the same reason.
#
# Usage: scripts/seed-dev-data.sh [developer-email]
#   The email defaults to $DEV_USER_EMAIL from .env, then to the git config user.email.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
set -a; . ./.env; set +a

DEV_EMAIL="${1:-${DEV_USER_EMAIL:-$(git config user.email || true)}}"
if [[ -z "$DEV_EMAIL" ]]; then
    echo "No developer email. Pass one as \$1, or set DEV_USER_EMAIL in .env." >&2
    exit 1
fi

# Fixed UUIDs so a re-run updates rather than duplicates.
COMPANY_ID='C0A5E100-0001-4A01-9E11-5B7C3D2F8A01'
EMPLOYEE_ID='E11B6200-0001-4B02-8F22-6C8D4E3A9B02'
USER_ID='05EC7300-0001-4C03-A033-7D9E5F4B0C03'

# CodeGen grants entity permissions to these three roles by default, so a developer user needs them
# to see this app's entities at all. Developer covers read/write; UI is what Explorer's own surfaces
# check; Integration is included so `mj test` and API-key calls resolve the same way.
ROLE_DEVELOPER='DEAFCCEC-6A37-EF11-86D4-000D3A4E707E'
ROLE_UI='E0AFCCEC-6A37-EF11-86D4-000D3A4E707E'
ROLE_INTEGRATION='DFAFCCEC-6A37-EF11-86D4-000D3A4E707E'

SQLCMD="sqlcmd -S ${DB_HOST},${DB_PORT:-1433} -U ${DB_USERNAME} -P ${DB_PASSWORD} -C -N o -b"

say() { printf '\n\033[1m=== %s ===\033[0m\n' "$1"; }

say "Seeding dev records into ${DB_DATABASE} for ${DEV_EMAIL}"

$SQLCMD -d "${DB_DATABASE}" -Q "
SET NOCOUNT ON;

-- 1. A Company. Pipeline.CompanyID needs one; without it the app cannot hold a pipeline.
IF NOT EXISTS (SELECT 1 FROM __mj.Company WHERE ID = '${COMPANY_ID}')
BEGIN
    EXEC __mj.spCreateCompany
        @ID          = '${COMPANY_ID}',
        @Name        = N'Blue Cypress (Local Dev)',
        @Description = N'Local development company. Created by scripts/seed-dev-data.sh so pipelines and deals have an owning company — NOT app metadata, and not intended for any real environment.',
        @Domain      = N'bluecypress.io',
        @Website     = N'https://bluecypress.io';
    PRINT '  + Company created';
END
ELSE PRINT '  = Company already present';

-- 2. An Employee. Every owner field in this app points at __mj.Employee — SalesAccount.OwnerEmployeeID,
--    Deal.OwnerEmployeeID (the server-maintained stamp), DealTeamMember.EmployeeID. All are nullable,
--    so this is not strictly required to create a Deal, but a deal team is the point of §5 and an
--    empty Employee table makes that panel untestable.
IF NOT EXISTS (SELECT 1 FROM __mj.Employee WHERE ID = '${EMPLOYEE_ID}')
BEGIN
    EXEC __mj.spCreateEmployee
        @ID        = '${EMPLOYEE_ID}',
        @FirstName = N'Local',
        @LastName  = N'Developer',
        @CompanyID = '${COMPANY_ID}',
        @Title     = N'Account Executive',
        @Email     = N'${DEV_EMAIL}',
        @Active    = 1;
    PRINT '  + Employee created';
END
ELSE PRINT '  = Employee already present';

-- 3. The developer's User, linked to that Employee. The Employee link is what makes 'my deals' work:
--    __mj.User.EmployeeID is how MJ answers 'who am I' as a rep, and every owner-scoped filter in
--    this app resolves through it.
IF NOT EXISTS (SELECT 1 FROM __mj.[User] WHERE Email = N'${DEV_EMAIL}')
BEGIN
    EXEC __mj.spCreateUser
        @ID         = '${USER_ID}',
        @Name       = N'${DEV_EMAIL}',
        @FirstName  = N'Local',
        @LastName   = N'Developer',
        @Email      = N'${DEV_EMAIL}',
        @Type       = N'Owner',
        @IsActive   = 1,
        @EmployeeID = '${EMPLOYEE_ID}';
    PRINT '  + User created';
END
ELSE PRINT '  = User already present';

-- 4. Roles. CodeGen granted this app's entity permissions to Developer / UI / Integration, so without
--    at least one of them the entities are invisible even to a valid user.
DECLARE @uid UNIQUEIDENTIFIER = (SELECT TOP 1 ID FROM __mj.[User] WHERE Email = N'${DEV_EMAIL}');

IF NOT EXISTS (SELECT 1 FROM __mj.UserRole WHERE UserID = @uid AND RoleID = '${ROLE_DEVELOPER}')
    EXEC __mj.spCreateUserRole @UserID = @uid, @RoleID = '${ROLE_DEVELOPER}';
IF NOT EXISTS (SELECT 1 FROM __mj.UserRole WHERE UserID = @uid AND RoleID = '${ROLE_UI}')
    EXEC __mj.spCreateUserRole @UserID = @uid, @RoleID = '${ROLE_UI}';
IF NOT EXISTS (SELECT 1 FROM __mj.UserRole WHERE UserID = @uid AND RoleID = '${ROLE_INTEGRATION}')
    EXEC __mj.spCreateUserRole @UserID = @uid, @RoleID = '${ROLE_INTEGRATION}';
PRINT '  = Roles ensured (Developer, UI, Integration)';

-- 5. Application access. Roles grant ENTITY permissions; they do not put an app in the switcher —
--    __mj.UserApplication does, and MJ does not create those rows on its own. Without this the
--    hand-authored "Sales" application (and its Deals nav item, which is the ONLY way to reach the
--    deal workspace) is invisible in Explorer even though the row exists and the user can read every
--    table behind it. Both sales apps are granted: the hand-authored one for the workspace, and the
--    CodeGen-generated one because it is the entity browser the demo walkthrough uses.
--    USER-SPECIFIC, so it belongs here and not in metadata/ — a UserApplication row is not part of
--    the app, it is a statement about one person's Explorer.
DECLARE @appSeq INT = (SELECT ISNULL(MAX(Sequence), 0) FROM __mj.UserApplication WHERE UserID = @uid);
DECLARE @appID UNIQUEIDENTIFIER;

DECLARE appCur CURSOR LOCAL FAST_FORWARD FOR
    SELECT ID FROM __mj.Application WHERE Name IN (N'Sales', N'__mj_BizAppsSales');
OPEN appCur;
FETCH NEXT FROM appCur INTO @appID;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM __mj.UserApplication WHERE UserID = @uid AND ApplicationID = @appID)
    BEGIN
        SET @appSeq = @appSeq + 1;
        EXEC __mj.spCreateUserApplication @UserID = @uid, @ApplicationID = @appID,
                                          @Sequence = @appSeq, @IsActive = 1;
    END
    FETCH NEXT FROM appCur INTO @appID;
END
CLOSE appCur;
DEALLOCATE appCur;
PRINT '  = Application access ensured (Sales, __mj_BizAppsSales)';
"

say "Summary"
$SQLCMD -d "${DB_DATABASE}" -h -1 -W -s"|" -Q "
SET NOCOUNT ON;
SELECT 'companies=' + CAST(COUNT(*) AS varchar) FROM __mj.Company;
SELECT 'employees=' + CAST(COUNT(*) AS varchar) FROM __mj.Employee;
SELECT 'user=' + Email + ' type=' + Type + ' roles=' +
       CAST((SELECT COUNT(*) FROM __mj.UserRole ur WHERE ur.UserID = u.ID) AS varchar)
  FROM __mj.[User] u WHERE u.Email = N'${DEV_EMAIL}';
SELECT 'apps=' + STRING_AGG(a.Name, ', ')
  FROM __mj.UserApplication ua
  JOIN __mj.Application a ON a.ID = ua.ApplicationID
  JOIN __mj.[User] u ON u.ID = ua.UserID
 WHERE u.Email = N'${DEV_EMAIL}' AND ua.IsActive = 1;
"

cat <<'NEXT'

Seeded. A pipeline can now be created (Pipeline.CompanyID has a target), and the developer's
email resolves to a User with entity permissions.

NOTE this is LOCAL DEV DATA. It is not in metadata/, not referenced by mj-app.json, and must never
be treated as part of the app.
NEXT
