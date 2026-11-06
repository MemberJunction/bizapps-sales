-- ============================================================================
-- PostgreSQL only: no T-SQL counterpart. Restores the four CodeGen functions that
-- V202610151200__v6.15.x__SalesAccount_Default_Contacts.pg.sql drops and does not recreate.
--
-- Why they are lost. That file rebuilds vwSalesAccounts; its column list changes, so the rebuild
-- falls back to DROP VIEW ... CASCADE and then restores the dependent views (vwDealsGenerated,
-- vwDeals). On PostgreSQL a function returning a view's rows depends on that view, so the
-- CASCADE also drops spCreateSalesAccount, spUpdateSalesAccount, spCreateDeal and spUpdateDeal,
-- and nothing puts them back until someone runs `mj codegen`. SQL Server has no such dependency,
-- which is why the T-SQL side needs no counterpart of this file.
--
-- Why a new file rather than a fix to that one: it has shipped, and the installer checksums
-- every applied file, so it is left byte-identical and the repair goes in a later version.
--
-- Why this version: it sorts directly after V202610151200, so the functions are back before any
-- later file runs. It is not out of order anywhere: until V202610131845's PostgreSQL file was
-- corrected, every PostgreSQL install stopped there, so no host has applied V202610151200 or
-- anything after it.
--
-- The body is native PostgreSQL CodeGen (MJ 6.1.5) for the four functions, with their grants and
-- the __mj_UpdatedAt triggers CodeGen emits alongside the update functions, captured against a
-- database built from this directory up to V202610151200. Re-running `mj codegen` regenerates the
-- same text.
-- ============================================================================

SET search_path TO __mj_bizappssales, public;
SET standard_conforming_strings = on;

-- ===================== CodeGen (native PG, baked) =====================

-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deals
-- Item: spCreateDeal
-- ============================================================

------------------------------------------------------------
----- CREATE FUNCTION FOR Deal
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spCreateDeal'
               AND pronamespace = '__mj_bizappssales'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_bizappssales"."spCreateDeal"(
    p_id UUID DEFAULT NULL,
    p_dealnumber_clear boolean DEFAULT false,
    p_dealnumber varchar(50) DEFAULT NULL,
    p_name varchar(500) DEFAULT NULL,
    p_pipelineid UUID DEFAULT NULL,
    p_pipelinestageid_clear boolean DEFAULT false,
    p_pipelinestageid UUID DEFAULT NULL,
    p_dealtypeid_clear boolean DEFAULT false,
    p_dealtypeid UUID DEFAULT NULL,
    p_dealstatustypeid_clear boolean DEFAULT false,
    p_dealstatustypeid UUID DEFAULT NULL,
    p_accountid_clear boolean DEFAULT false,
    p_accountid UUID DEFAULT NULL,
    p_primarycontactid_clear boolean DEFAULT false,
    p_primarycontactid UUID DEFAULT NULL,
    p_billingcontactid_clear boolean DEFAULT false,
    p_billingcontactid UUID DEFAULT NULL,
    p_companyid UUID DEFAULT NULL,
    p_owneremployeeid_clear boolean DEFAULT false,
    p_owneremployeeid UUID DEFAULT NULL,
    p_amount_clear boolean DEFAULT false,
    p_amount decimal(19, 4) DEFAULT NULL,
    p_amountiscomputed BOOLEAN DEFAULT NULL,
    p_amountcomputedat_clear boolean DEFAULT false,
    p_amountcomputedat TIMESTAMPTZ DEFAULT NULL,
    p_amountsourcehash_clear boolean DEFAULT false,
    p_amountsourcehash varchar(128) DEFAULT NULL,
    p_currencyid_clear boolean DEFAULT false,
    p_currencyid UUID DEFAULT NULL,
    p_mrr_clear boolean DEFAULT false,
    p_mrr decimal(19, 4) DEFAULT NULL,
    p_arr_clear boolean DEFAULT false,
    p_arr decimal(19, 4) DEFAULT NULL,
    p_termmonths_clear boolean DEFAULT false,
    p_termmonths int DEFAULT NULL,
    p_estimatedprojectweeks_clear boolean DEFAULT false,
    p_estimatedprojectweeks int DEFAULT NULL,
    p_executiondate_clear boolean DEFAULT false,
    p_executiondate date DEFAULT NULL,
    p_startdate_clear boolean DEFAULT false,
    p_startdate date DEFAULT NULL,
    p_expectedclosedate_clear boolean DEFAULT false,
    p_expectedclosedate date DEFAULT NULL,
    p_actualclosedate_clear boolean DEFAULT false,
    p_actualclosedate date DEFAULT NULL,
    p_probability_clear boolean DEFAULT false,
    p_probability decimal(5, 2) DEFAULT NULL,
    p_forecastcategorytypeid_clear boolean DEFAULT false,
    p_forecastcategorytypeid UUID DEFAULT NULL,
    p_lossreasonid_clear boolean DEFAULT false,
    p_lossreasonid UUID DEFAULT NULL,
    p_lossnotes_clear boolean DEFAULT false,
    p_lossnotes TEXT DEFAULT NULL,
    p_leadsourcetypeid_clear boolean DEFAULT false,
    p_leadsourcetypeid UUID DEFAULT NULL,
    p_campaignid_clear boolean DEFAULT false,
    p_campaignid UUID DEFAULT NULL,
    p_contractid_clear boolean DEFAULT false,
    p_contractid UUID DEFAULT NULL,
    p_renewscontractid_clear boolean DEFAULT false,
    p_renewscontractid UUID DEFAULT NULL,
    p_autorenew BOOLEAN DEFAULT NULL,
    p_annualincreasepctoverride_clear boolean DEFAULT false,
    p_annualincreasepctoverride decimal(5, 2) DEFAULT NULL,
    p_cancellationnoticedaysoverride_clear boolean DEFAULT false,
    p_cancellationnoticedaysoverride int DEFAULT NULL,
    p_paymentmethod_clear boolean DEFAULT false,
    p_paymentmethod varchar(50) DEFAULT NULL,
    p_standardagreementmodified BOOLEAN DEFAULT NULL,
    p_contractvariances_clear boolean DEFAULT false,
    p_contractvariances TEXT DEFAULT NULL,
    p_description_clear boolean DEFAULT false,
    p_description TEXT DEFAULT NULL,
    p_nextstep_clear boolean DEFAULT false,
    p_nextstep varchar(1000) DEFAULT NULL,
    p_nextstepdate_clear boolean DEFAULT false,
    p_nextstepdate date DEFAULT NULL,
    p_closedat_clear boolean DEFAULT false,
    p_closedat TIMESTAMPTZ DEFAULT NULL,
    p_closedbyuserid_clear boolean DEFAULT false,
    p_closedbyuserid UUID DEFAULT NULL,
    p_orderid_clear boolean DEFAULT false,
    p_orderid UUID DEFAULT NULL,
    p_predictedwinprobability_clear boolean DEFAULT false,
    p_predictedwinprobability decimal(5, 4) DEFAULT NULL,
    p_predictedwinriskband_clear boolean DEFAULT false,
    p_predictedwinriskband varchar(20) DEFAULT NULL,
    p_predictedwinscoredat_clear boolean DEFAULT false,
    p_predictedwinscoredat TIMESTAMPTZ DEFAULT NULL
) RETURNS SETOF "__mj_bizappssales"."vwDeals" AS $$
DECLARE
    v_new_id UUID;
