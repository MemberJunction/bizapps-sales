/*
  Label two Deal fields the way a salesperson would name them.

  bc-aidp-next-golive#207, the "Field labels" table at the end of the replacement copy:

      DealStatusTypeID        Deal Status Type ID    ->  Status
      ForecastCategoryTypeID  Forecast Category Type ->  Forecast Category

  WHY THIS IS A MIGRATION AND NOT A PANEL EDIT. Every other row in #207 is a string in a component,
  and those are done. These two are `EntityField.DisplayName`, which the Explorer reads for the field
  label AND for the column header in every grid that shows the field. Changing them in one panel would
  fix one screen and leave the rest reading "Deal Status Type ID".

  MATCHED ON (EntityID, Name), NEVER ON THE EntityField ID. Those ids are minted by whichever host ran
  CodeGen first, so an id that is correct on this database is correct on no other -- and a guard keyed
  to one matches nothing everywhere else, silently. That is bizapps-orders#126 exactly: two ID-only
  guards skipped, the insert behind them violated a unique index, and the orders migration chain was
  stopped from 15 August until 10 September. The entity is found by schema and base table, which are
  the same on every host.

  A SET, NOT A CodeGen NUDGE, and this is the part worth checking rather than assuming. `Description`
  on an EntityField is a MIRROR -- `spUpdateExistingEntityFieldsFromSchema` overwrites it from the
  column's extended property whenever `AutoUpdateDescription = 1`, which is why the Activity Sync
  description migration had to write the property instead. `DisplayName` is NOT the same:

    * the schema refresh does not touch it at all, and
    * CodeGen's own field-metadata lock (`field-metadata-lock.ts`) only proposes a DisplayName when
      `isNewEntity || isNewField || descriptionReopened`. For a field that already exists it records
      `skipped: locked` and leaves the stored value alone.

  So a direct UPDATE holds. It was checked in that order -- read the rule, then write the migration --
  because the same assumption in the other direction was wrong once already.

  AutoUpdateDisplayName GOES TO 0 ANYWAY. The lock above already protects an existing field, so this
  is belt and braces rather than load-bearing. It is set because the label is now a DELIBERATE choice
  rather than something derived from the column name: if the column is ever renamed, "Status" should
  stay "Status" rather than quietly becoming whatever the new name derives to.

  GUARDED ON THE CURRENT LABEL, so someone who has already renamed these by hand keeps their version,
  and a re-run finds the new label in place and does nothing.

  Metadata only. No table is created or altered, and no column changes.
*/

DECLARE @DealEntityID UNIQUEIDENTIFIER = (
    SELECT ID FROM [${mjSchema}].[Entity]
    WHERE BaseTable = 'Deal' AND SchemaName = '${flyway:defaultSchema}'
);

IF @DealEntityID IS NULL
BEGIN
    -- Not an error: a database without the Deal entity has no labels to correct.
    PRINT 'Deal entity not present in this database - nothing to relabel.';
END
ELSE
BEGIN
    UPDATE [${mjSchema}].[EntityField]
    SET [DisplayName] = N'Status',
        [AutoUpdateDisplayName] = 0,
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE [EntityID] = @DealEntityID
      AND [Name] = 'DealStatusTypeID'
      AND [DisplayName] <> N'Status';

    UPDATE [${mjSchema}].[EntityField]
    SET [DisplayName] = N'Forecast Category',
        [AutoUpdateDisplayName] = 0,
        [__mj_UpdatedAt] = GETUTCDATE()
    WHERE [EntityID] = @DealEntityID
      AND [Name] = 'ForecastCategoryTypeID'
      AND [DisplayName] <> N'Forecast Category';

    /*
      Prove it landed, rather than trusting two guarded updates to have matched.

      Scoped to the branch where the entity EXISTS, so a database without Deal is not failed for
      lacking something it was never going to have. Where the entity is present, both fields are
      present too -- they are columns on the table -- so finding fewer than two means the guard
      matched nothing and the labels are still wrong while the deployment believes otherwise.
    */
    DECLARE @Renamed INT = (
        SELECT COUNT(*)
        FROM [${mjSchema}].[EntityField]
        WHERE [EntityID] = @DealEntityID
          AND (
                ([Name] = 'DealStatusTypeID' AND [DisplayName] = N'Status')
             OR ([Name] = 'ForecastCategoryTypeID' AND [DisplayName] = N'Forecast Category')
          )
    );

    IF @Renamed < 2
    BEGIN
        DECLARE @Msg NVARCHAR(400) = CONCAT(
            'Expected the two Deal field labels to read Status and Forecast Category, found ',
            @Renamed, '. The update matched nothing on this database.'
        );
        THROW 51000, @Msg, 1;
    END
END
GO
