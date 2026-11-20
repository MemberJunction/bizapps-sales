-- =============================================================================================
-- PostgreSQL counterpart of V202611101319__v6.27.x__Metadata_Sync.sql
-- =============================================================================================
-- Same records, same values as the T-SQL file; see its header for what ships and why.
--
-- HOW IT WAS MADE: `mj sql-convert --from tsql --to postgres` (MJ CLI 6.2.1) on each block of the
-- push log, one block per run (the converter merges a multi-block log into one). Each block's
-- guard is then widened to match the T-SQL file (ID, or the natural key) and its update branch
-- removed, so every record is create-only. Core references use ${mjSchema}.
-- =============================================================================================

-- Save MJ: Authorizations (core SP call only)
DO $mj$
DECLARE
  p_ID_0d21b279ae9f UUID;
  p_ParentID_0d21b279ae9f UUID;
  p_Name_0d21b279ae9f VARCHAR(100);
  p_IsActive_0d21b279ae9f BOOLEAN;
  p_UseAuditLog_0d21b279ae9f BOOLEAN;
  p_Description_0d21b279ae9f TEXT;
BEGIN
  p_ID_0d21b279ae9f := '9BDAB69E-6549-4584-9FD6-045180D42E8B';
  p_Name_0d21b279ae9f := 'MJ.BizApps.Sales.Deal.Delete';
  p_IsActive_0d21b279ae9f := TRUE;
  p_UseAuditLog_0d21b279ae9f := TRUE;
  p_Description_0d21b279ae9f := 'Delete any open deal that was never closed, with its unconfirmed order. Parent of MJ.BizApps.Sales.Deal.DeleteOwn, so it implies it.';
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."Authorization"
                 WHERE "ID" = p_ID_0d21b279ae9f
                    OR ("Name" = p_Name_0d21b279ae9f)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAuthorization'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateAuthorization"(p_data := jsonb_build_object(
    'ID', p_ID_0d21b279ae9f,
    'ParentID', p_ParentID_0d21b279ae9f,
    'Name', p_Name_0d21b279ae9f,
    'IsActive', p_IsActive_0d21b279ae9f,
    'UseAuditLog', p_UseAuditLog_0d21b279ae9f,
    'Description', p_Description_0d21b279ae9f
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateAuthorization"(p_ID := p_ID_0d21b279ae9f, p_ParentID := p_ParentID_0d21b279ae9f, p_ParentID_Clear := TRUE, p_Name := p_Name_0d21b279ae9f, p_IsActive := p_IsActive_0d21b279ae9f, p_UseAuditLog := p_UseAuditLog_0d21b279ae9f, p_Description := p_Description_0d21b279ae9f);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Authorizations (core SP call only)
DO $mj$
DECLARE
  p_ID_2ab62a73c7e1 UUID;
  p_ParentID_2ab62a73c7e1 UUID;
  p_Name_2ab62a73c7e1 VARCHAR(100);
  p_IsActive_2ab62a73c7e1 BOOLEAN;
  p_UseAuditLog_2ab62a73c7e1 BOOLEAN;
  p_Description_2ab62a73c7e1 TEXT;
BEGIN
  p_ID_2ab62a73c7e1 := '1449CB31-3384-4FC8-8066-F89C9FB70A40';
  p_ParentID_2ab62a73c7e1 := (
    SELECT
      "ID"
    FROM
      "${mjSchema}"."Authorization"
    WHERE
      LOWER("Name") = LOWER('MJ.BizApps.Sales.Deal.Delete')
  );
  p_Name_2ab62a73c7e1 := 'MJ.BizApps.Sales.Deal.DeleteOwn';
  p_IsActive_2ab62a73c7e1 := TRUE;
  p_UseAuditLog_2ab62a73c7e1 := TRUE;
  p_Description_2ab62a73c7e1 := 'Delete an open, never-closed deal the user owns (Deal.OwnerEmployeeID is the user''s Employee), with its unconfirmed order.';
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."Authorization"
                 WHERE "ID" = p_ID_2ab62a73c7e1
                    OR ("Name" = p_Name_2ab62a73c7e1)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAuthorization'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateAuthorization"(p_data := jsonb_build_object(
    'ID', p_ID_2ab62a73c7e1,
    'ParentID', p_ParentID_2ab62a73c7e1,
    'Name', p_Name_2ab62a73c7e1,
    'IsActive', p_IsActive_2ab62a73c7e1,
    'UseAuditLog', p_UseAuditLog_2ab62a73c7e1,
    'Description', p_Description_2ab62a73c7e1
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateAuthorization"(p_ID := p_ID_2ab62a73c7e1, p_ParentID := p_ParentID_2ab62a73c7e1, p_Name := p_Name_2ab62a73c7e1, p_IsActive := p_IsActive_2ab62a73c7e1, p_UseAuditLog := p_UseAuditLog_2ab62a73c7e1, p_Description := p_Description_2ab62a73c7e1);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Roles (core SP call only)
DO $mj$
DECLARE
  p_ID_70cc91372a4d UUID;
  p_Name_70cc91372a4d VARCHAR(50);
  p_Description_70cc91372a4d TEXT;
  p_DirectoryID_70cc91372a4d VARCHAR(250);
  p_SQLName_70cc91372a4d VARCHAR(250);