BEGIN
    v_new_id := COALESCE(p_id, gen_random_uuid());
    INSERT INTO "__mj_bizappssales"."Deal"
        (
            "ID",
            "DealNumber",
                "Name",
                "PipelineID",
                "PipelineStageID",
                "DealTypeID",
                "DealStatusTypeID",
                "AccountID",
                "PrimaryContactID",
                "BillingContactID",
                "CompanyID",
                "OwnerEmployeeID",
                "Amount",
                "AmountIsComputed",
                "AmountComputedAt",
                "AmountSourceHash",
                "CurrencyID",
                "MRR",
                "ARR",
                "TermMonths",
                "EstimatedProjectWeeks",
                "ExecutionDate",
                "StartDate",
                "ExpectedCloseDate",
                "ActualCloseDate",
                "Probability",
                "ForecastCategoryTypeID",
                "LossReasonID",
                "LossNotes",
                "LeadSourceTypeID",
                "CampaignID",
                "ContractID",
                "RenewsContractID",
                "AutoRenew",
                "AnnualIncreasePctOverride",
                "CancellationNoticeDaysOverride",
                "PaymentMethod",
                "StandardAgreementModified",
                "ContractVariances",
                "Description",
                "NextStep",
                "NextStepDate",
                "ClosedAt",
                "ClosedByUserID",
                "OrderID",
                "PredictedWinProbability",
                "PredictedWinRiskBand",
                "PredictedWinScoredAt"
        )
    VALUES
        (
            v_new_id,
            CASE WHEN p_dealnumber_clear = true THEN NULL ELSE COALESCE(p_dealnumber, NULL) END,
                p_name,
                p_pipelineid,
                CASE WHEN p_pipelinestageid_clear = true THEN NULL ELSE COALESCE(p_pipelinestageid, NULL) END,
                CASE WHEN p_dealtypeid_clear = true THEN NULL ELSE COALESCE(p_dealtypeid, NULL) END,
                CASE WHEN p_dealstatustypeid_clear = true THEN NULL ELSE COALESCE(p_dealstatustypeid, NULL) END,
                CASE WHEN p_accountid_clear = true THEN NULL ELSE COALESCE(p_accountid, NULL) END,
                CASE WHEN p_primarycontactid_clear = true THEN NULL ELSE COALESCE(p_primarycontactid, NULL) END,
                CASE WHEN p_billingcontactid_clear = true THEN NULL ELSE COALESCE(p_billingcontactid, NULL) END,
                p_companyid,
                CASE WHEN p_owneremployeeid_clear = true THEN NULL ELSE COALESCE(p_owneremployeeid, NULL) END,
                CASE WHEN p_amount_clear = true THEN NULL ELSE COALESCE(p_amount, NULL) END,
                COALESCE(p_amountiscomputed, FALSE),
                CASE WHEN p_amountcomputedat_clear = true THEN NULL ELSE COALESCE(p_amountcomputedat, NULL) END,
                CASE WHEN p_amountsourcehash_clear = true THEN NULL ELSE COALESCE(p_amountsourcehash, NULL) END,
                CASE WHEN p_currencyid_clear = true THEN NULL ELSE COALESCE(p_currencyid, NULL) END,
                CASE WHEN p_mrr_clear = true THEN NULL ELSE COALESCE(p_mrr, NULL) END,
                CASE WHEN p_arr_clear = true THEN NULL ELSE COALESCE(p_arr, NULL) END,
                CASE WHEN p_termmonths_clear = true THEN NULL ELSE COALESCE(p_termmonths, NULL) END,
                CASE WHEN p_estimatedprojectweeks_clear = true THEN NULL ELSE COALESCE(p_estimatedprojectweeks, NULL) END,
                CASE WHEN p_executiondate_clear = true THEN NULL ELSE COALESCE(p_executiondate, NULL) END,
                CASE WHEN p_startdate_clear = true THEN NULL ELSE COALESCE(p_startdate, NULL) END,
                CASE WHEN p_expectedclosedate_clear = true THEN NULL ELSE COALESCE(p_expectedclosedate, NULL) END,
                CASE WHEN p_actualclosedate_clear = true THEN NULL ELSE COALESCE(p_actualclosedate, NULL) END,
                CASE WHEN p_probability_clear = true THEN NULL ELSE COALESCE(p_probability, NULL) END,
                CASE WHEN p_forecastcategorytypeid_clear = true THEN NULL ELSE COALESCE(p_forecastcategorytypeid, NULL) END,
                CASE WHEN p_lossreasonid_clear = true THEN NULL ELSE COALESCE(p_lossreasonid, NULL) END,
                CASE WHEN p_lossnotes_clear = true THEN NULL ELSE COALESCE(p_lossnotes, NULL) END,
                CASE WHEN p_leadsourcetypeid_clear = true THEN NULL ELSE COALESCE(p_leadsourcetypeid, NULL) END,
                CASE WHEN p_campaignid_clear = true THEN NULL ELSE COALESCE(p_campaignid, NULL) END,
                CASE WHEN p_contractid_clear = true THEN NULL ELSE COALESCE(p_contractid, NULL) END,
                CASE WHEN p_renewscontractid_clear = true THEN NULL ELSE COALESCE(p_renewscontractid, NULL) END,
                COALESCE(p_autorenew, FALSE),
                CASE WHEN p_annualincreasepctoverride_clear = true THEN NULL ELSE COALESCE(p_annualincreasepctoverride, NULL) END,
                CASE WHEN p_cancellationnoticedaysoverride_clear = true THEN NULL ELSE COALESCE(p_cancellationnoticedaysoverride, NULL) END,
                CASE WHEN p_paymentmethod_clear = true THEN NULL ELSE COALESCE(p_paymentmethod, 'ACH') END,
                COALESCE(p_standardagreementmodified, FALSE),
                CASE WHEN p_contractvariances_clear = true THEN NULL ELSE COALESCE(p_contractvariances, NULL) END,
                CASE WHEN p_description_clear = true THEN NULL ELSE COALESCE(p_description, NULL) END,
                CASE WHEN p_nextstep_clear = true THEN NULL ELSE COALESCE(p_nextstep, NULL) END,
                CASE WHEN p_nextstepdate_clear = true THEN NULL ELSE COALESCE(p_nextstepdate, NULL) END,
                CASE WHEN p_closedat_clear = true THEN NULL ELSE COALESCE(p_closedat, NULL) END,
                CASE WHEN p_closedbyuserid_clear = true THEN NULL ELSE COALESCE(p_closedbyuserid, NULL) END,
                CASE WHEN p_orderid_clear = true THEN NULL ELSE COALESCE(p_orderid, NULL) END,
                CASE WHEN p_predictedwinprobability_clear = true THEN NULL ELSE COALESCE(p_predictedwinprobability, NULL) END,
                CASE WHEN p_predictedwinriskband_clear = true THEN NULL ELSE COALESCE(p_predictedwinriskband, NULL) END,
                CASE WHEN p_predictedwinscoredat_clear = true THEN NULL ELSE COALESCE(p_predictedwinscoredat, NULL) END
        )
    ;

    RETURN QUERY
    SELECT * FROM "__mj_bizappssales"."vwDeals"
    WHERE "ID" = v_new_id;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spCreateDeal" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spCreateDeal" TO "cdp_Integration";


