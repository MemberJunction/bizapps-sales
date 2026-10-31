/********************************************************************************
* ALL ENTITIES - TypeGraphQL Type Class Definition - AUTO GENERATED FILE
* Generated Entities and Resolvers for Server
*
*   >>> DO NOT MODIFY THIS FILE!!!!!!!!!!!!
*   >>> YOUR CHANGES WILL BE OVERWRITTEN
*   >>> THE NEXT TIME THIS FILE IS GENERATED
*
**********************************************************************************/
import { Arg, Ctx, Int, Query, Resolver, Field, Float, ObjectType, InputType, Mutation,
            PubSub, PubSubEngine, ResolverBase, RunViewByIDInput, RunViewByNameInput, RunDynamicViewInput,
            AppContext, KeyValuePairInput, DeleteOptionsInput, GraphQLTimestamp as Timestamp,
            GetReadOnlyProvider, GetReadWriteProvider, RestoreContextInput } from '@memberjunction/server';
import { Metadata, EntityPermissionType, CompositeKey, UserInfo } from '@memberjunction/core'

import { MaxLength } from 'class-validator';
import * as mj_core_schema_server_object_types from '@memberjunction/server'


import { mjBizAppsSalesAccountTypeEntity, mjBizAppsSalesBuyingRoleTypeEntity, mjBizAppsSalesDealContactRoleEntity, mjBizAppsSalesDealPaymentScheduleEntity, mjBizAppsSalesDealRoleEntity, mjBizAppsSalesDealSequenceEntity, mjBizAppsSalesDealStageEventEntity, mjBizAppsSalesDealStatusTypeEntity, mjBizAppsSalesDealTeamMemberEntity, mjBizAppsSalesDealTypeEntity, mjBizAppsSalesDealEntity, mjBizAppsSalesForecastCategoryTypeEntity, mjBizAppsSalesForecastSnapshotEntity, mjBizAppsSalesLeadSourceTypeEntity, mjBizAppsSalesLifecycleStageTypeEntity, mjBizAppsSalesLossReasonEntity, mjBizAppsSalesPipelineStageEntity, mjBizAppsSalesPipelineEntity, mjBizAppsSalesSalesAccountEntity, mjBizAppsSalesSalesContactEntity } from '@mj-biz-apps/sales-entities';
    

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Sales: Account Types
//****************************************************************************
@ObjectType()
export class mjBizAppsSalesAccountType_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(40)
    Code?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Name?: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field(() => Boolean, {nullable: true}) 
    IsCustomer?: boolean;
        
    @Field(() => Boolean, {nullable: true}) 
    IsProspect?: boolean;
        
    @Field(() => Boolean, {nullable: true}) 
    IsPartner?: boolean;
        
    @Field(() => Int, {nullable: true}) 
    DisplayRank?: number;
        
    @Field(() => Boolean, {nullable: true}) 
    IsActive?: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
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
        
    @Field({nullable: true}) 
    @MaxLength(40)
    Code?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Name?: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field(() => Boolean, {nullable: true}) 
    IsDecisionMaker?: boolean;
        
    @Field(() => Boolean, {nullable: true}) 
    IsBlocker?: boolean;
        
    @Field(() => Float, {nullable: true}) 
    InfluenceWeight?: number;
        
    @Field(() => Int, {nullable: true}) 
    DisplayRank?: number;
        
    @Field(() => Boolean, {nullable: true}) 
    IsActive?: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
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
@ObjectType({ description: "The customer's buying team: which contact plays which role on a deal." })
export class mjBizAppsSalesDealContactRole_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    DealID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    SalesContactID?: string;
        
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
        
    @Field({nullable: true}) 
    @MaxLength(500)
    Deal?: string;
        
    @Field({nullable: true}) 
    @MaxLength(753)
    SalesContact?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    BuyingRoleType?: string;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
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
// ENTITY CLASS for MJ_BizApps_Sales: Deal Payment Schedules
//****************************************************************************
@ObjectType({ description: "Payment instalments agreed for a deal when they differ from the standard terms. A deal on standard terms has no rows here." })
export class mjBizAppsSalesDealPaymentSchedule_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    DealID?: string;
        
    @Field({nullable: true}) 
    PaymentDate?: Date;
        
    @Field(() => Float, {nullable: true, description: "The instalment amount as agreed. Can be negative for a refund or credit."}) 
    Amount?: number;
        
    @Field({nullable: true}) 
    @MaxLength(1000)
    Description?: string;
        
    @Field(() => Int, {nullable: true, description: "Position of the instalment in the schedule, for instalments that share a date or have none yet."}) 
    DisplayOrder?: number;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field({nullable: true}) 
    @MaxLength(500)
    Deal?: string;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Deal Payment Schedules
//****************************************************************************
@InputType()
export class CreatemjBizAppsSalesDealPaymentScheduleInput {
    @Field({ nullable: true })
    ID?: string;

    @Field({ nullable: true })
    DealID?: string;

