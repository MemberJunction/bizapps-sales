/********************************************************************************
* ALL ENTITIES - TypeGraphQL Type Class Definition - AUTO GENERATED FILE
* Generated Entities and Resolvers for Server
*
*   >>> DO NOT MODIFY THIS FILE!!!!!!!!!!!!
*   >>> YOUR CHANGES WILL BE OVERWRITTEN
*   >>> THE NEXT TIME THIS FILE IS GENERATED
*
**********************************************************************************/
import { Arg, Ctx, Int, Query, Resolver, Field, Float, ObjectType, FieldResolver, Root, InputType, Mutation,
            PubSub, PubSubEngine, ResolverBase, RunViewByIDInput, RunViewByNameInput, RunDynamicViewInput,
            AppContext, KeyValuePairInput, DeleteOptionsInput, GraphQLTimestamp as Timestamp,
            GetReadOnlyProvider, GetReadWriteProvider, RestoreContextInput } from '@memberjunction/server';
import { Metadata, EntityPermissionType, CompositeKey, UserInfo } from '@memberjunction/core'

import { MaxLength } from 'class-validator';
import * as mj_core_schema_server_object_types from '@memberjunction/server'


import { mjBizAppsSalesAccountTypeEntity, mjBizAppsSalesBuyingRoleTypeEntity, mjBizAppsSalesDealContactRoleEntity, mjBizAppsSalesDealLineEntity, mjBizAppsSalesDealRoleEntity, mjBizAppsSalesDealStageEventEntity, mjBizAppsSalesDealStatusTypeEntity, mjBizAppsSalesDealTeamMemberEntity, mjBizAppsSalesDealTypeEntity, mjBizAppsSalesDealEntity, mjBizAppsSalesForecastCategoryTypeEntity, mjBizAppsSalesForecastSnapshotEntity, mjBizAppsSalesLeadSourceTypeEntity, mjBizAppsSalesLifecycleStageTypeEntity, mjBizAppsSalesLossReasonEntity, mjBizAppsSalesPipelineStageEntity, mjBizAppsSalesPipelineEntity, mjBizAppsSalesSalesAccountEntity, mjBizAppsSalesSalesContactEntity } from '@mj-biz-apps/sales-entities';
    

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Sales: Account Types
//****************************************************************************
@ObjectType()
export class mjBizAppsSalesAccountType_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field() 
    @MaxLength(40)
    Code: string;
        
    @Field() 
    @MaxLength(200)
    Name: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field(() => Boolean) 
    IsCustomer: boolean;
        
    @Field(() => Boolean) 
    IsProspect: boolean;
        
    @Field(() => Boolean) 
    IsPartner: boolean;
        
    @Field(() => Int) 
    DisplayRank: number;
        
    @Field(() => Boolean) 
    IsActive: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => [mjBizAppsSalesSalesAccount_])
    mjBizAppsSalesSalesAccounts_AccountTypeIDArray: mjBizAppsSalesSalesAccount_[]; // Link to mjBizAppsSalesSalesAccounts
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Account Types
//****************************************************************************
@InputType()
export class CreatemjBizAppsSalesAccountTypeInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description: string | null;

    @Field(() => Boolean, { nullable: true })
    IsCustomer?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsProspect?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsPartner?: boolean;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Account Types
//****************************************************************************
@InputType()
export class UpdatemjBizAppsSalesAccountTypeInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description?: string | null;

    @Field(() => Boolean, { nullable: true })
    IsCustomer?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsProspect?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsPartner?: boolean;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Sales: Account Types
//****************************************************************************
@ObjectType()
export class RunmjBizAppsSalesAccountTypeViewResult {
    @Field(() => [mjBizAppsSalesAccountType_])
    Results: mjBizAppsSalesAccountType_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsSalesAccountType_)