-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deals
-- Item: spUpdateDeal
-- ============================================================

------------------------------------------------------------
----- UPDATE FUNCTION FOR Deal
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spUpdateDeal'
               AND pronamespace = '__mj_bizappssales'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_bizappssales"."spUpdateDeal"(
    p_id UUID,
    p_dealnumber_clear boolean DEFAULT false,
    p_dealnumber varchar(50) DEFAULT NULL,
    p_name varchar(500) DEFAULT NULL,
    p_pipelineid UUID DEFAULT NULL,
    p_pipelinestageid_clear boolean DEFAULT false,
    p_pipelinestageid UUID DEFAULT NULL,
    p_dealtypeid_clear boolean DEFAULT false,
    p_dealtypeid UUID DEFAULT NULL,
    p_dealstatustypeid_clear boolean DEFAULT false,
    p_dealstatustypeid UUID DEFAULT NULL,
    p_accountid_clear boolean DEFAULT false,
    p_accountid UUID DEFAULT NULL,
    p_primarycontactid_clear boolean DEFAULT false,
    p_primarycontactid UUID DEFAULT NULL,
    p_billingcontactid_clear boolean DEFAULT false,
    p_billingcontactid UUID DEFAULT NULL,
    p_companyid UUID DEFAULT NULL,
    p_owneremployeeid_clear boolean DEFAULT false,
    p_owneremployeeid UUID DEFAULT NULL,
    p_amount_clear boolean DEFAULT false,
    p_amount decimal(19, 4) DEFAULT NULL,
    p_amountiscomputed BOOLEAN DEFAULT NULL,
    p_amountcomputedat_clear boolean DEFAULT false,
    p_amountcomputedat TIMESTAMPTZ DEFAULT NULL,
    p_amountsourcehash_clear boolean DEFAULT false,
    p_amountsourcehash varchar(128) DEFAULT NULL,
    p_currencyid_clear boolean DEFAULT false,
    p_currencyid UUID DEFAULT NULL,
    p_mrr_clear boolean DEFAULT false,
    p_mrr decimal(19, 4) DEFAULT NULL,
    p_arr_clear boolean DEFAULT false,
    p_arr decimal(19, 4) DEFAULT NULL,
    p_termmonths_clear boolean DEFAULT false,
    p_termmonths int DEFAULT NULL,
    p_estimatedprojectweeks_clear boolean DEFAULT false,
    p_estimatedprojectweeks int DEFAULT NULL,
    p_executiondate_clear boolean DEFAULT false,
    p_executiondate date DEFAULT NULL,
    p_startdate_clear boolean DEFAULT false,
    p_startdate date DEFAULT NULL,
    p_expectedclosedate_clear boolean DEFAULT false,
    p_expectedclosedate date DEFAULT NULL,
    p_actualclosedate_clear boolean DEFAULT false,
    p_actualclosedate date DEFAULT NULL,
    p_probability_clear boolean DEFAULT false,
    p_probability decimal(5, 2) DEFAULT NULL,
    p_forecastcategorytypeid_clear boolean DEFAULT false,
    p_forecastcategorytypeid UUID DEFAULT NULL,
    p_lossreasonid_clear boolean DEFAULT false,
    p_lossreasonid UUID DEFAULT NULL,
    p_lossnotes_clear boolean DEFAULT false,
    p_lossnotes TEXT DEFAULT NULL,
    p_leadsourcetypeid_clear boolean DEFAULT false,
    p_leadsourcetypeid UUID DEFAULT NULL,
    p_campaignid_clear boolean DEFAULT false,
    p_campaignid UUID DEFAULT NULL,
    p_contractid_clear boolean DEFAULT false,
    p_contractid UUID DEFAULT NULL,
    p_renewscontractid_clear boolean DEFAULT false,
    p_renewscontractid UUID DEFAULT NULL,
    p_autorenew BOOLEAN DEFAULT NULL,
    p_annualincreasepctoverride_clear boolean DEFAULT false,
    p_annualincreasepctoverride decimal(5, 2) DEFAULT NULL,
    p_cancellationnoticedaysoverride_clear boolean DEFAULT false,
    p_cancellationnoticedaysoverride int DEFAULT NULL,
    p_paymentmethod_clear boolean DEFAULT false,
    p_paymentmethod varchar(50) DEFAULT NULL,
    p_standardagreementmodified BOOLEAN DEFAULT NULL,
    p_contractvariances_clear boolean DEFAULT false,
    p_contractvariances TEXT DEFAULT NULL,
    p_description_clear boolean DEFAULT false,
    p_description TEXT DEFAULT NULL,
    p_nextstep_clear boolean DEFAULT false,
    p_nextstep varchar(1000) DEFAULT NULL,
    p_nextstepdate_clear boolean DEFAULT false,
    p_nextstepdate date DEFAULT NULL,
    p_closedat_clear boolean DEFAULT false,
    p_closedat TIMESTAMPTZ DEFAULT NULL,
    p_closedbyuserid_clear boolean DEFAULT false,
    p_closedbyuserid UUID DEFAULT NULL,
    p_orderid_clear boolean DEFAULT false,
    p_orderid UUID DEFAULT NULL,
    p_predictedwinprobability_clear boolean DEFAULT false,
    p_predictedwinprobability decimal(5, 4) DEFAULT NULL,
    p_predictedwinriskband_clear boolean DEFAULT false,
    p_predictedwinriskband varchar(20) DEFAULT NULL,
    p_predictedwinscoredat_clear boolean DEFAULT false,
    p_predictedwinscoredat TIMESTAMPTZ DEFAULT NULL
) RETURNS SETOF "__mj_bizappssales"."vwDeals" AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE "__mj_bizappssales"."Deal"
    SET
        "DealNumber" = CASE WHEN p_dealnumber_clear = true THEN NULL ELSE COALESCE(p_dealnumber, "DealNumber") END,
        "Name" = COALESCE(p_name, "Name"),
        "PipelineID" = COALESCE(p_pipelineid, "PipelineID"),
        "PipelineStageID" = CASE WHEN p_pipelinestageid_clear = true THEN NULL ELSE COALESCE(p_pipelinestageid, "PipelineStageID") END,
        "DealTypeID" = CASE WHEN p_dealtypeid_clear = true THEN NULL ELSE COALESCE(p_dealtypeid, "DealTypeID") END,
        "DealStatusTypeID" = CASE WHEN p_dealstatustypeid_clear = true THEN NULL ELSE COALESCE(p_dealstatustypeid, "DealStatusTypeID") END,
        "AccountID" = CASE WHEN p_accountid_clear = true THEN NULL ELSE COALESCE(p_accountid, "AccountID") END,
        "PrimaryContactID" = CASE WHEN p_primarycontactid_clear = true THEN NULL ELSE COALESCE(p_primarycontactid, "PrimaryContactID") END,
        "BillingContactID" = CASE WHEN p_billingcontactid_clear = true THEN NULL ELSE COALESCE(p_billingcontactid, "BillingContactID") END,
        "CompanyID" = COALESCE(p_companyid, "CompanyID"),
        "OwnerEmployeeID" = CASE WHEN p_owneremployeeid_clear = true THEN NULL ELSE COALESCE(p_owneremployeeid, "OwnerEmployeeID") END,
        "Amount" = CASE WHEN p_amount_clear = true THEN NULL ELSE COALESCE(p_amount, "Amount") END,
        "AmountIsComputed" = COALESCE(p_amountiscomputed, "AmountIsComputed"),
        "AmountComputedAt" = CASE WHEN p_amountcomputedat_clear = true THEN NULL ELSE COALESCE(p_amountcomputedat, "AmountComputedAt") END,
        "AmountSourceHash" = CASE WHEN p_amountsourcehash_clear = true THEN NULL ELSE COALESCE(p_amountsourcehash, "AmountSourceHash") END,
        "CurrencyID" = CASE WHEN p_currencyid_clear = true THEN NULL ELSE COALESCE(p_currencyid, "CurrencyID") END,
        "MRR" = CASE WHEN p_mrr_clear = true THEN NULL ELSE COALESCE(p_mrr, "MRR") END,
        "ARR" = CASE WHEN p_arr_clear = true THEN NULL ELSE COALESCE(p_arr, "ARR") END,
        "TermMonths" = CASE WHEN p_termmonths_clear = true THEN NULL ELSE COALESCE(p_termmonths, "TermMonths") END,
        "EstimatedProjectWeeks" = CASE WHEN p_estimatedprojectweeks_clear = true THEN NULL ELSE COALESCE(p_estimatedprojectweeks, "EstimatedProjectWeeks") END,
        "ExecutionDate" = CASE WHEN p_executiondate_clear = true THEN NULL ELSE COALESCE(p_executiondate, "ExecutionDate") END,
        "StartDate" = CASE WHEN p_startdate_clear = true THEN NULL ELSE COALESCE(p_startdate, "StartDate") END,
        "ExpectedCloseDate" = CASE WHEN p_expectedclosedate_clear = true THEN NULL ELSE COALESCE(p_expectedclosedate, "ExpectedCloseDate") END,
        "ActualCloseDate" = CASE WHEN p_actualclosedate_clear = true THEN NULL ELSE COALESCE(p_actualclosedate, "ActualCloseDate") END,
        "Probability" = CASE WHEN p_probability_clear = true THEN NULL ELSE COALESCE(p_probability, "Probability") END,
        "ForecastCategoryTypeID" = CASE WHEN p_forecastcategorytypeid_clear = true THEN NULL ELSE COALESCE(p_forecastcategorytypeid, "ForecastCategoryTypeID") END,
        "LossReasonID" = CASE WHEN p_lossreasonid_clear = true THEN NULL ELSE COALESCE(p_lossreasonid, "LossReasonID") END,
        "LossNotes" = CASE WHEN p_lossnotes_clear = true THEN NULL ELSE COALESCE(p_lossnotes, "LossNotes") END,
        "LeadSourceTypeID" = CASE WHEN p_leadsourcetypeid_clear = true THEN NULL ELSE COALESCE(p_leadsourcetypeid, "LeadSourceTypeID") END,
        "CampaignID" = CASE WHEN p_campaignid_clear = true THEN NULL ELSE COALESCE(p_campaignid, "CampaignID") END,
        "ContractID" = CASE WHEN p_contractid_clear = true THEN NULL ELSE COALESCE(p_contractid, "ContractID") END,
        "RenewsContractID" = CASE WHEN p_renewscontractid_clear = true THEN NULL ELSE COALESCE(p_renewscontractid, "RenewsContractID") END,
        "AutoRenew" = COALESCE(p_autorenew, "AutoRenew"),
        "AnnualIncreasePctOverride" = CASE WHEN p_annualincreasepctoverride_clear = true THEN NULL ELSE COALESCE(p_annualincreasepctoverride, "AnnualIncreasePctOverride") END,
        "CancellationNoticeDaysOverride" = CASE WHEN p_cancellationnoticedaysoverride_clear = true THEN NULL ELSE COALESCE(p_cancellationnoticedaysoverride, "CancellationNoticeDaysOverride") END,
        "PaymentMethod" = CASE WHEN p_paymentmethod_clear = true THEN NULL ELSE COALESCE(p_paymentmethod, "PaymentMethod") END,
        "StandardAgreementModified" = COALESCE(p_standardagreementmodified, "StandardAgreementModified"),
        "ContractVariances" = CASE WHEN p_contractvariances_clear = true THEN NULL ELSE COALESCE(p_contractvariances, "ContractVariances") END,
        "Description" = CASE WHEN p_description_clear = true THEN NULL ELSE COALESCE(p_description, "Description") END,
        "NextStep" = CASE WHEN p_nextstep_clear = true THEN NULL ELSE COALESCE(p_nextstep, "NextStep") END,
        "NextStepDate" = CASE WHEN p_nextstepdate_clear = true THEN NULL ELSE COALESCE(p_nextstepdate, "NextStepDate") END,
        "ClosedAt" = CASE WHEN p_closedat_clear = true THEN NULL ELSE COALESCE(p_closedat, "ClosedAt") END,
        "ClosedByUserID" = CASE WHEN p_closedbyuserid_clear = true THEN NULL ELSE COALESCE(p_closedbyuserid, "ClosedByUserID") END,
        "OrderID" = CASE WHEN p_orderid_clear = true THEN NULL ELSE COALESCE(p_orderid, "OrderID") END,
        "PredictedWinProbability" = CASE WHEN p_predictedwinprobability_clear = true THEN NULL ELSE COALESCE(p_predictedwinprobability, "PredictedWinProbability") END,
        "PredictedWinRiskBand" = CASE WHEN p_predictedwinriskband_clear = true THEN NULL ELSE COALESCE(p_predictedwinriskband, "PredictedWinRiskBand") END,
        "PredictedWinScoredAt" = CASE WHEN p_predictedwinscoredat_clear = true THEN NULL ELSE COALESCE(p_predictedwinscoredat, "PredictedWinScoredAt") END
    WHERE
        "ID" = p_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count = 0 THEN
        -- Nothing was updated, return empty result set
        RETURN;
    END IF;

    -- Return the updated record from the base view
    RETURN QUERY
    SELECT * FROM "__mj_bizappssales"."vwDeals"
    WHERE "ID" = p_id;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spUpdateDeal" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spUpdateDeal" TO "cdp_Integration";