BEGIN
  p_ID_70cc91372a4d := 'BC7528F7-73AB-4270-AECE-BD29B3490253';
  p_Name_70cc91372a4d := 'Sales User';
  p_Description_70cc91372a4d := 'Works deals. May delete an open, never-closed deal they own (MJ.BizApps.Sales.Deal.DeleteOwn).';
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."Role"
                 WHERE "ID" = p_ID_70cc91372a4d
                    OR ("Name" = p_Name_70cc91372a4d)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateRole'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateRole"(p_data := jsonb_build_object(
    'ID', p_ID_70cc91372a4d,
    'Name', p_Name_70cc91372a4d,
    'Description', p_Description_70cc91372a4d,
    'DirectoryID', p_DirectoryID_70cc91372a4d,
    'SQLName', p_SQLName_70cc91372a4d
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateRole"(p_ID := p_ID_70cc91372a4d, p_Name := p_Name_70cc91372a4d, p_Description := p_Description_70cc91372a4d, p_DirectoryID := p_DirectoryID_70cc91372a4d, p_DirectoryID_Clear := TRUE, p_SQLName := p_SQLName_70cc91372a4d, p_SQLName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Roles (core SP call only)
DO $mj$
DECLARE
  p_ID_56d701d49846 UUID;
  p_Name_56d701d49846 VARCHAR(50);
  p_Description_56d701d49846 TEXT;
  p_DirectoryID_56d701d49846 VARCHAR(250);
  p_SQLName_56d701d49846 VARCHAR(250);
BEGIN
  p_ID_56d701d49846 := '995DE449-0AA9-4AD2-9B87-CE6295AC3FC4';
  p_Name_56d701d49846 := 'Sales Admin';
  p_Description_56d701d49846 := 'Administers deals. May delete any open, never-closed deal (MJ.BizApps.Sales.Deal.Delete).';
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."Role"
                 WHERE "ID" = p_ID_56d701d49846
                    OR ("Name" = p_Name_56d701d49846)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateRole'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateRole"(p_data := jsonb_build_object(
    'ID', p_ID_56d701d49846,
    'Name', p_Name_56d701d49846,
    'Description', p_Description_56d701d49846,
    'DirectoryID', p_DirectoryID_56d701d49846,
    'SQLName', p_SQLName_56d701d49846
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateRole"(p_ID := p_ID_56d701d49846, p_Name := p_Name_56d701d49846, p_Description := p_Description_56d701d49846, p_DirectoryID := p_DirectoryID_56d701d49846, p_DirectoryID_Clear := TRUE, p_SQLName := p_SQLName_56d701d49846, p_SQLName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Entity Permissions (core SP call only)
DO $mj$
DECLARE
  p_ID_01c6c851eb5b UUID;
  p_EntityID_01c6c851eb5b UUID;
  p_RoleID_01c6c851eb5b UUID;
  p_CanCreate_01c6c851eb5b BOOLEAN;
  p_CanRead_01c6c851eb5b BOOLEAN;
  p_CanUpdate_01c6c851eb5b BOOLEAN;
  p_CanDelete_01c6c851eb5b BOOLEAN;
  p_ReadRLSFilterID_01c6c851eb5b UUID;
  p_CreateRLSFilterID_01c6c851eb5b UUID;
  p_UpdateRLSFilterID_01c6c851eb5b UUID;
  p_DeleteRLSFilterID_01c6c851eb5b UUID;
  p_Type_01c6c851eb5b VARCHAR(10);