    @Field({ nullable: true })
    PaymentDate: Date | null;

    @Field(() => Float, { nullable: true })
    Amount: number | null;

    @Field({ nullable: true })
    Description: string | null;

    @Field(() => Int, { nullable: true })
    DisplayOrder?: number;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Deal Payment Schedules
//****************************************************************************
@InputType()
export class UpdatemjBizAppsSalesDealPaymentScheduleInput {
    @Field()
    ID: string;

    @Field({ nullable: true })
    DealID?: string;

    @Field({ nullable: true })
    PaymentDate?: Date | null;

    @Field(() => Float, { nullable: true })
    Amount?: number | null;

    @Field({ nullable: true })
    Description?: string | null;

    @Field(() => Int, { nullable: true })
    DisplayOrder?: number;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Sales: Deal Payment Schedules
//****************************************************************************
@ObjectType()
export class RunmjBizAppsSalesDealPaymentScheduleViewResult {
    @Field(() => [mjBizAppsSalesDealPaymentSchedule_])
    Results: mjBizAppsSalesDealPaymentSchedule_[];

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

@Resolver(mjBizAppsSalesDealPaymentSchedule_)
export class mjBizAppsSalesDealPaymentScheduleResolver extends ResolverBase {
    @Query(() => RunmjBizAppsSalesDealPaymentScheduleViewResult)
    async RunmjBizAppsSalesDealPaymentScheduleViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesDealPaymentScheduleViewResult)
    async RunmjBizAppsSalesDealPaymentScheduleViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesDealPaymentScheduleViewResult)
    async RunmjBizAppsSalesDealPaymentScheduleDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Sales: Deal Payment Schedules';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsSalesDealPaymentSchedule_, { nullable: true })
    async mjBizAppsSalesDealPaymentSchedule(@Arg('ID', () => String) ID: string, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsSalesDealPaymentSchedule_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deal Payment Schedules', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDealPaymentSchedules')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deal Payment Schedules', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Sales: Deal Payment Schedules', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsSalesDealPaymentSchedule_)
    async CreatemjBizAppsSalesDealPaymentSchedule(
        @Arg('input', () => CreatemjBizAppsSalesDealPaymentScheduleInput) input: CreatemjBizAppsSalesDealPaymentScheduleInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Sales: Deal Payment Schedules', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsSalesDealPaymentSchedule_)
    async UpdatemjBizAppsSalesDealPaymentSchedule(
        @Arg('input', () => UpdatemjBizAppsSalesDealPaymentScheduleInput) input: UpdatemjBizAppsSalesDealPaymentScheduleInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Sales: Deal Payment Schedules', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsSalesDealPaymentSchedule_)
    async DeletemjBizAppsSalesDealPaymentSchedule(@Arg('ID', () => String) ID: string, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Sales: Deal Payment Schedules', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Sales: Deal Roles
//****************************************************************************
@ObjectType({ description: "The roles internal people hold on a deal (Owner/AE, Sales Engineer, SDR, Executive Sponsor, Partner Manager, CS Lead)." })
export class mjBizAppsSalesDealRole_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(40)
    Code?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Name?: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field(() => Boolean, {nullable: true, description: "Marks the role that owns the deal. Only one team member per deal can hold it, and that person is shown as the deal's owner."}) 
    IsOwnerRole?: boolean;
        
    @Field(() => Boolean, {nullable: true, description: "Whether more than one person can hold this role on the same deal, for example two sales engineers."}) 
    AllowsMultiplePerDeal?: boolean;
        
    @Field(() => Float, {nullable: true}) 
    DefaultAttributionPct?: number;
        
    @Field(() => Boolean, {nullable: true}) 
    IsQuotaCarrying?: boolean;
        
    @Field(() => Int, {nullable: true}) 
    DisplayRank?: number;
        
    @Field(() => Boolean, {nullable: true}) 
    IsActive?: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
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
// ENTITY CLASS for MJ_BizApps_Sales: Deal Sequences
//****************************************************************************
@ObjectType()
export class mjBizAppsSalesDealSequence_ {
    @Field(() => Int) 
    ID: number;
        
    @Field(() => Int, {nullable: true}) 
    NextSequenceNumber?: number;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
}

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Deal Sequences
//****************************************************************************
@InputType()
export class CreatemjBizAppsSalesDealSequenceInput {
    @Field(() => Int, { nullable: true })
    ID?: number;

    @Field(() => Int, { nullable: true })
    NextSequenceNumber?: number;

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    

//****************************************************************************
// INPUT TYPE for MJ_BizApps_Sales: Deal Sequences
//****************************************************************************
@InputType()
export class UpdatemjBizAppsSalesDealSequenceInput {
    @Field(() => Int)
    ID: number;

    @Field(() => Int, { nullable: true })
    NextSequenceNumber?: number;

    @Field(() => [KeyValuePairInput], { nullable: true })
    OldValues___?: KeyValuePairInput[];

    @Field(() => RestoreContextInput, { nullable: true })
    RestoreContext___?: RestoreContextInput;
}
    
//****************************************************************************
// RESOLVER for MJ_BizApps_Sales: Deal Sequences
//****************************************************************************
@ObjectType()
export class RunmjBizAppsSalesDealSequenceViewResult {
    @Field(() => [mjBizAppsSalesDealSequence_])
    Results: mjBizAppsSalesDealSequence_[];

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

@Resolver(mjBizAppsSalesDealSequence_)
export class mjBizAppsSalesDealSequenceResolver extends ResolverBase {
    @Query(() => RunmjBizAppsSalesDealSequenceViewResult)
    async RunmjBizAppsSalesDealSequenceViewByID(@Arg('input', () => RunViewByIDInput) input: RunViewByIDInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByIDGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesDealSequenceViewResult)
    async RunmjBizAppsSalesDealSequenceViewByName(@Arg('input', () => RunViewByNameInput) input: RunViewByNameInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        return super.RunViewByNameGeneric(input, provider, userPayload, pubSub);
    }

    @Query(() => RunmjBizAppsSalesDealSequenceViewResult)
    async RunmjBizAppsSalesDealSequenceDynamicView(@Arg('input', () => RunDynamicViewInput) input: RunDynamicViewInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        input.EntityName = 'MJ_BizApps_Sales: Deal Sequences';
        return super.RunDynamicViewGeneric(input, provider, userPayload, pubSub);
    }
    @Query(() => mjBizAppsSalesDealSequence_, { nullable: true })
    async mjBizAppsSalesDealSequence(@Arg('ID', () => Int) ID: number, @Ctx() { userPayload, providers }: AppContext, @PubSub() pubSub: PubSubEngine): Promise<mjBizAppsSalesDealSequence_ | null> {
        this.CheckUserReadPermissions('MJ_BizApps_Sales: Deal Sequences', userPayload);
        const provider = GetReadOnlyProvider(providers, { allowFallbackToReadWrite: true });
        const sSQL = `SELECT * FROM ${provider.QuoteSchemaAndView('__mj_BizAppsSales', 'vwDealSequences')} WHERE ${provider.QuoteIdentifier('ID')}=${provider.BuildParameterPlaceholder(0)} ` + this.getRowLevelSecurityWhereClause(provider, 'MJ_BizApps_Sales: Deal Sequences', userPayload, EntityPermissionType.Read, 'AND');
        const rows = await provider.ExecuteSQL(sSQL, [ID], undefined, this.GetUserFromPayload(userPayload));
        const result = await this.MapFieldNamesToCodeNames('MJ_BizApps_Sales: Deal Sequences', rows && rows.length > 0 ? rows[0] : null, this.GetUserFromPayload(userPayload));
        return result;
    }
    
    @Mutation(() => mjBizAppsSalesDealSequence_)
    async CreatemjBizAppsSalesDealSequence(
        @Arg('input', () => CreatemjBizAppsSalesDealSequenceInput) input: CreatemjBizAppsSalesDealSequenceInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.CreateRecord('MJ_BizApps_Sales: Deal Sequences', input, provider, userPayload, pubSub)
    }
        
    @Mutation(() => mjBizAppsSalesDealSequence_)
    async UpdatemjBizAppsSalesDealSequence(
        @Arg('input', () => UpdatemjBizAppsSalesDealSequenceInput) input: UpdatemjBizAppsSalesDealSequenceInput,
        @Ctx() { providers, userPayload }: AppContext,
        @PubSub() pubSub: PubSubEngine
    ) {
        const provider = GetReadWriteProvider(providers);
        return this.UpdateRecord('MJ_BizApps_Sales: Deal Sequences', input, provider, userPayload, pubSub);
    }
    
    @Mutation(() => mjBizAppsSalesDealSequence_)
    async DeletemjBizAppsSalesDealSequence(@Arg('ID', () => Int) ID: number, @Arg('options___', () => DeleteOptionsInput) options: DeleteOptionsInput, @Ctx() { providers, userPayload }: AppContext, @PubSub() pubSub: PubSubEngine) {
        const provider = GetReadWriteProvider(providers);
        const key = new CompositeKey([{FieldName: 'ID', Value: ID}]);
        return this.DeleteRecord('MJ_BizApps_Sales: Deal Sequences', key, options, provider, userPayload, pubSub);
    }
    
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Sales: Deal Stage Events
//****************************************************************************
@ObjectType({ description: "A record of a deal moving from one stage to another, with the amount and probability at that moment. These rows are never edited." })
export class mjBizAppsSalesDealStageEvent_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    DealID?: string;
        
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
        
    @Field({nullable: true, description: "When the stage change happened. For imported deals this is the original date, not the import date."}) 
    ChangedAt?: Date;
        
    @Field(() => Int, {nullable: true}) 
    DaysInPreviousStage?: number;
        
    @Field(() => Float, {nullable: true, description: "The deal amount at the time of this stage change."}) 
    AmountAtTransition?: number;
        
    @Field(() => Boolean, {nullable: true, description: "On when the amount at this stage change was the order total, off when it was entered by hand. Empty for changes recorded before this was tracked."}) 
    AmountAtTransitionIsComputed?: boolean;
        
    @Field(() => Float, {nullable: true}) 
    ProbabilityAtTransition?: number;
        
    @Field({nullable: true}) 
    Notes?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field({nullable: true}) 
    @MaxLength(500)
    Deal?: string;
        
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
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
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

    @Field(() => Boolean, { nullable: true })
    AmountAtTransitionIsComputed: boolean | null;

    @Field(() => Float, { nullable: true })
    ProbabilityAtTransition: number | null;

    @Field({ nullable: true })
    Notes: string | null;

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
        
}

//****************************************************************************
// ENTITY CLASS for MJ_BizApps_Sales: Deal Status Types
//****************************************************************************
@ObjectType({ description: "The outcomes a deal can be in, such as Open, Won, Lost or On Hold. The flags on each status decide how a deal in it behaves." })
export class mjBizAppsSalesDealStatusType_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true, description: "Short fixed identifier for the status. Renaming the status is safe; changing its code is not."}) 
    @MaxLength(40)
    Code?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Name?: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field(() => Boolean, {nullable: true}) 
    IsOpen?: boolean;
        
    @Field(() => Boolean, {nullable: true}) 
    IsClosed?: boolean;
        
    @Field(() => Boolean, {nullable: true}) 
    IsWon?: boolean;
        
    @Field(() => Boolean, {nullable: true}) 
    IsLost?: boolean;
        
    @Field(() => Boolean, {nullable: true, description: "When on, a deal in this status is locked until it is reopened: its lines, payment schedule, team and every field except Description and Next Step become read-only."}) 
    LocksDeal?: boolean;
        
    @Field(() => Int, {nullable: true}) 
    DisplayRank?: number;
        
    @Field(() => Boolean, {nullable: true}) 
    IsActive?: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
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
@ObjectType({ description: "The internal people on a deal and the role each holds, including the owner. Totals by rep must count only the owner role or weight by attribution, or a deal is counted once per member." })
export class mjBizAppsSalesDealTeamMember_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    DealID?: string;
        
    @Field({nullable: true, description: "The team member, when they are an employee. Set this or Person, not both."}) 
    @MaxLength(36)
    EmployeeID?: string;
        
    @Field({nullable: true, description: "The team member, when they are not an employee, such as a partner rep. Set this or Employee, not both."}) 
    @MaxLength(36)
    PersonID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    DealRoleID?: string;
        
    @Field(() => Float, {nullable: true, description: "This member's share of the deal for by-rep rollups. When any member of a deal has a value set, the app validates that active members sum to 100. Leave NULL to fall back to owner-role attribution."}) 
    AttributionPct?: number;
        
    @Field({nullable: true}) 
    StartDate?: Date;
        
    @Field({nullable: true}) 
    EndDate?: Date;
        
    @Field(() => Boolean, {nullable: true}) 
    IsActive?: boolean;
        
    @Field({nullable: true}) 
    Notes?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field({nullable: true}) 
    @MaxLength(500)
    Deal?: string;
        
    @Field({nullable: true}) 
    @MaxLength(81)
    Employee?: string;
        
    @Field({nullable: true}) 
    @MaxLength(250)
    Person?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    DealRole?: string;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
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
        
    @Field({nullable: true}) 
    @MaxLength(40)
    Code?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Name?: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field(() => Boolean, {nullable: true}) 
    RequiresContract?: boolean;
        
    @Field(() => Boolean, {nullable: true}) 
    RequiresRenewalSource?: boolean;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    DefaultPipelineID?: string;
        
    @Field(() => Int, {nullable: true}) 
    DisplayRank?: number;
        
    @Field(() => Boolean, {nullable: true}) 
    IsActive?: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    DefaultPipeline?: string;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
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
@ObjectType({ description: "A sales opportunity with an account. Its amount comes from the deal's order, and winning it follows the pipeline's close-won policy." })
export class mjBizAppsSalesDeal_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(50)
    DealNumber?: string;
        
    @Field({nullable: true}) 
    @MaxLength(500)
    Name?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    PipelineID?: string;
        
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
        
    @Field({nullable: true, description: "The contact who receives the invoice. Leave empty to use the primary contact."}) 
    @MaxLength(36)
    BillingContactID?: string;
        
    @Field({nullable: true, description: "The company selling the deal. It must match the pipeline's company."}) 
    @MaxLength(36)
    CompanyID?: string;
        
    @Field({nullable: true, description: "The deal owner: the team member in the owner role. Updated automatically from the deal team."}) 
    @MaxLength(36)
    OwnerEmployeeID?: string;
        
    @Field(() => Float, {nullable: true, description: "The deal value. For a deal with product lines it is the order total calculated by Orders; for a deal without lines it is entered by hand."}) 
    Amount?: number;
        
    @Field(() => Boolean, {nullable: true, description: "On when Amount is the order total calculated by Orders; off when it was entered by hand."}) 
    AmountIsComputed?: boolean;
        
    @Field({nullable: true}) 
    AmountComputedAt?: Date;
        
    @Field({nullable: true, description: "Fingerprint of the order lines the amount was calculated from, used to tell when the amount is out of date."}) 
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
        
    @Field(() => Int, {nullable: true, description: "Estimated project length in weeks, from the statement of work. It does not affect the term or renewal dates."}) 
    EstimatedProjectWeeks?: number;
        
    @Field({nullable: true, description: "The date the agreement was signed. It can be after the start date when work begins before signature."}) 
    ExecutionDate?: Date;
        
    @Field({nullable: true, description: "The date the service or subscription begins. It can be before the execution date."}) 
    StartDate?: Date;
        
    @Field({nullable: true, description: "The day the deal is expected to close. Update it as the date moves; the actual close date is set when the deal is closed."}) 
    ExpectedCloseDate?: Date;
        
    @Field({nullable: true, description: "The business day the deal closed on, in its company's time zone. Set by closing the deal and cleared by reopening it; it cannot be edited. For when an open deal is expected to close, use Expected Close Date."}) 
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
        
    @Field({nullable: true, description: "The contract this deal belongs to, in BizApps Contracts."}) 
    @MaxLength(36)
    ContractID?: string;
        
    @Field({nullable: true, description: "The contract this deal renews. Required for deal types that are renewals."}) 
    @MaxLength(36)
    RenewsContractID?: string;
        
    @Field(() => Boolean, {nullable: true, description: "Whether the resulting agreement renews automatically at the end of its term."}) 
    AutoRenew?: boolean;
        
    @Field(() => Float, {nullable: true, description: "Annual price increase agreed for this deal, as a percent. Leave empty to use the contract type's standard increase."}) 
    AnnualIncreasePctOverride?: number;
        
    @Field(() => Int, {nullable: true, description: "Cancellation notice period agreed for this deal, in days. Leave empty to use the contract type's standard notice period."}) 
    CancellationNoticeDaysOverride?: number;
        
    @Field({nullable: true, description: "How the customer expects to pay, for example ACH. For reference only."}) 
    @MaxLength(50)
    PaymentMethod?: string;
        
    @Field(() => Boolean, {nullable: true, description: "Whether the deal moved off the standard agreement. Copied to the contract when the deal is won, where it tells finance to review the changes."}) 
    StandardAgreementModified?: boolean;
        
    @Field({nullable: true, description: "Summary of the terms negotiated away from the standard agreement, for legal review."}) 
    ContractVariances?: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field({nullable: true}) 
    @MaxLength(1000)
    NextStep?: string;
        
    @Field({nullable: true}) 
    NextStepDate?: Date;
        
    @Field({nullable: true, description: "The moment the deal was closed. Set by closing the deal and cleared by reopening it; it cannot be edited. For when an open deal is expected to close, use Expected Close Date."}) 
    ClosedAt?: Date;
        
    @Field({nullable: true, description: "The user who closed the deal. Set by closing the deal and cleared by reopening it; it cannot be edited."}) 
    @MaxLength(36)
    ClosedByUserID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    OrderID?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => Float, {nullable: true, description: "0.0000 to 1.0000 probability that the deal will close as Won."}) 
    PredictedWinProbability?: number;
        
    @Field({nullable: true, description: "Categorical priority/risk tier derived from deal win probability: Low, Medium, High, Critical."}) 
    @MaxLength(20)
    PredictedWinRiskBand?: string;
        
    @Field({nullable: true, description: "Timestamp when the deal was last scored by the predictive deal win propensity model."}) 
    PredictedWinScoredAt?: Date;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Pipeline?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    PipelineStage?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    DealType?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    DealStatusType?: string;
        
    @Field({nullable: true}) 
    @MaxLength(255)
    Account?: string;
        
    @Field({nullable: true}) 
    @MaxLength(753)
    PrimaryContact?: string;
        
    @Field({nullable: true}) 
    @MaxLength(753)
    BillingContact?: string;
        
    @Field({nullable: true}) 
    @MaxLength(50)
    Company?: string;
        
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
        
    @Field({nullable: true}) 
    @MaxLength(40)
    Order?: string;
        
    @Field(() => Int, {nullable: true}) 
    WinOutcome?: number;
        
    @Field(() => Int, {nullable: true}) 
    DaysToExpectedClose?: number;
        
    @Field(() => Int, {nullable: true}) 
    HasPaymentSchedule?: number;
        
    @Field(() => Int, {nullable: true}) 
    TeamMemberCount?: number;
        
    @Field(() => Int, {nullable: true}) 
    HasPartnerInvolved?: number;
        
    @Field(() => Int, {nullable: true}) 
    IsEnterpriseTier?: number;
        
    @Field(() => Int, {nullable: true}) 
    AutoRenewFlag?: number;
        
    @Field(() => Int, {nullable: true}) 
    StandardAgreementModifiedFlag?: number;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
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
    BillingContactID: string | null;

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

    @Field(() => Int, { nullable: true })
    EstimatedProjectWeeks: number | null;

    @Field({ nullable: true })
    ExecutionDate: Date | null;

    @Field({ nullable: true })
    StartDate: Date | null;

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

    @Field(() => Boolean, { nullable: true })
    AutoRenew?: boolean;

    @Field(() => Float, { nullable: true })
    AnnualIncreasePctOverride: number | null;

    @Field(() => Int, { nullable: true })
    CancellationNoticeDaysOverride: number | null;

    @Field({ nullable: true })
    PaymentMethod?: string | null;

    @Field(() => Boolean, { nullable: true })
    StandardAgreementModified?: boolean;

    @Field({ nullable: true })
    ContractVariances: string | null;

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

    @Field({ nullable: true })
    OrderID: string | null;

    @Field(() => Float, { nullable: true })
    PredictedWinProbability: number | null;

    @Field({ nullable: true })
    PredictedWinRiskBand: string | null;

    @Field({ nullable: true })
    PredictedWinScoredAt: Date | null;

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
    BillingContactID?: string | null;

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

    @Field(() => Int, { nullable: true })
    EstimatedProjectWeeks?: number | null;

    @Field({ nullable: true })
    ExecutionDate?: Date | null;

    @Field({ nullable: true })
    StartDate?: Date | null;

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

    @Field(() => Boolean, { nullable: true })
    AutoRenew?: boolean;

    @Field(() => Float, { nullable: true })
    AnnualIncreasePctOverride?: number | null;

    @Field(() => Int, { nullable: true })
    CancellationNoticeDaysOverride?: number | null;

    @Field({ nullable: true })
    PaymentMethod?: string | null;

    @Field(() => Boolean, { nullable: true })
    StandardAgreementModified?: boolean;

    @Field({ nullable: true })
    ContractVariances?: string | null;

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

    @Field({ nullable: true })
    OrderID?: string | null;

    @Field(() => Float, { nullable: true })
    PredictedWinProbability?: number | null;

    @Field({ nullable: true })
    PredictedWinRiskBand?: string | null;

    @Field({ nullable: true })
    PredictedWinScoredAt?: Date | null;

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
@ObjectType({ description: "How a deal counts in the forecast: Omitted, Pipeline, Best Case, Commit or Closed. The Include flags on each category decide which forecast totals it adds to." })
export class mjBizAppsSalesForecastCategoryType_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(40)
    Code?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Name?: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field(() => Boolean, {nullable: true}) 
    IncludeInCommit?: boolean;
        
    @Field(() => Boolean, {nullable: true}) 
    IncludeInBestCase?: boolean;
        
    @Field(() => Boolean, {nullable: true}) 
    IncludeInPipeline?: boolean;
        
    @Field(() => Int, {nullable: true}) 
    DisplayRank?: number;
        
    @Field(() => Boolean, {nullable: true}) 
    IsActive?: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
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
@ObjectType({ description: "The forecast for a pipeline and owner as captured on a given day, so past forecasts can be compared with today's." })
export class mjBizAppsSalesForecastSnapshot_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    CompanyID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    PipelineID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    OwnerEmployeeID?: string;
        
    @Field({nullable: true}) 
    PeriodStart?: Date;
        
    @Field({nullable: true}) 
    PeriodEnd?: Date;
        
    @Field({nullable: true}) 
    CapturedAt?: Date;
        
    @Field(() => Float, {nullable: true, description: "Total of deals in commit forecast categories when the snapshot was taken."}) 
    CommitAmount?: number;
        
    @Field(() => Float, {nullable: true}) 
    BestCaseAmount?: number;
        
    @Field(() => Float, {nullable: true}) 
    PipelineAmount?: number;
        
    @Field(() => Float, {nullable: true}) 
    ClosedAmount?: number;
        
    @Field({nullable: true, description: "The detail behind the snapshot's totals, stored as JSON."}) 
    SnapshotJSON?: string;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field({nullable: true}) 
    @MaxLength(50)
    Company?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Pipeline?: string;
        
    @Field({nullable: true}) 
    @MaxLength(81)
    OwnerEmployee?: string;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
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
        
    @Field({nullable: true}) 
    @MaxLength(40)
    Code?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Name?: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field(() => Boolean, {nullable: true}) 
    IsInbound?: boolean;
        
    @Field(() => Boolean, {nullable: true}) 
    IsPaid?: boolean;
        
    @Field(() => Int, {nullable: true}) 
    AttributionWindowDays?: number;
        
    @Field(() => Int, {nullable: true}) 
    DisplayRank?: number;
        
    @Field(() => Boolean, {nullable: true}) 
    IsActive?: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
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
@ObjectType({ description: "Where a person or organization is in the customer journey, from Subscriber to Customer. A lead is a contact at the Lead stage, not a separate record." })
export class mjBizAppsSalesLifecycleStageType_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(40)
    Code?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Name?: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field(() => Boolean, {nullable: true}) 
    IsMarketingQualified?: boolean;
        
    @Field(() => Boolean, {nullable: true}) 
    IsSalesQualified?: boolean;
        
    @Field(() => Boolean, {nullable: true}) 
    IsCustomer?: boolean;
        
    @Field(() => Int, {nullable: true}) 
    DisplayRank?: number;
        
    @Field(() => Boolean, {nullable: true}) 
    IsActive?: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
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
@ObjectType({ description: "Why a deal was lost. Closing a deal as lost requires one." })
export class mjBizAppsSalesLossReason_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(40)
    Code?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Name?: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    Category?: string;
        
    @Field(() => Boolean, {nullable: true, description: "When on, a deal closed as lost with this reason must also have loss notes."}) 
    RequiresNotes?: boolean;
        
    @Field(() => Boolean, {nullable: true}) 
    IsCompetitive?: boolean;
        
    @Field(() => Int, {nullable: true}) 
    DisplayRank?: number;
        
    @Field(() => Boolean, {nullable: true}) 
    IsActive?: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
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
@ObjectType({ description: "An ordered stage within a pipeline. Each stage sets the status a deal takes on when it enters the stage." })
export class mjBizAppsSalesPipelineStage_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    PipelineID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Name?: string;
        
    @Field({nullable: true}) 
    @MaxLength(40)
    Code?: string;
        
    @Field(() => Int, {nullable: true}) 
    DisplayOrder?: number;
        
    @Field(() => Float, {nullable: true}) 
    Probability?: number;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    ForecastCategoryTypeID?: string;
        
    @Field({nullable: true, description: "The status a deal takes on when it enters this stage."}) 
    @MaxLength(36)
    DealStatusTypeID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(20)
    OrderStatusOnEntry?: string;
        
    @Field(() => Int, {nullable: true, description: "Days without activity before the board flags a deal in this stage as rotting."}) 
    RottingDays?: number;
        
    @Field({nullable: true}) 
    EntryCriteria?: string;
        
    @Field({nullable: true, description: "Conditions for leaving this stage, stored as JSON for reference. The app does not check them."}) 
    ExitCriteria?: string;
        
    @Field({nullable: true}) 
    RequiredFields?: string;
        
    @Field({nullable: true, description: "Guidance for reps on what a deal should have at this stage, in Markdown."}) 
    GuidanceMarkdown?: string;
        
    @Field(() => Boolean, {nullable: true}) 
    IsActive?: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Pipeline?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    ForecastCategoryType?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    DealStatusType?: string;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
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

    @Field({ nullable: true })
    OrderStatusOnEntry: string | null;

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

    @Field({ nullable: true })
    OrderStatusOnEntry?: string | null;

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
@ObjectType({ description: "A sales pipeline, owned by exactly one company. A company may have any number of pipelines; a pipeline may have any number of deals." })
export class mjBizAppsSalesPipeline_ {
    @Field() 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true, description: "The company that owns this pipeline. Every deal in the pipeline belongs to this company."}) 
    @MaxLength(36)
    CompanyID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    Name?: string;
        
    @Field({nullable: true, description: "Short identifier for the pipeline, unique within its company."}) 
    @MaxLength(40)
    Code?: string;
        
    @Field({nullable: true}) 
    Description?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    DealTypeID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    DefaultForecastCategoryTypeID?: string;
        
    @Field(() => Boolean, {nullable: true, description: "Whether deals in this pipeline carry product lines priced by Orders, or a single amount entered by hand."}) 
    RequiresDealLines?: boolean;
        
    @Field({nullable: true, description: "What happens when a deal in this pipeline is won, stored as JSON: whether a contract is created and of which type, and which follow-up tasks are raised."}) 
    CloseWonPolicy?: string;
        
    @Field(() => Boolean, {nullable: true}) 
    IsDefault?: boolean;
        
    @Field(() => Int, {nullable: true}) 
    DisplayRank?: number;
        
    @Field(() => Boolean, {nullable: true}) 
    IsActive?: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field(() => Boolean, {nullable: true, description: "Whether open deals in this pipeline count toward open and weighted pipeline, the forecast buckets and the dashboard's open-deal figures. Set to 0 for a pipeline that only holds historical deals. Closed deals count toward bookings, win rate and other history regardless."}) 
    IncludeInForecast?: boolean;
        
    @Field({nullable: true, description: "Person who receives the Order Review and Contract Processing tasks raised when a deal on this pipeline closes Won. Set per deployment; the app's metadata never sets it, so an upgrade keeps it. Takes precedence over CloseWonTasks.AssigneeRecordID in Close Won Policy. Empty means that policy value is used, and when both are empty the tasks are created but not assigned."}) 
    @MaxLength(36)
    CloseWonAssigneePersonID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(50)
    Company?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    DealType?: string;
        
    @Field({nullable: true}) 
    @MaxLength(200)
    DefaultForecastCategoryType?: string;
        
    @Field({nullable: true}) 
    @MaxLength(250)
    CloseWonAssigneePerson?: string;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
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

    @Field(() => Boolean, { nullable: true })
    IncludeInForecast?: boolean;

    @Field({ nullable: true })
    CloseWonAssigneePersonID: string | null;

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

    @Field(() => Boolean, { nullable: true })
    IncludeInForecast?: boolean;

    @Field({ nullable: true })
    CloseWonAssigneePersonID?: string | null;

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
@ObjectType({ description: "Sales details for an organization you sell to. The account and its organization are one record." })
export class mjBizAppsSalesSalesAccount_ {
    @Field({description: "The account's ID, the same as its organization's ID."}) 
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
        
    @Field({nullable: true, description: "Sales territory label for the account. It is not used to route or assign accounts."}) 
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
        
    @Field({nullable: true, description: "Approximate number of employees as a range, for example 50-200."}) 
    @MaxLength(50)
    EmployeeCountBand?: string;
        
    @Field({nullable: true, description: "Approximate annual revenue as a range, for example $1M-$5M."}) 
    @MaxLength(50)
    AnnualRevenueBand?: string;
        
    @Field({nullable: true}) 
    @MaxLength(50)
    HealthStatus?: string;
        
    @Field({nullable: true}) 
    FirstClosedWonDate?: Date;
        
    @Field(() => Boolean, {nullable: true}) 
    IsActive?: boolean;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field({nullable: true, description: "Contact a new deal for this account starts with as its Primary Contact. Copied onto a deal only when the deal's Primary Contact is empty; the deal's value stays editable."}) 
    @MaxLength(36)
    DefaultPrimaryContactID?: string;
        
    @Field({nullable: true, description: "Contact a new deal for this account starts with as its Billing Contact. Copied onto a deal only when the deal's Billing Contact is empty; the deal's value stays editable. Empty means the deal's billing contact follows its primary contact."}) 
    @MaxLength(36)
    DefaultBillingContactID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(255)
    Name?: string;
        
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
        
    @Field({nullable: true}) 
    @MaxLength(50)
    Status?: string;
        
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
        
    @Field({nullable: true}) 
    @MaxLength(753)
    DefaultPrimaryContact?: string;
        
    @Field({nullable: true}) 
    @MaxLength(753)
    DefaultBillingContact?: string;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
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
    DefaultPrimaryContactID: string | null;

    @Field({ nullable: true })
    DefaultBillingContactID: string | null;

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
    DefaultPrimaryContactID?: string | null;

    @Field({ nullable: true })
    DefaultBillingContactID?: string | null;

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
@ObjectType({ description: "Sales details for a person you sell to. The contact and its person are one record." })
export class mjBizAppsSalesSalesContact_ {
    @Field({description: "The contact's ID, the same as its person's ID."}) 
    @MaxLength(36)
    ID: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    OwnerEmployeeID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    LifecycleStageTypeID?: string;
        
    @Field({nullable: true, description: "The contact's usual buying role. The role on a particular deal is set in that deal's buying team."}) 
    @MaxLength(36)
    BuyingRoleTypeID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    LeadSourceTypeID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(50)
    Seniority?: string;
        
    @Field(() => Boolean, {nullable: true}) 
    OptedOutOfOutreach?: boolean;
        
    @Field({nullable: true}) 
    @MaxLength(500)
    DoNotContactReason?: string;
        
    @Field({nullable: true}) 
    LastEngagedAt?: Date;
        
    @Field() 
    _mj__CreatedAt: Date;
        
    @Field() 
    _mj__UpdatedAt: Date;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    FirstName?: string;
        
    @Field({nullable: true}) 
    @MaxLength(100)
    LastName?: string;
        
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
    PhotoURL?: string;
        
    @Field({nullable: true}) 
    Bio?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    LinkedUserID?: string;
        
    @Field({nullable: true}) 
    @MaxLength(50)
    Status?: string;
        
    @Field({nullable: true}) 
    @MaxLength(36)
    SeniorityLevelID?: string;
        
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
        
    @Field({nullable: true, description: "The contact's display name, followed by their primary email in brackets when they have one. Derived in vwSalesContacts; this is what lookups to a Sales Contact show instead of a GUID."}) 
    @MaxLength(753)
    DisplayNameAndEmail?: string;
        
    @Field(() => [String], { nullable: true, description: `Field-level security: when non-null, the fields on this entity the calling user may read. Any other field arriving as null was withheld by the server rather than genuinely empty. Null for callers with no field restrictions.` })
    ReadableFields___?: string[];
        
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

    @Field({ nullable: true })
    SeniorityLevelID: string | null;

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

    @Field({ nullable: true })
    SeniorityLevelID?: string | null;

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