------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the Deal table
------------------------------------------------------------
CREATE OR REPLACE FUNCTION "__mj_bizappssales"."fn_trg_update_deal"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."__mj_UpdatedAt" := NOW() AT TIME ZONE 'UTC';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_update_deal" ON "__mj_bizappssales"."Deal";

CREATE TRIGGER "trg_update_deal"
BEFORE UPDATE ON "__mj_bizappssales"."Deal"
FOR EACH ROW
EXECUTE FUNCTION "__mj_bizappssales"."fn_trg_update_deal"();


-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Sales Accounts
-- Item: spCreateSalesAccount
-- ============================================================

------------------------------------------------------------
----- CREATE FUNCTION FOR SalesAccount
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spCreateSalesAccount'
               AND pronamespace = '__mj_bizappssales'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_bizappssales"."spCreateSalesAccount"(
    p_id UUID DEFAULT NULL,
    p_owneremployeeid_clear boolean DEFAULT false,
    p_owneremployeeid UUID DEFAULT NULL,
    p_accounttypeid_clear boolean DEFAULT false,
    p_accounttypeid UUID DEFAULT NULL,
    p_lifecyclestagetypeid_clear boolean DEFAULT false,
    p_lifecyclestagetypeid UUID DEFAULT NULL,
    p_leadsourcetypeid_clear boolean DEFAULT false,
    p_leadsourcetypeid UUID DEFAULT NULL,
    p_territory_clear boolean DEFAULT false,
    p_territory varchar(100) DEFAULT NULL,
    p_tier_clear boolean DEFAULT false,
    p_tier varchar(50) DEFAULT NULL,
    p_icpfitscore_clear boolean DEFAULT false,
    p_icpfitscore int DEFAULT NULL,
    p_industrycode_clear boolean DEFAULT false,
    p_industrycode varchar(50) DEFAULT NULL,
    p_employeecountband_clear boolean DEFAULT false,
    p_employeecountband varchar(50) DEFAULT NULL,
    p_annualrevenueband_clear boolean DEFAULT false,
    p_annualrevenueband varchar(50) DEFAULT NULL,
    p_healthstatus_clear boolean DEFAULT false,
    p_healthstatus varchar(50) DEFAULT NULL,
    p_firstclosedwondate_clear boolean DEFAULT false,
    p_firstclosedwondate date DEFAULT NULL,
    p_isactive BOOLEAN DEFAULT NULL,
    p_defaultprimarycontactid_clear boolean DEFAULT false,
    p_defaultprimarycontactid UUID DEFAULT NULL,
    p_defaultbillingcontactid_clear boolean DEFAULT false,
    p_defaultbillingcontactid UUID DEFAULT NULL
) RETURNS SETOF "__mj_bizappssales"."vwSalesAccounts" AS $$
DECLARE
    v_new_id UUID;