BEGIN
  p_ID_01c6c851eb5b := '80F6EDD9-449B-4967-828B-3460CAF2909E';
  p_EntityID_01c6c851eb5b := (
    SELECT
      "ID"
    FROM
      "${mjSchema}"."Entity"
    WHERE
      LOWER("Name") = LOWER('MJ_BizApps_Sales: Deals')
  );
  p_RoleID_01c6c851eb5b := (
    SELECT
      "ID"
    FROM
      "${mjSchema}"."Role"
    WHERE
      LOWER("Name") = LOWER('Sales User')
  );
  p_CanCreate_01c6c851eb5b := FALSE;
  p_CanRead_01c6c851eb5b := TRUE;
  p_CanUpdate_01c6c851eb5b := FALSE;
  p_CanDelete_01c6c851eb5b := TRUE;
  p_Type_01c6c851eb5b := 'Allow';
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."EntityPermission"
                 WHERE "ID" = p_ID_01c6c851eb5b
                    OR ("EntityID" = p_EntityID_01c6c851eb5b AND "RoleID" = p_RoleID_01c6c851eb5b)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateEntityPermission'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateEntityPermission"(p_data := jsonb_build_object(
    'ID', p_ID_01c6c851eb5b,
    'EntityID', p_EntityID_01c6c851eb5b,
    'RoleID', p_RoleID_01c6c851eb5b,
    'CanCreate', p_CanCreate_01c6c851eb5b,
    'CanRead', p_CanRead_01c6c851eb5b,
    'CanUpdate', p_CanUpdate_01c6c851eb5b,
    'CanDelete', p_CanDelete_01c6c851eb5b,
    'ReadRLSFilterID', p_ReadRLSFilterID_01c6c851eb5b,
    'CreateRLSFilterID', p_CreateRLSFilterID_01c6c851eb5b,
    'UpdateRLSFilterID', p_UpdateRLSFilterID_01c6c851eb5b,
    'DeleteRLSFilterID', p_DeleteRLSFilterID_01c6c851eb5b,
    'Type', p_Type_01c6c851eb5b
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateEntityPermission"(p_ID := p_ID_01c6c851eb5b, p_EntityID := p_EntityID_01c6c851eb5b, p_RoleID := p_RoleID_01c6c851eb5b, p_CanCreate := p_CanCreate_01c6c851eb5b, p_CanRead := p_CanRead_01c6c851eb5b, p_CanUpdate := p_CanUpdate_01c6c851eb5b, p_CanDelete := p_CanDelete_01c6c851eb5b, p_ReadRLSFilterID := p_ReadRLSFilterID_01c6c851eb5b, p_ReadRLSFilterID_Clear := TRUE, p_CreateRLSFilterID := p_CreateRLSFilterID_01c6c851eb5b, p_CreateRLSFilterID_Clear := TRUE, p_UpdateRLSFilterID := p_UpdateRLSFilterID_01c6c851eb5b, p_UpdateRLSFilterID_Clear := TRUE, p_DeleteRLSFilterID := p_DeleteRLSFilterID_01c6c851eb5b, p_DeleteRLSFilterID_Clear := TRUE, p_Type := p_Type_01c6c851eb5b);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Entity Permissions (core SP call only)
DO $mj$
DECLARE
  p_ID_00bb2ee27573 UUID;
  p_EntityID_00bb2ee27573 UUID;
  p_RoleID_00bb2ee27573 UUID;
  p_CanCreate_00bb2ee27573 BOOLEAN;
  p_CanRead_00bb2ee27573 BOOLEAN;
  p_CanUpdate_00bb2ee27573 BOOLEAN;
  p_CanDelete_00bb2ee27573 BOOLEAN;
  p_ReadRLSFilterID_00bb2ee27573 UUID;
  p_CreateRLSFilterID_00bb2ee27573 UUID;
  p_UpdateRLSFilterID_00bb2ee27573 UUID;
  p_DeleteRLSFilterID_00bb2ee27573 UUID;
  p_Type_00bb2ee27573 VARCHAR(10);