export class mjBizAppsSalesAccountTypeResolver extends ResolverBase {
    @Query(() => RunmjBizAppsSalesAccountTypeViewResult)
    async RunmjBizAppsSalesAccountTypeViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesAccountTypeViewResult)
    async RunmjBizAppsSalesAccountTypeViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesAccountTypeViewResult)
    async RunmjBizAppsSalesAccountTypeDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Sales: Account Types';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsSalesAccountType_, { nullable: true })
    async mjBizAppsSalesAccountType(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsSalesAccountType_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Account Types', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwAccountTypes')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Account Types', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Sales: Account Types', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsSalesSalesAccount_])
    async mjBizAppsSalesSalesAccounts_AccountTypeIDArray(@Root() mjbizappssalesaccounttype_: mjBizAppsSalesAccountType_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Sales Accounts', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwSalesAccounts')} WHERE ${provider.QuoteIdentifier('AccountTypeID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Sales Accounts', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalesaccounttype_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Sales Accounts', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsSalesAccountType_)
    async CreatemjBizAppsSalesAccountType(
        @Arg('input', () => CreatemjBizAppsSalesAccountTypeInput) input: CreatemjBizAppsSalesAccountTypeInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Sales: Account Types', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsSalesAccountType_)
    async UpdatemjBizAppsSalesAccountType(
        @Arg('input', () => UpdatemjBizAppsSalesAccountTypeInput) input: UpdatemjBizAppsSalesAccountTypeInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Sales: Account Types', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsSalesAccountType_)
    async DeletemjBizAppsSalesAccountType(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Sales: Account Types', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Sales: Buying Role Types
//****************************************************************************
@ObjectType()
export class mjBizAppsSalesBuyingRoleType_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field() 
    @MaxLength(40)
    Code: string;
        
    @Field() 
    @MaxLength(200)
    Name: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field(() => Boolean) 
    IsDecisionMaker: boolean;
        
    @Field(() => Boolean) 
    IsBlocker: boolean;
        
    @Field(() => Float, {nullable: true}) 
    InfluenceWeight?: number;
        
    @Field(() => Int) 
    DisplayRank: number;
        
    @Field(() => Boolean) 
    IsActive: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => [mjBizAppsSalesSalesContact_])
    mjBizAppsSalesSalesContacts_BuyingRoleTypeIDArray: mjBizAppsSalesSalesContact_[]; // Link to mjBizAppsSalesSalesContacts
    
    @Field(() => [mjBizAppsSalesDealContactRole_])
    mjBizAppsSalesDealContactRoles_BuyingRoleTypeIDArray: mjBizAppsSalesDealContactRole_[]; // Link to mjBizAppsSalesDealContactRoles
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Buying Role Types
//****************************************************************************
@InputType()
export class CreatemjBizAppsSalesBuyingRoleTypeInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description: string | null;

    @Field(() => Boolean, { nullable: true })
    IsDecisionMaker?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsBlocker?: boolean;

    @Field(() => Float, { nullable: true })
    InfluenceWeight: number | null;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Buying Role Types
//****************************************************************************
@InputType()
export class UpdatemjBizAppsSalesBuyingRoleTypeInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description?: string | null;

    @Field(() => Boolean, { nullable: true })
    IsDecisionMaker?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsBlocker?: boolean;

    @Field(() => Float, { nullable: true })
    InfluenceWeight?: number | null;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Sales: Buying Role Types
//****************************************************************************
@ObjectType()
export class RunmjBizAppsSalesBuyingRoleTypeViewResult {
    @Field(() => [mjBizAppsSalesBuyingRoleType_])
    Results: mjBizAppsSalesBuyingRoleType_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsSalesBuyingRoleType_)
export class mjBizAppsSalesBuyingRoleTypeResolver extends ResolverBase {
    @Query(() => RunmjBizAppsSalesBuyingRoleTypeViewResult)
    async RunmjBizAppsSalesBuyingRoleTypeViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesBuyingRoleTypeViewResult)
    async RunmjBizAppsSalesBuyingRoleTypeViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesBuyingRoleTypeViewResult)
    async RunmjBizAppsSalesBuyingRoleTypeDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Sales: Buying Role Types';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsSalesBuyingRoleType_, { nullable: true })
    async mjBizAppsSalesBuyingRoleType(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsSalesBuyingRoleType_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Buying Role Types', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwBuyingRoleTypes')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Buying Role Types', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Sales: Buying Role Types', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsSalesSalesContact_])
    async mjBizAppsSalesSalesContacts_BuyingRoleTypeIDArray(@Root() mjbizappssalesbuyingroletype_: mjBizAppsSalesBuyingRoleType_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Sales Contacts', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwSalesContacts')} WHERE ${provider.QuoteIdentifier('BuyingRoleTypeID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Sales Contacts', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalesbuyingroletype_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Sales Contacts', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsSalesDealContactRole_])
    async mjBizAppsSalesDealContactRoles_BuyingRoleTypeIDArray(@Root() mjbizappssalesbuyingroletype_: mjBizAppsSalesBuyingRoleType_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deal Contact Roles', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDealContactRoles')} WHERE ${provider.QuoteIdentifier('BuyingRoleTypeID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deal Contact Roles', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalesbuyingroletype_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Deal Contact Roles', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsSalesBuyingRoleType_)
    async CreatemjBizAppsSalesBuyingRoleType(
        @Arg('input', () => CreatemjBizAppsSalesBuyingRoleTypeInput) input: CreatemjBizAppsSalesBuyingRoleTypeInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Sales: Buying Role Types', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsSalesBuyingRoleType_)
    async UpdatemjBizAppsSalesBuyingRoleType(
        @Arg('input', () => UpdatemjBizAppsSalesBuyingRoleTypeInput) input: UpdatemjBizAppsSalesBuyingRoleTypeInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Sales: Buying Role Types', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsSalesBuyingRoleType_)
    async DeletemjBizAppsSalesBuyingRoleType(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Sales: Buying Role Types', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Sales: Deal Contact Roles
//****************************************************************************
@ObjectType({ description: `The buying committee on the CUSTOMER side: which contact plays which role on this deal. A junction rather than a field on SalesContact because one contact holds different roles on different deals.` })
export class mjBizAppsSalesDealContactRole_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field() 
    @MaxLength(36)
    DealID: string;
        
    @Field() 
    @MaxLength(36)
    SalesContactID: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    BuyingRoleTypeID?: string;
        
    @Field(() => Float, {nullable: true}) 
    Influence?: number;
        
    @Field({nullable: true}) 
    Notes?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(500)
    Deal: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    BuyingRoleType?: string;
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Deal Contact Roles
//****************************************************************************
@InputType()
export class CreatemjBizAppsSalesDealContactRoleInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    DealID?: string;

    @Field({ nullable: true })
    SalesContactID?: string;

    @Field({ nullable: true })
    BuyingRoleTypeID: string | null;

    @Field(() => Float, { nullable: true })
    Influence: number | null;

    @Field({ nullable: true })
    Notes: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Deal Contact Roles
//****************************************************************************
@InputType()
export class UpdatemjBizAppsSalesDealContactRoleInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    DealID?: string;

    @Field({ nullable: true })
    SalesContactID?: string;

    @Field({ nullable: true })
    BuyingRoleTypeID?: string | null;

    @Field(() => Float, { nullable: true })
    Influence?: number | null;

    @Field({ nullable: true })
    Notes?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Sales: Deal Contact Roles
//****************************************************************************
@ObjectType()
export class RunmjBizAppsSalesDealContactRoleViewResult {
    @Field(() => [mjBizAppsSalesDealContactRole_])
    Results: mjBizAppsSalesDealContactRole_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsSalesDealContactRole_)
export class mjBizAppsSalesDealContactRoleResolver extends ResolverBase {
    @Query(() => RunmjBizAppsSalesDealContactRoleViewResult)
    async RunmjBizAppsSalesDealContactRoleViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesDealContactRoleViewResult)
    async RunmjBizAppsSalesDealContactRoleViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesDealContactRoleViewResult)
    async RunmjBizAppsSalesDealContactRoleDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Sales: Deal Contact Roles';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsSalesDealContactRole_, { nullable: true })
    async mjBizAppsSalesDealContactRole(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsSalesDealContactRole_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deal Contact Roles', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDealContactRoles')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deal Contact Roles', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Sales: Deal Contact Roles', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsSalesDealContactRole_)
    async CreatemjBizAppsSalesDealContactRole(
        @Arg('input', () => CreatemjBizAppsSalesDealContactRoleInput) input: CreatemjBizAppsSalesDealContactRoleInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Sales: Deal Contact Roles', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsSalesDealContactRole_)
    async UpdatemjBizAppsSalesDealContactRole(
        @Arg('input', () => UpdatemjBizAppsSalesDealContactRoleInput) input: UpdatemjBizAppsSalesDealContactRoleInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Sales: Deal Contact Roles', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsSalesDealContactRole_)
    async DeletemjBizAppsSalesDealContactRole(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Sales: Deal Contact Roles', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Sales: Deal Lines
//****************************************************************************
@ObjectType({ description: `A requested line on a deal. Stores INTENT (product, quantity, requested discount, override price, term); the Resolved* columns are WRITE-ONLY from an Orders.PreviewOrder response. Sales never multiplies quantity by price, applies a discount, computes tax, prorates a period, sums a total or rounds anything.` })
export class mjBizAppsSalesDealLine_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field() 
    @MaxLength(36)
    DealID: string;
        
    @Field({nullable: true, description: `SOFT reference (no FK) to a bizapps-orders Product. Soft because orders' migrations may not have run — which is exactly what lets this app stand up independently.`}) 
    @MaxLength(36)
    ProductID?: string;
        
    @Field(() => Float) 
    Quantity: number;
        
    @Field(() => Float, {nullable: true}) 
    RequestedDiscountPct?: number;
        
    @Field(() => Float, {nullable: true, description: `A negotiated unit price. An INPUT to the pricing engine, never a replacement for it — the line still goes through Orders.PreviewOrder.`}) 
    OverrideUnitPrice?: number;
        
    @Field(() => Int, {nullable: true}) 
    TermMonths?: number;
        
    @Field({nullable: true}) 
    ServicePeriodStart?: Date;
        
    @Field({nullable: true}) 
    ServicePeriodEnd?: Date;
        
    @Field({nullable: true}) 
    @MaxLength(40)
    LineType?: string;
        
    @Field(() => Int) 
    DisplayOrder: number;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field(() => Float, {nullable: true, description: `WRITE-ONLY from this app's perspective: populated only from an Orders.PreviewOrder response, never computed locally, never hand-edited.`}) 
    ResolvedUnitPrice?: number;
        
    @Field(() => Float, {nullable: true, description: `WRITE-ONLY, from Orders.PreviewOrder. Never quantity x price computed here.`}) 
    ResolvedExtendedAmount?: number;
        
    @Field({nullable: true, description: `The explanation trail Orders.PreviewOrder returns (base, rules, adjustments, charges, tax), so a rep can answer "why is it this price" without a support ticket.`}) 
    PriceComponentsJSON?: string;
        
    @Field({nullable: true}) 
    PricedAt?: Date;
        
    @Field({nullable: true, description: `DENORMALIZED stamp of the product's owning company at price time, mirroring OrderLine.CompanyID. This is what lets a cross-company deal materialize into orders with correct per-line company ownership. Server-maintained; never hand-set.`}) 
    @MaxLength(36)
    CompanyID?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(500)
    Deal: string;
        
    @Field({nullable: true}) 
    @MaxLength(50)
    Company?: string;
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Deal Lines
//****************************************************************************
@InputType()
export class CreatemjBizAppsSalesDealLineInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    DealID?: string;

    @Field({ nullable: true })
    ProductID: string | null;

    @Field(() => Float, { nullable: true })
    Quantity?: number;

    @Field(() => Float, { nullable: true })
    RequestedDiscountPct: number | null;

    @Field(() => Float, { nullable: true })
    OverrideUnitPrice: number | null;

    @Field(() => Int, { nullable: true })
    TermMonths: number | null;

    @Field({ nullable: true })
    ServicePeriodStart: Date | null;

    @Field({ nullable: true })
    ServicePeriodEnd: Date | null;

    @Field({ nullable: true })
    LineType: string | null;

    @Field(() => Int, { nullable: true })
    DisplayOrder?: number;

    @Field({ nullable: true })
    Description: string | null;

    @Field(() => Float, { nullable: true })
    ResolvedUnitPrice: number | null;

    @Field(() => Float, { nullable: true })
    ResolvedExtendedAmount: number | null;

    @Field({ nullable: true })
    PriceComponentsJSON: string | null;

    @Field({ nullable: true })
    PricedAt: Date | null;

    @Field({ nullable: true })
    CompanyID: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Deal Lines
//****************************************************************************
@InputType()
export class UpdatemjBizAppsSalesDealLineInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    DealID?: string;

    @Field({ nullable: true })
    ProductID?: string | null;

    @Field(() => Float, { nullable: true })
    Quantity?: number;

    @Field(() => Float, { nullable: true })
    RequestedDiscountPct?: number | null;

    @Field(() => Float, { nullable: true })
    OverrideUnitPrice?: number | null;

    @Field(() => Int, { nullable: true })
    TermMonths?: number | null;

    @Field({ nullable: true })
    ServicePeriodStart?: Date | null;

    @Field({ nullable: true })
    ServicePeriodEnd?: Date | null;

    @Field({ nullable: true })
    LineType?: string | null;

    @Field(() => Int, { nullable: true })
    DisplayOrder?: number;

    @Field({ nullable: true })
    Description?: string | null;

    @Field(() => Float, { nullable: true })
    ResolvedUnitPrice?: number | null;

    @Field(() => Float, { nullable: true })
    ResolvedExtendedAmount?: number | null;

    @Field({ nullable: true })
    PriceComponentsJSON?: string | null;

    @Field({ nullable: true })
    PricedAt?: Date | null;

    @Field({ nullable: true })
    CompanyID?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Sales: Deal Lines
//****************************************************************************
@ObjectType()
export class RunmjBizAppsSalesDealLineViewResult {
    @Field(() => [mjBizAppsSalesDealLine_])
    Results: mjBizAppsSalesDealLine_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsSalesDealLine_)
export class mjBizAppsSalesDealLineResolver extends ResolverBase {
    @Query(() => RunmjBizAppsSalesDealLineViewResult)
    async RunmjBizAppsSalesDealLineViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesDealLineViewResult)
    async RunmjBizAppsSalesDealLineViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesDealLineViewResult)
    async RunmjBizAppsSalesDealLineDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Sales: Deal Lines';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsSalesDealLine_, { nullable: true })
    async mjBizAppsSalesDealLine(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsSalesDealLine_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deal Lines', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDealLines')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deal Lines', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Sales: Deal Lines', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsSalesDealLine_)
    async CreatemjBizAppsSalesDealLine(
        @Arg('input', () => CreatemjBizAppsSalesDealLineInput) input: CreatemjBizAppsSalesDealLineInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Sales: Deal Lines', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsSalesDealLine_)
    async UpdatemjBizAppsSalesDealLine(
        @Arg('input', () => UpdatemjBizAppsSalesDealLineInput) input: UpdatemjBizAppsSalesDealLineInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Sales: Deal Lines', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsSalesDealLine_)
    async DeletemjBizAppsSalesDealLine(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Sales: Deal Lines', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Sales: Deal Roles
//****************************************************************************
@ObjectType({ description: `The roles internal people hold on a deal (Owner/AE, Sales Engineer, SDR, Executive Sponsor, Partner Manager, CS Lead).` })
export class mjBizAppsSalesDealRole_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field() 
    @MaxLength(40)
    Code: string;
        
    @Field() 
    @MaxLength(200)
    Name: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field(() => Boolean, {description: `Identifies the role that DEFINES ownership. Exactly one team member per deal may hold a role with this flag, enforced server-side, and Deal.OwnerEmployeeID is the denormalized stamp of whoever does.`}) 
    IsOwnerRole: boolean;
        
    @Field(() => Boolean, {description: `Whether two people may hold this role on one deal. Two sales engineers, yes; two owners, no. Enforced server-side FROM THIS FLAG, never hardcoded against a role name.`}) 
    AllowsMultiplePerDeal: boolean;
        
    @Field(() => Float, {nullable: true}) 
    DefaultAttributionPct?: number;
        
    @Field(() => Boolean) 
    IsQuotaCarrying: boolean;
        
    @Field(() => Int) 
    DisplayRank: number;
        
    @Field(() => Boolean) 
    IsActive: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => [mjBizAppsSalesDealTeamMember_])
    mjBizAppsSalesDealTeamMembers_DealRoleIDArray: mjBizAppsSalesDealTeamMember_[]; // Link to mjBizAppsSalesDealTeamMembers
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Deal Roles
//****************************************************************************
@InputType()
export class CreatemjBizAppsSalesDealRoleInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description: string | null;

    @Field(() => Boolean, { nullable: true })
    IsOwnerRole?: boolean;

    @Field(() => Boolean, { nullable: true })
    AllowsMultiplePerDeal?: boolean;

    @Field(() => Float, { nullable: true })
    DefaultAttributionPct: number | null;

    @Field(() => Boolean, { nullable: true })
    IsQuotaCarrying?: boolean;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Deal Roles
//****************************************************************************
@InputType()
export class UpdatemjBizAppsSalesDealRoleInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description?: string | null;

    @Field(() => Boolean, { nullable: true })
    IsOwnerRole?: boolean;

    @Field(() => Boolean, { nullable: true })
    AllowsMultiplePerDeal?: boolean;

    @Field(() => Float, { nullable: true })
    DefaultAttributionPct?: number | null;

    @Field(() => Boolean, { nullable: true })
    IsQuotaCarrying?: boolean;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Sales: Deal Roles
//****************************************************************************
@ObjectType()
export class RunmjBizAppsSalesDealRoleViewResult {
    @Field(() => [mjBizAppsSalesDealRole_])
    Results: mjBizAppsSalesDealRole_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsSalesDealRole_)
export class mjBizAppsSalesDealRoleResolver extends ResolverBase {
    @Query(() => RunmjBizAppsSalesDealRoleViewResult)
    async RunmjBizAppsSalesDealRoleViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesDealRoleViewResult)
    async RunmjBizAppsSalesDealRoleViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesDealRoleViewResult)
    async RunmjBizAppsSalesDealRoleDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Sales: Deal Roles';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsSalesDealRole_, { nullable: true })
    async mjBizAppsSalesDealRole(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsSalesDealRole_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deal Roles', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDealRoles')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deal Roles', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Sales: Deal Roles', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsSalesDealTeamMember_])
    async mjBizAppsSalesDealTeamMembers_DealRoleIDArray(@Root() mjbizappssalesdealrole_: mjBizAppsSalesDealRole_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deal Team Members', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDealTeamMembers')} WHERE ${provider.QuoteIdentifier('DealRoleID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deal Team Members', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalesdealrole_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Deal Team Members', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsSalesDealRole_)
    async CreatemjBizAppsSalesDealRole(
        @Arg('input', () => CreatemjBizAppsSalesDealRoleInput) input: CreatemjBizAppsSalesDealRoleInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Sales: Deal Roles', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsSalesDealRole_)
    async UpdatemjBizAppsSalesDealRole(
        @Arg('input', () => UpdatemjBizAppsSalesDealRoleInput) input: UpdatemjBizAppsSalesDealRoleInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Sales: Deal Roles', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsSalesDealRole_)
    async DeletemjBizAppsSalesDealRole(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Sales: Deal Roles', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Sales: Deal Stage Events
//****************************************************************************
@ObjectType({ description: `APPEND-ONLY transition log, never edited. The source for stage conversion, velocity, dwell time, slippage and skipped-stage analysis. Stamping the amount and probability AT each transition is what lets historical roll-ups reconstruct correctly after a deal\'s amount changes.` })
export class mjBizAppsSalesDealStageEvent_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field() 
    @MaxLength(36)
    DealID: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    FromStageID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    ToStageID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    FromDealStatusTypeID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    ToDealStatusTypeID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    ChangedByUserID?: string;
        
    @Field({description: `The ORIGINAL time of the transition, not the row's insert time. A distinct column rather than a reliance on __mj_CreatedAt because the HubSpot import must preserve historical timestamps — a 2023 transition has to land as 2023.`}) 
    ChangedAt: Date;
        
    @Field(() => Int, {nullable: true}) 
    DaysInPreviousStage?: number;
        
    @Field(() => Float, {nullable: true, description: `Deal.Amount as it stood at this transition. Point-in-time truth: "what did we think the forecast was on the 1st" is unanswerable from Deal alone once amounts change.`}) 
    AmountAtTransition?: number;
        
    @Field(() => Float, {nullable: true}) 
    ProbabilityAtTransition?: number;
        
    @Field({nullable: true}) 
    Notes?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(500)
    Deal: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    FromStage?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    ToStage?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    FromDealStatusType?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    ToDealStatusType?: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    ChangedByUser?: string;
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Deal Stage Events
//****************************************************************************
@InputType()
export class CreatemjBizAppsSalesDealStageEventInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    DealID?: string;

    @Field({ nullable: true })
    FromStageID: string | null;

    @Field({ nullable: true })
    ToStageID: string | null;

    @Field({ nullable: true })
    FromDealStatusTypeID: string | null;

    @Field({ nullable: true })
    ToDealStatusTypeID: string | null;

    @Field({ nullable: true })
    ChangedByUserID: string | null;

    @Field({ nullable: true })
    ChangedAt?: Date;

    @Field(() => Int, { nullable: true })
    DaysInPreviousStage: number | null;

    @Field(() => Float, { nullable: true })
    AmountAtTransition: number | null;

    @Field(() => Float, { nullable: true })
    ProbabilityAtTransition: number | null;

    @Field({ nullable: true })
    Notes: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Deal Stage Events
//****************************************************************************
@InputType()
export class UpdatemjBizAppsSalesDealStageEventInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    DealID?: string;

    @Field({ nullable: true })
    FromStageID?: string | null;

    @Field({ nullable: true })
    ToStageID?: string | null;

    @Field({ nullable: true })
    FromDealStatusTypeID?: string | null;

    @Field({ nullable: true })
    ToDealStatusTypeID?: string | null;

    @Field({ nullable: true })
    ChangedByUserID?: string | null;

    @Field({ nullable: true })
    ChangedAt?: Date;

    @Field(() => Int, { nullable: true })
    DaysInPreviousStage?: number | null;

    @Field(() => Float, { nullable: true })
    AmountAtTransition?: number | null;

    @Field(() => Float, { nullable: true })
    ProbabilityAtTransition?: number | null;

    @Field({ nullable: true })
    Notes?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Sales: Deal Stage Events
//****************************************************************************
@ObjectType()
export class RunmjBizAppsSalesDealStageEventViewResult {
    @Field(() => [mjBizAppsSalesDealStageEvent_])
    Results: mjBizAppsSalesDealStageEvent_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsSalesDealStageEvent_)
export class mjBizAppsSalesDealStageEventResolver extends ResolverBase {
    @Query(() => RunmjBizAppsSalesDealStageEventViewResult)
    async RunmjBizAppsSalesDealStageEventViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesDealStageEventViewResult)
    async RunmjBizAppsSalesDealStageEventViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesDealStageEventViewResult)
    async RunmjBizAppsSalesDealStageEventDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Sales: Deal Stage Events';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsSalesDealStageEvent_, { nullable: true })
    async mjBizAppsSalesDealStageEvent(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsSalesDealStageEvent_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deal Stage Events', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDealStageEvents')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deal Stage Events', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Sales: Deal Stage Events', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsSalesDealStageEvent_)
    async CreatemjBizAppsSalesDealStageEvent(
        @Arg('input', () => CreatemjBizAppsSalesDealStageEventInput) input: CreatemjBizAppsSalesDealStageEventInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Sales: Deal Stage Events', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsSalesDealStageEvent_)
    async UpdatemjBizAppsSalesDealStageEvent(
        @Arg('input', () => UpdatemjBizAppsSalesDealStageEventInput) input: UpdatemjBizAppsSalesDealStageEventInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Sales: Deal Stage Events', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsSalesDealStageEvent_)
    async DeletemjBizAppsSalesDealStageEvent(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Sales: Deal Stage Events', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Sales: Deal Status Types
//****************************************************************************
@ObjectType({ description: `The OUTCOME vocabulary for deals (Open, Won, Lost, Abandoned, On Hold ...). Behaviour comes from the flags on this row, NEVER from the Name — Sales.CloseDeal is named for the outcome type rather than a hardcoded "won" precisely so it can resolve everything from IsWon/IsLost/LocksDeal. Renaming a status is a metadata change with no code impact.` })
export class mjBizAppsSalesDealStatusType_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `Stable identifier the engine and metadata seeds key on. Renaming Name is cosmetic; renaming Code changes an identifier.`}) 
    @MaxLength(40)
    Code: string;
        
    @Field() 
    @MaxLength(200)
    Name: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field(() => Boolean) 
    IsOpen: boolean;
        
    @Field(() => Boolean) 
    IsClosed: boolean;
        
    @Field(() => Boolean) 
    IsWon: boolean;
        
    @Field(() => Boolean) 
    IsLost: boolean;
        
    @Field(() => Boolean, {description: `When 1, a deal in this status FREEZES: the header (except Description and NextStep), its lines and its team members become immutable, enforced in DealEntityServer.Save() — not in the UI, so an Action, an agent or a raw BaseEntity.Save() hits the same wall. Mirrors journal-entry immutability in accounting, and for the same reason: the deal is now the provenance of a contract and an order.`}) 
    LocksDeal: boolean;
        
    @Field(() => Int) 
    DisplayRank: number;
        
    @Field(() => Boolean) 
    IsActive: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => [mjBizAppsSalesPipelineStage_])
    mjBizAppsSalesPipelineStages_DealStatusTypeIDArray: mjBizAppsSalesPipelineStage_[]; // Link to mjBizAppsSalesPipelineStages
    
    @Field(() => [mjBizAppsSalesDealStageEvent_])
    mjBizAppsSalesDealStageEvents_FromDealStatusTypeIDArray: mjBizAppsSalesDealStageEvent_[]; // Link to mjBizAppsSalesDealStageEvents
    
    @Field(() => [mjBizAppsSalesDealStageEvent_])
    mjBizAppsSalesDealStageEvents_ToDealStatusTypeIDArray: mjBizAppsSalesDealStageEvent_[]; // Link to mjBizAppsSalesDealStageEvents
    
    @Field(() => [mjBizAppsSalesDeal_])
    mjBizAppsSalesDeals_DealStatusTypeIDArray: mjBizAppsSalesDeal_[]; // Link to mjBizAppsSalesDeals
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Deal Status Types
//****************************************************************************
@InputType()
export class CreatemjBizAppsSalesDealStatusTypeInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description: string | null;

    @Field(() => Boolean, { nullable: true })
    IsOpen?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsClosed?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsWon?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsLost?: boolean;

    @Field(() => Boolean, { nullable: true })
    LocksDeal?: boolean;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Deal Status Types
//****************************************************************************
@InputType()
export class UpdatemjBizAppsSalesDealStatusTypeInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description?: string | null;

    @Field(() => Boolean, { nullable: true })
    IsOpen?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsClosed?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsWon?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsLost?: boolean;

    @Field(() => Boolean, { nullable: true })
    LocksDeal?: boolean;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Sales: Deal Status Types
//****************************************************************************
@ObjectType()
export class RunmjBizAppsSalesDealStatusTypeViewResult {
    @Field(() => [mjBizAppsSalesDealStatusType_])
    Results: mjBizAppsSalesDealStatusType_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsSalesDealStatusType_)
export class mjBizAppsSalesDealStatusTypeResolver extends ResolverBase {
    @Query(() => RunmjBizAppsSalesDealStatusTypeViewResult)
    async RunmjBizAppsSalesDealStatusTypeViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesDealStatusTypeViewResult)
    async RunmjBizAppsSalesDealStatusTypeViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesDealStatusTypeViewResult)
    async RunmjBizAppsSalesDealStatusTypeDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Sales: Deal Status Types';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsSalesDealStatusType_, { nullable: true })
    async mjBizAppsSalesDealStatusType(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsSalesDealStatusType_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deal Status Types', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDealStatusTypes')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deal Status Types', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Sales: Deal Status Types', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsSalesPipelineStage_])
    async mjBizAppsSalesPipelineStages_DealStatusTypeIDArray(@Root() mjbizappssalesdealstatustype_: mjBizAppsSalesDealStatusType_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Pipeline Stages', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwPipelineStages')} WHERE ${provider.QuoteIdentifier('DealStatusTypeID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Pipeline Stages', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalesdealstatustype_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Pipeline Stages', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsSalesDealStageEvent_])
    async mjBizAppsSalesDealStageEvents_FromDealStatusTypeIDArray(@Root() mjbizappssalesdealstatustype_: mjBizAppsSalesDealStatusType_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deal Stage Events', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDealStageEvents')} WHERE ${provider.QuoteIdentifier('FromDealStatusTypeID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deal Stage Events', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalesdealstatustype_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Deal Stage Events', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsSalesDealStageEvent_])
    async mjBizAppsSalesDealStageEvents_ToDealStatusTypeIDArray(@Root() mjbizappssalesdealstatustype_: mjBizAppsSalesDealStatusType_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deal Stage Events', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDealStageEvents')} WHERE ${provider.QuoteIdentifier('ToDealStatusTypeID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deal Stage Events', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalesdealstatustype_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Deal Stage Events', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsSalesDeal_])
    async mjBizAppsSalesDeals_DealStatusTypeIDArray(@Root() mjbizappssalesdealstatustype_: mjBizAppsSalesDealStatusType_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deals', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDeals')} WHERE ${provider.QuoteIdentifier('DealStatusTypeID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deals', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalesdealstatustype_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Deals', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsSalesDealStatusType_)
    async CreatemjBizAppsSalesDealStatusType(
        @Arg('input', () => CreatemjBizAppsSalesDealStatusTypeInput) input: CreatemjBizAppsSalesDealStatusTypeInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Sales: Deal Status Types', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsSalesDealStatusType_)
    async UpdatemjBizAppsSalesDealStatusType(
        @Arg('input', () => UpdatemjBizAppsSalesDealStatusTypeInput) input: UpdatemjBizAppsSalesDealStatusTypeInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Sales: Deal Status Types', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsSalesDealStatusType_)
    async DeletemjBizAppsSalesDealStatusType(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Sales: Deal Status Types', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Sales: Deal Team Members
//****************************************************************************
@ObjectType({ description: `The internal people on a deal and the role each holds — the SINGLE SOURCE OF TRUTH for deal membership, INCLUDING the owner (the member whose DealRole has IsOwnerRole = 1). WATCH THE ATTRIBUTION DOUBLE-COUNT: a deal with an AE, an SE and an SDR has three rows, so summing Deal.Amount across this table triple-counts the deal. Every by-rep rollup must either filter to the owner role or weight by AttributionPct.` })
export class mjBizAppsSalesDealTeamMember_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field() 
    @MaxLength(36)
    DealID: string;
        
    @Field({nullable: true, description: `The internal rep, as an MJ Employee. Exactly one of EmployeeID / PersonID is set. Employee is the common case.`}) 
    @MaxLength(36)
    EmployeeID?: string;
        
    @Field({nullable: true, description: `A NON-EMPLOYEE team member — a partner rep or contractor — as a common.Person. Exactly one of EmployeeID / PersonID is set (D-6). Needed because Partner Manager is a seeded DealRole and an Employee row cannot express someone outside the company.`}) 
    @MaxLength(36)
    PersonID?: string;
        
    @Field() 
    @MaxLength(36)
    DealRoleID: string;
        
    @Field(() => Float, {nullable: true, description: `This member's share of the deal for by-rep rollups. When any member of a deal has a value set, the app validates that active members sum to 100. Leave NULL to fall back to owner-role attribution.`}) 
    AttributionPct?: number;
        
    @Field({nullable: true}) 
    StartDate?: Date;
        
    @Field({nullable: true}) 
    EndDate?: Date;
        
    @Field(() => Boolean) 
    IsActive: boolean;
        
    @Field({nullable: true}) 
    Notes?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(500)
    Deal: string;
        
    @Field({nullable: true}) 
    @MaxLength(81)
    Employee?: string;
        
    @Field({nullable: true}) 
    @MaxLength(201)
    Person?: string;
        
    @Field() 
    @MaxLength(200)
    DealRole: string;
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Deal Team Members
//****************************************************************************
@InputType()
export class CreatemjBizAppsSalesDealTeamMemberInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    DealID?: string;

    @Field({ nullable: true })
    EmployeeID: string | null;

    @Field({ nullable: true })
    PersonID: string | null;

    @Field({ nullable: true })
    DealRoleID?: string;

    @Field(() => Float, { nullable: true })
    AttributionPct: number | null;

    @Field({ nullable: true })
    StartDate: Date | null;

    @Field({ nullable: true })
    EndDate: Date | null;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field({ nullable: true })
    Notes: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Deal Team Members
//****************************************************************************
@InputType()
export class UpdatemjBizAppsSalesDealTeamMemberInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    DealID?: string;

    @Field({ nullable: true })
    EmployeeID?: string | null;

    @Field({ nullable: true })
    PersonID?: string | null;

    @Field({ nullable: true })
    DealRoleID?: string;

    @Field(() => Float, { nullable: true })
    AttributionPct?: number | null;

    @Field({ nullable: true })
    StartDate?: Date | null;

    @Field({ nullable: true })
    EndDate?: Date | null;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field({ nullable: true })
    Notes?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Sales: Deal Team Members
//****************************************************************************
@ObjectType()
export class RunmjBizAppsSalesDealTeamMemberViewResult {
    @Field(() => [mjBizAppsSalesDealTeamMember_])
    Results: mjBizAppsSalesDealTeamMember_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsSalesDealTeamMember_)
export class mjBizAppsSalesDealTeamMemberResolver extends ResolverBase {
    @Query(() => RunmjBizAppsSalesDealTeamMemberViewResult)
    async RunmjBizAppsSalesDealTeamMemberViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesDealTeamMemberViewResult)
    async RunmjBizAppsSalesDealTeamMemberViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesDealTeamMemberViewResult)
    async RunmjBizAppsSalesDealTeamMemberDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Sales: Deal Team Members';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsSalesDealTeamMember_, { nullable: true })
    async mjBizAppsSalesDealTeamMember(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsSalesDealTeamMember_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deal Team Members', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDealTeamMembers')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deal Team Members', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Sales: Deal Team Members', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsSalesDealTeamMember_)
    async CreatemjBizAppsSalesDealTeamMember(
        @Arg('input', () => CreatemjBizAppsSalesDealTeamMemberInput) input: CreatemjBizAppsSalesDealTeamMemberInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Sales: Deal Team Members', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsSalesDealTeamMember_)
    async UpdatemjBizAppsSalesDealTeamMember(
        @Arg('input', () => UpdatemjBizAppsSalesDealTeamMemberInput) input: UpdatemjBizAppsSalesDealTeamMemberInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Sales: Deal Team Members', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsSalesDealTeamMember_)
    async DeletemjBizAppsSalesDealTeamMember(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Sales: Deal Team Members', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Sales: Deal Types
//****************************************************************************
@ObjectType()
export class mjBizAppsSalesDealType_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field() 
    @MaxLength(40)
    Code: string;
        
    @Field() 
    @MaxLength(200)
    Name: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field(() => Boolean) 
    RequiresContract: boolean;
        
    @Field(() => Boolean) 
    RequiresRenewalSource: boolean;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    DefaultPipelineID?: string;
        
    @Field(() => Int) 
    DisplayRank: number;
        
    @Field(() => Boolean) 
    IsActive: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    DefaultPipeline?: string;
        
    @Field(() => [mjBizAppsSalesDeal_])
    mjBizAppsSalesDeals_DealTypeIDArray: mjBizAppsSalesDeal_[]; // Link to mjBizAppsSalesDeals
    
    @Field(() => [mjBizAppsSalesPipeline_])
    mjBizAppsSalesPipelines_DealTypeIDArray: mjBizAppsSalesPipeline_[]; // Link to mjBizAppsSalesPipelines
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Deal Types
//****************************************************************************
@InputType()
export class CreatemjBizAppsSalesDealTypeInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description: string | null;

    @Field(() => Boolean, { nullable: true })
    RequiresContract?: boolean;

    @Field(() => Boolean, { nullable: true })
    RequiresRenewalSource?: boolean;

    @Field({ nullable: true })
    DefaultPipelineID: string | null;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Deal Types
//****************************************************************************
@InputType()
export class UpdatemjBizAppsSalesDealTypeInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description?: string | null;

    @Field(() => Boolean, { nullable: true })
    RequiresContract?: boolean;

    @Field(() => Boolean, { nullable: true })
    RequiresRenewalSource?: boolean;

    @Field({ nullable: true })
    DefaultPipelineID?: string | null;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Sales: Deal Types
//****************************************************************************
@ObjectType()
export class RunmjBizAppsSalesDealTypeViewResult {
    @Field(() => [mjBizAppsSalesDealType_])
    Results: mjBizAppsSalesDealType_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsSalesDealType_)
export class mjBizAppsSalesDealTypeResolver extends ResolverBase {
    @Query(() => RunmjBizAppsSalesDealTypeViewResult)
    async RunmjBizAppsSalesDealTypeViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesDealTypeViewResult)
    async RunmjBizAppsSalesDealTypeViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesDealTypeViewResult)
    async RunmjBizAppsSalesDealTypeDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Sales: Deal Types';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsSalesDealType_, { nullable: true })
    async mjBizAppsSalesDealType(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsSalesDealType_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deal Types', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDealTypes')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deal Types', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Sales: Deal Types', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsSalesDeal_])
    async mjBizAppsSalesDeals_DealTypeIDArray(@Root() mjbizappssalesdealtype_: mjBizAppsSalesDealType_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deals', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDeals')} WHERE ${provider.QuoteIdentifier('DealTypeID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deals', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalesdealtype_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Deals', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsSalesPipeline_])
    async mjBizAppsSalesPipelines_DealTypeIDArray(@Root() mjbizappssalesdealtype_: mjBizAppsSalesDealType_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Pipelines', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwPipelines')} WHERE ${provider.QuoteIdentifier('DealTypeID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Pipelines', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalesdealtype_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Pipelines', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsSalesDealType_)
    async CreatemjBizAppsSalesDealType(
        @Arg('input', () => CreatemjBizAppsSalesDealTypeInput) input: CreatemjBizAppsSalesDealTypeInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Sales: Deal Types', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsSalesDealType_)
    async UpdatemjBizAppsSalesDealType(
        @Arg('input', () => UpdatemjBizAppsSalesDealTypeInput) input: UpdatemjBizAppsSalesDealTypeInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Sales: Deal Types', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsSalesDealType_)
    async DeletemjBizAppsSalesDealType(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Sales: Deal Types', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Sales: Deals
//****************************************************************************
@ObjectType({ description: `A deal (opportunity). Amount is a CACHED answer from Orders.PreviewOrder carrying its own provenance, never a locally computed total — this app performs no pricing arithmetic of any kind. Closing a deal is a transaction that CREATES a contract and/or orders, not a notification that someone should.` })
export class mjBizAppsSalesDeal_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(50)
    DealNumber?: string;
        
    @Field() 
    @MaxLength(500)
    Name: string;
        
    @Field() 
    @MaxLength(36)
    PipelineID: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    PipelineStageID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    DealTypeID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    DealStatusTypeID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    AccountID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    PrimaryContactID?: string;
        
    @Field({description: `The SELLING company. Must match Pipeline.CompanyID; enforced by the entity server, since a CHECK cannot reach across the FK to compare them. FK to __mj.Company.`}) 
    @MaxLength(36)
    CompanyID: string;
        
    @Field({nullable: true, description: `DENORMALIZED, SERVER-MAINTAINED. The Employee holding the role where DealRole.IsOwnerRole = 1, written by DealEntityServer.Save() whenever team membership changes. DealTeamMember is the source of truth; this exists so "my deals" and per-rep boards need no join. NEVER SET THIS DIRECTLY — it will diverge.`}) 
    @MaxLength(36)
    OwnerEmployeeID?: string;
        
    @Field(() => Float, {nullable: true, description: `The deal value. A CACHED ANSWER returned by Orders.PreviewOrder for this deal's line set — NOT computed here. For a simple (header-only) deal it is hand-entered and AmountIsComputed is 0. Never sum DealLine rows into this column; sales does no arithmetic.`}) 
    Amount?: number;
        
    @Field(() => Boolean, {description: `1 when Amount came from Orders.PreviewOrder; 0 when a human typed it (a simple, header-only deal). Distinguishes a traceable figure from a stated one.`}) 
    AmountIsComputed: boolean;
        
    @Field({nullable: true}) 
    AmountComputedAt?: Date;
        
    @Field({nullable: true, description: `Fingerprint of the DealLine set Amount was computed from. Compare it against the current lines to detect a STALE amount, so the UI can say "this figure is stale, reprice" instead of showing a number nobody can trace. Without this column Amount becomes a hand-edited field within a month.`}) 
    @MaxLength(128)
    AmountSourceHash?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    CurrencyID?: string;
        
    @Field(() => Float, {nullable: true}) 
    MRR?: number;
        
    @Field(() => Float, {nullable: true}) 
    ARR?: number;
        
    @Field(() => Int, {nullable: true}) 
    TermMonths?: number;
        
    @Field({nullable: true}) 
    ExpectedCloseDate?: Date;
        
    @Field({nullable: true}) 
    ActualCloseDate?: Date;
        
    @Field(() => Float, {nullable: true}) 
    Probability?: number;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    ForecastCategoryTypeID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    LossReasonID?: string;
        
    @Field({nullable: true}) 
    LossNotes?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    LeadSourceTypeID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    CampaignID?: string;
        
    @Field({nullable: true, description: `SOFT reference (no FK) to a bizapps-contracts Contract. The link points DOWN the dependency graph; there is deliberately no Contract.DealID, because it is ONE contract to MANY deals — the original sale, every renewal, every expansion.`}) 
    @MaxLength(36)
    ContractID?: string;
        
    @Field({nullable: true, description: `SOFT reference (no FK) to the contract this deal RENEWS. What makes the renewal chain navigable from the sales side without contracts knowing anything about it. Required when DealType.RequiresRenewalSource is set.`}) 
    @MaxLength(36)
    RenewsContractID?: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field({nullable: true}) 
    @MaxLength(1000)
    NextStep?: string;
        
    @Field({nullable: true}) 
    NextStepDate?: Date;
        
    @Field({nullable: true}) 
    ClosedAt?: Date;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    ClosedByUserID?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(200)
    Pipeline: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    PipelineStage?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    DealType?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    DealStatusType?: string;
        
    @Field() 
    @MaxLength(50)
    Company: string;
        
    @Field({nullable: true}) 
    @MaxLength(81)
    OwnerEmployee?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    ForecastCategoryType?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    LossReason?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    LeadSourceType?: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    ClosedByUser?: string;
        
    @Field(() => [mjBizAppsSalesDealStageEvent_])
    mjBizAppsSalesDealStageEvents_DealIDArray: mjBizAppsSalesDealStageEvent_[]; // Link to mjBizAppsSalesDealStageEvents
    
    @Field(() => [mjBizAppsSalesDealContactRole_])
    mjBizAppsSalesDealContactRoles_DealIDArray: mjBizAppsSalesDealContactRole_[]; // Link to mjBizAppsSalesDealContactRoles
    
    @Field(() => [mjBizAppsSalesDealTeamMember_])
    mjBizAppsSalesDealTeamMembers_DealIDArray: mjBizAppsSalesDealTeamMember_[]; // Link to mjBizAppsSalesDealTeamMembers
    
    @Field(() => [mjBizAppsSalesDealLine_])
    mjBizAppsSalesDealLines_DealIDArray: mjBizAppsSalesDealLine_[]; // Link to mjBizAppsSalesDealLines
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Deals
//****************************************************************************
@InputType()
export class CreatemjBizAppsSalesDealInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    DealNumber: string | null;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    PipelineID?: string;

    @Field({ nullable: true })
    PipelineStageID: string | null;

    @Field({ nullable: true })
    DealTypeID: string | null;

    @Field({ nullable: true })
    DealStatusTypeID: string | null;

    @Field({ nullable: true })
    AccountID: string | null;

    @Field({ nullable: true })
    PrimaryContactID: string | null;

    @Field({ nullable: true })
    CompanyID?: string;

    @Field({ nullable: true })
    OwnerEmployeeID: string | null;

    @Field(() => Float, { nullable: true })
    Amount: number | null;

    @Field(() => Boolean, { nullable: true })
    AmountIsComputed?: boolean;

    @Field({ nullable: true })
    AmountComputedAt: Date | null;

    @Field({ nullable: true })
    AmountSourceHash: string | null;

    @Field({ nullable: true })
    CurrencyID: string | null;

    @Field(() => Float, { nullable: true })
    MRR: number | null;

    @Field(() => Float, { nullable: true })
    ARR: number | null;

    @Field(() => Int, { nullable: true })
    TermMonths: number | null;

    @Field({ nullable: true })
    ExpectedCloseDate: Date | null;

    @Field({ nullable: true })
    ActualCloseDate: Date | null;

    @Field(() => Float, { nullable: true })
    Probability: number | null;

    @Field({ nullable: true })
    ForecastCategoryTypeID: string | null;

    @Field({ nullable: true })
    LossReasonID: string | null;

    @Field({ nullable: true })
    LossNotes: string | null;

    @Field({ nullable: true })
    LeadSourceTypeID: string | null;

    @Field({ nullable: true })
    CampaignID: string | null;

    @Field({ nullable: true })
    ContractID: string | null;

    @Field({ nullable: true })
    RenewsContractID: string | null;

    @Field({ nullable: true })
    Description: string | null;

    @Field({ nullable: true })
    NextStep: string | null;

    @Field({ nullable: true })
    NextStepDate: Date | null;

    @Field({ nullable: true })
    ClosedAt: Date | null;

    @Field({ nullable: true })
    ClosedByUserID: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Deals
//****************************************************************************
@InputType()
export class UpdatemjBizAppsSalesDealInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    DealNumber?: string | null;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    PipelineID?: string;

    @Field({ nullable: true })
    PipelineStageID?: string | null;

    @Field({ nullable: true })
    DealTypeID?: string | null;

    @Field({ nullable: true })
    DealStatusTypeID?: string | null;

    @Field({ nullable: true })
    AccountID?: string | null;

    @Field({ nullable: true })
    PrimaryContactID?: string | null;

    @Field({ nullable: true })
    CompanyID?: string;

    @Field({ nullable: true })
    OwnerEmployeeID?: string | null;

    @Field(() => Float, { nullable: true })
    Amount?: number | null;

    @Field(() => Boolean, { nullable: true })
    AmountIsComputed?: boolean;

    @Field({ nullable: true })
    AmountComputedAt?: Date | null;

    @Field({ nullable: true })
    AmountSourceHash?: string | null;

    @Field({ nullable: true })
    CurrencyID?: string | null;

    @Field(() => Float, { nullable: true })
    MRR?: number | null;

    @Field(() => Float, { nullable: true })
    ARR?: number | null;

    @Field(() => Int, { nullable: true })
    TermMonths?: number | null;

    @Field({ nullable: true })
    ExpectedCloseDate?: Date | null;

    @Field({ nullable: true })
    ActualCloseDate?: Date | null;

    @Field(() => Float, { nullable: true })
    Probability?: number | null;

    @Field({ nullable: true })
    ForecastCategoryTypeID?: string | null;

    @Field({ nullable: true })
    LossReasonID?: string | null;

    @Field({ nullable: true })
    LossNotes?: string | null;

    @Field({ nullable: true })
    LeadSourceTypeID?: string | null;

    @Field({ nullable: true })
    CampaignID?: string | null;

    @Field({ nullable: true })
    ContractID?: string | null;

    @Field({ nullable: true })
    RenewsContractID?: string | null;

    @Field({ nullable: true })
    Description?: string | null;

    @Field({ nullable: true })
    NextStep?: string | null;

    @Field({ nullable: true })
    NextStepDate?: Date | null;

    @Field({ nullable: true })
    ClosedAt?: Date | null;

    @Field({ nullable: true })
    ClosedByUserID?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Sales: Deals
//****************************************************************************
@ObjectType()
export class RunmjBizAppsSalesDealViewResult {
    @Field(() => [mjBizAppsSalesDeal_])
    Results: mjBizAppsSalesDeal_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsSalesDeal_)
export class mjBizAppsSalesDealResolver extends ResolverBase {
    @Query(() => RunmjBizAppsSalesDealViewResult)
    async RunmjBizAppsSalesDealViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesDealViewResult)
    async RunmjBizAppsSalesDealViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesDealViewResult)
    async RunmjBizAppsSalesDealDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Sales: Deals';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsSalesDeal_, { nullable: true })
    async mjBizAppsSalesDeal(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsSalesDeal_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deals', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDeals')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deals', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Sales: Deals', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsSalesDealStageEvent_])
    async mjBizAppsSalesDealStageEvents_DealIDArray(@Root() mjbizappssalesdeal_: mjBizAppsSalesDeal_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deal Stage Events', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDealStageEvents')} WHERE ${provider.QuoteIdentifier('DealID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deal Stage Events', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalesdeal_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Deal Stage Events', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsSalesDealContactRole_])
    async mjBizAppsSalesDealContactRoles_DealIDArray(@Root() mjbizappssalesdeal_: mjBizAppsSalesDeal_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deal Contact Roles', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDealContactRoles')} WHERE ${provider.QuoteIdentifier('DealID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deal Contact Roles', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalesdeal_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Deal Contact Roles', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsSalesDealTeamMember_])
    async mjBizAppsSalesDealTeamMembers_DealIDArray(@Root() mjbizappssalesdeal_: mjBizAppsSalesDeal_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deal Team Members', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDealTeamMembers')} WHERE ${provider.QuoteIdentifier('DealID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deal Team Members', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalesdeal_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Deal Team Members', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsSalesDealLine_])
    async mjBizAppsSalesDealLines_DealIDArray(@Root() mjbizappssalesdeal_: mjBizAppsSalesDeal_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deal Lines', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDealLines')} WHERE ${provider.QuoteIdentifier('DealID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deal Lines', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalesdeal_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Deal Lines', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsSalesDeal_)
    async CreatemjBizAppsSalesDeal(
        @Arg('input', () => CreatemjBizAppsSalesDealInput) input: CreatemjBizAppsSalesDealInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Sales: Deals', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsSalesDeal_)
    async UpdatemjBizAppsSalesDeal(
        @Arg('input', () => UpdatemjBizAppsSalesDealInput) input: UpdatemjBizAppsSalesDealInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Sales: Deals', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsSalesDeal_)
    async DeletemjBizAppsSalesDeal(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Sales: Deals', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Sales: Forecast Category Types
//****************************************************************************
@ObjectType({ description: `How a deal rolls into the forecast (Omitted, Pipeline, Best Case, Commit, Closed). The Include* flags are read directly by the forecast measures; a query that compared a category NAME would be exactly the violation the CI grep exists to catch.` })
export class mjBizAppsSalesForecastCategoryType_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field() 
    @MaxLength(40)
    Code: string;
        
    @Field() 
    @MaxLength(200)
    Name: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field(() => Boolean) 
    IncludeInCommit: boolean;
        
    @Field(() => Boolean) 
    IncludeInBestCase: boolean;
        
    @Field(() => Boolean) 
    IncludeInPipeline: boolean;
        
    @Field(() => Int) 
    DisplayRank: number;
        
    @Field(() => Boolean) 
    IsActive: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => [mjBizAppsSalesDeal_])
    mjBizAppsSalesDeals_ForecastCategoryTypeIDArray: mjBizAppsSalesDeal_[]; // Link to mjBizAppsSalesDeals
    
    @Field(() => [mjBizAppsSalesPipelineStage_])
    mjBizAppsSalesPipelineStages_ForecastCategoryTypeIDArray: mjBizAppsSalesPipelineStage_[]; // Link to mjBizAppsSalesPipelineStages
    
    @Field(() => [mjBizAppsSalesPipeline_])
    mjBizAppsSalesPipelines_DefaultForecastCategoryTypeIDArray: mjBizAppsSalesPipeline_[]; // Link to mjBizAppsSalesPipelines
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Forecast Category Types
//****************************************************************************
@InputType()
export class CreatemjBizAppsSalesForecastCategoryTypeInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description: string | null;

    @Field(() => Boolean, { nullable: true })
    IncludeInCommit?: boolean;

    @Field(() => Boolean, { nullable: true })
    IncludeInBestCase?: boolean;

    @Field(() => Boolean, { nullable: true })
    IncludeInPipeline?: boolean;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Forecast Category Types
//****************************************************************************
@InputType()
export class UpdatemjBizAppsSalesForecastCategoryTypeInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description?: string | null;

    @Field(() => Boolean, { nullable: true })
    IncludeInCommit?: boolean;

    @Field(() => Boolean, { nullable: true })
    IncludeInBestCase?: boolean;

    @Field(() => Boolean, { nullable: true })
    IncludeInPipeline?: boolean;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Sales: Forecast Category Types
//****************************************************************************
@ObjectType()
export class RunmjBizAppsSalesForecastCategoryTypeViewResult {
    @Field(() => [mjBizAppsSalesForecastCategoryType_])
    Results: mjBizAppsSalesForecastCategoryType_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsSalesForecastCategoryType_)
export class mjBizAppsSalesForecastCategoryTypeResolver extends ResolverBase {
    @Query(() => RunmjBizAppsSalesForecastCategoryTypeViewResult)
    async RunmjBizAppsSalesForecastCategoryTypeViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesForecastCategoryTypeViewResult)
    async RunmjBizAppsSalesForecastCategoryTypeViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesForecastCategoryTypeViewResult)
    async RunmjBizAppsSalesForecastCategoryTypeDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Sales: Forecast Category Types';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsSalesForecastCategoryType_, { nullable: true })
    async mjBizAppsSalesForecastCategoryType(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsSalesForecastCategoryType_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Forecast Category Types', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwForecastCategoryTypes')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Forecast Category Types', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Sales: Forecast Category Types', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsSalesDeal_])
    async mjBizAppsSalesDeals_ForecastCategoryTypeIDArray(@Root() mjbizappssalesforecastcategorytype_: mjBizAppsSalesForecastCategoryType_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deals', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDeals')} WHERE ${provider.QuoteIdentifier('ForecastCategoryTypeID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deals', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalesforecastcategorytype_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Deals', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsSalesPipelineStage_])
    async mjBizAppsSalesPipelineStages_ForecastCategoryTypeIDArray(@Root() mjbizappssalesforecastcategorytype_: mjBizAppsSalesForecastCategoryType_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Pipeline Stages', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwPipelineStages')} WHERE ${provider.QuoteIdentifier('ForecastCategoryTypeID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Pipeline Stages', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalesforecastcategorytype_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Pipeline Stages', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsSalesPipeline_])
    async mjBizAppsSalesPipelines_DefaultForecastCategoryTypeIDArray(@Root() mjbizappssalesforecastcategorytype_: mjBizAppsSalesForecastCategoryType_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Pipelines', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwPipelines')} WHERE ${provider.QuoteIdentifier('DefaultForecastCategoryTypeID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Pipelines', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalesforecastcategorytype_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Pipelines', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsSalesForecastCategoryType_)
    async CreatemjBizAppsSalesForecastCategoryType(
        @Arg('input', () => CreatemjBizAppsSalesForecastCategoryTypeInput) input: CreatemjBizAppsSalesForecastCategoryTypeInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Sales: Forecast Category Types', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsSalesForecastCategoryType_)
    async UpdatemjBizAppsSalesForecastCategoryType(
        @Arg('input', () => UpdatemjBizAppsSalesForecastCategoryTypeInput) input: UpdatemjBizAppsSalesForecastCategoryTypeInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Sales: Forecast Category Types', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsSalesForecastCategoryType_)
    async DeletemjBizAppsSalesForecastCategoryType(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Sales: Forecast Category Types', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Sales: Forecast Snapshots
//****************************************************************************
@ObjectType({ description: `A point-in-time capture of the forecast, written by a Scheduled Job. Snapshots matter more than the live number: "what did we think on the first of the month" is the question a forecast review actually asks, and it is unanswerable after the fact without them. The live figure reads Deal; the historical one reads this table.` })
export class mjBizAppsSalesForecastSnapshot_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field() 
    @MaxLength(36)
    CompanyID: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    PipelineID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    OwnerEmployeeID?: string;
        
    @Field() 
    PeriodStart: Date;
        
    @Field() 
    PeriodEnd: Date;
        
    @Field() 
    CapturedAt: Date;
        
    @Field(() => Float, {nullable: true, description: `Total of deals in forecast categories flagged IncludeInCommit as at CapturedAt. Named CommitAmount rather than the plan's Commit because COMMIT is a reserved word in both T-SQL and PostgreSQL, and production is PostgreSQL.`}) 
    CommitAmount?: number;
        
    @Field(() => Float, {nullable: true}) 
    BestCaseAmount?: number;
        
    @Field(() => Float, {nullable: true}) 
    PipelineAmount?: number;
        
    @Field(() => Float, {nullable: true}) 
    ClosedAmount?: number;
        
    @Field({nullable: true, description: `The full breakdown behind the four bucket totals, so a snapshot can be interrogated rather than merely displayed.`}) 
    SnapshotJSON?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(50)
    Company: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Pipeline?: string;
        
    @Field({nullable: true}) 
    @MaxLength(81)
    OwnerEmployee?: string;
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Forecast Snapshots
//****************************************************************************
@InputType()
export class CreatemjBizAppsSalesForecastSnapshotInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    CompanyID?: string;

    @Field({ nullable: true })
    PipelineID: string | null;

    @Field({ nullable: true })
    OwnerEmployeeID: string | null;

    @Field({ nullable: true })
    PeriodStart?: Date;

    @Field({ nullable: true })
    PeriodEnd?: Date;

    @Field({ nullable: true })
    CapturedAt?: Date;

    @Field(() => Float, { nullable: true })
    CommitAmount: number | null;

    @Field(() => Float, { nullable: true })
    BestCaseAmount: number | null;

    @Field(() => Float, { nullable: true })
    PipelineAmount: number | null;

    @Field(() => Float, { nullable: true })
    ClosedAmount: number | null;

    @Field({ nullable: true })
    SnapshotJSON: string | null;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Forecast Snapshots
//****************************************************************************
@InputType()
export class UpdatemjBizAppsSalesForecastSnapshotInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    CompanyID?: string;

    @Field({ nullable: true })
    PipelineID?: string | null;

    @Field({ nullable: true })
    OwnerEmployeeID?: string | null;

    @Field({ nullable: true })
    PeriodStart?: Date;

    @Field({ nullable: true })
    PeriodEnd?: Date;

    @Field({ nullable: true })
    CapturedAt?: Date;

    @Field(() => Float, { nullable: true })
    CommitAmount?: number | null;

    @Field(() => Float, { nullable: true })
    BestCaseAmount?: number | null;

    @Field(() => Float, { nullable: true })
    PipelineAmount?: number | null;

    @Field(() => Float, { nullable: true })
    ClosedAmount?: number | null;

    @Field({ nullable: true })
    SnapshotJSON?: string | null;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Sales: Forecast Snapshots
//****************************************************************************
@ObjectType()
export class RunmjBizAppsSalesForecastSnapshotViewResult {
    @Field(() => [mjBizAppsSalesForecastSnapshot_])
    Results: mjBizAppsSalesForecastSnapshot_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsSalesForecastSnapshot_)
export class mjBizAppsSalesForecastSnapshotResolver extends ResolverBase {
    @Query(() => RunmjBizAppsSalesForecastSnapshotViewResult)
    async RunmjBizAppsSalesForecastSnapshotViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesForecastSnapshotViewResult)
    async RunmjBizAppsSalesForecastSnapshotViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesForecastSnapshotViewResult)
    async RunmjBizAppsSalesForecastSnapshotDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Sales: Forecast Snapshots';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsSalesForecastSnapshot_, { nullable: true })
    async mjBizAppsSalesForecastSnapshot(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsSalesForecastSnapshot_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Forecast Snapshots', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwForecastSnapshots')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Forecast Snapshots', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Sales: Forecast Snapshots', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsSalesForecastSnapshot_)
    async CreatemjBizAppsSalesForecastSnapshot(
        @Arg('input', () => CreatemjBizAppsSalesForecastSnapshotInput) input: CreatemjBizAppsSalesForecastSnapshotInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Sales: Forecast Snapshots', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsSalesForecastSnapshot_)
    async UpdatemjBizAppsSalesForecastSnapshot(
        @Arg('input', () => UpdatemjBizAppsSalesForecastSnapshotInput) input: UpdatemjBizAppsSalesForecastSnapshotInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Sales: Forecast Snapshots', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsSalesForecastSnapshot_)
    async DeletemjBizAppsSalesForecastSnapshot(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Sales: Forecast Snapshots', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Sales: Lead Source Types
//****************************************************************************
@ObjectType()
export class mjBizAppsSalesLeadSourceType_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field() 
    @MaxLength(40)
    Code: string;
        
    @Field() 
    @MaxLength(200)
    Name: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field(() => Boolean) 
    IsInbound: boolean;
        
    @Field(() => Boolean) 
    IsPaid: boolean;
        
    @Field(() => Int, {nullable: true}) 
    AttributionWindowDays?: number;
        
    @Field(() => Int) 
    DisplayRank: number;
        
    @Field(() => Boolean) 
    IsActive: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => [mjBizAppsSalesSalesAccount_])
    mjBizAppsSalesSalesAccounts_LeadSourceTypeIDArray: mjBizAppsSalesSalesAccount_[]; // Link to mjBizAppsSalesSalesAccounts
    
    @Field(() => [mjBizAppsSalesSalesContact_])
    mjBizAppsSalesSalesContacts_LeadSourceTypeIDArray: mjBizAppsSalesSalesContact_[]; // Link to mjBizAppsSalesSalesContacts
    
    @Field(() => [mjBizAppsSalesDeal_])
    mjBizAppsSalesDeals_LeadSourceTypeIDArray: mjBizAppsSalesDeal_[]; // Link to mjBizAppsSalesDeals
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Lead Source Types
//****************************************************************************
@InputType()
export class CreatemjBizAppsSalesLeadSourceTypeInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description: string | null;

    @Field(() => Boolean, { nullable: true })
    IsInbound?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsPaid?: boolean;

    @Field(() => Int, { nullable: true })
    AttributionWindowDays: number | null;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Lead Source Types
//****************************************************************************
@InputType()
export class UpdatemjBizAppsSalesLeadSourceTypeInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description?: string | null;

    @Field(() => Boolean, { nullable: true })
    IsInbound?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsPaid?: boolean;

    @Field(() => Int, { nullable: true })
    AttributionWindowDays?: number | null;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Sales: Lead Source Types
//****************************************************************************
@ObjectType()
export class RunmjBizAppsSalesLeadSourceTypeViewResult {
    @Field(() => [mjBizAppsSalesLeadSourceType_])
    Results: mjBizAppsSalesLeadSourceType_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsSalesLeadSourceType_)
export class mjBizAppsSalesLeadSourceTypeResolver extends ResolverBase {
    @Query(() => RunmjBizAppsSalesLeadSourceTypeViewResult)
    async RunmjBizAppsSalesLeadSourceTypeViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesLeadSourceTypeViewResult)
    async RunmjBizAppsSalesLeadSourceTypeViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesLeadSourceTypeViewResult)
    async RunmjBizAppsSalesLeadSourceTypeDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Sales: Lead Source Types';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsSalesLeadSourceType_, { nullable: true })
    async mjBizAppsSalesLeadSourceType(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsSalesLeadSourceType_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Lead Source Types', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwLeadSourceTypes')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Lead Source Types', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Sales: Lead Source Types', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsSalesSalesAccount_])
    async mjBizAppsSalesSalesAccounts_LeadSourceTypeIDArray(@Root() mjbizappssalesleadsourcetype_: mjBizAppsSalesLeadSourceType_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Sales Accounts', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwSalesAccounts')} WHERE ${provider.QuoteIdentifier('LeadSourceTypeID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Sales Accounts', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalesleadsourcetype_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Sales Accounts', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsSalesSalesContact_])
    async mjBizAppsSalesSalesContacts_LeadSourceTypeIDArray(@Root() mjbizappssalesleadsourcetype_: mjBizAppsSalesLeadSourceType_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Sales Contacts', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwSalesContacts')} WHERE ${provider.QuoteIdentifier('LeadSourceTypeID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Sales Contacts', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalesleadsourcetype_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Sales Contacts', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsSalesDeal_])
    async mjBizAppsSalesDeals_LeadSourceTypeIDArray(@Root() mjbizappssalesleadsourcetype_: mjBizAppsSalesLeadSourceType_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deals', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDeals')} WHERE ${provider.QuoteIdentifier('LeadSourceTypeID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deals', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalesleadsourcetype_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Deals', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsSalesLeadSourceType_)
    async CreatemjBizAppsSalesLeadSourceType(
        @Arg('input', () => CreatemjBizAppsSalesLeadSourceTypeInput) input: CreatemjBizAppsSalesLeadSourceTypeInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Sales: Lead Source Types', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsSalesLeadSourceType_)
    async UpdatemjBizAppsSalesLeadSourceType(
        @Arg('input', () => UpdatemjBizAppsSalesLeadSourceTypeInput) input: UpdatemjBizAppsSalesLeadSourceTypeInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Sales: Lead Source Types', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsSalesLeadSourceType_)
    async DeletemjBizAppsSalesLeadSourceType(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Sales: Lead Source Types', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Sales: Lifecycle Stage Types
//****************************************************************************
@ObjectType({ description: `Where a Person or Organization sits on the journey from stranger to evangelist. This table is what makes "Lead" a STAGE rather than an entity: a lead is a common.Person carrying a LifecycleStageTypeID, not a second identity table for humans.` })
export class mjBizAppsSalesLifecycleStageType_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field() 
    @MaxLength(40)
    Code: string;
        
    @Field() 
    @MaxLength(200)
    Name: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field(() => Boolean) 
    IsMarketingQualified: boolean;
        
    @Field(() => Boolean) 
    IsSalesQualified: boolean;
        
    @Field(() => Boolean) 
    IsCustomer: boolean;
        
    @Field(() => Int) 
    DisplayRank: number;
        
    @Field(() => Boolean) 
    IsActive: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => [mjBizAppsSalesSalesContact_])
    mjBizAppsSalesSalesContacts_LifecycleStageTypeIDArray: mjBizAppsSalesSalesContact_[]; // Link to mjBizAppsSalesSalesContacts
    
    @Field(() => [mjBizAppsSalesSalesAccount_])
    mjBizAppsSalesSalesAccounts_LifecycleStageTypeIDArray: mjBizAppsSalesSalesAccount_[]; // Link to mjBizAppsSalesSalesAccounts
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Lifecycle Stage Types
//****************************************************************************
@InputType()
export class CreatemjBizAppsSalesLifecycleStageTypeInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description: string | null;

    @Field(() => Boolean, { nullable: true })
    IsMarketingQualified?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsSalesQualified?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsCustomer?: boolean;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Lifecycle Stage Types
//****************************************************************************
@InputType()
export class UpdatemjBizAppsSalesLifecycleStageTypeInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description?: string | null;

    @Field(() => Boolean, { nullable: true })
    IsMarketingQualified?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsSalesQualified?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsCustomer?: boolean;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Sales: Lifecycle Stage Types
//****************************************************************************
@ObjectType()
export class RunmjBizAppsSalesLifecycleStageTypeViewResult {
    @Field(() => [mjBizAppsSalesLifecycleStageType_])
    Results: mjBizAppsSalesLifecycleStageType_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsSalesLifecycleStageType_)
export class mjBizAppsSalesLifecycleStageTypeResolver extends ResolverBase {
    @Query(() => RunmjBizAppsSalesLifecycleStageTypeViewResult)
    async RunmjBizAppsSalesLifecycleStageTypeViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesLifecycleStageTypeViewResult)
    async RunmjBizAppsSalesLifecycleStageTypeViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesLifecycleStageTypeViewResult)
    async RunmjBizAppsSalesLifecycleStageTypeDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Sales: Lifecycle Stage Types';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsSalesLifecycleStageType_, { nullable: true })
    async mjBizAppsSalesLifecycleStageType(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsSalesLifecycleStageType_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Lifecycle Stage Types', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwLifecycleStageTypes')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Lifecycle Stage Types', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Sales: Lifecycle Stage Types', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsSalesSalesContact_])
    async mjBizAppsSalesSalesContacts_LifecycleStageTypeIDArray(@Root() mjbizappssaleslifecyclestagetype_: mjBizAppsSalesLifecycleStageType_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Sales Contacts', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwSalesContacts')} WHERE ${provider.QuoteIdentifier('LifecycleStageTypeID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Sales Contacts', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssaleslifecyclestagetype_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Sales Contacts', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsSalesSalesAccount_])
    async mjBizAppsSalesSalesAccounts_LifecycleStageTypeIDArray(@Root() mjbizappssaleslifecyclestagetype_: mjBizAppsSalesLifecycleStageType_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Sales Accounts', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwSalesAccounts')} WHERE ${provider.QuoteIdentifier('LifecycleStageTypeID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Sales Accounts', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssaleslifecyclestagetype_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Sales Accounts', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsSalesLifecycleStageType_)
    async CreatemjBizAppsSalesLifecycleStageType(
        @Arg('input', () => CreatemjBizAppsSalesLifecycleStageTypeInput) input: CreatemjBizAppsSalesLifecycleStageTypeInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Sales: Lifecycle Stage Types', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsSalesLifecycleStageType_)
    async UpdatemjBizAppsSalesLifecycleStageType(
        @Arg('input', () => UpdatemjBizAppsSalesLifecycleStageTypeInput) input: UpdatemjBizAppsSalesLifecycleStageTypeInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Sales: Lifecycle Stage Types', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsSalesLifecycleStageType_)
    async DeletemjBizAppsSalesLifecycleStageType(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Sales: Lifecycle Stage Types', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Sales: Loss Reasons
//****************************************************************************
@ObjectType({ description: `Why a deal was lost. Loss reason is this app\'s ONLY mandatory field and the friction is deliberate: loss reasons are the highest-value and most consistently-skipped data in any CRM.` })
export class mjBizAppsSalesLossReason_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field() 
    @MaxLength(40)
    Code: string;
        
    @Field() 
    @MaxLength(200)
    Name: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    Category?: string;
        
    @Field(() => Boolean, {description: `When 1, Sales.CloseDeal refuses a close against this reason unless Deal.LossNotes is supplied.`}) 
    RequiresNotes: boolean;
        
    @Field(() => Boolean) 
    IsCompetitive: boolean;
        
    @Field(() => Int) 
    DisplayRank: number;
        
    @Field(() => Boolean) 
    IsActive: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => [mjBizAppsSalesDeal_])
    mjBizAppsSalesDeals_LossReasonIDArray: mjBizAppsSalesDeal_[]; // Link to mjBizAppsSalesDeals
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Loss Reasons
//****************************************************************************
@InputType()
export class CreatemjBizAppsSalesLossReasonInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description: string | null;

    @Field({ nullable: true })
    Category: string | null;

    @Field(() => Boolean, { nullable: true })
    RequiresNotes?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsCompetitive?: boolean;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Loss Reasons
//****************************************************************************
@InputType()
export class UpdatemjBizAppsSalesLossReasonInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Description?: string | null;

    @Field({ nullable: true })
    Category?: string | null;

    @Field(() => Boolean, { nullable: true })
    RequiresNotes?: boolean;

    @Field(() => Boolean, { nullable: true })
    IsCompetitive?: boolean;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Sales: Loss Reasons
//****************************************************************************
@ObjectType()
export class RunmjBizAppsSalesLossReasonViewResult {
    @Field(() => [mjBizAppsSalesLossReason_])
    Results: mjBizAppsSalesLossReason_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsSalesLossReason_)
export class mjBizAppsSalesLossReasonResolver extends ResolverBase {
    @Query(() => RunmjBizAppsSalesLossReasonViewResult)
    async RunmjBizAppsSalesLossReasonViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesLossReasonViewResult)
    async RunmjBizAppsSalesLossReasonViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesLossReasonViewResult)
    async RunmjBizAppsSalesLossReasonDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Sales: Loss Reasons';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsSalesLossReason_, { nullable: true })
    async mjBizAppsSalesLossReason(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsSalesLossReason_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Loss Reasons', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwLossReasons')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Loss Reasons', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Sales: Loss Reasons', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsSalesDeal_])
    async mjBizAppsSalesDeals_LossReasonIDArray(@Root() mjbizappssaleslossreason_: mjBizAppsSalesLossReason_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deals', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDeals')} WHERE ${provider.QuoteIdentifier('LossReasonID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deals', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssaleslossreason_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Deals', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsSalesLossReason_)
    async CreatemjBizAppsSalesLossReason(
        @Arg('input', () => CreatemjBizAppsSalesLossReasonInput) input: CreatemjBizAppsSalesLossReasonInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Sales: Loss Reasons', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsSalesLossReason_)
    async UpdatemjBizAppsSalesLossReason(
        @Arg('input', () => UpdatemjBizAppsSalesLossReasonInput) input: UpdatemjBizAppsSalesLossReasonInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Sales: Loss Reasons', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsSalesLossReason_)
    async DeletemjBizAppsSalesLossReason(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Sales: Loss Reasons', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Sales: Pipeline Stages
//****************************************************************************
@ObjectType({ description: `An ordered stage within a pipeline. Stages carry NO IsWon/IsClosed of their own — they point at a DealStatusType that does. That indirection is what makes "Closed Won" a label rather than a behaviour, and lets a pipeline call its winning stage Signed, Booked or Enrolled with no code aware of the difference.` })
export class mjBizAppsSalesPipelineStage_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field() 
    @MaxLength(36)
    PipelineID: string;
        
    @Field() 
    @MaxLength(200)
    Name: string;
        
    @Field() 
    @MaxLength(40)
    Code: string;
        
    @Field(() => Int) 
    DisplayOrder: number;
        
    @Field(() => Float, {nullable: true}) 
    Probability?: number;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    ForecastCategoryTypeID?: string;
        
    @Field({nullable: true, description: `The status a deal takes on when it ENTERS this stage. The stage names the vocabulary; the status carries the behaviour flags.`}) 
    @MaxLength(36)
    DealStatusTypeID?: string;
        
    @Field(() => Int, {nullable: true, description: `Days without activity before the board flags a deal in this stage as rotting.`}) 
    RottingDays?: number;
        
    @Field({nullable: true}) 
    EntryCriteria?: string;
        
    @Field({nullable: true, description: `Declarative JSON predicate evaluated SERVER-SIDE before a deal may leave this stage. A stage that cannot be exited without a signed mutual action plan is a config row, not a code branch.`}) 
    ExitCriteria?: string;
        
    @Field({nullable: true}) 
    RequiredFields?: string;
        
    @Field({nullable: true, description: `"What good looks like at this stage", shown in the deal workspace. Sales enablement as a config field.`}) 
    GuidanceMarkdown?: string;
        
    @Field(() => Boolean) 
    IsActive: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(200)
    Pipeline: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    ForecastCategoryType?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    DealStatusType?: string;
        
    @Field(() => [mjBizAppsSalesDealStageEvent_])
    mjBizAppsSalesDealStageEvents_FromStageIDArray: mjBizAppsSalesDealStageEvent_[]; // Link to mjBizAppsSalesDealStageEvents
    
    @Field(() => [mjBizAppsSalesDealStageEvent_])
    mjBizAppsSalesDealStageEvents_ToStageIDArray: mjBizAppsSalesDealStageEvent_[]; // Link to mjBizAppsSalesDealStageEvents
    
    @Field(() => [mjBizAppsSalesDeal_])
    mjBizAppsSalesDeals_PipelineStageIDArray: mjBizAppsSalesDeal_[]; // Link to mjBizAppsSalesDeals
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Pipeline Stages
//****************************************************************************
@InputType()
export class CreatemjBizAppsSalesPipelineStageInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    PipelineID?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field(() => Int, { nullable: true })
    DisplayOrder?: number;

    @Field(() => Float, { nullable: true })
    Probability: number | null;

    @Field({ nullable: true })
    ForecastCategoryTypeID: string | null;

    @Field({ nullable: true })
    DealStatusTypeID: string | null;

    @Field(() => Int, { nullable: true })
    RottingDays: number | null;

    @Field({ nullable: true })
    EntryCriteria: string | null;

    @Field({ nullable: true })
    ExitCriteria: string | null;

    @Field({ nullable: true })
    RequiredFields: string | null;

    @Field({ nullable: true })
    GuidanceMarkdown: string | null;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Pipeline Stages
//****************************************************************************
@InputType()
export class UpdatemjBizAppsSalesPipelineStageInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    PipelineID?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field(() => Int, { nullable: true })
    DisplayOrder?: number;

    @Field(() => Float, { nullable: true })
    Probability?: number | null;

    @Field({ nullable: true })
    ForecastCategoryTypeID?: string | null;

    @Field({ nullable: true })
    DealStatusTypeID?: string | null;

    @Field(() => Int, { nullable: true })
    RottingDays?: number | null;

    @Field({ nullable: true })
    EntryCriteria?: string | null;

    @Field({ nullable: true })
    ExitCriteria?: string | null;

    @Field({ nullable: true })
    RequiredFields?: string | null;

    @Field({ nullable: true })
    GuidanceMarkdown?: string | null;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Sales: Pipeline Stages
//****************************************************************************
@ObjectType()
export class RunmjBizAppsSalesPipelineStageViewResult {
    @Field(() => [mjBizAppsSalesPipelineStage_])
    Results: mjBizAppsSalesPipelineStage_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsSalesPipelineStage_)
export class mjBizAppsSalesPipelineStageResolver extends ResolverBase {
    @Query(() => RunmjBizAppsSalesPipelineStageViewResult)
    async RunmjBizAppsSalesPipelineStageViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesPipelineStageViewResult)
    async RunmjBizAppsSalesPipelineStageViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesPipelineStageViewResult)
    async RunmjBizAppsSalesPipelineStageDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Sales: Pipeline Stages';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsSalesPipelineStage_, { nullable: true })
    async mjBizAppsSalesPipelineStage(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsSalesPipelineStage_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Pipeline Stages', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwPipelineStages')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Pipeline Stages', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Sales: Pipeline Stages', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsSalesDealStageEvent_])
    async mjBizAppsSalesDealStageEvents_FromStageIDArray(@Root() mjbizappssalespipelinestage_: mjBizAppsSalesPipelineStage_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deal Stage Events', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDealStageEvents')} WHERE ${provider.QuoteIdentifier('FromStageID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deal Stage Events', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalespipelinestage_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Deal Stage Events', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsSalesDealStageEvent_])
    async mjBizAppsSalesDealStageEvents_ToStageIDArray(@Root() mjbizappssalespipelinestage_: mjBizAppsSalesPipelineStage_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deal Stage Events', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDealStageEvents')} WHERE ${provider.QuoteIdentifier('ToStageID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deal Stage Events', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalespipelinestage_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Deal Stage Events', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsSalesDeal_])
    async mjBizAppsSalesDeals_PipelineStageIDArray(@Root() mjbizappssalespipelinestage_: mjBizAppsSalesPipelineStage_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deals', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDeals')} WHERE ${provider.QuoteIdentifier('PipelineStageID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deals', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalespipelinestage_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Deals', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsSalesPipelineStage_)
    async CreatemjBizAppsSalesPipelineStage(
        @Arg('input', () => CreatemjBizAppsSalesPipelineStageInput) input: CreatemjBizAppsSalesPipelineStageInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Sales: Pipeline Stages', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsSalesPipelineStage_)
    async UpdatemjBizAppsSalesPipelineStage(
        @Arg('input', () => UpdatemjBizAppsSalesPipelineStageInput) input: UpdatemjBizAppsSalesPipelineStageInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Sales: Pipeline Stages', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsSalesPipelineStage_)
    async DeletemjBizAppsSalesPipelineStage(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Sales: Pipeline Stages', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Sales: Pipelines
//****************************************************************************
@ObjectType({ description: `A sales pipeline, owned by exactly one company. A company may have any number of pipelines; a pipeline may have any number of deals.` })
export class mjBizAppsSalesPipeline_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({description: `The owning company. NOT NULL by design — this is what makes every forecast and bookings rollup sliceable by company for free, and every deal inherits it. FK to __mj.Company.`}) 
    @MaxLength(36)
    CompanyID: string;
        
    @Field() 
    @MaxLength(200)
    Name: string;
        
    @Field({description: `Stable identifier, unique PER COMPANY rather than globally: two operating companies may each run a pipeline they both call NEWBIZ.`}) 
    @MaxLength(40)
    Code: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    DealTypeID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    DefaultForecastCategoryTypeID?: string;
        
    @Field(() => Boolean, {description: `Pipeline-level default for whether deals carry catalog lines (priced mode) or are header-only with a hand-entered Amount (simple mode). Overridable per deal. Partner-referral and sponsorship pipelines may never carry lines.`}) 
    RequiresDealLines: boolean;
        
    @Field({nullable: true, description: `JSON declaring the DEFAULT outcome of winning a deal in this pipeline: whether to create a contract, which contract type, where subscription lines go, where one-time lines go, and what state the resulting order lands in. A deal may override it; one remote operation (Sales.CloseDeal) reads and executes it. JSON rather than columns because the policy shape is still being learned.`}) 
    CloseWonPolicy?: string;
        
    @Field(() => Boolean) 
    IsDefault: boolean;
        
    @Field(() => Int) 
    DisplayRank: number;
        
    @Field(() => Boolean) 
    IsActive: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(50)
    Company: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    DealType?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    DefaultForecastCategoryType?: string;
        
    @Field(() => [mjBizAppsSalesDealType_])
    mjBizAppsSalesDealTypes_DefaultPipelineIDArray: mjBizAppsSalesDealType_[]; // Link to mjBizAppsSalesDealTypes
    
    @Field(() => [mjBizAppsSalesForecastSnapshot_])
    mjBizAppsSalesForecastSnapshots_PipelineIDArray: mjBizAppsSalesForecastSnapshot_[]; // Link to mjBizAppsSalesForecastSnapshots
    
    @Field(() => [mjBizAppsSalesPipelineStage_])
    mjBizAppsSalesPipelineStages_PipelineIDArray: mjBizAppsSalesPipelineStage_[]; // Link to mjBizAppsSalesPipelineStages
    
    @Field(() => [mjBizAppsSalesDeal_])
    mjBizAppsSalesDeals_PipelineIDArray: mjBizAppsSalesDeal_[]; // Link to mjBizAppsSalesDeals
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Pipelines
//****************************************************************************
@InputType()
export class CreatemjBizAppsSalesPipelineInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    CompanyID?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Description: string | null;

    @Field({ nullable: true })
    DealTypeID: string | null;

    @Field({ nullable: true })
    DefaultForecastCategoryTypeID: string | null;

    @Field(() => Boolean, { nullable: true })
    RequiresDealLines?: boolean;

    @Field({ nullable: true })
    CloseWonPolicy: string | null;

    @Field(() => Boolean, { nullable: true })
    IsDefault?: boolean;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Pipelines
//****************************************************************************
@InputType()
export class UpdatemjBizAppsSalesPipelineInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    CompanyID?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Code?: string;

    @Field({ nullable: true })
    Description?: string | null;

    @Field({ nullable: true })
    DealTypeID?: string | null;

    @Field({ nullable: true })
    DefaultForecastCategoryTypeID?: string | null;

    @Field(() => Boolean, { nullable: true })
    RequiresDealLines?: boolean;

    @Field({ nullable: true })
    CloseWonPolicy?: string | null;

    @Field(() => Boolean, { nullable: true })
    IsDefault?: boolean;

    @Field(() => Int, { nullable: true })
    DisplayRank?: number;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Sales: Pipelines
//****************************************************************************
@ObjectType()
export class RunmjBizAppsSalesPipelineViewResult {
    @Field(() => [mjBizAppsSalesPipeline_])
    Results: mjBizAppsSalesPipeline_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsSalesPipeline_)
export class mjBizAppsSalesPipelineResolver extends ResolverBase {
    @Query(() => RunmjBizAppsSalesPipelineViewResult)
    async RunmjBizAppsSalesPipelineViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesPipelineViewResult)
    async RunmjBizAppsSalesPipelineViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesPipelineViewResult)
    async RunmjBizAppsSalesPipelineDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Sales: Pipelines';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsSalesPipeline_, { nullable: true })
    async mjBizAppsSalesPipeline(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsSalesPipeline_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Pipelines', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwPipelines')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Pipelines', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Sales: Pipelines', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsSalesDealType_])
    async mjBizAppsSalesDealTypes_DefaultPipelineIDArray(@Root() mjbizappssalespipeline_: mjBizAppsSalesPipeline_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deal Types', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDealTypes')} WHERE ${provider.QuoteIdentifier('DefaultPipelineID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deal Types', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalespipeline_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Deal Types', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsSalesForecastSnapshot_])
    async mjBizAppsSalesForecastSnapshots_PipelineIDArray(@Root() mjbizappssalespipeline_: mjBizAppsSalesPipeline_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Forecast Snapshots', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwForecastSnapshots')} WHERE ${provider.QuoteIdentifier('PipelineID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Forecast Snapshots', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalespipeline_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Forecast Snapshots', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsSalesPipelineStage_])
    async mjBizAppsSalesPipelineStages_PipelineIDArray(@Root() mjbizappssalespipeline_: mjBizAppsSalesPipeline_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Pipeline Stages', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwPipelineStages')} WHERE ${provider.QuoteIdentifier('PipelineID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Pipeline Stages', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalespipeline_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Pipeline Stages', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsSalesDeal_])
    async mjBizAppsSalesDeals_PipelineIDArray(@Root() mjbizappssalespipeline_: mjBizAppsSalesPipeline_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deals', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDeals')} WHERE ${provider.QuoteIdentifier('PipelineID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deals', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalespipeline_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Deals', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsSalesPipeline_)
    async CreatemjBizAppsSalesPipeline(
        @Arg('input', () => CreatemjBizAppsSalesPipelineInput) input: CreatemjBizAppsSalesPipelineInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Sales: Pipelines', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsSalesPipeline_)
    async UpdatemjBizAppsSalesPipeline(
        @Arg('input', () => UpdatemjBizAppsSalesPipelineInput) input: UpdatemjBizAppsSalesPipelineInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Sales: Pipelines', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsSalesPipeline_)
    async DeletemjBizAppsSalesPipeline(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Sales: Pipelines', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Sales: Sales Accounts
//****************************************************************************
@ObjectType({ description: `CRM attributes for an organization we sell to. An IsA extension of __mj_BizAppsCommon.Organization sharing its UUID — the account and the organization ARE one record, so a customer that is also a vendor and a member stays one row in the Organization graph.` })
export class mjBizAppsSalesSalesAccount_ {
    @Field({description: `Same value as the parent __mj_BizAppsCommon.Organization.ID. The primary key IS the foreign key; this is not a separate surrogate identity.`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    OwnerEmployeeID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    AccountTypeID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    LifecycleStageTypeID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    LeadSourceTypeID?: string;
        
    @Field({nullable: true, description: `A LABEL, not a routing engine. Territory assignment as a rules engine is a product in its own right and is on the not-doing list.`}) 
    @MaxLength(100)
    Territory?: string;
        
    @Field({nullable: true}) 
    @MaxLength(50)
    Tier?: string;
        
    @Field(() => Int, {nullable: true}) 
    ICPFitScore?: number;
        
    @Field({nullable: true}) 
    @MaxLength(50)
    IndustryCode?: string;
        
    @Field({nullable: true, description: `A BAND, not a number, for the same reason as AnnualRevenueBand.`}) 
    @MaxLength(50)
    EmployeeCountBand?: string;
        
    @Field({nullable: true, description: `A BAND, not a number ("$1M-$5M"), on purpose. A rep's guess stored as an exact figure is false precision that later gets treated as fact.`}) 
    @MaxLength(50)
    AnnualRevenueBand?: string;
        
    @Field({nullable: true}) 
    @MaxLength(50)
    HealthStatus?: string;
        
    @Field({nullable: true}) 
    FirstClosedWonDate?: Date;
        
    @Field(() => Boolean) 
    IsActive: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(255)
    Name: string;
        
    @Field({nullable: true}) 
    @MaxLength(255)
    LegalName?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    OrganizationTypeID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    ParentID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(1000)
    Website?: string;
        
    @Field({nullable: true}) 
    @MaxLength(1000)
    LogoURL?: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field({nullable: true}) 
    @MaxLength(255)
    Email?: string;
        
    @Field({nullable: true}) 
    @MaxLength(50)
    Phone?: string;
        
    @Field({nullable: true}) 
    FoundedDate?: Date;
        
    @Field({nullable: true}) 
    @MaxLength(50)
    TaxID?: string;
        
    @Field() 
    @MaxLength(50)
    Status: string;
        
    @Field({nullable: true}) 
    @MaxLength(81)
    OwnerEmployee?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    AccountType?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    LifecycleStageType?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    LeadSourceType?: string;
        
    @Field(() => [mjBizAppsSalesDeal_])
    mjBizAppsSalesDeals_AccountIDArray: mjBizAppsSalesDeal_[]; // Link to mjBizAppsSalesDeals
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Sales Accounts
//****************************************************************************
@InputType()
export class CreatemjBizAppsSalesSalesAccountInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    OwnerEmployeeID: string | null;

    @Field({ nullable: true })
    AccountTypeID: string | null;

    @Field({ nullable: true })
    LifecycleStageTypeID: string | null;

    @Field({ nullable: true })
    LeadSourceTypeID: string | null;

    @Field({ nullable: true })
    Territory: string | null;

    @Field({ nullable: true })
    Tier: string | null;

    @Field(() => Int, { nullable: true })
    ICPFitScore: number | null;

    @Field({ nullable: true })
    IndustryCode: string | null;

    @Field({ nullable: true })
    EmployeeCountBand: string | null;

    @Field({ nullable: true })
    AnnualRevenueBand: string | null;

    @Field({ nullable: true })
    HealthStatus: string | null;

    @Field({ nullable: true })
    FirstClosedWonDate: Date | null;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    LegalName: string | null;

    @Field({ nullable: true })
    OrganizationTypeID: string | null;

    @Field({ nullable: true })
    ParentID: string | null;

    @Field({ nullable: true })
    Website: string | null;

    @Field({ nullable: true })
    LogoURL: string | null;

    @Field({ nullable: true })
    Description: string | null;

    @Field({ nullable: true })
    Email: string | null;

    @Field({ nullable: true })
    Phone: string | null;

    @Field({ nullable: true })
    FoundedDate: Date | null;

    @Field({ nullable: true })
    TaxID: string | null;

    @Field({ nullable: true })
    Status?: string;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Sales Accounts
//****************************************************************************
@InputType()
export class UpdatemjBizAppsSalesSalesAccountInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    OwnerEmployeeID?: string | null;

    @Field({ nullable: true })
    AccountTypeID?: string | null;

    @Field({ nullable: true })
    LifecycleStageTypeID?: string | null;

    @Field({ nullable: true })
    LeadSourceTypeID?: string | null;

    @Field({ nullable: true })
    Territory?: string | null;

    @Field({ nullable: true })
    Tier?: string | null;

    @Field(() => Int, { nullable: true })
    ICPFitScore?: number | null;

    @Field({ nullable: true })
    IndustryCode?: string | null;

    @Field({ nullable: true })
    EmployeeCountBand?: string | null;

    @Field({ nullable: true })
    AnnualRevenueBand?: string | null;

    @Field({ nullable: true })
    HealthStatus?: string | null;

    @Field({ nullable: true })
    FirstClosedWonDate?: Date | null;

    @Field(() => Boolean, { nullable: true })
    IsActive?: boolean;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    LegalName?: string | null;

    @Field({ nullable: true })
    OrganizationTypeID?: string | null;

    @Field({ nullable: true })
    ParentID?: string | null;

    @Field({ nullable: true })
    Website?: string | null;

    @Field({ nullable: true })
    LogoURL?: string | null;

    @Field({ nullable: true })
    Description?: string | null;

    @Field({ nullable: true })
    Email?: string | null;

    @Field({ nullable: true })
    Phone?: string | null;

    @Field({ nullable: true })
    FoundedDate?: Date | null;

    @Field({ nullable: true })
    TaxID?: string | null;

    @Field({ nullable: true })
    Status?: string;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Sales: Sales Accounts
//****************************************************************************
@ObjectType()
export class RunmjBizAppsSalesSalesAccountViewResult {
    @Field(() => [mjBizAppsSalesSalesAccount_])
    Results: mjBizAppsSalesSalesAccount_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsSalesSalesAccount_)
export class mjBizAppsSalesSalesAccountResolver extends ResolverBase {
    @Query(() => RunmjBizAppsSalesSalesAccountViewResult)
    async RunmjBizAppsSalesSalesAccountViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesSalesAccountViewResult)
    async RunmjBizAppsSalesSalesAccountViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesSalesAccountViewResult)
    async RunmjBizAppsSalesSalesAccountDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Sales: Sales Accounts';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsSalesSalesAccount_, { nullable: true })
    async mjBizAppsSalesSalesAccount(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsSalesSalesAccount_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Sales Accounts', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwSalesAccounts')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Sales Accounts', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Sales: Sales Accounts', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsSalesDeal_])
    async mjBizAppsSalesDeals_AccountIDArray(@Root() mjbizappssalessalesaccount_: mjBizAppsSalesSalesAccount_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deals', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDeals')} WHERE ${provider.QuoteIdentifier('AccountID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deals', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalessalesaccount_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Deals', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsSalesSalesAccount_)
    async CreatemjBizAppsSalesSalesAccount(
        @Arg('input', () => CreatemjBizAppsSalesSalesAccountInput) input: CreatemjBizAppsSalesSalesAccountInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Sales: Sales Accounts', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsSalesSalesAccount_)
    async UpdatemjBizAppsSalesSalesAccount(
        @Arg('input', () => UpdatemjBizAppsSalesSalesAccountInput) input: UpdatemjBizAppsSalesSalesAccountInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Sales: Sales Accounts', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsSalesSalesAccount_)
    async DeletemjBizAppsSalesSalesAccount(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Sales: Sales Accounts', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Sales: Sales Contacts
//****************************************************************************
@ObjectType({ description: `CRM attributes for a person we sell to. An IsA extension of __mj_BizAppsCommon.Person sharing its UUID. There is deliberately no Lead entity — a lead is a Person at a lifecycle stage.` })
export class mjBizAppsSalesSalesContact_ {
    @Field({description: `Same value as the parent __mj_BizAppsCommon.Person.ID. The primary key IS the foreign key.`}) 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    OwnerEmployeeID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    LifecycleStageTypeID?: string;
        
    @Field({nullable: true, description: `The contact's DEFAULT buying role. The role that matters per-deal lives on DealContactRole, because one contact holds different roles on different deals.`}) 
    @MaxLength(36)
    BuyingRoleTypeID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    LeadSourceTypeID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(50)
    Seniority?: string;
        
    @Field(() => Boolean) 
    OptedOutOfOutreach: boolean;
        
    @Field({nullable: true}) 
    @MaxLength(500)
    DoNotContactReason?: string;
        
    @Field({nullable: true}) 
    LastEngagedAt?: Date;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field() 
    @MaxLength(100)
    FirstName: string;
        
    @Field() 
    @MaxLength(100)
    LastName: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    MiddleName?: string;
        
    @Field({nullable: true}) 
    @MaxLength(20)
    Prefix?: string;
        
    @Field({nullable: true}) 
    @MaxLength(20)
    Suffix?: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    PreferredName?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Title?: string;
        
    @Field({nullable: true}) 
    @MaxLength(255)
    Email?: string;
        
    @Field({nullable: true}) 
    @MaxLength(50)
    Phone?: string;
        
    @Field({nullable: true}) 
    DateOfBirth?: Date;
        
    @Field({nullable: true}) 
    @MaxLength(50)
    Gender?: string;
        
    @Field({nullable: true}) 
    @MaxLength(1000)
    PhotoURL?: string;
        
    @Field({nullable: true}) 
    Bio?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    LinkedUserID?: string;
        
    @Field() 
    @MaxLength(50)
    Status: string;
        
    @Field({nullable: true}) 
    @MaxLength(81)
    OwnerEmployee?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    LifecycleStageType?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    BuyingRoleType?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    LeadSourceType?: string;
        
    @Field(() => [mjBizAppsSalesDeal_])
    mjBizAppsSalesDeals_PrimaryContactIDArray: mjBizAppsSalesDeal_[]; // Link to mjBizAppsSalesDeals
    
    @Field(() => [mjBizAppsSalesDealContactRole_])
    mjBizAppsSalesDealContactRoles_SalesContactIDArray: mjBizAppsSalesDealContactRole_[]; // Link to mjBizAppsSalesDealContactRoles
    
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Sales Contacts
//****************************************************************************
@InputType()
export class CreatemjBizAppsSalesSalesContactInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    OwnerEmployeeID: string | null;

    @Field({ nullable: true })
    LifecycleStageTypeID: string | null;

    @Field({ nullable: true })
    BuyingRoleTypeID: string | null;

    @Field({ nullable: true })
    LeadSourceTypeID: string | null;

    @Field({ nullable: true })
    Seniority: string | null;

    @Field(() => Boolean, { nullable: true })
    OptedOutOfOutreach?: boolean;

    @Field({ nullable: true })
    DoNotContactReason: string | null;

    @Field({ nullable: true })
    LastEngagedAt: Date | null;

    @Field({ nullable: true })
    FirstName?: string;

    @Field({ nullable: true })
    LastName?: string;

    @Field({ nullable: true })
    MiddleName: string | null;

    @Field({ nullable: true })
    Prefix: string | null;

    @Field({ nullable: true })
    Suffix: string | null;

    @Field({ nullable: true })
    PreferredName: string | null;

    @Field({ nullable: true })
    Title: string | null;

    @Field({ nullable: true })
    Email: string | null;

    @Field({ nullable: true })
    Phone: string | null;

    @Field({ nullable: true })
    DateOfBirth: Date | null;

    @Field({ nullable: true })
    Gender: string | null;

    @Field({ nullable: true })
    PhotoURL: string | null;

    @Field({ nullable: true })
    Bio: string | null;

    @Field({ nullable: true })
    LinkedUserID: string | null;

    @Field({ nullable: true })
    Status?: string;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Sales Contacts
//****************************************************************************
@InputType()
export class UpdatemjBizAppsSalesSalesContactInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    OwnerEmployeeID?: string | null;

    @Field({ nullable: true })
    LifecycleStageTypeID?: string | null;

    @Field({ nullable: true })
    BuyingRoleTypeID?: string | null;

    @Field({ nullable: true })
    LeadSourceTypeID?: string | null;

    @Field({ nullable: true })
    Seniority?: string | null;

    @Field(() => Boolean, { nullable: true })
    OptedOutOfOutreach?: boolean;

    @Field({ nullable: true })
    DoNotContactReason?: string | null;

    @Field({ nullable: true })
    LastEngagedAt?: Date | null;

    @Field({ nullable: true })
    FirstName?: string;

    @Field({ nullable: true })
    LastName?: string;

    @Field({ nullable: true })
    MiddleName?: string | null;

    @Field({ nullable: true })
    Prefix?: string | null;

    @Field({ nullable: true })
    Suffix?: string | null;

    @Field({ nullable: true })
    PreferredName?: string | null;

    @Field({ nullable: true })
    Title?: string | null;

    @Field({ nullable: true })
    Email?: string | null;

    @Field({ nullable: true })
    Phone?: string | null;

    @Field({ nullable: true })
    DateOfBirth?: Date | null;

    @Field({ nullable: true })
    Gender?: string | null;

    @Field({ nullable: true })
    PhotoURL?: string | null;

    @Field({ nullable: true })
    Bio?: string | null;

    @Field({ nullable: true })
    LinkedUserID?: string | null;

    @Field({ nullable: true })
    Status?: string;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Sales: Sales Contacts
//****************************************************************************
@ObjectType()
export class RunmjBizAppsSalesSalesContactViewResult {
    @Field(() => [mjBizAppsSalesSalesContact_])
    Results: mjBizAppsSalesSalesContact_[];

    @Field(() => String, {nullable: true})
    UserViewRunID?: string;

    @Field(() => Int, {nullable: true})
    RowCount: number;

    @Field(() => Int, {nullable: true})
    TotalRowCount: number;

    @Field(() => Int, {nullable: true})
    ExecutionTime: number;

    @Field({nullable: true})
    ErrorMessage?: string;

    @Field(() => Boolean, {nullable: false})
    Success: boolean;
}

@Resolver(mjBizAppsSalesSalesContact_)
export class mjBizAppsSalesSalesContactResolver extends ResolverBase {
    @Query(() => RunmjBizAppsSalesSalesContactViewResult)
    async RunmjBizAppsSalesSalesContactViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesSalesContactViewResult)
    async RunmjBizAppsSalesSalesContactViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesSalesContactViewResult)
    async RunmjBizAppsSalesSalesContactDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Sales: Sales Contacts';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsSalesSalesContact_, { nullable: true })
    async mjBizAppsSalesSalesContact(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsSalesSalesContact_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Sales Contacts', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwSalesContacts')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Sales Contacts', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Sales: Sales Contacts', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @FieldResolver(() => [mjBizAppsSalesDeal_])
    async mjBizAppsSalesDeals_PrimaryContactIDArray(@Root() mjbizappssalessalescontact_: mjBizAppsSalesSalesContact_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deals', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDeals')} WHERE ${provider.QuoteIdentifier('PrimaryContactID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deals', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalessalescontact_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Deals', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @FieldResolver(() => [mjBizAppsSalesDealContactRole_])
    async mjBizAppsSalesDealContactRoles_SalesContactIDArray(@Root() mjbizappssalessalescontact_: mjBizAppsSalesSalesContact_, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine) {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deal Contact Roles', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDealContactRoles')} WHERE ${provider.QuoteIdentifier('SalesContactID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deal Contact Roles', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [mjbizappssalessalescontact_.ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.ArrayMapFieldNamesToCodeNames('MJ_BizApps_Sales: Deal Contact Roles', rows, this.GetUserFromPayload(userPayload));
        return result;
    }
        
    @Mutation(() => mjBizAppsSalesSalesContact_)
    async CreatemjBizAppsSalesSalesContact(
        @Arg('input', () => CreatemjBizAppsSalesSalesContactInput) input: CreatemjBizAppsSalesSalesContactInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Sales: Sales Contacts', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsSalesSalesContact_)
    async UpdatemjBizAppsSalesSalesContact(
        @Arg('input', () => UpdatemjBizAppsSalesSalesContactInput) input: UpdatemjBizAppsSalesSalesContactInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Sales: Sales Contacts', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsSalesSalesContact_)
    async DeletemjBizAppsSalesSalesContact(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Sales: Sales Contacts', key, options, provider, userPayload, pubSub);
    }
    
}