BEGIN
    v_new_id := COALESCE(p_id, gen_random_uuid());
    INSERT INTO "__mj_bizappssales"."SalesAccount"
        (
            "ID",
            "OwnerEmployeeID",
                "AccountTypeID",
                "LifecycleStageTypeID",
                "LeadSourceTypeID",
                "Territory",
                "Tier",
                "ICPFitScore",
                "IndustryCode",
                "EmployeeCountBand",
                "AnnualRevenueBand",
                "HealthStatus",
                "FirstClosedWonDate",
                "IsActive",
                "DefaultPrimaryContactID",
                "DefaultBillingContactID"
        )
    VALUES
        (
            v_new_id,
            CASE WHEN p_owneremployeeid_clear = true THEN NULL ELSE COALESCE(p_owneremployeeid, NULL) END,
                CASE WHEN p_accounttypeid_clear = true THEN NULL ELSE COALESCE(p_accounttypeid, NULL) END,
                CASE WHEN p_lifecyclestagetypeid_clear = true THEN NULL ELSE COALESCE(p_lifecyclestagetypeid, NULL) END,
                CASE WHEN p_leadsourcetypeid_clear = true THEN NULL ELSE COALESCE(p_leadsourcetypeid, NULL) END,
                CASE WHEN p_territory_clear = true THEN NULL ELSE COALESCE(p_territory, NULL) END,
                CASE WHEN p_tier_clear = true THEN NULL ELSE COALESCE(p_tier, NULL) END,
                CASE WHEN p_icpfitscore_clear = true THEN NULL ELSE COALESCE(p_icpfitscore, NULL) END,
                CASE WHEN p_industrycode_clear = true THEN NULL ELSE COALESCE(p_industrycode, NULL) END,
                CASE WHEN p_employeecountband_clear = true THEN NULL ELSE COALESCE(p_employeecountband, NULL) END,
                CASE WHEN p_annualrevenueband_clear = true THEN NULL ELSE COALESCE(p_annualrevenueband, NULL) END,
                CASE WHEN p_healthstatus_clear = true THEN NULL ELSE COALESCE(p_healthstatus, NULL) END,
                CASE WHEN p_firstclosedwondate_clear = true THEN NULL ELSE COALESCE(p_firstclosedwondate, NULL) END,
                COALESCE(p_isactive, TRUE),
                CASE WHEN p_defaultprimarycontactid_clear = true THEN NULL ELSE COALESCE(p_defaultprimarycontactid, NULL) END,
                CASE WHEN p_defaultbillingcontactid_clear = true THEN NULL ELSE COALESCE(p_defaultbillingcontactid, NULL) END
        )
    ;

    RETURN QUERY
    SELECT * FROM "__mj_bizappssales"."vwSalesAccounts"
    WHERE "ID" = v_new_id;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spCreateSalesAccount" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spCreateSalesAccount" TO "cdp_Integration";