BEGIN
  p_ID_00bb2ee27573 := '01FE6F87-FFF2-4F7C-B78B-4CF89C43DECE';
  p_EntityID_00bb2ee27573 := (
    SELECT
      "ID"
    FROM
      "${mjSchema}"."Entity"
    WHERE
      LOWER("Name") = LOWER('MJ_BizApps_Sales: Deals')
  );
  p_RoleID_00bb2ee27573 := (
    SELECT
      "ID"
    FROM
      "${mjSchema}"."Role"
    WHERE
      LOWER("Name") = LOWER('Sales Admin')
  );
  p_CanCreate_00bb2ee27573 := FALSE;
  p_CanRead_00bb2ee27573 := TRUE;
  p_CanUpdate_00bb2ee27573 := FALSE;
  p_CanDelete_00bb2ee27573 := TRUE;
  p_Type_00bb2ee27573 := 'Allow';
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."EntityPermission"
                 WHERE "ID" = p_ID_00bb2ee27573
                    OR ("EntityID" = p_EntityID_00bb2ee27573 AND "RoleID" = p_RoleID_00bb2ee27573)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateEntityPermission'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateEntityPermission"(p_data := jsonb_build_object(
    'ID', p_ID_00bb2ee27573,
    'EntityID', p_EntityID_00bb2ee27573,
    'RoleID', p_RoleID_00bb2ee27573,
    'CanCreate', p_CanCreate_00bb2ee27573,
    'CanRead', p_CanRead_00bb2ee27573,
    'CanUpdate', p_CanUpdate_00bb2ee27573,
    'CanDelete', p_CanDelete_00bb2ee27573,
    'ReadRLSFilterID', p_ReadRLSFilterID_00bb2ee27573,
    'CreateRLSFilterID', p_CreateRLSFilterID_00bb2ee27573,
    'UpdateRLSFilterID', p_UpdateRLSFilterID_00bb2ee27573,
    'DeleteRLSFilterID', p_DeleteRLSFilterID_00bb2ee27573,
    'Type', p_Type_00bb2ee27573
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateEntityPermission"(p_ID := p_ID_00bb2ee27573, p_EntityID := p_EntityID_00bb2ee27573, p_RoleID := p_RoleID_00bb2ee27573, p_CanCreate := p_CanCreate_00bb2ee27573, p_CanRead := p_CanRead_00bb2ee27573, p_CanUpdate := p_CanUpdate_00bb2ee27573, p_CanDelete := p_CanDelete_00bb2ee27573, p_ReadRLSFilterID := p_ReadRLSFilterID_00bb2ee27573, p_ReadRLSFilterID_Clear := TRUE, p_CreateRLSFilterID := p_CreateRLSFilterID_00bb2ee27573, p_CreateRLSFilterID_Clear := TRUE, p_UpdateRLSFilterID := p_UpdateRLSFilterID_00bb2ee27573, p_UpdateRLSFilterID_Clear := TRUE, p_DeleteRLSFilterID := p_DeleteRLSFilterID_00bb2ee27573, p_DeleteRLSFilterID_Clear := TRUE, p_Type := p_Type_00bb2ee27573);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Authorization Roles (core SP call only)
DO $mj$
DECLARE
  p_ID_c51d935b029f UUID;
  p_AuthorizationID_c51d935b029f UUID;
  p_RoleID_c51d935b029f UUID;
  p_Type_c51d935b029f CHAR(10);
BEGIN
  p_ID_c51d935b029f := 'A9451D94-6ACD-42A4-9ED7-EDED5CEAD908';
  p_AuthorizationID_c51d935b029f := (
    SELECT
      "ID"
    FROM
      "${mjSchema}"."Authorization"
    WHERE
      LOWER("Name") = LOWER('MJ.BizApps.Sales.Deal.DeleteOwn')
  );
  p_RoleID_c51d935b029f := (
    SELECT
      "ID"
    FROM
      "${mjSchema}"."Role"
    WHERE
      LOWER("Name") = LOWER('Sales User')
  );
  p_Type_c51d935b029f := 'Allow';
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."AuthorizationRole"
                 WHERE "ID" = p_ID_c51d935b029f
                    OR ("AuthorizationID" = p_AuthorizationID_c51d935b029f AND "RoleID" = p_RoleID_c51d935b029f)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAuthorizationRole'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateAuthorizationRole"(p_data := jsonb_build_object(
    'ID', p_ID_c51d935b029f,
    'AuthorizationID', p_AuthorizationID_c51d935b029f,
    'RoleID', p_RoleID_c51d935b029f,
    'Type', p_Type_c51d935b029f
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateAuthorizationRole"(p_ID := p_ID_c51d935b029f, p_AuthorizationID := p_AuthorizationID_c51d935b029f, p_RoleID := p_RoleID_c51d935b029f, p_Type := p_Type_c51d935b029f);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Authorization Roles (core SP call only)
DO $mj$
DECLARE
  p_ID_9fbb92623acc UUID;
  p_AuthorizationID_9fbb92623acc UUID;
  p_RoleID_9fbb92623acc UUID;
  p_Type_9fbb92623acc CHAR(10);
BEGIN
  p_ID_9fbb92623acc := '9B449DB6-0523-4D1C-8895-936B02AA0DDD';
  p_AuthorizationID_9fbb92623acc := (
    SELECT
      "ID"
    FROM
      "${mjSchema}"."Authorization"
    WHERE
      LOWER("Name") = LOWER('MJ.BizApps.Sales.Deal.Delete')
  );
  p_RoleID_9fbb92623acc := (
    SELECT
      "ID"
    FROM
      "${mjSchema}"."Role"
    WHERE
      LOWER("Name") = LOWER('Sales Admin')
  );
  p_Type_9fbb92623acc := 'Allow';
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."AuthorizationRole"
                 WHERE "ID" = p_ID_9fbb92623acc
                    OR ("AuthorizationID" = p_AuthorizationID_9fbb92623acc AND "RoleID" = p_RoleID_9fbb92623acc)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAuthorizationRole'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateAuthorizationRole"(p_data := jsonb_build_object(
    'ID', p_ID_9fbb92623acc,
    'AuthorizationID', p_AuthorizationID_9fbb92623acc,
    'RoleID', p_RoleID_9fbb92623acc,
    'Type', p_Type_9fbb92623acc
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateAuthorizationRole"(p_ID := p_ID_9fbb92623acc, p_AuthorizationID := p_AuthorizationID_9fbb92623acc, p_RoleID := p_RoleID_9fbb92623acc, p_Type := p_Type_9fbb92623acc);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Authorization Roles (core SP call only)
DO $mj$
DECLARE
  p_ID_a4b2a9b006b4 UUID;
  p_AuthorizationID_a4b2a9b006b4 UUID;
  p_RoleID_a4b2a9b006b4 UUID;
  p_Type_a4b2a9b006b4 CHAR(10);
BEGIN
  p_ID_a4b2a9b006b4 := '205AD288-BA07-4F72-81D9-A84821DE5A2A';
  p_AuthorizationID_a4b2a9b006b4 := (
    SELECT
      "ID"
    FROM
      "${mjSchema}"."Authorization"
    WHERE
      LOWER("Name") = LOWER('MJ.BizApps.Sales.Deal.Delete')
  );
  p_RoleID_a4b2a9b006b4 := (
    SELECT
      "ID"
    FROM
      "${mjSchema}"."Role"
    WHERE
      LOWER("Name") = LOWER('Developer')
  );
  p_Type_a4b2a9b006b4 := 'Allow';
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."AuthorizationRole"
                 WHERE "ID" = p_ID_a4b2a9b006b4
                    OR ("AuthorizationID" = p_AuthorizationID_a4b2a9b006b4 AND "RoleID" = p_RoleID_a4b2a9b006b4)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateAuthorizationRole'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateAuthorizationRole"(p_data := jsonb_build_object(
    'ID', p_ID_a4b2a9b006b4,
    'AuthorizationID', p_AuthorizationID_a4b2a9b006b4,
    'RoleID', p_RoleID_a4b2a9b006b4,
    'Type', p_Type_a4b2a9b006b4
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateAuthorizationRole"(p_ID := p_ID_a4b2a9b006b4, p_AuthorizationID := p_AuthorizationID_a4b2a9b006b4, p_RoleID := p_RoleID_a4b2a9b006b4, p_Type := p_Type_a4b2a9b006b4);
    END IF;
  END IF;
END $mj$;