-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Sales Accounts
-- Item: spUpdateSalesAccount
-- ============================================================

------------------------------------------------------------
----- UPDATE FUNCTION FOR SalesAccount
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spUpdateSalesAccount'
               AND pronamespace = '__mj_bizappssales'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_bizappssales"."spUpdateSalesAccount"(
    p_id UUID,
    p_owneremployeeid_clear boolean DEFAULT false,
    p_owneremployeeid UUID DEFAULT NULL,
    p_accounttypeid_clear boolean DEFAULT false,
    p_accounttypeid UUID DEFAULT NULL,
    p_lifecyclestagetypeid_clear boolean DEFAULT false,
    p_lifecyclestagetypeid UUID DEFAULT NULL,
    p_leadsourcetypeid_clear boolean DEFAULT false,
    p_leadsourcetypeid UUID DEFAULT NULL,
    p_territory_clear boolean DEFAULT false,
    p_territory varchar(100) DEFAULT NULL,
    p_tier_clear boolean DEFAULT false,
    p_tier varchar(50) DEFAULT NULL,
    p_icpfitscore_clear boolean DEFAULT false,
    p_icpfitscore int DEFAULT NULL,
    p_industrycode_clear boolean DEFAULT false,
    p_industrycode varchar(50) DEFAULT NULL,
    p_employeecountband_clear boolean DEFAULT false,
    p_employeecountband varchar(50) DEFAULT NULL,
    p_annualrevenueband_clear boolean DEFAULT false,
    p_annualrevenueband varchar(50) DEFAULT NULL,
    p_healthstatus_clear boolean DEFAULT false,
    p_healthstatus varchar(50) DEFAULT NULL,
    p_firstclosedwondate_clear boolean DEFAULT false,
    p_firstclosedwondate date DEFAULT NULL,
    p_isactive BOOLEAN DEFAULT NULL,
    p_defaultprimarycontactid_clear boolean DEFAULT false,
    p_defaultprimarycontactid UUID DEFAULT NULL,
    p_defaultbillingcontactid_clear boolean DEFAULT false,
    p_defaultbillingcontactid UUID DEFAULT NULL
) RETURNS SETOF "__mj_bizappssales"."vwSalesAccounts" AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE "__mj_bizappssales"."SalesAccount"
    SET
        "OwnerEmployeeID" = CASE WHEN p_owneremployeeid_clear = true THEN NULL ELSE COALESCE(p_owneremployeeid, "OwnerEmployeeID") END,
        "AccountTypeID" = CASE WHEN p_accounttypeid_clear = true THEN NULL ELSE COALESCE(p_accounttypeid, "AccountTypeID") END,
        "LifecycleStageTypeID" = CASE WHEN p_lifecyclestagetypeid_clear = true THEN NULL ELSE COALESCE(p_lifecyclestagetypeid, "LifecycleStageTypeID") END,
        "LeadSourceTypeID" = CASE WHEN p_leadsourcetypeid_clear = true THEN NULL ELSE COALESCE(p_leadsourcetypeid, "LeadSourceTypeID") END,
        "Territory" = CASE WHEN p_territory_clear = true THEN NULL ELSE COALESCE(p_territory, "Territory") END,
        "Tier" = CASE WHEN p_tier_clear = true THEN NULL ELSE COALESCE(p_tier, "Tier") END,
        "ICPFitScore" = CASE WHEN p_icpfitscore_clear = true THEN NULL ELSE COALESCE(p_icpfitscore, "ICPFitScore") END,
        "IndustryCode" = CASE WHEN p_industrycode_clear = true THEN NULL ELSE COALESCE(p_industrycode, "IndustryCode") END,
        "EmployeeCountBand" = CASE WHEN p_employeecountband_clear = true THEN NULL ELSE COALESCE(p_employeecountband, "EmployeeCountBand") END,
        "AnnualRevenueBand" = CASE WHEN p_annualrevenueband_clear = true THEN NULL ELSE COALESCE(p_annualrevenueband, "AnnualRevenueBand") END,
        "HealthStatus" = CASE WHEN p_healthstatus_clear = true THEN NULL ELSE COALESCE(p_healthstatus, "HealthStatus") END,
        "FirstClosedWonDate" = CASE WHEN p_firstclosedwondate_clear = true THEN NULL ELSE COALESCE(p_firstclosedwondate, "FirstClosedWonDate") END,
        "IsActive" = COALESCE(p_isactive, "IsActive"),
        "DefaultPrimaryContactID" = CASE WHEN p_defaultprimarycontactid_clear = true THEN NULL ELSE COALESCE(p_defaultprimarycontactid, "DefaultPrimaryContactID") END,
        "DefaultBillingContactID" = CASE WHEN p_defaultbillingcontactid_clear = true THEN NULL ELSE COALESCE(p_defaultbillingcontactid, "DefaultBillingContactID") END
    WHERE
        "ID" = p_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count = 0 THEN
        -- Nothing was updated, return empty result set
        RETURN;
    END IF;

    -- Return the updated record from the base view
    RETURN QUERY
    SELECT * FROM "__mj_bizappssales"."vwSalesAccounts"
    WHERE "ID" = p_id;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spUpdateSalesAccount" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spUpdateSalesAccount" TO "cdp_Integration";


------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the SalesAccount table
------------------------------------------------------------
CREATE OR REPLACE FUNCTION "__mj_bizappssales"."fn_trg_update_sales_account"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."__mj_UpdatedAt" := NOW() AT TIME ZONE 'UTC';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_update_sales_account" ON "__mj_bizappssales"."SalesAccount";

CREATE TRIGGER "trg_update_sales_account"
BEFORE UPDATE ON "__mj_bizappssales"."SalesAccount"
FOR EACH ROW
EXECUTE FUNCTION "__mj_bizappssales"."fn_trg_update_sales_account"();
